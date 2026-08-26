import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { reconstructPbpScoreState, TASK18B_METRIC_CODES } from "../src/lib/pbp-score-state-recovery";

const BASE = "https://sports.bzzoiro.com/tennis/api/v2";
const token = process.env.BSD_TENNIS_API_KEY;
if (!token) throw new Error("BSD_TENNIS_API_KEY is required");

const codes = [...TASK18B_METRIC_CODES].sort();
const task17Partial = new Set(["002","003"]);
const task17Reconstructed = new Set(codes.filter(c => !task17Partial.has(c)));

type IndexRow = { match_id?: string|number|null; date?: string|null; players?: string[]; tournament?: string|null; circuit?: string|null; category?: string|null; structurally_present?: boolean };
const norm = (v: unknown) => String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function load(path: string): Promise<IndexRow[]> {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  return Array.isArray(parsed) ? parsed : [];
}
async function fetchPbp(matchId: string|number) {
  const r = await fetch(`${BASE}/matches/${encodeURIComponent(String(matchId))}/point-by-point/`, { headers:{ Authorization:`Token ${token}`, "User-Agent":"tennis-truth-engine-task18b-live-audit/1.0" } });
  if (!r.ok) throw new Error(`PBP fetch failed for ${matchId}: ${r.status}`);
  const payload = await r.json();
  if (!payload || typeof payload !== "object" || (payload as any).available !== true) throw new Error(`PBP unavailable for representative match ${matchId}`);
  return payload;
}
function candidatesFor(tour: "ATP_MAIN"|"WTA_MAIN"|"ATP_CHALLENGER", rows: IndexRow[]) {
  return rows.filter(row => {
    if (!row.structurally_present || !row.match_id || !Array.isArray(row.players) || row.players.length !== 2) return false;
    const circuit = String(row.circuit ?? "").toUpperCase();
    const blob = norm(`${row.category ?? ""} ${row.tournament ?? ""}`);
    if (tour === "ATP_MAIN") return circuit === "ATP" && !["challenger","wta","itf","futures","utr","exhibition"].some(x => blob.includes(x));
    if (tour === "ATP_CHALLENGER") return circuit === "ATP" && blob.includes("challenger") && !["wta","itf","futures","utr","exhibition"].some(x => blob.includes(x));
    return circuit === "WTA" && !["challenger","wta 125","wta125","125k","atp","itf","utr","exhibition"].some(x => blob.includes(x));
  });
}

async function auditLiveLane(tour: "ATP_MAIN"|"WTA_MAIN"|"ATP_CHALLENGER", path: string) {
  const rows = candidatesFor(tour, await load(path)).slice(0, 12);
  if (!rows.length) throw new Error(`No structurally approved representative rows for ${tour}`);
  const recovered = new Set<string>();
  const treatments: Record<string,string> = {};
  const fieldSupport = { ace_indicator:false, double_fault_indicator:false, set_boundary:false };
  const representatives: any[] = [];
  for (const row of rows) {
    try {
      const payload = await fetchPbp(row.match_id!);
      const r = reconstructPbpScoreState(payload);
      if (!r.valid) continue;
      fieldSupport.ace_indicator ||= r.field_support.ace_indicator;
      fieldSupport.double_fault_indicator ||= r.field_support.double_fault_indicator;
      fieldSupport.set_boundary ||= r.field_support.set_boundary;
      const pairCodes = codes.filter(code => Boolean(r.derived.player1[code] && r.derived.player2[code]));
      for (const code of pairCodes) {
        recovered.add(code);
        const t1 = r.derived.player1[code]!.treatment;
        const t2 = r.derived.player2[code]!.treatment;
        treatments[code] = t1 === "PARTIAL" || t2 === "PARTIAL" ? "PARTIAL" : "RECONSTRUCTED";
      }
      representatives.push({match_id:String(row.match_id),date:row.date,players:row.players,game_count:r.game_count,point_count:r.point_count,pair_codes:pairCodes,field_support:r.field_support});
      if (recovered.size === codes.length) break;
    } catch (error) {
      representatives.push({match_id:String(row.match_id),error:String(error)});
    }
  }
  return {tour, recovered_codes:[...recovered].sort(), recovered_cells:recovered.size, treatments, field_support:fieldSupport, representatives};
}

const atpMain = await auditLiveLane("ATP_MAIN", join(process.cwd(),"data","audit","bsd-atp-main-pbp-history","2025","results.json"));
const wtaMain = await auditLiveLane("WTA_MAIN", join(process.cwd(),"data","audit","bsd-wta-main-pbp-history","2025","results.json"));
const atpChallenger = await auditLiveLane("ATP_CHALLENGER", join(process.cwd(),"data","audit","bsd-atp-challenger-pbp-history","2025","results.json"));

const approvedRaw = await readFile(join(process.cwd(),"data","metrics","pbp","wta_challenger","approved-index.jsonl"),"utf8");
const approvedRows = approvedRaw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)).filter(row => row.status === "APPROVED_WTA_CHALLENGER_PBP" && row.tour === "WTA_CHALLENGER");
const wtaChallenger = {
  tour:"WTA_CHALLENGER",
  approved_records_available:approvedRows.length,
  quarantined_records_included:0,
  known_quarantine_baseline:155,
  recovered_codes:[] as string[],
  recovered_cells:0,
  rejected_reason:"Approved metrics index does not retain server-oriented raw point chronology/player point winners; aggregate totals cannot satisfy Task 18B raw-field contracts.",
};
if (approvedRows.length !== 1645) throw new Error(`Expected 1,645 approved WTA Challenger PBP rows, got ${approvedRows.length}`);

for (const lane of [atpMain,wtaMain,atpChallenger]) {
  for (const code of lane.recovered_codes) {
    if (task17Partial.has(code) && lane.treatments[code] !== "PARTIAL") throw new Error(`${lane.tour} ${code} must remain PARTIAL`);
    if (task17Reconstructed.has(code) && lane.treatments[code] !== "RECONSTRUCTED") throw new Error(`${lane.tour} ${code} expected RECONSTRUCTED`);
  }
}

const allLanes = [atpMain,wtaMain,atpChallenger,wtaChallenger];
const newCells = allLanes.reduce((n,lane) => n + lane.recovered_cells, 0);
const reconstructedCells = [atpMain,wtaMain,atpChallenger].reduce((n,lane) => n + lane.recovered_codes.filter(c => lane.treatments[c] === "RECONSTRUCTED").length, 0);
const partialCells = [atpMain,wtaMain,atpChallenger].reduce((n,lane) => n + lane.recovered_codes.filter(c => lane.treatments[c] === "PARTIAL").length, 0);
const summary = {
  task:"18B PBP / Score-State Evidence Recovery",
  task17_owned_metrics:codes,
  baseline_cells_total:39,
  baseline_exact_owned_allocation_known:false,
  note:"Task 17 states the original 39 cells cannot be assigned exactly to metric codes after the fact; this audit therefore reports newly implemented/live-proven Task 18B capability cells without inventing a baseline per-code subtraction.",
  lanes:allLanes,
  gross_live_proven_task18b_cells:newCells,
  reconstructed_cells:reconstructedCells,
  partial_cells:partialCells,
  direct_cells:0,
  max_gross_four_tour_footprint:72,
  rejected_wta_challenger_cells:18,
  true_unavailable_shot_level_fields_protected:["serve_number","rally_length","shot_type","shot_placement","winners/unforced_errors","net_approach","first_strike_sequence","handedness"],
};
await mkdir(join(process.cwd(),"data","audit","task18b-pbp-recovery"),{recursive:true});
await writeFile(join(process.cwd(),"data","audit","task18b-pbp-recovery","summary.json"),JSON.stringify(summary,null,2)+"\n");
console.log(JSON.stringify(summary,null,2));
