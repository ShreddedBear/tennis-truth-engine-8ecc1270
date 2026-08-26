import { normalizeEvidenceIdentity } from "./evidence-player-alias";
import type { EvidenceTourFamily } from "./evidence-match-identity";

export type HistoryEntry = [unknown, unknown, unknown, unknown, unknown, unknown, unknown];
export type HistoryLane = Record<string, HistoryEntry[]>;
export type HistoryMetricCode = "001" | "005" | "007" | "021" | "061";

export type HistoryMetricResult = {
  p1_value: string;
  p2_value: string;
  differential: string | null;
  treatment: "RECONSTRUCTED" | "PARTIAL";
  reliability: number;
  unavailable_reason: string | null;
  sample: string;
  source_names: string[];
};

type Match = {
  key: string;
  date: string;
  tournament: string;
  surface: string;
  round: string;
  p1: string;
  p2: string;
  winner: string;
  source: string;
};

type Perspective = {
  date: string;
  tournament: string;
  surface: string;
  round: string;
  player: string;
  opponent: string;
  won: boolean;
  pre_elo: number;
  opponent_pre_elo: number;
  pre_surface_elo: number;
  opponent_pre_surface_elo: number;
};

type Replay = {
  overall: Map<string, number>;
  surface: Map<string, Map<string, number>>;
  perspectives: Perspective[];
  source_names: string[];
};

const DAY_MS = 86_400_000;
const K = 32;

function dateOk(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").slice(0, 10));
}
function daysBefore(date: string, asOfDate: string) {
  return Math.floor((Date.parse(`${asOfDate}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS);
}
function surfaceKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}
function roundOrder(value: string) {
  const v = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const order: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, R128: 10, R64: 20, R32: 30, R16: 40, QF: 50, SF: 60, F: 70 };
  return order[v] ?? 35;
}
function expected(a: number, b: number) {
  return 1 / (1 + 10 ** ((b - a) / 400));
}
function update(a: number, b: number, aWon: boolean) {
  const score = aWon ? 1 : 0;
  const nextA = a + K * (score - expected(a, b));
  const nextB = b + K * ((1 - score) - expected(b, a));
  return [nextA, nextB] as const;
}
function getSurfaceRating(store: Map<string, Map<string, number>>, surface: string, player: string) {
  let bucket = store.get(surface);
  if (!bucket) { bucket = new Map(); store.set(surface, bucket); }
  return { bucket, rating: bucket.get(player) ?? 1500 };
}
function pct(wins: number, total: number) {
  return total ? Number((100 * wins / total).toFixed(1)) : null;
}
function rounded(value: number) { return Math.round(value); }
function unique(values: string[]) { return [...new Set(values.filter(Boolean))].sort(); }

export function laneMatchesBefore(lane: HistoryLane, asOfDate: string): Match[] {
  const matches = new Map<string, Match | null>();
  for (const [playerKey, rows] of Object.entries(lane ?? {})) {
    const player = normalizeEvidenceIdentity(playerKey);
    if (!player || !Array.isArray(rows)) continue;
    for (const entry of rows) {
      const [dateRaw, tournamentRaw, surfaceRaw, opponentRaw, wonRaw, roundRaw, sourceRaw] = entry;
      const date = String(dateRaw ?? "").slice(0, 10);
      if (!dateOk(date) || date >= asOfDate) continue; // strict pre-match cutoff
      const opponent = normalizeEvidenceIdentity(String(opponentRaw ?? ""));
      if (!opponent || opponent === player || (wonRaw !== 0 && wonRaw !== 1)) continue;
      const tournament = String(tournamentRaw ?? "").trim();
      const surface = surfaceKey(surfaceRaw);
      const round = String(roundRaw ?? "").trim();
      const source = String(sourceRaw ?? "").trim() || "Repository four-tour history";
      const pair = [player, opponent].sort();
      const key = [date, normalizeEvidenceIdentity(tournament), surface, normalizeEvidenceIdentity(round), pair[0], pair[1]].join("|");
      const winner = wonRaw === 1 ? player : opponent;
      const candidate: Match = { key, date, tournament, surface, round, p1: pair[0], p2: pair[1], winner, source };
      const existing = matches.get(key);
      if (existing === null) continue;
      if (existing && existing.winner !== winner) { matches.set(key, null); continue; }
      if (!existing) matches.set(key, candidate);
    }
  }
  return [...matches.values()].filter((m): m is Match => Boolean(m)).sort((a, b) =>
    a.date.localeCompare(b.date) || roundOrder(a.round) - roundOrder(b.round) || a.key.localeCompare(b.key));
}

export function replayElo(lane: HistoryLane, asOfDate: string): Replay {
  const overall = new Map<string, number>();
  const surface = new Map<string, Map<string, number>>();
  const perspectives: Perspective[] = [];
  const sources: string[] = [];
  for (const match of laneMatchesBefore(lane, asOfDate)) {
    const a = overall.get(match.p1) ?? 1500;
    const b = overall.get(match.p2) ?? 1500;
    const aWon = match.winner === match.p1;
    const surfaceName = match.surface || "unknown";
    const sa = getSurfaceRating(surface, surfaceName, match.p1);
    const sb = getSurfaceRating(surface, surfaceName, match.p2);
    const [nextA, nextB] = update(a, b, aWon);
    const [nextSa, nextSb] = update(sa.rating, sb.rating, aWon);
    overall.set(match.p1, nextA); overall.set(match.p2, nextB);
    sa.bucket.set(match.p1, nextSa); sb.bucket.set(match.p2, nextSb);
    perspectives.push({ date: match.date, tournament: match.tournament, surface: match.surface, round: match.round, player: match.p1, opponent: match.p2, won: aWon, pre_elo: a, opponent_pre_elo: b, pre_surface_elo: sa.rating, opponent_pre_surface_elo: sb.rating });
    perspectives.push({ date: match.date, tournament: match.tournament, surface: match.surface, round: match.round, player: match.p2, opponent: match.p1, won: !aWon, pre_elo: b, opponent_pre_elo: a, pre_surface_elo: sb.rating, opponent_pre_surface_elo: sa.rating });
    sources.push(match.source);
  }
  return { overall, surface, perspectives, source_names: unique(sources) };
}

function playerRows(replay: Replay, player: string) {
  const key = normalizeEvidenceIdentity(player);
  return replay.perspectives.filter(row => row.player === key).sort((a, b) => b.date.localeCompare(a.date));
}
function recent(rows: Perspective[], asOfDate: string, days: number) {
  return rows.filter(row => { const d = daysBefore(row.date, asOfDate); return d > 0 && d <= days; });
}
function workloadValue(rows: Perspective[], asOfDate: string) {
  const r7 = recent(rows, asOfDate, 7), r14 = recent(rows, asOfDate, 14), r30 = recent(rows, asOfDate, 30);
  const last = rows[0]?.date ?? null;
  return {
    matches_7d: r7.length,
    matches_14d: r14.length,
    matches_30d: r30.length,
    days_since_last_match: last ? daysBefore(last, asOfDate) : null,
    tournaments_30d: new Set(r30.map(row => normalizeEvidenceIdentity(row.tournament)).filter(Boolean)).size,
  };
}
function workloadText(value: ReturnType<typeof workloadValue>) {
  return `matches_7d=${value.matches_7d}; matches_14d=${value.matches_14d}; matches_30d=${value.matches_30d}; days_since_last_match=${value.days_since_last_match ?? "NA"}; tournaments_30d=${value.tournaments_30d}`;
}
function formValue(rows: Perspective[], asOfDate: string, currentSurface: string | null) {
  const eligible = recent(rows, asOfDate, 90).slice(0, 10);
  if (!eligible.length) return null;
  const wins = eligible.filter(row => row.won).length;
  const averageOpponentElo = eligible.reduce((sum, row) => sum + row.opponent_pre_elo, 0) / eligible.length;
  const surfaceRows = currentSurface ? eligible.filter(row => row.surface === currentSurface) : [];
  return `last10_90d_n=${eligible.length}; wins=${wins}; losses=${eligible.length - wins}; win_pct=${pct(wins, eligible.length)}; avg_opponent_pre_elo=${rounded(averageOpponentElo)}; current_surface_matches=${surfaceRows.length}; current_surface_wins=${surfaceRows.filter(row => row.won).length}`;
}
function surfaceStrengthValue(replay: Replay, rows: Perspective[], asOfDate: string, player: string, currentSurface: string) {
  const key = normalizeEvidenceIdentity(player);
  const surfaceRows = recent(rows.filter(row => row.surface === currentSurface), asOfDate, 365);
  if (!surfaceRows.length) return null;
  const wins = surfaceRows.filter(row => row.won).length;
  const rating = replay.surface.get(currentSurface)?.get(key);
  if (!Number.isFinite(rating)) return null;
  return `surface=${currentSurface}; surface_elo=${rounded(rating!)}; matches_52w=${surfaceRows.length}; wins_52w=${wins}; win_pct_52w=${pct(wins, surfaceRows.length)}`;
}
function eloValue(replay: Replay, player: string, currentSurface: string | null) {
  const key = normalizeEvidenceIdentity(player);
  const overall = replay.overall.get(key);
  if (!Number.isFinite(overall)) return null;
  const surface = currentSurface ? replay.surface.get(currentSurface)?.get(key) : null;
  return `overall_elo=${rounded(overall!)}; surface=${currentSurface ?? "NA"}; surface_elo=${Number.isFinite(surface) ? rounded(surface!) : "NA"}; k=${K}; initial=1500`;
}

export function computeHistoryMetric(args: { code: HistoryMetricCode; p1: string; p2: string; asOfDate: string; family: EvidenceTourFamily; surface?: string | null; lane: HistoryLane }): HistoryMetricResult | null {
  const replay = replayElo(args.lane, args.asOfDate);
  const p1Rows = playerRows(replay, args.p1), p2Rows = playerRows(replay, args.p2);
  if (!p1Rows.length || !p2Rows.length) return null; // missing history is never zero activity
  const currentSurface = surfaceKey(args.surface) || null;
  let p1: string | null = null, p2: string | null = null, differential: string | null = null;
  let treatment: "RECONSTRUCTED" | "PARTIAL" = "RECONSTRUCTED";
  let reliability = 86;
  let unavailableReason: string | null = null;
  let window = "strict pre-match chronology";
  let calculation = "deterministic K=32 Elo replay";

  if (args.code === "001") {
    if (!currentSurface) return null;
    p1 = surfaceStrengthValue(replay, p1Rows, args.asOfDate, args.p1, currentSurface);
    p2 = surfaceStrengthValue(replay, p2Rows, args.asOfDate, args.p2, currentSurface);
    window = "trailing 52 weeks + pre-match surface Elo chronology";
    calculation = "surface Elo + surface W/L";
  } else if (args.code === "005") {
    p1 = formValue(p1Rows, args.asOfDate, currentSurface);
    p2 = formValue(p2Rows, args.asOfDate, currentSurface);
    window = "last 10 matches within trailing 90 days";
    calculation = "W/L + opponent pre-match Elo + current-surface subset";
  } else if (args.code === "021") {
    p1 = eloValue(replay, args.p1, currentSurface);
    p2 = eloValue(replay, args.p2, currentSurface);
    const a = replay.overall.get(normalizeEvidenceIdentity(args.p1));
    const b = replay.overall.get(normalizeEvidenceIdentity(args.p2));
    differential = Number.isFinite(a) && Number.isFinite(b) ? `overall_elo_delta_p1_minus_p2=${rounded(a! - b!)}` : null;
  } else if (args.code === "007" || args.code === "061") {
    const w1 = workloadValue(p1Rows, args.asOfDate), w2 = workloadValue(p2Rows, args.asOfDate);
    if (w1.days_since_last_match === null || w2.days_since_last_match === null) return null;
    p1 = workloadText(w1); p2 = workloadText(w2);
    treatment = "PARTIAL"; reliability = 78;
    window = "trailing 7/14/30 days with strict pre-match rest cutoff";
    calculation = "match count + tournament count + days since prior match";
    unavailableReason = args.code === "007"
      ? "PARTIAL: match-history scheduling reconstructs objective load/rest, but hours, travel distance, and time-zone/circadian inputs are not uniformly available; no injury or subjective fatigue is inferred."
      : "PARTIAL: rolling match load is reconstructed; sets/games are not preserved uniformly in the four-tour runtime history and match duration is incomplete. Missing components are not imputed.";
  }
  if (!p1 || !p2) return null;
  const sample = [
    `source_observations=${replay.perspectives.length / 2}`,
    `date_window=${window}`,
    `players=${args.p1} vs ${args.p2}`,
    `calculation=${calculation}`,
    `output=pair-complete`,
    `metric=${args.code}`,
    `tour=${args.family}`,
    `match_date=${args.asOfDate}`,
    "future_leakage=blocked(date<match_date)",
  ].join("; ");
  return { p1_value: p1, p2_value: p2, differential, treatment, reliability, unavailable_reason: unavailableReason, sample, source_names: replay.source_names };
}
