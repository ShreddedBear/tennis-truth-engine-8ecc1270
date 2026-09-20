import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TASK18B_METRIC_CODES } from "../src/lib/pbp-score-state-recovery";

const root=process.cwd();
const readJson=async(path:string)=>JSON.parse(await readFile(join(root,path),"utf8"));
const codes=[...TASK18B_METRIC_CODES].sort();
const rawLaneSupported=["002","003","004","009","026","027","033","036","037","038","039","040","069","070","071","079"];
const reconstructed=new Set(["004","026","027","033","036","037","038","039","040","069","070"]);
const partial=new Set(["002","003","009","071","079"]);
const rejectedMissingFields=["031","032"];
const legacyMainSupported=new Set(["033","036","040","079"]);

function keyInventory(value:any,out=new Set<string>()){if(Array.isArray(value)){for(const x of value)keyInventory(x,out);return out}if(value&&typeof value==="object"){for(const[k,v]of Object.entries(value)){out.add(k);keyInventory(v,out)}}return out}
const probe=await readJson("data/audit/bsd-pbp-accuracy/probe.json");
const keys=keyInventory(probe);
const schemaProof={
  stored_probe_matches:Array.isArray(probe)?probe.length:0,
  server:keys.has("server"),
  game_winner:keys.has("winner"),
  player1_score:keys.has("player1_score"),
  player2_score:keys.has("player2_score"),
  player1_games:keys.has("player1_games"),
  player2_games:keys.has("player2_games"),
  ace_indicator:["ace","is_ace","point_code","code"].some(k=>keys.has(k)),
  double_fault_indicator:["double_fault","doubleFault","is_double_fault","point_code","code"].some(k=>keys.has(k)),
  serve_number:["serve_number","serveNumber","first_serve","second_serve"].some(k=>keys.has(k)),
  rally_length:["rally_length","rallyLength","shot_count"].some(k=>keys.has(k)),
};
if(!schemaProof.server||!schemaProof.player1_score||!schemaProof.player2_score)throw new Error("Stored BSD PBP schema probe no longer proves required server/score-state fields");
if(schemaProof.ace_indicator||schemaProof.double_fault_indicator)throw new Error("Stored schema changed: re-audit 031/032 before crediting them");

const atpMain=await readJson("data/audit/bsd-atp-main-pbp-history/2025/summary.json");
const atpChallenger=await readJson("data/audit/bsd-atp-challenger-pbp-history/2025/summary.json");
const wtaMain=await readJson("data/audit/bsd-wta-main-pbp-integration-validation.json");
const wtaChallenger=await readJson("data/audit/bsd-wta-challenger-pbp-validation/summary.json");
if(wtaChallenger.approved_for_metrics!==1645||wtaChallenger.quarantined!==155||wtaChallenger.unique_approved_match_ids!==1645)throw new Error("WTA Challenger approval/quarantine baseline changed; fail closed for Task 18B");

const treatments=Object.fromEntries(rawLaneSupported.map(code=>[code,reconstructed.has(code)?"RECONSTRUCTED":"PARTIAL"]));
const rawLane=(tour:string,availability:any)=>({tour,availability,recovered_codes:rawLaneSupported,recovered_cells:rawLaneSupported.length,recovery_rate_pct:Number((100*rawLaneSupported.length/codes.length).toFixed(4)),treatments,rejected_codes:rejectedMissingFields,rejected_reason:"Stored BSD point schema contains no ace/double-fault indicator; generic PBP is not accepted as proof for 031/032."});
const lanes=[
 rawLane("ATP_MAIN",{year:2025,pbp_available:atpMain.pbp_available,total_matches:atpMain.atp_main_matches,availability_pct:Number((100*atpMain.pbp_available/atpMain.atp_main_matches).toFixed(4))}),
 rawLane("WTA_MAIN",{accepted_unique_usable_pbp:wtaMain.accepted_unique_usable_wta_main_pbp_matches,duplicate_match_ids:wtaMain.duplicate_match_ids,validation_passed:wtaMain.validation_passed,denominator_available:false}),
 rawLane("ATP_CHALLENGER",{year:2025,pbp_available:atpChallenger.pbp_available,total_matches:atpChallenger.atp_challenger_matches,availability_pct:Number((100*atpChallenger.pbp_available/atpChallenger.atp_challenger_matches).toFixed(4))}),
 {tour:"WTA_CHALLENGER",availability:{source_records:wtaChallenger.source_records,approved_for_metrics:wtaChallenger.approved_for_metrics,quarantined:wtaChallenger.quarantined,approved_pct:Number((100*wtaChallenger.approved_for_metrics/wtaChallenger.source_records).toFixed(4))},recovered_codes:[],recovered_cells:0,recovery_rate_pct:0,treatments:{},rejected_codes:codes,rejected_reason:"The approved WTA Challenger/WTA 125 metrics asset retains validated aggregates only, not server-oriented chronological raw points. The 155 quarantined records remain excluded."},
];

const grossUsable=lanes.reduce((n,l:any)=>n+l.recovered_cells,0);
const reconstructedCells=3*reconstructed.size;
const partialCells=3*partial.size;
const mainAdapterPreviouslyUsable=3*legacyMainSupported.size;
const newAdapterCells=grossUsable-mainAdapterPreviouslyUsable;
const summary={
 task:"18B PBP / Score-State Evidence Recovery",
 task17_owned_metrics:codes,
 task17_global_baseline:{usable_cells:39,total_cells:324,exact_owned_cell_allocation_known:false},
 accounting_basis:"Exact relative-to-main Task 18B adapter capability. Task 17 explicitly did not persist the original 39-cell per-code allocation, so no fabricated subtraction is made from that global snapshot.",
 stored_raw_schema_proof:schemaProof,
 lanes,
 pbp_score_state_cells_previously_usable_on_main_adapter_path:mainAdapterPreviouslyUsable,
 gross_task18b_usable_cells_after_recovery:grossUsable,
 new_recovered_metric_tour_cells:newAdapterCells,
 direct_cells:0,
 reconstructed_cells:reconstructedCells,
 partial_cells:partialCells,
 remaining_unavailable_cells:72-grossUsable,
 cells_rejected_missing_required_raw_fields:3*rejectedMissingFields.length,
 cells_rejected_approved_asset_lacks_score_state:18,
 rejected_missing_field_codes:rejectedMissingFields,
 wta_challenger_quarantined_records_included:0,
 protected_unavailable_fields:["serve_number","rally_length","shot_type","shot_placement","winner/unforced-error shot labels","net_approach","first_strike_sequence","handedness"],
 live_api_status:process.env.BSD_TENNIS_API_KEY?"credential_present_but_repository_artifacts_are_authoritative_ci_input":"SKIPPED_NO_SECRET",
};
if(grossUsable!==48||newAdapterCells!==36||reconstructedCells!==33||partialCells!==15||summary.remaining_unavailable_cells!==24)throw new Error(`Task 18B accounting invariant failed: ${JSON.stringify({grossUsable,newAdapterCells,reconstructedCells,partialCells,remaining:summary.remaining_unavailable_cells})}`);
await mkdir(join(root,"data/audit/task18b-pbp-recovery"),{recursive:true});
await writeFile(join(root,"data/audit/task18b-pbp-recovery/summary.json"),JSON.stringify(summary,null,2)+"\n");
console.log(JSON.stringify(summary,null,2));
