import { logger } from "../../lib/logger";
import type {
  Fixture,
  MatchFormat,
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
  const matchId = asId(match.id);
  if (!matchId || !player1Name || !player2Name) return null;

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
    player1Id: `live-tennis-player-${asId(player1?.id) ?? player1Name}`,
    player1Name,
    player2Id: `live-tennis-player-${asId(player2?.id) ?? player2Name}`,
    player2Name,
  };
}

export class LiveTennisFixturesProvider {
  readonly name = "Live Tennis API";
  private cachedFixtures: Fixture[] | null = null;
  private cacheExpiresAt = 0;
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
}
