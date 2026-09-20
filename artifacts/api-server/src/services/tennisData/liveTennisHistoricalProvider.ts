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

  getStatus(): ProviderStatusInfo {
    return {
      provider: this.name,
      connected: this.lastSuccessfulCallAt != null,
      lastSuccessfulCallAt: this.lastSuccessfulCallAt,
      lastError: this.lastError,
    };
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

  private unsupported(method: string): never {
    throw new ProviderUnavailableError(`${this.name} historical adapter does not implement ${method}; use it only for completed historical matches`);
  }
  async searchPlayers(): Promise<never> { return this.unsupported("searchPlayers"); }
  async getPlayer(): Promise<never> { return this.unsupported("getPlayer"); }
  async getPlayerMatches(): Promise<never> { return this.unsupported("getPlayerMatches"); }
  async getUpcomingFixtures(): Promise<never> { return this.unsupported("getUpcomingFixtures"); }
  async getUpcomingFixturesRange(): Promise<never> { return this.unsupported("getUpcomingFixturesRange"); }
  async getHeadToHead(): Promise<never> { return this.unsupported("getHeadToHead"); }
  async getLiveScores(): Promise<never> { return this.unsupported("getLiveScores"); }
}
