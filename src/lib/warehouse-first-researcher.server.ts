import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { MetricFinding, Researcher } from "./audit-pipeline";
import { deterministicEnvironmentMetric } from "./deterministic-environment-metrics.server";
import { deterministicMarketMetric } from "./deterministic-market-metrics.server";
import { deterministicRankingMetric } from "./deterministic-ranking-metrics.server";
import { deterministicResultsScheduleMetric } from "./deterministic-results-schedule-metrics.server";
import { deterministicRulesContextMetric } from "./deterministic-rules-context-metric.server";
import { resolveCanonicalEvidencePair } from "./evidence-canonical-identity.server";
import { evidencePairMatches } from "./evidence-player-alias";
import { finalMetricWiringResearcher } from "./metric-wiring-078-081.server";
import { appendMetricObservationContext, buildMetricObservationContext } from "./source-observation-metric-bridge.server";
import { buildBsdAtpChallengerPbpContext } from "./bsd-atp-challenger-pbp.server";
import { buildBsdAtpMainPbpContext } from "./bsd-atp-main-pbp.server";
import { buildBsdWtaMainPbpContext } from "./bsd-wta-main-pbp.server";
import { buildBsdWtaChallengerPbpContext } from "./bsd-wta-challenger-pbp.server";

const db = supabaseAdmin as any;
const USABLE = new Set(["DIRECT", "RECONSTRUCTED", "PARTIAL"]);

type StoredEvidence = {
  metric_code:string;
  player_name:string;
  opponent_name:string|null;
  as_of_date:string;
  treatment:MetricFinding["p1_treatment"];
  value_text:string|null;
  reliability:number|null;
  sample_label:string|null;
  evidence_family:string|null;
  sources:MetricFinding["sources"]|null;
  unavailable_reason:string|null;
  valid_until:string|null;
  computed_at:string|null;
  updated_at:string|null;
};

function codeOf(value:unknown){const m=String(value??"").match(/(\d{1,3})$/);return m?m[1].padStart(3,"0"):String(value??"").padStart(3,"0");}
function asOfDate(context:string|null|undefined){const match=String(context??"").match(/\b(20\d{2}-\d{2}-\d{2})\b/);return match?.[1]??new Date().toISOString().slice(0,10);}
function tournamentFromContext(context:string|null|undefined){const match=String(context??"").match(/\btournament\s*:?[ ]*([^;·|\n]+)/i);return match?.[1]?.trim()||null;}
function ttlHours(code:string){if(["062","064","069","071","075","076","081"].includes(code))return 12;if(["012","028","077","079"].includes(code))return 24;if(["015","019"].includes(code))return 6;return 168;}
function fullyUsableFinding(row:MetricFinding|undefined){return Boolean(row&&USABLE.has(row.p1_treatment)&&USABLE.has(row.p2_treatment)&&row.p1_value&&row.p2_value);}
function rowTime(row:StoredEvidence){return Date.parse(row.updated_at??row.computed_at??`${row.as_of_date}T00:00:00Z`)||0;}

async function lookup(metricCodes:string[],player:string,opponent:string,date:string):Promise<Map<string,StoredEvidence>>{
  if(!metricCodes.length)return new Map<string,StoredEvidence>();

  // Do not pre-filter on display-name equality. The canonical identity resolver
  // has already searched stable player IDs first; persisted evidence can still
  // contain legacy aliases, surname-only names, normalized variants, or either
  // uploaded player order. Pull the bounded metric/date slice and apply the
  // fail-closed identity firewall in-process.
  const {data,error}=await db.from("metric_evidence_store")
    .select("metric_code,player_name,opponent_name,as_of_date,treatment,value_text,reliability,sample_label,evidence_family,sources,unavailable_reason,valid_until,computed_at,updated_at")
    .in("metric_code",metricCodes)
    .lte("as_of_date",date)
    .order("as_of_date",{ascending:false})
    .limit(5000);
  if(error)return new Map<string,StoredEvidence>();

  const byCode=new Map<string,StoredEvidence[]>();
  for(const row of (data??[]) as StoredEvidence[]){
    if(!evidencePairMatches(row.player_name,row.opponent_name,player,opponent))continue;
    const code=codeOf(row.metric_code);
    byCode.set(code,[...(byCode.get(code)??[]),row]);
  }

  const out=new Map<string,StoredEvidence>();
  for(const [code,rows] of byCode){
    const sorted=[...rows].sort((a,b)=>b.as_of_date.localeCompare(a.as_of_date)||rowTime(b)-rowTime(a));
    if(!sorted.length)continue;
    const newestDate=sorted[0].as_of_date;
    const newest=sorted.filter(row=>row.as_of_date===newestDate);
    if(newest.length===1){out.set(code,newest[0]);continue;}

    // Duplicate physical rows are safe only when they agree semantically. A
    // conflicting same-date context remains unresolved rather than borrowing
    // evidence from the wrong tournament/surface.
    const signatures=new Set(newest.map(row=>JSON.stringify([row.treatment,row.value_text,row.evidence_family])));
    if(signatures.size===1)out.set(code,newest.sort((a,b)=>rowTime(b)-rowTime(a))[0]);
  }
  return out;
}
function sourcesOf(row:StoredEvidence|undefined):MetricFinding["sources"]{return Array.isArray(row?.sources)?row!.sources!:[];}

async function saveSide(args:{code:string;name:string;player:string;opponent:string;date:string;treatment:MetricFinding["p1_treatment"];value:string|null;reliability:number|null;sample:string|null;family:string|null;sources:MetricFinding["sources"];unavailableReason:string|null;}){
  const {code,name,player,opponent,date,treatment,value,reliability,sample,family,sources,unavailableReason}=args;
  if(!USABLE.has(treatment)||!value)return;
  const validUntil=new Date(Date.now()+ttlHours(code)*3_600_000).toISOString();
  const sourceIds=(sources??[]).map(source=>source.source_name).filter(Boolean);
  await db.from("metric_evidence_store").delete().eq("metric_code",code).eq("player_name",player).eq("opponent_name",opponent).eq("as_of_date",date).is("tournament",null).is("surface",null);
  await db.from("metric_evidence_store").insert({metric_code:code,metric_name:name,player_name:player,opponent_name:opponent,as_of_date:date,treatment,value_text:value,reliability,sample_label:sample,evidence_family:family,source_ids:sourceIds,sources:sources??[],unavailable_reason:unavailableReason,valid_until:validUntil,updated_at:new Date().toISOString()});
}

function mergeObservationPackets(base:Record<string,unknown>, extra:Record<string,unknown>){
  const merged:Record<string,unknown>={...base};
  for(const [code,value] of Object.entries(extra)){
    const a=(merged[code]??{}) as Record<string,any>;
    const b=(value??{}) as Record<string,any>;
    const observations=[...(Array.isArray(a.observations)?a.observations:[]),...(Array.isArray(b.observations)?b.observations:[])];
    const observedFamilies=[...new Set([...(Array.isArray(a.observed_families)?a.observed_families:[]),...(Array.isArray(b.observed_families)?b.observed_families:[])])];
    merged[code]={...a,...b,observations,observed_families:observedFamilies,direct_satisfaction_allowed:Boolean(a.direct_satisfaction_allowed||b.direct_satisfaction_allowed)};
  }
  return merged;
}

export const warehouseFirstResearcher: Researcher = {
  ...finalMetricWiringResearcher,
  async metrics(input){
    const identities=await resolveCanonicalEvidencePair(input.p1,input.p2);
    input={...input,p1:identities.p1.canonical,p2:identities.p2.canonical};
    const {p1,p2,metrics}=input;
    const date=asOfDate(input.context);
    const tournament=tournamentFromContext(input.context);
    const codes=metrics.map(metric=>codeOf(metric.code));
    const [p1Stored,p2Stored]=await Promise.all([lookup(codes,p1,p2,date),lookup(codes,p2,p1,date)]);

    const missing=metrics.filter(metric=>{
      const code=codeOf(metric.code),a=p1Stored.get(code),b=p2Stored.get(code);
      return !a||!b||!USABLE.has(a.treatment)||!USABLE.has(b.treatment)||!a.value_text||!b.value_text;
    });

    const deterministicRows=(await Promise.all(missing.map(async metric=>{
      const ranking=await deterministicRankingMetric({metricCode:metric.code,p1,p2,asOfDate:date});if(ranking)return ranking;
      const rules=await deterministicRulesContextMetric({metricCode:metric.code,p1,p2,asOfDate:date,context:input.context});if(rules)return rules;
      const environment=await deterministicEnvironmentMetric({metricCode:metric.code,p1,p2,asOfDate:date,tournament});if(environment)return environment;
      const market=await deterministicMarketMetric({metricCode:metric.code,p1,p2,asOfDate:date});if(market)return market;
      return deterministicResultsScheduleMetric({metricCode:metric.code,p1,p2,asOfDate:date,tournament,context:input.context});
    }))).filter((row):row is MetricFinding=>Boolean(row));
    const deterministicByCode=new Map(deterministicRows.map(row=>[codeOf(row.metric_code),row]));
    const liveMissing=missing.filter(metric=>!fullyUsableFinding(deterministicByCode.get(codeOf(metric.code))));

    let liveRows:MetricFinding[]=[];
    if(liveMissing.length){
      const [warehousePacket,bsdAtpChallengerPbp,bsdAtpMainPbp,bsdWtaMainPbp,bsdWtaChallengerPbp]=await Promise.all([
        buildMetricObservationContext({metrics:liveMissing,p1,p2,asOfDate:date}),
        buildBsdAtpChallengerPbpContext({metrics:liveMissing,p1,p2,asOfDate:date,context:input.context}),
        buildBsdAtpMainPbpContext({metrics:liveMissing,p1,p2,asOfDate:date,context:input.context}),
        buildBsdWtaMainPbpContext({metrics:liveMissing,p1,p2,asOfDate:date,context:input.context}),
        buildBsdWtaChallengerPbpContext({metrics:liveMissing,p1,p2,asOfDate:date,context:input.context}),
      ]);
      let observationPacket=mergeObservationPackets(warehousePacket,bsdAtpChallengerPbp.packet);
      observationPacket=mergeObservationPackets(observationPacket,bsdAtpMainPbp.packet);
      observationPacket=mergeObservationPackets(observationPacket,bsdWtaMainPbp.packet);
      observationPacket=mergeObservationPackets(observationPacket,bsdWtaChallengerPbp.packet);
      for(const [code,row] of deterministicByCode){
        const existing=(observationPacket as Record<string,any>)[code]??{};
        (observationPacket as Record<string,any>)[code]={...existing,deterministic_components:{p1_value:row.p1_value,p2_value:row.p2_value,treatment:row.p1_treatment,evidence_family:row.evidence_family,sample:row.sample}};
      }
      const identityResolution={p1:identities.p1,p2:identities.p2};
      const context=appendMetricObservationContext(input.context,{...observationPacket,_canonical_identity_resolution:identityResolution,_bsd_atp_challenger_pbp_status:bsdAtpChallengerPbp.status,_bsd_atp_main_pbp_status:bsdAtpMainPbp.status,_bsd_wta_main_pbp_status:bsdWtaMainPbp.status,_bsd_wta_challenger_pbp_status:bsdWtaChallengerPbp.status});
      liveRows=await finalMetricWiringResearcher.metrics({...input,context,metrics:liveMissing});
    }
    const liveByCode=new Map(liveRows.map(row=>[codeOf(row.metric_code),row]));

    const output:MetricFinding[]=[];
    for(const metric of metrics){
      const code=codeOf(metric.code),a=p1Stored.get(code),b=p2Stored.get(code),live=liveByCode.get(code),deterministic=deterministicByCode.get(code);
      if(a&&b&&USABLE.has(a.treatment)&&USABLE.has(b.treatment)&&a.value_text&&b.value_text){
        const mergedSources=[...sourcesOf(a),...sourcesOf(b)].filter((source,index,rows)=>rows.findIndex(other=>other.source_name===source.source_name&&other.url===source.url)===index);
        output.push({metric_code:code,p1_value:a.value_text,p2_value:b.value_text,p1_treatment:a.treatment,p2_treatment:b.treatment,differential:null,evidence_family:a.evidence_family??b.evidence_family,reliability:Math.min(a.reliability??100,b.reliability??100),sample:[a.sample_label,b.sample_label].filter(Boolean).join(" | ")||null,unavailable_reason:null,sources:mergedSources});
        continue;
      }
      const chosen=live&&(USABLE.has(live.p1_treatment)||USABLE.has(live.p2_treatment))?live:deterministic??live;
      if(!chosen)continue;
      output.push(chosen);
      await Promise.all([
        saveSide({code,name:metric.name,player:p1,opponent:p2,date,treatment:chosen.p1_treatment,value:chosen.p1_value,reliability:chosen.reliability,sample:chosen.sample,family:chosen.evidence_family,sources:chosen.sources??[],unavailableReason:chosen.unavailable_reason}),
        saveSide({code,name:metric.name,player:p2,opponent:p1,date,treatment:chosen.p2_treatment,value:chosen.p2_value,reliability:chosen.reliability,sample:chosen.sample,family:chosen.evidence_family,sources:chosen.sources??[],unavailableReason:chosen.unavailable_reason}),
      ]);
    }
    return output;
  },
};
