# Newly-Green Metric Coverage Audit

This audit verifies the source-family and execution coverage for the newly-green metric set.

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

## Completed BSD POINT_BY_POINT coverage

The PBP-dependent newly-green metrics are now allowed to consume POINT_BY_POINT evidence under the existing source-family policy:

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

Certified BSD lanes:

- ATP Main — confirmed 2024 → current; runtime adapter `src/lib/bsd-atp-main-pbp.server.ts`; fail-closed ATP Main firewall; duplicate match-ID protection.
- WTA Main — confirmed 2024-12-02 → current; runtime adapter `src/lib/bsd-wta-main-pbp.server.ts`; WTA Main-only firewall.
- ATP Challenger — confirmed 2025 → current; runtime adapter `src/lib/bsd-atp-challenger-pbp.server.ts`; ATP Challenger-only firewall.
- WTA Challenger / WTA 125 — confirmed 2025 → current; approved metrics namespace `data/metrics/pbp/wta_challenger/approved-index.jsonl`; final approved population 1,646; 154 structurally invalid/incomplete records remain excluded; 0 retry/unresolved records after the quarantine re-audit.

The warehouse runtime currently merges the ATP Main, ATP Challenger, and WTA Main BSD PBP adapters into the metric observation packet before live fallback. WTA Challenger/WTA 125 is certified through its isolated approved metrics namespace and quarantine audit artifacts. The coverage audit does not weaken tour firewalls or reintroduce rejected WTA Challenger records.

## Guardrails verified

- Metrics 062 and 069 accept only RANKING observations. ATP/WTA/Challenger match results or schedules cannot satisfy them.
- PBP evidence can only be consumed by metrics whose policy explicitly permits POINT_BY_POINT.
- Intentional multi-family metrics remain limited to their designed families: 043/044 = MARKET + POINT_BY_POINT, 060 = ENVIRONMENT + POINT_BY_POINT, 071 = RESULTS_SCHEDULE + ENVIRONMENT.
- WTA Challenger/WTA 125 rejected records remain excluded unless a future independent/fixed PBP source justifies revalidation.

The CI test in `src/lib/newly-green-end-to-end-coverage-audit.test.ts` fails if source-family expectations drift, a non-PBP deterministic calculator is no longer executed before live fallback, a certified BSD runtime adapter disappears, or the WTA Challenger approved population/quarantine result changes unexpectedly.
