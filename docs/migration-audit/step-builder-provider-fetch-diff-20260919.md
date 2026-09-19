# `builderProviderFetch.ts` — DEPENDENCY AUDIT FOR THE `builderScoringService.ts` FINDING

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Scope:** `artifacts/api-server/src/services/parlayBuilder/builderProviderFetch.ts`, tracing the `_context`/`playerId` capability found in the prior `builderScoringService.ts` report back to its source. **Methodology: SHA-256/`wc -l` identity plus `grep`-only structural comparison — no reliance on relayed multi-line/generic-type text for exact content, consistent with the corrected methodology from the `types.ts`/`builderScoringService.ts` reports.** No code, database, or configuration was modified. No merge, cherry-pick, commit, or push occurred.

---

## HEADLINE — this is bigger than the prior report suggested

The prior `builderScoringService.ts` report characterized the `{ playerId: rawId }` difference as "State C has one additional parameter." **That undersold it.** State C's `builderProviderFetch.ts` contains an **entire additional data-provider tier — a "Live Tennis API" integration (`attemptLiveTennis`, `getBuilderLiveTennisProvider`, backed by a real module `tennisData/liveTennisFixturesProvider.ts`) — that does not exist anywhere in `Tennis-Stats-Engine`'s current `main`.** The `playerId` context field exists specifically to support this tier's player-identity-based lookup. This is substantial, wired, working functionality unique to State C, not a stray parameter.

---

## 1. Byte-Identical?

**NO.**

| | `Tennis-Stats-Engine` | State C |
|---|---|---|
| Line count | **648** (VERIFIED, local `wc -l`) | **788** (VERIFIED, Agent `wc -l`) — **140 lines longer** |
| SHA-256 | `70b2d35d7f46881d40350ce83cfed3226304dc937cbe73a5f4a7b992eca14951` | `be5b1a478f7cbd1ff06b6000ac5eb8aff237810b70cbedf18db8e0951be6461c` |

**140 lines is a large, structural difference — not a small edit.** Given the scope of this task (tracing the specific `_context`/`playerId` dependency, not a full byte-level bisection of every line), the structural `grep` comparison below fully explains the size difference without needing line-by-line hash bisection of the whole file.

---

## 2. Every Real Differing Region, Precisely Bounded (via structural `grep`, VERIFIED)

**`Tennis-Stats-Engine`'s exports/functions (12 total, lines 50–575):** `ResolutionOutcome`, `ProviderSourceDiagnostic`, `LiveFetchDiagnostics`, `LiveFetchResult`, `getBuilderRapidApiProvider`, `getBuilderApiTennisProvider`, `describeProviderError`, `saveMatchesToDb`, `attemptRapidApi`, `attemptMatchstat`, `attemptSofascore`, `attemptOddsApi`, `BuilderProviders`, `fetchPlayerMatchesFromProviders`.

**State C's exports/functions (17 total, lines 52–699) — VERIFIED via Agent `grep`, same command:** all 12 of the above **plus five new ones**:
- `getBuilderLiveTennisProvider()` (line 121) — **NEW**
- `normalizePlayerName(value: string): string` (line 213) — **NEW**
- `attemptLiveTennis(...)` (line 222) — **NEW**
- (the pre-existing functions are otherwise in the same relative order, shifted later by the insertion)

**Precisely bounded region:** the new material occupies roughly lines 119–334 in State C's numbering (from `getBuilderLiveTennisProvider` through the end of `attemptLiveTennis`, given `attemptRapidApi` starts at line 335 in State C vs. 213 in TSE — a ~122-line insertion, consistent with the 140-line total file-length difference once the smaller `_context`/`playerId` field addition and related call-site changes are also counted).

---

## 3. Function Signatures and Behavior on Each Side

**`fetchPlayerMatchesFromProviders` signature:**
- **TSE:** `fetchPlayerMatchesFromProviders(playerName: string, _context?: { opponentName?: string; tournamentName?: string }, _providers?: Partial<BuilderProviders>): Promise<LiveFetchResult>`
- **State C:** `fetchPlayerMatchesFromProviders(playerName: string, _context?: { playerId?: string; opponentName?: string; tournamentName?: string }, _providers?: Partial<BuilderProviders>): Promise<LiveFetchResult>` — **adds `playerId?: string` to the context object.**

**Behavioral difference in the function body (VERIFIED, read directly for TSE, `grep`-confirmed for State C):**
- **TSE** resolves providers as: RapidAPI, API-Tennis, Sofascore (3 sources, `sourcesConfigured` built from just these).
- **State C** resolves providers as: **Live Tennis API (NEW, Tier 1)**, then RapidAPI, API-Tennis, Sofascore — `sourcesConfigured` in State C pushes `"live-tennis"` first when `effectiveLiveTennis` is truthy, before the other three. State C's function body explicitly comments this as **"── Tier 1: Live Tennis API — source identity + completed history ────────"** and calls `attemptLiveTennis(playerName, _context?.playerId, diag, effectiveLiveTennis)` — **directly consuming the new `playerId` context field** — before falling through to the same RapidAPI/API-Tennis/Sofascore chain TSE has.

---

## 4. Is State C's `_context`/`playerId` Capability Genuinely Unique and Functional?

**YES — confirmed, not speculative.** It is:
- **Wired into a real, non-stub function** (`attemptLiveTennis`, a full `async function` at line 222, not a placeholder).
- **Backed by a real, separately-existing module** (`tennisData/liveTennisFixturesProvider.ts`), confirmed to have its own dedicated test file (`liveTennisFixturesProvider.test.ts`) and to be consumed by other parts of State C's `tennisData` layer independently of the Parlay Builder (`tennisData/compositeProvider.ts` + its test, `tennisData/index.ts`) — this is not code invented solely for this one call site.
- **Actively prioritized as "Tier 1"** — the first provider attempted, ahead of the three providers both trees share.

---

## 5. Why Does `builderScoringService.ts` Pass `{ playerId: rawId }` in State C But Not TSE?

**Answered directly, not inferred:** because State C's `fetchPlayerMatchesFromProviders` signature has a `playerId` field in its context parameter *specifically* to support the Live-Tennis-API tier's `attemptLiveTennis(playerName, _context?.playerId, ...)` call — which uses the player ID for "source identity" resolution (per State C's own inline comment) before falling back to name-based matching in the shared-with-TSE providers. **TSE's version has no `playerId` field because TSE has no Live-Tennis-API tier to consume it.** This is a complete, closed explanation — not a remaining unknown.

---

## 6. Callers of `fetchPlayerMatchesFromProviders()` in Both Trees

**VERIFIED identical caller set in both repos** (`grep -rln` across `artifacts/api-server/src/`): exactly three files reference it in each tree —
1. `builderProviderFetch.ts` itself (the definition)
2. `builderProviderFetch.test.ts` (its own tests)
3. `builderScoringService.ts` (the one production caller, already covered in the prior report)

**No other caller exists in either tree.** The blast radius of this difference, in terms of *call sites*, is fully contained to the file pair already under audit.

---

## 7. Does the Difference Affect Player Identity Resolution, Provider Selection, Scoring, Duplicate Handling, or Prediction Behavior?

| Area | Affected? | How |
|---|---|---|
| **Provider selection** | **YES, directly** | State C attempts an entire additional data source (Live Tennis API) before the three TSE shares; TSE cannot attempt this source at all since the code doesn't exist there |
| **Player identity resolution** | **YES, plausibly** | The Live Tennis API tier is explicitly commented as providing "source identity + completed history" — suggesting it may resolve player identity more reliably (via `playerId`) than the name-based matching the shared providers use. Not confirmed in detail (would require reading `attemptLiveTennis`'s full body, not done — see §9) |
| **Scoring** (`computeBuilderScore` itself) | **Indirectly, if at all** | The scoring function consumes `MatchRow[]` regardless of which provider tier produced them; if Live Tennis API returns different/better/more-complete match history than the shared providers would for the same player, scores could differ, but the scoring logic itself is unchanged (confirmed byte-identical in the prior report for the surrounding 750+ lines of `builderScoringService.ts`) |
| **Duplicate handling** | **UNKNOWN** — not traced this pass; would require reading `attemptLiveTennis`'s and the shared `saveMatchesToDb`'s interaction, not done here |
| **Prediction behavior (Prediction Engine)** | **NO** — this is entirely within the Parlay Builder's own provider-fetch layer; the parlay-independence boundary (confirmed intact in the prior report) is not touched by this difference |

---

## 8. What Must Ultimately Be Preserved/Reconciled (not changed now)

**State C's Live-Tennis-API tier (`getBuilderLiveTennisProvider`, `attemptLiveTennis`, `normalizePlayerName`, the `playerId` context field, and the underlying `tennisData/liveTennisFixturesProvider.ts` module) must be preserved.** This is real, functioning, tested, broadly-integrated capability. **If any future reconciliation treated `Tennis-Stats-Engine`'s `main` as the authoritative version of this file, it would silently delete a working data source from State C's Parlay Builder** — this is precisely the kind of loss this audit exists to catch before it happens. No decision is being made here about *how* to reconcile it (e.g., whether TSE's `main` should be updated to add this capability, or whether State C's version should simply be kept as-is) — only that it must not be discarded.

---

## 9. Additional Files That Must Subsequently Be Compared

Because of this dependency, the following are now flagged as requiring their own comparison before this area of the consolidation can be considered closed:

1. **`tennisData/liveTennisFixturesProvider.ts`** (+ its test file) — the actual provider implementation backing this capability. **Highest priority**: does this file even exist in `Tennis-Stats-Engine`'s tree at all, or is it entirely State-C-only?
2. **`tennisData/compositeProvider.ts`** (+ its test file) — confirmed to also reference `LiveTennisFixturesProvider`/`attemptLiveTennis`-adjacent symbols in State C; unknown whether `Tennis-Stats-Engine`'s `compositeProvider.ts` has any equivalent.
3. **`tennisData/index.ts`** — also confirmed to reference this provider; same open question.
4. **`builderProviderFetch.test.ts`** — not yet compared; would show whether the Live-Tennis-API tier has dedicated test coverage at the Parlay-Builder-integration level (beyond `liveTennisFixturesProvider.test.ts`'s own unit tests).

None of these four were opened this pass — flagging them as the concrete next steps, not silently assuming their status.

---

## FINAL SUMMARY

1. **Byte-identical?** No — 140 lines longer in State C, hash-confirmed different.
2. **Every real differing region:** one contiguous, large insertion (~122 lines) adding a full "Live Tennis API" provider tier (`getBuilderLiveTennisProvider`, `normalizePlayerName`, `attemptLiveTennis`) plus the `playerId` context field and its Tier-1 call-site wiring — fully explaining the file-size difference.
3. **Is State C's capability genuinely unique and functional?** **Yes** — wired into a real function, backed by a real module used elsewhere in State C's codebase, not a stub.
4. **Why does `builderScoringService.ts` pass `playerId` in State C but not TSE?** Because State C's Live-Tennis-API tier consumes it for identity-based lookup; TSE has no such tier.
5. **Callers of `fetchPlayerMatchesFromProviders`:** identical set (3 files) in both trees — no wider blast radius from call sites alone.
6. **What's affected:** provider selection (directly), plausibly player-identity resolution; not prediction behavior or the parlay-independence boundary.
7. **What must be preserved:** State C's entire Live-Tennis-API integration — a real capability that would be silently lost if `Tennis-Stats-Engine`'s version of this file were ever treated as authoritative without accounting for this.
8. **New files requiring comparison:** `tennisData/liveTennisFixturesProvider.ts` (+test), `tennisData/compositeProvider.ts` (+test), `tennisData/index.ts`, `builderProviderFetch.test.ts` — none opened this pass.
9. **Nothing was fixed, copied, merged, or modified.** All structural findings rest on `grep`/`wc -l`/`sha256sum` evidence.

**STOP after this file, per instruction. No merge, cherry-pick, rebase, commit, or push was performed or is being recommended for execution at this time.**
