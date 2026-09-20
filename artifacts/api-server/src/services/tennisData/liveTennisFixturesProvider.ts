import { logger } from "../../lib/logger";
import type {
  Fixture,
  MatchRecord,
  MatchFormat,
  PlayerSummary,
  ProviderStatusInfo,
  FixtureFetchDiagnostics,
  Surface,
  TournamentLevel,
} from "./types";
import { ProviderUnavailableError } from "./types";

const BASE_URL = "https://api.livetennisapi.com/api/public/v1";
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
const FIXTURE_PAGE_LIMIT = 200;
const MAX_FIXTURE_PAGES = 10;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asId(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

function mapSurface(value: unknown): Surface | null {
  const surface = asString(value)?.toLowerCase();
  if (!surface) return null;
  if (surface.includes("indoor") && surface.includes("hard")) return "IndoorHard";
  if (surface.includes("hard")) return "Hard";
  if (surface.includes("clay")) return "Clay";
  if (surface.includes("grass")) return "Grass";
  return null;
}

function mapLevel(tourValue: unknown, tournamentValue: unknown): TournamentLevel | null {
  const tour = asString(tourValue)?.toLowerCase() ?? "";
  const tournament = asString(tournamentValue)?.toLowerCase() ?? "";
  const text = `${tour} ${tournament}`;
  if (/(\baustralian open\b|\broland garros\b|\bfrench open\b|\bwimbledon\b|\bus open\b)/.test(tournament)) {
    return "GrandSlam";
  }
  if (text.includes("grand slam")) return "GrandSlam";
  if (text.includes("masters 1000")) return "Masters1000";
  if (text.includes("wta 1000")) return "WTA1000";
  if (text.includes("atp 500")) return "ATP500";
  if (text.includes("wta 500")) return "WTA500";
  if (text.includes("atp 250")) return "ATP250";
  if (text.includes("wta 250")) return "WTA250";
  if (text.includes("challenger")) return "Challenger";
  if (text.includes("itf")) return "ITF";
  return "Other";
}

function mapMatchFormat(value: unknown): MatchFormat | null {
  return value === 5 ? "BestOf5" : value === 3 ? "BestOf3" : null;
}

function mapFixture(value: unknown): Fixture | null {
  const match = asRecord(value);
  if (!match || match.is_doubles === true || match.draw === "doubles") return null;

  const players = asRecord(match.players);
  const player1 = asRecord(players?.p1);
  const player2 = asRecord(players?.p2);
  const player1Name = asString(match.player1_name) ?? asString(player1?.name);
  const player2Name = asString(match.player2_name) ?? asString(player2?.name);
  const player1Id = asId(match.player1_id) ?? asId(player1?.id);
  const player2Id = asId(match.player2_id) ?? asId(player2?.id);
  const matchId = asId(match.id);
  const status = asString(match.status)?.toLowerCase();
  if (status !== "scheduled" && status !== "live") return null;
  if (player1Name?.includes("/") || player1Name?.includes("&") || player2Name?.includes("/") || player2Name?.includes("&")) {
    return null;
  }
  // Names are not identities. Reject rows without source-issued player IDs rather than
  // manufacturing an ID from the display name and later treating it as provider-backed.
  if (!matchId || !player1Name || !player2Name || !player1Id || !player2Id) return null;

  const rawStart = asString(match.start_time) ?? asString(match.scheduled_time);
  const parsedStart = rawStart ? new Date(rawStart) : null;
  const scheduledStart =
    parsedStart && !Number.isNaN(parsedStart.getTime())
      ? parsedStart.toISOString()
      : null;
  if (!scheduledStart) return null;

  const tournamentName = asString(match.tournament);
  return {
    id: `live-tennis-${matchId}`,
    date: scheduledStart.slice(0, 10),
    scheduledStart,
    timeConfirmed: true,
    isLive: status === "live" && parsedStart !== null && parsedStart.getTime() <= Date.now(),
    tournamentName,
    tournamentLevel: mapLevel(match.tour, tournamentName),
    round: asString(match.round) ?? asString(match.round_code),
    surface: mapSurface(match.surface),
    indoor:
      typeof match.indoor === "boolean"
        ? match.indoor
        : asString(match.surface)?.toLowerCase().includes("indoor") ?? null,
    matchFormat: mapMatchFormat(match.best_of),
    player1Id: `live-tennis-player-${player1Id}`,
    player1Name,
    player2Id: `live-tennis-player-${player2Id}`,
    player2Name,
  };
}

function mapHistoryMatch(value: unknown, requestedPlayerId: string): MatchRecord | null {
  const match = asRecord(value);
  if (!match || match.is_doubles === true || match.draw === "doubles") return null;
  const players = asRecord(match.players);
  const p1 = asRecord(players?.p1);
  const p2 = asRecord(players?.p2);
  const p1Id = asId(p1?.id);
  const p2Id = asId(p2?.id);
  const requestedSourceId = requestedPlayerId.replace(/^live-tennis-player-/, "");
  const requestedSide = p1Id === requestedSourceId ? 1 : p2Id === requestedSourceId ? 2 : null;
  if (!requestedSide) return null;

  const opponent = requestedSide === 1 ? p2 : p1;
  const opponentId = asId(opponent?.id);
  const opponentName = asString(opponent?.name);
  const matchId = asId(match.id);
  const scheduledTime = asString(match.scheduled_time);
  const parsedDate = scheduledTime ? new Date(scheduledTime) : null;
  const winner = Number(match.winner);
  if (
    !matchId ||
    !opponentId ||
    !opponentName ||
    !parsedDate ||
    Number.isNaN(parsedDate.getTime()) ||
    (winner !== 1 && winner !== 2)
  ) return null;

  const score = asRecord(match.score);
  const games = Array.isArray(score?.games) ? score.games : [];
  const p1Games = Array.isArray(games[0]) ? games[0] : [];
  const p2Games = Array.isArray(games[1]) ? games[1] : [];
  const setCount = Math.min(p1Games.length, p2Games.length);
  const setScores = Array.from({ length: setCount }, (_, index) => {
    const first = Number(p1Games[index]);
    const second = Number(p2Games[index]);
    return Number.isFinite(first) && Number.isFinite(second) ? `${first}-${second}` : null;
  }).filter((item): item is string => item !== null);
  const setGameMargins = Array.from({ length: setCount }, (_, index) => {
    const own = Number((requestedSide === 1 ? p1Games : p2Games)[index]);
    const other = Number((requestedSide === 1 ? p2Games : p1Games)[index]);
    return {
      playerGames: Number.isFinite(own) ? own : 0,
      opponentGames: Number.isFinite(other) ? other : 0,
    };
  });
  const opponentRanking = Number(opponent?.ranking);
  const tournamentName = asString(match.tournament);

  return {
    id: `live-tennis-history-${matchId}`,
    date: parsedDate.toISOString().slice(0, 10),
    tournamentName,
    tournamentLevel: mapLevel(match.tour, tournamentName),
    round: asString(match.round) ?? asString(match.round_code),
    matchFormat: mapMatchFormat(match.best_of),
    surface: mapSurface(match.surface),
    indoor:
      typeof match.indoor === "boolean"
        ? match.indoor
        : asString(match.surface)?.toLowerCase().includes("indoor") ?? null,
    opponentId: `live-tennis-player-${opponentId}`,
    opponentName,
    opponentRank:
      Number.isFinite(opponentRanking) && opponentRanking > 0 ? opponentRanking : null,
    result: winner === requestedSide ? "W" : "L",
    score: setScores.join(" "),
    retired: match.retired === true,
    walkover: match.walkover === true,
    stats: null,
    opponentStats: null,
    setGameMargins,
  };
}

export class LiveTennisFixturesProvider {
  readonly name = "Live Tennis API";
  private cachedFixtures: Fixture[] | null = null;
  private cacheExpiresAt = 0;
  private readonly playerSearchCache = new Map<string, { expiresAt: number; players: PlayerSummary[] }>();
  private readonly playerHistoryCache = new Map<string, { expiresAt: number; records: MatchRecord[] }>();
  private unavailableUntil = 0;
  private lastSuccessfulCallAt: string | null = null;
  private lastError: string | null = null;
  private fixtureDiagnostics: FixtureFetchDiagnostics | null = null;

  constructor(private readonly apiKey: string) {}

  getStatus(): ProviderStatusInfo {
    return {
      provider: this.name,
      connected: this.lastSuccessfulCallAt !== null,
      lastSuccessfulCallAt: this.lastSuccessfulCallAt,
      lastError: this.lastError,
    };
  }

  getFixtureFetchDiagnostics(): FixtureFetchDiagnostics | null {
    return this.fixtureDiagnostics;
  }

  private async fetchFixtures(bypassCache: boolean): Promise<Fixture[]> {
    if (!bypassCache && this.cachedFixtures && Date.now() < this.cacheExpiresAt) {
      return this.cachedFixtures;
    }
    if (Date.now() < this.unavailableUntil) {
      throw new ProviderUnavailableError(
        `${this.name} fixture request paused until its provider quota resets`,
      );
    }

    try {
      const fixtures: Fixture[] = [];
      const seenIds = new Set<string>();
      let rawRows = 0;
      let rejectedRows = 0;
      let duplicateRows = 0;

      for (let page = 0; page < MAX_FIXTURE_PAGES; page++) {
        const offset = page * FIXTURE_PAGE_LIMIT;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        let response: Response;
        try {
          response = await fetch(
            `${BASE_URL}/fixtures?limit=${FIXTURE_PAGE_LIMIT}&offset=${offset}`,
            {
              headers: {
                Accept: "application/json",
                "X-API-Key": this.apiKey,
              },
              signal: controller.signal,
            },
          );
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          const retryAfter = response.headers.get("retry-after");
          const errorPayload = asRecord(await response.json().catch(() => null));
          const resetsAt = asString(errorPayload?.resets_at);
          const parsedReset = resetsAt ? new Date(resetsAt).getTime() : Number.NaN;
          const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
          if (Number.isFinite(parsedReset) && parsedReset > Date.now()) {
            this.unavailableUntil = parsedReset;
          } else if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            this.unavailableUntil = Date.now() + retryAfterSeconds * 1000;
          } else {
            this.unavailableUntil = Date.now() + 60_000;
          }
          this.lastError =
            response.status === 429
              ? `daily or per-minute quota exhausted${retryAfter ? `; retry after ${retryAfter}` : ""}`
              : `HTTP ${response.status}`;
          throw new ProviderUnavailableError(
            `${this.name} fixture request failed: ${this.lastError}`,
          );
        }

        const payload = asRecord(await response.json());
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        rawRows += rows.length;
        for (const row of rows) {
          const fixture = mapFixture(row);
          if (!fixture) {
            rejectedRows++;
            continue;
          }
          if (seenIds.has(fixture.id)) {
            duplicateRows++;
            continue;
          }
          seenIds.add(fixture.id);
          fixtures.push(fixture);
        }

        const meta = asRecord(payload?.meta);
        const hasMore = meta?.has_more === true;
        if (!hasMore || rows.length === 0) break;
      }

      this.fixtureDiagnostics = {
        provider: this.name,
        rawRows,
        acceptedRows: fixtures.length,
        rejectedRows,
        duplicateRows,
      };
      this.cachedFixtures = fixtures;
      this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      this.lastSuccessfulCallAt = new Date().toISOString();
      this.lastError = null;
      logger.info(this.fixtureDiagnostics, "Live Tennis fixture fetch completed");
      return fixtures;
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      this.lastError =
        error instanceof Error && error.name === "AbortError"
          ? "request timed out"
          : error instanceof Error
            ? error.message
            : String(error);
      throw new ProviderUnavailableError(
        `${this.name} fixture request failed: ${this.lastError}`,
      );
    }
  }

  async getUpcomingFixturesRange(
    dateStart: string,
    dateStop: string,
    opts?: { bypassCache?: boolean },
  ): Promise<Fixture[]> {
    const fixtures = await this.fetchFixtures(opts?.bypassCache === true);
    return fixtures.filter((fixture) => fixture.date >= dateStart && fixture.date <= dateStop);
  }

  async searchPlayers(query: string): Promise<PlayerSummary[]> {
    const normalizedQuery = query
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (normalizedQuery.length < 2) return [];

    const cached = this.playerSearchCache.get(normalizedQuery);
    if (cached && Date.now() < cached.expiresAt) return cached.players;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const params = new URLSearchParams({ search: query, limit: "25", offset: "0" });
      const response = await fetch(`${BASE_URL}/players?${params}`, {
        headers: {
          Accept: "application/json",
          "X-API-Key": this.apiKey,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ProviderUnavailableError(
          `${this.name} player search failed: HTTP ${response.status}`,
        );
      }

      const payload = asRecord(await response.json());
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const candidates = rows.flatMap((value): PlayerSummary[] => {
        const player = asRecord(value);
        const id = asId(player?.id);
        const name = asString(player?.name);
        if (!id || !name || name.includes("/") || name.includes("&")) return [];
        const normalizedName = name
          .normalize("NFKD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
        if (!normalizedName.includes(normalizedQuery)) return [];
        const ranking = Number(player?.ranking);
        return [{
          id: `live-tennis-player-${id}`,
          name,
          countryCode: asString(player?.country)?.toUpperCase() ?? null,
          currentRank: Number.isFinite(ranking) && ranking > 0 ? ranking : null,
          tour: asString(player?.tour),
        }];
      });

      // The source can retain older duplicate identities for the same exact singles name.
      // When one carries a current ranking, that source-ranked identity is the canonical one.
      const byName = new Map<string, PlayerSummary[]>();
      for (const candidate of candidates) {
        const key = candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        byName.set(key, [...(byName.get(key) ?? []), candidate]);
      }
      const players = [...byName.values()].flatMap((sameName) => {
        const ranked = sameName.filter((candidate) => candidate.currentRank !== null);
        return ranked.length === 1 ? ranked : sameName;
      });
      this.playerSearchCache.set(normalizedQuery, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        players,
      });
      this.lastSuccessfulCallAt = new Date().toISOString();
      this.lastError = null;
      return players;
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      const detail =
        error instanceof Error && error.name === "AbortError"
          ? "request timed out"
          : error instanceof Error
            ? error.message
            : String(error);
      throw new ProviderUnavailableError(
        `${this.name} player search failed: ${detail}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async getPlayerMatches(playerId: string): Promise<MatchRecord[]> {
    const sourceId = playerId.replace(/^live-tennis-player-/, "");
    if (!/^\d+$/.test(sourceId)) return [];
    const cached = this.playerHistoryCache.get(sourceId);
    if (cached && Date.now() < cached.expiresAt) return cached.records;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const params = new URLSearchParams({
        player: sourceId,
        limit: "100",
        offset: "0",
      });
      const response = await fetch(`${BASE_URL}/history/matches?${params}`, {
        headers: {
          Accept: "application/json",
          "X-API-Key": this.apiKey,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ProviderUnavailableError(
          `${this.name} player history failed: HTTP ${response.status}`,
        );
      }
      const payload = asRecord(await response.json());
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const records = rows
        .map((row) => mapHistoryMatch(row, playerId))
        .filter((record): record is MatchRecord => record !== null);
      this.playerHistoryCache.set(sourceId, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        records,
      });
      this.lastSuccessfulCallAt = new Date().toISOString();
      this.lastError = null;
      return records;
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      const detail =
        error instanceof Error && error.name === "AbortError"
          ? "request timed out"
          : error instanceof Error
            ? error.message
            : String(error);
      throw new ProviderUnavailableError(
        `${this.name} player history failed: ${detail}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
