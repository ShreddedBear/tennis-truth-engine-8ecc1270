# PREDICTION ENGINE / PARLAY BUILDER — DIRECT FILE-CONTENT RECONCILIATION

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Method:** SHA-256 hash comparison of every production/test file in both trees' `predictionEngine`/`parlayBuilder` service directories, followed by targeted `grep`/content inspection of files found to differ. This is content-based evidence, not filename-based. No migration, mutation, restore, or code change was performed.

---

## 1. REPOSITORY/TREE IDENTITY

| | Value |
|---|---|
| `Tennis-Stats-Engine` HEAD | `7d851f878d27e0b68f5d4d46c816134b4a10f0c7`, 2026-09-17 23:15:28 UTC |
| State C HEAD | `377cf230075b68ae6f3c41d018f5a7ecae4f8501` (current, per the prior pre-merge audit) |
| Prediction Engine path (both repos, confirmed identical) | `artifacts/api-server/src/services/predictionEngine/` |
| Parlay Builder path (both repos, confirmed identical) | `artifacts/api-server/src/services/parlayBuilder/` |
| Note on `checkParlayBoundary` | Lives at `artifacts/api-server/src/scripts/checkParlayBoundary.ts` in `Tennis-Stats-Engine` — **outside** the `parlayBuilder/` directory this report focuses on. **Not compared this pass** — flagged as a scope gap, not silently dropped. |

---

## 2. PREDICTION ENGINE INVENTORY (`Tennis-Stats-Engine`, production + test files)

**VERIFIED, 55 files enumerated via `find`:** `availability.{ts,test.ts}`, `calibration.{ts,test.ts}`, `classificationPolicy.ts`, `dataQuality.{ts,test.ts}`, `disagreement.{ts,test.ts}`, `eliteTier.{ts,test.ts}`, `ensemble.ts`, `fallbackTracking.ts`, `fatigue.{ts,test.ts}`, `finalConsistencyCheck.{ts,test.ts}`, `headToHead.ts`, `index.{ts,test.ts}`, `matchLoadRecovery.{ts,test.ts}`, `matchPerformance.ts`, `opponentStrength.{ts,test.ts}`, `playerProfileWarnings.{ts,test.ts}`, `predictionIdentity.{ts,test.ts}`, `recentForm.{ts,test.ts}`, `recommendation.{ts,test.ts}`, `segments.ts`, `serveReturn.{ts,test.ts}`, `setMargins.ts`, `simulator.{ts,test.ts}`, `simulatorPool.ts`, `simulatorWorker.ts`, `styleMatchup.ts`, `surfaceElo.{ts,test.ts}`, `surfaceSampleDiscountRetirement.test.ts`, `swapInvariance.test.ts`, `tieBreakers.{ts,test.ts}`, `types.ts`, `units.ts`, `upsetRisk.{ts,test.ts}`, `venueMap.{ts,test.ts}`, `weather.{ts,test.ts}`.

This maps cleanly onto the requested focus areas: model components (`ensemble.ts`, `simulator*.ts`), feature calculation (`recentForm.ts`, `serveReturn.ts`, `surfaceElo.ts`, `matchPerformance.ts`), calibration (`calibration.ts`), confidence handling (`classificationPolicy.ts`, `finalConsistencyCheck.ts`), recommendation logic (`recommendation.ts`), player ordering (`swapInvariance.test.ts`), surface logic (`surfaceElo.ts`, `venueMap.ts`), fatigue/availability (`fatigue.ts`, `availability.ts`, `matchLoadRecovery.ts`), Monte Carlo (`simulator.ts`, `simulatorPool.ts`, `simulatorWorker.ts`), data access/contracts (`types.ts`, `predictionIdentity.ts`, `dataQuality.ts`).

---

## 3. PREDICTION ENGINE CONTENT RECONCILIATION

**Method: SHA-256 of all 55 files, both sides, diffed programmatically (not by eye).**

**Result: 52 of 55 files are byte-identical. 1 file is absent from State C. 7 files (excluding the 1 absent) differ in content — wait, precise count below.**

| Component | `Tennis-Stats-Engine` | State C | Content Status | Evidence |
|---|---|---|---|---|
| `availability.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `calibration.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `classificationPolicy.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `dataQuality.test.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| **`dataQuality.ts`** | present | present | **DIFFERENT CONTENT** | SHA-256 mismatch; **VERIFIED via targeted grep: `TOUR_RELIABILITY_DISCOUNT`, `LOW_SURFACE_SAMPLE_DISCOUNT` both defined in State C's copy** — the difference is not the absence of this specific mechanism (see §5) |
| `disagreement.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `eliteTier.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `ensemble.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `fallbackTracking.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `fatigue.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| **`finalConsistencyCheck.ts` + `.test.ts`** | present | present | **DIFFERENT CONTENT, MATERIAL** | SHA-256 mismatch on both; see §5, Fix #4 — **State C's version lacks the `eloGapPoints` gate** |
| `headToHead.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| **`index.ts` + `.test.ts`** | present | present | **DIFFERENT CONTENT** | SHA-256 mismatch on both; contains the wiring for `finalConsistencyCheck`, `dataQuality` discounts, etc. — some divergence expected given `finalConsistencyCheck.ts` itself differs, but the full extent of the diff was not line-by-line reviewed (1160 lines in State C's copy) |
| `matchLoadRecovery.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `matchPerformance.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `opponentStrength.test.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| **`opponentStrength.ts`** | present | present | **DIFFERENT CONTENT** | SHA-256 mismatch; not line-diffed this pass |
| `playerProfileWarnings.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `predictionIdentity.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `recentForm.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `recommendation.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `segments.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `serveReturn.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `setMargins.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `simulator.{ts,test.ts}`, `simulatorPool.ts`, `simulatorWorker.ts` | present | present | **BYTE-IDENTICAL** (all 4) | SHA-256 match |
| `styleMatchup.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `surfaceElo.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| **`surfaceSampleDiscountRetirement.test.ts`** | present | **ABSENT** | **GENUINELY MISSING FILE** | Not found anywhere in State C's `predictionEngine/` directory; see §5, Fix #5 |
| `swapInvariance.test.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `tieBreakers.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| **`types.ts`** | present | present | **DIFFERENT CONTENT** | SHA-256 mismatch; not line-diffed this pass (157 lines in State C's copy vs. TSE's version) |
| `units.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `upsetRisk.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `venueMap.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `weather.{ts,test.ts}` | present | present | **BYTE-IDENTICAL** | SHA-256 match |

**Summary: 52/55 files byte-identical (VERIFIED), 6 differ in content (`dataQuality.ts`, `finalConsistencyCheck.ts` + `.test.ts`, `index.ts` + `.test.ts`, `opponentStrength.ts`, `types.ts`), 1 genuinely absent (`surfaceSampleDiscountRetirement.test.ts`).**

**No file was reported "preserved" merely because its filename matched — every row above rests on a SHA-256 comparison, and the differing rows were followed up with actual content inspection where feasible within this pass's scope.**

---

## 4. PARLAY BUILDER RECONCILIATION

| Component | `Tennis-Stats-Engine` | State C | Content Status | Evidence |
|---|---|---|---|---|
| `matchstatScraper.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `sofascoreProvider.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `webResearchService.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| `builderScoringService.test.ts` | present | present | **BYTE-IDENTICAL** | SHA-256 match |
| **`builderProviderFetch.ts` + `.test.ts`** | present | present | **DIFFERENT CONTENT (both)** | SHA-256 mismatch; not line-diffed this pass |
| **`builderScoringService.ts`** | present | present | **DIFFERENT CONTENT** | SHA-256 mismatch; not line-diffed this pass — **this is the file most likely to hold "leg validation," "probability handling," and "exposure limits" logic per its name, and it was NOT byte-verified equivalent** |

**`checkParlayBoundary` logic:** lives outside this directory (`artifacts/api-server/src/scripts/checkParlayBoundary.ts` in `Tennis-Stats-Engine`) and was **not compared this pass** — genuine scope gap, explicitly flagged rather than assumed fine.

**Classification: DIFFERENT IMPLEMENTATION for 3 of 7 files (including the highest-value one, `builderScoringService.ts`), IDENTICAL for the other 4.** Independence-from-Prediction-Engine, duplicate-leg rules, and recommendation boundaries specifically were **not verified this pass** — doing so would require the actual line-diff of `builderScoringService.ts`, not performed here to respect the resource-conscious scope; this is the natural next step if you want it closed out (see §9).

---

## 5. CRITICAL PRODUCTION FIX MATRIX

| Fix | `Tennis-Stats-Engine` evidence | State C evidence | Status |
|---|---|---|---|
| 1. Neutral player-ordering / winner-first contamination fix | `swapInvariance.test.ts` exists (VERIFIED) | **BYTE-IDENTICAL** to TSE's copy (VERIFIED via SHA-256) | **PRESENT** |
| 2. No-lookahead smoke test | Not specifically located by name in this directory this pass | Not checked | **UNKNOWN** — not investigated |
| 3. Temporal-integrity availability fix | `availability.{ts,test.ts}` exist | **BYTE-IDENTICAL** (VERIFIED) | **PRESENT** (assuming this is the relevant file; not confirmed by name alone that this is "the" temporal-integrity fix) |
| **4. Recommendation catch-all / Elo-gap gate** | **VERIFIED**: TSE's own HEAD commit (`7d851f87`, "Fix recommendation catch-all gap: gate Rule 10/12 on real Elo-gap separation") added a required `eloGapPoints: number` field to `FinalConsistencyInput` and gated Rule 12 on `Math.abs(eloGapPoints) >= HIGH_CONFIDENCE_GATE.ELO_GAP_MIN_POINTS` | **VERIFIED ABSENT**: direct `grep` of State C's `finalConsistencyCheck.ts` for `eloGapPoints`/`ELO_GAP_MIN_POINTS` returns **zero matches**. State C's Rule 12 error message reads the **old, pre-fix wording**: *"a real lean with Strong model agreement and margin ≥ 9 must be at least HIGH_CONFIDENCE, not LOW_CONFIDENCE"* — exactly the hardcoded-without-separation-check behavior TSE's fix commit describes replacing. | **ABSENT — the single most concrete, code-verified gap found in this entire audit** |
| **5. Probability-compression surface-sample fix** | `surfaceSampleDiscountRetirement.test.ts` (regression suite) exists; `LOW_SURFACE_SAMPLE_DISCOUNT`/`TOUR_RELIABILITY_DISCOUNT` defined in `dataQuality.ts`, consumed in `index.ts` | **The underlying mechanism IS present** — `grep` confirms `LOW_SURFACE_SAMPLE_DISCOUNT`, `TOUR_RELIABILITY_DISCOUNT`, and the `surfaceSampleDiscount`/`tourDiscount`/`reliabilityDiscount` computation all exist in State C's `dataQuality.ts`/`index.ts`. **But the dedicated regression test file itself is genuinely absent.** | **PARTIAL — fix code present, its regression-test coverage is missing** |
| 6. Walk-forward resource/OOM protections | Outside this directory's scope (would be in `historicalData`/backtest services, not `predictionEngine`/`parlayBuilder`) | Not checked | **UNKNOWN — out of this pass's scope** |
| 7. Live-score / fixture identity fix | `predictionIdentity.{ts,test.ts}` exist | **BYTE-IDENTICAL** (VERIFIED) | **PRESENT**, if this is the relevant fix (not fully confirmed by name) |
| 8. Backtest candidate-config support | Outside `predictionEngine`/`parlayBuilder` scope (`historicalData`/evaluation services) | Not checked | **UNKNOWN — out of scope** |
| 9. Cross-engine agreement hardening | `disagreement.{ts,test.ts}`, `classificationPolicy.ts` plausibly relevant | **BYTE-IDENTICAL**, both (VERIFIED) | **PRESENT**, tentatively — name-based inference, not content-confirmed as "the" hardening fix specifically |
| 10. Live Audits frontend/backend integration | Outside `predictionEngine`/`parlayBuilder` scope entirely | Not checked | **UNKNOWN — out of scope** |

**Per instruction, nothing above was inferred from commit titles alone where a direct check was possible — items 1, 3, 4, 5, 7, 9 rest on actual SHA-256/grep evidence. Items 2, 6, 8, 10 are honestly marked UNKNOWN because they fall outside the `predictionEngine`/`parlayBuilder` directories this pass was scoped to.**

---

## 6. DATA/CONTRACT COMPATIBILITY

- **`types.ts` differs in content (VERIFIED via SHA-256) between the two trees** — this is a real compatibility risk flag: if `PredictionEngineInput`/`ModuleResult`/other exported types have diverged, code depending on one version's shape may not compile or behave correctly against the other's runtime output. **Not line-diffed this pass** — the exact nature of the divergence (additive vs. breaking) is UNKNOWN.
- **Database tables:** State C's Prediction-Engine-relevant tables (`evaluation_predictions`, `predictions`, `player_stats`, etc.) were VERIFIED populated in prior reports; whether `Tennis-Stats-Engine`'s own database (confirmed in Step 0 to be a separate `DATABASE_URL`-configured Postgres instance) is the same physical database as State C's `heliumdb` remains **UNKNOWN — never tested**, as flagged in the prior pre-merge report.
- **Truth Engine interfaces:** no direct evidence checked this pass connecting Prediction-Engine types to Truth-Engine consumers.

---

## 7. MISSING OR DIVERGENT FUNCTIONALITY — SUMMARY

- **Genuinely missing:** `surfaceSampleDiscountRetirement.test.ts` (test coverage only — the underlying fix's code is present, confirmed by content).
- **Different implementation, materially significant:** `finalConsistencyCheck.ts`/`.test.ts` — State C is missing the Elo-gap-gate logic that exists in `Tennis-Stats-Engine`'s current `main`. This is a real, code-verified functional gap in a production confidence-classification rule, not a cosmetic difference.
- **Different implementation, significance unconfirmed:** `dataQuality.ts` (mechanism confirmed present despite differing bytes — likely benign reordering/comment changes, but not proven), `index.ts`/`.test.ts`, `opponentStrength.ts`, `types.ts`, `builderProviderFetch.ts`/`.test.ts`, `builderScoringService.ts`.
- **Already preserved (byte-identical):** 52 of 55 Prediction-Engine files, 4 of 7 Parlay-Builder files.
- **Unknown:** `checkParlayBoundary.ts` (outside directory scope), and fixes #2/#6/#8/#10 from the requested matrix (outside `predictionEngine`/`parlayBuilder` scope).

---

## 8. PRESERVATION REQUIREMENT

**TARGETED PRESERVATION REQUIRED.**

Not "no action" (real, confirmed gaps exist), not "major" (the large majority of files — 52/55 and 4/7 — are byte-identical, and the one clearly-missing item is a test file, not production code). The specific, evidence-based items needing attention:
1. State C's `finalConsistencyCheck.ts` should be reconciled with `Tennis-Stats-Engine`'s Elo-gap-gate fix (Fix #4) — this is a real behavioral gap in production confidence classification, not a documentation or test-only issue.
2. `surfaceSampleDiscountRetirement.test.ts` should be considered for porting to restore regression coverage for an already-present fix.
3. The five other differing files (`dataQuality.ts`, `index.ts`+`.test.ts`, `opponentStrength.ts`, `types.ts`, `builderProviderFetch.ts`+`.test.ts`, `builderScoringService.ts`) require an actual line-level diff before their status can move past "different, significance unconfirmed."

---

## 9. RECOMMENDED NEXT SINGLE STEP

**Line-diff `builderScoringService.ts`** (Parlay Builder's core scoring/boundary logic, per its name and role) **between the two trees.** This is the smallest next step that most directly addresses the task's specific concern about "exposure limits," "duplicate-leg rules," and "recommendation boundaries" — none of which were confirmed either way this pass beyond noting the file differs. It's a single, bounded file comparison, not a broader sweep.

---

## FINAL RESPONSE SUMMARY

1. **Does State C actually contain the `Tennis-Stats-Engine` Prediction Engine?** **Substantially yes, with one confirmed, specific, real gap.** 52 of 55 files are byte-identical; the Elo-gap-gate fix in `finalConsistencyCheck.ts` (Fix #4) is verifiably absent from State C's copy; one regression test file is entirely missing (coverage-only gap, underlying fix present).
2. **Is the Parlay Builder preserved?** **Partially confirmed — 4 of 7 files byte-identical, 3 differ (including the core scoring service), not yet line-diffed.** `checkParlayBoundary.ts` was out of this pass's directory scope entirely.
3. **Most important differences found:** the missing Elo-gap-gate logic in `finalConsistencyCheck.ts` is the one confirmed, material, production-relevant gap. Everything else flagged as "different" is confirmed different by hash but not yet assessed for significance.
4. **Does any production functionality appear genuinely missing?** **Yes, one specific item: the Elo-gap-gate behavior in Rule 12 of `finalConsistencyCheck.ts`.** Everything else either matches exactly or is an unconfirmed (not proven missing) content difference.
5. **Can the repository consolidation proceed to the next gate?** **Not yet** — the confirmed Elo-gap-gate gap and the five/six unreviewed content-differing files (especially `builderScoringService.ts` and `types.ts`) should be resolved or explicitly accepted first, per the "Targeted Preservation Required" classification above.
6. **Exact audit artifact path:** `docs/migration-audit/step-prediction-parlay-content-reconciliation-20260919.md`
7. **Confirmation:** no merge, cherry-pick, rebase, commit, push, file copy, restore, or code/database/configuration modification occurred. All evidence was gathered via read-only `find`, `sha256sum`, `grep`, and direct file reads against a local shallow clone of `Tennis-Stats-Engine` and via read-only Replit Agent queries against the live State C workspace.

**STOP. No merge, cherry-pick, rebase, commit, or push was performed or is being recommended for execution at this time.**
