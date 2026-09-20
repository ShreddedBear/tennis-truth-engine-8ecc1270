# Full Root-Cause Investigation — Prediction Engines Collapsing to ~50%

## Objective

Investigate why the Tennis Matrix AI prediction engines are producing final win probabilities clustered at approximately 50% (or very close to it) across many matches.

This is a **full forensic debugging task, not a planning task and not a request to arbitrarily adjust probabilities**.

### Critical rules
- Do not assume the cause.
- Do not immediately change calibration.
- Do not add arbitrary probability boosts.
- Do not hard-code probabilities.
- Do not use market odds or market sentiment anywhere in prediction logic.
- Do not declare this fixed until the actual root cause is identified and demonstrated with repository/runtime evidence and tests.
- If a match genuinely is approximately 50/50 based on the available data, preserve that result.
- The goal is **correct signal → correct probability**, not forcing probabilities higher.

## Primary question

Why are predictions resolving like:

- Player A: ~50%
- Player B: ~50%

Trace the complete pipeline and find the **first point where meaningful player-vs-player signal is lost**:

`INPUT MATCH → player identity resolution → player IDs → historical data → surface → rankings/Elo → serve/return → recent form → H2H/other modules → feature construction → normalization → weighting → ensemble → Monte Carlo → calibration → final probability → persistence → UI/API`

## Investigation requirements

### 1. Trace at least 20 real recent predictions
Use a representative sample across ATP, WTA, Challenger, ITF if supported, surfaces, close matches, and matches with substantial historical data.

For every sampled match capture:
- player A/B and canonical IDs
- surface
- data quality
- Surface Elo A/B
- Serve rating A/B
- Return rating A/B
- Recent Form A/B
- H2H A/B
- other module outputs
- raw ensemble score
- pre-calibration probability
- calibrated probability
- Monte Carlo probability
- final probability
- predicted winner
- confidence
- upset risk
- model agreement

Determine whether the collapse occurs **before calibration, during calibration, during Monte Carlo, during persistence, or only in the UI**.

### 2. Audit missing/zero/default features
For every feature entering prediction, identify null, undefined, NaN, Infinity, zero-filled, default, fallback, failed join, empty history, date-filter failure, surface mismatch, tour mismatch, and silently substituted values.

Produce a feature health table:
`FEATURE | POPULATED % | NULL % | ZERO % | DEFAULT/FALLBACK % | SAMPLE VALUES`

### 3. Audit player identity resolution
Verify that each displayed player maps to the correct canonical player ID. Check name variants, whitespace, accents, initials, hyphens, duplicate records, ATP/WTA IDs, and failed historical joins. Prove that real historical statistics are retrieved rather than defaults.

### 4. Audit Elo
Check global/surface Elo, historical cutoff, chronological ordering, opponent Elo, missing-opponent behavior, fallbacks, and whether both players are accidentally assigned the same/default Elo. Report Elo A, Elo B, and Elo difference for the sampled predictions.

### 5. Audit Serve/Return
Verify that the engine receives actual differentiated values for hold %, break %, ace %, double-fault %, first serve %, first-serve points won, second-serve points won, return points won, break-point conversion, and opponent/surface adjustments where supported. Check whether both players receive identical or league-average fallback values.

### 6. Audit Recent Form
Verify actual recent matches, chronological window, surface filtering, opponent adjustment, wins/losses, sets/games, and performance metrics. Look for constant 0, 0.5, 50, league-average, undefined, or null outputs.

### 7. Audit ensemble math
Inspect the exact implementation. Determine whether weights are zero, weights are malformed, modules cancel, signs are reversed, player differences are discarded, normalization destroys signal, inputs are identical, or any failed module triggers a global 0.5 fallback.

Search the entire repository for neutral/fallback behavior equivalent to:
- `return 0.5`
- `probability = 0.5`
- `fallback = 0.5`
- neutral prediction logic
- clamps/shrinkage toward 0.5

### 8. Audit calibration separately
Trace `RAW MODEL PROBABILITY → CALIBRATION INPUT → CALIBRATION OUTPUT`.

Check for wrong input, constant input, rounding, wrong model/version, double calibration, excessive shrinkage toward 50%, percentage-vs-decimal errors, and incorrect isotonic/logistic implementation.

**Do not modify calibration until proven to be the cause.**

### 9. Audit Monte Carlo
Verify that Monte Carlo receives differentiated player inputs rather than starting every simulation at 50/50. Check simulation count, random sampling, strength parameters, set/game simulation, aggregation, rounding, and persistence.

### 10. Audit database/API/UI
Trace frontend → API → prediction service → DB → response → UI. Determine whether backend values are differentiated but frontend displays 50%. Check decimal types, rounding, serialization, caching, stale prediction reuse, duplicate records, active summary versions, and overwriting by another engine.

### 11. Engine-by-engine comparison
Run the same 20+ matches through each prediction engine independently. Produce:
`MATCH | ENGINE | RAW OUTPUT | CALIBRATED OUTPUT | FINAL OUTPUT`

Determine whether all engines independently collapse, one engine contaminates the ensemble, calibration collapses the outputs, Monte Carlo collapses them, or only presentation does.

### 12. Data Quality gate
Determine whether Data Quality is forcing neutral predictions. Identify the threshold, actual values, missing-data causes, and fallback path. Do not simply lower the threshold; find why data is being marked missing.

### 13. Correlated-module protection
Audit the anti-double-counting implementation. Verify it has not accidentally zeroed legitimate modules, neutralized all contributions, divided weights incorrectly, normalized modules to zero, or applied a global correlation penalty.

### 14. Git regression analysis
Use git history to identify commits affecting prediction engine, ensemble, calibration, probability, Elo, serve/return, recent form, Monte Carlo, data quality, player resolution, and persistence.

Find the most recent known-good state where predictions were not clustered around 50%, compare it to current code, and use git bisect or equivalent where practical to identify the regression commit.

## Required root-cause report BEFORE production changes

Return:
1. ROOT CAUSE
2. EVIDENCE
3. EXACT AFFECTED FILE(S)
4. EXACT AFFECTED FUNCTION(S)
5. EXACT LINE(S)
6. WHAT CURRENT CODE DOES
7. WHAT IT SHOULD DO
8. BEFORE/AFTER PIPELINE VALUES
9. WHETHER FAILURE IS DATA, LOGIC, CALIBRATION, MONTE CARLO, DATABASE, OR UI
10. REGRESSION COMMIT, if identifiable
11. CONFIDENCE IN ROOT-CAUSE FINDING
12. RECOMMENDED FIX

## Required regression test

Before changing production behavior, create an automated test that reproduces the probability-collapse bug and fails under the broken behavior.

The test must verify actual mathematical/data-flow behavior, not merely `probability !== 0.5`.

It should cover:
- materially different inputs producing materially different raw predictions
- Player A/B symmetry when players are swapped
- missing-data fallbacks not erasing all signal
- calibration preserving meaningful differentiation
- Monte Carlo preserving meaningful probability differences
- persistence preserving the calculated probability

## Implementation

After documenting the root cause and adding the reproducing test, implement the smallest correct fix if it is safe and does not change the intended model methodology.

Then run the relevant tests and provide:
- exact files changed
- exact behavior corrected
- test results
- before/after sample predictions
- confirmation that no market odds/sentiment were introduced

## Most important requirement

**Find the first point in the pipeline where real player-vs-player information is being lost. Do not treat the 50% symptom. Find and fix the root cause.**
