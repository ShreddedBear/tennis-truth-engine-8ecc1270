import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { policyForMetric } from "./metric-source-family-policy";

const BASE = "https://sports.bzzoiro.com/tennis/api/v2";
const COVERAGE_START = "2024-12-02";
const FIRST_YEAR = 2024;
const PBP_CODES = new Set(["024", "025", "033", "036", "040", "042", "043", "044", "060", "079"]);

type MetricLike = { code: string; name: string };
type IndexRow = {
  match_id?: string | number | null;
  date?: string | null;
  players?: [string | null, string | null] | string[];
  tournament?: string | null;
  circuit?: string | null;
  category?: string | null;
  surface?: string | null;
  structurally_present?: boolean;
};

const norm = (v: unknown) => String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const codeOf = (v: unknown) => { const m = String(v ?? "").match(/(\d{1,3})$/); return m ? m[1].padStart(3, "0") : String(v ?? "").padStart(3, "0"); };

function explicitWtaMainContext(context: string | null | undefined) {
  const s = norm(context);
  if (!s) return false;
  if (!/(^| )wta( |$)/.test(s)) return false;
  const blocked = ["challenger", "wta 125", "wta125", "125k", "itf", "utr", "futures", "satellite", "exhibition", "atp"];
  if (blocked.some(x => s.includes(x))) return false;
  return true;
}

function strictIndexedWtaMain(row: IndexRow) {
  const circuit = String(row.circuit ?? "").trim().toUpperCase();
  const blob = norm(`${row.category ?? ""} ${row.tournament ?? ""}`);
  if (circuit !== "WTA") return false;
  const blocked = ["challenger", "wta 125", "wta125", "125k", "itf", "utr", "futures", "satellite", "exhibition", "atp"];
  if (blocked.some(x => blob.includes(x))) return false;
  return row.structurally_present === true;
}

async function loadIndex(year: number): Promise<IndexRow[]> {
  try {
    const path = join(process.cwd(), "data", "audit", "bsd-wta-main-pbp-history", String(year), "results.json");
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

async function fetchPbp(matchId: string | number) {
  const token = process.env.BSD_TENNIS_API_KEY;
  if (!token) return null;
  try {
    const r = await fetch(`${BASE}/matches/${encodeURIComponent(String(matchId))}/point-by-point/`, {
      headers: { Authorization: `Token ${token}`, "User-Agent": "tennis-truth-engine-bsd-wta-main-metrics/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return null;
    const payload = await r.json();
    return payload && typeof payload === "object" && (payload as any).available === true ? payload : null;
  } catch { return null; }
}

function summarizeForSide(payload: any, side: "player1" | "player2") {
  let pointsWon = 0, pointsLost = 0, gamesObserved = 0, serviceGames = 0, returnGames = 0, breaksWon = 0;
  const other = side === "player1" ? "player2" : "player1";
  const walk = (v: any) => {
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v.points)) {
      gamesObserved += 1;
      if (v.server === side) serviceGames += 1;
      else if (v.server === other) returnGames += 1;
      if (v.server === other && v.break === true) breaksWon += 1;
      for (const p of v.points) {
        if (!p || typeof p !== "object") continue;
        if (p.winner === side) pointsWon += 1;
        else if (p.winner === other) pointsLost += 1;
      }
    }
    for (const [k, x] of Object.entries(v)) if (k !== "points") walk(x);
  };
  walk(payload);
  const totalPoints = pointsWon + pointsLost;
  if (!totalPoints) return null;
  return { pointsWon, pointsLost, totalPoints, pointWinPct: Number((100 * pointsWon / totalPoints).toFixed(2)), gamesObserved, serviceGames, returnGames, breaksWon };
}

export async function buildBsdWtaMainPbpContext(args: {
  metrics: MetricLike[];
  p1: string;
  p2: string;
  asOfDate: string;
  context?: string | null;
}) {
  const status = { eligible: false, reason: "", matches_used: 0, coverage_start: COVERAGE_START, source: "BSD/Bzzoiro WTA Main PBP" };
  if (!explicitWtaMainContext(args.context)) {
    status.reason = "Fail-closed tour guard: context is not explicitly WTA Main or contains a blocked WTA 125/Challenger, ATP, ITF, UTR, or exhibition marker.";
    return { packet: {} as Record<string, unknown>, status };
  }
  if (args.asOfDate < COVERAGE_START) {
    status.reason = "Outside confirmed BSD WTA Main PBP coverage (starts 2024-12-02).";
    return { packet: {} as Record<string, unknown>, status };
  }
  status.eligible = true;
  const endYear = Math.min(new Date().getUTCFullYear(), Number(args.asOfDate.slice(0, 4)) || new Date().getUTCFullYear());
  const indexes = (await Promise.all(Array.from({ length: endYear - FIRST_YEAR + 1 }, (_, i) => loadIndex(FIRST_YEAR + i)))).flat();
  const p1n = norm(args.p1), p2n = norm(args.p2);
  const seenMatchIds = new Set<string>();
  const candidates = indexes.filter(row => {
    if (!strictIndexedWtaMain(row) || !row.date) return false;
    const eventDate = row.date.slice(0, 10);
    if (eventDate < COVERAGE_START || eventDate > args.asOfDate) return false;
    const names = (row.players ?? []).map(norm);
    if (!(names.includes(p1n) || names.includes(p2n))) return false;
    const id = String(row.match_id ?? "");
    if (!id || seenMatchIds.has(id)) return false;
    seenMatchIds.add(id);
    return true;
  }).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? ""))).slice(0, 24);

  const observations: any[] = [];
  for (const row of candidates) {
    if (!row.match_id || !Array.isArray(row.players) || row.players.length < 2) continue;
    const payload = await fetchPbp(row.match_id);
    if (!payload) continue;
    const names = row.players.map(v => String(v ?? ""));
    for (const target of [args.p1, args.p2]) {
      const idx = names.findIndex(n => norm(n) === norm(target));
      if (idx < 0) continue;
      const side = idx === 0 ? "player1" : "player2";
      const summary = summarizeForSide(payload, side);
      if (!summary) continue;
      observations.push({
        family: "POINT_BY_POINT",
        source: "BSD/Bzzoiro WTA Main PBP",
        url: `${BASE}/matches/${row.match_id}/point-by-point/`,
        player: target,
        opponent: names[idx === 0 ? 1 : 0] || null,
        tournament: row.tournament ?? null,
        event_date: String(row.date).slice(0, 10),
        surface: row.surface ?? null,
        key: "bsd_wta_main_pbp_summary",
        value: summary,
        sample: `${summary.totalPoints} point rows; ${summary.gamesObserved} games`,
        provenance: { circuit: "WTA", level: "MAIN", coverage_floor: COVERAGE_START, strict_index_classifier: true, duplicate_match_guard: true },
      });
      status.matches_used += 1;
    }
  }

  const packet: Record<string, unknown> = {};
  for (const metric of args.metrics) {
    const code = codeOf(metric.code);
    if (!PBP_CODES.has(code) || !policyForMetric(code).allowed_families.includes("POINT_BY_POINT") || !observations.length) continue;
    const policy = policyForMetric(code);
    packet[code] = {
      metric_name: metric.name,
      allowed_families: policy.allowed_families,
      sufficient_families: policy.sufficient_families,
      support_only_families: policy.support_only_families ?? [],
      observed_families: ["POINT_BY_POINT"],
      direct_satisfaction_allowed: policy.sufficient_families.includes("POINT_BY_POINT"),
      observations: observations.slice(0, 80),
      tour_guard: "STRICT_WTA_MAIN_ONLY",
    };
  }
  status.reason = observations.length ? "BSD WTA Main PBP attached to eligible metric codes." : "No matching usable BSD WTA Main PBP observations found for these players.";
  return { packet, status };
}
