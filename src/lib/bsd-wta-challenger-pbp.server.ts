import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { policyForMetric } from "./metric-source-family-policy";
import { TASK18B_METRIC_CODES } from "./pbp-score-state-recovery";

const COVERAGE_START = "2025-01-01";
const APPROVED_INDEX = join(process.cwd(), "data", "metrics", "pbp", "wta_challenger", "approved-index.jsonl");
const LEGACY_PBP_CODES = new Set(["024","025","033","036","040","042","043","044","060","079"]);

type MetricLike = { code: string; name: string };
type ApprovedRow = {
  tour?: string;
  year?: number;
  match_id?: string | number;
  date?: string;
  tournament?: string;
  player1?: string;
  player2?: string;
  metrics?: { set_scores?: Array<[number,number]>; match_winner_slot?: "player1"|"player2"|string; total_games?: number; total_points?: number; breaks?: number };
  status?: string;
};

const norm=(value:unknown)=>String(value??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const codeOf=(value:unknown)=>{const match=String(value??"").match(/(\d{1,3})$/);return match?match[1].padStart(3,"0"):String(value??"").padStart(3,"0");};
function explicitWtaChallengerContext(context:string|null|undefined){const text=norm(context);if(!text)return false;if(["atp","itf","futures","utr","satellite","exhibition"].some(marker=>text.includes(marker)))return false;return text.includes("wta 125")||text.includes("wta125")||text.includes("125k")||text.includes("wta challenger");}
async function loadApprovedIndex():Promise<ApprovedRow[]>{try{const raw=await readFile(APPROVED_INDEX,"utf8");return raw.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line) as ApprovedRow).filter(row=>row.status==="APPROVED_WTA_CHALLENGER_PBP"&&row.tour==="WTA_CHALLENGER");}catch{return[];}}

export async function buildBsdWtaChallengerPbpContext(args:{metrics:MetricLike[];p1:string;p2:string;asOfDate:string;context?:string|null}){
  const status={eligible:false,reason:"",matches_used:0,approved_records_available:0,quarantined_records_included:0,coverage_start:COVERAGE_START,source:"BSD/Bzzoiro WTA Challenger approved PBP index"};
  if(!explicitWtaChallengerContext(args.context)){status.reason="Fail-closed tour guard: context is not explicitly WTA Challenger/WTA 125.";return{packet:{} as Record<string,unknown>,status};}
  if(args.asOfDate<COVERAGE_START){status.reason="Outside confirmed BSD WTA Challenger/WTA 125 PBP coverage boundary (2025-current).";return{packet:{} as Record<string,unknown>,status};}
  status.eligible=true;
  const approved=await loadApprovedIndex();
  status.approved_records_available=approved.length;
  const p1n=norm(args.p1),p2n=norm(args.p2);
  const rows=approved.filter(row=>{const date=String(row.date??"").slice(0,10);if(!date||date>args.asOfDate)return false;const a=norm(row.player1),b=norm(row.player2);return a===p1n||b===p1n||a===p2n||b===p2n;}).sort((a,b)=>String(b.date??"").localeCompare(String(a.date??""))).slice(0,40);
  const observations=rows.map(row=>{const metrics=row.metrics??{};return{family:"POINT_BY_POINT",source:"BSD/Bzzoiro WTA Challenger approved PBP index",url:null,player1:String(row.player1??""),player2:String(row.player2??""),tournament:row.tournament??null,event_date:String(row.date??"").slice(0,10),key:"bsd_wta_challenger_approved_pbp_aggregate_only",value:{match_id:row.match_id??null,set_scores:metrics.set_scores??null,match_winner_slot:metrics.match_winner_slot??null,total_games:metrics.total_games??null,total_points:metrics.total_points??null,breaks:metrics.breaks??null,task18b_raw_fields_available:false},sample:`${metrics.total_points??"NA"} aggregate points; ${metrics.total_games??"NA"} games; ${metrics.breaks??"NA"} total breaks`,provenance:{tour:"WTA_CHALLENGER",approved_only:true,approval_source:"APPROVED_WTA_CHALLENGER_PBP",structural_validation:true,match_identity_validation:true,duplicate_protection:true,quarantined_records_reintroduced:false,server_oriented_point_chronology_preserved:false}};});
  status.matches_used=observations.length;
  const packet:Record<string,unknown>={};
  for(const metric of args.metrics){
    const code=codeOf(metric.code);
    // Critical Task 18B firewall: the 1,645-row approved WTA 125 index preserves
    // aggregate validation outputs, not the server-oriented raw point chronology
    // required by the owned score-state metrics. Generic PBP presence is not credit.
    if(TASK18B_METRIC_CODES.has(code))continue;
    if(!LEGACY_PBP_CODES.has(code)||!observations.length)continue;
    const policy=policyForMetric(code);
    if(!policy.allowed_families.includes("POINT_BY_POINT"))continue;
    packet[code]={metric_name:metric.name,allowed_families:policy.allowed_families,sufficient_families:policy.sufficient_families,support_only_families:policy.support_only_families??[],observed_families:["POINT_BY_POINT"],direct_satisfaction_allowed:false,observations:observations.slice(0,80),tour_guard:"STRICT_WTA_CHALLENGER_WTA125_ONLY",evidence_treatment:"AGGREGATE_ONLY_NO_TASK18B_SCORE_STATE_CREDIT"};
  }
  status.reason=observations.length?"Approved WTA Challenger/WTA 125 aggregate PBP rows found, but Task 18B score-state cells remain unavailable because raw server-oriented point chronology is not retained in the approved metrics index.":"No approved WTA Challenger/WTA 125 PBP observations matched these players.";
  return{packet,status};
}
