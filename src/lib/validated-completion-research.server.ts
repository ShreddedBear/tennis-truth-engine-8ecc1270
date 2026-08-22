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

const COMPOSITE_COMPONENTS:Record<string,Array<{name:string;terms:string[]}>>={
  "034":[
    {name:"scoreline vs point dominance",terms:["scoreline vs point dominance","point dominance","total points won"]},
    {name:"scoreline vs expected games",terms:["scoreline vs expected games","expected games"]},
    {name:"scoreline vs break opportunities",terms:["scoreline vs break opportunities","break opportunities","break points generated"]},
    {name:"scoreline vs dominance ratio",terms:["scoreline vs dominance ratio","dominance ratio"]},
    {name:"clutch-performance dependency",terms:["clutch performance dependency","clutch dependency","key points","score state"]},
  ],
  "036":[
    {name:"loss favorite status",terms:["loss favorite status","favorite status","pre match favorite","pre match odds"]},
    {name:"loss opponent quality",terms:["loss opponent quality","opponent quality","opponent elo","opponent ranking"]},
    {name:"loss surface",terms:["loss surface","surface"]},
    {name:"loss point differential",terms:["loss point differential","point differential","points won differential"]},
    {name:"loss break differential",terms:["loss break differential","break differential","break point differential"]},
    {name:"loss serve deterioration",terms:["loss serve deterioration","serve deterioration","serve decline"]},
    {name:"loss return deterioration",terms:["loss return deterioration","return deterioration","return decline"]},
    {name:"lost after leading",terms:["lost after leading","lead state","led then lost"]},
    {name:"lost set 1",terms:["lost set 1","lost first set","set 1 loss"]},
    {name:"loss in deciding set",terms:["loss in deciding set","deciding set","final set"]},
    {name:"loss in tiebreak",terms:["loss in tiebreak","tiebreak"]},
    {name:"loss physical problem",terms:["loss physical problem","physical problem","injury","medical timeout"]},
    {name:"loss match length",terms:["loss match length","match length","duration"]},
    {name:"competitive vs blowout loss",terms:["competitive vs blowout","competitive loss","blowout loss"]},
    {name:"bad-loss severity index",terms:["bad loss severity index","bad loss severity"]},
  ],
  "038":[
    {name:"hold residual vs opponent norm",terms:["hold residual","hold vs opponent norm"]},
    {name:"break residual vs opponent norm",terms:["break residual","break vs opponent norm"]},
    {name:"total-points residual vs opponent norm",terms:["total points residual","points residual"]},
    {name:"games residual vs opponent norm",terms:["games residual"]},
    {name:"sets residual vs opponent norm",terms:["sets residual"]},
    {name:"dominance-ratio residual vs opponent norm",terms:["dominance ratio residual"]},
    {name:"serve-points residual vs opponent norm",terms:["serve points residual","service points residual"]},
    {name:"return-points residual vs opponent norm",terms:["return points residual"]},
  ],
  "039":[
    {name:"match-level actual performance",terms:["actual performance","match level performance"]},
    {name:"pre-match expected performance",terms:["pre match expected performance","expected performance"]},
    {name:"match-level surprise residual",terms:["performance surprise","actual minus expected","surprise residual"]},
    {name:"rolling last-10 surprise",terms:["rolling performance surprise","last 10","last ten"]},
  ],
  "040":[
    {name:"serve velocity trend",terms:["serve velocity trend","serve speed trend"]},
    {name:"ace rate trend",terms:["ace rate trend"]},
    {name:"first-serve points won trend",terms:["first serve points won trend"]},
    {name:"second-serve points won trend",terms:["second serve points won trend"]},
    {name:"return points won trend",terms:["return points won trend"]},
    {name:"break opportunities trend",terms:["break opportunities trend","break points generated trend"]},
    {name:"hold vulnerability trend",terms:["hold vulnerability trend","danger score trend","service game danger"]},
    {name:"double-fault trend",terms:["double fault trend"]},
    {name:"match duration trend",terms:["match duration trend"]},
    {name:"three-set dependency trend",terms:["three set dependency trend","three set trend","go the distance"]},
  ],
};
function familyCode(code:string){const m=String(code).match(/(\d{1,3})$/);return m?m[1].padStart(3,"0"):String(code).padStart(3,"0");}
function componentHits(value:string|null,components:Array<{name:string;terms:string[]}>){return components.filter(c=>containsAny(value,c.terms));}
function validateCompositeSide(value:string|null,treatment:MetricFinding["p1_treatment"],sources:MetricFinding["sources"],components:Array<{name:string;terms:string[]}>){
  if(treatment==="UNAVAILABLE"||treatment==="EXCLUDED"||!value)return{value,treatment,missing:[] as string[]};
  const hits=componentHits(value,components),missing=components.filter(c=>!hits.includes(c)).map(c=>c.name),hasSource=Boolean(sources?.length);
  if(treatment==="DIRECT"){
    if(!missing.length&&hasSource)return{value,treatment,missing};
    if(hits.length&&hasSource)return{value,treatment:"PARTIAL" as const,missing};
    return{value:null,treatment:"UNAVAILABLE" as const,missing:missing.length?missing:components.map(c=>c.name)};
  }
  if(treatment==="RECONSTRUCTED"){
    if(!missing.length&&hasSource)return{value,treatment,missing};
    if(hits.length&&hasSource)return{value,treatment:"PARTIAL" as const,missing};
    return{value:null,treatment:"UNAVAILABLE" as const,missing:missing.length?missing:components.map(c=>c.name)};
  }
  if(treatment==="PARTIAL")return hits.length&&hasSource?{value,treatment,missing}:{value:null,treatment:"UNAVAILABLE" as const,missing:components.map(c=>c.name)};
  return{value:null,treatment:"UNAVAILABLE" as const,missing:components.map(c=>c.name)};
}

export function validateMetric(metric:{code:string;name:string;body:string|null},finding:MetricFinding):MetricFinding{
  const composite=COMPOSITE_COMPONENTS[familyCode(metric.code)];
  if(composite){
    const p1=validateCompositeSide(finding.p1_value,finding.p1_treatment,finding.sources,composite),p2=validateCompositeSide(finding.p2_value,finding.p2_treatment,finding.sources,composite);
    const missing=[...new Set([...(p1.missing??[]),...(p2.missing??[])])];
    return{
      ...finding,
      p1_value:p1.value,
      p2_value:p2.value,
      p1_treatment:p1.treatment,
      p2_treatment:p2.treatment,
      unavailable_reason:(p1.treatment==="UNAVAILABLE"||p2.treatment==="UNAVAILABLE"||p1.treatment==="PARTIAL"||p2.treatment==="PARTIAL")&&missing.length?`Exact-component guard: unsupported components remain missing (${missing.join(", ")}). No proxy substitution permitted.`:finding.unavailable_reason,
      missing_inputs:missing.length?[...(finding.missing_inputs??[]),...missing]:finding.missing_inputs,
    };
  }
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