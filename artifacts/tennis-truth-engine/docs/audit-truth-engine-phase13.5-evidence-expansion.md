# Truth Engine Phase 13.5 — targeted evidence expansion (016, 045, 068)

Baseline: commit 48a3318 (Phase 13, 22 active comparison codes). This phase implements the
three strongest candidates the prior forensic inventory identified as "calculable now" or
"calculable after a parser fix" (016, 045, 068), investigates 046 for activation, and
evaluates 004/023/038 without activating them — per explicit instruction, without expanding
the registry beyond these four investigations.

**Registry: 22 → 25.** 046 is deliberately NOT activated.

## Direction and family, proven before activation

### 016 — Point-by-Point & Score-State Metrics

**Parser defect found:** the real payload nests a SECOND JSON-encoded string
(`score_state_performance_json`) one level inside the already-merged `output={...}` payload.
The Phase 12 merge loop only flattens *numeric* leaves, so this string-valued leaf was
invisible to every spec — 016 could never have been activated without this fix regardless
of registry entries.

Only the `"Break Point"` state is extracted (58/58 live usable rows carry it, median n=9.5),
never all ~17 score states blindly — most individual states have n=1 or n=2 in real data,
and flattening them all would manufacture paper-thin per-state samples. `"Break Point"` is
also one of the states the metric's own definition names explicitly.

- Field: `score_state_break_point_win_pct`, sample: `score_state_break_point_n`, minSample 8
- Direction: HIGHER_IS_BETTER (proven from source: `recordState(side, "Break Point", won)` —
  higher win-rate at a break-point score-state is unambiguously better performance)
- Family: **POINT_BY_POINT** (joins 002/003/009/018/032/034/053 — the identical replay of
  the identical matches; confirmed by tracing the shared `evidence_family` column and the
  shared source file `pbp-score-state-recovery.ts`)
- Materiality: 24pp (n=9.5 median → SE(diff) ≈ 23pp)

### 045 — Favorite Fragility Under Resistance

- Field: `forced_deciding_set_win_pct`, sample: `forced_deciding_set_n`, minSample 8
- Direction: HIGHER_IS_BETTER — proven from the producer
  (`audit-metric-045-favorite-fragility.ts:computeFavoriteFragilityFromPerspectives`): win
  rate specifically in matches where the player was the pre-match Elo favourite AND the
  match reached a deciding set. This is the metric's own last-listed, highest-stakes bullet
  ("Performance When Opponent Forces Set 3").
- Family: **SET_PROFILE** (joins 008/010) — a favourite-conditional refinement of the same
  "performance in a decider" question 008 already asks unconditionally; a separate family
  would manufacture a second vote for one underlying concept.
- Materiality: 25pp (n=8 median, min 0, of 51 live rows → SE(diff) ≈ 25pp)

### 068 — Streaks / Milestones

**Second parser defect found:** field census showed `current_streak_signed` (a clean,
already-numeric field) in exactly **1 of 163** live usable rows — I initially built the spec
around it before checking the distribution, which would have silently starved 068 of
evidence in 99.4% of real cases (the same trap Phase 12 documented for 008/010). The
DOMINANT shape (162/163 rows; `historical-results-recovery.ts`) encodes the streak as a
letter+magnitude string, `current_streak=W12` / `L3`. Decoded into the SAME field name the
rare producer already uses (`current_streak_signed`) — proven to be the identical
real-world quantity (positive = active win streak length, negative = active loss streak
length) under two different serializations, not a similar-sounding substitute.

- Field: `current_streak_signed` (derived), sample: `season_matches`, minSample 5
- Direction: HIGHER_IS_BETTER — proven from source (`sign=last==="1"?1:-1`): a longer
  active win streak is unambiguously better, a longer active loss streak worse.
- Family: **RECENT_FORM** (joins 005/055) — the current-streak bullet is the same recent-
  results question 005/055 already ask.
- Materiality: 5 matches (real stdev of the P1−P2 signed differential across 162 live
  paired rows: 4.51)
- **Known limitation, not fixed:** the producer computes the streak over ALL completed
  history, but that true denominator is never persisted. `season_matches` (this-season
  match count) IS persisted and is always ≤ the true denominator, so gating on it can only
  be overly conservative, never under-conservative — it cannot let a thin true sample
  through, but it can reject some genuinely fine evidence. Documented rather than guessed
  around.

## 046 — investigated, deliberately NOT activated

Two disqualifying findings, either alone sufficient to withhold activation:

1. **No single canonical field.** `elo_after_winning_set1` and `elo_after_losing_set1` are
   two genuinely separate, independently-evolving Elo tracks
   (`docs/audit-task-new-batch1-046-match-state-elo.md`), both equally-weighted named
   bullets, both persisted in 100% of the same 60 live rows. Nothing in the metric's own
   definition, its build doc, or any call site declares one primary. Picking either would
   be exactly the kind of guess this registry exists to refuse.
2. **No persisted denominator.** 0 of 60 live usable rows carry any sample/n field for
   either quantity — the underlying Elo replay has a real sample size, but it is never
   written to the persisted string. A thin-evidence guard cannot be built for it, and this
   registry has never shipped a spec without one where a denominator concept applies.

## A leak found while tracing 045's temporal safety (fixed)

Verifying 045's producer chain (`warehouse-first-researcher.server.ts` → `deterministicBatch2NewMetric`) surfaced a second instance of the Phase 13 leak class, in code Phase 13 did not touch:

```ts
function asOfDate(context) {
  const match = String(context ?? "").match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return match?.[1] ?? new Date().toISOString().slice(0, 10);   // <-- today's date
}
```

When the audited match has no date (the same null-`scheduled_date` condition Phase 13
found — 1 of 55 live matches), this silently substituted **today's wall-clock date** as the
audit boundary, admitting every record up to the moment the code runs. This is a different
failure mode than Phase 13's ("no filter at all" vs. "filter as of right now"), same root
cause, in a file Phase 13 never inspected — found specifically because this phase traced
045's full producer chain to source as instructed, not by re-running the Phase 13 sweep.

**Fixed** by reusing `temporal-boundary.ts`'s `auditCutoff()` (returns `null` on no match)
and falling back to `""` rather than a guessed date. Every consumer of this value filters
with a strict `<`/`<=` comparison, so an empty string loses every comparison and returns
zero rows — fails closed, not open. `asOfDate` exported and a dedicated leakage test added
(`warehouse-first-researcher-temporal-boundary.leakage.test.ts`, 4 tests).

## A same-day-inclusive boundary found, NOT fixed (out of scope)

Tracing 016's producer chain (`bsd-*-pbp.server.ts`) found every POINT_BY_POINT source
filter uses `<=` (`String(r.date).slice(0,10)<=args.asOfDate`) rather than the strict `<`
Phase 13 established elsewhere — admitting a match played on the audited day itself as
"prior" evidence. This is **pre-existing and uniform** across the whole POINT_BY_POINT tier
(it equally affects the seven already-active Phase 12 codes 002/003/009/018/032/034/053,
not something 016 introduces), and rewriting it is a substantially larger, higher-blast-
radius change than this task's stated scope (016/045/046/068 plus evaluating 004/023/038).
Documented here rather than silently changed or silently ignored; flagged as a candidate
for a dedicated future pass.

## Family independence, verified

- Adding 016/045/068 does **not** change which families support or contradict the winner
  in either fixture tests or the live end-to-end check below — they only join families
  that already existed (POINT_BY_POINT, SET_PROFILE, RECENT_FORM), either corroborating or
  creating an internal conflict inside that family, never casting a second vote.
- A dedicated test proves eight now-agreeing POINT_BY_POINT metrics (the original seven
  plus 016) still cast exactly one vote and cannot alone elect a winner.
- A dedicated test proves 045 agreeing with 008 keeps SET_PROFILE a single vote, and 045
  disagreeing with 008 makes SET_PROFILE **conflicted** (contributing nothing) rather than
  two opposing votes.
- A dedicated test proves 068 disagreeing with 005 makes RECENT_FORM conflicted, mirroring
  the real bd5ff483 finding from Phase 12 where two same-family metrics measuring the same
  window pointed opposite ways.

## Live database verification

Real run `c40f4025` (Gonzalo Bueno vs Joao Lucas Reis Da Silva) — the same run used in the
Phase 12 and Phase 13 reports — re-run through the full chain at three registry sizes:

| Registry | Outcome | Support families | Contradiction families | Conflicted |
|---|---|---|---|---|
| 9 (original) | P1 | CLOSING_ABILITY, COMMON_OPPONENT, RECENT_FORM, SURFACE_STRENGTH | H2H_PROBABILITY | — |
| 22 (Phase 12) | P1 | + IMPROVEMENT_TREND | + LOSS_PROFILE | POINT_BY_POINT |
| 25 (this phase) | P1 | *identical to 22* | *identical to 22* | POINT_BY_POINT; **SET_PROFILE now has coverage** (NEUTRAL) |

The winner (P1, Gonzalo Bueno) and every support/contradiction family are **byte-identical**
between the 22-spec and 25-spec runs — confirming no new vote was manufactured. The only
change: 045 gave the SET_PROFILE family its first-ever comparison in this match (008 and
010 were both `VALUE_NOT_PARSEABLE` on this particular run's bare-scalar rows), and 068
added a second confirming vote inside the already-existing RECENT_FORM family (+4 vs −3
streak, clears the 5-match materiality floor).

Persisted-row-patch check: verification findings 6→9, disagreement severity unchanged at
CRITICAL (2 families), underdog unchanged (STRONG STYLE_MISMATCH for Joao Lucas Reis Da
Silva), stress unchanged (P1→P1, STABLE).

## 004, 023, 038 — evaluated, not activated

Investigated as instructed. All three are directionally clean (each has a defensible
single field and provable direction from its producer) but too thin for production use:

| Code | Live usable rows | Field | Verdict |
|---|---|---|---|
| 004 | 12 | `dominance_ratio` / `combined_point_efficiency` | Directionally clean, but a 12-row denominator means this metric would sit UNAVAILABLE in the overwhelming majority of real audits — not a reliable production voter yet. |
| 023 | 10 | `serve_vs_opponent_return_edge` | Same conclusion at an even thinner 10 rows. |
| 038 | 9 | `games_won_residual_pct` | Same conclusion at 9 rows, the thinnest of the three. |

None is blocked by direction ambiguity or a missing denominator the way 046 is — they are
blocked purely by current data volume. Re-evaluate once their producers accumulate more
live coverage; no code change is needed to activate them later, only more data.

## Regression tests

10 new tests in `truth-engine-decision.test.ts` (family placement × 3, single-vote
proof, agree/conflict proofs × 2, 046 exclusion proof, 004/023/038 exclusion proof,
registry-size pin) plus the existing P1/P2 swap-test generator, which now automatically
covers all 25 specs (including 016/045/068) via its `Object.keys(COMPARISON_SPECS)`
coverage check. 4 new tests in a dedicated temporal-boundary leakage file for the
`asOfDate()` fix.

Total suite: 1073 tests across 137 files, clean `tsc --noEmit`, worker bundle 7.7MB/25MB,
two consecutive full runs both green (checking for the Phase 13 report's unexplained
single intermittent failure — did not reproduce).

## What this phase did NOT do

- Did not touch the 15 quarantined Matrix Summary codes (pinned by test).
- Did not touch the 9 metrics classified `NOT LEGITIMATELY CALCULABLE`.
- Did not change any existing spec, family, or materiality value from Phase 12/13.
- Did not fix the pre-existing same-day-inclusive (`<=`) boundary in the POINT_BY_POINT
  source tier — documented above as a candidate for a dedicated future pass, since fixing
  it touches seven already-active metrics well beyond this phase's stated scope.
- Did not change the decision/voting architecture in any way — every addition here joins
  an existing evidence family exactly as instructed.
