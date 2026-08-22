import type { IdentityFinding, MetricFinding, Researcher } from "./audit-pipeline";
import { completionSweepResearcher } from "./completion-sweep-research.server";
import runtimeIndex from "../generated/tennis-runtime-index";

function norm(v:string){return String(v??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function tokens(v:string){return norm(v).split(" ").filter(Boolean);}
function runtimePlayers():Array<{name:string;tour:"ATP"|"WTA"}>{
  const out:Array<{name:string;tour:"ATP"|"WTA"}>=[];
  for(const tour of ["ATP","WTA"] as const){const rows=(runtimeIndex as any)?.[tour]??{};for(const value of Object.values(rows) as any[]){if(value?.name)out.push({name:String(value.name),tour});}}
  return out;
}
function resolveRuntimePlayer(input:string){const all=runtimePlayers(),needle=norm(input),exact=all.filter(x=>norm(x.name)===needle);if(exact.length===1)return exact[0];const req=tokens(input),last=req.at(-1);if(!last)return null;const candidates=all.filter(x=>{const t=tokens(x.name);if(t.at(-1)!==last)return false;const set=new Set(t);return req.length===1||req.every(v=>set.has(v));});return candidates.length===1?candidates[0]:null;}

const groups={
  serve:["service_points_won","first_serve","second_serve","ace_rate","double_fault","break_points_saved","hold_pct","service_games_held"],
  ret:["return_points_won","serve_return","break_point_conversion","break_pct","return_games","break_points_created"],
  market:["market","odds","price","implied","devig","de_vig","vig","favorite_probability","underdog_probability"],
  availability:["availability","injury","withdraw","retire","medical","layoff","days_since_last_match","return_after_layoff"],
  point:["point","game","break_state","score_state","first_break","rebreak","consolidation","serve_out","tiebreak"],
  rally:["rally","shot","forehand","backhand","net","drop_shot","direction","serve_plus_1","return_neutralization"],
  level:["same_level","tour_level","level_transition","challenger","itf","atp","wta"],
  environment:["surface","court_speed","indoor","outdoor","temperature","humidity","wind","altitude","roof","weather"],
  scheduling:["days_since_last_match","matches_last_14","matches_last_28","rest","travel","timezone","same_round","round","qualifying","recovery"],
  tournament:["same_tournament","tournament_specific","court_speed","venue","environment"],
};
function keys(value:string|null){return (value??"").split(/[;=]/).map(x=>norm(x)).filter(Boolean);}
function containsAny(value:string|null,terms:string[]){const v=norm(value??"");return terms.some(t=>v.includes(norm(t)));}
function semanticRequirement(name:string,body:string|null):keyof typeof groups|null{
  const t=norm(`${name} ${body??""}`);
  if(/market layer|market calibration|odds|implied probability|de vig|devig/.test(t))return"market";
  if(/serve profile|serve efficiency|serve\/return shot level/.test(t))return"serve";
  if(/return profile/.test(t))return"ret";
  if(/availability|injury|withdrawal|fitness/.test(t))return"availability";
  if(/point by point|score state|point to game/.test(t))return"point";
  if(/shot|rally/.test(t))return"rally";
  if(/level\/tour transition|tour-level transition|opponent elo differential/.test(t))return"level";
  if(/surface & environmental context|surface-transition|altitude|court-speed|weather sensitivity|data-source agreement/.test(t))return"environment";
  if(/scheduling\/context|days since last|travel-to-rest|recovery hours|schedule density|qualifier adaptation/.test(t))return"scheduling";
  if(/tournament-specific strength|exact tournament|venue familiarity/.test(t))return"tournament";
  return null;
}
function validSide(value:string|null,required:keyof typeof groups|null){if(!value)return false;if(!required)return true;return containsAny(value,groups[required]);}
function validateMetric(metric:{code:string;name:string;body:string|null},finding:MetricFinding):MetricFinding{
  const req=semanticRequirement(metric.name,metric.body);
  if(!req)return finding;
  const p1ok=validSide(finding.p1_value,req),p2ok=validSide(finding.p2_value,req);
  if(p1ok&&p2ok)return finding;
  return{
    ...finding,
    p1_value:p1ok?finding.p1_value:null,
    p2_value:p2ok?finding.p2_value:null,
    p1_treatment:p1ok?finding.p1_treatment:"UNAVAILABLE",
    p2_treatment:p2ok?finding.p2_treatment:"UNAVAILABLE",
    unavailable_reason:`Semantic evidence guard rejected a reconstruction that did not contain ${req}-specific inputs required by the metric definition.`,
    missing_inputs:[...(finding.missing_inputs??[]),`${req}-specific sourced inputs`],
  };
}
function mergeRuntimeIdentity(base:IdentityFinding,p1:string,p2:string):IdentityFinding{
  const a=resolveRuntimePlayer(p1),b=resolveRuntimePlayer(p2);
  return{
    ...base,
    player1_canonical:base.player1_canonical??a?.name??null,
    player2_canonical:base.player2_canonical??b?.name??null,
    player1_status:base.player1_status==="VERIFIED"||a?"VERIFIED":base.player1_status,
    player2_status:base.player2_status==="VERIFIED"||b?"VERIFIED":base.player2_status,
    unresolved_reason:(base.player1_status==="VERIFIED"||a)&&(base.player2_status==="VERIFIED"||b)?null:base.unresolved_reason,
    sources:[...(base.sources??[]),...(a||b?[{source_name:"Bundled historical player index",url:null,retrieved_at:new Date().toISOString()}]:[])],
  };
}

export const validatedCompletionResearcher:Researcher={
  ...completionSweepResearcher,
  async identity(input){return mergeRuntimeIdentity(await completionSweepResearcher.identity(input),input.p1,input.p2);},
  async metrics(input){const rows=await completionSweepResearcher.metrics(input);const defs=new Map(input.metrics.map(m=>[String(m.code),m]));return rows.map(row=>{const def=defs.get(String(row.metric_code));return def?validateMetric(def,row):row;});},
};
