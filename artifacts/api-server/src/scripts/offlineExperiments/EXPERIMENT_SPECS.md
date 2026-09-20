# Offline Experiment Specs — Parlay Builder / Prediction Engine Market & Calibration Audit

Preparation-only. Nothing in this directory has been run against a real database — there is no
`DATABASE_URL` in this environment, and per the task brief, `pnpm install` was not run (large
monorepo; would likely exceed time/disk). Every script below is written, and its fail-fast /
mechanism behavior is unit-tested against synthetic, clearly-labeled test-only fixtures (see each
script's co-located `*.test.ts`). See the bottom of this file for exactly which tests actually
ran in this environment and which could not (and why).

**Database access is available today** (a live authorized DB connection exists for this app), but
the current historical corpus does not contain the timestamped market evidence these experiments
need to answer the market questions. That is the actual blocker for the market-dependent
experiments (#4, #5, #6, #7) — connecting to a database in the future does not, by itself,
complete the market audit; the corpus still has to be populated with graded, timestamped odds
history first. See `docs/audits/metric-truth-market-calibration-audit.md` section 13 for the
authorized-database inventory this is built on, and the new "Offline Experiment Readiness"
section for per-experiment disposition.

## Shared infrastructure

- `productionFormulaMirror.ts` — byte-for-byte mirror of the non-exported pure formula helpers in
  `builderScoringService.ts` (closenessRiskFloor, toReliabilityGrade, toParlayGrade, toDecision,
  the closeness-signal averaging block, the removalProbability formula), plus re-exports of the
  functions/constants that ARE safely exported from production
  (thinDataRiskFloor, THIN_DATA_RISK_FLOOR, MIN_SAMPLE_FOR_TIER_COMPARISON, computePlayerStats,
  `__TEST_computeScoring`). Every experiment script imports formulas from here — never
  reimplements one a second (or third) time. See the file's own header for its pinned commit and
  the drift-risk warning.
- `productionFormulaMirror.test.ts` — pinning test: hand-computed input/output pairs for every
  mirrored function, derived by reading the real formula and computing on paper (never by running
  the mirror itself, which would be tautological).
- `experimentProvenance.ts` — the experiment provenance contract (see below). Every experiment
  script's output is accompanied by one `ExperimentProvenance` record.
- `sharedValidation.ts` — `requireFields` (the fail-loud gate every loader runs raw rows through),
  standard metrics (`accuracy`, `brierScore`, `logLoss`, `calibrationError`, `auc`), an
  `ExclusionTracker` (reason-bucketed exclusion counting), and `assessMeaningfulness` (sample-size
  + admissible-fraction floor check).

## Experiment provenance contract

Every experiment's output (real or from a synthetic fail-fast/mechanism test) is accompanied by an
`ExperimentProvenance` record (`experimentProvenance.ts`) containing:

| Field | Meaning |
|---|---|
| `experimentId` | stable name + version this author controls, e.g. `"risk-floor-on-off@v1"` |
| `codeCommit` | git SHA of the worktree HEAD when the script ran — read live via `git rev-parse HEAD`, never hardcoded |
| `formulaVersion` | exactly which production function/version fed this experiment's scoring, citing `productionFormulaMirror.ts`'s pinned commit |
| `datasetIdentifier` | human label for what was loaded (file path or table name) |
| `datasetHash` | SHA-256 of the serialized input rows |
| `dateRange` | min/max of whatever date field defines the corpus |
| `predictionCutoffRule` | the temporal-cutoff rule actually enforced, stated precisely |
| `nTotal` / `nEligible` / `nExcluded` | row counts |
| `exclusionReasons` | breakdown by reason, not just a count |
| `temporalValidationMethod` | plain description of how leakage was checked for this run |

A BLOCKED run (no data) still emits a full record with `nTotal=0`/`nEligible=0` and the exact
reason — provenance is never skipped. `experimentProvenance.test.ts` proves the builder correctly
reflects a synthetic fixture's excluded rows and reasons, and throws if the exclusion-reason
breakdown doesn't reconcile with the totals.

## Sample-size / admissible-fraction floor convention

Default floor: `MIN_SAMPLE_FOR_TIER_COMPARISON = 50` (builderScoringService.ts:2217 — the
codebase's own minimum-n convention for exactly this kind of tier/bucket comparison), used by
Experiments #1, #2, #3, #7. Experiments #4, #5, #6 use `n>=200`, matching
`auditMarketConsensusAblation.ts`'s own precedent for its Section B (paper-trade engine re-run)
market comparison — the most specific existing precedent for a market-vs-no-market comparison on
`evaluation_predictions`. In every case, at least 50% of loaded rows must also pass the temporal
admissibility check for a result to be reported as meaningful (`assessMeaningfulness`); below that,
the result is reported with `isMeaningful: false` and the reason, never hidden.

---

## Experiment #1 — Risk Floor ON vs OFF

**Script:** `exp1RiskFloorOnOff.ts`

- **Required fields** (`parlay_leg_outcomes`): `id`, `selected_player_id`, `validation_score`,
  `risk_score`, `source`, `created_at` (structural — throws if absent); `matchup_closeness`,
  `actual_winner_id`, `resolved_at` (admissibility gates — excluded+counted if absent, never
  thrown, since "not graded yet" is an expected normal state for this table today).
- **Calculation:** `closenessRiskFloor(matchup_closeness)` (mirror) compared to stored
  `risk_score`. `risk_score === closenessRiskFloor(...)` → "floor likely bound";
  `risk_score > closenessRiskFloor(...)` → "floor did not bind"; `risk_score <
  closenessRiskFloor(...)` is structurally impossible under current-code scoring and is excluded
  as a stale-formula-version row (see script header for why the TRUE pre-floor risk cannot be
  reconstructed from stored columns alone — `parlay_leg_outcomes` does not persist raw match
  history/PlayerStats, only the final risk_score).
- **Temporal cutoff:** none directly (this experiment doesn't use market odds); admissibility is
  purely "graded" (actual_winner_id & resolved_at populated).
- **Output table:** one row per bucket (`floor_likely_bound`, `floor_did_not_bind`) × {n,
  winRatePct, meaningfulness}.
- **Validation metrics:** win rate (accuracy). Brier/log-loss are not computed here because
  `parlay_leg_outcomes` has no stored calibrated probability comparable across the two buckets
  (see Experiment #2/#6 for where `factor_scores`/`builder_calibrated_probability` are used).
- **Leakage protections:** rows scored by an older formula version (risk_score below the
  closeness-implied floor) are rejected and counted, never included.
- **Exclusions:** not graded; matchup_closeness null; stale-formula-version rows.
- **n-floor:** 50 per bucket (`MIN_SAMPLE_FOR_TIER_COMPARISON`); ≥50% admissible fraction.
- **NOT A VALID ON/OFF CAUSAL COMPARISON TODAY (per external review):** the two output buckets
  are an inference about which floor a row's stored risk_score is *consistent with*, not a
  counterfactual floor-OFF arm. Win-rate comparison between buckets must not be read as evidence
  the floor helps or hurts calibration. This experiment stays **BLOCKED — MISSING DATA** even
  once `parlay_leg_outcomes` has graded rows, until the historical dataset persists either (a)
  both pre-floor risk and final risk_score per row, or (b) enough component-level inputs to
  deterministically recompute preClosenessRisk via the pinned mirror. See the script header for
  the full explanation.

## Experiment #2 — Current KEEP/BORDERLINE/REMOVE calibration

**Script:** `exp2CurrentDecisionCalibration.ts`

- **Required fields:** `id`, `selected_player_id`, `validation_score`, `risk_score`,
  `reliability_grade`, `data_coverage`, `decision`, `created_at` (structural); `actual_winner_id`,
  `resolved_at` (graded gate).
- **Calculation:** `toDecision(validation_score, risk_score, reliability_grade, data_coverage,
  criticalFlags=[])` (mirror) recomputed and compared to stored `decision`. Match → included.
  Mismatch is split into two buckets, never conflated: (a) stored BORDERLINE but recompute (no
  flags) gives KEEP/REMOVE → `"unverifiable (criticalFlags not stored)"` (criticalFlags isn't
  persisted, so a legitimately flag-forced BORDERLINE looks like a mismatch); (b) any other
  mismatch → `"stale formula version"`, excluded.
- **Temporal cutoff:** none (no market odds used).
- **Output table:** one row per decision (`KEEP`, `BORDERLINE`, `REMOVE`) × {n, winRatePct,
  meaningfulness}, plus `keepVsBorderlineGapPp` when both clear the sample floor.
- **Validation metrics:** win rate per decision tier; KEEP-vs-BORDERLINE gap (pp), mirroring the
  codebase's own `keepVsBorderlineGap` convention at builderScoringService.ts:2217-2266.
- **Leakage protections:** formula-version mismatches rejected and counted, never included.
- **Exclusions:** not graded; stored decision not one of KEEP/BORDERLINE/REMOVE; unverifiable
  (criticalFlags gap); stale-formula-version.
- **n-floor:** 50 per decision tier; ≥50% admissible fraction.

## Experiment #3 — Borderline separation analysis

**Script:** `exp3BorderlineSeparation.ts`

- **Required fields:** same as Experiment #2 (imports its loader directly — never re-verifies
  formula-version-match a second way).
- **Calculation:** `distanceToKeepLine` / `distanceToRemoveLine` (mirror, derived directly from
  `toDecision`'s own thresholds: KEEP line val≥62∧risk≤44; REMOVE line val≤33∨risk≥70) computed
  for every row whose Experiment #2-verified decision is BORDERLINE. Bucketed into
  `near_keep_boundary` / `near_remove_boundary` / `near_both_boundaries` / `deep_middle` (±10
  score-point band around each line).
- **Temporal cutoff:** none.
- **Output table:** one row per boundary bucket × {n, winRatePct, meaningfulness}.
- **Validation metrics:** win rate per bucket — used to distinguish "correctly uncertain" (all
  buckets ≈50%), "thresholds too conservative" (near_keep_boundary wins at a KEEP-like rate), or
  "no underlying separation" (no bucket differs meaningfully), per the task's framing.
- **Leakage protections:** inherited from Experiment #2.
- **Exclusions:** inherited from Experiment #2, plus "verified-current-code but not BORDERLINE".
- **n-floor:** 50 per bucket; ≥50% admissible fraction.

## Experiment #4 — Market Full vs No-Market vs Market-Only vs Market+Independent

**Script:** `exp4MarketArms.ts`

- **Required fields** (`evaluation_predictions`): `id`, `player1Id`, `player2Id`, `cutoffAt`,
  `status` (structural); `includedInAccuracy`, `predictedWinnerId`, `actualWinnerId`,
  `calibratedProbability`, `impliedProbability`, `oddsPlayer1Decimal`, `oddsPlayer2Decimal`,
  `oddsFetchedAt` (admissibility gates).
- **Calculation:** Arm A = stored `calibratedProbability` as-is (computable). Arm C =
  `impliedProbability` alone as the prediction (computable). Arm B (engine re-run excluding
  market, via `runPredictionEngine({ ..., excludedModels: new Set(["marketOdds"]) })`, same
  mechanism as `auditMarketConsensusAblation.ts`) and Arm D (B blended with market) are **not
  offline-computable** from a flat row export — B needs the live historical-match corpus + DB
  pool; D needs a documented production blend formula that does not exist in this codebase today
  (checked `predictionEngine/index.ts`). Both are emitted in the output table with `computable:
  false` and an explanatory `note`, never guessed.
- **Temporal cutoff:** `oddsFetchedAt <= cutoffAt`, enforced per row; violations rejected+counted.
- **Output table:** one row per arm × {n, computable, note, accuracyPct, brier, logLoss,
  calibrationError, auc, meaningfulness}.
- **Validation metrics:** accuracy, Brier, log-loss, ECE (calibration error), AUC — matching what
  `backtestScoringDimensions.ts` and `auditMarketConsensusAblation.ts` already report.
- **Leakage protections:** `oddsFetchedAt > cutoffAt` rows rejected and counted.
- **Exclusions:** not graded; not includedInAccuracy; missing predicted/actual winner; missing
  calibratedProbability; missing market odds; missing impliedProbability; temporal leakage.
- **n-floor:** 200 (matches `auditMarketConsensusAblation.ts`'s Section B precedent); ≥50%
  admissible fraction.

## Experiment #5 — Market shuffle / placebo test

**Script:** `exp5MarketShufflePlacebo.ts`

- **Required fields:** same admissible corpus as Experiment #4 (imports its loader directly).
- **Calculation:** permutes `(oddsPlayer1Decimal, oddsPlayer2Decimal, oddsFetchedAt)` triples
  across rows within the same UTC-day window of `cutoffAt`, rejecting (a) the identity
  permutation and (b) any assignment where the donor's `oddsFetchedAt` would be after the
  recipient's `cutoffAt`. Windows with <2 rows, or where no valid non-identity permutation is
  found within the attempt budget, are excluded wholesale — never partially shuffled. Re-scores
  with the same Arm-C-style de-vig logic as Experiment #4 (`devigImpliedProbabilityPlayer1`); a
  full engine-based Arm B/D placebo is out of scope for the same reason Experiment #4's Arm B/D
  are not offline-computable.
- **Temporal cutoff:** Experiment #4's admissibility, PLUS the per-shuffle constraint above.
- **Output table:** `real_pairing` vs `shuffled_pairing` × {n, accuracyPct, brier, logLoss,
  meaningfulness}.
- **Validation metrics:** accuracy, Brier, log-loss (compare real vs shuffled).
- **Leakage protections:** a shuffled triple is never assigned to a row where it would become
  temporally inadmissible; such windows are excluded and counted, not silently skipped.
- **Exclusions:** Experiment #4's exclusions, plus "excluded from shuffle: no admissible
  non-identity permutation within window".
- **n-floor:** 200; ≥50% admissible fraction (same convention as Experiment #4).

## Experiment #6 — Market-weight sensitivity

**Script:** `exp6MarketWeightSensitivity.ts`

- **Required fields:** a pre-joined export of graded, `source='backfill'` `parlay_leg_outcomes`
  rows (`id`, `selected_player_id`, `source`, `created_at`, `factor_scores` — structural;
  `actual_winner_id`, `resolved_at`, `backfill_match_id` — admissibility) joined to their
  `evaluation_predictions` row via `backfill_match_id` (`joined_odds_fetched_at`,
  `joined_cutoff_at`, `joined_status`, `joined_included_in_accuracy`). `factor_scores` must
  contain a `marketConsensus` entry — throws by name if absent (a leg scored before that factor
  existed is a data-integrity problem, not an expected state, hence throw not exclude).
- **Calculation:** `reweightMarketConsensus(factors, candidateWeight)` +
  `computeValidationScoreAndCoverage(...)` (mirror) for each of
  `CANDIDATE_WEIGHTS = [0, 0.1, 0.2, 0.3, 0.4, 0.5]` (0–50% of the 0–1 DEFAULT_WEIGHTS scale;
  current production value is 0.040, `CURRENT_MARKET_CONSENSUS_VALIDATION_WEIGHT`). The candidate
  minimizing mean Brier score is chosen **only on the chronologically-earlier half** (by
  `created_at`) of the admissible rows, then evaluated on the chronologically-later, **disjoint**
  half — never picked against the same data it's evaluated on.
- **Temporal cutoff:** `joined_odds_fetched_at <= joined_cutoff_at` (same as Experiment #4),
  enforced on the join.
- **Output table:** `trainSweep` (one row per candidate weight × {trainMeanBrier,
  isCandidateChosen}) + `holdout` (chosenWeight, holdoutN, holdoutAccuracyPct, holdoutBrier,
  meaningfulness).
- **Validation metrics:** Brier (selection criterion), accuracy + Brier (holdout report).
- **Leakage protections:** weight selection never sees holdout data; temporal join-admissibility
  identical to Experiment #4.
- **Exclusions:** not backfill/no backfill_match_id; not graded; joined row not
  graded/includedInAccuracy; joined temporal leakage.
- **n-floor:** 50 per half (train selection is skipped entirely — `chosenWeight: null` — below
  this floor, never guessed on too little data); ≥50% admissible fraction on the holdout half.

## Experiment #7 — Closeness calibration controlling for market

**Script:** `exp7ClosenessControlledForMarket.ts`

- **Required fields:** a pre-reconstructed export of graded, `source='backfill'`
  `parlay_leg_outcomes` rows joined to `evaluation_predictions` (same join as Experiment #6) PLUS
  reconstructed `computePlayerStats`-derived closeness inputs (`sel_win_rate`, `opp_win_rate`,
  `sel_win_rate_confidence`, `opp_win_rate_confidence`, `surface`, `sel_surface_total`,
  `opp_surface_total`, `sel_surface_win_rate`, `opp_surface_win_rate`, `sel_rank`, `opp_rank`).
  `parlay_leg_outcomes` does not persist these — the export step (not implemented here) would run
  `computePlayerStats` (safely exported from `builderScoringService.ts`) against
  `historical_matches` as of each leg's date.
- **Calculation:** `computeClosenessComponents` (mirror) run twice per row — once with
  `marketOdds` set (selected-player-relative decimal odds from the join) and once with it
  `null` — producing `withMarket`/`withoutMarket` closeness scores and per-signal breakdowns.
  Rows bucketed into `low_lt50` / `moderate_50to79` / `high_ge80` bands for each variant.
- **Temporal cutoff:** same join-based `oddsFetchedAt <= cutoffAt` check as Experiment #6.
- **Output table:** `with_market_component` vs `without_market_component` × 3 closeness bands ×
  {n, winRatePct, meaningfulness}.
- **Validation metrics:** win rate per band, compared across the two variants — the gap in
  band-to-win-rate structure between variants is the signal of how much Closeness's apparent
  effect is redundant with market.
- **Leakage protections:** same as Experiment #6; the upstream PlayerStats reconstruction's own
  point-in-time correctness is assumed by construction and explicitly flagged as out of this
  script's own verification scope (see script header).
- **Exclusions:** same as Experiment #6.
- **n-floor:** 50 per band; ≥50% admissible fraction.

---

## What actually ran in this environment

- `sharedValidation.test.ts` (10 tests) and `experimentProvenance.test.ts` (8 tests) — pure logic,
  no production imports — **ran with `tsx --test` and passed** (18/18).
- `productionFormulaMirror.test.ts` and every `exp*.test.ts` — **could not run**. They import
  `productionFormulaMirror.ts`, which imports the real `builderScoringService.ts`, which imports
  `@workspace/db` (a workspace package requiring `pnpm install`, explicitly not run per the task
  brief to avoid disk/time cost in this large monorepo). The failure is
  `ERR_MODULE_NOT_FOUND: Cannot find package '@workspace/db'` at import time — an environment
  limitation, not a defect in the mirrored logic. The hand-derived expected values in
  `productionFormulaMirror.test.ts` were computed by reading the real formulas directly (see that
  file's header), not by running anything.
