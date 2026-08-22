import type { MetricFinding, Researcher } from "./audit-pipeline";
import type { SourcedStat } from "./reconstruction/engine";
import { resilientResearcher } from "./resilient-audit-research.server";
import { getStyleMatchupStats, getStyleProfileStats } from "./style-matchup.server";

function familyCode(code: string) {
  const m = String(code).match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(code).padStart(3, "0");
}
function summarize(stats: SourcedStat[]) { return stats.length ? stats.map((s) => `${s.key}=${Number(s.value).toFixed(2)}`).join("; ") : null; }
function usable(v: string | null, t: string) { return v !== null && t !== "UNAVAILABLE" && t !== "EXCLUDED"; }
function unresolved(m: MetricFinding | undefined) { return !m || !usable(m.p1_value,m.p1_treatment) || !usable(m.p2_value,m.p2_treatment); }

function styleFinding(input: Parameters<Researcher["metrics"]>[0], metric: { code: string }): MetricFinding | null {
  if (familyCode(metric.code) !== "018") return null;
  const p1=[...getStyleProfileStats(input.p1,input.context),...getStyleMatchupStats(input.p1,input.p2,input.context)];
  const p2=[...getStyleProfileStats(input.p2,input.context),...getStyleMatchupStats(input.p2,input.p1,input.context)];
  const p1Value=summarize(p1),p2Value=summarize(p2); if(!p1Value&&!p2Value)return null;
  const sources=[...p1,...p2].flatMap(s=>s.sources??[]).filter((s,i,a)=>a.findIndex(x=>x.source_name===s.source_name&&x.url===s.url)===i);
  return{metric_code:metric.code,p1_value:p1Value,p2_value:p2Value,p1_treatment:p1Value?"RECONSTRUCTED":"UNAVAILABLE",p2_treatment:p2Value?"RECONSTRUCTED":"UNAVAILABLE",differential:null,evidence_family:"STATISTICAL_STYLE_MATCHUP",reliability:70,sample:String(Math.max(...[...p1,...p2].map(s=>s.sample??0),0))||null,unavailable_reason:!p1Value||!p2Value?"Required serve/return or score-profile inputs were not present.":null,sources};
}

function prefer(a:MetricFinding|undefined,b:MetricFinding|null):MetricFinding|undefined{
  if(!b)return a;if(!a)return b;const p1=usable(a.p1_value,a.p1_treatment),p2=usable(a.p2_value,a.p2_treatment);
  return{...a,p1_value:p1?a.p1_value:b.p1_value,p1_treatment:p1?a.p1_treatment:b.p1_treatment,p2_value:p2?a.p2_value:b.p2_value,p2_treatment:p2?a.p2_treatment:b.p2_treatment,evidence_family:a.evidence_family??b.evidence_family,reliability:a.reliability??b.reliability,sample:a.sample??b.sample,unavailable_reason:(p1||p2||b.p1_value||b.p2_value)?null:(a.unavailable_reason??b.unavailable_reason),sources:[...(a.sources??[]),...(b.sources??[])].filter((s,i,x)=>x.findIndex(z=>z.source_name===s.source_name&&z.url===s.url)===i)};
}

/**
 * Completion sweep:
 * 1) run the normal hybrid/local pass;
 * 2) add deterministic style reconstruction;
 * 3) retry only still-unresolved metrics one-at-a-time. This isolates provider
 *    batch failures and lets a single bad/unsupported metric stop poisoning its
 *    neighbors while preserving UNAVAILABLE when no legitimate evidence exists.
 */
export const completionSweepResearcher:Researcher={
  ...resilientResearcher,
  async metrics(input){
    const base=await resilientResearcher.metrics(input),byCode=new Map(base.map(m=>[String(m.metric_code),m]));
    for(const metric of input.metrics){byCode.set(String(metric.code),prefer(byCode.get(String(metric.code)),styleFinding(input,metric))!);}
    const retry=input.metrics.filter(metric=>unresolved(byCode.get(String(metric.code))));
    // Keep retries bounded: this runs inside already-small pipeline batches.
    for(const metric of retry){
      try{
        const result=await resilientResearcher.metrics({...input,metrics:[metric]});
        const candidate=result.find(r=>String(r.metric_code)===String(metric.code));
        if(candidate)byCode.set(String(metric.code),prefer(byCode.get(String(metric.code)),candidate)!);
      }catch{/* truthful UNAVAILABLE survives below */}
    }
    return input.metrics.map(metric=>byCode.get(String(metric.code))??{metric_code:metric.code,p1_value:null,p2_value:null,p1_treatment:"UNAVAILABLE",p2_treatment:"UNAVAILABLE",differential:null,evidence_family:null,reliability:null,sample:null,unavailable_reason:"No direct or approved reconstructed evidence found after targeted second pass.",sources:[]});
  },
  async extractStats(input){
    const base=await resilientResearcher.extractStats?.(input)??[],local=[...getStyleProfileStats(input.player,input.context),...getStyleMatchupStats(input.player,input.opponent,input.context)];
    const seen=new Set(base.map(s=>`${s.key}|${s.surface??""}|${s.window??""}`));return[...base,...local.filter(s=>!seen.has(`${s.key}|${s.surface??""}|${s.window??""}`))];
  },
};
