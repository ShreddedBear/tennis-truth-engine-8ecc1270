# Tennis Matrix AI — Market Integration + Metric Truth + Calibration Audit

Repo: `ShreddedBear/tennis-truth-engine-8ecc1270` · Branch: `claude/tennis-engine-audit-32-razn75` · Commit: `70d812d3e4ac00fa7cd52ff2e08e367a0810b3ea`

Status: **consolidation of two completed code-level audits** (Parlay Builder scoring audit; Market Odds dependency audit) into the 12-phase structure requested, plus an explicit accounting of what remains blocked. No formulas, thresholds, or market inputs were touched. Committed as an audit-only artifact to this branch — see "Where this lives" at the end.

Every finding below is classified **PROVEN** (verified against current source, or against a committed report confirmed consistent with current source), **LIKELY** (strong code-level evidence, not independently re-run), or **UNVERIFIED / BLOCKED** (required empirical evidence is unavailable — no numbers guessed). A read-only authorized-database inventory was completed on 2026-09-20; its results are recorded in §13.

---

## 1. Executive Summary

- **PROVEN** — "Overall Score" is not a score. It is `validationScore` rendered verbatim (`AdminParlayBuilder.tsx:857`). No separate overall-score computation exists anywhere in the stack.
- **PROVEN** — Removal, Grade, parlayGrade, and Decision are deterministic re-expressions of Validation + Risk (+ Coverage). They contribute zero independent information; the card presents one underlying signal as if it were five.
- **PROVEN** — Market odds reaches the final Decision through **3 uncoordinated additive channels** (a Validation factor, a Risk bonus/penalty, and Closeness→Risk-floor), all computed from the same un-devigged, single-sided `1/marketOdds` — the least rigorous of three separate odds-conversion implementations that coexist in this codebase.
- **LIKELY, NOT PROVEN** — No *obvious* temporal-leakage path was found at the schema level: `evaluation_predictions` stores odds as a one-time snapshot with no "current odds" column to substitute in later. This rules out the single most common leakage mechanism (a join to "latest odds"), but does **not** prove leakage is impossible — timestamped odds tables, provider snapshots, cached records, aggregated consensus fields under a different name, persisted API responses, or a reconstructed-historical-odds path could still leak information and were not individually tested against real historical timestamps. Corrected classification per user review: **"structurally no obvious leakage found," not "leakage proven impossible."**
- **LIKELY** — Market odds adds real, non-redundant predictive value to the Prediction Engine: a committed ablation report shows +3.45pp accuracy / −0.0519 log-loss with odds included (n=174, below the script's own n≥200 bar, activated via documented override). Not independently re-run.
- **PROVEN** — The market-consensus Validation weight (4%) and its agreement-vote weight (5.0) were never empirically validated — explicitly commented "0 live rows in backfill."
- **UNVERIFIED / BLOCKED (at time of writing)** — The four-arm ablation (Full / No-Market / Market-Only / Market+Independent), fresh Closeness/Risk/Removal/KEEP-BORDERLINE-REMOVE calibration tables on current code, and the market-shuffle placebo test all require live walk-forward queries against the production Postgres DB. This is the single largest gap in this audit and blocks Phases 3, 5 (quantitative part), and 8 (quantitative part) — to be closed by running the missing scripts inside the canonical Replit app's own authorized DB connection (see "Where this lives").
- **PROVEN** — Prediction Engine and Parlay Builder are architecturally independent: the Builder never calls the Prediction Engine and independently re-derives its own (cruder) market number from raw odds. This is intentional per the repo's own `.agents/memory/model-market-boundary.md`, not accidental duplication of the *prediction*, but it does mean the Builder's own market signal is uncoordinated with the Engine's more careful one.
- **PROVEN** — The one existing large backtest report (`backtestScoringDimensions_report.md`, self-dated 2026-08-01) is **stale**: its parlayGrade taxonomy (5 buckets) doesn't match current code (4 buckets), and the merge-justification numbers cited in code comments don't appear anywhere in that report — meaning current thresholds rest on an analysis that isn't in this repository at all.

---

## 2. Exact Formula Map

| Display field | Field | Formula | Independent? |
|---|---|---|---|
| Overall Score | `validationScore` | weighted avg of ~17 factor scores | Yes (base signal) |
| Validation | `validationScore` | same as above | Yes |
| Risk | `riskScore` | `max(ownAdditiveFormula, closenessRiskFloor(closenessScore))`, then thin-data floor | Partial — floored by Closeness |
| Removal | `removalProbability` | `clamp(round((100-validationScore)*0.55 + riskScore*0.45),0,100)` | **No** — pure function of Validation+Risk |
| Closeness | `matchupCloseness` | mean of 4 signals (win-rate gap, surface gap, market-implied-prob gap, ranking gap) | Yes |
| Coverage | `dataCoverage` | % of factors with real data | Yes |
| Agreement | `sourceAgreement` | edge-weighted factor-vote agreement | Yes (also feeds Validation as one factor) |
| Grade (A-F) | `reliabilityGrade` | static cutoffs on Validation, capped by Coverage | **No** |
| Elite/Solid/Weak/Reject | `parlayGrade` | `adj = Validation - Risk*0.35`, thresholded, gated by Grade | **No** |
| KEEP/BORDERLINE/REMOVE | `decision` | thresholds on Validation, Risk, Grade, Coverage, criticalFlags | **No** |
| *(hidden)* Calibrated probability | `builderCalibratedProbability` | isotonic regression of Validation vs. real outcomes | Yes — the only ground-truth-fit number, never shown |

Source: `artifacts/api-server/src/services/parlayBuilder/builderScoringService.ts` (line-level citations in the two prior audit files this report consolidates).

---

## 3. Market-Data Lineage (Phase 1)

```
Provider (odds API / historical tennis-data.co.uk)
        │
        ▼
raw decimal odds (p1, p2)
        │
   ┌────┴────────────────────────┬───────────────────────────┐
   ▼                              ▼                            ▼
impliedProbability.ts         predictionEngine/index.ts     builderScoringService.ts
(two-sided de-vig,            (independent two-sided        (single-sided 1/marketOdds,
 :11-23)                       de-vig + logit ×12,            NO de-vig — computed inline
                                :513-520)                      3 SEPARATE times: :1550,
                                                                :1777/:1799, :1851)
   │                              │                            │
   ▼                              ▼                            ▼
evaluation_predictions       Prediction Engine's own      1) "Market Consensus" Validation
.impliedProbability /        ensemble vote → engine's         factor (weight 0.040)
.marketEdge (analytics       calibratedProbability         2) Risk bonus/penalty (+18/-12)
only — never read back                                     3) Closeness signal → floors
into any scoring path)                                         Risk via closenessRiskFloor()
                                                                    │
                                                                    ▼
                                                            Removal (linear in Val+Risk)
                                                                    │
                                                                    ▼
                                                            Decision (KEEP/BORDERLINE/REMOVE)
```

**Every market-derived value's exact source, file, function, field** is documented with line numbers in the prior "Market Odds Audit" report (section A). Three distinct odds→probability implementations exist; only the Prediction Engine's and the analytics path's are de-vigged. The Parlay Builder — the system whose card is being audited — uses the crudest of the three, and uses it three times.

---

## 4. Temporal Leakage Audit (Phase 2)

**Corrected classification (per user review, superseding an earlier draft): "structurally no obvious leakage found," NOT "leakage proven impossible."** The evidence below rules out one specific, common mechanism in one table — it is not a full leakage audit and must not be read as one.

- `evaluation_predictions` schema (`lib/db/src/schema/evaluation.ts:106-232`) stores `cutoffAt`, `scheduledStartAt`, `lockedAt`, and an odds snapshot block (`oddsProvider`, `oddsPlayer1Decimal`, `oddsPlayer2Decimal`, `oddsFetchedAt`) explicitly documented as "captured at lock time, never backfilled or refreshed afterward." No "current odds" column exists *in this specific table* — this rules out the single most common leakage mechanism (a join to a "latest odds" column) *for this table only*, by construction.
- `auditHistoricalMarketOdds.ts:42-54` computes a calibration-fit boundary (`MAX(created_at)` from active calibration models) and only trusts rows after it as clean-for-evaluation — a real guard, but scoped to that one script's query, not a repo-wide guarantee.
- The Parlay Builder has its own separate live-match odds-freeze guard (`builderScoringService.ts:1054-1115`): once a match has started, live odds fetches are skipped entirely; only a caller-supplied frozen pre-match snapshot may be used.
- For historical/backtest rows, odds come from the dataset's own recorded closing/average price (`historicalMatches.raw_source._marketOdds`) rather than being re-fetched at analysis time — but "recorded closing price" deserves its own scrutiny: if a closing/settlement odds value is being used as a stand-in for a pre-match prediction timestamp, that is leakage under a different name, and this was **not tested**.

**What was NOT checked, and must be before Phase 2 can be considered closed:**
- Whether any *other* table — a raw odds/provider-snapshot table, a cached-odds table, an aggregated-consensus table under a different name — stores a mutable "current"/"latest" field that some query path joins against instead of the immutable snapshot.
- Whether `historicalMatches.raw_source._marketOdds` for each historical row is actually the pre-match price at the timestamp that row claims to represent, or a closing/settlement price mislabeled as "available at prediction time" — verifying this requires spot-checking real historical timestamps against real odds-fetch times, which needs data access, not just a schema read.
- Provider-aggregation/consensus logic (if multiple providers' odds are combined) was not traced for whether the combination itself mixes timestamps.

**No look-ahead path was found in the code/schema read so far** — but this is a **code+schema-level finding only**, not confirmed against live historical rows, and should not be cited as proof that leakage is impossible. Classify as **LIKELY / "no obvious leakage found,"** not PROVEN.

---

## 5. Market Ablation (Phase 3) — pending empirical run

| Arm | Status |
|---|---|
| A. Full (current, with market) | Committed report exists (see below) |
| B. No market | Committed report exists (see below), for Prediction Engine only — not run for Parlay Builder's card |
| C. Market only | **Not yet run** — no script or output exists |
| D. Market + non-market independent | **Not yet run** — no script or output exists |

**What does exist (LIKELY, not re-run):** `artifacts/api-server/docs/audit-market-consensus-ablation.md`, backed by `scripts/auditMarketConsensusAblation.ts` (796 lines). Methodology: real `paper_trade` rows with non-null odds, `calibrated_probability` as the "with odds" arm, `runPredictionEngine` re-run with `excludedModels={"marketOdds"}` for the "without odds" arm, plus a corroborating historical-corpus arm. Result: **+3.45pp accuracy / −0.0519 log-loss** at n=174 — below the script's own stated n≥200 threshold, activated via a documented explicit override. Confirmed current: `dataQuality.ts:181`'s `EXCLUDED_FROM_ENSEMBLE` set still omits `marketOdds` (i.e., still active), checked for drift against a Sept-19 touch of that file — no drift found on this specific point.

**This only answers "A vs B," and only for the Prediction Engine** — it does not test market-only (C) or market+independent (D), and it says nothing about the Parlay Builder's own triple-counted, non-de-vigged usage, which is a structurally different question (double-counting, not raw predictive value).

**To complete Phase 3** (arms C, D; and A/B specifically for the Builder's card metrics): requires running new scripts against the canonical app's Postgres DB — see "Where this lives" for how this is to be executed without exposing credentials.

---

## 6. Double-Counting Audit (Phase 4)

**PROVEN**, dependency graph:

```
                    RAW DATA
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     Player        Historical      Market odds
      data            data       (1/marketOdds,
        │              │          no de-vig, computed
        │              │          3x independently)
        └──────────────┼──────────────┘
                       ▼
                  VALIDATION  ◄── market enters DIRECTLY here (weight 0.040)
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
         CLOSENESS ◄── market    RISK ◄── market enters DIRECTLY here too
         enters DIRECTLY here    (+18/-12 bonus/penalty on same raw odds)
         (1 of 4 signals)             │
             │                        │
             └───► closenessRiskFloor()  ◄── market re-enters INDIRECTLY
                          │               here, a second time, via Closeness
                          ▼
                    riskScore = max(own formula, floor)
                       │
                       ▼
                    REMOVAL = f(Validation, Risk) — no new inputs
                       │
                       ▼
               DECISION / GRADE — no new inputs
```

Market odds is counted **3 separate times** (Validation-direct, Risk-direct, Closeness→Risk-floor-indirect) before reaching Removal/Decision, using 3 independent raw computations of the same un-devigged number, with **no cross-check or correlation discount** anywhere in the pipeline. This is the single most concrete, quantified finding of the whole audit.

---

## 7. Closeness Calibration (Phase 5) — pending empirical run

**What exists (LIKELY, stale-by-date but internally consistent with current code):**
- `backtestScoringDimensions_report.md` §2.5 (n=9,999): `<50` 63.0%, `50-64` 61.9%, `65-79` 56.9%, `≥80` 53.3% — monotonic decay, consistent with the metric's stated purpose.
- `analyzeClosenessFloors.ts` docstring table (n=1,500, July 2026): `<50` 80.0%, `50-64` 57.4%, `65-79` 56.8%, `≥80` 52.9% — same direction; this is the table the current `closenessRiskFloor()` ramp constants are directly built from.

**What's missing (this is the user's specific new ask):** neither table breaks Closeness down by "market-only relationship" vs. "non-market relationship," so the question **"does Closeness remain informative after controlling for market information"** — i.e., what fraction of Closeness's apparent signal is just market probability restated — **cannot be answered from any existing artifact**. This requires a fresh query joining Closeness's 4 component signals against outcome, split by whether the market-implied-probability-gap signal or the other 3 signals are driving each bucket.

---

## 8. Risk Audit (Phase 6)

**PROVEN** (formula trace, `builderScoringService.ts:1769-1881`):
```
preClosenessRisk = 35 (uncited baseline) + ~13 additive/subtractive terms (form, surface,
                   market bonus/penalty, fatigue, injury, opponent strength, data scarcity,
                   agreement, ranking gap) — none of these ~13 terms individually cited to
                   a backtest
riskFloor         = closenessRiskFloor(closenessScore)   — this ramp IS cited (n=1,500)
riskScore         = thinDataFloorFired ? thinDataFloor : max(preClosenessRisk, riskFloor)
```

**Does the Closeness floor improve out-of-sample calibration, or just force Risk upward for close matches? — pending empirical run.** The cited n=1,500 table justifies that *closeness itself* predicts lower accuracy — it does not test whether *flooring Risk* (as opposed to, say, a smaller floor, or none) produces better-calibrated final Risk numbers out-of-sample. No such comparison exists in any committed artifact.

---

## 9. Removal Audit (Phase 7)

**PROVEN, confirmed against current source:**
```
removalProbability = clamp(round((100 - validationScore)*0.55 + riskScore*0.45), 0, 100)
```
(`builderScoringService.ts:1994`)

**Classification: Removal is a derived decision metric, not an independent predictive feature.** It has no inputs beyond Validation and Risk, and the 0.55/0.45 weighting has no cited empirical fit anywhere in the codebase (unlike the Elite-tier `adj≥58` threshold or the KEEP `val≥62/risk≤44` gate, both of which have specific — if unverifiable-in-this-repo — cited backtest numbers in their comments).

**Does Removal have a clearly defined empirical target?** No — flagged as **a specification problem, not invented**. The only outcome data touching "risk bands" (`backtestScoringDimensions_report.md` §2.4) buckets the *risk* variable, not a separate `removalProbability` column, so it validates "risk correlates with losing" but says nothing about whether the specific 55/45 blend, expressed as a "Removal %," corresponds to any measurable rate of anything. **Recommendation candidate (not applied): Removal should not be displayed with a "%" suffix implying it is a probability of a defined event, since no such event is defined anywhere in the spec or code.**

---

## 10. Overall Score Analysis (Phase 9)

**PROVEN, confirmed twice now across two audits:** Overall Score **is** `validationScore`, rendered with no transformation (`AdminParlayBuilder.tsx:857`). No new Overall Score created.

**Does Validation itself have useful historical calibration? LIKELY yes, stale-by-date:** `backtestScoringDimensions_report.md` §2.3 shows a monotonic relationship (40-49: 53.8%, 50-59: 57.5%, 60-69: 63.3%, 70-79: 74.3%, n=9,999) — the strongest single-dimension gradient in that report besides Grade. But this report's corpus predates this repo's tracked history and cannot be assumed to reflect the current 17-factor weight table exactly (the market-consensus weight alone is known to be untested).

---

## 11. KEEP / BORDERLINE / REMOVE (Phase 8) — pending empirical run

Current thresholds: REMOVE if `grade==F || Validation≤33 || Risk≥70`; KEEP if `Validation≥62 && Risk≤44`; else BORDERLINE.

**From the one committed report available (LIKELY, flagged stale):**
- KEEP: n=4,249, 66.8% (+6.0pp vs 60.8% baseline)
- BORDERLINE: n=5,387, 56.4%
- REMOVE: n=363, 55.6%
- **Every multi-dimension combination tested (KEEP+Elite, KEEP+Grade A, etc.) failed holdout confirmation** — training edges of +9 to +21pp collapsed to −1 to −2pp on a genuinely time-ordered holdout split, or lacked holdout sample.
- Code comments cite a *different*, uncommitted analysis ("val≥62,risk≤44 → 70%/71% train/test win rate, n≈4,000") that does not match this report's numbers for the same tier — meaning the actual justification for the current thresholds is not present in this repository.

**Which of A/B/C is it?**
- (A) correctly identifying uncertainty vs. (B) excessively conservative thresholds vs. (C) the Prediction Engine lacking separation: **not yet determined**. The single-dimension data suggests real signal exists (KEEP does beat baseline), but the multi-dimension holdout failures are also consistent with "the underlying model doesn't separate well enough for compound conditions to hold up" (C) rather than purely a thresholding problem (B). Distinguishing these requires a fresh calibration-bucket analysis on current-code data.

No forcing of a target KEEP/BORDERLINE/REMOVE distribution was done or recommended, per the hard rules.

---

## 12. Grade Analysis

**LIKELY, stale-by-date but the cleanest single-dimension gradient found in either audit:** Grade A 80.3% (n=351), B 67.7% (n=2,789), C 58.1% (n=5,026), D 53.9% (n=1,775) — genuinely monotonic. The static cutoffs (76/63/50/38) themselves are not independently re-derived or holdout-tested at that exact granularity in the report; only the aggregate correlation is shown.

---

## 13. Prediction Engine ↔ Parlay Builder Boundary (Phase 10)

**PROVEN:** `adminParlay.ts` imports and calls only `computeBuilderScore`; it never imports `runPredictionEngine`. The Builder does not consume the Engine's `calibratedProbability` anywhere — it independently re-derives its own market number from raw odds using its own (cruder, non-de-vigged) formula. This matches documented intent in `.agents/memory/model-market-boundary.md` ("The independent Parlay Builder may use market price... without rewriting the underlying model probability").

**Is the same market signal counted twice through the interface between them?** No — because there is no interface; they don't share the market computation at all, each re-derives it independently from the same raw feed. This means: (a) the Engine and Builder cannot silently duplicate *each other's* prediction (good, matches the required separation), but (b) they also cannot benefit from each other's more-careful math — the Builder's odds handling is not held to the Engine's standard. This is a **coordination gap, not a merge violation** — no recommendation to merge the systems is made or implied.

---

## 14. Current vs. Stale Evidence (Phase 11)

| Report/script | Date | Sample | Split | Matches current code? |
|---|---|---|---|---|
| `backtestScoringDimensions_report.md` | self-dated 2026-08-01; git-added 2026-09-14 | n=9,999 | time-ordered 70/30 | **STALE** — parlayGrade taxonomy (5 buckets) contradicts current code (4 buckets); merge-justification numbers cited in code don't appear in this report |
| `analyzeClosenessFloors.ts` docstring table | ~July 2026 (undated commit) | n=1,500 | not specified as walk-forward split, but graded-outcome based | **CURRENT** — ramp constants in code match table's qualitative bands, no contradiction found |
| `audit-market-consensus-ablation.md` | 2026-08-08 (final run cited) | n=174 (below own n≥200 bar) | paired-arm, not detailed as time-ordered in what was read | **CURRENT** — `EXCLUDED_FROM_ENSEMBLE` set in `dataQuality.ts` (touched 9/19) still consistent with this report's conclusion |
| `analyzeParlayFactorCorrelations.ts` (factor-correlation/ablation) | script exists, added 2026-09-14 | — | — | **NEVER RUN** — no committed output anywhere, not cited by any other file |
| `analyzeParlayCalibration.ts` | script exists | — | — | **NEVER RUN** — no committed output |
| Market-shuffle placebo test | — | — | — | **DOES NOT EXIST** — no script, not merely unrun |
| Weight-sensitivity sweep (market-consensus specific) | — | — | — | **DOES NOT EXIST** |

No old report is used above to justify a current threshold without stating this compatibility check explicitly, per the hard rule.

---

## 15. Sample Sizes

All sample sizes actually available are cited inline above (n=9,999 for the main backtest; n=1,500 for closeness floors; n=174 for market ablation — explicitly below its own required n≥200; n≈4,000 cited in code comments but not traceable to any committed report). Fresh sample sizes pending the empirical runs in Phases 3/5/6/8.

---

## 16. Failure Cases

- REMOVE tier (n=363, 55.6%) is barely distinguishable from BORDERLINE (56.4%) in the one report available — the hard threshold the code draws between them is not obviously supported by this data.
- The market-consensus ablation's headline number (n=174) falls below the project's own declared statistical floor (n≥200) and was activated via an explicit override rather than by meeting the bar — a real, documented risk acknowledged by the codebase's own authors, not newly discovered here.
- Every multi-dimension KEEP combination (the exact kind of compound condition displayed on the app's prediction cards — KEEP + Elite + Grade B, etc.) failed holdout confirmation in the one available walk-forward test.

---

## 17. Recommended Changes — for review only, nothing applied

| Recommendation | Classification |
|---|---|
| Stop displaying `validationScore` as a separately-labeled "Overall Score" — it is the same number as "Validation" | PROVEN PROBLEM |
| Do not display Removal with a "%" suffix implying a calibrated probability of a defined event — no such event is defined in code or spec | PROVEN PROBLEM |
| Route the Parlay Builder's market-odds usage through the same de-vigged `impliedProbability.ts` function the Prediction Engine and analytics path already use, instead of 3 separate inline single-sided computations | LIKELY PROBLEM |
| Re-derive the `marketConsensus` Validation weight (0.040) and agreement weight (5.0) now that live odds rows presumably exist post-backfill, since both were explicitly placeholders | LIKELY PROBLEM |
| Run the four-arm ablation (Full/No-Market/Market-Only/Market+Independent) against current code with a fresh time-ordered split, since the one committed ablation only covers arms A/B for the Engine, not the Builder's card metrics | Needed to even evaluate |
| Build and run the market-shuffle placebo test — does not exist today | Needed to even evaluate |
| Run `analyzeParlayFactorCorrelations.ts` (exists, never run) to get the real ablation/independence answer for all 17 Validation factors, not just market-consensus | Needed to even evaluate |
| Regenerate `backtestScoringDimensions_report.md` against current code before citing it for anything — its parlayGrade taxonomy no longer matches | PROVEN PROBLEM (staleness), fix pending re-run |

No thresholds, formulas, or market inputs were changed. No systems were merged. No output distribution was optimized.

---

## Where this lives

Committed as `docs/audits/metric-truth-market-calibration-audit.md` on `claude/tennis-engine-audit-32-razn75` — audit documentation only, no application code touched.

**Database access status:** the canonical Replit app (`tennis-truth-engine-8ecc1270`) provisions its own `postgresql-16` module per its `.replit` config — this is the authorized, already-existing DB connection this audit relies on for anything empirical. No `DATABASE_URL` or other credential was requested from, or supplied by, the user; no secret value was read or printed in the course of this audit. The remaining empirical experiments must run *inside that authorized app*, rather than by exporting the connection string into any other session.

---

## 13a. Authorized-Database Inventory and Experiment Disposition (2026-09-20)

A read-only inventory was run through the canonical application's existing database connection. It found:

| Corpus | Total | Graded | Rows with usable market odds | Relevant timestamp evidence |
|---|---:|---:|---:|---|
| `evaluation_predictions` | 518,655 | 518,209 | 0 | 0 rows with `odds_fetched_at` |
| `parlay_leg_outcomes` | 958 | 0 | 0 | Created 2026-09-14 through 2026-09-20 |
| `predictions` | 188 | 36 | No historical odds snapshot corpus | 188 rows with `snapshot_captured_at`; this is not a timestamped odds history |

This confirms that database access is **not** the blocker. The missing evidence is:

1. a graded, timestamped historical market-odds corpus whose snapshots can be proven to predate each prediction cutoff; and
2. graded current-code Builder outcomes, or a new read-only replay that computes current Builder fields without writing back to operational tables.

Experiment status:

| Experiment | Status | Reason |
|---|---|---|
| Full / No-Market / Market-Only / Market+Independent | **BLOCKED** | No graded timestamped market corpus |
| Closeness controlled for market | **BLOCKED** | No market observations to control for |
| Risk floor ON vs OFF | **REQUIRES READ-ONLY REPLAY** | Current `parlay_leg_outcomes` has no graded rows |
| Fresh KEEP / BORDERLINE / REMOVE | **REQUIRES READ-ONLY REPLAY** | Current `parlay_leg_outcomes` has no graded rows |
| Market placebo shuffle | **BLOCKED** | No market observations to shuffle |
| Market-weight sensitivity | **BLOCKED** | No market observations on which weight changes can be measured |

Therefore no calibration, threshold, scoring, or UI change is justified by the current empirical evidence. In particular, the absence of populated odds columns still supports only **"structurally no obvious leakage found"**; it does not prove temporal leakage impossible.

---

## 13b. Offline Experiment Readiness (2026-09-20)

**Reframing, explicitly (per user instruction):** database access is available now — the canonical
app's authorized DB connection works, and nothing in this section is blocked by an inability to
connect. **The actual blocker is that the current historical corpus does not contain the
timestamped market evidence** the market-dependent experiments need to answer their questions:
`evaluation_predictions` has 0 rows with `odds_fetched_at` populated (of 518,655 total, 518,209
graded), and `parlay_leg_outcomes` has 0 graded rows (of 958 total) — see §13a above. **Connecting
to a database in the future does not, by itself, complete the market audit.** The corpus has to be
populated with graded, timestamped odds history (and `parlay_leg_outcomes` has to accumulate graded
rows via `scripts/resolveParlayLegOutcomes.ts`) before any of these experiments can produce a real
number. Database access being available now is not itself evidence that the audit is complete —
that would only follow once this corpus gap is closed and the experiments below are actually run.

Seven offline experiment scripts were written and unit-tested against synthetic, clearly-labeled
test-only fixtures under `artifacts/api-server/src/scripts/offlineExperiments/` (see
`EXPERIMENT_SPECS.md` in that directory for the full spec of each: required fields, exact
calculation, temporal-cutoff rule, output shape, validation metrics, leakage protections,
exclusions, and n-floor). Every script fails loudly — naming the exact missing field — rather than
substituting a default when required data is absent, and every script's output is accompanied by a
structured provenance record (`experimentProvenance.ts`: code commit read live via `git rev-parse
HEAD`, pinned formula version, dataset hash, date range, cutoff rule, N_total/N_eligible/N_excluded
with a reason breakdown) so a future real run is independently auditable rather than trusted on its
own say-so — a direct response to this project's own history of citing a stale backtest report
whose taxonomy no longer matched current code.

**Test status — these are two separate claims and must not be conflated.** Of the shared
infrastructure tests, `sharedValidation.test.ts` (10 tests) and `experimentProvenance.test.ts` (8
tests) — pure logic, no production-file imports — were actually executed with the repo's
`tsx --test` runner and passed (18/18). **This means only that the shared infrastructure's own
logic (field-validation gating, accuracy/Brier/log-loss/calibration math, the provenance-record
builder) is verified.** It does NOT mean any of the 7 experiments passed, ran, or produced a
result — none of them executed. `productionFormulaMirror.test.ts` and all seven `exp*.test.ts`
files are written, with expected values hand-derived directly from reading
`builderScoringService.ts` (not by running the mirror itself), but remain **UNEXECUTED**: they
import the real `builderScoringService.ts`, which imports the `@workspace/db` workspace package,
which requires `pnpm install` — not run here per the task's own instruction to avoid the disk/time
cost of installing this large monorepo. That is an environment gap, not a data gap or a logic
defect. **"18 shared-infrastructure tests passed" must never be summarized elsewhere as "the
experiments passed" or "the experiments were verified" — they were not run.**

| # | Experiment | Status | Why | Script |
|---|---|---|---|---|
| 1 | Risk Floor ON vs OFF | **BLOCKED — MISSING DATA** | Needs graded `parlay_leg_outcomes` rows (0 of 958 are graded) — but data volume alone will not unblock this one. **Per external review:** the script's current design only infers which floor a stored `risk_score` is *consistent with* (`risk_score == closenessRiskFloor(matchup_closeness)`), which cannot distinguish the closeness floor from the separate thin-data floor and is **not a counterfactual floor-OFF arm**. This is **not an executable ON/OFF causal comparison today**, even with graded rows — the `floor_did_not_bind` bucket is simply the set of rows where the floor happened not to be binding, not a "what if the floor were removed" arm. It requires the historical dataset to additionally persist either (a) both pre-floor and final risk scores per row, or (b) enough component-level inputs to deterministically recompute pre-floor risk via the pinned mirror — neither exists yet. Any output from this script today must be read as descriptive bucketing only, never as an ON/OFF causal result. | `offlineExperiments/exp1RiskFloorOnOff.ts` |
| 2 | Current KEEP/BORDERLINE/REMOVE calibration | **BLOCKED — MISSING DATA** | Same corpus as #1: needs graded `parlay_leg_outcomes` rows; 0 graded. The loader re-derives `decision` from stored inputs via the pinned `toDecision` mirror and excludes any row where that disagrees with the stored `decision` column, specifically to prevent a stale-formula-version row from contaminating a "current code" calibration study. | `offlineExperiments/exp2CurrentDecisionCalibration.ts` |
| 3 | Borderline separation analysis | **BLOCKED — MISSING DATA** | Depends directly on #2's verified-current-code corpus; 0 graded rows means 0 BORDERLINE rows to bucket. | `offlineExperiments/exp3BorderlineSeparation.ts` |
| 4 | Market Full / No-Market / Market-Only / Market+Independent | **BLOCKED — MISSING DATA** | Needs graded `evaluation_predictions` rows with `oddsFetchedAt <= cutoffAt`; 0 of 518,209 graded rows have `odds_fetched_at` populated at all. Arms B and D are additionally not offline-computable even with data (B needs a live engine re-run; D needs a blend spec that doesn't exist yet) — flagged in-script, not guessed. | `offlineExperiments/exp4MarketArms.ts` |
| 5 | Market shuffle / placebo test | **BLOCKED — MISSING DATA** | Uses the identical admissible corpus as #4; same 0-row blocker. | `offlineExperiments/exp5MarketShufflePlacebo.ts` |
| 6 | Market-weight sensitivity | **BLOCKED — MISSING DATA** | Needs graded, `source='backfill'` `parlay_leg_outcomes` rows joined to `evaluation_predictions` rows with admissible odds; both source counts are 0 (0 graded legs; 0 rows with odds_fetched_at). | `offlineExperiments/exp6MarketWeightSensitivity.ts` |
| 7 | Closeness calibration controlling for market | **BLOCKED — MISSING DATA** | Same join-based corpus as #6, further requiring a PlayerStats-reconstruction export (via `computePlayerStats` against `historical_matches`) that has not been built; both underlying source counts are 0. | `offlineExperiments/exp7ClosenessControlledForMarket.ts` |

All seven experiments are classified **BLOCKED — MISSING DATA** today, matching what the §13a
inventory implies: with 0 graded `parlay_leg_outcomes` rows and 0 `evaluation_predictions` rows
carrying `odds_fetched_at`, no experiment in this set has a real corpus to run against yet, and
none is reported as more ready than that. None was inflated to PARTIALLY READY on the strength of
written-but-unexecuted tests alone — the fail-fast/mechanism tests exist and their expected values
were hand-verified against the real formulas, but "the mechanism was verified" requires the tests
to have actually run, which the `@workspace/db` environment gap prevented here. Experiment #1
carries the additional, permanent methodological caveat above: it will remain blocked even after
`parlay_leg_outcomes` starts accumulating graded rows, until the schema or export additionally
captures pre-floor risk or its reconstructable inputs.

**What closes each blocker:**
- Experiments #1–3: `parlay_leg_outcomes` needs graded rows (via `scripts/resolveParlayLegOutcomes.ts` running against real settled matches over time) — a volume/time problem, not a design problem, *except* Experiment #1, which additionally needs a schema/export change (see above).
- Experiments #4–5: `evaluation_predictions` needs rows with `odds_fetched_at` populated — the odds-fetch pipeline needs to actually run and persist timestamped snapshots against graded predictions, which today it is not doing (0 of 518,209 graded rows have this field populated despite the column existing).
- Experiments #6–7: needs both of the above, plus a one-time data-export/join step (not implemented in this task — explicitly out of scope per the preparation-only brief) to join `parlay_leg_outcomes` to `evaluation_predictions` and, for #7, to reconstruct `computePlayerStats`-derived closeness inputs.
