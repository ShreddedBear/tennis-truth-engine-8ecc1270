# Metric #046 — Match-State Elo

Status: **DONE**, restricted to WTA_MAIN/ATP_CHALLENGER per
`docs/audit-task-new-batch1-step0.md`'s resolution. 6 new unit tests, all
passing.

**Wiring update (later pass):** this module was built and tested but never
actually called from the live pipeline. Now wired in via
`src/lib/deterministic-batch1-standalone-metrics.server.ts`. No changes to
this module's own math.

Files: `src/lib/audit-metric-046-match-state-elo.ts` (+ `.test.ts`).

## Scope

Catalog (`public/seed/metrics.txt` #46) has six bullets. This batch ships
only the two the build-order explicitly named:

- **Elo After Winning Set 1**
- **Elo After Losing Set 1**

Out of scope for this batch, not silently dropped:
- *Elo in Deciding Sets* / *Elo in Tiebreak-Heavy Matches* — plausibly
  derivable from `set_scores` in a future batch, but not requested here.
- *Elo Against Big Servers* / *Elo Against Strong Returners* — **BLOCKED**.
  No serve/return statistic exists anywhere in the static history index to
  classify an opponent as a "big server" or "strong returner" by.

## Model

A genuinely **separate** Elo system from `task18c-rank-form-workload.ts`'s
`replayElo` (the "general" Elo #001 and #031/#041 use) — never read from
or written into that module. Two independent rating tracks:
`after_winning_set1` and `after_losing_set1`. For each historical match,
the set-1 winner's `after_winning_set1` rating plays a single Elo contest
against the set-1 loser's `after_losing_set1` rating, scored on the
**match's** actual winner (not the set-1 winner) — literally measuring
"how well do you convert having taken set 1" vs. "how well do you come
back from losing it," as two separately-evolving pools. Same K=32,
logistic expected-score formula, and initial rating (1500) as the general
replay, but its own independent state.

## Data source

Set_scores are read directly from the same raw `HistoryLane` object
`task18c-rank-form-workload.ts`'s `laneMatchesBefore` already reads (not a
second, potentially-divergent lookup through the global singleton index)
— `buildSetScoreIndex` builds a `{date|opponent -> set_scores}` map from
that same lane, keeping this metric's data source and its match-list
source structurally identical to each other.

## Lane restriction

WTA_MAIN and ATP_CHALLENGER only — `set_scores` (needed to know who won
set 1) only exists in those two lanes in the static history index; same
structural gap #027/#029 already document. `ATP_MAIN`/`WTA_CHALLENGER` are
rejected outright at the lane-eligibility check, before any replay runs.

## Performance note

This replays the whole lane's chronological match history on every call —
the same cost profile `replayElo` already has, and that #031/#041 already
accept for the same reason (Elo state is a full-history fold, not
incrementally cacheable per-query without a persistence layer this batch
does not add). At current lane sizes (max ~65k matches, ATP_CHALLENGER)
this is a bounded single pass with O(1) per-match work — not a
Copilot-scale concern, but not free either. A caller computing this for
many matches in a batch should replay once per `(lane, asOfDate)` and
query both players from the same result, not call `computeMatchStateElo`
once per player.
