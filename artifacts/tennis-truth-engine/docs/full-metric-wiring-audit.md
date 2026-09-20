# Full Metric and Supabase Wiring Audit

Audit date: 2026-08-29  
Supabase project: `qyovnrkiknsiqjybxubf`  
Policy: preserve the canonical 81-code universe, 60 player-evidence denominator, 7 process/meta exclusions, 14 protected-unavailable metrics, and 2 review-required metrics.

## Executive result

- **FIXED:** audit-run creation now seeds all 81 rows with the canonical classification instead of silently putting excluded/protected codes back into `NOT STARTED`.
- **FIXED:** calibration output is null-safe and tied to the calibration version stored on the audit run. Final decisions now store the version, bucket sample, verified rate, and ranges in their immutable gate report.
- **FIXED:** board and dashboard use only the highest `run_number` for each match. Historical reruns no longer duplicate board rows or distort incomplete/color totals.
- **FIXED:** client mutation and seed paths now surface Supabase errors instead of presenting failed writes as saved.
- **FIXED:** local historical evidence no longer claims that static source data was retrieved at request time.
- **FIXED:** one-sided cached/live/deterministic metric findings are merged by player side; a valid P1 result can no longer suppress a separately valid P2 result.
- **BROKEN HISTORICAL DATA:** the live snapshot contained 324 metric rows (4 runs × 81), but no metric code had values for both players. Seventeen codes had partial values, five had reconstructed values, and all populated values were on P1. Existing rows were not rewritten or fabricated.
- **INCOMPLETE OUTPUT CHAIN:** live counts were 0 `audit_coverage`, 0 `metric_coverage_rates`, 0 `final_decisions`, 0 `calibration_ledger`, and 0 reconstruction-result rows. The application must rerun affected matches to create new evidence-backed outputs.
- **VERIFIED SCHEMA INTEGRITY:** 81 distinct metric codes, no duplicate `(audit_run_id, metric_code)` rows, no duplicate final-decision rows, one active calibration version, eight calibration buckets.

## End-to-end contract

1. Canonical definitions come from active `rules`/`rule_documents`; classification is enforced by `metric-classification.ts`.
2. Evidence enters through `source_observations`, repository history, local historical data, rankings, market, environment, point-by-point, and rules/context adapters.
3. `metric-source-family-policy.ts` prevents a source family from satisfying an unrelated metric.
4. The warehouse-first researcher resolves both player orientations and returns per-side findings.
5. The pipeline persists one `metric_results` row per code and side-specific values/treatments, then derives `audit_coverage` and `metric_coverage_rates`.
6. `audit-engine.ts` computes the gate. Classification—not mutable treatment text—controls the 60-metric denominator.
7. `final_decisions` is the persisted gate truth; `audit_runs.status` is execution lifecycle only.
8. Board/dashboard select the latest run per match and display that run’s persisted decision.

Family abbreviations below: **R** results/schedule, **K** ranking, **M** market, **E** environment, **P** point-by-point, **C** rules/context. “Partial” means a real pathway exists but does not prove the complete named metric.

## Canonical 60-metric denominator

| Code | Metric | Allowed family | Audit status | Evidence-backed finding |
|---|---|---:|---|---|
| 001 | Surface Strength | R,K,E,P | VERIFIED / LIVE BROKEN | Deterministic history/ranking/environment/PBP paths exist; live rows were P1-only. |
| 002 | Serve Profile | R,P | VERIFIED / LIVE BROKEN | PBP/results path exists; live rows were not symmetric. |
| 003 | Return Profile | R,P | VERIFIED / LIVE BROKEN | PBP/results path exists; live rows were not symmetric. |
| 004 | Combined Efficiency | — | INCOMPLETE | No honest family-specific calculator. |
| 005 | Recent Form | R | VERIFIED / LIVE BROKEN | Strict pre-match historical-results path exists; live rows were P1-only. |
| 006 | Opponent Quality | — | INCOMPLETE | No sufficient source-family contract. |
| 007 | Common-Opponent Network | R | VERIFIED / LIVE BROKEN | Deterministic common-opponent path exists; live rows were P1-only. |
| 008 | Set Profile | R,P | VERIFIED / LIVE BROKEN | Historical/PBP path exists; live rows were P1-only. |
| 009 | Comeback/Pressure Behavior | R,P | VERIFIED / LIVE BROKEN | PBP path exists; live rows were not symmetric. |
| 010 | Straight-Set / 2–0 Metrics | R,P | VERIFIED / LIVE BROKEN | Historical/PBP path exists; live rows were P1-only. |
| 011 | Volatility/Floor | R,P | VERIFIED / LIVE BROKEN | Historical/PBP path exists; live rows were not symmetric. |
| 012 | Fatigue/Workload | R | INCOMPLETE | Schedule/history provides support, not the full named workload model. |
| 013 | Availability | R,K | VERIFIED / LIVE BROKEN | History/ranking path exists; live rows were not symmetric. |
| 014 | Ranking Context | K | VERIFIED / LIVE BROKEN | Direct ranking calculator exists; current rows were not symmetric. |
| 015 | Market Layer | M | VERIFIED | Market is an allowed sufficient family; no live symmetric output was present. |
| 016 | Point-by-Point & Score-State Metrics | P | VERIFIED | Dedicated PBP path exists; no live symmetric output was present. |
| 018 | Momentum & Closing Metrics | R,P | VERIFIED | PBP/history path exists; no live symmetric output was present. |
| 019 | Market Calibration | M | VERIFIED | Market is an allowed sufficient family; no live symmetric output was present. |
| 020 | Level/Tour Transition | R,K,C | VERIFIED / PARTIAL | Deterministic history/ranking/rules paths exist. |
| 021 | Surface & Environmental Context | R; E support | VERIFIED / PARTIAL | Results can satisfy; environment alone can only support. |
| 022 | Serve/Return Shot-Level Efficiency | R,P | INCOMPLETE | Score-state PBP does not prove shot-level semantics. |
| 023 | Matchup-Adjusted Metrics | R,K | INCOMPLETE | No complete metric-specific calculator. |
| 024 | Hidden Performance Quality | R,P | INCOMPLETE | Generic evidence cannot prove the named hidden-quality construct. |
| 025 | Match Deterioration Metrics | R,P | INCOMPLETE / PARTIAL | Generic PBP output is intentionally capped at partial. |
| 026 | Early-Warning / Slow-Start Metrics | R | INCOMPLETE | Required first-N-games replay is not implemented. |
| 027 | Opponent Finishing Ability | R | INCOMPLETE | No complete metric-specific calculator. |
| 028 | Scheduling/Context | — | INCOMPLETE | No sufficient family contract. |
| 029 | Psychological/Behavioral Proxies | — | INCOMPLETE | No legitimate source family currently proves this metric. |
| 030 | Tournament-Specific Strength | R,E | VERIFIED / PARTIAL | Results and environment paths exist. |
| 031 | Extended Opponent-Network Metrics | R,P | INCOMPLETE | Available evidence covers only a subset. |
| 032 | Point-to-Game Conversion Efficiency | P | VERIFIED | Dedicated PBP score-state mapping exists. |
| 033 | Break Quality Differential | P | INCOMPLETE / REQUIRES REVIEW | Prior duplicate mapping was removed; complete semantics remain unresolved. |
| 034 | Scoreline Deception Index | R,P | VERIFIED / PARTIAL | Real history/PBP support exists but may not satisfy every component. |
| 035 | False-Form Detector | — | INCOMPLETE | No sufficient source-family contract. |
| 036 | Loss Autopsy Metrics | R | VERIFIED / PARTIAL | Historical-results path exists. |
| 037 | Win Autopsy Metrics | P | INCOMPLETE | Previous PBP mapping was retargeted; no complete current path. |
| 038 | Opponent-Adjusted Residual Performance | R,K | INCOMPLETE | No complete residual model. |
| 039 | Performance Surprise Rating | R,K | INCOMPLETE | Requires a valid pre-match expectation baseline. |
| 040 | Hidden Decline Detector | — | INCOMPLETE | Required trend evidence is unavailable. |
| 041 | Hidden Improvement Detector | R,P | VERIFIED | Dedicated calculator and wiring tests exist. |
| 042 | Opponent Win Pathways | P | INCOMPLETE | No complete metric-specific calculator. |
| 043 | Favorite Failure-Mode Score | M,P | VERIFIED / PARTIAL | Market/PBP paths support only evidenced components. |
| 044 | Opponent Upset Compatibility | M,P | VERIFIED / PARTIAL | Market/PBP paths support only evidenced components. |
| 045 | Favorite Fragility Under Resistance | R,P | VERIFIED / PARTIAL | Results/PBP support exists. |
| 046 | Match-State Elo | R,P | VERIFIED | Dedicated match-state Elo path exists. |
| 047 | Uncertainty-Adjusted Advantage | K,M | REQUIRES REVIEW | Canonical review-required metric; remains in denominator and unavailable until resolved. |
| 051 | Opponent-Specific Set/Match Probabilities | R,P | VERIFIED | Dedicated probability calculator exists. |
| 052 | Entropy & Lead Durability | R,P | INCOMPLETE / PARTIAL | Available evidence covers only part of the definition. |
| 053 | Pressure & Clean-Game Metrics | R,P | INCOMPLETE / PARTIAL | Available evidence covers only part of the definition. |
| 055 | Trajectory / Rolling Metrics | R,K | INCOMPLETE | No complete rolling model. |
| 060 | Data-Integrity Layer | E,P | INCOMPLETE | Legitimate player-level code, but no complete independent calculator. |
| 061 | Final Advanced Tests | R support | REQUIRES REVIEW | Mixed meta/player definition; remains in denominator pending review. |
| 062 | Motivation / Stakes | K | INCOMPLETE | Ranking context can support a subset only. |
| 064 | Draw Context | R,C | INCOMPLETE | No complete metric-specific calculator. |
| 068 | Streaks / Milestones | R,K | VERIFIED | Deterministic history/ranking path exists. |
| 070 | Support Team / Prep | — | INCOMPLETE | No legitimate current source family. |
| 071 | Session / Environment | R,E,P | VERIFIED / PARTIAL | Environment/results/PBP support exists. |
| 075 | Match Format / Rules Context | E,C | INCOMPLETE / PARTIAL | Rules calculator exists, but the full evidence contract is incomplete. |
| 077 | Season-Long Fatigue Context | — | INCOMPLETE | Off-season rest is reconstructable; the broader named metric is not. |
| 080 | Common-Opponent & Opponent-Caliber Metrics | R,K | VERIFIED | Deterministic historical/ranking path exists. |

## Metrics excluded from the denominator

### META_OR_NON_PLAYER — 7

These remain `EXCLUDED` and must never re-enter coverage through downstream treatment changes:

- 048 Independent-Evidence Count
- 049 Data Contamination / Circularity Score
- 050 Robustness Tests
- 056 Data-Integrity Layer
- 057 Evidence Freshness & Confirmation
- 058 Stress Tests & Scenario Analysis
- 059 Loss Path Probability

### PROTECTED_UNAVAILABLE — 14

These remain `NO_SOURCE` with schema-safe `UNAVAILABLE` treatment. They must not be reconstructed or defaulted:

- 017 Shot & Rally Metrics
- 054 Additional Shot-Level Efficiency
- 063 Team / Support Context
- 065 Physical/Medical (Limited Availability)
- 066 Equipment / Technical
- 067 On-Court Behavior / Discipline
- 069 Stakes / Career Context
- 072 Matchup Nuance
- 073 Sentiment / Integrity
- 074 Biomechanics / Physical Detail
- 076 Scheduling Micro-Context
- 078 Sponsorship / Off-Court Pressure
- 079 Additional Differentiating Metrics
- 081 Further Differentiating Metrics

## Repairs and regression coverage

- `calibration-snapshot.test.ts`: version/sample snapshot and null-range semantics.
- `audit-runs.test.ts`: 60/7/14 classification is preserved in the alternate creation path.
- `current-audit-state.test.ts`: historical runs cannot count as the current board/dashboard decision.
- `warehouse-first-researcher.test.ts`: independently valid P1/P2 evidence is merged without orientation reversal.
- Existing classification, source-family, pipeline, firewall, chronology, repository-history, and calibration-autofill tests remain passing.

## Required operational follow-through

1. Rerun each affected match. Historical one-sided `metric_results` are evidence records and were not silently rewritten.
2. Confirm new runs produce non-null P1 and P2 values only where each side has evidence.
3. Confirm final-gate execution creates `audit_coverage`, `metric_coverage_rates`, and `final_decisions`.
4. Metrics marked incomplete or review-required must remain unavailable until a real, tested source/calculation pathway exists.