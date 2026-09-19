# `index.ts` — AVAILABILITY/FATIGUE/MATCHLOADRECOVERY `asOfDate` WIRING AUDIT

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Scope:** `artifacts/api-server/src/services/predictionEngine/index.ts`, tracing `asOfDate`, `Availability`, `Fatigue`, `MatchLoadRecovery`, and `Date.now()`/`new Date()` usage specifically, per instruction, following up on the documentary gap found in `types.ts`. **No code, database, or configuration was modified. No merge, cherry-pick, commit, or push occurred.**

---

## RESULT: CONFIRMED, CODE-LEVEL BUG IN STATE C — NOT SPECULATIVE

The `types.ts` comment gap was documentary evidence pointing at a possible issue. **This audit found the actual code and confirms the issue is real.**

---

## 1. File Identity

| | `Tennis-Stats-Engine` | State C |
|---|---|---|
| Line count | **1,277** (VERIFIED, local `wc -l`) | **1,248** (VERIFIED, Agent `wc -l`) — 29 lines shorter |
| SHA-256 | `37f8de5e9b52a7b0e73f79fd37575a064e2fc111a4d15a9527e2c369c383c6f2` | `7ffca9a5703ec75e9fbe6866c3d731d9123f714e7ba8b3f18d60dc301223c0c7` |
| Whole-file match | No (already known from the prior reconciliation report) |

**Note on scope:** this audit traced the five specifically-requested items only (`asOfDate`, `Availability`, `Fatigue`, `MatchLoadRecovery`, `Date.now()`/`new Date()`). The 29-line total difference between the files may include other, unrelated changes not investigated here — that would require a separate full hash-bisection of this 1,200+-line file, which is out of this task's bounded scope and not needed to answer the specific question asked.

---

## 2. The Wiring — Traced and Compared Directly

**`Tennis-Stats-Engine` (VERIFIED, read directly from local disk, lines 388–395):**
```ts
const fatigue = computeFatigueModule(input.player1Matches, input.player2Matches, input.asOfDate);
const matchLoadRecovery = computeMatchLoadRecoveryModule(input.player1Matches, input.player2Matches, input.asOfDate);
// 2026-09-16 asOfDate fix (sibling of the 2026-07-14 Fatigue fix, see PredictionEngineInput.asOfDate):
const availability = computeAvailabilityModule(input.player1Matches, input.player2Matches, input.tournamentName ?? null, input.asOfDate ?? new Date(), input.webResearch ?? null);
```

**State C (VERIFIED via `grep`, lines 388–390 — grep output, plain-text match lines, not subject to the earlier text-relay corruption issue since these are single-line matches with no multi-line comment blocks or generic-type angle brackets involved):**
```ts
const fatigue = computeFatigueModule(input.player1Matches, input.player2Matches, input.asOfDate);
const matchLoadRecovery = computeMatchLoadRecoveryModule(input.player1Matches, input.player2Matches, input.asOfDate);
const availability = computeAvailabilityModule(input.player1Matches, input.player2Matches, input.tournamentName ?? null, new Date(), input.webResearch ?? null);
```

**Direct comparison:**

| Module | `Tennis-Stats-Engine` call | State C call | Match? |
|---|---|---|---|
| `computeFatigueModule` | passes `input.asOfDate` | passes `input.asOfDate` | ✅ IDENTICAL |
| `computeMatchLoadRecoveryModule` | passes `input.asOfDate` | passes `input.asOfDate` | ✅ IDENTICAL |
| `computeAvailabilityModule` | passes **`input.asOfDate ?? new Date()`** (frozen date when backtesting, live time otherwise) | passes **`new Date()` unconditionally** | ❌ **DIFFERENT — State C never reads `input.asOfDate` for this call at all** |

**The explanatory comment present in `Tennis-Stats-Engine` directly above this line — `// 2026-09-16 asOfDate fix (sibling of the 2026-07-14 Fatigue fix, see PredictionEngineInput.asOfDate):` — is absent from State C's copy**, consistent with (and now fully explaining) the `types.ts` documentation gap found in the prior audit.

---

## 3. Verification: Does the 2026-09-16 Availability Fix Exist Behaviorally?

**In `Tennis-Stats-Engine` `main`: YES, confirmed present, in the exact form its own documentation describes.**

**In State C: NO, confirmed absent.** State C's `computeAvailabilityModule` call unconditionally evaluates `new Date()` at call time, regardless of whether `input.asOfDate` was supplied. This is not a comment-only or cosmetic difference — it is the actual runtime argument passed into the module.

---

## 4. What This Means Behaviorally

- **Live predictions (no `asOfDate` supplied): NO IMPACT.** For a live call, `input.asOfDate` is expected to be `undefined` anyway (per the type's own documented contract: "Omit for every live call -- it defaults to the real current time, which is correct there"). TSE's `input.asOfDate ?? new Date()` and State C's unconditional `new Date()` produce **the same result** in this case — the current time. Live prediction behavior is unaffected by this bug.
- **Backtest/walk-forward evaluation (`asOfDate` deliberately set to a historical match's frozen date/`cutoffAt`): REAL, CONFIRMED DIVERGENCE.** When `input.asOfDate` is set (e.g., during `historicalScoring.ts`/`ablation.ts`/backtest replay runs, per the type comment's own description of when `asOfDate` is populated), TSE correctly uses that historical date for Availability's recency-window calculations (rest-days/recent-walkover/recent-retirement windows, measured relative to the match being evaluated). **State C instead always uses today's actual wall-clock date for this calculation, regardless of which historical match is being scored.** Per the exact mechanism the type comment describes for the pre-2026-07-14 Fatigue bug: comparing historical match dates (potentially years in the past) against today's date will make every "was there a recent match/walkover/retirement" window check evaluate as false/empty (since nothing will appear "recent" relative to today when the actual match was years ago) — **silently and systematically suppressing the Availability signal for every backtested match in State C, without throwing an error or producing an obviously wrong-looking value.**

---

## 5. Affected Callers/Dependents and Migration Risk

- **Direct caller:** `runPredictionEngine` (the function containing this wiring, per the file's structure established in the prior reconciliation report — `export async function runPredictionEngine` at line ~1025 in `builderScoringService.ts`'s TSE numbering context; this specific `index.ts` file is the Prediction Engine's own main entry point).
- **Consumers of Availability's output within a backtest context:** any evaluation/backtest/walk-forward pipeline that scores historical matches through this same `computeAvailabilityModule` call path — per Step 0 and the prior reconciliation reports, this includes State C's own live database tables `evaluation_predictions` (518,527 rows, VERIFIED populated with dates spanning 2012–2026) and `backtest_predictions`/`backtest_runs` (VERIFIED 0 rows currently, per the earlier DB audit — so this specific bug has **not yet produced any stored backtest output to be concerned about retroactively**, since no backtest runs have been recorded in State C's database yet).
- **Migration risk:** **MEDIUM.** This is a real, confirmed, code-level defect in State C that silently degrades one input signal (Availability) specifically during backtest/historical evaluation, not during live predictions. It does not corrupt data or crash anything — it just means any backtest run performed in State C today would be scoring predictions with a permanently-empty Availability signal, which could bias evaluation results (e.g., making Availability appear uninformative in a backtest when it actually isn't, or making the ensemble's weighting of Availability look artificially poor in historical validation). **Given `backtest_predictions`/`backtest_runs` are currently empty (0 rows) in State C's live database, no existing stored analysis has been contaminated by this bug yet** — but any backtest run performed before this is fixed would be.

---

## 6. Preservation/Consolidation Implication

This is a genuine, confirmed **BUG FIX MISSING** in State C, not a "different but equivalent" implementation and not merely documentary. Per your standing instruction not to fix anything yet: **this finding is reported, not corrected.** It should be added to the same preservation/reconciliation list as the previously-confirmed `finalConsistencyCheck.ts` Elo-gap-gate gap — both are real, code-verified, single-line-level fixes that exist in `Tennis-Stats-Engine`'s current `main` and are absent from State C.

---

## FINAL SUMMARY

1. **Does State C thread `asOfDate` into Availability correctly, or does it still use wall-clock time during backtest evaluation?** **It still uses wall-clock time (`new Date()`) unconditionally — confirmed by direct code comparison, not inference.**
2. **Does the 2026-09-16 Availability fix exist behaviorally in `Tennis-Stats-Engine`?** **Yes, confirmed present** (`input.asOfDate ?? new Date()`, with an explanatory comment referencing the fix date).
3. **Does it exist in State C?** **No, confirmed absent** (`new Date()` unconditionally, no comment, `input.asOfDate` never referenced for this call).
4. **Affected callers/dependents:** `runPredictionEngine`'s Availability-module call path; any future backtest/evaluation run in State C. **No currently-stored backtest output is affected**, since State C's `backtest_predictions`/`backtest_runs` tables are confirmed empty.
5. **Migration risk:** **MEDIUM** — a real, silent, systematic signal-degradation bug during backtesting, with no live-prediction impact and no retroactive data contamination (yet).
6. **The `types.ts` comment gap from the prior audit is now explained, not merely correlated:** it was accurately documenting a real, present code difference, not a stale or misleading comment.
7. **Nothing was fixed, copied, merged, or modified.** All findings rest on direct `grep`/`wc -l`/`sha256sum` evidence — the specific lines quoted in §2 are short, single-line greps without multi-line comments or generic-type angle brackets, so they are not subject to the text-relay corruption issue flagged in the prior `builderScoringService.ts`/`types.ts` reports.

**STOP after this file, per instruction. No merge, cherry-pick, rebase, commit, or push was performed or is being recommended for execution at this time.**
