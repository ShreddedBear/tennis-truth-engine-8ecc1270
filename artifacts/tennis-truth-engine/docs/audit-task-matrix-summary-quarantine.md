# Matrix Summary quarantine — 16 metrics withheld from the ACTIVE audit pipeline

**This is a quarantine, not a deletion.** Nothing was deleted, dropped, truncated,
rewritten or backfilled. Definitions, formulas, schemas, metric IDs/names, historical
`metric_results` rows and historical evidence rows are all preserved exactly as they
were. The only thing withdrawn is each code's *current* eligibility for active auditing.

## Why

The Truth Engine independently audits Tennis Matrix AI's predictions. It is **not**
Tennis Matrix AI, and it may only use evidence the Truth Engine itself actually
possesses. These 16 codes require real Tennis Matrix AI Summary evidence that has not
yet been uploaded into the Truth Engine. Until it is, they are held out of the active
pipeline so they cannot hold down, fail, block or invalidate an audit merely because
that evidence is absent.

`UNAVAILABLE` here means: *the Truth Engine does not currently possess the required
Tennis Matrix AI Summary evidence.* It does **not** mean failed, zero, incorrect,
retired, deleted, or permanently disabled.

## The 16 codes

015 Market Layer · 017 Shot & Rally Metrics · 019 Market Calibration ·
022 Serve/Return Shot-Level Efficiency · 024 Hidden Performance Quality ·
025 Match Deterioration Metrics · 026 Early-Warning / Slow-Start Metrics ·
033 Break Quality Differential · 035 False-Form Detector · 037 Win Autopsy Metrics ·
039 Performance Surprise Rating · 040 Hidden Decline Detector ·
042 Opponent Win Pathways · 060 Interaction / Matchup Residuals ·
070 Support Team / Prep · 075 Match Format / Rules Context

**15 of these** received a new `MATRIX_SUMMARY_REQUIRED` classification record.
**017 did not**: it already carried a `PROTECTED_UNAVAILABLE` record, which already
produces the identical required end state (NO_SOURCE row status, UNAVAILABLE treatment,
out of the active denominator, non-blocking, reversible). A code may hold only one
classification record, and moving 017 would have overwritten its existing documented
shot-tracking determination for no behavioural gain.

## Why a new bucket instead of reusing PROTECTED_UNAVAILABLE

The two statements are genuinely different and must stay separately auditable:

| | meaning | reversible? |
|---|---|---|
| `PROTECTED_UNAVAILABLE` | no legitimate obtainable or reconstructable evidence pathway exists anywhere in the approved evidence universe | no — a structural fact about the data |
| `MATRIX_SUMMARY_REQUIRED` | the required Matrix Summary evidence is not in the Truth Engine **yet** | yes — a current possession state |

Mechanically they share the **existing** unavailability architecture rather than
introducing a competing status system: both instantiate as row status `NO_SOURCE` with
`p1_treatment`/`p2_treatment` = `UNAVAILABLE`, both are subtracted from the coverage
denominator by metric-code identity, and neither is ever handed to a researcher. They
differ only in the recorded reason, so no report ever conflates them:

- `MATRIX_SUMMARY_EVIDENCE_REQUIRED` (quarantine)
- `NO_SOURCE_NO_LEGITIMATE_PATHWAY` (protected)

## Code paths changed

| File | Change |
|---|---|
| `src/lib/metric-classification.ts` | New `MATRIX_SUMMARY_REQUIRED` classification + 15 records; exported codes/records; subtracted from `playerEvidenceDenominatorCodes()`; new `playerMetricCodesIncludingQuarantined()`; accounting reports the bucket and the reactivated total; duplicate-record assertion added |
| `src/lib/audit-pipeline.ts` | `isNoSourceRuleCode()` covers the new classification; `instantiate()` records the distinct reason/detail; `metricRowsForSideExecution()` filters settled-unavailable codes **by code identity**, so even a run seeded before the quarantine never researches them |
| `src/lib/audit-engine.ts` | `isNoSourceMetricCode()` covers the new classification, so quarantined codes are subtracted from the coverage denominator and can never silently re-enter it |
| `src/lib/audit-runs.ts` | Alternate client seed path kept in lockstep: seeds `NO_SOURCE`/`UNAVAILABLE` with the distinct reason |
| `src/lib/evidence-availability-accounting.ts` | Reports the quarantine as its own availability class instead of scoring it as software loss or genuine source unavailability |
| `src/lib/evidence-coverage-runtime-diagnostic.server.ts` | Excludes quarantined codes from the sampled active-metric set (also keeps its count equal to the active denominator) |

**Database changes: none.** No migration, no DDL, no writes. Verified after the change:
24,624 `metric_results` rows, all 81 distinct metric codes, 211 rule definitions,
405 audit runs, 7,950 rows carrying values — all untouched.

## Metric 035 in particular

035 holds two genuine historical `metric_results` rows (PARTIAL treatment, real
PredixSport-sourced values, created 2026-08-30). They are preserved byte-for-byte and
were neither deleted nor rewritten. They are **historical evidence, not proof that 035
is currently active** — going forward 035 follows the same UNAVAILABLE rule as the rest
until valid Matrix Summary evidence exists.

## Effect on the denominator

- ACTIVE player-evidence denominator: **60 → 45**
- Reactivating all 15 restores it to **60** exactly (`legitimate_player_metric_count_including_quarantined`)
- META_OR_NON_PLAYER (7) and PROTECTED_UNAVAILABLE (14) buckets: **unchanged**
- Universe still accounts to 81: 45 + 15 + 7 + 14

## Reactivation is deliberately NOT automatic

Uploading a Matrix Summary does not by itself return a code to the active pipeline. The
intended path is:

> Matrix Summary uploaded → evidence extraction → field validation → metric eligibility
> check → required-input check → calculate → evidence/provenance → persist → audit
> performance evaluation → earned reactivation

i.e. `UNAVAILABLE → ELIGIBLE → TESTING → PROVEN/ACTIVE`. Removing a record from the
`MATRIX_SUMMARY` array in `metric-classification.ts` is the deliberate final step of
that path, never a side effect of a Summary merely existing. Removing a record restores
that code to the active denominator and the ordinary research path with no other change.

## Verification

`src/lib/matrix-summary-quarantine.test.ts` asserts the whole contract: all 16 recognised
unavailable and out of the active denominator; exactly the intended 15 quarantined with
017 left on its existing record; every other code 001-081 unchanged; definitions and
reversibility preserved; universe still 81; seeding produces NO_SOURCE/UNAVAILABLE with
the distinct reason and never a numeric zero; neither side ever researches a quarantined
code (including on legacy runs); quarantined codes count as done so they cannot block;
coverage stays 100% when the only active metric is covered; and effective independent
evidence count stays 0 so calibration never treats them as observed evidence.
