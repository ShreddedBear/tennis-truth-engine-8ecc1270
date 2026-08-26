export type PbpSide = "player1" | "player2";
export type PbpTour = "ATP_MAIN" | "WTA_MAIN" | "ATP_CHALLENGER" | "WTA_CHALLENGER";

export const TASK18B_METRIC_CODES = new Set([
  "004","009","026","027","031","032","033","036","037","038","039","040","069","070","071","079","002","003",
]);

export type RecoveredMetric = {
  treatment: "RECONSTRUCTED" | "PARTIAL";
  value: Record<string, number | string | boolean | null>;
  raw_fields: string[];
  transformation: string;
};

export type PbpRecovery = {
  valid: boolean;
  reason: string | null;
  game_count: number;
  point_count: number;
  derived: Record<PbpSide, Partial<Record<string, RecoveredMetric>>>;
  field_support: {
    server: boolean;
    point_winner: boolean;
    score_state: boolean;
    set_boundary: boolean;
    ace_indicator: boolean;
    double_fault_indicator: boolean;
    serve_number: false;
    rally_length: false;
    shot_type: false;
    shot_placement: false;
    handedness: false;
  };
};

type Point = { winner: PbpSide; ace: boolean | null; doubleFault: boolean | null };
type Game = { setNo: number | null; gameNo: number | null; server: PbpSide; points: Point[]; tiebreak: boolean; winner: PbpSide | null };

type SideTotals = {
  pointsWon: number; pointsLost: number; servicePoints: number; servicePointsWon: number; returnPoints: number; returnPointsWon: number;
  serviceGames: number; serviceGamesWon: number; returnGames: number; returnGamesWon: number;
  breakPointsFaced: number; breakPointsSaved: number; breakChances: number; breakPointsConverted: number;
  deucePoints: number; deucePointsWon: number; pressurePoints: number; pressurePointsWon: number;
  aces: number; aceKnownServicePoints: number; doubleFaults: number; doubleFaultKnownServicePoints: number;
  brokenServiceGames: number; breakbackOpportunities: number; breakbacks: number; closeoutOpportunities: number; closeouts: number;
};

const sides: PbpSide[] = ["player1", "player2"];
const other = (s: PbpSide): PbpSide => s === "player1" ? "player2" : "player1";
const slot = (v: unknown): PbpSide | null => {
  const s = String(v ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (["player1","p1","1","home","first"].includes(s)) return "player1";
  if (["player2","p2","2","away","second"].includes(s)) return "player2";
  return null;
};
const bool = (v: unknown): boolean | null => typeof v === "boolean" ? v : v === 1 || v === "1" || String(v ?? "").toLowerCase() === "true" ? true : v === 0 || v === "0" || String(v ?? "").toLowerCase() === "false" ? false : null;
const textBlob = (p: any) => [p?.code,p?.type,p?.result,p?.outcome,p?.description,p?.label].filter(Boolean).join(" ").toLowerCase();
function indicator(p: any, kind: "ace" | "doubleFault") {
  const explicit = kind === "ace" ? bool(p?.ace ?? p?.is_ace) : bool(p?.double_fault ?? p?.doubleFault ?? p?.is_double_fault);
  if (explicit !== null) return explicit;
  const blob = textBlob(p);
  if (!blob) return null;
  if (kind === "ace") return /(^|\W)ace($|\W)/.test(blob);
  return /double[ _-]?fault|(^|\W)df($|\W)/.test(blob);
}
function explicitSetNo(v: any): number | null {
  for (const x of [v?.set_number,v?.setNumber,v?.set_no,v?.setNo,v?.set_index,v?.setIndex]) { const n = Number(x); if (Number.isInteger(n) && n >= 0) return n === 0 ? 1 : n; }
  return null;
}
function explicitGameNo(v: any): number | null {
  for (const x of [v?.game_number,v?.gameNumber,v?.game_no,v?.gameNo,v?.game_index,v?.gameIndex]) { const n = Number(x); if (Number.isInteger(n) && n >= 0) return n === 0 ? 1 : n; }
  return null;
}
function isTiebreak(v: any) { return bool(v?.tiebreak ?? v?.tie_break ?? v?.is_tiebreak ?? v?.isTieBreak) === true; }

function collectGames(payload: any): Game[] {
  const out: Game[] = [];
  const seen = new Set<any>();
  const walk = (v: any, ctx: { setNo: number | null; gameNo: number | null }) => {
    if (!v || typeof v !== "object") return;
    if (seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, { ...ctx, gameNo: ctx.gameNo ?? i + 1 })); return; }
    if (Array.isArray(v.points)) {
      const server = slot(v.server ?? v.server_slot ?? v.serving_player ?? v.servingPlayer);
      if (server) {
        const points: Point[] = [];
        for (const p of v.points) {
          if (!p || typeof p !== "object") continue;
          const winner = slot(p.winner ?? p.point_winner ?? p.pointWinner ?? p.winner_slot ?? p.won_by);
          if (!winner) continue;
          points.push({ winner, ace: indicator(p, "ace"), doubleFault: indicator(p, "doubleFault") });
        }
        if (points.length) out.push({
          setNo: explicitSetNo(v) ?? ctx.setNo,
          gameNo: explicitGameNo(v) ?? ctx.gameNo,
          server,
          points,
          tiebreak: isTiebreak(v),
          winner: slot(v.winner ?? v.game_winner ?? v.gameWinner ?? v.winner_slot),
        });
      }
    }
    for (const [k, x] of Object.entries(v)) {
      if (k === "points") continue;
      if (Array.isArray(x) && /sets?/i.test(k)) x.forEach((item, i) => walk(item, { setNo: i + 1, gameNo: null }));
      else if (Array.isArray(x) && /games?/i.test(k)) x.forEach((item, i) => walk(item, { setNo: explicitSetNo(v) ?? ctx.setNo, gameNo: i + 1 }));
      else walk(x, { setNo: explicitSetNo(v) ?? ctx.setNo, gameNo: explicitGameNo(v) ?? ctx.gameNo });
    }
  };
  walk(payload, { setNo: null, gameNo: null });
  return out;
}

function gameWinnerFromPoints(game: Game): PbpSide | null {
  if (game.winner) return game.winner;
  if (game.tiebreak) return game.points.at(-1)?.winner ?? null;
  let a = 0, b = 0;
  for (const p of game.points) {
    if (p.winner === "player1") a++; else b++;
    if ((a >= 4 || b >= 4) && Math.abs(a - b) >= 2) return a > b ? "player1" : "player2";
  }
  return null;
}
function wouldWinGame(serverPts: number, returnPts: number, winner: "server" | "returner") {
  const s = serverPts + (winner === "server" ? 1 : 0), r = returnPts + (winner === "returner" ? 1 : 0);
  return (s >= 4 || r >= 4) && Math.abs(s - r) >= 2;
}
function wouldWinSet(ownGames: number, oppGames: number) {
  const own = ownGames + 1;
  return (own >= 6 && own - oppGames >= 2) || own === 7;
}
function emptyTotals(): SideTotals { return { pointsWon:0,pointsLost:0,servicePoints:0,servicePointsWon:0,returnPoints:0,returnPointsWon:0,serviceGames:0,serviceGamesWon:0,returnGames:0,returnGamesWon:0,breakPointsFaced:0,breakPointsSaved:0,breakChances:0,breakPointsConverted:0,deucePoints:0,deucePointsWon:0,pressurePoints:0,pressurePointsWon:0,aces:0,aceKnownServicePoints:0,doubleFaults:0,doubleFaultKnownServicePoints:0,brokenServiceGames:0,breakbackOpportunities:0,breakbacks:0,closeoutOpportunities:0,closeouts:0 }; }
const pct = (n: number, d: number) => d > 0 ? Number((100 * n / d).toFixed(4)) : 0;

export function reconstructPbpScoreState(payload: any): PbpRecovery {
  const games = collectGames(payload);
  const totals: Record<PbpSide, SideTotals> = { player1: emptyTotals(), player2: emptyTotals() };
  const pointCount = games.reduce((n, g) => n + g.points.length, 0);
  const hasSetBoundaries = games.length > 0 && games.every(g => Number.isInteger(g.setNo));
  const allGameWinners = games.every(g => Boolean(gameWinnerFromPoints(g)));
  const fieldSupport = { server: games.length > 0, point_winner: pointCount > 0, score_state: games.length > 0 && allGameWinners, set_boundary: hasSetBoundaries, ace_indicator: false, double_fault_indicator: false, serve_number: false as const, rally_length: false as const, shot_type: false as const, shot_placement: false as const, handedness: false as const };
  if (!games.length || !pointCount || !allGameWinners) return { valid:false, reason:"PBP lacks a complete server/point-winner game structure; no score-state metrics are credited.", game_count:games.length, point_count:pointCount, derived:{player1:{},player2:{}}, field_support:fieldSupport };

  const setGames = new Map<number, Record<PbpSide, number>>();
  const priorBroken = new Map<string, PbpSide>();
  for (let gi = 0; gi < games.length; gi++) {
    const game = games[gi], server = game.server, returner = other(server), winner = gameWinnerFromPoints(game)!;
    const st = totals[server], rt = totals[returner];
    st.serviceGames++; rt.returnGames++;
    if (winner === server) st.serviceGamesWon++; else { rt.returnGamesWon++; st.brokenServiceGames++; }

    let serverPts = 0, returnPts = 0;
    for (const point of game.points) {
      totals[point.winner].pointsWon++; totals[other(point.winner)].pointsLost++;
      st.servicePoints++; rt.returnPoints++;
      if (point.winner === server) st.servicePointsWon++; else rt.returnPointsWon++;
      if (point.ace !== null) { fieldSupport.ace_indicator = true; st.aceKnownServicePoints++; if (point.ace) st.aces++; }
      if (point.doubleFault !== null) { fieldSupport.double_fault_indicator = true; st.doubleFaultKnownServicePoints++; if (point.doubleFault) st.doubleFaults++; }
      if (!game.tiebreak) {
        const bp = wouldWinGame(serverPts, returnPts, "returner");
        const deuce = serverPts >= 3 && returnPts >= 3 && serverPts === returnPts;
        if (bp) { st.breakPointsFaced++; rt.breakChances++; if (point.winner === server) st.breakPointsSaved++; else rt.breakPointsConverted++; }
        if (deuce) { st.deucePoints++; rt.deucePoints++; if (point.winner === server) st.deucePointsWon++; else rt.deucePointsWon++; }
        if (bp || deuce) { st.pressurePoints++; rt.pressurePoints++; if (point.winner === server) st.pressurePointsWon++; else rt.pressurePointsWon++; }
        if (point.winner === server) serverPts++; else returnPts++;
      } else {
        st.pressurePoints++; rt.pressurePoints++; if (point.winner === server) st.pressurePointsWon++; else rt.pressurePointsWon++;
      }
    }

    if (hasSetBoundaries) {
      const sn = game.setNo!;
      const score = setGames.get(sn) ?? { player1:0, player2:0 };
      if (wouldWinSet(score[server], score[returner])) { st.closeoutOpportunities++; if (winner === server) st.closeouts++; }
      const prevKey = `${sn}:${gi-1}`;
      const broken = priorBroken.get(prevKey);
      if (broken && broken === returner && winner === returner) { totals[returner].breakbackOpportunities++; totals[returner].breakbacks++; }
      else if (broken && broken === returner) totals[returner].breakbackOpportunities++;
      if (winner === returner) priorBroken.set(`${sn}:${gi}`, server);
      score[winner]++;
      setGames.set(sn, score);
    }
  }

  const derived: Record<PbpSide, Partial<Record<string, RecoveredMetric>>> = { player1:{}, player2:{} };
  for (const s of sides) {
    const t = totals[s];
    const add = (code: string, treatment: "RECONSTRUCTED" | "PARTIAL", value: RecoveredMetric["value"], raw_fields: string[], transformation: string) => { derived[s][code] = { treatment, value, raw_fields, transformation }; };
    add("002","PARTIAL",{service_points:t.servicePoints,service_points_won:t.servicePointsWon,service_point_win_pct:pct(t.servicePointsWon,t.servicePoints),aces:fieldSupport.ace_indicator?t.aces:null,double_faults:fieldSupport.double_fault_indicator?t.doubleFaults:null,serve_number_available:false},["server","point_winner","ace/DF when encoded"],"Aggregate objective service-point outcomes only; serve-number dimensions remain unavailable.");
    add("003","PARTIAL",{return_points:t.returnPoints,return_points_won:t.returnPointsWon,return_point_win_pct:pct(t.returnPointsWon,t.returnPoints),serve_number_available:false},["server","point_winner"],"Orient each point to the non-server and aggregate return outcomes; serve-number splits are not inferred.");
    add("004","RECONSTRUCTED",{break_points:t.breakChances,converted:t.breakPointsConverted,conversion_pct:pct(t.breakPointsConverted,t.breakChances)},["server","chronological point_winner"],"Replay game score before every point and identify states where the returner would win the game on the next point.");
    add("009",hasSetBoundaries?"RECONSTRUCTED":"PARTIAL",{pressure_points:t.pressurePoints,pressure_points_won:t.pressurePointsWon,pressure_win_pct:pct(t.pressurePointsWon,t.pressurePoints),set_boundaries:hasSetBoundaries},["server","chronological point_winner","set boundary when encoded"],"Aggregate deterministically identified break-point/deuce/tiebreak pressure states; no missing late-set states are synthesized.");
    add("026","RECONSTRUCTED",{service_games:t.serviceGames,holds:t.serviceGamesWon,hold_pct:pct(t.serviceGamesWon,t.serviceGames)},["server","game winner"],"Count complete service games won by the server.");
    add("027","RECONSTRUCTED",{return_games:t.returnGames,breaks:t.returnGamesWon,break_pct:pct(t.returnGamesWon,t.returnGames)},["server","game winner"],"Count complete return games won by the returner.");
    if (fieldSupport.ace_indicator) add("031","RECONSTRUCTED",{aces:t.aces,known_service_points:t.aceKnownServicePoints,ace_rate_pct:pct(t.aces,t.aceKnownServicePoints)},["server","ace indicator"],"Count only service points whose PBP explicitly encodes ace status.");
    if (fieldSupport.double_fault_indicator) add("032","RECONSTRUCTED",{double_faults:t.doubleFaults,known_service_points:t.doubleFaultKnownServicePoints,double_fault_rate_pct:pct(t.doubleFaults,t.doubleFaultKnownServicePoints)},["server","double-fault indicator"],"Count only service points whose PBP explicitly encodes double-fault status.");
    add("033","RECONSTRUCTED",{return_points:t.returnPoints,return_points_won:t.returnPointsWon,return_points_won_pct:pct(t.returnPointsWon,t.returnPoints)},["server","point_winner"],"Orient point winner against server and aggregate return points won.");
    add("036","RECONSTRUCTED",{break_points_faced:t.breakPointsFaced,break_points_saved:t.breakPointsSaved,bp_saved_pct:pct(t.breakPointsSaved,t.breakPointsFaced)},["server","chronological point_winner"],"Replay score and count break points faced and won by server.");
    add("037","RECONSTRUCTED",{break_chances:t.breakChances,break_points_converted:t.breakPointsConverted,bp_converted_pct:pct(t.breakPointsConverted,t.breakChances)},["server","chronological point_winner"],"Replay score and count return-side break chances converted.");
    add("038","RECONSTRUCTED",{break_points_faced:t.breakPointsFaced,service_games:t.serviceGames,bp_faced_per_game:t.serviceGames?Number((t.breakPointsFaced/t.serviceGames).toFixed(4)):0},["server","chronological point_winner","game boundary"],"Divide reconstructed break points faced by complete service games.");
    add("039","RECONSTRUCTED",{break_chances:t.breakChances,return_games:t.returnGames,bp_chances_per_game:t.returnGames?Number((t.breakChances/t.returnGames).toFixed(4)):0},["server","chronological point_winner","game boundary"],"Divide reconstructed break chances by complete return games.");
    add("040","RECONSTRUCTED",{deuce_points:t.deucePoints,deuce_points_won:t.deucePointsWon,deuce_point_win_pct:pct(t.deucePointsWon,t.deucePoints)},["server","chronological point_winner"],"Replay standard-game score and count points beginning from a deuce state.");
    add("069","RECONSTRUCTED",{points_won:t.pointsWon,points_lost:t.pointsLost,dominance_ratio:t.pointsLost?Number((t.pointsWon/t.pointsLost).toFixed(4)):null},["point_winner"],"Compute player point-winner total divided by opponent point-winner total; no shot-level proxy is used.");
    if (hasSetBoundaries) {
      add("070","RECONSTRUCTED",{breakback_opportunities:t.breakbackOpportunities,breakbacks:t.breakbacks,breakback_rate_pct:pct(t.breakbacks,t.breakbackOpportunities)},["server","game winner","set boundary","chronological game order"],"Within the same set, identify the next return game after the player is broken and count immediate breaks back.");
      add("071","RECONSTRUCTED",{closeout_opportunities:t.closeoutOpportunities,closeouts:t.closeouts,closeout_rate_pct:pct(t.closeouts,t.closeoutOpportunities)},["server","game winner","set boundary","set game score"],"Before each service game, identify whether winning that game would win the set; then grade the game outcome.");
    }
    add("079",hasSetBoundaries?"RECONSTRUCTED":"PARTIAL",{pressure_points:t.pressurePoints,pressure_points_won:t.pressurePointsWon,pressure_index_pct:pct(t.pressurePointsWon,t.pressurePoints),set_boundaries:hasSetBoundaries},["server","chronological point_winner","set boundary when encoded"],"Deterministic pressure-state index over encoded break-point/deuce/tiebreak states; missing states are not imputed.");
  }
  return { valid:true, reason:null, game_count:games.length, point_count:pointCount, derived, field_support:fieldSupport };
}

export function metricHasRequiredPbpFields(recovery: PbpRecovery, code: string, side: PbpSide) {
  return Boolean(recovery.valid && recovery.derived[side][code]);
}
