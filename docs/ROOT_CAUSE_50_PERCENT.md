# Full Root-Cause Investigation — Prediction Engines Collapsing to ~50%

> **Status (2026-09-16, P1 Package 4):** the prediction ensemble itself (module weighting,
> ensemble math, calibration, Monte Carlo) lives in the `tennis-stats-engine` repo, not here. A
> read-only investigation covering the mandate below plus a separate ensemble-influence/
> double-counting audit has been completed there:
> `docs/ensemble-influence-and-50-percent-root-cause-report.md` on branch
> `claude/ensemble-influence-50-percent-69x585` in `ShreddedBear/Tennis-Stats-Engine`. No weights
> or code were changed by that report. This file's spec below is retained as the original task
> definition; see the linked report for findings.

## Primary objective
Find the first point where meaningful player-vs-player information is lost and explain why final prediction probabilities are clustering around 50%. This is forensic debugging, not a request to force probabilities higher.

## Do not
- Assume the cause.
- Immediately tune calibration.
- Add arbitrary probability boosts.
- Hard-code probabilities.
- Use market odds or market sentiment.
- Declare success without runtime evidence and regression tests.

## Investigate
1. Trace 20+ real predictions end-to-end: input → player identity/IDs → historical data → surface → Elo → serve/return → recent form → H2H/other modules → feature construction → normalization → weighting → ensemble → Monte Carlo → calibration → persistence → API/UI.
2. For each sample record player IDs, surface, data quality, every module output, raw ensemble, pre/post calibration, Monte Carlo, final probability, winner, confidence, upset risk, and model agreement.
3. Audit null/undefined/NaN/Infinity/zero/default/fallback features, failed joins, empty histories, date filters, surface/tour mismatches, and player-name resolution.
4. Audit Elo, including surface Elo, historical cutoff, chronological ordering, opponent Elo, missing-opponent fallback, and whether both players become identical/default values.
5. Audit Serve/Return and Recent Form to prove real differentiated values reach the engine.
6. Audit ensemble math for zero weights, sign errors, cancellation, discarded player differences, destructive normalization, identical inputs, and global neutral fallback. Search the entire repo for equivalent 0.5/50% fallback logic.
7. Audit calibration separately: raw probability → calibration input → calibrated output. Check constant inputs, rounding, wrong model/version, double calibration, excessive shrinkage, and decimal/percentage errors. Do not modify until proven causal.
8. Audit Monte Carlo to verify differentiated inputs are preserved.
9. Trace backend/API/database/UI for rounding, serialization, caching, stale prediction reuse, duplicate records, active-summary/version issues, and overwrites.
10. Compare every prediction engine independently on the same 20+ matches.
11. Audit Data Quality gates for neutral fallback behavior and find why data is missing rather than merely lowering thresholds.
12. Audit correlated-module protection to ensure it has not zeroed/neutralized legitimate signal.
13. Use git history to find the last known-good state and bisect the regression where practical.

## Required root-cause report BEFORE production changes
- Root cause
- Evidence from real predictions/runtime
- Exact files, functions, and lines
- Current vs expected behavior
- Before/after pipeline values
- Failure category: data, logic, calibration, Monte Carlo, database, or UI
- Regression commit if identifiable
- Confidence in finding
- Recommended fix

## Required regression test
Create a test that reproduces the collapse and fails before the fix. It must test actual data-flow/math, not simply assert that output is not 0.5. Verify differentiated inputs produce differentiated predictions, player-swap symmetry, preservation of signal through missing-data fallbacks, calibration, Monte Carlo, and persistence.

## Fix
After documenting the root cause and adding the reproducing test, implement the smallest correct fix if safe and consistent with the intended methodology. Run relevant tests and report exact files changed, corrected behavior, test results, and before/after sample predictions.

**Goal: correct signal → correct probability. Genuine near-50/50 matches must remain near 50%.**