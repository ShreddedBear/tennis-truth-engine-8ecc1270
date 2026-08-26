import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { policyForMetric } from "./metric-source-family-policy";
import { reconstructPbpScoreState, TASK18B_METRIC_CODES, type PbpSide } from "./pbp-score-state-recovery";

const BASE = "https://sports.bzzoiro.com/tennis/api/v2";
const COVERAGE_START = "2024-01-01";
const LEGACY_PBP_CODES = new Set(["016","024","025","033","036","040","042","043","044","060","079"]);
const PBP_CODES = new Set([...LEGACY_PBP_CODES, ...TASK18B_METRIC_CODES]);

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

function explicitAtpMainContext(context: string | null | undefined) {
  const s = norm(context);
  if (!s) return false;
  if (/(^| )wta( |$)/.test(s) || s.includes("wta 125") || s.includes("wta125")) return false;
  if (["challenger","itf","futures","utr","satellite","exhibition"].some(x => s.includes(x))) return false;
  if (["atp main","masters 1000","atp 1000","atp 500","atp 250","grand slam","next gen finals","atp finals"].some(x => s.includes(x))) return true;
  return /(^| )atp( |$)/.test(s);
}
function strictIndexedAtpMain(row: IndexRow) {
  const circuit = String(row.circuit ?? "").trim().toUpperCase();
  const blob = norm(`${row.category ?? ""} ${row.tournament ?? ""}`);
  if (circuit !== "ATP") return false;
  if (["challenger","wta","wta 125","wta125","itf","futures","utr","satellite","exhibition"].some(x => blob.includes(x))) return false;
  return row.structurally_present === true;
}
async function loadIndex(year: number): Promise<IndexRow[]> {
  try {
    const parsed = JSON.parse(await readFile(join(process.cwd(), "data", "audit", "bsd-atp-main-pbp-history", String(year), "results.json"), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
async function fetchPbp(matchId: string | number) {
  const token = process.env.BSD_TENNIS_API_KEY;
  if (!token) return null;
  try {
    const r = await fetch(`${BASE}/matches/${encodeURIComponent(String(matchId))}/point-by-point/`, {
      headers: { Authorization: `Token ${token}`, "User-Agent": "tennis-truth-engine-task18b-atp-main/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return null;
    const payload = await r.json();
    return payload && typeof payload === "object" && (payload as any).available === true ? payload : null;
  } catch { return null; }
}
function balancedCandidates(rows: IndexRow[], p1n: string, p2n: string) {
  const sorted = [...rows].sort((a,b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  const p1Rows = sorted.filter(r => (r.players ?? []).map(norm).includes(p1n)).slice(0,12);
  const p2Rows = sorted.filter(r => (r.players ?? []).map(norm).includes(p2n)).slice(0,12);
  const seen = new Set<string>();
  return [...p1Rows, ...p2Rows].filter(r => {
    const key = String(r.match_id ?? `${r.date}|${(r.players ?? []).map(norm).join("|")}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a,b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
}

export async function buildBsdAtpMainPbpContext(args: { metrics: MetricLike[]; p1: string; p2: string; asOfDate: string; context?: string | null }) {
  const status = { eligible:false, reason:"", matches_used:0, rejected_pbp:0, coverage_start:COVERAGE_START, source:"BSD/Bzzoiro ATP Main PBP" };
  if (!explicitAtpMainContext(args.context)) {
    status.reason = "Fail-closed tour guard: context is not explicitly ATP Main or contains Challenger/WTA/ITF/UTR markers.";
    return { packet:{} as Record<string,unknown>, status };
  }
  if (args.asOfDate < COVERAGE_START) {
    status.reason = "Outside confirmed BSD ATP Main PBP coverage boundary (2024-current).";
    return { packet:{} as Record<string,unknown>, status };
  }
  status.eligible = true;
  const endYear = Math.min(new Date().getUTCFullYear(), Number(args.asOfDate.slice(0,4)) || new Date().getUTCFullYear());
  const indexes = (await Promise.all(Array.from({length:Math.max(0,endYear-2024+1)}, (_,i) => loadIndex(2024+i)))).flat();
  const p1n = norm(args.p1), p2n = norm(args.p2);
  const eligible = indexes.filter(row => {
    if (!strictIndexedAtpMain(row) || !row.date || row.date.slice(0,10) > args.asOfDate) return false;
    const names = (row.players ?? []).map(norm);
    return names.includes(p1n) || names.includes(p2n);
  });
  const candidates = balancedCandidates(eligible, p1n, p2n);
  const observations: any[] = [];
  const seenMatchIds = new Set<string>();

  for (const row of candidates) {
    if (!row.match_id || !Array.isArray(row.players) || row.players.length !== 2) continue;
    const matchKey = String(row.match_id);
    if (seenMatchIds.has(matchKey)) { status.rejected_pbp++; continue; }
    seenMatchIds.add(matchKey);
    const payload = await fetchPbp(row.match_id);
    if (!payload) continue;
    const recovery = reconstructPbpScoreState(payload);
    if (!recovery.valid) { status.rejected_pbp++; continue; }
    const names = row.players.map(v => String(v ?? ""));
    for (const target of [args.p1, args.p2]) {
      const idx = names.findIndex(n => norm(n) === norm(target));
      if (idx < 0) continue;
      const side: PbpSide = idx === 0 ? "player1" : "player2";
      const derived = recovery.derived[side];
      if (!Object.keys(derived).length) continue;
      observations.push({
        family:"POINT_BY_POINT",
        source:"BSD/Bzzoiro ATP Main PBP",
        url:`${BASE}/matches/${row.match_id}/point-by-point/`,
        player:target,
        opponent:names[idx === 0 ? 1 : 0] || null,
        tournament:row.tournament ?? null,
        event_date:String(row.date).slice(0,10),
        surface:row.surface ?? null,
        key:"task18b_approved_pbp_score_state",
        value:{ match_id:row.match_id, totalPoints:recovery.point_count, gamesObserved:recovery.game_count, derived, field_support:recovery.field_support },
        sample:`${recovery.point_count} parsed points; ${recovery.game_count} complete games`,
        provenance:{ tour:"ATP_MAIN", match_id:String(row.match_id), player_orientation:side, approved_only:true, approval_source:"BSD ATP Main historical structural PBP audit", raw_pbp_ref:`${BASE}/matches/${row.match_id}/point-by-point/`, parsed_point_state:true, transformation:"pbp-score-state-recovery", strict_index_classifier:true, duplicate_match_guard:true, one_match_one_pbp:true },
      });
      status.matches_used++;
    }
  }

  const packet: Record<string,unknown> = {};
  for (const metric of args.metrics) {
    const code = codeOf(metric.code);
    if (!PBP_CODES.has(code) || !observations.length) continue;
    const policy = policyForMetric(code);
    const codeRows = observations.filter(o => Boolean(o.value?.derived?.[code]));
    if (!codeRows.length) continue;
    packet[code] = {
      metric_name:metric.name,
      allowed_families:[...new Set([...policy.allowed_families,"POINT_BY_POINT"])],
      sufficient_families:[...new Set([...policy.sufficient_families,"POINT_BY_POINT"])],
      support_only_families:(policy.support_only_families ?? []).filter(x => x !== "POINT_BY_POINT"),
      observed_families:["POINT_BY_POINT"],
      direct_satisfaction_allowed:false,
      observations:codeRows.slice(0,80),
      tour_guard:"STRICT_ATP_MAIN_ONLY",
      evidence_treatment:"RECONSTRUCTED_OR_TASK17_PARTIAL_ONLY",
    };
  }
  status.reason = observations.length ? "Approved ATP Main PBP reconstructed only where metric-specific raw-field contracts are satisfied." : "No matching approved ATP Main PBP satisfied Task 18B field requirements.";
  return { packet, status };
}
