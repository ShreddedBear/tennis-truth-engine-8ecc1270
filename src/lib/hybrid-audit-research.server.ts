// Hybrid audit researcher. Local public historical evidence is always attempted
// first; live AI/web research supplements it when available.
import type { IdentityFinding, Researcher, MetricFinding } from "./audit-pipeline";
import type { SourcedStat } from "./reconstruction/engine";
import { aiResearcher } from "./audit-research.server";
import { getPredixDatasetEvidence, predixDatasetDossier, statsFromPredixDatasetDossier } from "./predixsport-dataset.server";
import { resolveLocalMatchContext } from "./local-match-context.server";

function isProviderFailure(error: unknown): boolean {
  const m=error instanceof Error?error.message.toLowerCase():String(error).toLowerCase();
  return /402|credit|quota|429|rate limit|timeout|provider|api key|auth|fetch|not configured/.test(m);
}

function localIdentity(input:{p1:string;p2:string;hints:Record<string,string|null>}):IdentityFinding {
  const ctx=resolveLocalMatchContext(input.p1,input.p2,input.hints);
  const context=Object.entries(ctx.fields).filter(([,v])=>v).map(([k,v])=>`${k} ${v}`).join(" · ");
  const p1Exists=!!getPredixDatasetEvidence(input.p1,context), p2Exists=!!getPredixDatasetEvidence(input.p2,context);
  return {
    player1_canonical:p1Exists?input.p1:null, player2_canonical:p2Exists?input.p2:null,
    player1_status:p1Exists?"VERIFIED":"UNVERIFIED", player2_status:p2Exists?"VERIFIED":"UNVERIFIED",
    tournament:ctx.fields.tournament??null,event_level:ctx.fields.event_level??null,round:ctx.fields.round??null,
    scheduled_date:ctx.fields.scheduled_date??null,surface:ctx.fields.surface??null,indoor:null,
    best_of:ctx.fields.best_of?Number(ctx.fields.best_of):null,
    surface_status:ctx.fields.surface?"VERIFIED":"UNVERIFIED",
    unresolved_reason:ctx.unresolvedReason,
    sources:ctx.sources.map(name=>({source_name:name,url:ctx.sourceUrl,retrieved_at:new Date().toISOString()})), conflicts:[],
  };
}

function mergeIdentity(local:IdentityFinding,live:IdentityFinding):IdentityFinding {
  const choose=<T>(a:T|null|undefined,b:T|null|undefined)=>b??a??null;
  return {
    player1_canonical:choose(local.player1_canonical,live.player1_canonical),player2_canonical:choose(local.player2_canonical,live.player2_canonical),
    player1_status:live.player1_status==="VERIFIED"?"VERIFIED":local.player1_status,player2_status:live.player2_status==="VERIFIED"?"VERIFIED":local.player2_status,
    tournament:choose(local.tournament,live.tournament),event_level:choose(local.event_level,live.event_level),round:choose(local.round,live.round),
    scheduled_date:choose(local.scheduled_date,live.scheduled_date),surface:choose(local.surface,live.surface),indoor:choose(local.indoor,live.indoor),best_of:choose(local.best_of,live.best_of),
    surface_status:live.surface_status==="VERIFIED"?"VERIFIED":local.surface_status,
    unresolved_reason:null,sources:[...(local.sources??[]),...(live.sources??[])],conflicts:[...(local.conflicts??[]),...(live.conflicts??[])],
  };
}

function textStat(map:Map<string,SourcedStat>, keys:string[]):SourcedStat|null { for(const k of keys){const s=map.get(k);if(s)return s;}return null; }
function summaryFor(map:Map<string,SourcedStat>, family:string):{value:string;sample:number|null;sources:SourcedStat["sources"]}|null {
  const get=(k:string)=>map.get(k)?.value;
  const specs:Record<string,()=>string|null>={
    surface:()=>{const elo=get("surface_elo"),wp=get("surface_win_pct"),n=get("surface_matches");return elo!==undefined||wp!==undefined?`Surface Elo ${elo??"—"}; surface win ${wp!==undefined?Number(wp).toFixed(1)+"%":"—"}; matches ${n??"—"}`:null;},
    set:()=>{const wp=get("set_win_pct"),n=get("sets_played");return wp!==undefined?`Set win ${Number(wp).toFixed(1)}%; sets ${n??"—"}`:null;},
    straight:()=>{const wp=get("straight_set_win_pct"),n=get("straight_set_wins");return wp!==undefined?`Straight-set win rate ${Number(wp).toFixed(1)}%; straight-set wins ${n??"—"}`:null;},
    deciding:()=>{const wp=get("deciding_set_win_pct"),n=get("deciding_sets_played");return wp!==undefined?`Deciding-set win ${Number(wp).toFixed(1)}%; deciding sets ${n??"—"}`:null;},
    workload:()=>{const n=get("matches_last_28_days");return n!==undefined?`${n} matches in previous 28 days`:null;},
    record:()=>{const w=get("wins"),l=get("losses"),wp=get("win_pct");return w!==undefined||l!==undefined?`Record ${w??"—"}-${l??"—"}; win ${wp!==undefined?Number(wp).toFixed(1)+"%":"—"}`:null;},
    elo:()=>{const e=get("surface_elo"),p=get("peak_surface_elo");return e!==undefined?`Surface Elo ${e}; peak ${p??"—"}`:null;},
  };
  const value=specs[family]?.();if(!value)return null;
  const first=[...map.values()][0];return{value,sample:first?.sample??null,sources:first?.sources??[]};
}

function metricFamily(code:string,name:string):string|null {
  const h=`${code} ${name}`.toLowerCase();
  if(/surface strength|surface.*elo|match-state elo|tournament-specific strength/.test(h))return"surface";
  if(/set profile/.test(h))return"set";
  if(/straight-set|2.?0/.test(h))return"straight";
  if(/deciding|comeback|pressure behavior/.test(h))return"deciding";
  if(/fatigue|workload|scheduling|season-long fatigue/.test(h))return"workload";
  if(/recent form|trajectory|rolling|win autopsy|loss autopsy|false-form|hidden improvement|hidden decline|performance quality/.test(h))return"record";
  if(/elo|rating-lag|present-strength/.test(h))return"elo";
  return null;
}

function localMetricRows(p1:string,p2:string,context:string,requested:Array<{code:string;name:string;body:string|null}>):MetricFinding[] {
  const a=getPredixDatasetEvidence(p1,context),b=getPredixDatasetEvidence(p2,context);
  const amap=new Map((a?.stats??[]).map(s=>[s.key,s])),bmap=new Map((b?.stats??[]).map(s=>[s.key,s]));
  const directAliases:Record<string,string[]>={surface_elo:["surface_elo"],peak_elo:["peak_surface_elo"],surface_win_pct:["surface_win_pct"],win_pct:["win_pct"],surface_matches:["surface_matches"],matches_played:["matches_played"],sets_played:["sets_played"],sets_won:["sets_won"],set_win_pct:["set_win_pct"],straight_set_win_pct:["straight_set_win_pct"],deciding_set_win_pct:["deciding_set_win_pct"],matches_last_28_days:["matches_last_28_days"]};
  return requested.map(m=>{
    const hay=`${m.code} ${m.name}`.toLowerCase().replace(/[^a-z0-9]+/g,"_");
    let x:SourcedStat|null=null,y:SourcedStat|null=null;
    for(const[needle,keys]of Object.entries(directAliases))if(hay.includes(needle)){x=textStat(amap,keys);y=textStat(bmap,keys);if(x||y)break;}
    const family=metricFamily(m.code,m.name), xs=x?{value:String(x.value),sample:x.sample,sources:x.sources}:family?summaryFor(amap,family):null, ys=y?{value:String(y.value),sample:y.sample,sources:y.sources}:family?summaryFor(bmap,family):null;
    const sources=[...(xs?.sources??[]),...(ys?.sources??[])].filter((s,i,arr)=>arr.findIndex(z=>z.source_name===s.source_name&&z.url===s.url)===i);
    return {metric_code:m.code,p1_value:xs?.value??null,p2_value:ys?.value??null,p1_treatment:xs?"RECONSTRUCTED":"UNAVAILABLE",p2_treatment:ys?"RECONSTRUCTED":"UNAVAILABLE",differential:null,evidence_family:family?"PUBLIC_HISTORICAL_DATA":null,reliability:xs||ys?80:null,sample:String(Math.max(xs?.sample??0,ys?.sample??0))||null,unavailable_reason:!xs&&!ys?"Not derivable from synced public historical fields":null,sources} as MetricFinding;
  });
}

function mergeMetrics(live:MetricFinding[],local:MetricFinding[]):MetricFinding[]{const by=new Map(local.map(m=>[m.metric_code,m]));return live.map(m=>{const l=by.get(m.metric_code);if(!l)return m;const p1=m.p1_treatment!=="UNAVAILABLE"&&m.p1_value!==null,p2=m.p2_treatment!=="UNAVAILABLE"&&m.p2_value!==null;return{...m,p1_value:p1?m.p1_value:l.p1_value,p1_treatment:p1?m.p1_treatment:l.p1_treatment,p2_value:p2?m.p2_value:l.p2_value,p2_treatment:p2?m.p2_treatment:l.p2_treatment,sources:[...(m.sources??[]),...(l.sources??[])],unavailable_reason:(p1||l.p1_value||p2||l.p2_value)?null:m.unavailable_reason};});}

export const hybridResearcher:Researcher={
  async identity(input){const local=localIdentity(input);try{return mergeIdentity(local,await aiResearcher.identity(input));}catch(e){if(!isProviderFailure(e))throw e;return local;}},
  async dossier({player,opponent,context}){const local=predixDatasetDossier(player,context);try{const live=await aiResearcher.dossier?.({player,opponent,context})??"";return[local,live].filter(Boolean).join("\n");}catch(e){if(!isProviderFailure(e))throw e;return local;}},
  async extractStats({player,dossier,context}){const local=statsFromPredixDatasetDossier(dossier,player);try{const live=await aiResearcher.extractStats?.({player,dossier,context})??[];const seen=new Set(live.map(s=>`${s.key}|${s.surface??""}|${s.window??""}`));return[...live,...local.filter(s=>!seen.has(`${s.key}|${s.surface??""}|${s.window??""}`))];}catch(e){if(!isProviderFailure(e))throw e;return local;}},
  async metrics(input){const local=localMetricRows(input.p1,input.p2,input.context,input.metrics);try{return mergeMetrics(await aiResearcher.metrics(input),local);}catch(e){if(!isProviderFailure(e))throw e;return local;}},
  rules:(input)=>aiResearcher.rules(input),underdog:(input)=>aiResearcher.underdog(input),conclusion:(input)=>aiResearcher.conclusion(input),stress:(input)=>aiResearcher.stress(input),
};
