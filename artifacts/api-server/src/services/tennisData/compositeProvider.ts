/**
 * Composite (primary + fallback) TennisDataProvider.
 *
 * Tries the primary provider (RapidAPI/tennis-api-atp-wta-itf) for every request. When the primary
 * throws ProviderUnavailableError — which covers rate limits, network errors, subscription
 * mismatches, and any HTTP error — the fallback (API-Tennis) is tried instead.
 *
 * This keeps the rest of the app completely unaware of which physical provider served the
 * data; every caller just calls `getTennisDataProvider()` and gets the best available source.
 */
import { logger } from "../../lib/logger";
import type {
  Fixture,
  FixtureFetchDiagnostics,
  HeadToHeadRecord,
  HistoricalFixture,
  LiveScore,
  MatchRecord,
  PlayerProfile,
  PlayerSummary,
  ProviderStatusInfo,
  Surface,
  TennisDataProvider,
  TournamentLevel,
} from "./types";
import { ProviderUnavailableError } from "./types";
import { inferSurfaceAndLevel } from "./surfaceMap.js";
import { fetchFromBsdTennis } from "./bsdTennisProvider.js";
import { getPlayerMatchesFromDb } from "./dbHistoryFallback.js";
import { getCachedPlayerIdentityIndex, getAliasIds } from "./playerIdentity.js";
import type { LiveTennisFixturesProvider } from "./liveTennisFixturesProvider.js";

// ─── Sofascore tertiary fixture fallback ──────────────────────────────────────
// Used when both RapidAPI (primary) and API-Tennis (fallback) are unavailable.
// Sofascore's public API requires no authentication and covers all tour levels.

const SF_BASE = "https://api.sofascore.com/api/v1";
const SF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Origin: "https://www.sofascore.com",
  Referer: "https://www.sofascore.com/",
};
const SF_TIMEOUT_MS = 10_000;

function sfFixtureFetch(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), SF_TIMEOUT_MS);
  return fetch(url, { headers: SF_HEADERS, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

function mapSfSurface(g: string | undefined | null): Surface | null {
  if (!g) return null;
  const m: Record<string, Surface> = {
    HARD: "Hard", CLAY: "Clay", GRASS: "Grass",
    ARTIFICIAL_GRASS: "Grass", INDOOR_HARD: "IndoorHard",
    INDOOR_CLAY: "Clay", CARPET: "IndoorHard",
  };
  return m[g.toUpperCase()] ?? null;
}

function mapSfLevel(event: { tournament?: { name?: string; category?: { name?: string }; uniqueTournament?: { name?: string; category?: { name?: string } } } }): TournamentLevel | null {
  const n = (
    event.tournament?.uniqueTournament?.category?.name ??
    event.tournament?.category?.name ??
    event.tournament?.name ?? ""
  ).toLowerCase();
  if (n.includes("grand slam")) return "GrandSlam";
  if (n.includes("masters 1000") || n.includes("masters series")) return "Masters1000";
  if (n.includes("wta 1000") || n.includes("premier mandatory") || n.includes("premier 5")) return "WTA1000";
  if (n.includes("atp 500")) return "ATP500";
  if (n.includes("wta 500") || (n.includes("premier") && !n.includes("mandatory") && !n.includes(" 5"))) return "WTA500";
  if (n.includes("atp 250")) return "ATP250";
  if (n.includes("wta 250")) return "WTA250";
  if (n.includes("challenger")) return "Challenger";
  if (n.includes("125")) return "Challenger";
  if (n.includes("itf")) return "ITF";
  return "Other";
}

/**
 * Fetch upcoming singles tennis fixtures from Sofascore for a given date.
 * Returns an empty array (never throws) so it can always be used as a safe fallback.
 */
async function fetchSofascoreFixturesForDate(date: string): Promise<Fixture[]> {
  try {
    const res = await sfFixtureFetch(`${SF_BASE}/sport/tennis/scheduled-events/${date}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { events?: Array<{
      id: number;
      tournament?: { name?: string; category?: { name?: string }; uniqueTournament?: { name?: string; category?: { name?: string } } };
      homeTeam?: { id: number; name: string };
      awayTeam?: { id: number; name: string };
      startTimestamp?: number;
      status?: { type?: string };
      groundType?: string;
      roundInfo?: { name?: string };
    }> };
    const events = data.events ?? [];
    const fixtures: Fixture[] = [];
    for (const ev of events) {
      const p1 = ev.homeTeam;
      const p2 = ev.awayTeam;
      if (!p1 || !p2) continue;
      // Skip doubles: player names containing "/" or "&"
      if (p1.name.includes("/") || p1.name.includes("&") || p2.name.includes("/") || p2.name.includes("&")) continue;
      // Skip already-finished matches
      const statusType = ev.status?.type ?? "";
      if (statusType === "finished" || statusType === "canceled" || statusType === "postponed") continue;

      const scheduledStart = ev.startTimestamp ? new Date(ev.startTimestamp * 1000).toISOString() : null;
      const isLive = statusType === "inprogress";

      fixtures.push({
        id: `sf-fixture-${ev.id}`,
        date,
        scheduledStart,
        timeConfirmed: !!scheduledStart,
        isLive,
        tournamentName: ev.tournament?.name ?? null,
        tournamentLevel: mapSfLevel(ev),
        round: ev.roundInfo?.name ?? null,
        surface: mapSfSurface(ev.groundType),
        indoor: null,
        matchFormat: null,
        player1Id: `sf-player-${p1.id}`,
        player1Name: p1.name,
        player2Id: `sf-player-${p2.id}`,
        player2Name: p2.name,
      });
    }
    return fixtures;
  } catch {
    return [];
  }
}

async function fetchSofascoreFixturesRange(dateStart: string, dateStop: string): Promise<Fixture[]> {
  // Enumerate dates in the range and fetch each day. Range is typically 1-3 days.
  const dates: string[] = [];
  const cursor = new Date(dateStart + "T00:00:00Z");
  const stop = new Date(dateStop + "T00:00:00Z");
  while (cursor <= stop && dates.length < 7) { // safety cap at 7 days
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const perDay = await Promise.all(dates.map(d => fetchSofascoreFixturesForDate(d)));
  return perDay.flat();
}

// A provider with fewer than this many rows may have incomplete tour coverage, so the
// next history tier is queried and its rows are merged. This deliberately does not mean
// that a provider's empty response is an error: empty and failed attempts are distinct
// in the routing diagnostics.
const HISTORY_SUPPLEMENT_THRESHOLD = 5;

export type HistoryAttemptStatus = "records" | "empty" | "failed" | "skipped";

export interface HistoryRoutingAttempt {
  provider: string;
  status: HistoryAttemptStatus;
  recordCount: number;
  error?: string;
}

export interface HistoryRoutingDiagnostics {
  playerId: string;
  attemptedProviders: HistoryRoutingAttempt[];
  selectedProvider: string | null;
  selectedTier: number | null;
  dbUsed: boolean;
  totalRecordCount: number;
  completedAt: string;
}

export type BsdHistoryFetcher = (
  playerName: string,
) => Promise<{ records: MatchRecord[]; resolvedVia?: string }>;

/**
 * Union two MatchRecord arrays, deduplicating by id.
 *
 * Each provider uses its own id namespace (e.g. "12345" for API-Tennis,
 * "bsd-12345" for BSD Tennis, "atp-12345" for the DB import), so cross-provider
 * records for the same match will only collide when their id strings happen to be
 * identical — rare in practice. Content-based dedup (opponentId + date) would
 * require a shared canonical opponent-ID across providers, which is not yet available.
 *
 * Preserves the order of `a`, then appends any records from `b` not already in `a`.
 */
function mergeMatchRecords(a: MatchRecord[], b: MatchRecord[]): MatchRecord[] {
  if (b.length === 0) return a;
  if (a.length === 0) return b;
  const seen = new Set(a.map(r => r.id));
  const added = b.filter(r => !seen.has(r.id));
  return added.length === 0 ? a : [...a, ...added];
}

export class CompositeTennisProvider implements TennisDataProvider {
  readonly name: string;

  /**
   * Caches provider-resolved player names so BSD's name-based history lookup can
   * run without treating an arbitrary request string as an identity.
   * Populated automatically on every successful getPlayer() call.
   */
  private readonly playerNameCache = new Map<string, string>();
  private sofascoreLastSuccessfulCallAt: string | null = null;
  private readonly historyDiagnostics = new Map<string, HistoryRoutingDiagnostics>();
  private fixtureDiagnostics: FixtureFetchDiagnostics | null = null;

  constructor(
    private readonly primary: TennisDataProvider,
    private readonly fallback: TennisDataProvider,
    private readonly fixturePrimary?: LiveTennisFixturesProvider,
    private readonly bsdHistoryFetcher: BsdHistoryFetcher = fetchFromBsdTennis,
  ) {
    this.name = `${primary.name}+${fallback.name}`;
  }

  private async withFallback<T>(
    methodName: string,
    primaryCall: () => Promise<T>,
    fallbackCall: () => Promise<T>,
  ): Promise<T> {
    try {
      return await primaryCall();
    } catch (err) {
      if (err instanceof ProviderUnavailableError) {
        logger.warn({ method: methodName, primaryError: err.message }, `${this.primary.name} unavailable — falling back to ${this.fallback.name}`);
        return fallbackCall();
      }
      throw err;
    }
  }

  getStatus(): ProviderStatusInfo {
    const fixturePrimaryStatus = this.fixturePrimary?.getStatus();
    if (fixturePrimaryStatus?.connected) return fixturePrimaryStatus;
    // When the primary is connected, report it. When it isn't (rate-limited, quota exhausted,
    // network error) report the fallback instead — that's the provider actually serving requests,
    // and showing the primary's "disconnected" state while the app is perfectly functional causes
    // a misleading offline badge in the UI.
    const primaryStatus = this.primary.getStatus();
    if (primaryStatus.connected) return primaryStatus;
    const fallbackStatus = this.fallback.getStatus();
    if (fallbackStatus.connected) return fallbackStatus;
    if (this.sofascoreLastSuccessfulCallAt) {
      return {
        provider: "Sofascore fallback",
        connected: true,
        lastSuccessfulCallAt: this.sofascoreLastSuccessfulCallAt,
        lastError: null,
      };
    }
    // Both down: return primary so the error message is as specific as possible.
    return primaryStatus;
  }

  async searchPlayers(query: string): Promise<PlayerSummary[]> {
    let candidates: PlayerSummary[] = [];
    // Live Tennis owns the first search attempt when configured. Keeping its
    // source-issued IDs ahead of ranking-provider IDs prevents an otherwise
    // identical name from being resolved to a different identity space.
    if (this.fixturePrimary) {
      try {
        candidates = await this.fixturePrimary.searchPlayers(query);
      } catch (err) {
        if (!(err instanceof ProviderUnavailableError)) throw err;
        logger.warn(
          { method: "searchPlayers", liveTennisError: err.message },
          "Live Tennis player search unavailable — trying ranking providers",
        );
      }
    }

    // A healthy rankings feed can legitimately return no lower-tour players. An empty
    // result is therefore a coverage gap, not proof that another source has nothing.
    if (candidates.length === 0) {
      try {
        candidates = await this.fallback.searchPlayers(query);
      } catch (err) {
        if (!(err instanceof ProviderUnavailableError)) throw err;
        logger.warn(
          { method: "searchPlayers", apiTennisError: err.message },
          `${this.fallback.name} player search unavailable`,
        );
      }
    }
    if (candidates.length === 0) {
      try {
        candidates = await this.primary.searchPlayers(query);
      } catch (err) {
        if (!(err instanceof ProviderUnavailableError)) throw err;
        logger.warn(
          { method: "searchPlayers", rapidApiError: err.message },
          `${this.primary.name} player search unavailable`,
        );
      }
    }

    const unique = new Map<string, PlayerSummary>();
    for (const candidate of candidates) unique.set(candidate.id, candidate);
    return [...unique.values()];
  }

  /**
   * Pre-seed the player name cache so the BSD history tier can activate even when
   * both primary and fallback fail for getPlayer. Should
   * be called by any code that already has the player name from fixture data
   * (e.g. predictFromSnapshot when submittedPlayerName is available). Has no
   * effect if the ID is already cached from a prior getPlayer call.
   */
  seedPlayerName(playerId: string, name: string): void {
    if (!this.playerNameCache.has(playerId)) {
      this.playerNameCache.set(playerId, name);
    }
  }

  /**
   * Returns the most recent routing result for a player. This is intentionally
   * read-only and contains provider names/counts only — no upstream payloads,
   * credentials, or player-sensitive match details.
   */
  getHistoryRoutingDiagnostics(playerId: string): HistoryRoutingDiagnostics | null {
    return this.historyDiagnostics.get(playerId) ?? null;
  }

  getFixtureFetchDiagnostics(): FixtureFetchDiagnostics | null {
    return this.fixtureDiagnostics;
  }

  async getPlayer(playerId: string): Promise<PlayerProfile | null> {
    const profile = await this.withFallback(
      "getPlayer",
      () => this.fallback.getPlayer(playerId),
      () => this.primary.getPlayer(playerId),
    );
    // Cache name for BSD's name-based getPlayerMatches lookup.
    if (profile?.name) {
      this.playerNameCache.set(playerId, profile.name);
    }
    return profile;
  }

  async getPlayerMatches(playerId: string): Promise<MatchRecord[]> {
    // History priority is intentionally different from fixtures/search:
    // Live Tennis (only for its own IDs), API-Tennis, BSD (name lookup), Rapid/MatchStat,
    // then historical_matches. MatchStat does not currently support this operation, but
    // keeping it in the chain makes the capability explicit and preserves future support.
    let records: MatchRecord[] = [];
    const attempts: HistoryRoutingAttempt[] = [];
    let selectedProvider: string | null = null;
    let selectedTier: number | null = null;
    const attempt = async (
      provider: TennisDataProvider,
      tier: number,
      call: () => Promise<MatchRecord[]>,
    ): Promise<void> => {
      try {
        const result = await call();
        attempts.push({
          provider: provider.name,
          status: result.length > 0 ? "records" : "empty",
          recordCount: result.length,
        });
        if (result.length > 0 && selectedProvider === null) {
          selectedProvider = provider.name;
          selectedTier = tier;
        }
        records = mergeMatchRecords(records, result);
      } catch (err) {
        if (!(err instanceof ProviderUnavailableError)) throw err;
        attempts.push({
          provider: provider.name,
          status: "failed",
          recordCount: 0,
          error: err.message,
        });
        logger.warn({ playerId, provider: provider.name, err: err.message }, "History provider unavailable — continuing routing chain");
      }
    };

    // Live Tennis IDs are source-issued identities. Never send a non-Live ID to
    // this provider: a name/number collision must not silently alias history.
    const isLiveTennisId = playerId.startsWith("live-tennis-player-");
    if (this.fixturePrimary && isLiveTennisId) {
      await attempt(
        this.fixturePrimary as unknown as TennisDataProvider,
        1,
        () => this.fixturePrimary!.getPlayerMatches(playerId),
      );
    } else if (this.fixturePrimary) {
      attempts.push({
        provider: this.fixturePrimary.name,
        status: "skipped",
        recordCount: 0,
        error: "unsupported player identity",
      });
    }

    // API-Tennis is always the second history tier, ahead of BSD and RapidAPI.
    if (records.length < HISTORY_SUPPLEMENT_THRESHOLD) {
      await attempt(this.fallback, 2, () => this.fallback.getPlayerMatches(playerId));
    }

    const playerName = this.playerNameCache.get(playerId);

    // Tier-3: BSD Tennis uses only the cached provider-resolved name. It must not
    // infer an identity from an arbitrary request string.
    if (records.length < HISTORY_SUPPLEMENT_THRESHOLD && playerName) {
      const bsdProvider = { name: "BSD Tennis" } as TennisDataProvider;
      await attempt(bsdProvider, 3, async () => {
        const bsdResult = await this.bsdHistoryFetcher(playerName);
        logger.debug(
          { playerId, playerName, bsd: bsdResult.records.length, resolvedVia: bsdResult.resolvedVia ?? "none" },
          "compositeProvider: BSD Tennis history attempt",
        );
        return bsdResult.records;
      });
    } else if (records.length < HISTORY_SUPPLEMENT_THRESHOLD) {
      attempts.push({
        provider: "BSD Tennis",
        status: "skipped",
        recordCount: 0,
        error: "player name not cached",
      });
    }

    // Tier-4: RapidAPI/MatchStat is attempted only when the chain is still sparse.
    if (records.length < HISTORY_SUPPLEMENT_THRESHOLD) {
      await attempt(this.primary, 4, () => this.primary.getPlayerMatches(playerId));
    }

    // Tier-5: historical_matches DB. This remains reachable even when optional
    // Rapid/API keys are absent because the factory always constructs this composite.
    // Resolve the full alias group (includes any sackmann-* ID bridged to this live ID) so
    // the Sackmann archive rows (pre-2024) are returned alongside live-provider rows.
    let dbUsed = false;
    if (records.length < HISTORY_SUPPLEMENT_THRESHOLD) {
      try {
        dbUsed = true;
        const aliasIds = await this.resolveAliasIds(playerId);
        // Capture prior count before the merge so the warning below can accurately
        // distinguish "live providers returned nothing" from "some live data exists".
        const priorCount = records.length;
        const dbRecords = await this.fetchDbHistory(aliasIds.length > 1 ? aliasIds : playerId);
        records = mergeMatchRecords(records, dbRecords);
        attempts.push({
          provider: "historical_matches",
          status: dbRecords.length > 0 ? "records" : "empty",
          recordCount: dbRecords.length,
        });
        if (dbRecords.length > 0 && selectedProvider === null) {
          selectedProvider = "historical_matches";
          selectedTier = 5;
        }
        if (records.length > priorCount) {
          logger.info(
            { playerId, aliasCount: aliasIds.length, prior: priorCount, db: dbRecords.length, merged: records.length },
            "compositeProvider: historical_matches DB tier-5 supplemented match history",
          );
        }
        // Warn when tier-5 is carrying the full scoring load (all live providers returned
        // zero) AND historical_matches also has no meaningful history for this player.
        // Real risk: a player who has never been scored before — or has never appeared in
        // a walk-forward run — has no DB fallback during an API-Tennis + BSD correlated
        // outage. Scoring will fall through to the thin-data path without this being
        // visible anywhere else in the logs.
        if (priorCount === 0 && dbRecords.length < HISTORY_SUPPLEMENT_THRESHOLD) {
          logger.warn(
            { playerId, prior: 0, db: dbRecords.length },
            "compositeProvider: no DB fallback available for this player during live-provider outage — all providers returned zero records and historical_matches has no history for this player; scoring will use thin-data path",
          );
        }
      } catch (dbErr) {
        attempts.push({
          provider: "historical_matches",
          status: "failed",
          recordCount: 0,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
        logger.debug({ playerId, err: dbErr }, "compositeProvider: DB tier-5 failed (non-fatal)");
      }
    }

    const diagnostics: HistoryRoutingDiagnostics = {
      playerId,
      attemptedProviders: attempts,
      selectedProvider,
      selectedTier,
      dbUsed,
      totalRecordCount: records.length,
      completedAt: new Date().toISOString(),
    };
    this.historyDiagnostics.set(playerId, diagnostics);
    logger.info(
      {
        playerId,
        attemptedProviders: attempts.map(({ provider, status, recordCount }) => ({ provider, status, recordCount })),
        selectedProvider,
        selectedTier,
        dbUsed,
        totalRecordCount: records.length,
      },
      "compositeProvider: history routing diagnostic",
    );

    return records;
  }

  async getUpcomingFixtures(date: string): Promise<Fixture[]> {
    return this.getUpcomingFixturesRange(date, date);
  }

  async getUpcomingFixturesRange(dateStart: string, dateStop: string, opts?: { bypassCache?: boolean }): Promise<Fixture[]> {
    if (this.fixturePrimary) {
      try {
        const liveTennisFixtures = await this.fixturePrimary.getUpcomingFixturesRange(
          dateStart,
          dateStop,
          opts,
        );
        if (liveTennisFixtures.length > 0) {
          this.fixtureDiagnostics = this.fixturePrimary.getFixtureFetchDiagnostics();
          return liveTennisFixtures;
        }
        logger.info(
          { dateStart, dateStop },
          "Live Tennis API returned no fixtures in the requested window — continuing to fallback providers",
        );
      } catch (error) {
        logger.warn(
          {
            method: "getUpcomingFixturesRange",
            primaryError: error instanceof Error ? error.message : String(error),
          },
          "Live Tennis API unavailable for fixtures — continuing to fallback providers",
        );
      }
    }

    // After Live Tennis, API-Tennis is attempted before RapidAPI/MatchStat.
    // Tier-3: Sofascore public API — when both tier-1 and tier-2 are unavailable
    //         (e.g. API-Tennis billing lapsed and RapidAPI quota exhausted for the day).
    //         No auth required; covers ATP, WTA, Challenger, ITF.
    let fixtures: Fixture[] = [];
    try {
      fixtures = await this.fallback.getUpcomingFixturesRange(dateStart, dateStop, opts);
      if (fixtures.length > 0) {
        this.fixtureDiagnostics = {
          provider: this.fallback.name,
          rawRows: fixtures.length,
          acceptedRows: fixtures.length,
          rejectedRows: 0,
        };
      }
    } catch (apiTennisErr) {
      if (!(apiTennisErr instanceof ProviderUnavailableError)) throw apiTennisErr;
      logger.warn({ method: "getUpcomingFixturesRange", primaryError: apiTennisErr.message },
        `${this.fallback.name} unavailable for fixtures — trying ${this.primary.name}`);
    }

    if (fixtures.length === 0) {
      try {
        fixtures = await this.primary.getUpcomingFixturesRange(dateStart, dateStop, opts);
        if (fixtures.length > 0) {
          this.fixtureDiagnostics = {
            provider: this.primary.name,
            rawRows: fixtures.length,
            acceptedRows: fixtures.length,
            rejectedRows: 0,
          };
        }
      } catch (rapidApiErr) {
        if (!(rapidApiErr instanceof ProviderUnavailableError)) throw rapidApiErr;
        logger.warn({ method: "getUpcomingFixturesRange", fallbackError: rapidApiErr.message },
          `${this.primary.name} also unavailable — using Sofascore tertiary for fixtures`);
      }
    }

    // Empty responses are coverage gaps, not terminal successes. Continue to Sofascore.
    if (fixtures.length === 0) {
      fixtures = await fetchSofascoreFixturesRange(dateStart, dateStop);
      this.sofascoreLastSuccessfulCallAt = new Date().toISOString();
      this.fixtureDiagnostics = {
        provider: "Sofascore fallback",
        rawRows: fixtures.length,
        acceptedRows: fixtures.length,
        rejectedRows: 0,
      };
      if (fixtures.length > 0) {
        logger.info({ dateStart, dateStop, count: fixtures.length },
          "compositeProvider: Sofascore tertiary provided fixture list (both primary providers unavailable)");
      }
    }

    // Surface enrichment: any fixture whose provider left surface=null gets a second attempt
    // using the static tournament-name lookup table (the same one that powers live predictions).
    // This covers all GrandSlams, Masters 1000s, and the prominent 500-level events by name.
    // Fixtures for smaller Challenger/ITF events that still can't be resolved stay null rather
    // than being guessed — the UI shows "Unknown" and the Predict button falls back safely.
    let enrichedCount = 0;
    fixtures = fixtures.map((f) => {
      if (f.surface !== null || !f.tournamentName) return f;
      const { surface } = inferSurfaceAndLevel(f.tournamentName);
      if (surface) {
        enrichedCount++;
        return { ...f, surface };
      }
      return f;
    });
    if (enrichedCount > 0) {
      logger.info({ enrichedCount }, "compositeProvider: surface-enriched fixtures via tournament-name lookup");
    }

    return fixtures;
  }

  async getHeadToHead(player1Id: string, player2Id: string): Promise<HeadToHeadRecord> {
    return this.withFallback(
      "getHeadToHead",
      () => this.fallback.getHeadToHead(player1Id, player2Id),
      () => this.primary.getHeadToHead(player1Id, player2Id),
    );
  }

  async getCompletedMatchesByDateRange(dateStart: string, dateStop: string): Promise<HistoricalFixture[]> {
    // Historical backfill uses API-Tennis exclusively — MatchStat doesn't support this endpoint.
    return this.fallback.getCompletedMatchesByDateRange(dateStart, dateStop);
  }

  async getLiveScores(fixtureIds: string[]): Promise<Map<string, LiveScore>> {
    // MatchStat (primary) does not provide live scores — hard-route to API-Tennis so real
    // in-progress score data is never silently replaced with an empty map. Same pattern
    // as getCompletedMatchesByDateRange, which MatchStat also doesn't support.
    return this.fallback.getLiveScores(fixtureIds);
  }

  async findTournamentSurfaceByName(name: string): Promise<{ surface: import("./types").Surface | null; level: import("./types").TournamentLevel | null } | null> {
    // Only API-Tennis has the tournament-surface-by-name lookup; delegate directly.
    if (this.fallback.findTournamentSurfaceByName) {
      return this.fallback.findTournamentSurfaceByName(name);
    }
    return null;
  }

  /**
   * Live standings come exclusively from API-Tennis (the fallback). The MatchStat primary does
   * not implement this method, so — like `getLiveScores` and `getCompletedMatchesByDateRange` —
   * we route directly to the provider that can actually serve the data. If the fallback also
   * doesn't implement it (e.g. a test stub), we return an empty array rather than throwing,
   * which is consistent with the `runRankingVerification` guard that already handles the
   * `totalProviderRankings: 0` sentinel.
   */
  async getCurrentStandings(): Promise<Array<{ playerKey: string; rank: number; name: string; tour: "ATP" | "WTA" }>> {
    if (!this.fallback.getCurrentStandings) {
      logger.warn({ provider: this.name }, "Neither primary nor fallback implements getCurrentStandings — ranking verification will be skipped");
      return [];
    }
    return this.fallback.getCurrentStandings();
  }

  /**
   * Protected so tests can override to avoid real DB/identity queries.
   * Returns the full alias-ID group for a player (live ID + any bridged sackmann-* IDs).
   */
  protected async resolveAliasIds(playerId: string): Promise<string[]> {
    const identityIndex = await getCachedPlayerIdentityIndex();
    const canonicalId = identityIndex.canonicalIdById.get(playerId) ?? playerId;
    return getAliasIds(identityIndex, canonicalId);
  }

  /**
   * Protected so tests can override to return controlled match-record sets.
   * Wraps the DB tier-5 query and is the single callsite for `getPlayerMatchesFromDb`.
   */
  protected async fetchDbHistory(aliasIds: string | string[]): Promise<MatchRecord[]> {
    return getPlayerMatchesFromDb(aliasIds);
  }
}
