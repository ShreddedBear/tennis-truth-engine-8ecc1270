# Phase 0 Audit — Baseline Measurement Gap

Scope: read-only. This engine's accuracy has never been independently measured. This
document specifies exactly what harness is needed, traced against what already exists in
code versus what is still missing, so Phase 1 builds on the real gap rather than
re-discovering it.

## 1. What already exists (do not rebuild)

`src/lib/truth-engine-calibration.ts` already contains a complete, chronologically-correct
walk-forward evaluation harness:

- `calibrationEligibility()` — determines whether a (match, decision) pair is a legitimate
  calibration observation: requires a frozen decision record, a non-null `selected_player`, a
  real `selected_player_id` (never inferred from a display name), an ID that matches one of
  the two match players, a FINAL/RETIRED match result, and a resolvable prediction outcome.
- `buildCalibrationObservation()` — assembles one frozen, gradeable row per eligible decision,
  carrying `evidence_support_percent`, family counts, stability, coverage, and
  `prediction_outcome: "WIN"|"LOSS"` derived by ID comparison only.
- `computeWalkForwardCalibration()` — sorts observations by `predicted_at` (the frozen decision
  time, never `observed_at`/`updated_at`), trains empirical reliability bins on a rolling
  window strictly before each test window, evaluates out-of-sample, and reports per-fold and
  pooled Brier score, log-loss, ECE, accuracy, and reliability buckets. Below
  `MIN_TOTAL_CALIBRATION_SAMPLE` (40) it returns `available: false` with the real observation
  count rather than fabricating a result.

This is real infrastructure, not a stub — the walk-forward split, the Laplace-smoothed
binning, and the strict `predicted_at`-ordering are all already leakage-conscious by
construction (see §3). **The gap is not "build a harness," it is "the harness has never had
data to run on."**

## 2. Why no baseline exists yet — the exact blocker, quantified

`docs/truth-engine-production-readiness-gap-audit.md`'s live read-only production snapshot
(project `qyovnrkiknsiqjybxubf`, `tennis-matrix-audit`, audit time close to this Phase 0 pass):

| Quantity | Value |
|---|---:|
| Matches | 60 |
| Audit runs (all `COMPLETE`) | 60 |
| `matches.actual_winner` populated | **0 of 60** |
| `result_grades` rows | **0** |
| `calibration_ledger` rows | **0** |
| `truth_engine_calibration_observations` rows | **0** |
| Decisions with an outcome | 60 (32 `INSUFFICIENT_EVIDENCE`, 22 YELLOW, 4 RED/PASS, 2 GREEN, 0 DOUBLE GREEN) |

`MIN_TOTAL_CALIBRATION_SAMPLE = 40` in the harness. With **0** resolved observations against a
required 40, `computeWalkForwardCalibration()` would correctly return `available: false` if run
today — not a bug, the harness doing exactly what it says. **The blocker is entirely upstream
of the calibration module: no match on the current slate has a recorded final result.** Until
`matches.actual_winner` starts getting populated (result capture — `match-result-capture.functions.ts`
exists and is tested, but nothing has fed it live outcomes for this slate yet), the harness has
structurally nothing to evaluate.

Additionally, §G7 in the gap audit (also covered in `can-it-say-no.md` §4) flags that the
*which field* question — pre-audit `selected_player` vs. post-audit `independent_winner` — must
be resolved before observations are built, or a stress-vetoed refusal could be misrecorded as a
confident, ungraded WIN/LOSS candidate. This must be fixed (or explicitly verified fixed) before
Phase 1 wires calibration observations to real decisions, not after.

## 3. What Phase 1's harness needs, item by item

### 3a. Historical corpus — read-only, frozen snapshot, never a live cross-repo import

The task mandates the corpus come from "a frozen snapshot export — never a live import of the
other repo's code." This repo has no dependency on the Prediction Engine's code or database at
all (verified in `docs/contracts/truth-engine-io.md`), so there is no cross-repo import risk to
guard against structurally — the Truth Engine's own corpus is its own `matches` /
`metric_results` / `final_decisions` tables in its own Supabase project. The corpus for Phase 1
should be:

- A **read-only SQL export** (`SELECT` only, matching the gap audit's own precedent — "0
  production rows modified") of `matches` (with `actual_winner` populated once result capture
  has run), `metric_results`, `final_decisions`, and `truth_engine_calibration_observations`
  (once populated), snapshotted at a fixed point in time and checked in or archived outside
  the live database.
- Frozen the moment it's pulled — no live query against the production database at evaluation
  time, so a later result-capture run cannot retroactively change what a past evaluation saw.
  This directly enforces the "no result rows overwritten" rule already in the working
  agreement.

### 3b. Chronological train/validation/test separation

Already implemented at the fold level: `computeWalkForwardCalibration()`'s rolling-window
walk-forward (train on everything with `predicted_at` strictly before the test window, test on
the window, roll forward) is exactly a chronological train/test split repeated across the
corpus. What Phase 1 must add is the **three-way labelling the working agreement requires**
(train / validation / test, not just train / test): reserve a held-out final segment (e.g. the
most recent N% of chronologically resolved observations) that is never touched by fold-fitting
at all, is evaluated exactly once, and is the number reported as "the test-segment figure" per
the working agreement's **NUMBERS MUST BE LABELLED** rule — every accuracy/log-loss/Brier/ECE
figure must carry segment, n, and date range, and only the untouched final segment counts as
"test" in that rule's sense; the walk-forward folds above it are properly "validation."

### 3c. Leakage — what already guards it, what Phase 1 must verify

Already true by construction, verified by reading the code (not assumed):
- `predicted_at` is `independent_decision_committed_at` — the frozen decision time — never
  `observed_at`/`updated_at`. A stale observation cannot be re-timestamped into a later fold.
- `calibrationEligibility()` requires `matchResultIsFinal(match)` — an in-progress or
  未-scheduled match cannot become a training row.
- The decision record itself (`buildDecisionRecord()`) is built from
  `final_decisions.gate_report.deterministic_decision`, itself "a pure function of
  `metric_results` as they stood at that moment" per its own header comment — the feature side
  cannot see the actual result.
- 14 separate `*.leakage.test.ts` files already exist in the codebase (per the gap audit's test
  inventory) covering temporal-boundary and post-match-date leakage at the metric-computation
  layer — this is a tested, not merely asserted, property one layer below calibration.

Not yet verified, and Phase 1's explicit job:
- **G10** (gap audit): `applyMetaIfReady` can reopen `FINAL DECISION` and rewrite the decision
  row after a meta-derived writer changes an underlying metric, and `commitFinalDecision` reads
  `matches.actual_winner` into the record at that time. With `actual_winner` at 0/60 today
  nothing is contaminated *yet*, but Phase 1 must add the check the gap audit itself
  recommends — freeze the decision record at first write, carry the outcome only in
  `result_grades` — **before** result capture starts populating `actual_winner` for this slate,
  or the frozen-snapshot guarantee in §3a is only true by accident of timing, not by
  enforcement.
- **G7** (also `can-it-say-no.md` §4): confirm which `selected_player` a resolved observation
  is actually built from (pre- or post-stress-veto) before trusting `prediction_outcome` on any
  observation involving a refused-then-reconsidered decision.
- A proof, not just an assertion, that the eventual held-out test segment's `predicted_at`
  values are never used anywhere in fitting the bins used to score it — i.e. an explicit test
  (not present today) that feeds the harness a corpus with an artificially leaked
  post-cutoff-date feature and asserts the fold split rejects/excludes it.

### 3d. Minimum viable Phase 1 sequence

1. Verify G7 (which field feeds `selected_player`) and, if unresolved, fix it — this is a
   one-field correctness issue that would otherwise poison every future calibration
   observation silently.
2. Verify/land the decision-record freeze (G10) before result capture runs at scale.
3. Run result capture against the current 60-match slate (or whatever slate exists at Phase 1
   time) to populate `matches.actual_winner`, producing the first real
   `truth_engine_calibration_observations`.
4. Export a frozen, read-only snapshot per §3a once enough resolved observations exist to be
   meaningful (the harness's own floor, `MIN_TOTAL_CALIBRATION_SAMPLE = 40`, is the
   engineering minimum to produce *any* number — note per `families.md` §3c this constant
   itself has no stated statistical derivation and should not be treated as a confidence
   guarantee, only a floor below which the harness correctly refuses to report).
5. Add the train/validation/test three-way split on top of the existing walk-forward folds
   (§3b), report every number with segment/n/date-range per the working agreement, and publish
   the first labelled baseline — this is the explicit deliverable of Phase 1, and nothing here
   should be tuned against it per **NO TUNING BEFORE MEASUREMENT**.

## 4. Historical disagreement rate with the Prediction Engine

Not measurable at all today, for two independent reasons, both structural rather than
incidental:
1. Per `docs/contracts/truth-engine-io.md`, no code path in this repo currently ingests a
   Prediction Engine probability/selection as a comparable payload — there is nothing to
   disagree *with* in the persisted record yet.
2. Even if that payload existed, the disagreement statistic depends on the same resolved-corpus
   infrastructure as §2 — 0 of 60 matches have a known actual outcome, so "how often has this
   engine disagreed with the other, and who was right" cannot be computed even once for the
   "right" half of the question; only the raw disagreement rate (independent of outcome) could
   theoretically be computed today, and even that requires the payload from (1) to exist first.

Phase 1, if it wants this number, needs both: (a) the Prediction Engine payload plumbed through
per the contract gap identified in `docs/contracts/truth-engine-io.md`, and (b) the same
resolved-corpus work as §3d above. Recommend treating this as a Phase 2+ item — it is strictly
downstream of both the contract gap and the baseline harness this document scopes.
