# 81-Metric Recoverability Audit

## ⚠️ Catalog-integrity correction (2026-08-29) — read before using this document

Cross-checking every row's **Metric** column against the actual numbered
sections in `public/seed/metrics.txt` (the authoritative catalog; see
`metric-classification.ts`'s own header comment on the parser collision
this stems from) found that **68 of the 81 rows below named the wrong
metric** for their code number -- not a handful of drifted codes, but most
of the table. Examples: row 004 said "Break-Point Performance" (real 004 is
"Combined Efficiency"); row 016 said "Serve +1 Effectiveness" (real 016 is
"Point-by-Point & Score-State Metrics", the code `pbp-score-state-recovery.ts`
already wires PBP evidence into); row 069 said "Dominance Ratio" (real 069
is "Stakes/Career Context"). This is the same class of code/name mismatch
this project already found and fixed piecemeal for 036/040/069/079/060 (see
`newly-green-end-to-end-coverage-audit.test.ts`'s reconciliation comment and
`docs/evidence-work-blockers.md` item 4) -- this pass found it is the norm
for this document, not the exception.

**What changed this pass:** every row's Metric name is corrected against
`public/seed/metrics.txt`. For the 13 codes that already have a dedicated,
evidence-verified `docs/metric-audit-0XX-*.md` (001, 002, 003, 007, 008,
009, 010, 011, 012, 013, 019 -- note 004-006 do **not** have one, despite
the old table implying otherwise), that doc's real classification is used
here instead of the old mismatched-code entry. **The other 68 rows are
marked `UNVERIFIED`, not reclassified by guesswork** -- their old
classification and evidence-basis text described a different metric
entirely and is not trustworthy evidence for the metric actually at that
code number. The Classification totals, Evidence inventory, and coverage
percentages below are updated to reflect this: they no longer claim
precision this document cannot currently support.

**What this means for the recovery queue:** `RECOVERY_PRIORITY_CODES` and
any Phase 2 wiring plan built from the old totals here needs to be
re-derived once the UNVERIFIED rows get their own per-metric audits (same
five-step pattern as the 13 already-verified docs). Treat the "55/81
potentially usable" and "47 metric equivalents" figures from the prior
version of this document as **retracted**, not as a still-usable estimate
-- they were computed against wrong metric names for most of the table.

## Scope and accounting

This audit treats the repository and production database as one evidence universe. It does **not** equate `metric_evidence_store` with total evidence. The inventory includes the four-tour repository history, production ranking/schedule/result observations, approved BSD point-by-point assets, event/surface context, persisted evidence, and confirmed market persistence.

324 metric-tour coverage cells (4 representative tours × 81 metrics) is still the right denominator once the catalog is correct. The prior 12.04%/39-cell baseline, the 227-cell/70% threshold, and the 47-metric-equivalent estimate were all computed against a table where most rows named the wrong metric -- they are retracted pending re-derivation from the corrected classifications below, not restated here as if still valid.

A metric is never credited merely because a source family exists. DIRECT, RECONSTRUCTED, or PARTIAL treatment still requires legitimate raw evidence for both player sides in the particular tour/match cell. One-sided evidence remains unavailable.

The production persistence tables do not currently retain a 324-cell per-metric diagnostic snapshot. Live row counts by metric/tour also require a Supabase connection this environment cannot reach directly (see `docs/evidence-work-blockers.md` item 1) -- pending that verification (routed per this project's standing workflow), this document records classification and evidence-basis only, not live cell counts.

## Evidence inventory used

- ATP historical results: **79,002 rows** indexed.
- WTA historical results: **60,638 rows** indexed.
- ATP Challenger history: **32,866 matches** indexed.
- WTA Challenger/WTA 125 history: **7,615 validated matches** indexed.
- ATP rankings: production `ranking_atp` observations.
- WTA rankings: production `ranking_wta` observations; WTA 125 uses the WTA ranking circuit.
- ATP/WTA schedules and result observations in production.
- Approved BSD PBP adapters for ATP Main, WTA Main, ATP Challenger, and WTA Challenger/WTA 125.
- No broad raw `odds_api` MARKET observation set was confirmed in the production inventory; market claims are therefore kept partial/unavailable rather than inferred.
- The "persisted evidence confirmed for codes 001, 005, 007, 014, 020, 021, 043, 044, 058" claim in the prior version of this document is retracted along with the rest of the mismatched table -- several of those code numbers refer to different metrics under the corrected catalog (e.g. real 020 is "Level/Tour Transition", not what the prior claim likely meant), so the claim cannot be carried forward without re-verification.

## Classification totals (corrected catalog, this pass)

**Note (2026-08-29):** this branch was merged with a parallel, independently-
verified "New Signal Batch 1" workstream that had been developed directly
on `main` (`docs/audit-task-new-batch1-*.md`, `src/lib/audit-metric-0XX-*.ts`)
without this branch's knowledge until the merge. That workstream already
used the correct catalog names throughout (it cites `public/seed/metrics.txt`
directly in its own docs) and independently completed codes 027, 029, 031,
036, 037, 039, 041, 046, and 051. Their classification here is carried over
from that workstream's own findings, not independently re-verified line-by-
line by this document's author — see each linked `docs/audit-task-new-batch1-*.md`
for the primary source. #062 was evaluated by that workstream and found
BLOCKED (skipped, still UNVERIFIED here pending its own dedicated row note).

- **PARTIAL, verified via a dedicated per-metric audit (either workstream):** 45 metrics (001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 016, 018, 021, 023, 024, 025, 027, 028, 029, 030, 031, 032, 033, 035, 036, 037, 039, 041, 042, 046, 051, 053, 055, 060, 064, 068, 071, 075, 077, 080) — 018's RECONSTRUCTED→PARTIAL over-claim was corrected this pass (see `docs/metric-audit-batch-005-016-018-020-032-068.md`)
- **AI-DEPENDENT (correctly-targeted live-research pathway exists, no deterministic engine, not evaluable statically):** 10 metrics (026, 034, 038, 040, 043, 044, 045, 052, 062, 070) — see `docs/metric-audit-batch-023-to-077.md`
- **SOURCE REQUIRED, false credit removed this pass:** 1 metric (020 — a wrong-grain proxy and an unrelated mislabeled computation were both removed from all 4 files that wired them; no deterministic evidence remains. Fourth confirmed instance of the item-4 pattern. See `docs/metric-audit-batch-005-016-018-020-032-068.md`.)
- **TRULY UNAVAILABLE, verified via dedicated per-metric audit:** 2 metrics (019, 022 — 022 also newly added to metric-classification.ts's PROTECTED_UNAVAILABLE registry, so it is now permanently excluded from the true 59-code denominator, not just labeled unavailable in this table)
- **UNVERIFIED (name corrected, classification pending re-audit):** 23 metrics — all now `META_OR_NON_PLAYER`/`PROTECTED_UNAVAILABLE`/`UNKNOWN_REQUIRES_REVIEW` codes already correctly and definitively classified in `metric-classification.ts`; **every code in the true 59-code denominator has now been examined at least once**
- Total: 81

**Denominator correction (2026-08-29 reconciliation audit):** this 81-wide
table double-counts against the true player-evidence denominator. Per
`src/lib/metric-classification.ts::metricUniverseAccounting()` (the
canonical, tested registry, reconciled at Task 20/21, independent of this
document), 7 of the 81 codes are `META_OR_NON_PLAYER` (properties of the
model's own prediction, not a player fact) and 15 are `PROTECTED_UNAVAILABLE`
(real player metrics with a documented, tested determination that no
obtainable evidence pathway exists — code 022 added to this bucket
2026-08-29 during its own audit; see `docs/metric-audit-021-022-surface-environment-and-shot-level.md`)
— neither bucket is ever counted toward
player-evidence coverage in the live diagnostic. **The true legitimate
player-metric denominator is 59, not 81**, and the metric-tour denominator
is 236 (59×4), not 324. Of the remaining UNVERIFIED rows below, several
fall inside the 22 excluded codes and do not need a `docs/metric-audit-0XX.md`
pass at all — they are already correctly, definitively classified in
`metric-classification.ts` with detailed per-code reasoning and tests. See
`docs/evidence-work-blockers.md` item 0 for the full reconciliation and the
corrected 236-cell/166-cell(70%) math. This row-by-row table is not being
restructured to remove those 22 rows in this pass to avoid renumbering
churn; treat the totals above as a superset that still includes them.

Do not compute a coverage percentage, "potentially usable" count, or four-tour-equivalent figure from this table until the UNVERIFIED rows are resolved -- 60/81 rows have no trustworthy classification right now, and reporting a percentage over them would be exactly the "green workflow without database confirmation" this project's own validation rule (`docs/historical-hard-pull-source-inventory.md`) forbids. Two of the 20 verified PARTIAL rows (027, 029, 046) are further capped at 2-of-4 tours (WTA_MAIN/ATP_CHALLENGER only) by a structural schema gap, not sparse data — their "Potential four-tour contribution" column is halved accordingly rather than claimed at the full 1.234568pp.

## 81-row recovery map

| # | Metric | Classification | Raw evidence required / evidence basis | Potential four-tour contribution |
|---:|---|---|---|---:|
| 001 | Surface Strength | PARTIAL | Chronological four-tour Elo replay covers Surface Elo + Elo Win Probability + a rough sample count; 5 of 8 named submetrics (Effective Weighted Sample, Trend/Momentum, Peak-vs-Current, both Hard-Court Record bullets) remain SOURCE REQUIRED. See docs/metric-audit-001-surface-strength.md. | 1.234568 pp max |
| 002 | Serve Profile | PARTIAL | Approved PBP gives server/point/ace-DF/hold% components; serve-number detail is incomplete. See docs/metric-audit-002-003-serve-return-hold-break.md. | 1.234568 pp max |
| 003 | Return Profile | PARTIAL | Approved PBP gives return-point/break% components; serve-number detail is incomplete. See docs/metric-audit-002-003-serve-return-hold-break.md. | 1.234568 pp max |
| 004 | Combined Efficiency | PARTIAL | DataHub-sourced serve/return rates combine into Dominance Ratio, Total Points Won %, Matchup-Specific Expected Hold/Break %, and Expected Hold/Break Differential (5 of 6 named submetrics); Opponent-Adjusted Dominance Ratio needs a schedule-wide opponent-strength weighting scheme not yet built. See docs/metric-audit-004-combined-efficiency.md. | 1.234568 pp max |
| 005 | Recent Form | PARTIAL | predixsport-recent.server.ts + historical-results-recovery.ts both target this code; Last 5/10 Match Performance, Trend Direction, Recent-Performance Acceleration, Average Games/Sets Conceded, Straight-Set Control Rate directly computed (6-7/8 named bullets). Quality of Last 3-5 Performances not covered. | 1.234568 pp max |
| 006 | Opponent Quality | PARTIAL | Derived-Elo strength-of-schedule proxy, Bad-Loss Rate, Performance Against Comparable-Ranked Players, and Ranking-Adjusted Performance all covered (4 of 5 named submetrics); Performance Against Specific Archetypes needs a playing-style classification not present anywhere. See docs/metric-audit-006-opponent-quality.md. | 1.234568 pp max |
| 007 | Common-Opponent Network | PARTIAL | Canonical common-opponent match history supports a real subset; remaining named components are SOURCE REQUIRED. See docs/metric-audit-007-common-opponent.md. | 1.234568 pp max |
| 008 | Set Profile | PARTIAL | Historical set-score history supports a real subset of named components; remainder SOURCE REQUIRED. See docs/metric-audit-008-set-profile.md. | 1.234568 pp max |
| 009 | Comeback/Pressure Behavior | PARTIAL | Set-1-deficit comeback + tiebreak record (DataHub) plus break-point/deuce/tiebreak pressure-point evidence (approved BSD PBP, confirmed this pass) cover a real subset; Break-Consolidation Rate and Serving-for-Set/Match Conversion remain SOURCE REQUIRED for this code. See docs/metric-audit-009-comeback-pressure.md. | 1.234568 pp max |
| 010 | Straight-Set / 2–0 Metrics | PARTIAL | Historical scorelines support a real subset; remainder SOURCE REQUIRED. See docs/metric-audit-010-straight-set.md. | 1.234568 pp max |
| 011 | Volatility/Floor | PARTIAL | Set/game score distributions support a real subset; remainder SOURCE REQUIRED. See docs/metric-audit-011-volatility-floor.md. | 1.234568 pp max |
| 012 | Fatigue/Workload | PARTIAL | Matches/sets/games/rest reconstructable; several named components remain SOURCE REQUIRED (wiring verified honest, no fabricated evidence found). See docs/metric-audit-012-fatigue-workload.md and docs/metric-audit-012-fatigue-workload-schedule-engine.md. | 1.234568 pp max |
| 013 | Availability | PARTIAL | A real subset of named components is reconstructable from existing schedule/result history; remainder SOURCE REQUIRED. See docs/metric-audit-013-availability.md. | 1.234568 pp max |
| 014 | Ranking Context | PARTIAL | Official ranking snapshots cover Current Ranking, Ranking Trajectory, and (added this pass) a documented Rapid Riser/Faller threshold; downgraded from a false DIRECT (only 1 of 4 named bullets was a raw published value). Ranking-Performance Disconnect needs a performance baseline (e.g. derived Elo) not cross-referenced. See docs/metric-audit-014-ranking-context.md. | 1.234568 pp max |
| 015 | Market Layer | PARTIAL | A real, live, production odds feed (The Odds API) already covers Sportsbook Moneyline Consensus, No-Vig Implied Probability, and Market Movement/Opening-vs-Closing (3 of 7 named bullets); downgraded from a false RECONSTRUCTED. Multiple-Book Comparison, Model-vs-Market Divergence, and Prediction-Market Consensus remain SOURCE REQUIRED. See docs/metric-audit-015-market-layer.md. | 1.234568 pp max |
| 016 | Point-by-Point & Score-State Metrics | PARTIAL | pbp-score-state-recovery.ts covers 6 of 8 named score-state bullets (0-30 through Break Point; Set/Match Point untagged) plus a point-win-streak figure. Shot-level bullets (serve direction, return positioning, rally length, winner/UE differential) correctly stay uncovered. | 1.234568 pp max |
| 017 | Shot & Rally Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-017-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 018 | Momentum & Closing Metrics | PARTIAL | pbp-score-state-recovery.ts covers Closing Ability well; Performance Following Momentum Events only partially (breakback only, not the tiebreak-momentum half); Opponent Comeback Susceptibility not covered. Downgraded from a false RECONSTRUCTED this pass, same house-rule fix already applied to 001/014/015. See docs/metric-audit-batch-005-016-018-020-032-068.md. | 1.234568 pp max |
| 019 | Market Calibration | TRULY UNAVAILABLE | No genuine historical price-bucket-vs-outcome join exists on any path; live scoring bug (false RECONSTRUCTED) already fixed. See docs/metric-audit-019-market-calibration.md. | 0 |
| 020 | Level/Tour Transition | SOURCE REQUIRED | A wrong-grain proxy (same_level_matches/win_pct: aggregate performance at a level, not at the transition between levels) and an unrelated mislabeled 90-day quality-band computation were both removed this pass from all 4 files that wired them -- neither answered any of 020's 3 real bullets. Fourth confirmed instance of the item-4 pattern (021/060/071). No deterministic evidence remains; genuinely needs a transition-specific engine built. | 0 (evidence removed, not yet rebuilt) |
| 021 | Surface & Environmental Context | PARTIAL (thin) | The only wired engine (deterministic-environment-metrics.server.ts) reports shared, non-player-specific ambient weather at the match venue -- real evidence for none of 021's 15 named bullets on its own (Weather/Altitude Sensitivity need historical performance correlated with conditions, not a single current reading). Policy already marks RESULTS_SCHEDULE, not ENVIRONMENT, as the *sufficient* family for 021, but no RESULTS_SCHEDULE-based engine for 021 exists. Not changed this pass (shared engine code, same class of issue already open at evidence-work-blockers.md item 4 for code 060). See docs/metric-audit-021-022-surface-environment-and-shot-level.md. | 1.234568 pp max, currently unrealized |
| 022 | Serve/Return Shot-Level Efficiency | TRULY UNAVAILABLE | Added to metric-classification.ts's PROTECTED_UNAVAILABLE set this pass. Every one of this code's ~26 named bullets needs charted shot-level outcome/direction/depth/rally-state data; approved PBP is point/score-state only (same missing-data class as codes 017/054/074). No deterministic engine exists anywhere in this repository; a registered metric-certification.ts policy already correctly required this same shot-level data and was never satisfiable. See docs/metric-audit-021-022-surface-environment-and-shot-level.md. | 0 |
| 023 | Matchup-Adjusted Metrics | PARTIAL | style-matchup.server.ts covers Serve-vs-Return and Return-vs-Serve Compatibility Score (2/10 named bullets) via transparent numeric proxies; the rest need shot-level/style-cluster data. | 0.493827 pp (2/10 bullets, single potential contribution) |
| 024 | Hidden Performance Quality | PARTIAL | Generic warehouse-PBP credit only (deliberately loose, tested design); none of the 12 named bullets (Score-Adjusted Point Dominance, Expected vs Actual Hold/Break/Tiebreak/Deciding-Set, etc.) are computed by name. | 1.234568 pp max |
| 025 | Match Deterioration Metrics | PARTIAL | Same generic warehouse-PBP mechanism as 024; none of the 12 set-by-set decay bullets computed by name. | 1.234568 pp max |
| 026 | Early-Warning / Slow-Start Metrics | AI-DEPENDENT | No deterministic engine; validated-completion-research.server.ts's COMPOSITE_COMPONENTS correctly targets all 12 real bullets for live AI web-search research, firewalled against generic proxies. Not evaluable statically. | TBD (live-dependent) |
| 027 | Opponent Finishing Ability | PARTIAL | Lead-protection rate and closing-rate-as-underdog computed from trailing-window set scores; structurally GO only on WTA_MAIN/ATP_CHALLENGER (ATP_MAIN/WTA_CHALLENGER lack per-set score sequence, a schema gap not sparse data). See docs/audit-task-new-batch1-027-029-finishing-and-psych-response.md. | 0.617284 pp max (2/4 tours) |
| 028 | Scheduling/Context | PARTIAL | deterministic-results-schedule-metrics.server.ts genuinely computes Days Since Last Competitive Match and Matches Over Previous 30 Days (2-3/14 named bullets). | 1.234568 pp max |
| 029 | Psychological/Behavioral Proxies | PARTIAL | Post-close-set-loss performance proxy from trailing-window results; same WTA_MAIN/ATP_CHALLENGER-only lane restriction as #027. See docs/audit-task-new-batch1-027-029-finishing-and-psych-response.md. | 0.617284 pp max (2/4 tours) |
| 030 | Tournament-Specific Strength | PARTIAL | Same schedule engine: same_tournament_matches/wins over 5 years, a real exact-tournament historical record. | 1.234568 pp max |
| 031 | Extended Opponent-Network Metrics | PARTIAL | Common-opponent point differential, adjusted for opponent strength via derived Elo (rank is 0% populated on ATP_MAIN/WTA_CHALLENGER, so Elo substitutes uniformly across all four lanes). GO across all four tours per docs/audit-task-new-batch1-031-041-network-differential-and-hidden-improvement.md. | 1.234568 pp max |
| 032 | Point-to-Game Conversion Efficiency | PARTIAL | pbp-score-state-recovery.ts covers only 1 of this composite metric's 10 named sub-components (break opportunities per successful break), already self-documented in-code as such. | 1.234568 pp max |
| 033 | Break Quality Differential | PARTIAL | Single named bullet (Sustainable Break Score); generic PBP warehouse credit plus a correctly-targeted AI-research fallback. | 1.234568 pp max |
| 034 | Scoreline Deception Index | AI-DEPENDENT | No deterministic engine; COMPOSITE_COMPONENTS correctly targets all 5 real bullets for live AI research. Not evaluable statically. | TBD (live-dependent) |
| 035 | False-Form Detector | PARTIAL | Single named bullet (Observed vs Expected W/L); observed_vs_expected_wl_gap_pct in ranking-performance.server.ts is an exact, direct formula match, not a proxy -- strongest single-bullet match found in the 023-077 batch. | 1.234568 pp max |
| 036 | Loss Autopsy Metrics | PARTIAL | Live server-side computation (audit-metric-036-037-039-live.server.ts) with leakage guard; DB-population size pending GitHub issue #82's Copilot read-only query per docs/audit-task-new-batch1-step0.md. See docs/audit-task-new-batch1-036-037-039-loss-win-autopsy.md. | 1.234568 pp max |
| 037 | Win Autopsy Metrics | PARTIAL | Live server-side computation, same file/leakage guard as #036. See docs/audit-task-new-batch1-036-037-039-loss-win-autopsy.md. | 1.234568 pp max |
| 038 | Opponent-Adjusted Residual Performance | AI-DEPENDENT | No deterministic engine; COMPOSITE_COMPONENTS correctly targets all 8 real bullets for live AI research. Not evaluable statically. | TBD (live-dependent) |
| 039 | Performance Surprise Rating | PARTIAL | Live server-side computation, same file/leakage guard as #036/#037. See docs/audit-task-new-batch1-036-037-039-loss-win-autopsy.md. | 1.234568 pp max |
| 040 | Hidden Decline Detector | AI-DEPENDENT | No deterministic engine; COMPOSITE_COMPONENTS correctly targets all 10 real trend bullets for live AI research. Not evaluable statically. | TBD (live-dependent) |
| 041 | Hidden Improvement Detector | PARTIAL | Chronological opponent-quality-adjusted win/loss trend via derived Elo, GO across all four lanes for the same reason as #031 (same Elo-substitution finding). See docs/audit-task-new-batch1-031-041-network-differential-and-hidden-improvement.md. | 1.234568 pp max |
| 042 | Opponent Win Pathways | PARTIAL | opponent-win-pathways-meta.server.ts is a dedicated pathway classifier explicitly scoped to this code's real 9 named pathways -- best-covered code in the 023-077 batch. | 1.234568 pp max |
| 043 | Favorite Failure-Mode Score | AI-DEPENDENT | Real cross-wiring bug fixed this pass: was wrongly claimed by deterministic-market-metrics.server.ts (raw odds data, unrelated to the real definition); now correctly falls through to protected-metric-wiring.server.ts's AI-research-gated pathway, which already targets both real bullets. Not evaluable statically. See docs/metric-audit-batch-023-to-077.md. | TBD (live-dependent) |
| 044 | Opponent Upset Compatibility | AI-DEPENDENT | Same cross-wiring fix as 043; now correctly falls through to protected-metric-wiring.server.ts's AI-research-gated pathway, which targets all 9 named similarity dimensions. Not evaluable statically. See docs/metric-audit-batch-023-to-077.md. | TBD (live-dependent) |
| 045 | Favorite Fragility Under Resistance | AI-DEPENDENT | No deterministic engine; PROTECTED_COMPONENTS correctly targets all 6 real bullets for live AI research. Not evaluable statically. | TBD (live-dependent) |
| 046 | Match-State Elo | PARTIAL | Restricted to WTA_MAIN/ATP_CHALLENGER per lane-eligibility check. See docs/audit-task-new-batch1-046-match-state-elo.md. | 0.617284 pp max (2/4 tours) |
| 047 | Uncertainty-Adjusted Advantage | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-047-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 048 | Independent-Evidence Count | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-048-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 049 | Data Contamination / Circularity Score | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-049-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 050 | Robustness Tests | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-050-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 051 | Opponent-Specific Set/Match Probabilities | PARTIAL | GO across all four lanes using shrunk H2H-derived outcome with rank/Elo fallback dependency. See docs/audit-task-new-batch1-051-opponent-specific-probability.md. | 1.234568 pp max |
| 052 | Entropy & Lead Durability | AI-DEPENDENT | No deterministic engine; COMPOSITE_COMPONENTS correctly targets all 8 real bullets for live AI research. Not evaluable statically. | TBD (live-dependent) |
| 053 | Pressure & Clean-Game Metrics | PARTIAL | pbp-score-state-recovery.ts deterministically covers only "pressure accumulation score" (1/6 named bullets) from real PBP replay; the other 5 are firewalled behind a correctly-targeted AI-research fallback. | 1.234568 pp max |
| 054 | Additional Shot-Level Efficiency | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-054-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 055 | Trajectory / Rolling Metrics | PARTIAL | Rolling 5/10-Match Elo Change and Performance Acceleration are directly computed (3+/13 named bullets), not proxies. | 1.234568 pp max |
| 056 | Data-Integrity Layer | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-056-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 057 | Evidence Freshness & Confirmation | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-057-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 058 | Stress Tests & Scenario Analysis | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-058-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 059 | Loss Path Probability | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-059-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 060 | Interaction / Matchup Residuals | PARTIAL (thin) | Same pattern as evidence-work-blockers.md item 4: the only deterministic credit comes from the shared ENVIRONMENT-only engine, whose ambient-weather output touches none of 060's real 11 bullets. protected-metric-wiring.server.ts's AI-research firewall does correctly target all 11 real bullets. Not fixed this pass (shared four-code engine). | 1.234568 pp max, currently unrealized |
| 061 | Final Advanced Tests | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-061-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 062 | Motivation / Stakes | AI-DEPENDENT | No deterministic engine; protected-metric-wiring.server.ts explicitly forbids generic serve/return/weather/travel/odds/Elo/form substitution. Not evaluable statically. | TBD (live-dependent) |
| 063 | Team / Support Context | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-063-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 064 | Draw Context | PARTIAL | Qualifying-match count reasonably covers Qualifying/Lucky-Loser Fatigue (1/2 named bullets); Draw Path Difficulty needs bracket data not present anywhere. | 0.617284 pp (1/2 bullets) |
| 065 | Physical/Medical (Limited Availability) | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-065-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 066 | Equipment / Technical | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-066-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 067 | On-Court Behavior / Discipline | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-067-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 068 | Streaks / Milestones | PARTIAL | historical-results-recovery.ts's Task 18A engine covers Current Win/Loss Streak Length, Longest Win Streak This Season, and Tournament Debut Status (3/4 named bullets); Protected-Ranking Status correctly stays uncovered. | 1.234568 pp max |
| 069 | Stakes / Career Context | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-069-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 070 | Support Team / Prep | AI-DEPENDENT | No deterministic engine; protected-metric-wiring.server.ts explicitly forbids RECONSTRUCTED treatment for this code (DIRECT public reporting only). Effectively as-good-as SOURCE REQUIRED absent live confirmed reporting. | TBD (live-dependent) |
| 071 | Session / Environment | PARTIAL (thin) | Same item-4 pattern as 060: neither the ENVIRONMENT engine (ambient weather) nor the schedule engine (generic match-count/date fields) touches Roof-Open-vs-Closed Split or Start-Time Uncertainty, 060/071's only 2 real bullets. Strongest concrete instance of the item-4 mismatch found. Not fixed this pass. | 1.234568 pp max, currently unrealized |
| 072 | Matchup Nuance | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-072-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 073 | Sentiment / Integrity | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-073-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 074 | Biomechanics / Physical Detail | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-074-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 075 | Match Format / Rules Context | PARTIAL (thin) | deterministic-rules-context-metric.server.ts reports the raw best-of format from match context, a real input toward Best-of-3-vs-5 Adjustment (~1/3 named bullets) but not the adjustment itself; Deciding-Set Tiebreak Format and Challenge/Review Count are not tracked. | 1.234568 pp max |
| 076 | Scheduling Micro-Context | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-076-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 077 | Season-Long Fatigue Context | PARTIAL | tennis-data-extended.server.ts's computeOffseasonRestLengthDays is a real, deliberately-corrected engine for Off-Season Rest Length (1/4 named bullets); Olympic/Team-Event Year Load, Preseason Exhibition Results, and Grand Slam Hangover Effect remain SOURCE REQUIRED. | 1.234568 pp max |
| 078 | Sponsorship / Off-Court Pressure | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-078-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 079 | Additional Differentiating Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-079-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 080 | Common-Opponent & Opponent-Caliber Metrics | PARTIAL | Common-Opponent Divergent Outcome covered via historical-results-recovery.ts (Task 18A, previously undocumented); Opponent-Caliber Performance Gap needs per-player historical rank/Elo-at-match-time not carried by this row type. A real cross-wiring bug (080 falsely inheriting codes 006/007's keys) was found and fixed this pass. See docs/metric-audit-080-common-opponent-caliber.md. | 1.234568 pp max |
| 081 | Further Differentiating Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-081-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |


## Recovery order

The committed `RECOVERY_PRIORITY_CODES` was built against the old, mismatched-code table and needs re-derivation once enough UNVERIFIED rows above get their own `docs/metric-audit-0XX-*.md` pass -- a priority order over wrong metric names is not a valid priority order. Until then, treat only the 13 already-verified codes (001, 002, 003, 007, 008, 009, 010, 011, 012, 013, 019, plus whichever of 004-081 gets audited next) as safe to reason about for Phase 2 wiring decisions.

## False-green firewall

The false-green firewall principle is unchanged: a raw PBP row cannot satisfy shot placement, rally length, serve number, UE/winner, or net-approach metrics merely because it is point-by-point, and historical results cannot fabricate injury, weather, altitude, handedness, or market data. PARTIAL is allowed only when the available raw evidence genuinely addresses a defined component of the metric for both players. Which specific codes are TRULY_UNAVAILABLE under the *corrected* catalog is itself one of the things the 68 UNVERIFIED rows above need to establish -- the old "26 TRULY UNAVAILABLE" count was computed against the wrong metric names and is not restated here as still valid.
