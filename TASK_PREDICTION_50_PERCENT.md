# Prediction Engines Collapsing to ~50% — Full Root-Cause Investigation

Investigate why prediction engines are producing final win probabilities clustered around 50% across many matches. Do not treat this as a calibration-tuning task.

## Requirements

- Trace the complete pipeline from match input through player identity, IDs, historical data, surface, Elo, serve/return, recent form, H2H, feature construction, normalization, ensemble, Monte Carlo, calibration, persistence, API, and UI.
- Find the **first point where meaningful player-vs-player signal is lost**.
- Trace at least 20 real recent predictions across supported tours/surfaces and capture all module outputs, raw ensemble probability, pre/post-calibration probability, Monte Carlo probability, final persisted probability, data quality, confidence, upset risk, and model agreement.
- Audit null, undefined, NaN, Infinity, zero, default, fallback, failed joins, empty histories, date filters, surface/tour mismatches, and player-ID resolution.
- Audit Elo and determine whether players are receiving identical/default values.
- Audit Serve/Return and Recent Form to prove actual differentiated values are reaching the model.
- Audit ensemble weights, signs, normalization, cancellation, and every neutral/0.5 fallback. Search the entire repo for logic equivalent to `return 0.5`, `probability = 0.5`, `fallback = 0.5`, or global shrinkage toward 0.5.
- Audit calibration separately. Determine whether the raw model is already ~50% or calibration is causing the collapse. Do not modify calibration until proven causal.
- Audit Monte Carlo to ensure differentiated inputs are preserved.
- Trace backend/API/database/UI to rule out rounding, serialization, stale-cache/record reuse, duplicate records, active-summary issues, or frontend-only display errors.
- Compare every prediction engine on the same 20+ matches.
- Audit Data Quality gates and correlated-module protection for accidental neutralization of signal.
- Use git history to identify the last known-good state and, where practical, bisect the regression.

## Root-cause report required before production changes

Provide:
1. Root cause
2. Evidence from real predictions/runtime
3. Exact affected files
4. Exact functions
5. Exact lines
6. Current vs expected behavior
7. Before/after pipeline values
8. Failure category (data/logic/calibration/Monte Carlo/database/UI)
9. Regression commit if identifiable
10. Confidence in finding
11. Recommended fix

## Regression test

Create a test that reproduces the collapse and fails before the fix. It must test actual data-flow/math, not merely `probability !== 0.5`. Verify differentiated inputs produce differentiated predictions, player-swap symmetry, preservation of signal under missing-data fallbacks, calibration preservation, Monte Carlo preservation, and persistence preservation.

## Implementation

After documenting the root cause and adding the reproducing test, implement the smallest correct fix if safe and consistent with the intended model methodology. Run relevant tests and report exact files changed, corrected behavior, test results, and before/after sample predictions.

**No market odds or market sentiment may be introduced. Do not force probabilities away from 50% when the underlying data genuinely supports a near-50/50 result.**