# `tennisData/liveTennisFixturesProvider.ts` — STATE-C-ONLY INFRASTRUCTURE AUDIT

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Scope:** the newly identified State-C-only "Live Tennis API" provider tier, following up on the `builderProviderFetch.ts` finding. **No source, database, or configuration was modified. No merge, cherry-pick, commit, push, or deployment change occurred. Nothing was copied between repositories.**

**Methodology note:** the two main content files (`liveTennisFixturesProvider.ts`, its test file) were retrieved via `read_app_file`, which returns raw file bytes directly — **not** subject to the natural-language relay corruption documented in earlier reports (that issue was specific to `ask_question`'s conversational responses). Content quoted from these two files below is trustworthy verbatim. Everything else (caller wiring, env var names) was obtained via `grep` through `ask_question`, which is reliable for short, single-line plain-text matches (the corruption only affected multi-line comments and generic-type angle brackets in earlier cases).

---

## 1. Does `liveTennisFixturesProvider.ts` Exist Anywhere in `Tennis-Stats-Engine`?

| Location | Result |
|---|---|
| Current `main` (VERIFIED) | **NOT FOUND.** `find . -iname "*liveTennisFixtures*"`, a repo-wide `grep -rl` for `LiveTennisFixturesProvider`/`live-tennis-player`/`liveTennisFixturesProvider`, and `git log --all --oneline --diff-filter=AD -- "*liveTennisFixtures*"` all returned zero results against the local clone. |
| Other branches (25 of 26 total branches on this repo, per Step 0's inventory) | **UNKNOWN — not checked.** My local clone of `Tennis-Stats-Engine` is a `--depth 1 --single-branch` shallow clone of `main` only (established in Step 0 and unchanged since). I have no local access to any other branch's contents. |
| Reachable history on `main` | **UNKNOWN — not checked beyond what a depth-1 clone allows**, i.e., effectively unchecked. A `--depth 1` clone has no ancestor history at all to search. |
| Deleted-file history | **UNKNOWN**, same limitation. |

**I am not claiming absence beyond what was actually checked.** A full answer to "does an equivalent/predecessor/renamed version exist anywhere in `Tennis-Stats-Engine`'s history or other branches" would require either a deeper (`--depth` increased) fetch of `main`, or fetching one or more of the other 25 branches — neither performed this pass, consistent with the resource-conscious framing across this audit. **This is the single largest unresolved question in this report.**

---

## 2. Complete State C Implementation Inventory (VERIFIED — full file read directly)

**File:** `artifacts/api-server/src/services/tennisData/liveTennisFixturesProvider.ts`

- **Exported class:** `LiveTennisFixturesProvider` (the sole export). Constructor takes `apiKey: string`.
- **Public methods:** `getStatus(): ProviderStatusInfo`, `getFixtureFetchDiagnostics(): FixtureFetchDiagnostics | null`, `getUpcomingFixturesRange(dateStart, dateStop, opts?: { bypassCache? })`, `searchPlayers(query: string)`, `getPlayerMatches(playerId: string)`.
- **Provider interface conformance:** consumes and produces the shared `./types` module's `Fixture`, `MatchRecord`, `PlayerSummary`, `ProviderStatusInfo`, `FixtureFetchDiagnostics`, `Surface`, `TournamentLevel`, `ProviderUnavailableError` types — i.e., it implements the **same shared contract** other providers in `tennisData/` use, not a bespoke one-off interface.
- **API endpoints (base `https://api.livetennisapi.com/api/public/v1`):** `GET /fixtures?limit=&offset=` (paginated, up to `MAX_FIXTURE_PAGES = 10` pages of `FIXTURE_PAGE_LIMIT = 200`), `GET /players?search=&limit=&offset=`, `GET /history/matches?player=&limit=&offset=`.
- **Request/response transformations:** `mapFixture`, `mapHistoryMatch`, plus helpers `mapSurface`, `mapLevel` (a substantial tournament-level classifier covering Grand Slams by name, Masters1000/WTA1000/ATP500/WTA500/ATP250/WTA250/Challenger/ITF/Other), `mapMatchFormat`. Handles **two response schemas** — a "current flat schema" and a "legacy nested schema" (`players: {p1, p2}`) — confirmed by the test file explicitly exercising both.
- **Player-ID handling:** synthetic, provider-namespaced IDs — `live-tennis-player-${id}`, `live-tennis-${matchId}`, `live-tennis-history-${matchId}` — explicitly designed to avoid ID collisions with other providers' IDs. A code comment states the design intent directly: *"Names are not identities. Reject rows without source-issued player IDs rather than manufacturing an ID from the display name and later treating it as provider-backed."*
- **Error/fallback behavior:** all failure paths throw a typed `ProviderUnavailableError` (imported from the shared `./types` module, i.e., a contract other providers/callers already know how to catch) — HTTP non-2xx, timeout (`AbortError`), and quota-exhaustion (429) all route through this.
- **Caching:** fixtures cached for `CACHE_TTL_MS = 5 minutes`; separate `playerSearchCache` and `playerHistoryCache` `Map`s, each with per-entry expiry, keyed by normalized query / source player ID respectively. `bypassCache` option supported for fixtures.
- **Timeouts:** `REQUEST_TIMEOUT_MS = 12_000` (12s) via `AbortController` on every request type.
- **Rate limiting handling:** explicit 429 handling — reads `retry-after` header and/or a `resets_at` field from the error payload, sets an internal `unavailableUntil` timestamp, and short-circuits further requests until that time passes (a circuit-breaker pattern, not a naive retry loop).
- **Environment variables/configuration:** the API key itself is **not** read inside this file — it's injected via constructor (`private readonly apiKey: string`), confirming the file's own design keeps configuration-sourcing external to it (matches the actual env var lookup found in `tennisData/index.ts`, see §4).
- **Logging:** `logger.info(this.fixtureDiagnostics, "Live Tennis fixture fetch completed")` (imported from `../../lib/logger`, the shared app logger).
- **Provenance/source labeling:** `readonly name = "Live Tennis API"`, surfaced in `getStatus()` (`ProviderStatusInfo`) and `getFixtureFetchDiagnostics()` (`FixtureFetchDiagnostics`, tracking `rawRows`/`acceptedRows`/`rejectedRows`/`duplicateRows` per fetch) — this is deliberate, structured provenance tracking, not an afterthought.
- **Data-quality guards (beyond basic mapping):** explicitly rejects doubles matches (`is_doubles`, `draw === "doubles"`, and slash/ampersand-containing names as a second-layer doubles filter), rejects rows missing scheduled dates, rejects rows missing source-issued player IDs.

**This is a mature, carefully-engineered, production-grade implementation — not a stub, prototype, or partial port.**

---

## 3. Test Coverage — Actually Covered, Not Merely Wired

**VERIFIED, full test file read directly (4 tests, `node:test`/`node:assert` based):**

1. **`getUpcomingFixturesRange maps the current flat schema across bounded pages`** — exercises pagination across two pages (offset 0→200), filters out a `"cancelled"`-status match and a match missing an opponent, correctly identifies a `"live"` match, verifies exact surface/tournament-level/round mapping, and asserts the diagnostics counters (`rawRows: 6, acceptedRows: 3, rejectedRows: 2, duplicateRows: 1`) are exactly right.
2. **`getUpcomingFixturesRange retains the legacy nested schema and honors cache bypass`** — proves the provider handles a second, older response shape (`players: {p1, p2}` nesting), and separately proves caching actually works (2 identical calls → 1 real fetch) and that `bypassCache: true` actually forces a second fetch.
3. **`searchPlayers returns ranked source-ID-backed singles and caches the query`** — proves doubles-team names ("Daisuke Sumizawa / Isaac Becroft") are filtered out, proves a candidate missing a source ID is dropped, and proves that when the same player name appears twice (one ranked, one not), only the ranked entry survives — a real identity-disambiguation behavior, not just a pass-through.
4. **`getPlayerMatches maps completed Live Tennis history for the requested player`** — proves full historical-match mapping including a realistic 5-set score reconstruction (`"7-6 5-7 4-6 6-2 6-1"`), correct per-set game-margin computation from the requester's perspective, and correct win/loss determination.

**Classification: genuinely, substantively tested — not merely wired.** The tests exercise real edge cases (schema evolution, doubles filtering, rank-based disambiguation, caching semantics), not just "does it run."

---

## 4. Consumers Traced (VERIFIED via `grep`, all three named consumers plus confirmation no others exist)

| Consumer | Role | Evidence |
|---|---|---|
| `parlayBuilder/builderProviderFetch.ts` | Tier-1 provider in `fetchPlayerMatchesFromProviders` (already documented in the prior report) | `import ... from "../tennisData/liveTennisFixturesProvider.js"` (line 37); `getBuilderLiveTennisProvider()` constructs it conditionally on a key |
| `tennisData/compositeProvider.ts` | **`fixturePrimary`** — used as the **primary fixture source** for the composite tennis-data provider, with graceful fallthrough | `private readonly fixturePrimary?: LiveTennisFixturesProvider` (constructor param, line 215); `const liveTennisFixtures = await this.fixturePrimary.getUpcomingFixturesRange(...); if (liveTennisFixtures.length > 0) { ...; return liveTennisFixtures; }` (lines 519–526) — only falls through to other sources if this returns nothing; errors from its `searchPlayers` are caught and logged (`{ method: "searchPlayers", liveTennisError: err.message }`, line 271), not fatal |
| `tennisData/index.ts` | Constructs the provider from environment configuration and injects it as `fixturePrimary` into the composite provider | `const liveTennisApiKey = process.env.Live_Tennis_Api ?? process.env.LIVE_TENNIS_API;` (line 74); conditional construction (lines 75–76); passed as `liveTennisFixturesProvider` (line 82) |
| Any other caller | **NONE FOUND** | No fourth consumer surfaced in any `grep` run this session |

**The variable name `fixturePrimary` is itself significant** — this is not a fallback-of-last-resort; it's architecturally positioned as the preferred/first-choice fixture source for the whole `tennisData` layer, with the pre-existing providers (whatever `compositeProvider.ts` falls back to) acting as the fallback, not the other way around.

---

## 5. Is This Provider Production-Critical, Optional, Development-Only, or Feature-Gated?

**Feature-gated, gracefully so — confirmed, not assumed.** Both construction sites (`builderProviderFetch.ts`'s `getBuilderLiveTennisProvider()` and `tennisData/index.ts`) construct the provider **only if** an API key environment variable is present; both leave it `null`/absent otherwise, and both consuming call sites (`fetchPlayerMatchesFromProviders`'s Tier-1 check, `compositeProvider.ts`'s `fixturePrimary` fallthrough) are written to handle its absence or failure without crashing — falling through to the other, shared-with-TSE providers. **It is not development-only** (no dev-only guard found; it's the same code path in any environment where the key is set) and **it is not merely optional in impact when active** — when the key IS present, it's treated as primary, ahead of other sources.

---

## 6. Evidence in `Tennis-Stats-Engine` History for an Equivalent/Predecessor/Removed Provider

**UNKNOWN — not established.** As noted in §1, the shallow single-branch clone available for this audit cannot search history or other branches. No predecessor, renamed equivalent, or evidence of intentional removal was found **within what was actually checked** (current `main`'s working tree and its own commit message, which — per Step 0's original inventory — described this repo as "A tennis match prediction app... backed by a multi-module prediction engine," with no specific mention of a live-fixtures data source by any name). **This absence-within-limited-scope should not be read as proof the capability never existed on `Tennis-Stats-Engine`'s side** — per the standing instruction not to assume absence from current `main` means it never existed.

---

## 7. Configuration/Environment/Dependency Requirements

| Requirement | Detail | Security note |
|---|---|---|
| API key env var | `process.env.Live_Tennis_Api` **or** `process.env.LIVE_TENNIS_API` (checked in that order; mixed-casing suggests either a naming-convention inconsistency or intentional tolerance for two historical spellings) | **Variable names only reported — no value was seen, requested, or would be printed if it had been.** |
| Network dependency | `https://api.livetennisapi.com` (third-party REST API) — outbound HTTPS required | N/A |
| No other package/library dependency beyond the app's existing `logger` and shared `tennisData/types` module | Confirmed via the file's own import list (read directly, complete) | N/A |

---

## 8. Data Overlap, Identity, Freshness, Provenance, and Duplicate-Resolution Implications

- **Overlap:** plausible and expected — Live Tennis API can return fixtures/match-history for the same real-world matches that RapidAPI/API-Tennis/Sofascore might also cover (all are general-purpose tennis data providers). This was **not tested empirically** (no live API calls were made, consistent with read-only Phase 1 rules) but is a structural likelihood given the shared `Fixture`/`MatchRecord` contract.
- **Identity:** the provider's own synthetic-ID namespacing (`live-tennis-player-*`, `live-tennis-*`) is specifically designed to prevent ID collisions with other providers — this is a **mitigation already built into the code**, not a discovered problem. Downstream reconciliation of these namespaced IDs into the canonical identity system (`canonical_players`/`player_aliases`, confirmed populated in an earlier DB audit) was **not traced this pass** — whether `live-tennis-player-*` IDs actually get resolved into `canonicalPlayerId` mappings via `player_aliases` is an open question, not confirmed either way.
- **Freshness:** 5-minute cache TTL is short relative to typical fixture-update cadences, suggesting freshness was a deliberate design priority.
- **Duplicate-resolution:** the `searchPlayers` method's own ranked-vs-unranked disambiguation (tested, see §3) shows the provider already does *some* internal duplicate handling for its own data, independent of the app's broader canonicalization layer.

**None of this was verified against a live database join or live API call — this section describes structural/design evidence from the code itself, not runtime-observed behavior.**

---

## 9. Migration Classification

## **MUST TRANSFER**

**Justification:** this is real, substantial, thoroughly-tested, architecturally-central (`fixturePrimary`) production code with no confirmed equivalent anywhere in `Tennis-Stats-Engine` within what could actually be checked (current `main` only, due to the shallow-clone limitation). It does not fit **PRESERVE DISTINCT** (that implies a known, separately-coexisting alternative on the other side — none confirmed), **MERGE/RECONCILE** (nothing on the `Tennis-Stats-Engine` side to reconcile against, as far as checked), or **DUPLICATE VERIFY** (no known duplicate to verify against). It is, as far as current evidence shows, uniquely State C's, real, working, and load-bearing (`fixturePrimary`) — the correct Phase 1 manifest status is **MUST TRANSFER**, meaning: if any future consolidation step ever treats `Tennis-Stats-Engine`'s version of `tennisData/` as authoritative, this entire provider (and its wiring in `compositeProvider.ts`/`index.ts`) must be carried forward, not discarded.

---

## 10. Additional Files Requiring Audit Before Safe Reconciliation

1. **`tennisData/compositeProvider.ts` (+ its test file)** — now confirmed to treat this provider as `fixturePrimary`; its full fallback chain and how it interacts with the other (TSE-shared) providers needs its own dedicated comparison.
2. **`tennisData/index.ts`** — confirmed to source the API key and wire the provider in; not yet compared against `Tennis-Stats-Engine`'s equivalent file at the content level (only `grep`-level presence/absence checked here).
3. **`tennisData/types.ts`** (the shared contract this provider implements — `Fixture`, `MatchRecord`, `ProviderStatusInfo`, `FixtureFetchDiagnostics`, `ProviderUnavailableError`) — not yet compared; if `Tennis-Stats-Engine`'s version of this shared types file differs, that could affect every provider, not just this one.
4. **A deeper/broader clone or fetch of `Tennis-Stats-Engine`'s other 25 branches and/or `main`'s full history** — the standing gap from §1 and §6, required to answer whether this capability has any predecessor or equivalent anywhere in that repository's full history, not just its current `main` tip.

---

## SUMMARY OF EVIDENCE AND CHECKS PERFORMED

- Local shallow-clone (`Tennis-Stats-Engine`, `main` only) searched via `find`, `grep -rl`, and `git log --all --diff-filter=AD` for the filename and class name — zero hits, but scope-limited as documented.
- `liveTennisFixturesProvider.ts` and its `.test.ts` read in full, directly, via `read_app_file` (raw bytes, not relay-corrupted).
- Three consumer files (`builderProviderFetch.ts`, `compositeProvider.ts`, `tennisData/index.ts`) checked via targeted `grep` for every reference to `LiveTennisFixturesProvider`/`liveTennis`/the env var names.
- No database was queried, no live API call was made, no file was modified, copied, merged, or deleted in either repository.

**Unknowns explicitly carried forward:** existence of an equivalent on any of `Tennis-Stats-Engine`'s other 25 branches or in deeper history; whether `live-tennis-player-*` IDs are actually reconciled into the canonical identity system at runtime; the content-level diff status of `compositeProvider.ts`, `tennisData/index.ts`, and `tennisData/types.ts` between the two trees.

**STOP after this task, per instruction. No merge, cherry-pick, rebase, commit, or push was performed or is being recommended for execution at this time.**
