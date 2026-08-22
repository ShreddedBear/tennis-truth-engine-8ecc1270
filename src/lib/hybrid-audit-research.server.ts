// Hybrid audit researcher. Local public historical evidence is always attempted
// first; live AI/web research supplements it when available.
import type { IdentityFinding, Researcher, MetricFinding } from "./audit-pipeline";
import type { SourcedStat } from "./reconstruction/engine";
import { aiResearcher } from "./audit-research.server";
import { getPredixDatasetEvidence, predixDatasetDossier, statsFromPredixDatasetDossier } from "./predixsport-dataset.server";
import { getRecentReconstruction } from "./predixsport-recent.server";
import { getCommonOpponentEvidence } from "./predixsport-common.server";
import { resolveLocalMatchContext } from "./local-match-context.server";

function isProviderFailure(error: unknown): boolean { const m=error instanceof Error?error.message.toLowerCase():String(error).toLowerCase(); return /402|credit|quota|429|rate limit|timeout|provider|api key|auth|fetch|not configured/.test(m); }

function localIdentity(input:{p1:string;p2:string;hints:Record<string,string|null>}):IdentityFinding {
  const ctx=resolveLocalMatchContext(input.p1,input.p2,input.hints);
  const context=Object.entries(ctx.fields).filter(([,v])=>v).map(([k,v])=>`${k} ${v}`).join(" · ");
  const p1Evidence=getPredixDatasetEvidence(input.p1,context),p2Evidence=getPredixDatasetEvidence(input.p2,context);
  return {player1_canonical:p1Evidence?.canonicalPlayer??(p1Evidence?input.p1:null),player2_canonical:p2Evidence?.canonicalPlayer??(p2Evidence?input.p2:null),player1_status:p1Evidence?"VERIFIED":"UNVERIFIED",player2_status:p2Evidence?"VERIFIED":"UNVERIFIED",tournament:ctx.fields.tournament??null,event_level:ctx.fields.event_level??null,round:ctx.fields.round??null,scheduled_date:ctx.fields.scheduled_date??null,surface:ctx.fields.surface??null,indoor:null,best_of:ctx.fields.best_of?Number(ctx.fields.best_of):null,surface_status:ctx.fields.surface?"VERIFIED":"UNVERIFIED",unresolved_reason:ctx.unresolvedReason,sources:ctx.sources.map(name=>({source_name:name,url:ctx.sourceUrl,retrieved_at:new Date().toISOString()})),conflicts:[]};
}
function mergeIdentity(local:IdentityFinding,live:IdentityFinding):IdentityFinding { const choose=<T>(a:T|null|undefined,b:T|null|undefined)=>b??a??null; return {player1_canonical:choose(local.player1_canonical,live.player1_canonical),player2_canonical:choose(local.player2_canonical,live.player2_canonical),player1_status:live.player1_status==="VERIFIED"?"VERIFIED":local.player1_status,player2_status:live.player2_status==="VERIFIED"?"VERIFIED":local.player2_status,tournament:choose(local.tournament,live.tournament),event_level:choose(local.event_level,live.event_level),round:choose(local.round,live.round),scheduled_date:choose(local.scheduled_date,live.scheduled_date),surface:choose(local.surface,live.surface),indoor:choose(local.indoor,live.indoor),best_of:choose(local.best_of,live.best_of),surface_status:live.surface_status==="VERIFIED"?"VERIFIED":local.surface_status,unresolved_reason:live.unresolved_reason??local.unresolved_reason,sources:[...(local.sources??[]),...(live.sources??[])],conflicts:[...(local.conflicts??[]),...(live.conflicts??[])]}; }

function familyCode(code:string){const m=String(code).match(/(\d{1,3})$/);return m?m[1].padStart(3,"0"):String(code).padStart(3,"0");}
function summarize(map:Map<string,SourcedStat>,keys:string[]){const present=keys.map(k=>map.get(k)).filter((x):x is SourcedStat=>!!x);if(!present.length)return null;return present.map(s=>`${s.key}=${Number(s.value).toFixed(2)}`).join("; ");}
function summaryFor(map:Map<string,SourcedStat>,code:string):{value:string;sample:number|null;sources:SourcedStat["sources"]}|null {
  const get=(k:string)=>map.get(k)?.value,family=familyCode(code);let value:string|null=null;
  if(family==="001"){const e=get("surface_elo"),p=get("peak_surface_elo"),wp=get("surface_win_pct"),n=get("surface_matches"),trend=get("surface_elo_trend"),gap=get("peak_vs_current_elo_gap");if(e!==undefined||wp!==undefined||trend!==undefined)value=`Surface Elo ${e??"—"}; peak ${p??"—"}; win ${wp!==undefined?Number(wp).toFixed(1)+"%":"—"}; matches ${n??"—"}; trend ${trend??"—"}; peak gap ${gap??"—"}`;}
  if(family==="005") value=summarize(map,["last5_win_pct","last10_win_pct","last5_set_win_pct","last10_set_win_pct","current_surface_recent_win_pct","win_pct_60d","win_pct_90d","recent_form_trend","recent_straight_set_control_pct"]);
  if(family==="006") value=summarize(map,["recent_opponent_avg_elo","best_recent_win_opponent_elo","bad_loss_rate_pct"]);
  if(family==="008"){const wp=get("set_win_pct"),n=get("sets_played"),w=get("sets_won");if(wp!==undefined)value=`Set win ${Number(wp).toFixed(1)}%; sets ${w??"—"}/${n??"—"}`;}
  if(family==="009"){const wp=get("deciding_set_win_pct"),n=get("deciding_sets_played"),w=get("deciding_sets_won");if(wp!==undefined)value=`Deciding-set win ${Number(wp).toFixed(1)}%; ${w??"—"}/${n??"—"}`;}
  if(family==="010"){const wp=get("straight_set_win_pct"),w=get("straight_set_wins"),mw=get("matches_won");if(wp!==undefined)value=`Straight-set win rate ${Number(wp).toFixed(1)}%; straight wins ${w??"—"}; match wins ${mw??"—"}`;}
  if(family==="012") value=summarize(map,["matches_last_7_days","matches_last_14_days","matches_last_28_days","sets_last_14_days","three_setters_last_14_days","rest_days"]);
  if(family==="014"){const w=get("wins"),l=get("losses"),wp=get("win_pct");if(w!==undefined||l!==undefined)value=`Historical record ${w??"—"}-${l??"—"}; win ${wp!==undefined?Number(wp).toFixed(1)+"%":"—"}`;}
  if(!value)return null;const first=[...map.values()][0];return{value,sample:first?.sample??null,sources:first?.sources??[]};
}
function localMetricRows(p1:string,p2:string,context:string,requested:Array<{code:string;name:string;body:string|null}>):MetricFinding[]{
  const a=getPredixDatasetEvidence(p1,context),b=getPredixDatasetEvidence(p2,context);
  const astats=[...(a?.stats??[]),...getRecentReconstruction(p1,context)],bstats=[...(b?.stats??[]),...getRecentReconstruction(p2,context)];
  const amap=new Map(astats.map(s=>[s.key,s])),bmap=new Map(bstats.map(s=>[s.key,s]));const common=getCommonOpponentEvidence(p1,p2,context);
  return requested.map(m=>{let xs=summaryFor(amap,m.code),ys=summaryFor(bmap,m.code);if(familyCode(m.code)==="007"&&common){const src=[common.source];xs={value:`${common.commonCount} common opponents; ${common.p1Wins}-${common.p1Losses}; win ${common.p1WinPct?.toFixed(1)??"—"}%`,sample:common.commonCount,sources:src};ys={value:`${common.commonCount} common opponents; ${common.p2Wins}-${common.p2Losses}; win ${common.p2WinPct?.toFixed(1)??"—"}%`,sample:common.commonCount,sources:src};}
    const sources=[...(xs?.sources??[]),...(ys?.sources??[])].filter((s,i,arr)=>arr.findIndex(z=>z.source_name===s.source_name&&z.url===s.url)===i);
    return{metric_code:m.code,p1_value:xs?.value??null,p2_value:ys?.value??null,p1_treatment:xs?"RECONSTRUCTED":"UNAVAILABLE",p2_treatment:ys?"RECONSTRUCTED":"UNAVAILABLE",differential:null,evidence_family:xs||ys?`PUBLIC_HISTORICAL_DATA_FAMILY_${familyCode(m.code)}`:null,reliability:xs||ys?85:null,sample:String(Math.max(xs?.sample??0,ys?.sample??0))||null,unavailable_reason:!xs&&!ys?"Synced public historical data does not support this metric family":null,sources} as MetricFinding;});
}
function mergeMetrics(live:MetricFinding[],local:MetricFinding[]):MetricFinding[]{const liveBy=new Map(live.map(m=>[String(m.metric_code),m]));return local.map(l=>{const m=liveBy.get(String(l.metric_code));if(!m)return l;const liveP1=m.p1_treatment!=="UNAVAILABLE"&&m.p1_treatment!=="EXCLUDED"&&m.p1_value!==null,liveP2=m.p2_treatment!=="UNAVAILABLE"&&m.p2_treatment!=="EXCLUDED"&&m.p2_value!==null,p1Local=l.p1_value!==null,p2Local=l.p2_value!==null;return{...m,p1_value:liveP1?m.p1_value:l.p1_value,p1_treatment:liveP1?m.p1_treatment:(p1Local?l.p1_treatment:m.p1_treatment),p2_value:liveP2?m.p2_value:l.p2_value,p2_treatment:liveP2?m.p2_treatment:(p2Local?l.p2_treatment:m.p2_treatment),evidence_family:m.evidence_family??l.evidence_family,reliability:m.reliability??l.reliability,sample:m.sample??l.sample,sources:[...(m.sources??[]),...(l.sources??[])].filter((s,i,arr)=>arr.findIndex(z=>z.source_name===s.source_name&&z.url===s.url)===i),unavailable_reason:(liveP1||liveP2||p1Local||p2Local)?null:(m.unavailable_reason??l.unavailable_reason)};});}

export const hybridResearcher:Researcher={
  async identity(input){const local=localIdentity(input);try{return mergeIdentity(local,await aiResearcher.identity(input));}catch(e){if(!isProviderFailure(e))throw e;return local;}},
  async dossier({player,opponent,context}){const local=predixDatasetDossier(player,context);try{const live=await aiResearcher.dossier?.({player,opponent,context})??"";return[local,live].filter(Boolean).join("\n");}catch(e){if(!isProviderFailure(e))throw e;return local;}},
  async extractStats({player,dossier,context}){const local=[...statsFromPredixDatasetDossier(dossier,player),...getRecentReconstruction(player,context)];try{const live=await aiResearcher.extractStats?.({player,dossier,context})??[];const seen=new Set(live.map(s=>`${s.key}|${s.surface??""}|${s.window??""}`));return[...live,...local.filter(s=>!seen.has(`${s.key}|${s.surface??""}|${s.window??""}`))];}catch(e){if(!isProviderFailure(e))throw e;return local;}},
  async metrics(input){const local=localMetricRows(input.p1,input.p2,input.context,input.metrics);try{return mergeMetrics(await aiResearcher.metrics(input),local);}catch(e){if(!isProviderFailure(e))throw e;return local;}},
  rules:(input)=>aiResearcher.rules(input),underdog:(input)=>aiResearcher.underdog(input),conclusion:(input)=>aiResearcher.conclusion(input),stress:(input)=>aiResearcher.stress(input),
};
