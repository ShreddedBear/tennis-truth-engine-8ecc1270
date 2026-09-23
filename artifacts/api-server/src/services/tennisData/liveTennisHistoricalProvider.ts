import {
  ProviderUnavailableError,
  type Fixture,
  type HeadToHeadRecord,
  type HistoricalFixture,
  type MatchRecord,
  type PlayerProfile,
  type PlayerSummary,
  type ProviderStatusInfo,
  type TennisDataProvider,
  type TournamentLevel,
  type Surface,
  type MatchFormat,
  type LiveScore,
} from "./types.js";

export const LIVE_TENNIS_API_BASE_URL = "https://api.livetennisapi.com/api/public/v1";
export const LIVE_TENNIS_PROVIDER_NAME = "Live Tennis API";
const PAGE_SIZE = 200;
const DEFAULT_MAX_PAGES = 100;

export function compareHistoricalFixtures(a: HistoricalFixture, b: HistoricalFixture): number {
  const byDateTime = `${a.date}T${a.time ?? "99:99"}`.localeCompare(`${b.date}T${b.time ?? "99:99"}`);
  return byDateTime || a.id.localeCompare(b.id, undefined, { numeric: true });
}

type FetchLike = (input: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function listData(body: unknown): JsonRecord[] {
  const rows = asRecord(body).data;
  return Array.isArray(rows) ? rows.map(asRecord) : [];
}

function playerFromRow(value: unknown): LiveTennisPlayer | null {
  const row = asRecord(value);
  const id = row.id;
  const name = asString(row.name);
  if ((typeof id !== "number" && typeof id !== "string") || !name) return null;
  return {
    id,
    name,
    ranking: row.ranking as number | string | null | undefined,
    tour: asString(row.tour),
    is_doubles_team: row.is_doubles_team === true,
  };
}

function matchFromRow(value: unknown): LiveTennisMatch {
  const row = asRecord(value);
  return {
    ...row,
    id: row.id as number | string | null | undefined,
    players: {
      p1: playerFromRow(asRecord(row.players).p1),
      p2: playerFromRow(asRecord(row.players).p2),
    },
    tournament: row.tournament as LiveTennisMatch["tournament"],
    score: row.score as LiveTennisMatch["score"],
  };
}

export interface LiveTennisTournamentCatalogueEntry {
  id?: string;
  name?: string | null;
  category?: string | null;
  surface?: string | null;
  tour?: string | null;
  indoor?: boolean | null;
  level?: TournamentLevel | null;
}

export interface LiveTennisHistoricalProviderOptions {
  apiKey: string;
  fetchImpl?: FetchLike;
  baseUrl?: string;
  maxPages?: number;
  tournamentCatalogue?: ReadonlyMap<string, LiveTennisTournamentCatalogueEntry>;
}

interface LiveTennisPlayer {
  id?: number | string | null;
  name?: string | null;
  ranking?: number | string | null;
  tour?: string | null;
  is_doubles_team?: boolean | null;
}

interface LiveTennisMatch {
  id?: number | string | null;
  draw?: string | null;
  event_status?: string | null;
  format?: string | null;
  gender?: string | null;
  indoor?: boolean | number | null;
  outcome?: string | null;
  players?: { p1?: LiveTennisPlayer | null; p2?: LiveTennisPlayer | null } | null;
  round?: string | null;
  round_code?: string | null;
  scheduled_time?: string | null;
  score?: { games?: unknown; sets?: unknown; [key: string]: unknown } | null;
  status?: string | null;
  surface?: string | null;
  tour?: string | null;
  tournament?: string | { name?: string | null; category?: string | null; [key: string]: unknown } | null;
  tournament_id?: string | number | null;
  winner?: number | string | null;
  [key: string]: unknown;
}

interface LiveTennisPage {
  data?: unknown;
  meta?: { count?: number; has_more?: boolean; limit?: number; offset?: number };
}

const TERMINAL_STATUSES = new Set(["completed", "cancelled", "canceled", "retired", "walkover"]);

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\w]/g, "");
}

function mapCategory(value: string | null | undefined, tour: string | null): TournamentLevel | null {
  const category = normalizeToken(value ?? "");
  const tourToken = normalizeToken(tour ?? "");
  switch (category) {
    case "grand_slam":
    case "grandslam":
      return "GrandSlam";
    case "masters_1000":
    case "masters1000":
      return "Masters1000";
    case "atp_500":
    case "atp500":
      return "ATP500";
    case "atp_250":
    case "atp250":
      return "ATP250";
    case "wta_1000":
    case "wta1000":
      return "WTA1000";
    case "wta_500":
    case "wta500":
      return "WTA500";
    case "wta_250":
    case "wta250":
      return "WTA250";
    case "challenger":
    case "wta_125":
    case "wta125":
      return "Challenger";
    case "itf":
      return "ITF";
    case "other":
      return "Other";
    default:
      // Tour alone is deliberately not sufficient to infer a level.
      return tourToken === "juniors" ? null : null;
  }
}

function mapSurface(value: string | null | undefined, indoor: boolean | null): Surface | null {
  switch (normalizeToken(value ?? "")) {
    case "hard":
      return indoor === true ? "IndoorHard" : "Hard";
    case "indoor":
    case "indoor_hard":
    case "indoorhard":
      return "IndoorHard";
    case "clay":
      return "Clay";
    case "grass":
      return "Grass";
    // The provider-neutral contract has no Carpet member. Preserve the raw value and leave it
    // explicitly unknown rather than pretending Carpet is Hard or IndoorHard.
    case "carpet":
    case "":
      return null;
    default:
      return null;
  }
}

function mapFormat(value: string | null | undefined): MatchFormat | null {
  switch (normalizeToken(value ?? "")) {
    case "bo3":
    case "bestof3":
      return "BestOf3";
    case "bo5":
    case "bestof5":
      return "BestOf5";
    default:
      return null;
  }
}

function mapTour(value: string | null | undefined): string | null {
  switch (normalizeToken(value ?? "")) {
    case "atp":
      return "ATP";
    case "wta":
      return "WTA";
    case "challenger":
      return "Challenger";
    case "itf":
      return "ITF";
    case "juniors":
      return "Juniors";
    default:
      return asString(value);
  }
}

function mapRank(value: unknown): number | null {
  const rank = typeof value === "number" ? value : Number(value);
  return Number.isInteger(rank) && rank > 0 ? rank : null;
}

function mapGames(value: unknown): Array<{ player1Games: number; player2Games: number }> {
  if (!Array.isArray(value) || value.length !== 2) return [];
  const p1 = value[0];
  const p2 = value[1];
  if (!Array.isArray(p1) || !Array.isArray(p2) || p1.length !== p2.length) return [];
  const margins: Array<{ player1Games: number; player2Games: number }> = [];
  for (let i = 0; i < p1.length; i++) {
    const player1Games = Number(p1[i]);
    const player2Games = Number(p2[i]);
    if (!Number.isFinite(player1Games) || !Number.isFinite(player2Games)) return [];
    margins.push({ player1Games, player2Games });
  }
  return margins;
}

function mapScore(score: LiveTennisMatch["score"], games: Array<{ player1Games: number; player2Games: number }>): string | null {
  if (!games.length) return null;
  return games.map(({ player1Games, player2Games }) => `${player1Games}-${player2Games}`).join(" ");
}

export type LiveTennisExclusionReason =
  | "missing_id"
  | "non_singles"
  | "doubles_team"
  | "missing_players"
  | "missing_scheduled_time"
  | "nonterminal";

export function getLiveTennisHistoricalMatchExclusionReason(row: LiveTennisMatch): LiveTennisExclusionReason | null {
  if (!asString(row.id)) return "missing_id";
  if (normalizeToken(row.draw ?? "") !== "singles") return "non_singles";
  if (row.players?.p1?.is_doubles_team === true || row.players?.p2?.is_doubles_team === true) return "doubles_team";
  if (!row.players?.p1?.id || !row.players?.p2?.id || !row.players?.p1?.name || !row.players?.p2?.name) return "missing_players";
  if (!parseTime(asString(row.scheduled_time))) return "missing_scheduled_time";
  const status = normalizeToken(row.status ?? row.outcome ?? row.event_status ?? "");
  if (!TERMINAL_STATUSES.has(status)) return "nonterminal";
  return null;
}

function parseTime(scheduledTime: string | null): { date: string; time: string | null } | null {
  if (!scheduledTime) return null;
  const timestamp = Date.parse(scheduledTime);
  if (!Number.isFinite(timestamp)) return null;
  return {
    date: new Date(timestamp).toISOString().slice(0, 10),
    time: new Date(timestamp).toISOString().slice(11, 16),
  };
}

function tournamentFields(row: LiveTennisMatch, catalogue: ReadonlyMap<string, LiveTennisTournamentCatalogueEntry>) {
  const tournamentObject = row.tournament && typeof row.tournament === "object" ? row.tournament : null;
  const tournamentName = tournamentObject?.name ?? (typeof row.tournament === "string" ? row.tournament : null);
  const tournamentId = asString(row.tournament_id);
  const catalogueEntry = tournamentId ? catalogue.get(tournamentId) : undefined;
  const hasObjectCategory = tournamentObject != null && Object.prototype.hasOwnProperty.call(tournamentObject, "category");
  const category = hasObjectCategory ? (tournamentObject?.category ?? null) : (catalogueEntry?.category ?? null);
  return {
    tournamentName: asString(tournamentName),
    tournamentId,
    category: asString(category),
    categorySource: hasObjectCategory
      ? "match.tournament.category"
      : catalogueEntry
        ? "supplied-tournament-catalogue"
        : null,
    explicitLevel: catalogueEntry?.level ?? null,
  };
}

export function normalizeLiveTennisHistoricalMatch(
  row: LiveTennisMatch,
  options: { tournamentCatalogue?: ReadonlyMap<string, LiveTennisTournamentCatalogueEntry> } = {},
): HistoricalFixture | null {
  const id = asString(row.id);
  const p1 = row.players?.p1;
  const p2 = row.players?.p2;
  const status = normalizeToken(row.status ?? row.outcome ?? row.event_status ?? "");
  const scheduled = parseTime(asString(row.scheduled_time));
  if (getLiveTennisHistoricalMatchExclusionReason(row)) return null;
  if (!id || !p1?.id || !p2?.id || !p1.name || !p2.name || !scheduled) return null;

  const indoor = row.indoor == null ? null : row.indoor === true || row.indoor === 1;
  const tournament = tournamentFields(row, options.tournamentCatalogue ?? new Map());
  const tour = mapTour(row.tour ?? p1.tour);
  const level = tournament.explicitLevel ?? mapCategory(tournament.category, tour);
  const winnerNumber = Number(row.winner);
  const winnerId =
    winnerNumber === 1 ? String(p1.id) :
      winnerNumber === 2 ? String(p2.id) :
        asString(row.winner);
  const games = mapGames(row.score?.games);
  const cancelled = status === "cancelled" || status === "canceled";
  const retired = status === "retired" || /retir/i.test(String(row.event_status ?? ""));
  const walkover = status === "walkover" || /walkover/i.test(String(row.event_status ?? ""));

  return {
    id,
    provider: LIVE_TENNIS_PROVIDER_NAME,
    date: scheduled.date,
    time: scheduled.time,
    tour,
    tournamentName: tournament.tournamentName,
    tournamentLevel: level,
    round: asString(row.round_code) ?? asString(row.round),
    surface: mapSurface(asString(row.surface), indoor),
    matchFormat: mapFormat(asString(row.format)),
    player1Id: String(p1.id),
    player1Name: p1.name,
    player2Id: String(p2.id),
    player2Name: p2.name,
    winnerId: cancelled ? null : winnerId,
    score: mapScore(row.score, games),
    retired,
    walkover,
    cancelled,
    setGameMargins: games,
    indoor,
    player1Rank: mapRank(p1.ranking),
    player2Rank: mapRank(p2.ranking),
    raw: {
      source: LIVE_TENNIS_PROVIDER_NAME,
      endpoint: "/history/matches",
      fieldProvenance: {
        id: "match.id",
        scheduledTime: "match.scheduled_time",
        players: "match.players.p1/p2",
        winner: "match.winner",
        tournament: "match.tournament",
        tournamentId: "match.tournament_id",
        category: tournament.categorySource,
        surface: "match.surface",
        format: "match.format",
        round: row.round_code != null ? "match.round_code" : "match.round",
        score: "match.score.games",
      },
      payload: row,
    },
  };
}

function fixturePlayerId(player: LiveTennisPlayer): string {
  return asString(player.id) ?? `lta-unresolved-${(player.name ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

/**
 * PRESERVED EXACTLY as it was before the discovery-normalizer investigation (bit-for-bit
 * identical to commit 78e76db, before 8ab9c9f touched this file) -- this is what
 * `getUpcomingFixturesRange`/`getUpcomingFixtures` (the `TennisDataProvider` interface methods)
 * still use below, so the Prediction Engine's live paper-trading fixture-discovery contract
 * (`services/evaluation/paperTrading.ts`) is byte-for-byte unchanged, bug included. It reads a
 * nested `players.p1/p2` + `scheduled_time` shape that the real `/fixtures` endpoint does NOT
 * actually have (see normalizeLiveFixtureRow's doc comment below for the real shape) -- which is
 * exactly why this always returns zero fixtures for `/fixtures` rows, unchanged from before.
 * Left in place deliberately rather than "fixed", because fixing it would change a
 * production-critical Prediction Engine behavior that was never authorized to change.
 */
function normalizeLiveFixture(row: LiveTennisMatch): Fixture | null {
  const p1 = row.players?.p1;
  const p2 = row.players?.p2;
  const scheduledTime = asString(row.scheduled_time);
  const timestamp = scheduledTime ? Date.parse(scheduledTime) : NaN;
  if (!p1?.name || !p2?.name || !Number.isFinite(timestamp)) return null;
  const tournament = tournamentFields(row, new Map());
  const indoor = row.indoor == null ? null : row.indoor === true || row.indoor === 1;
  const status = normalizeToken(row.status ?? row.event_status ?? "");
  return {
    id: asString(row.id) ?? `lta-match-${fixturePlayerId(p1)}-${fixturePlayerId(p2)}-${timestamp}`,
    date: new Date(timestamp).toISOString().slice(0, 10),
    scheduledStart: new Date(timestamp).toISOString(),
    timeConfirmed: true,
    isLive: status === "live",
    tournamentName: tournament.tournamentName,
    tournamentLevel: mapCategory(tournament.category, mapTour(row.tour ?? p1.tour)),
    round: asString(row.round_code) ?? asString(row.round),
    surface: mapSurface(asString(row.surface), indoor),
    indoor,
    matchFormat: mapFormat(asString(row.format)),
    player1Id: fixturePlayerId(p1),
    player1Name: p1.name,
    player2Id: fixturePlayerId(p2),
    player2Name: p2.name,
  };
}

/**
 * The `/fixtures` endpoint's row shape is structurally DIFFERENT from `/history/matches` and
 * `/matches` (which both use a nested `players: { p1, p2 }` object plus `scheduled_time` --
 * confirmed by direct live-API inspection: `/fixtures` returns FLAT `player1_id`/`player1_name`/
 * `player2_id`/`player2_name` and a `start_time` field, never a `players` object or
 * `scheduled_time`, and never a `format`/matchFormat field at all).
 *
 * DELIBERATELY NOT wired into `getUpcomingFixtures`/`getUpcomingFixturesRange` (the
 * `TennisDataProvider` interface methods) -- those are shared with the Prediction Engine's live
 * paper-trading discovery (`services/evaluation/paperTrading.ts`), which requires
 * `fixture.matchFormat` to lock a prediction. Since `/fixtures` never supplies matchFormat, wiring
 * this normalizer into the interface methods would not fabricate a value (this function never
 * does), but it WOULD change Prediction Engine's fixture-discovery behavior from "always empty" to
 * "populated but always skipped at the matchFormat gate" -- a real behavior change to a
 * production-critical path that was never authorized. `getUpcomingFixturesForBuilder`/
 * `getUpcomingFixturesRangeForBuilder` below are the ONLY callers of this function -- a separate,
 * Builder-only entry point on this same class, reusing the same HTTP client/auth but never
 * touching the shared interface methods Prediction Engine depends on.
 */
interface LiveTennisFixtureRow {
  id?: number | string | null;
  player1_id?: number | string | null;
  player1_name?: string | null;
  player2_id?: number | string | null;
  player2_name?: string | null;
  start_time?: string | null;
  round?: string | null;
  round_code?: string | null;
  status?: string | null;
  surface?: string | null;
  tour?: string | null;
  tournament?: string | { name?: string | null; category?: string | null; [key: string]: unknown } | null;
  tournament_id?: string | number | null;
  [key: string]: unknown;
}

export function normalizeLiveFixtureRow(value: unknown): Fixture | null {
  const row = asRecord(value) as LiveTennisFixtureRow;
  const id = asString(row.id);
  const player1Name = asString(row.player1_name);
  const player2Name = asString(row.player2_name);
  const scheduledTime = asString(row.start_time);
  const timestamp = scheduledTime ? Date.parse(scheduledTime) : NaN;
  // Never fabricate identity or a timestamp when the provider didn't supply a real one -- a
  // missing/malformed field means this row is excluded, not guessed at.
  if (!id || !player1Name || !player2Name || !Number.isFinite(timestamp)) return null;

  const tournament = tournamentFields(row as unknown as LiveTennisMatch, new Map());
  const tour = mapTour(row.tour);
  // `/fixtures` rows never carry an explicit {name, category} tournament object (unlike
  // history rows) -- `row.tour` (e.g. "challenger") is the only category-shaped signal available,
  // and mapCategory already treats "challenger" as a real category value.
  const status = normalizeToken(asString(row.status) ?? "");

  return {
    id,
    date: new Date(timestamp).toISOString().slice(0, 10),
    scheduledStart: new Date(timestamp).toISOString(),
    timeConfirmed: true,
    isLive: status === "live",
    tournamentName: tournament.tournamentName,
    tournamentLevel: mapCategory(tournament.category ?? row.tour, tour),
    round: asString(row.round_code) ?? asString(row.round),
    surface: mapSurface(asString(row.surface), null),
    indoor: null,
    matchFormat: null,
    player1Id: fixturePlayerId({ id: row.player1_id, name: player1Name }),
    player1Name,
    player2Id: fixturePlayerId({ id: row.player2_id, name: player2Name }),
    player2Name,
  };
}

function normalizeLiveScore(row: JsonRecord): LiveScore | null {
  const score = asRecord(row.score);
  const games = mapGames(score.games);
  const setsRaw = score.sets;
  const sets = Array.isArray(setsRaw) && setsRaw.every((v) => Number.isFinite(Number(v)))
    ? setsRaw.map((v, i) => ({ player1Games: Number(v), player2Games: games[i]?.player2Games ?? 0 }))
    : games;
  if (!games.length && !sets.length) return null;
  return {
    sets,
    statusText: asString(row.event_status) ?? asString(row.status),
  };
}

export class LiveTennisHistoricalProvider implements TennisDataProvider {
  readonly name = LIVE_TENNIS_PROVIDER_NAME;
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;
  private readonly maxPages: number;
  private readonly tournamentCatalogue: ReadonlyMap<string, LiveTennisTournamentCatalogueEntry>;
  private lastSuccessfulCallAt: string | null = null;
  private lastError: string | null = null;
  private lastCatalogueRequests = 0;

  constructor(options: LiveTennisHistoricalProviderOptions) {
    if (!options.apiKey.trim()) throw new Error("Live Tennis API key is required");
    this.fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
    this.baseUrl = (options.baseUrl ?? LIVE_TENNIS_API_BASE_URL).replace(/\/+$/, "");
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
    if (!Number.isInteger(this.maxPages) || this.maxPages < 1) throw new Error("maxPages must be a positive integer");
    this.tournamentCatalogue = options.tournamentCatalogue ?? new Map();
    this.apiKey = options.apiKey;
  }

  private readonly apiKey: string;

  private async request(path: string, params: Record<string, string | number | undefined> = {}): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    try {
      const response = await this.fetchImpl(url.toString(), {
        headers: { "X-API-Key": this.apiKey, Accept: "application/json" },
      });
      if (!response.ok) {
        throw new ProviderUnavailableError(
          response.status === 403
            ? `${this.name} endpoint unavailable for the current subscription (${path}; upgrade_required)`
            : `${this.name} request failed (${path}; HTTP ${response.status})`,
        );
      }
      const body = await response.json();
      this.lastSuccessfulCallAt = new Date().toISOString();
      this.lastError = null;
      return body;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      if (error instanceof ProviderUnavailableError) throw error;
      throw new ProviderUnavailableError(`${this.name} request failed (${path}): ${this.lastError}`);
    }
  }

  getStatus(): ProviderStatusInfo {
    return {
      provider: this.name,
      connected: this.lastSuccessfulCallAt != null,
      lastSuccessfulCallAt: this.lastSuccessfulCallAt,
      lastError: this.lastError,
    };
  }

  async searchPlayers(query: string): Promise<PlayerSummary[]> {
    const rows = listData(await this.request("/players", { search: query, limit: 50, offset: 0 }));
    return rows.flatMap((row) => {
      const player = playerFromRow(row);
      // This resolver is for singles identities. The provider also returns doubles-team
      // records such as "Partner / Pyotr Nesterov", which create false ambiguity for an
      // otherwise unique singles player.
      if (!player?.name || player.is_doubles_team === true || player.name.includes("/")) return [];
      return [{
        id: String(player.id),
        name: player.name,
        countryCode: asString(row.country),
        currentRank: mapRank(row.ranking),
        tour: mapTour(player.tour),
      }];
    });
  }

  async getPlayer(playerId: string): Promise<PlayerProfile | null> {
    const row = asRecord(await this.request(`/players/${encodeURIComponent(playerId)}`));
    const player = playerFromRow(row);
    if (!player) return null;
    return {
      id: String(player.id),
      name: player.name!,
      countryCode: asString(row.country),
      currentRank: mapRank(row.ranking),
      tour: mapTour(player.tour),
      age: null,
      plays: asString(row.hand),
      fullName: player.name!,
    };
  }

  // TennisDataProvider interface methods -- shared with the Prediction Engine's live
  // paper-trading discovery (paperTrading.ts). Deliberately UNCHANGED from before the discovery
  // investigation (uses the old nested-shape normalizeLiveFixture, matchFromRow) -- see that
  // function's doc comment. Builder must use getUpcomingFixturesForBuilder(Range) below instead.
  async getUpcomingFixturesRange(dateStart: string, dateStop: string): Promise<Fixture[]> {
    const rows = listData(await this.request("/fixtures", { tour: undefined, draw: "singles", limit: 200, offset: 0 }));
    return rows.map(matchFromRow).map(normalizeLiveFixture).filter((fixture): fixture is Fixture => fixture !== null)
      .filter((fixture) => fixture.date >= dateStart && fixture.date <= dateStop);
  }

  async getUpcomingFixtures(date: string): Promise<Fixture[]> {
    return this.getUpcomingFixturesRange(date, date);
  }

  /**
   * Builder-only entry point (NOT part of the TennisDataProvider interface, so Prediction
   * Engine's paperTrading.ts -- which only ever holds a TennisDataProvider-typed reference from
   * getTennisDataProvider() -- has no way to reach this, even accidentally). Same `/fixtures`
   * request as getUpcomingFixturesRange above, but normalized with normalizeLiveFixtureRow, which
   * reads the endpoint's REAL flat row shape correctly instead of the nested shape that endpoint
   * never actually returns. Callers must be obtained via getLiveTennisProvider() (a fresh,
   * uncached LiveTennisHistoricalProvider instance), never via getTennisDataProvider()'s shared
   * singleton, to keep this fully unreachable from the Prediction Engine's code path.
   */
  async getUpcomingFixturesRangeForBuilder(dateStart: string, dateStop: string): Promise<Fixture[]> {
    const rows = listData(await this.request("/fixtures", { tour: undefined, draw: "singles", limit: 200, offset: 0 }));
    return rows.map(normalizeLiveFixtureRow).filter((fixture): fixture is Fixture => fixture !== null)
      .filter((fixture) => fixture.date >= dateStart && fixture.date <= dateStop);
  }

  async getUpcomingFixturesForBuilder(date: string): Promise<Fixture[]> {
    return this.getUpcomingFixturesRangeForBuilder(date, date);
  }

  async getLiveScores(fixtureIds: string[]): Promise<Map<string, LiveScore>> {
    const result = new Map<string, LiveScore>();
    await Promise.all(fixtureIds.map(async (fixtureId) => {
      if (fixtureId.startsWith("espn-") || fixtureId.startsWith("sf-") || fixtureId.startsWith("lta-unresolved-")) return;
      try {
        const row = asRecord(await this.request(`/matches/${encodeURIComponent(fixtureId)}/score`));
        const score = normalizeLiveScore(row);
        if (score) result.set(fixtureId, score);
      } catch (error) {
        if (!(error instanceof ProviderUnavailableError)) throw error;
      }
    }));
    return result;
  }

  async getPlayerMatches(playerId: string): Promise<MatchRecord[]> {
    const rows: JsonRecord[] = [];
    const seenRawIds = new Set<string>();
    let offset = 0;
    for (let page = 0; page < this.maxPages; page++) {
      const body = asRecord(await this.request("/matches", {
        status: "completed",
        player: playerId,
        draw: "singles",
        limit: PAGE_SIZE,
        offset,
      }));
      const pageRows = listData(body);
      for (const raw of pageRows) {
        const id = asString(raw.id);
        if (id && seenRawIds.has(id)) continue;
        if (id) seenRawIds.add(id);
        rows.push(raw);
      }
      const meta = asRecord(body.meta);
      const hasMore = meta.has_more === true;
      if (!hasMore) break;
      if (page === this.maxPages - 1) {
        throw new ProviderUnavailableError(`${this.name} player history pagination exceeded maxPages=${this.maxPages}`);
      }
      const nextOffset = Number(meta.offset) + Number(meta.count ?? pageRows.length);
      offset = Number.isFinite(nextOffset) && nextOffset > offset ? nextOffset : offset + pageRows.length;
      if (pageRows.length === 0) {
        throw new ProviderUnavailableError(`${this.name} player history pagination made no progress`);
      }
    }
    const records: MatchRecord[] = [];
    for (const raw of rows) {
      const row = matchFromRow(raw);
      const fixture = normalizeLiveTennisHistoricalMatch(row);
      if (!fixture) continue;
      const isP1 = fixture.player1Id === playerId;
      const opponentId = isP1 ? fixture.player2Id : fixture.player1Id;
      const opponentName = isP1 ? fixture.player2Name : fixture.player1Name;
      const winner = fixture.winnerId === playerId;
      records.push({
        id: fixture.id,
        date: fixture.date,
        tournamentName: fixture.tournamentName,
        tournamentLevel: fixture.tournamentLevel,
        round: fixture.round,
        matchFormat: fixture.matchFormat,
        surface: fixture.surface,
        indoor: fixture.indoor,
        opponentId,
        opponentName,
        opponentRank: isP1 ? fixture.player2Rank : fixture.player1Rank,
        result: winner ? "W" : "L",
        score: fixture.score,
        retired: fixture.retired,
        walkover: fixture.walkover,
        stats: null,
        opponentStats: null,
        setGameMargins: fixture.setGameMargins.map((set) => ({
          playerGames: isP1 ? set.player1Games : set.player2Games,
          opponentGames: isP1 ? set.player2Games : set.player1Games,
        })),
      });
    }
    return records;
  }

  async getHeadToHead(player1Id: string, player2Id: string): Promise<HeadToHeadRecord> {
    const [p1, p2] = await Promise.all([this.getPlayer(player1Id), this.getPlayer(player2Id)]);
    if (!p1?.name || !p2?.name) return { player1Id, player2Id, meetings: [] };
    const body = asRecord(await this.request("/h2h", { p1: p1.name, p2: p2.name }));
    const meetings = Array.isArray(body.meetings) ? body.meetings.map(asRecord).flatMap((meeting) => {
      const date = asString(meeting.date);
      const winner = Number(meeting.winner);
      if (!date || (winner !== 1 && winner !== 2)) return [];
      return [{
        date,
        tournamentName: asString(meeting.tournament),
        surface: mapSurface(asString(meeting.surface), null),
        score: asString(meeting.score),
        winnerId: winner === 1 ? player1Id : player2Id,
      }];
    }) : [];
    return { player1Id, player2Id, meetings };
  }

  async findTournamentSurfaceByName(name: string): Promise<{
    surface: Surface | null;
    level: TournamentLevel | null;
    canonicalName?: string | null;
    tour?: "ATP" | "WTA" | null;
    bestOf?: MatchFormat | null;
    round?: string | null;
  } | null> {
    const wanted = normalizeToken(name);
    const catalogue = await this.getTournamentCatalogue();
    const matches = [...catalogue.values()].filter((entry) => normalizeToken(entry.name ?? "") === wanted);
    if (matches.length !== 1) return null;
    const match = matches[0];
    return {
      surface: mapSurface(match.surface, match.indoor === true ? true : null),
      level: match.level ?? mapCategory(match.category, match.tour ?? null),
      canonicalName: match.name ?? null,
      tour: normalizeToken(match.tour ?? "") === "atp" ? "ATP" : normalizeToken(match.tour ?? "") === "wta" ? "WTA" : null,
      bestOf: null,
      round: null,
    };
  }

  async getCurrentStandings(): Promise<Array<{ playerKey: string; rank: number; name: string; tour: "ATP" | "WTA" }>> {
    const standings: Array<{ playerKey: string; rank: number; name: string; tour: "ATP" | "WTA" }> = [];
    for (const tour of ["atp", "wta"] as const) {
      const body = await this.request("/rankings", { system: tour, limit: 500, offset: 0 });
      for (const row of listData(body)) {
        const player = playerFromRow(asRecord(row).player ?? row);
        const rank = mapRank(asRecord(row).rank ?? asRecord(row).ranking ?? player?.ranking);
        if (!player || !rank) continue;
        standings.push({ playerKey: String(player.id), rank, name: player.name!, tour: tour.toUpperCase() as "ATP" | "WTA" });
      }
    }
    return standings;
  }

  async getCompletedMatchesByDateRange(dateStart: string, dateStop: string): Promise<HistoricalFixture[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStart) || !/^\d{4}-\d{2}-\d{2}$/.test(dateStop) || dateStart > dateStop) {
      throw new Error("Live Tennis historical date range must be inclusive YYYY-MM-DD with dateStart <= dateStop");
    }
    const audit = await this.fetchReadOnlyRows(dateStart, dateStop);
    return audit.fixtures;
  }

  /**
   * Fetch the stable tournament catalogue without writing it anywhere. Duplicate IDs use the
   * first deterministic occurrence, and an explicit null category remains null.
   */
  async getTournamentCatalogue(): Promise<Map<string, LiveTennisTournamentCatalogueEntry>> {
    const catalogue = new Map<string, LiveTennisTournamentCatalogueEntry>();
    let offset = 0;
    let hasMore = false;
    let requests = 0;
    try {
      for (let page = 0; page < this.maxPages; page++) {
        const url = new URL(`${this.baseUrl}/tournaments`);
        url.searchParams.set("limit", String(PAGE_SIZE));
        url.searchParams.set("offset", String(offset));
        const response = await this.fetchImpl(url.toString(), { headers: { "X-API-Key": this.apiKey, Accept: "application/json" } });
        requests++;
        if (!response.ok) throw new ProviderUnavailableError(`Live Tennis API tournament catalogue request failed (${response.status})`);
        const body = await response.json() as LiveTennisPage;
        const rows = Array.isArray(body.data) ? body.data as Array<Record<string, unknown>> : [];
        for (const row of rows) {
          const id = asString(row.id);
          if (!id || catalogue.has(id)) continue;
          catalogue.set(id, {
            id,
            name: asString(row.name),
            category: Object.prototype.hasOwnProperty.call(row, "category") ? asString(row.category) : null,
            surface: asString(row.surface),
            tour: asString(row.tour),
            indoor: typeof row.indoor === "boolean" ? row.indoor : null,
            level: null,
          });
        }
        hasMore = body.meta?.has_more === true;
        if (!hasMore || rows.length === 0) break;
        offset += rows.length;
      }
      if (hasMore) throw new ProviderUnavailableError(`Live Tennis API tournament pagination exceeded maxPages=${this.maxPages}`);
      this.lastSuccessfulCallAt = new Date().toISOString();
      this.lastError = null;
      this.lastCatalogueRequests = requests;
      return catalogue;
    } catch (error) {
      this.lastCatalogueRequests = requests;
      this.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Read-only audit surface for the standalone validation script. Raw rows remain in memory only;
   * callers receive aggregate-ready rows and normalized fixtures, never a persistence hook.
   */
  async getReadOnlyAudit(dateStart: string, dateStop: string): Promise<{
    rawRows: number;
    fixtures: HistoricalFixture[];
    exclusions: Record<LiveTennisExclusionReason, number>;
    historyRequests: number;
    catalogueRequests: number;
    totalRequests: number;
  }> {
    const catalogue = await this.getTournamentCatalogue();
    const audit = await this.fetchReadOnlyRowsWithCatalogue(dateStart, dateStop, catalogue);
    return {
      rawRows: audit.rawRows,
      fixtures: audit.fixtures,
      exclusions: audit.exclusions,
      historyRequests: audit.historyRequests,
      catalogueRequests: this.lastCatalogueRequests,
      totalRequests: audit.historyRequests + this.lastCatalogueRequests,
    };
  }

  private async fetchReadOnlyRows(dateStart: string, dateStop: string): Promise<{
    rawRows: number;
    fixtures: HistoricalFixture[];
    exclusions: Record<LiveTennisExclusionReason, number>;
    requests: number;
  }> {
    const audit = await this.fetchReadOnlyRowsWithCatalogue(dateStart, dateStop, this.tournamentCatalogue);
    return { ...audit, requests: audit.historyRequests };
  }

  private async fetchReadOnlyRowsWithCatalogue(
    dateStart: string,
    dateStop: string,
    tournamentCatalogue: ReadonlyMap<string, LiveTennisTournamentCatalogueEntry>,
  ): Promise<{
    rawRows: number;
    fixtures: HistoricalFixture[];
    exclusions: Record<LiveTennisExclusionReason, number>;
    historyRequests: number;
    catalogueRequests: number;
    totalRequests: number;
  }> {
    const deduped = new Map<string, LiveTennisMatch>();
    let rawRowsCount = 0;
    const exclusions: Record<LiveTennisExclusionReason, number> = {
      missing_id: 0,
      non_singles: 0,
      doubles_team: 0,
      missing_players: 0,
      missing_scheduled_time: 0,
      nonterminal: 0,
    };
    let offset = 0;
    let requests = 0;
    try {
      let hasMore = false;
      for (let page = 0; page < this.maxPages; page++) {
        const url = new URL(`${this.baseUrl}/history/matches`);
        url.searchParams.set("from", dateStart);
        url.searchParams.set("to", dateStop);
        url.searchParams.set("draw", "singles");
        url.searchParams.set("limit", String(PAGE_SIZE));
        url.searchParams.set("offset", String(offset));
        const response = await this.fetchImpl(url.toString(), { headers: { "X-API-Key": this.apiKey, Accept: "application/json" } });
        requests++;
        if (!response.ok) throw new ProviderUnavailableError(`Live Tennis API historical request failed (${response.status})`);
        const body = await response.json() as LiveTennisPage;
        const rows = Array.isArray(body.data) ? body.data as LiveTennisMatch[] : [];
        rawRowsCount += rows.length;
        for (const row of rows) {
          const id = asString(row.id) ?? `__missing_id_${rawRowsCount}`;
          deduped.set(id, row);
        }
        this.lastSuccessfulCallAt = new Date().toISOString();
        this.lastError = null;
        hasMore = body.meta?.has_more === true;
        if (!hasMore || rows.length === 0) break;
        offset += rows.length;
      }
      if (hasMore) throw new ProviderUnavailableError(`Live Tennis API pagination exceeded maxPages=${this.maxPages}`);
      const fixtures: HistoricalFixture[] = [];
      for (const row of deduped.values()) {
        const reason = getLiveTennisHistoricalMatchExclusionReason(row);
        if (reason) {
          exclusions[reason]++;
          continue;
        }
        const fixture = normalizeLiveTennisHistoricalMatch(row, { tournamentCatalogue });
        if (fixture) fixtures.push(fixture);
      }
      fixtures.sort(compareHistoricalFixtures);
      return {
        rawRows: rawRowsCount,
        fixtures,
        exclusions,
        historyRequests: requests,
        catalogueRequests: 0,
        totalRequests: requests,
      };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

}
