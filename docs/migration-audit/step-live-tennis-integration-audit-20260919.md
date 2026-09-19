# LIVE TENNIS INTEGRATION — IMMEDIATE INTEGRATION LAYER AUDIT

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Scope:** `tennisData/compositeProvider.ts`, `compositeProvider.test.ts`, `tennisData/index.ts`, `tennisData/types.ts` — State C vs. `Tennis-Stats-Engine`. **All four files exist on both sides.** No source, database, or configuration was modified. No merge, cherry-pick, commit, push, copy, or deployment change occurred.

**Methodology:** `compositeProvider.ts` and `index.ts` were read in **full, directly** on both sides (local `cat`/`read_app_file` — raw bytes, not natural-language relay) — every claim about their content below is verbatim-verified, not inferred. `compositeProvider.test.ts` and `types.ts` were compared via `grep`-only structural queries (test/describe names, export declarations) — reliable for these short, single-line matches per the established methodology, but their full bodies were not read line-by-line.

---

## 1. Scope

Confirmed in scope and found not to require expansion beyond what Step 9 identifies as follow-on work.

---

## 2. File Hash Matrix

| File | State C | TSE | Hash Relationship | Status |
|---|---|---|---|---|
| `compositeProvider.ts` | 681 lines, `1f5b89e5...` | 536 lines, `dbdb65b9...` | DIFFERENT | Read in full both sides — substantial, two-directional divergence (§3) |
| `compositeProvider.test.ts` | 227 lines | 201 lines | DIFFERENT | Structural (describe/test names) only — same single suite name on both sides (§5) |
| `index.ts` | 96 lines, `7605139c...` | 90 lines, `78da7602...` | DIFFERENT | Read in full both sides — real architectural difference (§4) |
| `types.ts` | 272 lines, `42f0396c...` | 264 lines, `0af0f185...` | DIFFERENT | Structural (export list) only — one confirmed new interface (§7) |

**No file in this set is byte-identical or missing from either side.**

---

## 3. Composite Provider Architecture — Full Comparison (read in full, both sides)

### Constructor

- **TSE:** `constructor(primary: TennisDataProvider, fallback: TennisDataProvider)` — 2 providers only.
- **State C:** `constructor(primary, fallback, fixturePrimary?: LiveTennisFixturesProvider, bsdHistoryFetcher: BsdHistoryFetcher = fetchFromBsdTennis)` — adds an optional Live Tennis slot and makes BSD's fetcher injectable (test-friendliness improvement).

### `getStatus()`

- **TSE:** checks `primary` → `fallback` → returns `primary` as last resort. No Live Tennis awareness (none exists).
- **State C:** checks `fixturePrimary?.getStatus()` **first** — if connected, returns it immediately, ahead of `primary`/`fallback`. Falls through to the same primary→fallback→(a Sofascore-connected sentinel State C added)→primary logic otherwise. **Real behavioral difference: State C's status reporting can report "Live Tennis API" as the connected/serving provider; TSE cannot, because the concept doesn't exist there.**

### `searchPlayers()`

- **TSE:** a simple `withFallback(primary, fallback)` — tries primary, catches `ProviderUnavailableError`, tries fallback. Two tiers, first-success-wins, no merging.
- **State C:** three tiers — Live Tennis first (explicit comment: *"Keeping its source-issued IDs ahead of ranking-provider IDs prevents an otherwise identical name from being resolved to a different identity space"*), then fallback (API-Tennis), then primary (RapidAPI) — **and merges candidates across tiers by ID** (`Map`-based dedup, `unique.set(candidate.id, candidate)`) rather than stopping at first success. **Real behavioral difference: State C can return combined results from multiple providers for one search; TSE always returns exactly one provider's results.**

### `getPlayerMatches()` — history routing

- **TSE tiers:** 1) primary, 2) fallback (if <5 records), 3) BSD Tennis (if playerName cached), 4) **Sofascore** (`fetchFromSofascore`, if still <5 records and playerName cached), 5) `historical_matches` DB.
- **State C tiers:** 1) **Live Tennis** (only when `playerId.startsWith("live-tennis-player-")` — an explicit identity-namespace guard, with an "unsupported player identity" skip logged otherwise), 2) fallback (if <5 records), 3) BSD Tennis, 4) primary (RapidAPI/MatchStat) — comment notes *"MatchStat does not currently support this operation, but keeping it in the chain makes the capability explicit and preserves future support"* — 5) `historical_matches` DB.
- **Confirmed: State C's history chain does NOT include Sofascore at all** — no `fetchFromSofascore` import exists in State C's `compositeProvider.ts` (VERIFIED — absent from its import list, which was read in full). **TSE has a history-fetching capability (Sofascore tier-4) that State C lacks.** This is a genuine, verified example of the reverse pattern from the Live Tennis finding: **here, TSE has something State C doesn't.**
- Constant renamed: TSE's `SOFASCORE_MIN_RECORDS_THRESHOLD` (=5) → State C's `HISTORY_SUPPLEMENT_THRESHOLD` (=5) — same value, renamed to reflect the broader (non-Sofascore-specific) gating role in State C.
- **New in State C only:** `HistoryRoutingAttempt`/`HistoryRoutingDiagnostics` types and `getHistoryRoutingDiagnostics(playerId)` — a full observability layer recording every tier attempted, its status (`records`/`empty`/`failed`/`skipped`), record counts, and which tier/provider was ultimately selected, per player, with a completion timestamp. **This does not exist in TSE at all.**

### `getUpcomingFixturesRange()` — fixture routing

- **TSE tier order:** primary (RapidAPI/MatchStat) → fallback (API-Tennis) → Sofascore tertiary (inline scraper, both trees share near-identical `fetchSofascoreFixturesForDate`/`fetchSofascoreFixturesRange` helper functions, confirmed by direct read).
- **State C tier order:** Live Tennis (`fixturePrimary`) → **fallback (API-Tennis)** → **primary (RapidAPI/MatchStat)** → Sofascore tertiary. **State C swapped the primary/fallback priority relative to TSE** for this method specifically (comment: *"After Live Tennis, API-Tennis is attempted before RapidAPI/MatchStat"*) — **a real, confirmed behavioral difference independent of the Live Tennis addition.**
- Both sides share the same surface-enrichment post-processing step (`inferSurfaceAndLevel` lookup for null-surface fixtures) — confirmed byte-similar in the portions read.

### `getLiveScores()` — the reverse finding

- **TSE:** maintains a `TtlCache`-backed `fixtureMetaCache` (imported from `./cache`, a module not referenced at all by State C's version), an 8-hour-TTL `FixtureMeta` (date + player names) recorded for every fixture on every `getUpcomingFixturesRange` call. `getLiveScores` uses this cache to correlate fixture IDs that didn't come from the fallback provider's own ID namespace against the fallback's `getLiveScoresByIdentity` capability, so live scores can still be found for fixtures originally served by a different tier (e.g., a Sofascore-sourced fixture ID).
- **State C:** `getLiveScores` is a **simple one-liner** — `return this.fallback.getLiveScores(fixtureIds);` — **no correlation cache, no `TtlCache` import, no `FixtureMeta`, no identity-based lookup fallback.** **CONFIRMED: TSE has a genuine capability here that is completely absent from State C** — cross-provider live-score correlation for fixtures not sourced from the fallback provider's own ID space.

### `getHeadToHead`, `getCompletedMatchesByDateRange`, `findTournamentSurfaceByName`, `getCurrentStandings`

Read in full on both sides — **structurally and behaviorally identical**, modulo the tier-order swap already noted for `withFallback`'s primary/fallback ordering in `getHeadToHead` (State C: primary-then-fallback; TSE: fallback-then-primary — **note this is the OPPOSITE swap direction from `getUpcomingFixturesRange`**, so this is not a single global reordering policy, it's per-method and must be read carefully, not assumed consistent).

### `resolveAliasIds` / `fetchDbHistory` (protected methods)

Byte-similar on both sides — same alias-resolution-via-canonical-identity-index pattern, same DB tier-5 wrapper.

---

## 4. Provider Priority/Fallback Matrix

| Provider | State C Priority (fixtures) | State C Priority (history) | TSE Priority (fixtures) | TSE Priority (history) | Enabled When | Fallback Role |
|---|---|---|---|---|---|---|
| Live Tennis API | 1 (first) | 1 (Live-Tennis-ID players only) | N/A — does not exist | N/A | `Live_Tennis_Api`/`LIVE_TENNIS_API` env var set | Preferred primary when configured; silent skip otherwise |
| API-Tennis (fallback) | 2 | 2 | 2 | 2 | `API_TENNIS_KEY` set (else `NotConfiguredProvider`, both trees) | Always-present tier-2 in both |
| RapidAPI/MatchStat (primary) | 3 | 4 | 1 | 1 | `X_RAPIDAPI_KEY`/`x_rapidapi_key` set | Fixtures tier-3 in State C vs. tier-1 in TSE — **swapped** |
| BSD Tennis | — (fixtures: not used) | 3 (both) | — | 3 | `BSD_TENNIS_API_KEY` (per TSE comment; not independently re-verified this pass) | Same tier position both sides |
| Sofascore | tertiary (both, near-identical inline code) | **4 in TSE only — absent from State C's history chain** | tertiary | 4 | No auth required | Fixtures: same role both sides. History: TSE-only |
| `historical_matches` DB | 5 (both) | 5 (both) | — (not a fixture source) | 5 | Always reachable | Final safety net, both sides |

---

## 5. Test Coverage (`compositeProvider.test.ts`)

**VERIFIED via `grep` for top-level `describe`/`test`/`it` declarations:** both files contain **exactly one** top-level suite — `describe("CompositeTennisProvider — Sofascore tier-3", ...)` — at line 117 (TSE) / 118 (State C), essentially the same position. **No new top-level `describe` block exists in State C for:** the Live Tennis tier, the `getHistoryRoutingDiagnostics` observability layer, the reordered fixture-tier priority, the multi-tier `searchPlayers` merge behavior, or the confirmed-absent `getLiveScores` correlation cache (moot for State C since that capability doesn't exist there to test).

**Classification of test coverage for the items this task asked about:**
- Provider priority: **ABSENT** (not tested by this file on either side beyond the shared Sofascore-tier-3 suite)
- Live Tennis selection: **ABSENT**
- Fallback: **PARTIAL** (only the Sofascore-tertiary-fallback path is covered; the Live-Tennis→fallback and fallback→primary fixture paths are not)
- Unavailable-provider handling: **UNKNOWN** — the internal content of the shared Sofascore-tier-3 suite was not read line-by-line this pass; it may incidentally cover some `ProviderUnavailableError` handling as part of testing the Sofascore fallback trigger, but this wasn't confirmed
- Duplicate resolution: **ABSENT** (the `searchPlayers` cross-tier merge-by-ID behavior has no dedicated test found)
- Player identity: **ABSENT** (the `live-tennis-player-` prefix guard in `getPlayerMatches` has no dedicated test found)
- Fixture identity, provenance: **ABSENT**
- Partial provider responses: **UNKNOWN**, same caveat as unavailable-provider handling

**This is a real, concrete test-coverage gap** in State C — substantial new routing/observability logic was added to `compositeProvider.ts` without a corresponding new test suite in its dedicated test file. (Whether this logic is tested indirectly elsewhere — e.g., in `builderProviderFetch.test.ts` or integration tests — was not checked this pass.)

---

## 6. Environment/Configuration Requirements (variable names only — no values seen or reported)

| Variable | Used by | Present in TSE? |
|---|---|---|
| `API_TENNIS_KEY` | Both trees, `index.ts` | Yes |
| `X_RAPIDAPI_KEY` / `x_rapidapi_key` | Both trees, `index.ts` (dual-cased for a documented historical rename) | Yes |
| `Live_Tennis_Api` / `LIVE_TENNIS_API` | State C only, `index.ts` | No |
| `BSD_TENNIS_API_KEY` | Referenced in TSE's inline comment for its BSD tier gating; not independently re-verified in `index.ts` itself this pass (BSD's own key-reading likely lives inside `bsdTennisProvider.ts`, not audited this pass) | Comment present in TSE |

---

## 7. Types/Contract Differences

**VERIFIED via `grep -n "^export "` on both files:**

- **TSE:** 17 top-level exports — `Surface`, `MatchFormat`, `TournamentLevel`, `PlayerProfileSource`, `PlayerSummary`, `PlayerProfile`, `MatchStatLine`, `MatchRecord`, `Fixture`, `LiveScoreSet`, `LiveScore`, `HeadToHeadMeeting`, `HeadToHeadRecord`, `HistoricalFixture`, `ProviderStatusInfo`, `ProviderUnavailableError`, `TennisDataProvider`.
- **State C:** the same 17, **plus one new interface: `FixtureFetchDiagnostics`** (line 211) — used by `LiveTennisFixturesProvider.getFixtureFetchDiagnostics()` and by `compositeProvider.ts`'s own `fixtureDiagnostics` field (both confirmed by direct read in the prior and this report).

**Can State C's provider be transferred cleanly into TSE's existing contract, or must the contract be reconciled?** **The contract itself requires a clean, additive change only** — `FixtureFetchDiagnostics` is a wholly new interface, not a modification of an existing one, so adding it to TSE's `types.ts` would not break any existing consumer. **However**, this was confirmed only for the *addition*; whether `TennisDataProvider`'s own interface body differs in some other way between the two trees (e.g., new optional methods to support `getLiveScoresByIdentity`, which TSE's `compositeProvider.ts` calls but which wasn't confirmed to exist in the shared interface vs. being provider-specific) was **not verified this pass** — flagged as an open item, not assumed fine.

---

## 8. Identity & Deduplication Impact

- **`live-tennis-player-${id}` handling — VERIFIED, not inferred:** State C's `getPlayerMatches` has an explicit guard — `const isLiveTennisId = playerId.startsWith("live-tennis-player-"); if (this.fixturePrimary && isLiveTennisId) { ... } else if (this.fixturePrimary) { attempts.push({..., status: "skipped", error: "unsupported player identity"}); }` — **Live Tennis IDs are never sent to other providers' history lookups, and non-Live-Tennis IDs are never sent to the Live Tennis provider.** This is a deliberate, code-enforced identity-namespace boundary, not an accident.
- **Are these IDs canonicalized/mapped/deduplicated downstream?** **UNKNOWN, not traced this pass.** The `resolveAliasIds` method (shared, byte-similar on both sides) resolves a playerId to its canonical form via `getCachedPlayerIdentityIndex()`/`getAliasIds()` — **whether `live-tennis-player-*` IDs are actually registered as aliases in that identity index (i.e., whether `player_aliases`/`canonical_players`, confirmed populated in an earlier DB audit, contain any `provider = 'live-tennis'`-style rows) was not checked.** This is the natural next question and is flagged in §9/§12, not answered here.
- **Can this introduce duplicate players/fixtures?** **For fixtures: mitigated by design** — `getUpcomingFixturesRange` returns **only one tier's fixtures** (whichever tier succeeds first with non-empty results; State C does not merge fixtures across tiers the way it merges `searchPlayers` candidates), so a fixture cannot be duplicated across providers within a single call. **For player search: `searchPlayers` explicitly merges by ID across tiers** (§3) — since each tier's IDs are provider-namespaced, this merge cannot itself produce a naive collision, but it **can produce two entries for the same real-world player under two different provider-namespaced IDs** if that player is found by more than one tier — this is not a bug the code guards against, and whether the downstream canonicalization layer resolves this was not checked.
- **Conflicting identities / incorrect matching:** no evidence of this found; the explicit prefix-based routing guard is specifically designed to prevent it for the history path.
- **Provenance loss:** not found — every tier's diagnostics structure records which provider served the data (`HistoryRoutingDiagnostics.selectedProvider`, `FixtureFetchDiagnostics.provider`).

---

## 9. Freshness/Provenance Impact

**Only verified differences reported, per instruction — no speculation:**
- Live Tennis's own cache TTL is 5 minutes (confirmed in the prior report, from the provider file itself) — shorter than typical fixture-refresh cadences for the shared providers, which were not independently checked this pass for their own cache TTLs.
- Provenance labeling is present and structured on both sides for whichever tier actually serves a request (`FixtureFetchDiagnostics.provider`, `HistoryRoutingDiagnostics.selectedProvider` in State C; TSE's simpler tier-tracking via `usedTier` local variable and its own `fixtureDiagnostics` assignments per tier).
- **No verified difference in fixture timing, completed-vs-scheduled semantics, score formats, rankings, player-name formats, tournament-name formats, or round-label formats was found between the shared providers on both sides** — these were not independently re-diffed this pass (out of the specific four-file scope); nothing here should be read as a confirmed absence of such differences, only that none surfaced from the file-content comparison actually performed.

---

## 10. Migration Classification

| File | Classification | Justification |
|---|---|---|
| `compositeProvider.ts` | **MERGE/RECONCILE** | Genuinely two-directional: State C has Live Tennis integration, `HistoryRoutingDiagnostics`, and multi-tier `searchPlayers` merging that TSE lacks; TSE has the `TtlCache`-based cross-provider live-score correlation (`fixtureMetaCache`) and a Sofascore history tier that State C lacks. Neither side is a strict superset of the other — this cannot be resolved by simply "taking one side," and is not a case of one side having a missing fix (unlike `finalConsistencyCheck.ts` or `index.ts`'s Availability wiring in the Prediction Engine, both single-direction gaps) |
| `compositeProvider.test.ts` | **TARGETED PRESERVATION / FURTHER TEST COVERAGE REQUIRED** *(not one of the ten listed statuses verbatim, but closest fit: this is not itself a functional artifact to transfer — it needs new tests written for State C's untested additions, which is a distinct action from a file-transfer decision)*. If forced into the listed taxonomy: **NO ACTION REQUIRED** for the existing shared Sofascore-tier-3 suite (unchanged in substance, present on both sides), but this is not a statement that the file's *coverage* is adequate — see §5. |
| `index.ts` | **MERGE/RECONCILE** | State C's "always composite" architecture (§4) is a genuine behavioral improvement over TSE's conditional-bare-provider branching (which has a confirmed reachability gap: `historical_matches` DB tier-5 becomes unreachable in TSE when only `API_TENNIS_KEY` is set), but TSE's file is otherwise the simpler, currently-deployed baseline. This isn't "State C is strictly ahead" in a way that makes a one-directional MUST TRANSFER accurate, because TSE's simpler bare-provider path may exist for a reason not investigated here (e.g. resource/latency considerations of always compositing) — reconciliation, not blind adoption, is the correct classification |
| `types.ts` | **MUST TRANSFER** (for the one confirmed addition) | `FixtureFetchDiagnostics` is a clean, additive, non-breaking new interface required for the Live Tennis integration (and already classified MUST TRANSFER) to function; it must travel with that provider. The rest of the file's shared 17 exports need no action beyond confirming (not done this pass) that `TennisDataProvider`'s interface body itself hasn't diverged in some other way |

### Overall Integration Classification: **MERGE/RECONCILE**

Not a simple "transfer State C's version" — TSE's `TtlCache`-based live-score correlation system is real, working infrastructure that would be lost if State C's `compositeProvider.ts` were adopted wholesale without also porting that capability back in.

---

## 11. Additional Required Audits

1. **`tennisData/cache.ts`** (the `TtlCache` module TSE's `getLiveScores` depends on) — needed to fully understand what would be lost if State C's version were adopted as-is.
2. **`parlayBuilder/sofascoreProvider.ts`** (the `fetchFromSofascore` function TSE's history tier-4 calls, and which State C's `builderProviderFetch.ts` also imports separately per the earlier report) — needed to confirm whether State C's own Parlay-Builder-side Sofascore usage is a full substitute for the missing `compositeProvider.ts` history tier, or unrelated.
3. **`bsdTennisProvider.ts`** — shared by both trees for the BSD history tier; not diffed this pass; also the presumed home of `BSD_TENNIS_API_KEY` env var reading (unconfirmed).
4. **`playerIdentity.ts`** (`getCachedPlayerIdentityIndex`, `getAliasIds`) — needed to answer the open §8 question of whether `live-tennis-player-*` IDs are actually registered in the canonical alias system.
5. **`getLiveScoresByIdentity`'s definition** — referenced by TSE's `compositeProvider.ts` on the `fallback` provider but its actual interface location (is it on `TennisDataProvider` itself, or specific to `ApiTennisProvider`?) was not confirmed this pass; relevant to §7's open contract question.

---

## 12. Unknowns / Evidence Limitations

- **The single largest standing limitation, explicitly retained from the prior report: the local `Tennis-Stats-Engine` clone is shallow and single-branch (`main` only).** Nothing in this report establishes whether any of TSE's *other* 25 branches, or `main`'s own deeper history, contain a predecessor to State C's Live Tennis integration, `HistoryRoutingDiagnostics`, or the reverse — a now-removed version of the `fixtureMetaCache`/live-score-correlation system that once existed on State C's side before it diverged. **Absence-within-limited-scope is not proof of absence.**
- Whether `live-tennis-player-*` identities are reconciled into `canonical_players`/`player_aliases` at runtime: unconfirmed.
- Whether `TennisDataProvider`'s interface body itself (beyond the one confirmed new `FixtureFetchDiagnostics` addition) differs between the two trees: unconfirmed.
- The internal content of the one shared `compositeProvider.test.ts` suite (`"CompositeTennisProvider — Sofascore tier-3"`) was not read line-by-line — only its existence and name were confirmed identical; its actual assertions could differ even under the same describe-block name.
- Whether State C's dropped Sofascore-history-tier and TSE's dropped Live-Tennis-tier each have compensating coverage elsewhere in either codebase: not investigated.

---

## 13. Recommended Next Single Step

**Read `tennisData/cache.ts` (TSE) in full** — the smallest, most direct step to determine exactly what the `TtlCache`-based live-score correlation system actually does and how much would be lost if it were never ported to State C, which is the single highest-value open question this report leaves unresolved (the Live Tennis side is now thoroughly documented; the reverse-direction TSE-only capability is not).

---

## FINAL RESPONSE SUMMARY

1. **Is State C's Live Tennis integration fully represented outside the provider file itself?** **Yes, substantially** — `compositeProvider.ts` wires it into `getStatus`, `searchPlayers`, `getPlayerMatches` (with an identity guard), and `getUpcomingFixturesRange`; `index.ts` constructs it from environment configuration and always composites it in; `types.ts` carries its one required new interface (`FixtureFetchDiagnostics`). **But its dedicated test file (`compositeProvider.test.ts`) has no new coverage for any of this.**
2. **Which integration files differ from TSE?** All four target files differ (§2) — none are byte-identical.
3. **Are those differences behavioral?** **Yes, substantially, in both directions** — not cosmetic. State C gains Live Tennis routing, cross-tier search merging, and history-routing diagnostics; TSE retains a cross-provider live-score correlation cache and a Sofascore history tier that State C lacks.
4. **Identity/provenance risks?** Mitigated by design for the history path (explicit ID-prefix guard); a theoretical duplicate-entry risk exists in `searchPlayers`'s cross-tier merge if the same real player is found under two different provider-namespaced IDs, not confirmed as an actual observed problem, and not fixed.
5. **Exact migration classifications:** `compositeProvider.ts` — MERGE/RECONCILE; `compositeProvider.test.ts` — needs new coverage written, not a file-transfer decision; `index.ts` — MERGE/RECONCILE; `types.ts` — MUST TRANSFER (for the one confirmed addition). **Overall: MERGE/RECONCILE**, not a one-directional transfer.
6. **Additional files that must be audited:** `tennisData/cache.ts`, `parlayBuilder/sofascoreProvider.ts`, `bsdTennisProvider.ts`, `playerIdentity.ts`, and confirmation of `getLiveScoresByIdentity`'s contract location.
7. **Audit artifact path:** `docs/migration-audit/step-live-tennis-integration-audit-20260919.md`
8. **Confirmation:** no merge, cherry-pick, rebase, commit, push, file copy, restore, or code/database/configuration modification occurred. All content claims rest on full direct file reads (`cat`/`read_app_file`) for `compositeProvider.ts` and `index.ts`, and `grep`-only structural comparison for `compositeProvider.test.ts` and `types.ts`.

**STOP. No migration, copy, fix, merge, commit, or push was performed or is being recommended for execution at this time.**
