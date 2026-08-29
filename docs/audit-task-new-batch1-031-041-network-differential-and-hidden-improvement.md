# Metrics #031 & #041 — Common-Opponent Point Differential + Hidden Improvement Detector

Status: **DONE**, GO across all four lanes (per
`docs/audit-task-new-batch1-step0.md`'s resolution: Elo substitution turns
both from lane-inconsistent PARTIAL into fully GO). 15 new unit tests, all

**Wiring update (later pass):** both modules were built and tested but
never actually called from the live pipeline. Now wired in via
`src/lib/deterministic-batch1-standalone-metrics.server.ts` (see
`docs/ARCHITECTURE-FINDING-disconnected-hybrid-researcher.md` for the prior
precedent this follows, and that file's own integration test). No changes
to either module's own math.
passing.

Files: `src/lib/audit-metric-031-common-opponent-point-differential.ts` (+
`.test.ts`), `src/lib/audit-metric-041-hidden-improvement-detector.ts` (+
`.test.ts`).

## Strength adjustment: derived Elo, not rank

Both metrics need a per-lane opponent-strength signal. Rank is sparse or
entirely absent in exactly the lanes rank always is (`self_rank`/
`opponent_rank` populated 0.0% for ATP_MAIN/WTA_CHALLENGER per
`docs/audit-task-new-batch1-step0.md`'s Step 0 table). **Derived Elo**
(`task18c-rank-form-workload.ts`'s `replayElo` — a deterministic,
leakage-safe K=32 replay from raw match results alone) has no such gap: it
replays from the same results data present in every lane, so it is the
only strength signal available uniformly across all four. This is the
substitution the Step 0 resolution calls out as turning both metrics fully
GO.

## #031 Common-Opponent Adjusted Point Differential

Catalog definition (`public/seed/metrics.txt` #31, "Extended
Opponent-Network Metrics"): "point differential against shared opponents,
adjusted for opponent strength."

**Data-granularity substitution, documented not hidden**: no point-by-point
or game-by-game data exists anywhere in the static history index for any
lane. What *is* populated uniformly (~98–100%, confirmed by directly
inspecting the generated index) is `sets_for`/`sets_against` per match.
This module uses **set differential** as the finest-grained proxy for
"point differential" actually available — never fabricated point-level
data.

For each opponent common to both players, computes each player's own
average set differential against that opponent, weighted by the common
opponent's Elo (a stronger shared opponent's result counts for more — the
literal meaning of "adjusted for opponent strength"), then reports the gap
between the two players' Elo-weighted averages. A common opponent with no
known Elo rating is excluded, never defaulted to a guessed rating.

## #041 Hidden Improvement Detector

Catalog definition (`public/seed/metrics.txt` #41) has two bullets:

- **"Opponent-Quality-Adjusted Record Trend"** — ships. Splits a player's
  trailing window (default 20 matches) into an earlier and a recent half,
  and flags `IMPROVEMENT_HIDDEN_BY_RECORD` when the raw win rate is flat
  or declining while the mean surplus over Elo-expectation (actual outcome
  minus the Elo-implied win probability against that specific opponent) is
  actually rising — i.e. the player is beating tougher-than-before
  opponents by more than Elo alone would predict, even though the plain
  win-loss record doesn't show it.
- **"Underlying-Metric Improvement Despite Losses"** (needs hold rate,
  return points won, Dominance Ratio, break points created) — **BLOCKED**,
  not implemented. None of those point/game-level stats exist anywhere in
  the four-tour static history index (results-only: date, opponent,
  won/lost, round, set counts). Documented here per this batch's
  established pattern for dropped refinements so it is not re-attempted
  without new data.

## Reporting

Both report per-lane via the shared `LaneOutcome` type. `#031` is
`NOT_ENOUGH_DATA` when either player has no prior rows, or when no common
opponent with a known Elo rating exists between them. `#041` is
`NOT_ENOUGH_DATA` when a player has fewer than 2 prior matches (not enough
to split into an earlier/recent half).
