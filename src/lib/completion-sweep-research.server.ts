import type { MetricFinding, Researcher } from "./audit-pipeline";
import { reconstruct, sanitizeEvidence, type SourcedStat } from "./reconstruction/engine";
import { resilientResearcher } from "./resilient-audit-research.server";
import { getStyleMatchupStats, getStyleProfileStats } from "./style-matchup.server";
import { getTennisDataHistoricalStats } from "./tennis-data-history.server";
import { getExtendedTennisDataStats } from "./tennis-data-extended.server";

function familyCode(code: string) {
  const m = String(code).match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(code).padStart(3, "0");
}
function summarize(stats: SourcedStat[]) { return stats.length ? stats.map((s) => `${s.key}=${Number(s.value).toFixed(2)}`).join("; ") : null; }
function usable(v: string | null, t: string) { return v !== null && t !== "UNAVAILABLE" && t !== "EXCLUDED"; }
function unresolved(m: MetricFinding | undefined) { return !m || !usable(m.p1_value,m.p1_treatment) || !usable(m.p2_value,m.p2_treatment); }
function dedupe(stats:SourcedStat[]){const m=new Map<string,SourcedStat>();for(const s of stats){const k=`${s.key}|${s.player.toLowerCase()}|${s.surface??""}|${s.window??""}`;const old=m.get(k);if(!old||old.origin==="RECONSTRUCTED"&&s.origin==="DIRECT")m.set(k,s);}return[...m.values()];}
function withDeterministicReconstruction(stats:SourcedStat[]){const direct=sanitizeEvidence(stats);const outcome=reconstruct(direct);return dedupe([...direct,...outcome.derived]);}

function localHistorical(player:string,context:string){
  try{return dedupe([...getTennisDataHistoricalStats(player,context),...getExtendedTennisDataStats(player,context)]);}catch{return [];}
}
function sourcesFor(stats:SourcedStat[]){return stats.flatMap(s=>s.sources??[]).filter((s,i,a)=>a.findIndex(x=>x.source_name===s.source_name&&x.url===s.url)===i);}
function selected(stats:SourcedStat[],keys:string[]){const wanted=new Set(keys);return stats.filter(s=>wanted.has(s.key));}

// Only statistics that semantically belong to the master family are mapped
// here. These historical subsets are PARTIAL because the broad master metric
// usually contains additional submetrics that this source cannot supply.
const HISTORICAL_KEYS:Record<string,string[]>={
  "001":["surface_win_pct","surface_matches"],
  "005":["win_pct","surface_win_pct","set_win_pct","matches_last_28_days","days_since_last_match"],
  "008":["set_win_pct","sets_played","sets_won","deciding_set_win_pct","deciding_sets_played","deciding_sets_won"],
  "009":["deciding_set_win_pct","deciding_sets_played","deciding_sets_won"],
  "010":["straight_set_win_pct","straight_set_wins","matches_won"],
  "011":["deciding_set_win_pct","straight_set_win_pct"],
  "012":["matches_last_28_days","days_since_last_match"],
  // 013 Availability is intentionally not reconstructed from ranking/form.
  // Layoff/injury evidence is handled by the dedicated availability source.
  "014":["ranking","peak_ranking","ranking_gap_to_peak"],
  "020":["same_level_matches","same_level_win_pct"],
  "027":["first_set_win_to_match_conversion_pct","one_set_up_collapse_rate_pct","deciding_set_closing_pct"],
  "028":["matches_last_28_days","days_since_last_match","same_round_matches","same_round_win_pct"],
  "030":["same_tournament_matches","same_tournament_win_pct"],
  "037":["straight_set_win_pct","deciding_set_win_pct","win_pct","surface_win_pct","recent_win_opponent_rank_mean"],
  "068":["current_streak_signed","longest_win_streak_observed"],
  "077":["season_matches_before_lock","matches_last_28_days","days_since_last_match","longest_observed_rest_gap_days"],
};
const PARTIAL_FAMILIES=new Set(Object.keys(HISTORICAL_KEYS));
const CONSERVATIVE_PARTIAL_FAMILIES=new Set(["035","055","068","080"]);

function historicalFinding(input:Parameters<Researcher["metrics"]>[0],metric:{code:string}):MetricFinding|null{
  const family=familyCode(metric.code),keys=HISTORICAL_KEYS[family];if(!keys)return null;
  const p1all=withDeterministicReconstruction(localHistorical(input.p1,input.context));
  const p2all=withDeterministicReconstruction(localHistorical(input.p2,input.context));
  let p1=selected(p1all,keys),p2=selected(p2all,keys);
  // Metric 027 is Opponent Finishing Ability. P1 describes P1's opponent (P2),
  // and P2 describes P2's opponent (P1).
  if(family==="027"){const own=p1;p1=p2;p2=own;}
  const p1Value=summarize(p1),p2Value=summarize(p2);
  if(!p1Value&&!p2Value)return null;
  const sources=sourcesFor([...p1,...p2]);
  return{
    metric_code:metric.code,
    p1_value:p1Value,
    p2_value:p2Value,
    p1_treatment:p1Value?"PARTIAL":"UNAVAILABLE",
    p2_treatment:p2Value?"PARTIAL":"UNAVAILABLE",
    differential:null,
    evidence_family:`TENNIS_DATA_HISTORY_${family}`,
    reliability:70,
    sample:String(Math.max(...[...p1,...p2].map(s=>s.sample??0),0))||null,
    unavailable_reason:!p1Value||!p2Value?"One player side lacked the sourced historical inputs required for this metric family.":null,
    missing_inputs:!p1Value||!p2Value?["sourced historical inputs for unsupported player side"]:undefined,
    sources,
  };
}

function prefer(a:MetricFinding|undefined,b:MetricFinding|null):MetricFinding|undefined{
  if(!b)return a;if(!a)return b;const p1=usable(a.p1_value,a.p1_treatment),p2=usable(a.p2_value,a.p2_treatment);
  return{...a,p1_value:p1?a.p1_value:b.p1_value,p1_treatment:p1?a.p1_treatment:b.p1_treatment,p2_value:p2?a.p2_value:b.p2_value,p2_treatment:p2?a.p2_treatment:b.p2_treatment,evidence_family:a.evidence_family??b.evidence_family,reliability:a.reliability??b.reliability,sample:a.sample??b.sample,unavailable_reason:(p1||p2||b.p1_value||b.p2_value)?null:(a.unavailable_reason??b.unavailable_reason),missing_inputs:(p1&&p2)?undefined:(a.missing_inputs??b.missing_inputs),sources:[...(a.sources??[]),...(b.sources??[])].filter((s,i,x)=>x.findIndex(z=>z.source_name===s.source_name&&z.url===s.url)===i)};
}
function conservativePartial(metric:{code:string},finding:MetricFinding):MetricFinding{
  const family=familyCode(metric.code);if(!CONSERVATIVE_PARTIAL_FAMILIES.has(family))return finding;
  return{...finding,p1_treatment:finding.p1_treatment==="RECONSTRUCTED"?"PARTIAL":finding.p1_treatment,p2_treatment:finding.p2_treatment==="RECONSTRUCTED"?"PARTIAL":finding.p2_treatment};
}

/** Completion sweep: provider evidence + local history + deterministic reconstruction + targeted retry. */
export const completionSweepResearcher:Researcher={
  ...resilientResearcher,
  async metrics(input){
    const base=await resilientResearcher.metrics(input),byCode=new Map(base.map(m=>[String(m.metric_code),m]));
    for(const metric of input.metrics){
      const key=String(metric.code);
      byCode.set(key,prefer(byCode.get(key),historicalFinding(input,metric))!);
      // Style evidence is intentionally not attached to unrelated metric codes.
    }
    const retry=input.metrics.filter(metric=>unresolved(byCode.get(String(metric.code))));
    for(const metric of retry){
      try{
        const result=await resilientResearcher.metrics({...input,metrics:[metric]});
        const candidate=result.find(r=>String(r.metric_code)===String(metric.code));
        if(candidate)byCode.set(String(metric.code),prefer(byCode.get(String(metric.code)),candidate)!);
      }catch{/* local historical/reconstructed evidence survives provider failure */}
    }
    return input.metrics.map(metric=>conservativePartial(metric,byCode.get(String(metric.code))??{metric_code:metric.code,p1_value:null,p2_value:null,p1_treatment:"UNAVAILABLE",p2_treatment:"UNAVAILABLE",differential:null,evidence_family:null,reliability:null,sample:null,unavailable_reason:"All configured direct and approved reconstruction paths were exhausted without sufficient sourced inputs.",missing_inputs:["no supported sourced inputs after completion sweep"],sources:[]}));
  },
  async extractStats(input){
    const base=await resilientResearcher.extractStats?.(input)??[];
    const historical=localHistorical(input.player,input.context);
    const reconstructed=withDeterministicReconstruction([...base,...historical]);
    const style=[...getStyleProfileStats(input.player,input.context),...getStyleMatchupStats(input.player,input.opponent,input.context)];
    return dedupe([...reconstructed,...style]);
  },
};
