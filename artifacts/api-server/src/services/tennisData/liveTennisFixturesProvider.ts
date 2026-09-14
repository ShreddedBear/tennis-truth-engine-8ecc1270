import { logger } from "../../lib/logger";
import type {
  Fixture,
  MatchFormat,
  PlayerSummary,
  ProviderStatusInfo,
  Surface,
  TournamentLevel,
} from "./types";
import { ProviderUnavailableError } from "./types";

const BASE_URL = "https://api.livetennisapi.com/api/public/v1";
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;

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
  const player1Name = asString(player1?.name);
  const player2Name = asString(player2?.name);
  const player1Id = asId(player1?.id);
  const player2Id = asId(player2?.id);
  const matchId = asId(match.id);
  // Names are not identities. Reject rows without source-issued player IDs rather than
  // manufacturing an ID from the display name and later treating it as provider-backed.
  if (!matchId || !player1Name || !player2Name || !player1Id || !player2Id) return null;

  const rawStart = asString(match.scheduled_time);
  const parsedStart = rawStart ? new Date(rawStart) : null;
  const scheduledStart =
    parsedStart && !Number.isNaN(parsedStart.getTime())
      ? parsedStart.toISOString()
      : null;
  if (!scheduledStart) return null;

  const tournamentName = asString(match.tournament);
  const status = asString(match.status)?.toLowerCase();

  return {
    id: `live-tennis-${matchId}`,
    date: scheduledStart.slice(0, 10),
    scheduledStart,
    timeConfirmed: true,
    isLive: status === "live",
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

export class LiveTennisFixturesProvider {
  readonly name = "Live Tennis API";
  private cachedFixtures: Fixture[] | null = null;
  private cacheExpiresAt = 0;
  private readonly playerSearchCache = new Map<string, { expiresAt: number; players: PlayerSummary[] }>();
  private unavailableUntil = 0;
  private lastSuccessfulCallAt: string | null = null;
  private lastError: string | null = null;

  constructor(private readonly apiKey: string) {}

  getStatus(): ProviderStatusInfo {
    return {
      provider: this.name,
      connected: this.lastSuccessfulCallAt !== null,
      lastSuccessfulCallAt: this.lastSuccessfulCallAt,
      lastError: this.lastError,
    };
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${BASE_URL}/fixtures?limit=200&offset=0`, {
        headers: {
          Accept: "application/json",
          "X-API-Key": this.apiKey,
        },
        signal: controller.signal,
      });

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
      const fixtures = rows.map(mapFixture).filter((item): item is Fixture => item !== null);
      this.cachedFixtures = fixtures;
      this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      this.lastSuccessfulCallAt = new Date().toISOString();
      this.lastError = null;
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
    } finally {
      clearTimeout(timeout);
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
}
