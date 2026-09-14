import { policyForMetric } from "./metric-source-family-policy";
import { reconstructPbpScoreState, TASK18B_METRIC_CODES, type PbpSide } from "./pbp-score-state-recovery";
import { canonicalApprovedPbpIdentity, claimUniqueApprovedPbp, type ApprovedPbpTour } from "./pbp-evidence-firewall";

const BASE = "https://api.livetennisapi.com/api/public/v1";
const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

export type LiveTennisApiConfig = {
  requestsPerMinute: number;
  dailyBudget: number;
  historyPageSize: number;
  maxHistoryRowsPerPlayer: number;
  maxCandidatesPerPlayer: number;
  requestTimeoutMs: number;
  retryAttempts: number;
};

/** Pro-plan defaults; every operational limit can be lowered without a code change. */
export function liveTennisApiConfig(env: NodeJS.ProcessEnv = process.env): LiveTennisApiConfig {
  return {
    requestsPerMinute: Math.min(300, positiveInt(env.LIVE_TENNIS_API_REQUESTS_PER_MINUTE, 300)),
    dailyBudget: Math.min(10_000, positiveInt(env.LIVE_TENNIS_API_DAILY_BUDGET, 10_000)),
    historyPageSize: Math.min(100, positiveInt(env.LIVE_TENNIS_API_HISTORY_PAGE_SIZE, 25)),
    maxHistoryRowsPerPlayer: positiveInt(env.LIVE_TENNIS_API_MAX_HISTORY_ROWS_PER_PLAYER, 250),
    maxCandidatesPerPlayer: positiveInt(env.LIVE_TENNIS_API_MAX_CANDIDATES_PER_PLAYER, 20),
    requestTimeoutMs: positiveInt(env.LIVE_TENNIS_API_REQUEST_TIMEOUT_MS, 15_000),
    retryAttempts: Math.min(4, positiveInt(env.LIVE_TENNIS_API_RETRY_ATTEMPTS, 2)),
  };
}

export function liveTennisApiSourcePacketBudgetMs(env: NodeJS.ProcessEnv = process.env): number {
  return Math.max(7_000, positiveInt(env.LIVE_TENNIS_API_SOURCE_PACKET_BUDGET_MS, 45_000));
}

const DAY_MS = 24 * 60 * 60 * 1000;

let lastRequestAt = 0;
let dailyWindowStart = Date.now();
let dailyCount = 0;
let requestStartQueue: Promise<void> = Promise.resolve();

function budgetOk(): boolean {
  const now = Date.now();
  if (now - dailyWindowStart > DAY_MS) { dailyWindowStart = now; dailyCount = 0; }
  return dailyCount < liveTennisApiConfig().dailyBudget;
}

async function throttledFetch(path: string, token: string): Promise<Response> {
  const config = liveTennisApiConfig();
  let response: Response | null = null;
  for (let attempt = 0; attempt <= config.retryAttempts; attempt++) {
    if (!budgetOk()) throw new Error(classifyPbpFetchFailure({ dailyBudgetExhausted: true }));
    const scheduled = requestStartQueue.then(async () => {
      const now = Date.now();
      if (now - dailyWindowStart > DAY_MS) { dailyWindowStart = now; dailyCount = 0; }
      const minIntervalMs = Math.ceil(60_000 / config.requestsPerMinute);
      const wait = Math.max(0, lastRequestAt + minIntervalMs - Date.now());
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequestAt = Date.now();
      dailyCount++;
    });
    requestStartQueue = scheduled.catch(() => {});
    await scheduled;
    response = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "tennis-truth-engine-live-tennis-api/1.0" },
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
    if (response.status !== 429 || attempt === config.retryAttempts) return response;
    const retryAfter = Number(response.headers.get("retry-after"));
    await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) ? Math.max(0, retryAfter * 1000) : 1000 * (attempt + 1)));
  }
  return response!;
}

const norm = (v: unknown) => String(v ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// A live PBP fetch that fails and one that genuinely has no data look identical unless the
// reason is captured -- same discipline as bsd-*-pbp.server.ts's classifyPbpFetchFailure,
// adapted to this provider's real, observed error shapes (verified via live diagnostic
// calls: HTTP 400 with a `detail` message for bad param combinations, HTTP 402/401/403/404/
//429, and a documented Bearer-token 401 for auth failures).
export function classifyPbpFetchFailure(input: { status?: number; parseError?: boolean; networkError?: string; badRequest?: string; dailyBudgetExhausted?: boolean }): string {
  if (input.dailyBudgetExhausted) return `Live Tennis API configured daily request budget (${liveTennisApiConfig().dailyBudget}/day) is exhausted for this process -- a provider quota limit, not evidence this match's point-by-point data is absent.`;
  if (input.networkError) return `Live Tennis API point-by-point request failed: ${input.networkError}`;
  if (input.status === 402) return "Live Tennis API returned HTTP 402 (payment/credits required) -- a provider billing failure, not evidence this match's point-by-point data is absent.";
  if (input.status === 401 || input.status === 403) return `Live Tennis API returned HTTP ${input.status} (authentication/authorization failed).`;
  if (input.status === 429) return "Live Tennis API returned HTTP 429 (rate limited).";
  if (input.status === 404) return "Live Tennis API returned HTTP 404 (match not found or point-by-point not yet available).";
  if (typeof input.status === "number" && input.badRequest) return `Live Tennis API rejected the request (HTTP ${input.status}): ${input.badRequest}`;
  if (typeof input.status === "number") return `Live Tennis API returned HTTP ${input.status}.`;
  if (input.parseError) return "Live Tennis API point-by-point response was not valid JSON.";
  return "Live Tennis API point-by-point request failed for an unspecified reason.";
}

// Converts this provider's flat, per-point `tape` array into the same generic nested
// game/point payload shape pbp-score-state-recovery.ts's collectGames() already parses, so
// no changes are needed to that (already tested) reconstruction logic -- only this adapter
// is new. The mapping was verified against a real captured match (157791, straight sets,
// no retirement) point-by-point, not guessed from documentation:
//
//   - tape[0] is a pre-match baseline row (point_winner: null, games/sets all zero).
//   - Every later row N carries the outcome of one real point (point_winner: 1|2).
//   - A row's `games` field changes from the previous row's exactly when THAT row's own
//     point was the game-deciding point -- so that row's point_winner must be counted as
//     part of the game that just ended, not the game that follows.
//   - Immediately after a game-deciding row, `points` resets to ["0","0"] and `server`
//     flips, announcing the next game; no point has been played in it yet.
//   - `games` is organized [side][setIndex] (games won by that side within each set so
//     far), so the completed game's post-score is exactly the last element of each side's
//     array on the boundary row, and the set number is the array length before that row.
export function tapeToGamesPayload(response: unknown): { games: Array<Record<string, unknown>> } {
  const tape: any[] = Array.isArray((response as any)?.tape) ? (response as any).tape : [];
  const games: Array<Record<string, unknown>> = [];
  if (tape.length === 0) return { games };
  const mapSide = (n: unknown): "player1" | "player2" | null => (n === 1 ? "player1" : n === 2 ? "player2" : null);
  const gamesEqual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const setLen = (g: unknown): number => (Array.isArray((g as any)?.[0]) ? (g as any)[0].length : 1);
  // Index by the COMPLETED game's own set number (1-based -> 0-based), never by "last
  // element": when a game-ending point also starts a new set, the new row's games arrays
  // already grew a slot for the upcoming set, so the just-finished set's count is one
  // index before the end, not at it. Verified against a real match's actual set-1/set-2
  // boundary row (games goes from [[6],[3]] to [[6,1],[3,0]] on the same transition).
  const atSet = (arr: unknown, setIndex: number): number => (Array.isArray(arr) && arr.length > setIndex ? Number(arr[setIndex]) : 0);

  let currentServer: "player1" | "player2" = mapSide(tape[0]?.server) ?? "player1";
  let currentPoints: Array<{ winner: "player1" | "player2" }> = [];
  let priorGames: unknown = tape[0]?.games;
  let setNo = setLen(priorGames);

  for (let i = 1; i < tape.length; i++) {
    const row = tape[i];
    const winner = mapSide(row?.point_winner);
    if (winner) currentPoints.push({ winner });
    if (!gamesEqual(row?.games, priorGames)) {
      if (currentPoints.length) {
        const g0 = Array.isArray(row?.games) ? row.games[0] : undefined;
        const g1 = Array.isArray(row?.games) ? row.games[1] : undefined;
        games.push({
          set_number: setNo,
          server: currentServer,
          points: currentPoints,
          tiebreak: Boolean(row?.is_tiebreak),
          player1_games: atSet(g0, setNo - 1),
          player2_games: atSet(g1, setNo - 1),
        });
      }
      currentPoints = [];
      currentServer = mapSide(row?.server) ?? currentServer;
      setNo = setLen(row?.games);
      priorGames = row?.games;
    }
  }
  // A match that ends mid-game (retirement/walkover) leaves a trailing incomplete game;
  // keep it -- collectGames()/gameWinner() already treat a game with no resolvable winner
  // as incomplete rather than crediting either side, so this cannot fabricate a result.
  if (currentPoints.length) {
    games.push({ set_number: setNo, server: currentServer, points: currentPoints, tiebreak: false });
  }
  return { games };
}

function classifyTour(m: { gender?: unknown; tour?: unknown; round?: unknown; tournament?: unknown }): ApprovedPbpTour | null {
  const gender = norm(m.gender);
  const isWomen = gender === "women" || gender === "w" || gender === "female";
  const isMen = gender === "men" || gender === "m" || gender === "male";
  if (!isWomen && !isMen) return null;
  const blob = norm(`${m.tour ?? ""} ${m.round ?? ""} ${m.tournament ?? ""}`);
  const isChallengerTier = /(challenger|itf|futures|utr|satellite|exhibition|\bm1[0-9]\b|\bm2[0-9]\b|\bw1[0-9]\b|\bw2[0-9]\b)/.test(blob);
  const isMainTour = /(^| )(atp|wta)( |$)/.test(blob) && !isChallengerTier;
  return isMen ? (isMainTour ? "ATP_MAIN" : "ATP_CHALLENGER") : (isMainTour ? "WTA_MAIN" : "WTA_CHALLENGER");
}

export function exactPlayerIds(body: unknown, playerName: string): number[] {
  const key = norm(playerName);
  const candidates: Array<{ id?: unknown; name?: unknown; is_doubles_team?: unknown }> =
    Array.isArray((body as any)?.data) ? (body as any).data : [];
  return [...new Set(candidates
    .filter((candidate) => norm(candidate.name) === key && candidate.is_doubles_team !== true)
    .map((candidate) => Number(candidate.id))
    .filter((id) => Number.isInteger(id) && id > 0))]
    .slice(0, 5);
}

const playerIdCache = new Map<string, Promise<number[]>>();
async function resolvePlayerIds(name: string, token: string): Promise<number[]> {
  const key = norm(name);
  if (!key) return [];
  const cached = playerIdCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    if (!budgetOk()) return [];
    const tokens = key.split(" ").filter(Boolean);
    const searchTerm = tokens[tokens.length - 1] ?? key;
    try {
      const r = await throttledFetch(`/players?search=${encodeURIComponent(searchTerm)}`, token);
      if (!r.ok) return [];
      const body: any = await r.json().catch(() => null);
      // The provider currently exposes duplicate exact-name IDs for some established
      // players. Do not guess one record: search every exact non-doubles ID, then let the
      // canonical match firewall validate and deduplicate the returned match identities.
      return exactPlayerIds(body, name);
    } catch { return []; }
  })();
  playerIdCache.set(key, promise);
  promise.catch(() => playerIdCache.delete(key));
  return promise;
}

type HistoryRow = { id: number; date: string | null; gender: string | null; tour: string | null; surface: string | null; tournament: string | null; round: string | null; players: [string, string] };

export async function collectPaginatedHistory(
  fetchPage: (offset: number, limit: number) => Promise<any[]>,
  asOfDate: string,
  config: Pick<LiveTennisApiConfig, "historyPageSize" | "maxHistoryRowsPerPlayer" | "maxCandidatesPerPlayer">,
): Promise<any[]> {
  const qualifying: any[] = [];
  for (let offset = 0; offset < config.maxHistoryRowsPerPlayer && qualifying.length < config.maxCandidatesPerPlayer; offset += config.historyPageSize) {
    const rows = await fetchPage(offset, config.historyPageSize);
    qualifying.push(...rows.filter((row) => row?.outcome === "completed" && row?.scheduled_time && String(row.scheduled_time).slice(0, 10) < asOfDate));
    if (rows.length < config.historyPageSize) break;
  }
  return qualifying
    .sort((a, b) => String(b.scheduled_time).localeCompare(String(a.scheduled_time)))
    .slice(0, config.maxCandidatesPerPlayer);
}

const historyCache = new Map<string, Promise<HistoryRow[]>>();
async function discoverHistoricalMatches(playerId: number, asOfDate: string, token: string): Promise<HistoryRow[]> {
  const key = `${playerId}|${asOfDate}`;
  const cached = historyCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const config = liveTennisApiConfig();
    const qualifying = await collectPaginatedHistory(async (offset, limit) => {
      if (!budgetOk()) return [];
      try {
        const r = await throttledFetch(`/history/matches?player=${playerId}&limit=${limit}&offset=${offset}`, token);
        if (!r.ok) return [];
        const body: any = await r.json().catch(() => null);
        return Array.isArray(body?.data) ? body.data : [];
      } catch { return []; }
    }, asOfDate, config);
    return qualifying
      .map((row) => ({
        id: Number(row.id),
        date: row.scheduled_time ? String(row.scheduled_time).slice(0, 10) : null,
        gender: row?.gender ?? null,
        tour: row?.tour ?? null,
        surface: row?.surface ?? null,
        tournament: row?.tournament ?? null,
        round: row?.round ?? null,
        players: [String(row?.players?.p1?.name ?? ""), String(row?.players?.p2?.name ?? "")] as [string, string],
      }));
  })();
  historyCache.set(key, promise);
  promise.catch(() => historyCache.delete(key));
  return promise;
}

export type PbpFetchResult = { ok: true; payload: unknown } | { ok: false; reason: string };
const tapeCache = new Map<number, Promise<PbpFetchResult>>();
async function fetchTape(matchId: number, token: string): Promise<PbpFetchResult> {
  const cached = tapeCache.get(matchId);
  if (cached) return cached;
  const promise = (async (): Promise<PbpFetchResult> => {
  if (!budgetOk()) return { ok: false, reason: classifyPbpFetchFailure({ dailyBudgetExhausted: true }) };
  try {
    const r = await throttledFetch(`/history/matches/${matchId}?points=complete`, token);
    if (!r.ok) {
      let detail: string | undefined;
      try { const body: any = await r.json(); detail = body?.detail; } catch { /* no JSON body */ }
      return { ok: false, reason: classifyPbpFetchFailure({ status: r.status, badRequest: detail }) };
    }
    let body: unknown;
    try { body = await r.json(); } catch { return { ok: false, reason: classifyPbpFetchFailure({ parseError: true }) }; }
    const tape = (body as any)?.tape;
    if (!Array.isArray(tape) || tape.length === 0) return { ok: false, reason: "Live Tennis API returned an empty point-by-point tape for this match." };
    return { ok: true, payload: body };
  } catch (error) {
    return { ok: false, reason: classifyPbpFetchFailure({ networkError: error instanceof Error ? error.message : String(error) }) };
  }
  })();
  tapeCache.set(matchId, promise);
  promise.catch(() => tapeCache.delete(matchId));
  return promise;
}

type ObservationStatus = { eligible: boolean; reason: string; matches_used: number; rejected_pbp: number; source: string; fetch_failures: number; fetch_failure_sample: string | null };
type MetricLike = { code: string; name: string };
const codeOf = (v: unknown) => { const m = String(v ?? "").match(/(\d{1,3})$/); return m ? m[1].padStart(3, "0") : String(v ?? "").padStart(3, "0"); };

const observationCache = new Map<string, Promise<{ status: ObservationStatus; observations: any[] }>>();
async function computeObservations(args: { p1: string; p2: string; asOfDate: string }): Promise<{ status: ObservationStatus; observations: any[] }> {
  const key = `${norm(args.p1)}|${norm(args.p2)}|${args.asOfDate}`;
  const cached = observationCache.get(key);
  if (cached) return cached;
  const promise = (async (): Promise<{ status: ObservationStatus; observations: any[] }> => {
    const status: ObservationStatus = { eligible: true, reason: "", matches_used: 0, rejected_pbp: 0, source: "Live Tennis API", fetch_failures: 0, fetch_failure_sample: null };
    const token = process.env.Live_Tennis_Api;
    if (!token) { status.eligible = false; status.reason = "Live_Tennis_Api is not configured."; return { status, observations: [] }; }
    const [ids1, ids2] = await Promise.all([resolvePlayerIds(args.p1, token), resolvePlayerIds(args.p2, token)]);
    if (!ids1.length && !ids2.length) { status.reason = "Neither player resolved to a Live Tennis API player id."; return { status, observations: [] }; }

    const seenMatchIds = new Set<string>(), seenCanonicalKeys = new Set<string>();
    const claimed: Array<{ row: HistoryRow; identity: NonNullable<ReturnType<typeof canonicalApprovedPbpIdentity>> }> = [];
    for (const id of [...new Set([...ids1, ...ids2])]) {
      for (const row of await discoverHistoricalMatches(id, args.asOfDate, token)) {
        if (row.players.some((p) => !p)) continue;
        const tour = classifyTour(row);
        if (!tour) continue;
        const identity = canonicalApprovedPbpIdentity({ tour, player1: row.players[0], player2: row.players[1], tournament: row.tournament, date: row.date, round: row.round });
        if (!claimUniqueApprovedPbp({ matchId: row.id, identity, seenMatchIds, seenCanonicalKeys })) { status.rejected_pbp++; continue; }
        claimed.push({ row, identity: identity! });
      }
    }

    const observations: any[] = [];
    await Promise.all(claimed.map(async ({ row, identity }) => {
      const fetched = await fetchTape(row.id, token);
      if (!fetched.ok) { status.fetch_failures++; status.fetch_failure_sample ??= fetched.reason; return; }
      const payload = tapeToGamesPayload(fetched.payload);
      const recovery = reconstructPbpScoreState(payload);
      if (!recovery.valid) { status.rejected_pbp++; return; }
      for (const target of [args.p1, args.p2]) {
        const idx = row.players.findIndex((n) => norm(n) === norm(target));
        if (idx < 0) continue;
        const side: PbpSide = idx === 0 ? "player1" : "player2";
        const derived = recovery.derived[side];
        if (!Object.keys(derived).length) continue;
        observations.push({
          family: "POINT_BY_POINT", source: "Live Tennis API",
          url: `${BASE}/history/matches/${row.id}`,
          player: target, opponent: row.players[idx === 0 ? 1 : 0],
          tournament: row.tournament ?? null, event_date: row.date, surface: row.surface ?? null,
          key: "task18b_approved_pbp_score_state",
          value: { match_id: row.id, totalPoints: recovery.point_count, gamesObserved: recovery.game_count, derived, field_support: recovery.field_support },
          sample: `${recovery.point_count} parsed points; ${recovery.game_count} complete games`,
          provenance: { tour: classifyTour(row), match_id: String(row.id), canonical_match_key: identity.key, player_orientation: side, approved_only: true, approval_source: "Live Tennis API history/matches point-by-point", raw_pbp_ref: `${BASE}/history/matches/${row.id}`, parsed_point_state: true, transformation: "pbp-score-state-recovery", duplicate_match_guard: true, one_match_one_pbp: true },
        });
        status.matches_used++;
      }
    }));
    status.reason = observations.length
      ? "Live Tennis API PBP reconstructed through canonical match identity where metric-specific raw fields are satisfied."
      : "No matching Live Tennis API PBP satisfied Task 18B field requirements.";
    return { status, observations };
  })();
  observationCache.set(key, promise);
  promise.catch(() => observationCache.delete(key));
  return promise;
}

export async function buildLiveTennisApiPbpContext(args: { metrics: MetricLike[]; p1: string; p2: string; asOfDate: string; context?: string | null }) {
  const status: ObservationStatus = { eligible: false, reason: "", matches_used: 0, rejected_pbp: 0, source: "Live Tennis API", fetch_failures: 0, fetch_failure_sample: null };
  if (!args.metrics.some((metric) => TASK18B_METRIC_CODES.has(codeOf(metric.code)))) { status.reason = "No requested metric uses the point-by-point family."; return { packet: {} as Record<string, unknown>, status }; }
  const { status: computedStatus, observations } = await computeObservations(args);
  const packet: Record<string, unknown> = {};
  for (const metric of args.metrics) {
    const code = codeOf(metric.code);
    const codeRows = observations.filter((o) => Boolean(o.value?.derived?.[code]));
    if (!TASK18B_METRIC_CODES.has(code) || !codeRows.length) continue;
    const p = policyForMetric(code);
    packet[code] = {
      metric_name: metric.name,
      allowed_families: [...new Set([...p.allowed_families, "POINT_BY_POINT"])],
      sufficient_families: [...new Set([...p.sufficient_families, "POINT_BY_POINT"])],
      support_only_families: (p.support_only_families ?? []).filter((x) => x !== "POINT_BY_POINT"),
      observed_families: ["POINT_BY_POINT"],
      direct_satisfaction_allowed: false,
      observations: codeRows.slice(0, 80),
      tour_guard: "LIVE_TENNIS_API_CLASSIFIED",
      evidence_treatment: "RECONSTRUCTED_OR_TASK17_PARTIAL_ONLY",
    };
  }
  return { packet, status: { ...computedStatus } };
}
