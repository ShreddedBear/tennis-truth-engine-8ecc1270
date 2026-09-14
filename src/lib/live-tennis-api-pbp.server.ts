import { policyForMetric } from "./metric-source-family-policy";
import { reconstructPbpScoreState, TASK18B_METRIC_CODES, type PbpSide } from "./pbp-score-state-recovery";
import { canonicalApprovedPbpIdentity, claimUniqueApprovedPbp, type ApprovedPbpTour } from "./pbp-evidence-firewall";

const BASE = "https://api.livetennisapi.com/api/public/v1";
// Basic tier: 60 req/min, 1,000 req/day (confirmed from the plan the user subscribed to).
// This lane is process-wide serialized to stay safely under the per-minute cap; a full
// slate re-audit will take real wall-clock time as a direct consequence of that cap, not a
// bug. The daily cap is tracked so this lane fails closed with a clear reason instead of
// flooding the provider with 429s once the day's budget is spent.
const MIN_INTERVAL_MS = 1100; // ~54 req/min, margin under the 60/min limit
const DAILY_BUDGET = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Kept intentionally low (vs. BSD's 12-per-player) to fit the 1,000/day budget across a
// full active-slate re-audit: 2 players x N candidates x (1 discovery call + 1 tape call
// per candidate) must fit the daily cap. Revisit if the plan is upgraded.
const MAX_CANDIDATES_PER_PLAYER = 4;

let lastRequestAt = 0;
let dailyWindowStart = Date.now();
let dailyCount = 0;

function budgetOk(): boolean {
  const now = Date.now();
  if (now - dailyWindowStart > DAY_MS) { dailyWindowStart = now; dailyCount = 0; }
  return dailyCount < DAILY_BUDGET;
}

async function throttledFetch(path: string, token: string): Promise<Response> {
  const now0 = Date.now();
  if (now0 - dailyWindowStart > DAY_MS) { dailyWindowStart = now0; dailyCount = 0; }
  const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await new Promise((res) => setTimeout(res, wait));
  lastRequestAt = Date.now();
  dailyCount++;
  return fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "tennis-truth-engine-live-tennis-api/1.0" },
    signal: AbortSignal.timeout(12000),
  });
}

const norm = (v: unknown) => String(v ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// A live PBP fetch that fails and one that genuinely has no data look identical unless the
// reason is captured -- same discipline as bsd-*-pbp.server.ts's classifyPbpFetchFailure,
// adapted to this provider's real, observed error shapes (verified via live diagnostic
// calls: HTTP 400 with a `detail` message for bad param combinations, HTTP 402/401/403/404/
//429, and a documented Bearer-token 401 for auth failures).
export function classifyPbpFetchFailure(input: { status?: number; parseError?: boolean; networkError?: string; badRequest?: string; dailyBudgetExhausted?: boolean }): string {
  if (input.dailyBudgetExhausted) return "Live Tennis API daily request budget (1,000/day, Basic tier) is exhausted for this process -- a provider quota limit, not evidence this match's point-by-point data is absent.";
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

async function resolvePlayerId(name: string, token: string): Promise<number | null> {
  const key = norm(name);
  if (!key) return null;
  if (!budgetOk()) return null;
  const tokens = key.split(" ").filter(Boolean);
  const searchTerm = tokens[tokens.length - 1] ?? key;
  try {
    const r = await throttledFetch(`/players?search=${encodeURIComponent(searchTerm)}`, token);
    if (!r.ok) return null;
    const body: any = await r.json().catch(() => null);
    const candidates: Array<{ id: number; name: string }> = Array.isArray(body?.data) ? body.data : [];
    const exact = candidates.filter((c) => norm(c.name) === key);
    // Fail closed on ambiguity: never guess between two same-named players.
    return exact.length === 1 ? exact[0].id : null;
  } catch { return null; }
}

type HistoryRow = { id: number; date: string | null; gender: string | null; tour: string | null; surface: string | null; tournament: string | null; round: string | null; players: [string, string] };

async function discoverHistoricalMatches(playerId: number, asOfDate: string, token: string): Promise<HistoryRow[]> {
  if (!budgetOk()) return [];
  try {
    const r = await throttledFetch(`/history/matches?player=${playerId}&limit=25&offset=0`, token);
    if (!r.ok) return [];
    const body: any = await r.json().catch(() => null);
    const rows: any[] = Array.isArray(body?.data) ? body.data : [];
    return rows
      .filter((row) => row?.outcome === "completed" && row?.scheduled_time && String(row.scheduled_time).slice(0, 10) < asOfDate)
      .sort((a, b) => String(b.scheduled_time).localeCompare(String(a.scheduled_time)))
      .slice(0, MAX_CANDIDATES_PER_PLAYER)
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
  } catch { return []; }
}

export type PbpFetchResult = { ok: true; payload: unknown } | { ok: false; reason: string };
async function fetchTape(matchId: number, token: string): Promise<PbpFetchResult> {
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
    const [id1, id2] = await Promise.all([resolvePlayerId(args.p1, token), resolvePlayerId(args.p2, token)]);
    if (!id1 && !id2) { status.reason = "Neither player resolved to a Live Tennis API player id."; return { status, observations: [] }; }

    const seenMatchIds = new Set<string>(), seenCanonicalKeys = new Set<string>();
    const claimed: Array<{ row: HistoryRow; identity: NonNullable<ReturnType<typeof canonicalApprovedPbpIdentity>> }> = [];
    for (const id of [id1, id2].filter((x): x is number => typeof x === "number")) {
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
