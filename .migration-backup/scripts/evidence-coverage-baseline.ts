import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { parseRuleDocument } from "../src/lib/rule-parser";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { buildMetricObservationContext } from "../src/lib/source-observation-metric-bridge.server";
import { resolveCanonicalEvidencePair } from "../src/lib/evidence-canonical-identity.server";
import { evidencePairMatches, safeEvidenceAliases } from "../src/lib/evidence-player-alias";
import { policyForMetric } from "../src/lib/metric-source-family-policy";
import { deterministicEnvironmentMetric } from "../src/lib/deterministic-environment-metrics.server";
import { deterministicMarketMetric } from "../src/lib/deterministic-market-metrics.server";
import { deterministicRankingMetric } from "../src/lib/deterministic-ranking-metrics.server";
import { deterministicResultsScheduleMetric } from "../src/lib/deterministic-results-schedule-metrics.server";
import { deterministicRulesContextMetric } from "../src/lib/deterministic-rules-context-metric.server";

for (const key of ["LOVABLE_API_KEY","RESEARCH_FALLBACK_API_KEY","OPENAI_API_KEY","RESEARCH_FALLBACK_URL","OPENAI_BASE_URL"]) delete process.env[key];

type FailureBucket =
  | "SOURCE_MISSING"
  | "INGESTION_MISSING"
  | "IDENTITY_MATCH_FAILURE"
  | "EVIDENCE_QUERY_FAILURE"
  | "NORMALIZATION_FAILURE"
  | "EVIDENCE_WIRING_FAILURE"
  | "RECONSTRUCTION_FAILURE"
  | "COVERAGE_CREDIT_FAILURE"
  | "GENUINELY_UNAVAILABLE";

type SideStatus = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE" | "EXCLUDED";
type Metric = { code:string; name:string; body?:string|null };

const USABLE = new Set(["DIRECT", "RECONSTRUCTED", "PARTIAL"]);
const db = supabaseAdmin as any;

function codeOf(v: unknown) {
  const m = String(v ?? "").match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(v ?? "").padStart(3, "0");
}
function availability(treatment: string | null | undefined): SideStatus {
  if (treatment === "PARTIAL") return "PARTIAL";
  if (treatment === "EXCLUDED") return "EXCLUDED";
  return USABLE.has(String(treatment)) ? "AVAILABLE" : "UNAVAILABLE";
}
function dateFromContext(context:string){return context.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0] ?? new Date().toISOString().slice(0,10);}
function tournamentFromContext(context:string){return context.match(/Tournament:\s*([^|]+)/i)?.[1]?.trim() ?? null;}

async function safe<T>(fn:()=>Promise<T>):Promise<{value:T|null;error:string|null}>{
  try{return{value:await fn(),error:null};}catch(error){return{value:null,error:error instanceof Error?error.message:String(error)};}
}

async function deterministic(metric:Metric,p1:string,p2:string,asOfDate:string,context:string):Promise<{row:any|null;errors:string[]} >{
  const errors:string[]=[];
  const runners=[
    ()=>deterministicRankingMetric({metricCode:metric.code,p1,p2,asOfDate}),
    ()=>deterministicRulesContextMetric({metricCode:metric.code,p1,p2,asOfDate,context}),
    ()=>deterministicEnvironmentMetric({metricCode:metric.code,p1,p2,asOfDate,tournament:tournamentFromContext(context)}),
    ()=>deterministicMarketMetric({metricCode:metric.code,p1,p2,asOfDate}),
    ()=>deterministicResultsScheduleMetric({metricCode:metric.code,p1,p2,asOfDate,tournament:tournamentFromContext(context)}),
  ];
  for(const runner of runners){const result=await safe(runner);if(result.error)errors.push(result.error);if(result.value)return{row:result.value,errors};}
  return{row:null,errors};
}

async function exactPairIdentity(p1:string,p2:string){
  return safe(async()=>{
    const {data,error}=await db.from("matches").select("id,player1_name,player2_name,tournament_name,event_level,scheduled_date,surface").or(`and(player1_name.eq.${p1},player2_name.eq.${p2}),and(player1_name.eq.${p2},player2_name.eq.${p1})`).limit(5);
    if(error)throw new Error(error.message);
    return data??[];
  });
}

async function storedEvidence(codes:string[],p1:string,p2:string,asOfDate:string){
  const aliases=[...new Set([...safeEvidenceAliases(p1,p2),...safeEvidenceAliases(p2,p1)])];
  return safe(async()=>{
    const {data,error}=await db.from("metric_evidence_store").select("metric_code,player_name,opponent_name,treatment,value_text,reliability,sample_label,evidence_family,sources,unavailable_reason").in("metric_code",codes).eq("as_of_date",asOfDate).in("player_name",aliases).in("opponent_name",aliases);
    if(error)throw new Error(error.message);
    return data??[];
  });
}

function storeFor(rows:any[],code:string,player:string,opponent:string){
  const matches=rows.filter(r=>codeOf(r.metric_code)===code&&evidencePairMatches(r.player_name,r.opponent_name,player,opponent));
  return matches.length===1?matches[0]:null;
}
function packetSources(entry:any){return (entry?.observations??[]).map((o:any)=>({name:o.source??null,url:o.url??null,family:o.family??null,player:o.player??null,opponent:o.opponent??null,sample:o.sample??null}));}

const parsed = parseRuleDocument(readFileSync("public/seed/metrics.txt", "utf8"));
const metrics:Metric[] = parsed.rules.filter((r) => Number(r.rule_code) >= 1 && Number(r.rule_code) <= 81).map((r) => ({ code:r.rule_code, name:r.rule_name, body:r.body }));
if (metrics.length !== 81) throw new Error(`Expected 81 metrics, parsed ${metrics.length}`);

const matches = [
  { id:"ATP_MAIN_BASELINE", tour:"ATP_MAIN", p1:"Arthur Fils", p2:"Flavio Cobolli", context:"Tournament: Cincinnati Open | Level: ATP Masters 1000 | Tour: ATP Main | Surface: hard | Date: 2026-08-22" },
  { id:"WTA_MAIN_BASELINE", tour:"WTA_MAIN", p1:"Iga Swiatek", p2:"Jessica Pegula", context:"Tournament: Cincinnati Open | Level: WTA 1000 | Tour: WTA Main | Surface: hard | Date: 2026-08-22" },
  { id:"ATP_CHALLENGER_BASELINE", tour:"ATP_CHALLENGER", p1:"Emilio Nava", p2:"Patrick Kypson", context:"Tournament: ATP Challenger representative | Level: ATP Challenger | Tour: ATP Challenger | Surface: hard | Date: 2026-08-22" },
] as const;

const report:any = {
  schema_version:3,
  generated_at:new Date().toISOString(),
  mode:"provider_independent_pre_production_change_baseline",
  invariant:"No live/LLM researcher is invoked and no production evidence logic is mutated by this diagnostic.",
  metrics_parsed:metrics.length,
  matches:[],
};

for (const requested of matches) {
  const identities=await resolveCanonicalEvidencePair(requested.p1,requested.p2);
  const match={...requested,p1:identities.p1.canonical,p2:identities.p2.canonical};
  const asOfDate=dateFromContext(match.context);
  // App-row identity is retained as diagnostic metadata only. It is not a
  // warehouse-evidence prerequisite and cannot zero out 81 evidence metrics.
  const identity=await exactPairIdentity(match.p1,match.p2);
  const observation=await safe(()=>buildMetricObservationContext({metrics,p1:match.p1,p2:match.p2,asOfDate}));
  const packet=(observation.value??{}) as Record<string,any>;
  const stored=await storedEvidence(metrics.map(m=>codeOf(m.code)),match.p1,match.p2,asOfDate);
  const storeRows=stored.value??[];
  const detail:any[]=[];

  for(const metric of metrics){
    const code=codeOf(metric.code), policy=policyForMetric(code), entry=packet[code]??null;
    const p1Stored=storeFor(storeRows,code,match.p1,match.p2), p2Stored=storeFor(storeRows,code,match.p2,match.p1);
    const local=await deterministic(metric,match.p1,match.p2,asOfDate,match.context);
    const row=local.row;
    const p1Treatment=String(p1Stored?.treatment??row?.p1_treatment??"UNAVAILABLE");
    const p2Treatment=String(p2Stored?.treatment??row?.p2_treatment??"UNAVAILABLE");
    const p1Value=p1Stored?.value_text??row?.p1_value??null, p2Value=p2Stored?.value_text??row?.p2_value??null;
    const foundSources=[...packetSources(entry),...((row?.sources??[]).map((s:any)=>({name:s.source_name,url:s.url??null,family:row?.evidence_family??null,player:null,opponent:null,sample:row?.sample??null})))];
    const p1Usable=USABLE.has(p1Treatment), p2Usable=USABLE.has(p2Treatment), pairUsable=p1Usable&&p2Usable, oneSided=p1Usable!==p2Usable;
    let bucket:FailureBucket|null=null, reason:string|null=null;
    if(!pairUsable){
      if(stored.error||observation.error||local.errors.length){bucket="EVIDENCE_QUERY_FAILURE";reason=[stored.error,observation.error,...local.errors].filter(Boolean).join(" | ");}
      else if(oneSided){bucket="COVERAGE_CREDIT_FAILURE";reason=`One-sided usable evidence cannot count as pair-complete coverage (P1=${p1Treatment}, P2=${p2Treatment}).`;}
      else if(entry?.observations?.length&&entry.direct_satisfaction_allowed){bucket="EVIDENCE_WIRING_FAILURE";reason="Admissible sufficient warehouse observations exist, but no provider-independent metric finding was produced.";}
      else if(entry?.observations?.length){bucket="RECONSTRUCTION_FAILURE";reason="Admissible support-only observations exist, but no permitted deterministic reconstruction produced a usable finding.";}
      else if(policy.allowed_families.length){bucket="INGESTION_MISSING";reason=`A registered path exists for ${policy.allowed_families.join(", ")}, but no admissible warehouse observation was ingested for this matchup/window.`;}
      else {bucket="EVIDENCE_WIRING_FAILURE";reason="No provider-independent warehouse source-family path is registered for this metric and no stored/deterministic finding was recovered.";}
    }
    detail.push({
      metric:{code,name:metric.name},requested_evidence:metric.body??null,
      source_expected:policy.allowed_families,source_actually_found:foundSources,
      database_evidence_found:{metric_store_p1:Boolean(p1Stored),metric_store_p2:Boolean(p2Stored),warehouse_observations:Number(entry?.observations?.length??0),query_error:stored.error??observation.error},
      player_identity_status:identity.error?"QUERY_FAILED":identity.value?.length?"EXACT_PAIR_FOUND":"EXACT_PAIR_NOT_FOUND",
      match_identity_status:identity.error?"QUERY_FAILED":identity.value?.length===1?"UNIQUE_MATCH":(identity.value?.length??0)>1?"MULTIPLE_HISTORICAL_PAIR_MATCHES":"NO_MATCH",
      identity_blocks_evidence_classification:false,
      resolver_result:{mode:"STORED_OR_DETERMINISTIC_ONLY",p1_value:p1Value,p2_value:p2Value,p1_treatment:p1Treatment,p2_treatment:p2Treatment,evidence_family:p1Stored?.evidence_family??p2Stored?.evidence_family??row?.evidence_family??null,sample:p1Stored?.sample_label??p2Stored?.sample_label??row?.sample??null},
      reconstruction_result:p1Treatment==="RECONSTRUCTED"||p2Treatment==="RECONSTRUCTED"?"RECOVERED":entry?.observations?.length&&!entry.direct_satisfaction_allowed?"NOT_RECOVERED_FROM_SUPPORT_ONLY_EVIDENCE":"NOT_REQUIRED_OR_NO_INPUTS",
      audit_availability_status:{p1:availability(p1Treatment),p2:availability(p2Treatment)},
      coverage_credit:{p1:p1Usable,p2:p2Usable,pair:pairUsable,one_sided:oneSided,partial_preserved:p1Treatment==="PARTIAL"||p2Treatment==="PARTIAL"},
      failure_bucket:bucket,reason,missing_inputs:row?.missing_inputs??[],
    });
  }

  const p1Credit=detail.filter(d=>d.coverage_credit.p1).length,p2Credit=detail.filter(d=>d.coverage_credit.p2).length,pairCredit=detail.filter(d=>d.coverage_credit.pair).length;
  const buckets:Record<string,number>={};for(const d of detail)if(d.failure_bucket)buckets[d.failure_bucket]=(buckets[d.failure_bucket]??0)+1;
  report.matches.push({...match,uploaded_pair:`${requested.p1} vs ${requested.p2}`,canonical_identity_resolution:identities,database_probe_errors:[stored.error,observation.error].filter(Boolean),app_identity_probe_error:identity.error,identity_matches:identity.value??[],coverage:{p1_credited:p1Credit,p2_credited:p2Credit,pair_credited:pairCredit,p1_percent:Number((100*p1Credit/81).toFixed(2)),p2_percent:Number((100*p2Credit/81).toFixed(2)),pair_percent:Number((100*pairCredit/81).toFixed(2))},failure_buckets:buckets,metrics:detail});
}

mkdirSync("data/audit",{recursive:true});
writeFileSync("data/audit/evidence-coverage-baseline.json",`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report.matches.map((m:any)=>({id:m.id,database_probe_errors:m.database_probe_errors,identity_match_count:m.identity_matches.length,coverage:m.coverage,failure_buckets:m.failure_buckets})),null,2));
