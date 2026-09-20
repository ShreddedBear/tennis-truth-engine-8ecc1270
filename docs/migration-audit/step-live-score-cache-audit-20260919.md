# LIVE-SCORE CROSS-PROVIDER CORRELATION (`TtlCache`/`fixtureMetaCache`) — AUDIT

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Scope:** `tennisData/cache.ts`, all `TtlCache` usages, `fixtureMetaCache`, the `getLiveScoresByIdentity` mechanism, and its test coverage — State C vs. `Tennis-Stats-Engine`. **No source, database, or configuration was modified. No merge, cherry-pick, commit, push, copy, or deployment change occurred.**

**CORRECTION TO THE PRIOR REPORT, stated plainly:** the prior report characterized this capability as untested ("no dedicated test suite found"). That was incomplete — I had only checked `compositeProvider.test.ts`. **A separate, dedicated test file (`compositeProvider.liveScoresIdentity.test.ts`) exists in `Tennis-Stats-Engine` with three real, substantive test cases.** This feature is regression-tested; I simply hadn't found the right file yet. Correcting this now rather than letting the earlier, weaker claim stand.

---

## 1. Scope

Confirmed and not expanded beyond what Step 5's search required (a few targeted `grep`s for hidden/renamed equivalents in State C, all negative).

---

## 2. Cache File Comparison

| Component | TSE | State C | Status |
|---|---|---|---|
| `tennisData/cache.ts` | 41 lines, SHA-256 `37dc52dc...` | 41 lines, SHA-256 `37dc52dc...` | **BYTE-IDENTICAL — VERIFIED** |
| `TtlCache` class itself | Present, unmodified | Present, unmodified | Same file, same hash |
| `compositeProvider.liveScoresIdentity.test.ts` | 146 lines, SHA-256 `80c62772...` | **NOT FOUND** (`find` returned empty) | **State-C-absent** |
| `getLiveScoresByIdentity` (in `types.ts`, `apiTennisProvider.ts`) | Present (interface + implementation) | **NOT FOUND** (`grep` returned empty for both files) | **State-C-absent** |

**Headline finding: the `TtlCache` utility itself was never touched, removed, or replaced.** It is byte-for-byte identical between the two trees. **What's missing from State C is one specific application of it** — the live-score cross-provider correlation feature built on top of it — not the utility itself.

---

## 3. `TtlCache` Inventory — Actual Callers (not assumed to be live-score-only)

**VERIFIED via `grep -rln "TtlCache"` across `artifacts/api-server/src/`, both trees:**

| Caller | In TSE? | In State C? |
|---|---|---|
| `tennisData/cache.ts` (definition) | Yes | Yes |
| `jobs/runPaperTradingJob.ts` | Yes | Yes |
| `oddsData/theOddsApiProvider.ts` | Yes | Yes |
| `oddsData/oddsApiIoProvider.ts` | Yes | Yes |
| `tennisData/matchStatProvider.ts` (+ its test) | Yes | Yes |
| `tennisData/apiTennisProvider.ts` | Yes | Yes |
| `tennisData/compositeProvider.ts` | **Yes** | **No** |

**The caller lists are identical except for exactly one file: `compositeProvider.ts`.** `TtlCache` is a general-purpose rate-limiting/caching utility used across paper-trading jobs, odds providers, and individual tennis-data providers in both trees equally — **it was never `TtlCache`-specific functionality that went missing; it's specifically the one usage inside `compositeProvider.ts` (the `fixtureMetaCache` instance) that never made it into State C's rewrite.**

---

## 4. `fixtureMetaCache` Data Flow (TSE only — confirmed absent from State C)

- **Declaration:** `private readonly fixtureMetaCache = new TtlCache();` inside `CompositeTennisProvider`.
- **What it stores:** a `FixtureMeta` record — `{ date: string; player1Name: string; player2Name: string }` — keyed by whatever fixture `id` string was actually handed to the caller (which may be the primary's own ID format, the fallback's, or a tertiary tier's like Sofascore's `sf-fixture-*`).
- **Written:** on every `getUpcomingFixturesRange` call, for **every** fixture returned, regardless of which tier (primary/fallback/Sofascore) actually served it: `for (const f of fixtures) { this.fixtureMetaCache.set<FixtureMeta>(f.id, {...}, FIXTURE_META_TTL_MS); }`.
- **TTL:** `FIXTURE_META_TTL_MS = 8 * 60 * 60 * 1000` (8 hours) — per its own comment, "generous relative to a real match's maximum duration... plus slack for how long a client might keep polling."
- **Read:** inside `getLiveScores(fixtureIds)`, only for whichever ids the fallback's own native `getLiveScores` call did **not** resolve (`unresolved = fixtureIds.filter(id => !result.has(id))`).
- **Expiration:** handled by `TtlCache.get()` itself (VERIFIED, read in `cache.ts`) — an entry past its `expiresAt` is deleted and treated as absent; **no separate/duplicated expiration logic in `compositeProvider.ts`**.
- **If missing (cache miss or expired):** that specific unresolved id is simply excluded from the identity-lookup batch — no error, no fallback value fabricated. Confirmed by the third test case (§7).
- **Provider disagreement:** not directly applicable — this cache doesn't reconcile *conflicting* data between providers, it only bridges *identity* so a request for one provider's-native ID can be re-expressed in date+name terms for a second provider to search by.
- **Affects only live scores, or other operations too?** **Only live scores.** No other method (`getPlayerMatches`, `searchPlayers`, `getHeadToHead`, etc.) reads or writes `fixtureMetaCache`, confirmed by the full-file read performed in the prior report.

---

## 5. Live-Score Correlation Flow — Full Trace (VERIFIED, read directly)

```
getUpcomingFixturesRange() called
  → fixtures returned from whichever tier served them (primary/fallback/Sofascore)
  → EVERY fixture's {date, player1Name, player2Name} written to fixtureMetaCache, keyed by its id
      (8-hour TTL)

[... later, client requests live scores for some subset of those ids ...]

getLiveScores(fixtureIds) called
  → result = fallback.getLiveScores(fixtureIds)   // native event_key lookup; ApiTennisProvider's
                                                    // own implementation, fetches a cached
                                                    // yesterday-to-tomorrow window, filters by id
  → unresolved = ids not present in result
  → for each unresolved id: look up fixtureMetaCache.get(id) → FixtureMeta {date, names} or undefined
  → identities = unresolved ids that DID have cached metadata
  → byIdentity = fallback.getLiveScoresByIdentity(identities)
      → ApiTennisProvider fetches (or reuses its cached) live window
      → builds a lookup keyed by buildMatchIdentityKey(event_date, event_first_player, event_second_player)
        — i.e., matched by CALENDAR DATE + NORMALIZED PLAYER NAMES, never by ID
      → for each requested identity, looks up by that composite key, returns a map
        keyed by the CALLER's original id (not API-Tennis's own event_key)
  → merge byIdentity results into result
  → return result
```

**Exactly where `fixtureMetaCache` changes behavior:** it is the *only* mechanism that lets a fixture originally listed by a non-`fallback` tier (primary/RapidAPI or Sofascore) still get a live score from the fallback (API-Tennis), by translating "an ID API-Tennis has never seen" into "a date+names API-Tennis's own live window can be searched by." **Without it, `getLiveScores` would return no live score for any fixture whose ID doesn't happen to already be an API-Tennis `event_key`.**

**State C's `getLiveScores`:** confirmed in the prior report — a bare one-liner, `return this.fallback.getLiveScores(fixtureIds);` — **no correlation attempt of any kind.** Classification: **NO EQUIVALENT LOGIC**, not "different logic" or "partial logic" — the capability is simply absent, not reimplemented differently.

---

## 6. State C Equivalent Search — Result: Never Ported (Category E)

**VERIFIED, all negative results, across `artifacts/api-server/src/`:**
- `TtlCache` used in `compositeProvider.ts`: **NOT FOUND**
- `fixtureMetaCache`: **NOT FOUND**
- `fixtureCorrelat*`, `scoreCorrelat*`, `providerCorrelat*`, `liveScoreMeta*`, `FixtureMeta` (word-boundary): **NOT FOUND anywhere**
- `getLiveScoresByIdentity`: **NOT FOUND** in `types.ts` or `apiTennisProvider.ts` (the two places it would need to exist for this feature to work at all)
- `compositeProvider.liveScoresIdentity.test.ts`: **NOT FOUND**

**Classification: E — never ported.** Not A (removed — there's nothing to remove, since State C's `compositeProvider.ts` was substantially rewritten around Live Tennis integration rather than incrementally modified from a version that once had this), not B (renamed — no similarly-purposed symbol under any other name was found), not C (replaced — no alternative correlation mechanism was found), not D (moved — not found anywhere else in the searched tree).

---

## 7. Test Coverage — Corrected From the Prior Report

**`compositeProvider.liveScoresIdentity.test.ts` (TSE only, 146 lines, read structurally — test names, not full assertion bodies):**

1. `"resolves a live score for a primary-sourced (MatchStat) fixture id via identity, not id equality"` — the core positive case: a fixture ID from the *primary* tier still gets a live score via the fallback's identity-based lookup.
2. `"prefers the native id-based result and never calls getLiveScoresByIdentity for ids already resolved"` — proves the optimization: no wasted identity-lookup calls for ids the native path already resolved.
3. `"returns an empty map (not throw) for an id with no cached identity metadata and no native match"` — proves graceful degradation when `fixtureMetaCache` has no entry (expired or a never-listed id).

**Classification: implementation exists AND is exercised AND is regression-tested** — all three, on the TSE side. **On the State C side: none of the three apply, because the implementation itself doesn't exist to test.**

---

## 8. Migration Impact

| Behavior | TSE | State C | Classification | Risk |
|---|---|---|---|---|
| `TtlCache` utility itself | Present, byte-identical | Present, byte-identical | **NO ACTION REQUIRED** | None — already identical |
| Live-score identity correlation (`fixtureMetaCache`, `getLiveScoresByIdentity`, the full flow in §5) | Present, tested | **Absent entirely** | **MUST TRANSFER** (if the goal is zero functional loss) or **PRESERVE DISTINCT / accept the gap** (if State C's simpler behavior is an acceptable, deliberate simplification — not determined by this audit, which only documents, per instruction, and does not recommend which) | **MEDIUM.** Concretely: in State C today, a live score request for a fixture whose ID came from any tier other than the `fallback` (API-Tennis) provider will return no score for that fixture, even if API-Tennis's own live-score feed actually has it under a different ID. This is a silent gap (empty map, not an error) — consistent with graceful degradation, but a real behavioral regression relative to TSE if TSE's behavior is the intended baseline |
| Live-score identity for **Live-Tennis-sourced fixtures specifically** | N/A (feature doesn't exist in TSE) | N/A (correlation doesn't exist in State C) | **UNKNOWN / not applicable yet** | See §9 — this is a forward-looking interaction question, not a present gap, since Live Tennis fixtures in State C would hit the same "no correlation at all" gap as fixtures from any other tier |
| Stale/expired metadata handling | `TtlCache.get()`'s built-in expiry (delete-on-read-if-expired), tested indirectly via test #3 | N/A | **NO ACTION REQUIRED** for the utility; **N/A** for the feature since it doesn't exist to have stale data | None for the utility |
| Duplicate fixtures | Not applicable — this cache is about ID-to-identity translation for scores, not fixture deduplication (which happens elsewhere, in each provider's own list-building) | Same (not applicable) | **NO ACTION REQUIRED** | None |
| Cross-provider consistency for live scores specifically | Handled by identity correlation | **Not handled at all** | **MUST TRANSFER** (same reasoning as row 2) | **MEDIUM**, same as row 2 |

---

## 9. Identity/Provenance Interaction (State C's Live Tennis namespace × TSE's correlation system)

**Analyzed, not fixed, per instruction.**

- TSE's correlation matches **by calendar date + normalized player names**, never by ID or ID prefix (`buildMatchIdentityKey(date, player1Name, player2Name)`). **This means the mechanism is, by construction, orthogonal to State C's `live-tennis-player-*` ID-namespace guard** — one operates on names, the other on ID prefixes. **No direct ID-collision risk was found between the two systems as designed.**
- **The real interaction risk is not collision but incompleteness, if this feature were ever ported into State C's current `compositeProvider.ts` without also updating it for the Live Tennis tier:** the population step (`for (const f of fixtures) { fixtureMetaCache.set(...) }`) happens inside `getUpcomingFixturesRange` for *whichever* fixtures are returned. In State C's current fixture-tier order (Live Tennis → API-Tennis → RapidAPI → Sofascore, confirmed in the prior report), if Live-Tennis-sourced fixtures were included in that population step, a later live-score request for a `live-tennis-*`-prefixed ID would attempt identity correlation against **API-Tennis's own live window** via `getLiveScoresByIdentity` — which is plausible and likely intentional (API-Tennis may well have live scores for the same real-world match Live Tennis listed as a fixture), **but this was never built or tested for that specific combination**, since neither the correlation system nor its interaction with Live-Tennis-sourced fixtures exists yet in either tree simultaneously.
- **Provenance loss risk:** none identified — the correlation result map is keyed by the caller's original id, so whichever tier originally served the fixture remains the identity of record; only the *score* is sourced from a second provider, and that's `fallback`/API-Tennis in both the tested TSE case and the hypothetical State C case, so no new provenance ambiguity is introduced beyond what TSE's existing tested design already accepts.
- **Duplicate-match risk:** not found — the identity key is deliberately narrow (exact date + exact name match against API-Tennis's own window), which is the same specificity TSE already relies on and tests (test #1 explicitly validates a real cross-tier match, implying false-positive collisions on distinct real matches were already a design concern the original author addressed by using both date AND full names, not just one).

**Conclusion: combining the two systems appears structurally safe by design (orthogonal keying strategies), but the combination has never actually been built or tested, so this is an informed assessment based on how each system is keyed, not a verified-safe integration.**

---

## 10. Unknowns / Limitations

- **The standing shallow/single-branch-clone limitation is explicitly retained**, unchanged from every prior report: whether State C ever had an equivalent correlation system that was removed during its `compositeProvider.ts` rewrite, or whether `Tennis-Stats-Engine`'s other 25 branches contain any variant of this feature, cannot be determined from the local clone available this session.
- The full assertion bodies of `compositeProvider.liveScoresIdentity.test.ts`'s three tests were not read line-by-line (only their `describe`/`it` names and the surrounding implementation code, which together make their intent clear) — exact mock/stub setup details were not verified.
- Whether any other consumer of `TennisDataProvider` (beyond `ApiTennisProvider`) implements `getLiveScoresByIdentity` in either tree was not checked — the optional-method contract (`types.ts` line 246) permits multiple implementers, only one (`ApiTennisProvider`) was confirmed.
- The actual observed frequency/impact of the "no live score for a non-fallback-native fixture ID" gap in State C's real production traffic was not measured (would require live telemetry, out of scope for a read-only Phase 1 audit).

---

## 11. Recommended Next Single Step

**Confirm whether `MatchStatProvider` (State C's `primary` tier) implements `getLiveScores` at all, and whether it ever actually returns non-empty results** — per TSE's own code comments (*"MatchStat (primary) does not provide live scores — hard-route to API-Tennis"*), the primary tier may not serve live scores in either tree regardless of this correlation system, which would somewhat narrow (though not eliminate) the practical impact of State C's missing correlation logic to specifically Sofascore-and-future-Live-Tennis-sourced fixture IDs, not primary-sourced ones. This is the smallest next check that would sharpen exactly how much practical impact the confirmed gap actually has, without expanding into a new file's full audit.

---

## FINAL RESPONSE SUMMARY

1. **What `TtlCache` actually does:** a small, generic, in-memory (non-durable) TTL-based key/value cache with `get`/`set`/`getOrFetch` — used across 7 files in both trees for general API rate-limiting/caching, entirely unrelated to live scores in most of its uses.
2. **What `fixtureMetaCache` actually protects:** it's one specific `TtlCache` instance (8-hour TTL) inside TSE's `CompositeTennisProvider`, remembering each fixture's real-world identity (date + player names) so a later live-score request for that fixture's ID — regardless of which tier originally served it — can still be resolved against API-Tennis's live-score feed via name+date matching, not just native ID lookup.
3. **Does State C have equivalent functionality?** **No — confirmed absent entirely** (the `TtlCache` utility itself is present and byte-identical, but this specific application of it, its shared-contract method, its provider implementation, and its dedicated test file are all missing). Classification: **never ported (category E)**, not removed, renamed, replaced, or moved.
4. **What would be lost without reconciliation?** The ability to return a live score for any fixture whose ID didn't originate from the `fallback`/API-Tennis tier — concretely, fixtures served by RapidAPI/MatchStat or Sofascore (and, going forward, potentially Live Tennis) would silently get no live score even if API-Tennis's own feed has one, under a different ID.
5. **Test-coverage status:** **corrected from the prior report — this feature IS regression-tested in TSE**, via `compositeProvider.liveScoresIdentity.test.ts` (3 real test cases), a file I had not located in the previous pass. No equivalent tests exist in State C because there's no implementation to test.
6. **Migration classification:** the `TtlCache` utility itself — **NO ACTION REQUIRED** (already identical). The live-score correlation feature built on it — **MUST TRANSFER** if zero functional loss is the goal, with **MEDIUM** risk if left unreconciled (a real but silent, non-crashing behavioral gap).
7. **Audit artifact path:** `docs/migration-audit/step-live-score-cache-audit-20260919.md`
8. **Confirmation:** no merge, cherry-pick, rebase, commit, push, file copy, restore, or code/database/configuration modification occurred. All hash/existence claims rest on direct `sha256sum`/`wc -l`/`find`/`grep` evidence; file content quoted in §5 was read directly from local disk (TSE) or via `read_app_file`/targeted `grep` (State C, where applicable — no relevant State C content existed to quote, since the feature is confirmed absent).

**STOP. No migration, copy, fix, merge, commit, or push was performed or is being recommended for execution at this time.**
