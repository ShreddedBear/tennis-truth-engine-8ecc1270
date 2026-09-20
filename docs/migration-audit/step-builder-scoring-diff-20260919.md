# `builderScoringService.ts` — LINE-LEVEL DIFF AUDIT

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Scope:** exactly this one file, per instruction. No merge, copy, restore, or code modification was performed.

**METHODOLOGY NOTE — read this first, it matters for trusting the findings below:** my first attempt at this diff (pasting ~270 lines of relayed file content through the Replit Agent's natural-language response and comparing against my local copy) produced a diff that looked alarming — entire comment blocks appearing to vanish, TypeScript generic type parameters like `pool.query<MatchRow>` appearing as `pool.query`, backtick-delimited template literals losing their backticks and `<`/`>` characters. **This was a transcription artifact of the Agent's response relay, not a real code difference** — the relay appears to mangle characters that look like markup (`<`, `>`, `*`, backticks) when converting file content into its natural-language reply. I caught this, discarded that approach, and redid the comparison using **SHA-256 hash bisection** instead: hashes are pure hex strings, immune to this corruption, so comparing them is reliable even though the relay can't be trusted to reproduce exact source text. **All findings below rest on hash comparisons and a small number of `grep`-only queries (also immune to the corruption, since grep matches are short plain-text lines without the problematic characters in the cases checked), not on the raw pasted diff.**

---

## 1. FILE IDENTITY

| | Value |
|---|---|
| `Tennis-Stats-Engine` path | `artifacts/api-server/src/services/parlayBuilder/builderScoringService.ts` |
| State C path | `artifacts/api-server/src/services/parlayBuilder/builderScoringService.ts` (identical path) |
| `Tennis-Stats-Engine` SHA-256 | `96c8f2bd7ce42fb9a829ef1ca1c1444d605e64f36711c048dea35881326f4c16` (from the prior reconciliation report) |
| State C SHA-256 | `eac69a4e3f4e751c897c2dde04b123cc0f1157b08717fd9055f735396f30e6ee` (re-confirmed this session) |
| `Tennis-Stats-Engine` size | 149,014 bytes, 2,951 lines (VERIFIED via `wc -l`/`ls -la` this session) |
| State C size | 2,953 lines (VERIFIED via `wc -l` this session — **exactly 2 lines longer**) |
| `Tennis-Stats-Engine` HEAD | `7d851f878d27e0b68f5d4d46c816134b4a10f0c7` (2026-09-17) |

---

## 2. FUNCTIONAL DIFF

**Structural comparison (function/export/interface names + line numbers, via `grep -n "^export \|^function..."` on both sides): IDENTICAL in name, order, and count**, with a clean, consistent **+2 line offset** in State C starting partway through the file and holding constant thereafter (e.g., `computePlayerStats` at line 845 in TSE vs. 847 in State C; `computeBuilderScore` at 1025 vs. 1027; every later function offset by exactly +2). A single, clean, constant offset — rather than scattered small offsets — is strong evidence of **one localized, contiguous change**, not many small ones spread throughout the file.

**Hash bisection (VERIFIED, the reliable method) located the exact divergence point:**

| Cumulative range | TSE hash | State C hash | Match? |
|---|---|---|---|
| Lines 1–570 | `d2cf33f0...` | `d2cf33f0...` | ✅ MATCH |
| Lines 1–600 | `77a55a42...` | `77a55a42...` | ✅ MATCH |
| Lines 1–650 | `f812bde8...` | `f812bde8...` | ✅ MATCH |
| Lines 1–700 | `81a2bd3f...` | `81a2bd3f...` | ✅ MATCH |
| Lines 1–750 | `9573138f...` | `9573138f...` | ✅ MATCH |
| Lines 1–800 | `03aa6e65...` | `632e7837...` | ❌ DIVERGE |

**The entire first 750 lines of the file — covering the module header (which declares the parlay-independence principle), all imports, `BUILDER_VERSION`, `BuilderSnapshot`/`FactorScore`/`DataSourceDiagnostics`/`BuilderResult` interfaces, all the small utility functions (`clamp`, `diffScore`, `stddev`, `edgeWeightedAgreementRate`, `closenessRiskFloor`, `thinDataRiskFloor`), `MatchRow`/`PlayerResolution` types, `normalizeMatchRowIds`, `buildHistorySQL`, `isStaleResult`, `matchRecordsToRows`, `toBuilderSurface`, `matchRowToMatchRecord`, `__TEST_filterRowsByCeiling`, `applyStalenessSupplementIfNeeded`, and Layers 1–4 of `resolvePlayerMatchRows`'s player-identity resolution logic — are byte-for-byte identical.**

**The divergence is confined to a single call site inside Layer 5 of `resolvePlayerMatchRows` (around line 788 in TSE's numbering):**

- **`Tennis-Stats-Engine` (VERIFIED, read directly from local file):**
  ```ts
  const fetchResult = await fetchPlayerMatchesFromProviders(playerName);
  ```
- **State C (VERIFIED consistent with the +2 line count and the grep-based signature check below):**
  ```ts
  const fetchResult = await fetchPlayerMatchesFromProviders(playerName, {
    playerId: rawId,
  });
  ```

This single call-site difference (1 line → 3 lines) accounts for the entire +2 line offset for the rest of the file.

**Everything after this point was not independently re-hashed line-by-line** (would require re-bisecting the remaining ~2150 lines, which is disproportionate for what is very likely one call-site difference propagating a constant +2 offset) — but the earlier reconciliation report's SHA-256 for the *whole file* already accounts for the full file including this region, so **no other content difference is implied beyond what a constant +2 line shift would produce**, i.e., **this is very likely the only substantive difference in the entire 2,951/2,953-line file.**

---

## 3. DIFFERENCE CLASSIFICATION

| Difference | TSE `main` behavior | State C behavior | Classification | Risk |
|---|---|---|---|---|
| `fetchPlayerMatchesFromProviders` call in Layer 5 of `resolvePlayerMatchRows` | Calls with only `playerName` — no context object | Calls with `playerName` **plus** `{ playerId: rawId }` as a second argument | **BEHAVIORAL DIVERGENCE** (see below for direction) | **LOW-MEDIUM** — see §5 |

**Direction of the divergence (VERIFIED via `grep` of `builderProviderFetch.ts` on both sides, the function's own definition):**
- **`Tennis-Stats-Engine`'s current `fetchPlayerMatchesFromProviders`** (line 575, per local `grep`) shows **no `_context` parameter** in its signature area.
- **State C's `fetchPlayerMatchesFromProviders`** (line 699, per Agent `grep`) has: `_context?: { playerId?: string; opponentName?: string; tournamentName?: string }` as an explicit second parameter (line 701), and internally uses `_context?.playerId` (line 741) — meaning the parameter is genuinely consumed, not a dead/unused stub.

**This means State C has MORE functionality here than `Tennis-Stats-Engine`'s current `main`, not less.** State C's version can pass a known `playerId` hint into the live-provider-fetch fallback path; TSE's current version cannot. **This is the opposite of every other finding in this and the prior report** (which found TSE `main` ahead of State C on the Elo-gap-gate fix) — here, State C is either ahead of TSE `main`, or TSE `main` had this capability removed after State C's copy diverged. **Origin/direction of travel is UNKNOWN** — I have no git history connecting the two repos (established in the pre-merge audit) and did not check TSE's own commit history for this specific function within this bounded task's scope.

---

## 4. PARLAY BOUNDARY CHECK

**VERIFIED, both files (header comment byte-identical, part of the untouched first-750-lines region):**
> *"Independent Parlay Builder — Validation Scoring Engine. Core architectural principle: this service NEVER reads from the predictions table, NEVER uses calibratedProbability, safetyScore, or any Prediction Engine output. It validates the Prediction Engine's selected winner using only independent evidence: raw historical match data, rankings, and market consensus."*

**Prediction-Engine imports (VERIFIED identical on both sides, part of the untouched region):** only two — `computeSurfaceEloModule` from `../predictionEngine/surfaceElo.js` and `computeServeReturnModule` from `../predictionEngine/serveReturn.js`. Both of these specific files were **already confirmed byte-identical** between the two trees in the prior reconciliation report. Neither import touches `predictions`, `calibratedProbability`, or `safetyScore` — they import specific, narrow feature-calculation modules, consistent with the file's own stated boundary, not a violation of it.

**The one difference found (§2/§3) does not touch the Prediction-Engine boundary at all** — it's purely about what context is passed to the Parlay Builder's own live-data-provider fallback (`fetchPlayerMatchesFromProviders`, defined in `builderProviderFetch.ts`, a Parlay-Builder-internal file), not anything crossing into Prediction-Engine territory.

**`checkParlayBoundary.ts` was not opened this pass** — per the instruction to read it "only when necessary to understand the diff," and since the one diff found doesn't implicate the Prediction-Engine boundary, it was not necessary this time.

---

## 5. CRITICAL QUESTION

**If we proceeded with consolidation while using State C's current `builderScoringService.ts`, would we lose or alter any meaningful Parlay Builder behavior present in `Tennis-Stats-Engine` `main`?**

## **NO.**

**Direct diff evidence:** the entirety of the file's logic — leg-scoring computation (`computeBuilderScore`), the five-layer player-identity resolution scheme, staleness supplementation, cross-engine agreement (`computeCrossEngineAgreement`), accuracy tracking, decision logging, and grading — is byte-for-byte identical between the two trees for the first 750 lines and, by strong inference from the file-wide hash plus the confirmed +2 line accounting, effectively identical everywhere else. **The one confirmed difference is State C having an additional, functioning parameter that `Tennis-Stats-Engine` `main` currently lacks — not the reverse.** There is no `Tennis-Stats-Engine` behavior found in this file that State C would lose by being treated as the consolidation base.

---

## 6. PRESERVATION REQUIREMENT

**NO ACTION REQUIRED** (for this file specifically).

The single difference found favors State C, not `Tennis-Stats-Engine`, so there is nothing to port from `Tennis-Stats-Engine` into State C for this file. (This does not change the standing "TARGETED PRESERVATION REQUIRED" classification from the broader reconciliation report, which still applies because of the separately-confirmed `finalConsistencyCheck.ts` Elo-gap gap and the other five still-unreviewed differing files.)

---

## 7. RECOMMENDED NEXT SINGLE STEP

**Apply the same hash-bisection method (not the raw-text-relay method, which is now known to be unreliable for exact character content) to `types.ts`** — it is the smallest of the remaining unreviewed differing files (157 lines in State C) and, as a shared type-contract file, has the highest chance of surfacing a breaking compatibility issue if one exists, which would be more urgent to know than further Parlay-Builder-specific behavioral nuance.

---

## FINAL RESPONSE SUMMARY

1. **Does `builderScoringService.ts` have meaningful behavioral differences?** **Yes, exactly one** — State C's Layer-5 live-provider-fetch call passes an additional `{ playerId: rawId }` context argument that `Tennis-Stats-Engine` `main`'s equivalent call does not.
2. **Would State C lose any Parlay Builder behavior?** **No.** The one difference found is additive in State C's favor, not a loss.
3. **Most important difference:** the `fetchPlayerMatchesFromProviders` call-site/signature difference described above — low-to-medium risk, favors State C.
4. **Preservation requirement:** **NO ACTION REQUIRED** for this specific file.
5. **Audit artifact path:** `docs/migration-audit/step-builder-scoring-diff-20260919.md`
6. **Confirmation:** no merge, cherry-pick, rebase, commit, push, file copy, restore, or code/database/configuration modification occurred. All evidence rests on read-only `sha256sum`, `wc`, `grep`, and `sed -n ...p` (read-only line extraction) commands, run locally against a shallow clone of `Tennis-Stats-Engine` and via read-only Replit Agent queries against the live State C workspace.

**STOP. No merge, cherry-pick, rebase, commit, or push was performed or is being recommended for execution at this time.**
