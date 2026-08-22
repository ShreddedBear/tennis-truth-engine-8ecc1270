import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SourcedStat } from "./reconstruction/engine";

const SOURCE_URL = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
const SOURCE_NAME = "PredixSport public tennis ratings (CC BY 4.0)";

type Row = Record<string, string>;
let cache: Row[] | null = null;

function norm(v: string) {
  return v
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function num(v: string | undefined) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parse(text: string) {
  const rows: string[][] = [];
  let r: string[] = [];
  let c = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const x = text[i];
    if (x === '"') {
      if (q && text[i + 1] === '"') {
        c += '"';
        i++;
      } else q = !q;
    } else if (x === "," && !q) {
      r.push(c);
      c = "";
    } else if ((x === "\n" || x === "\r") && !q) {
      if (x === "\r" && text[i + 1] === "\n") i++;
      r.push(c);
      c = "";
      if (r.some(Boolean)) rows.push(r);
      r = [];
    } else c += x;
  }
  if (c || r.length) {
    r.push(c);
    rows.push(r);
  }
  if (!rows.length) return [];
  const h = rows[0].map((x) => x.trim());
  return rows.slice(1).map((a) => Object.fromEntries(h.map((k, i) => [k, (a[i] ?? "").trim()])));
}

function load() {
  if (cache) return cache;
  try {
    cache = parse(readFileSync(join(process.cwd(), "data/public/predixsport/atp/atp_elo_matches.csv"), "utf8"));
  } catch {
    cache = [];
  }
  return cache;
}

function cut(ctx: string) {
  return ctx.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}

function surf(ctx: string) {
  return ctx.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase() ?? null;
}

function contextLevel(ctx: string) {
  const m = ctx.match(/(?:event_level|event level|level)\s+([^·|,]+)/i);
  return m?.[1]?.trim().toLowerCase() ?? null;
}

function rowLevel(r: Row) {
  return (r.tournament_level ?? r.event_level ?? r.tour_level ?? r.level ?? "").trim().toLowerCase() || null;
}

function stat(p: string, k: string, v: number, n: number, s: string | null): SourcedStat {
  return {
    key: k,
    player: p,
    value: v,
    surface: s,
    window: "PRE_MATCH_HISTORY",
    tour_level: null,
    sample: n,
    origin: "RECONSTRUCTED",
    sources: [{ source_name: SOURCE_NAME, url: SOURCE_URL, retrieved_at: new Date().toISOString() }],
  };
}

function weight(date: string, cutoff: string | null) {
  if (!cutoff || !date) return 1;
  const d = (Date.parse(`${cutoff}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000;
  if (!Number.isFinite(d) || d < 0) return 0;
  return Math.exp(-d / 365);
}

function beforeCutoff(r: Row, cutoff: string | null) {
  return !cutoff || !r.date || r.date < cutoff;
}

function sameSurface(r: Row, surface: string | null) {
  return !surface || !r.surface || r.surface.toLowerCase() === surface;
}

function comparableLevel(r: Row, level: string | null) {
  if (!level) return true;
  const actual = rowLevel(r);
  // Absence of a row-level field is not evidence of a match. Do not silently
  // treat unknown tournament level as comparable.
  return actual !== null && actual === level;
}

function oppElo(rows: Row[], opp: string, date: string) {
  const n = norm(opp);
  const r = rows
    .filter((x) => norm(x.player ?? "") === n && (!date || !x.date || x.date <= date))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const z = r[r.length - 1];
  return z ? num(z.elo_pre) ?? num(z.elo_post) : null;
}

/**
 * Two-hop strength of a shared opponent: that opponent's own pre-cutoff,
 * same-surface win rate against their opponents. This is a genuine
 * opponents-of-opponents chain. It is deliberately kept separate from Elo
 * weighting so those two reconstructions cannot be mistaken for one another.
 */
function secondDegreeStrength(rows: Row[], sharedOpponent: string, cutoff: string | null, surface: string | null) {
  const n = norm(sharedOpponent);
  const history = rows.filter(
    (r) => norm(r.player ?? "") === n && beforeCutoff(r, cutoff) && sameSurface(r, surface) && (r.won === "0" || r.won === "1"),
  );
  if (!history.length) return null;
  return (100 * history.filter((r) => r.won === "1").length) / history.length;
}

export interface CommonOpponentAuditCoverage {
  directCommonOpponents: boolean;
  sharedWinLossComparison: boolean;
  scorelineComparison: "SETS_ONLY" | "UNAVAILABLE";
  recencyWeighting: boolean;
  surfaceMatching: boolean;
  tournamentLevelMatching: boolean;
  opponentStrengthWeighting: boolean;
  transitiveChains: boolean;
}

export function computeEnhancedCommonOpponentStatsFromRows(
  all: Row[],
  player: string,
  opponent: string,
  context: string,
): { stats: SourcedStat[]; coverage: CommonOpponentAuditCoverage } {
  const pn = norm(player);
  const on = norm(opponent);
  const c = cut(context);
  const s = surf(context);
  const level = contextLevel(context);

  const baseFilter = (r: Row) => beforeCutoff(r, c) && sameSurface(r, s);
  const prAll = all.filter((r) => norm(r.player ?? "") === pn && baseFilter(r));
  const orAll = all.filter((r) => norm(r.player ?? "") === on && baseFilter(r));

  const levelFieldExists = all.some((r) => rowLevel(r) !== null);
  const levelMatchingApplied = !!level && levelFieldExists;
  const pr = levelMatchingApplied ? prAll.filter((r) => comparableLevel(r, level)) : prAll;
  const or = levelMatchingApplied ? orAll.filter((r) => comparableLevel(r, level)) : orAll;

  const os = new Set(or.map((r) => norm(r.opponent ?? "")).filter(Boolean));
  const common = pr.filter((r) => os.has(norm(r.opponent ?? "")));
  const commonNames = new Set(common.map((r) => norm(r.opponent ?? "")).filter(Boolean));

  const coverage: CommonOpponentAuditCoverage = {
    directCommonOpponents: commonNames.size > 0,
    sharedWinLossComparison: common.some((r) => r.won === "0" || r.won === "1"),
    scorelineComparison: common.some((r) => num(r.sets_for) !== null && num(r.sets_against) !== null) ? "SETS_ONLY" : "UNAVAILABLE",
    recencyWeighting: common.length > 0,
    surfaceMatching: !!s,
    tournamentLevelMatching: levelMatchingApplied,
    opponentStrengthWeighting: false,
    transitiveChains: false,
  };

  if (!common.length) return { stats: [], coverage };

  let recencyWeight = 0;
  let recencyWins = 0;
  let setMargin = 0;
  let setMarginWeight = 0;
  let strengthWins = 0;
  let strengthWeight = 0;
  let secondDegreeWeighted = 0;
  let secondDegreeWeight = 0;

  for (const r of common) {
    const rec = weight(r.date ?? "", c);
    recencyWeight += rec;
    if (r.won === "1") recencyWins += rec;

    const sf = num(r.sets_for);
    const sa = num(r.sets_against);
    if (sf !== null && sa !== null) {
      setMargin += rec * (sf - sa);
      setMarginWeight += rec;
    }

    const oe = oppElo(all, r.opponent ?? "", r.date ?? "");
    if (oe !== null && (r.won === "0" || r.won === "1")) {
      const q = Math.max(0.25, Math.min(2, oe / 1500));
      strengthWins += rec * q * (r.won === "1" ? 1 : 0);
      strengthWeight += rec * q;
      coverage.opponentStrengthWeighting = true;
    }

    const chain = secondDegreeStrength(all, r.opponent ?? "", c, s);
    if (chain !== null) {
      secondDegreeWeighted += rec * chain;
      secondDegreeWeight += rec;
      coverage.transitiveChains = true;
    }
  }

  const out: SourcedStat[] = [];
  out.push(stat(player, "direct_common_opponents", commonNames.size, common.length, s));
  out.push(stat(player, "common_opponent_matches", common.length, common.length, s));
  const wins = common.filter((r) => r.won === "1").length;
  const losses = common.filter((r) => r.won === "0").length;
  out.push(stat(player, "common_opponent_wins", wins, common.length, s));
  out.push(stat(player, "common_opponent_losses", losses, common.length, s));
  if (wins + losses > 0) out.push(stat(player, "common_opponent_win_pct", (100 * wins) / (wins + losses), common.length, s));
  if (recencyWeight > 0)
    out.push(stat(player, "common_opponent_recency_weighted_win_pct", (100 * recencyWins) / recencyWeight, common.length, s));
  if (setMarginWeight > 0)
    out.push(stat(player, "common_opponent_weighted_set_margin", setMargin / setMarginWeight, common.length, s));
  if (strengthWeight > 0)
    out.push(stat(player, "common_opponent_strength_weighted_win_pct", (100 * strengthWins) / strengthWeight, common.length, s));
  if (secondDegreeWeight > 0)
    out.push(stat(player, "common_opponent_second_degree_strength_pct", secondDegreeWeighted / secondDegreeWeight, common.length, s));
  out.push(stat(player, "surface_matched_common_opponents", commonNames.size, common.length, s));
  if (levelMatchingApplied) out.push(stat(player, "tournament_level_matched_common_opponents", commonNames.size, common.length, s));

  return { stats: out, coverage };
}

export function getEnhancedCommonOpponentStats(player: string, opponent: string, context: string): SourcedStat[] {
  return computeEnhancedCommonOpponentStatsFromRows(load(), player, opponent, context).stats;
}
