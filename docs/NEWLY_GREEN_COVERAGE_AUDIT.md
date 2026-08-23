# Newly-Green Metric Coverage Audit

This audit verifies the source-family and deterministic execution coverage for the newly-green metric set.

## Non-PBP deterministic paths present

- 012 Fatigue / Workload — RESULTS_SCHEDULE
- 015 Market Layer — MARKET
- 019 Market Calibration — MARKET
- 021 Surface & Environmental Context — ENVIRONMENT
- 028 Scheduling Context — RESULTS_SCHEDULE
- 030 Tournament-Specific Strength — RESULTS_SCHEDULE + ENVIRONMENT support
- 062 Motivation / Stakes objective components — RANKING only
- 064 Draw Context — RESULTS_SCHEDULE
- 069 Stakes / Career Context objective components — RANKING only
- 071 Session / Environment — RESULTS_SCHEDULE + ENVIRONMENT
- 075 Match Format / Rules Context — RULES_CONTEXT only
- 076 Scheduling Micro-Context — RESULTS_SCHEDULE
- 077 Season-Long Fatigue Context — RESULTS_SCHEDULE
- 081 Further Differentiating Metrics supported components — RESULTS_SCHEDULE

## PBP-dependent group

These remain dependent on the separate point-by-point implementation. Existing non-PBP support is retained where applicable, but completion must not be fabricated without PBP evidence.

- 024 Hidden Performance Quality
- 025 Match Deterioration Metrics
- 033 Break Quality Differential
- 036 Loss Autopsy Metrics
- 040 Hidden Decline Detector
- 042 Opponent Win Pathways
- 043 Favorite Failure-Mode Score — MARKET + POINT_BY_POINT
- 044 Opponent Upset Compatibility — MARKET + POINT_BY_POINT
- 060 Interaction / Matchup Residuals — ENVIRONMENT + POINT_BY_POINT
- 079 Additional Differentiating Metrics — POINT_BY_POINT

## Guardrail verified

Metrics 062 and 069 accept only RANKING observations. ATP/WTA/Challenger match results or schedules cannot satisfy them.

The CI test in `src/lib/newly-green-end-to-end-coverage-audit.test.ts` fails if any expected source family changes, a non-PBP deterministic calculator is no longer executed before live fallback, or the PBP-dependent boundary changes unexpectedly.
