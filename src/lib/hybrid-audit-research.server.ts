// Hybrid audit researcher: local CC-BY historical data is always attempted,
// while live research remains optional. A Lovable 402 must not erase valid
// local evidence or turn every metric into 0/0.

import type { Researcher, MetricFinding } from "./audit-pipeline";
import type { SourcedStat } from "./reconstruction/engine";
import { aiResearcher } from "./audit-research.server";
import { getPredixDatasetEvidence, predixDatasetDossier, statsFromPredixDatasetDossier } from "./predixsport-dataset.server";

function isProviderFailure(error: unknown): boolean {
  const m = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /402|credit|quota|429|rate limit|timeout|provider|api key|auth|fetch/.test(m);
}

function localMetricRows(p1: string, p2: string, context: string, requested: Array<{code:string;name:string;body:string|null}>): MetricFinding[] {
  const a=getPredixDatasetEvidence(p1,context), b=getPredixDatasetEvidence(p2,context);
  const amap=new Map((a?.stats??[]).map((s)=>[s.key,s]));
  const bmap=new Map((b?.stats??[]).map((s)=>[s.key,s]));
  const aliases: Record<string,string[]> = {
    elo:["surface_elo"], surface_elo:["surface_elo"], peak_elo:["peak_surface_elo"], peak_surface_elo:["peak_surface_elo"],
    surface_win_pct:["surface_win_pct"], win_pct:["win_pct","surface_win_pct"], surface_matches:["surface_matches"], matches_played:["matches_played","surface_matches"],
    sets_played:["sets_played"], sets_won:["sets_won"], set_win_pct:["set_win_pct"], straight_set_win_pct:["straight_set_win_pct"],
    deciding_set_win_pct:["deciding_set_win_pct"], matches_last_28_days:["matches_last_28_days"],
  };
  const pick=(map:Map<string,SourcedStat>, code:string, name:string) => {
    const hay=`${code} ${name}`.toLowerCase().replace(/[^a-z0-9]+/g,"_");
    for (const [needle,keys] of Object.entries(aliases)) if (hay.includes(needle)) for (const k of keys) if (map.has(k)) return map.get(k)!;
    return null;
  };
  return requested.map((m)=>{
    const x=pick(amap,m.code,m.name), y=pick(bmap,m.code,m.name);
    const sources=[...(x?.sources??[]),...(y?.sources??[])].filter((s,i,arr)=>arr.findIndex((z)=>z.source_name===s.source_name&&z.url===s.url)===i);
    return { metric_code:m.code, p1_value:x?String(x.value):null, p2_value:y?String(y.value):null,
      p1_treatment:x?"DIRECT":"UNAVAILABLE", p2_treatment:y?"DIRECT":"UNAVAILABLE",
      differential:x&&y?String(x.value-y.value):null, evidence_family:"PUBLIC_HISTORICAL_DATA", reliability:x||y?85:null,
      sample:String(Math.max(x?.sample??0,y?.sample??0))||null,
      unavailable_reason:!x&&!y?"Not represented by the synced PredixSport fields":null, sources } as MetricFinding;
  });
}

function mergeMetrics(live: MetricFinding[], local: MetricFinding[]): MetricFinding[] {
  const localBy=new Map(local.map((m)=>[m.metric_code,m]));
  return live.map((m)=>{
    const l=localBy.get(m.metric_code); if (!l) return m;
    const p1Live=m.p1_treatment!=="UNAVAILABLE"&&m.p1_value!==null;
    const p2Live=m.p2_treatment!=="UNAVAILABLE"&&m.p2_value!==null;
    return {...m,
      p1_value:p1Live?m.p1_value:l.p1_value, p1_treatment:p1Live?m.p1_treatment:l.p1_treatment,
      p2_value:p2Live?m.p2_value:l.p2_value, p2_treatment:p2Live?m.p2_treatment:l.p2_treatment,
      sources:[...(m.sources??[]),...(l.sources??[])],
      unavailable_reason:(p1Live||l.p1_value||p2Live||l.p2_value)?null:m.unavailable_reason,
    };
  });
}

export const hybridResearcher: Researcher = {
  identity: (input)=>aiResearcher.identity(input),
  async dossier({player,opponent,context}) {
    const local=predixDatasetDossier(player,context);
    try { const live=await aiResearcher.dossier?.({player,opponent,context})??""; return [local,live].filter(Boolean).join("\n"); }
    catch(e) { if (!isProviderFailure(e)) throw e; return local; }
  },
  async extractStats({player,dossier,context}) {
    const local=statsFromPredixDatasetDossier(dossier,player);
    try {
      const live=await aiResearcher.extractStats?.({player,dossier,context})??[];
      const seen=new Set(live.map((s)=>`${s.key}|${s.surface??""}|${s.window??""}`));
      return [...live,...local.filter((s)=>!seen.has(`${s.key}|${s.surface??""}|${s.window??""}`))];
    } catch(e) { if (!isProviderFailure(e)) throw e; return local; }
  },
  async metrics(input) {
    const local=localMetricRows(input.p1,input.p2,input.context,input.metrics);
    try { return mergeMetrics(await aiResearcher.metrics(input),local); }
    catch(e) { if (!isProviderFailure(e)) throw e; return local; }
  },
  rules:(input)=>aiResearcher.rules(input),
  underdog:(input)=>aiResearcher.underdog(input),
  conclusion:(input)=>aiResearcher.conclusion(input),
  stress:(input)=>aiResearcher.stress(input),
};
