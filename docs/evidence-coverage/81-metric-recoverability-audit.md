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

- **PARTIAL, verified via a dedicated per-metric audit (either workstream):** 20 metrics (001, 002, 003, 004, 007, 008, 009, 010, 011, 012, 013, 027, 029, 031, 036, 037, 039, 041, 046, 051)
- **TRULY UNAVAILABLE, verified via dedicated per-metric audit:** 1 metric (019)
- **UNVERIFIED (name corrected, classification pending re-audit):** 60 metrics
- Total: 81

Do not compute a coverage percentage, "potentially usable" count, or four-tour-equivalent figure from this table until the UNVERIFIED rows are resolved -- 60/81 rows have no trustworthy classification right now, and reporting a percentage over them would be exactly the "green workflow without database confirmation" this project's own validation rule (`docs/historical-hard-pull-source-inventory.md`) forbids. Two of the 20 verified PARTIAL rows (027, 029, 046) are further capped at 2-of-4 tours (WTA_MAIN/ATP_CHALLENGER only) by a structural schema gap, not sparse data — their "Potential four-tour contribution" column is halved accordingly rather than claimed at the full 1.234568pp.

## 81-row recovery map

| # | Metric | Classification | Raw evidence required / evidence basis | Potential four-tour contribution |
|---:|---|---|---|---:|
| 001 | Surface Strength | PARTIAL | Chronological four-tour Elo replay covers Surface Elo + Elo Win Probability + a rough sample count; 5 of 8 named submetrics (Effective Weighted Sample, Trend/Momentum, Peak-vs-Current, both Hard-Court Record bullets) remain SOURCE REQUIRED. See docs/metric-audit-001-surface-strength.md. | 1.234568 pp max |
| 002 | Serve Profile | PARTIAL | Approved PBP gives server/point/ace-DF/hold% components; serve-number detail is incomplete. See docs/metric-audit-002-003-serve-return-hold-break.md. | 1.234568 pp max |
| 003 | Return Profile | PARTIAL | Approved PBP gives return-point/break% components; serve-number detail is incomplete. See docs/metric-audit-002-003-serve-return-hold-break.md. | 1.234568 pp max |
| 004 | Combined Efficiency | PARTIAL | DataHub-sourced serve/return rates combine into Dominance Ratio, Total Points Won %, Matchup-Specific Expected Hold/Break %, and Expected Hold/Break Differential (5 of 6 named submetrics); Opponent-Adjusted Dominance Ratio needs a schedule-wide opponent-strength weighting scheme not yet built. See docs/metric-audit-004-combined-efficiency.md. | 1.234568 pp max |
| 005 | Recent Form | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-005-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 006 | Opponent Quality | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-006-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 007 | Common-Opponent Network | PARTIAL | Canonical common-opponent match history supports a real subset; remaining named components are SOURCE REQUIRED. See docs/metric-audit-007-common-opponent.md. | 1.234568 pp max |
| 008 | Set Profile | PARTIAL | Historical set-score history supports a real subset of named components; remainder SOURCE REQUIRED. See docs/metric-audit-008-set-profile.md. | 1.234568 pp max |
| 009 | Comeback/Pressure Behavior | PARTIAL | Set-1-deficit comeback + tiebreak record (DataHub) plus break-point/deuce/tiebreak pressure-point evidence (approved BSD PBP, confirmed this pass) cover a real subset; Break-Consolidation Rate and Serving-for-Set/Match Conversion remain SOURCE REQUIRED for this code. See docs/metric-audit-009-comeback-pressure.md. | 1.234568 pp max |
| 010 | Straight-Set / 2–0 Metrics | PARTIAL | Historical scorelines support a real subset; remainder SOURCE REQUIRED. See docs/metric-audit-010-straight-set.md. | 1.234568 pp max |
| 011 | Volatility/Floor | PARTIAL | Set/game score distributions support a real subset; remainder SOURCE REQUIRED. See docs/metric-audit-011-volatility-floor.md. | 1.234568 pp max |
| 012 | Fatigue/Workload | PARTIAL | Matches/sets/games/rest reconstructable; several named components remain SOURCE REQUIRED (wiring verified honest, no fabricated evidence found). See docs/metric-audit-012-fatigue-workload.md and docs/metric-audit-012-fatigue-workload-schedule-engine.md. | 1.234568 pp max |
| 013 | Availability | PARTIAL | A real subset of named components is reconstructable from existing schedule/result history; remainder SOURCE REQUIRED. See docs/metric-audit-013-availability.md. | 1.234568 pp max |
| 014 | Ranking Context | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-014-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 015 | Market Layer | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-015-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 016 | Point-by-Point & Score-State Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-016-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 017 | Shot & Rally Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-017-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 018 | Momentum & Closing Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-018-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 019 | Market Calibration | TRULY UNAVAILABLE | No genuine historical price-bucket-vs-outcome join exists on any path; live scoring bug (false RECONSTRUCTED) already fixed. See docs/metric-audit-019-market-calibration.md. | 0 |
| 020 | Level/Tour Transition | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-020-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 021 | Surface & Environmental Context | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-021-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 022 | Serve/Return Shot-Level Efficiency | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-022-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 023 | Matchup-Adjusted Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-023-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 024 | Hidden Performance Quality | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-024-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 025 | Match Deterioration Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-025-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 026 | Early-Warning / Slow-Start Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-026-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 027 | Opponent Finishing Ability | PARTIAL | Lead-protection rate and closing-rate-as-underdog computed from trailing-window set scores; structurally GO only on WTA_MAIN/ATP_CHALLENGER (ATP_MAIN/WTA_CHALLENGER lack per-set score sequence, a schema gap not sparse data). See docs/audit-task-new-batch1-027-029-finishing-and-psych-response.md. | 0.617284 pp max (2/4 tours) |
| 028 | Scheduling/Context | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-028-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 029 | Psychological/Behavioral Proxies | PARTIAL | Post-close-set-loss performance proxy from trailing-window results; same WTA_MAIN/ATP_CHALLENGER-only lane restriction as #027. See docs/audit-task-new-batch1-027-029-finishing-and-psych-response.md. | 0.617284 pp max (2/4 tours) |
| 030 | Tournament-Specific Strength | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-030-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 031 | Extended Opponent-Network Metrics | PARTIAL | Common-opponent point differential, adjusted for opponent strength via derived Elo (rank is 0% populated on ATP_MAIN/WTA_CHALLENGER, so Elo substitutes uniformly across all four lanes). GO across all four tours per docs/audit-task-new-batch1-031-041-network-differential-and-hidden-improvement.md. | 1.234568 pp max |
| 032 | Point-to-Game Conversion Efficiency | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-032-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 033 | Break Quality Differential | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-033-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 034 | Scoreline Deception Index | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-034-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 035 | False-Form Detector | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-035-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 036 | Loss Autopsy Metrics | PARTIAL | Live server-side computation (audit-metric-036-037-039-live.server.ts) with leakage guard; DB-population size pending GitHub issue #82's Copilot read-only query per docs/audit-task-new-batch1-step0.md. See docs/audit-task-new-batch1-036-037-039-loss-win-autopsy.md. | 1.234568 pp max |
| 037 | Win Autopsy Metrics | PARTIAL | Live server-side computation, same file/leakage guard as #036. See docs/audit-task-new-batch1-036-037-039-loss-win-autopsy.md. | 1.234568 pp max |
| 038 | Opponent-Adjusted Residual Performance | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-038-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 039 | Performance Surprise Rating | PARTIAL | Live server-side computation, same file/leakage guard as #036/#037. See docs/audit-task-new-batch1-036-037-039-loss-win-autopsy.md. | 1.234568 pp max |
| 040 | Hidden Decline Detector | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-040-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 041 | Hidden Improvement Detector | PARTIAL | Chronological opponent-quality-adjusted win/loss trend via derived Elo, GO across all four lanes for the same reason as #031 (same Elo-substitution finding). See docs/audit-task-new-batch1-031-041-network-differential-and-hidden-improvement.md. | 1.234568 pp max |
| 042 | Opponent Win Pathways | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-042-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 043 | Favorite Failure-Mode Score | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-043-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 044 | Opponent Upset Compatibility | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-044-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 045 | Favorite Fragility Under Resistance | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-045-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 046 | Match-State Elo | PARTIAL | Restricted to WTA_MAIN/ATP_CHALLENGER per lane-eligibility check. See docs/audit-task-new-batch1-046-match-state-elo.md. | 0.617284 pp max (2/4 tours) |
| 047 | Uncertainty-Adjusted Advantage | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-047-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 048 | Independent-Evidence Count | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-048-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 049 | Data Contamination / Circularity Score | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-049-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 050 | Robustness Tests | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-050-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 051 | Opponent-Specific Set/Match Probabilities | PARTIAL | GO across all four lanes using shrunk H2H-derived outcome with rank/Elo fallback dependency. See docs/audit-task-new-batch1-051-opponent-specific-probability.md. | 1.234568 pp max |
| 052 | Entropy & Lead Durability | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-052-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 053 | Pressure & Clean-Game Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-053-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 054 | Additional Shot-Level Efficiency | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-054-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 055 | Trajectory / Rolling Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-055-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 056 | Data-Integrity Layer | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-056-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 057 | Evidence Freshness & Confirmation | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-057-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 058 | Stress Tests & Scenario Analysis | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-058-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 059 | Loss Path Probability | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-059-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 060 | Interaction / Matchup Residuals | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-060-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 061 | Final Advanced Tests | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-061-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 062 | Motivation / Stakes | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-062-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 063 | Team / Support Context | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-063-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 064 | Draw Context | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-064-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 065 | Physical/Medical (Limited Availability) | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-065-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 066 | Equipment / Technical | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-066-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 067 | On-Court Behavior / Discipline | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-067-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 068 | Streaks / Milestones | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-068-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 069 | Stakes / Career Context | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-069-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 070 | Support Team / Prep | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-070-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 071 | Session / Environment | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-071-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 072 | Matchup Nuance | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-072-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 073 | Sentiment / Integrity | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-073-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 074 | Biomechanics / Physical Detail | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-074-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 075 | Match Format / Rules Context | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-075-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 076 | Scheduling Micro-Context | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-076-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 077 | Season-Long Fatigue Context | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-077-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 078 | Sponsorship / Off-Court Pressure | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-078-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 079 | Additional Differentiating Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-079-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 080 | Common-Opponent & Opponent-Caliber Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-080-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |
| 081 | Further Differentiating Metrics | UNVERIFIED | Name corrected against public/seed/metrics.txt this pass; classification/evidence-basis inherited from this table's prior (mismatched-code) entry is UNRELIABLE and not carried forward. Needs its own docs/metric-audit-081-*.md pass before being trusted for recovery-queue or coverage-count decisions. | TBD |


## Recovery order

The committed `RECOVERY_PRIORITY_CODES` was built against the old, mismatched-code table and needs re-derivation once enough UNVERIFIED rows above get their own `docs/metric-audit-0XX-*.md` pass -- a priority order over wrong metric names is not a valid priority order. Until then, treat only the 13 already-verified codes (001, 002, 003, 007, 008, 009, 010, 011, 012, 013, 019, plus whichever of 004-081 gets audited next) as safe to reason about for Phase 2 wiring decisions.

## False-green firewall

The false-green firewall principle is unchanged: a raw PBP row cannot satisfy shot placement, rally length, serve number, UE/winner, or net-approach metrics merely because it is point-by-point, and historical results cannot fabricate injury, weather, altitude, handedness, or market data. PARTIAL is allowed only when the available raw evidence genuinely addresses a defined component of the metric for both players. Which specific codes are TRULY_UNAVAILABLE under the *corrected* catalog is itself one of the things the 68 UNVERIFIED rows above need to establish -- the old "26 TRULY UNAVAILABLE" count was computed against the wrong metric names and is not restated here as still valid.
