import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildMetricObservationContext } from "./source-observation-metric-bridge.server";
import { resolveCanonicalEvidencePair } from "./evidence-canonical-identity.server";
import { evidencePairMatches, safeEvidenceAliases } from "./evidence-player-alias";
import { policyForMetric } from "./metric-source-family-policy";
import { deterministicEnvironmentMetric } from "./deterministic-environment-metrics.server";
import { deterministicMarketMetric } from "./deterministic-market-metrics.server";
import { deterministicPbpMetric } from "./deterministic-pbp-metrics.server";
import { deterministicRankingMetric } from "./deterministic-ranking-metrics.server";
import { deterministicResultsScheduleMetric } from "./deterministic-results-schedule-metrics.server";
import { deterministicRulesContextMetric } from "./deterministic-rules-context-metric.server";
import { sampleVerifiedEvidenceIndexMatch } from "./evidence-index-match-sampler.server";
import { localMetricRows } from "./hybrid-audit-research.server";
import { enforceFiveMetricWiring } from "./completion-sweep-research.server";
import { certifyMetricFinding } from "./metric-certification";

const db = supabaseAdmin as any;
const USABLE = new Set(["DIRECT", "RECONSTRUCTED", "PARTIAL"]);
const DIAGNOSTIC_QUERY_CONCURRENCY = 6;

type FailureBucket = "SOURCE_MISSING"|"INGESTION_MISSING"|"IDENTITY_MATCH_FAILURE"|"EVIDENCE_QUERY_FAILURE"|"NORMALIZATION_FAILURE"|"EVIDENCE_WIRING_FAILURE"|"RECONSTRUCTION_FAILURE"|"COVERAGE_CREDIT_FAILURE"|"GENUINELY_UNAVAILABLE";
type Metric = { code:string; name:string; body:string|null };
type RepresentativeId = "ATP_MAIN"|"WTA_MAIN"|"ATP_CHALLENGER";
type MatchCandidate = { id:string; player1_name:string; player2_name:string; tournament_name:string|null; event_level:string|null; scheduled_date:string|null; surface:string|null; round:string|null; created_at:string; active_summary_version_id:string|null; parsed_tournament?:string|null; parsed_event_level?:string|null; parsed_tour?:string|null; parsed_date?:string|null; parsed_surface?:string|null; parsed_round?:string|null };
type ObservationCandidate = { source_id:string|null; source_name:string|null; player_name:string|null; opponent_name:string|null; tournament:string|null; event_date:string|null; surface:string|null; observation_type:string|null; sample_label:string|null };
type PersistedPairCandidate = { player_name:string|null; opponent_name:string|null; as_of_date:string|null };
type RepresentativeMatch = { id:RepresentativeId; match_id:string; p1:string; p2:string; date:string; date_source:"scheduled_date"|"parsed_summary"|"created_at"|"warehouse_event_date"|"persisted_as_of_date"|"verified_index_date"; tournament:string; context:string; event_level:string|null; surface:string|null; sampling_source:"matches"|"source_observations"|"matches_plus_rankings"|"metric_evidence_store"|"verified_pbp_index" };
type LocalResult = Awaited<ReturnType<typeof deterministic>>;

function classifyText(level:unknown,tournament:unknown,source:unknown=""):RepresentativeId|null {
  const combined=`${String(level??"")} ${String(tournament??"")} ${String(source??"")}`.toLowerCase();
  if (/wta\s*125|wta125|125k/.test(combined)) return null;
  if (/challenger/.test(combined)&&!/wta|women/.test(combined)) return "ATP_CHALLENGER";
  if (/wta|women/.test(combined)&&!/challenger/.test(combined)) return "WTA_MAIN";
  if (/atp|masters|grand slam|slam|250|500|1000/.test(combined)&&!/challenger/.test(combined)) return "ATP_MAIN";
  return null;
}
function classifyTour(row:MatchCandidate){return classifyText(row.event_level ?? row.parsed_event_level,row.tournament_name ?? row.parsed_tournament,row.parsed_tour);}

async function hydrateParsedHints(rows:MatchCandidate[]) {
  const ids=[...new Set(rows.map(r=>r.active_summary_version_id).filter((v):v is string=>Boolean(v)))];
  if(!ids.length)return rows;
  const {data,error}=await db.from("parsed_summary_fields").select("summary_version_id,field_key,normalized_value,raw_value").in("summary_version_id",ids);
  if(error)throw new Error(`representative parsed-field sampling: ${error.message}`);
  const byVersion=new Map<string,Map<string,string>>();
  for(const field of data??[]){const value=String(field.normalized_value??field.raw_value??"").trim();if(!value)continue;const map=byVersion.get(field.summary_version_id)??new Map<string,string>();map.set(String(field.field_key).toLowerCase(),value);byVersion.set(field.summary_version_id,map);}
  return rows.map(row=>{const map=row.active_summary_version_id?byVersion.get(row.active_summary_version_id):null;return {...row,parsed_tournament:map?.get("tournament")??null,parsed_event_level:map?.get("event_level")??map?.get("level")??null,parsed_tour:map?.get("tour")??map?.get("circuit")??null,parsed_date:map?.get("scheduled_date")??map?.get("date")??null,parsed_surface:map?.get("surface")??null,parsed_round:map?.get("round")??null};});
}

function toRepresentative(id:RepresentativeId,row:MatchCandidate,sampling_source:RepresentativeMatch["sampling_source"]="matches"):RepresentativeMatch {
  const tournament=row.tournament_name ?? row.parsed_tournament ?? `${id} production match`;
  const date=row.scheduled_date ?? row.parsed_date ?? row.created_at.slice(0, 10);
  const date_source=row.scheduled_date?"scheduled_date":row.parsed_date?"parsed_summary":"created_at";
  const surface=row.surface ?? row.parsed_surface ?? null;
  const level=row.event_level ?? row.parsed_event_level ?? id.replaceAll("_"," ");
  const context=[`Tournament: ${tournament}`,`Level: ${level}`,`Tour: ${row.parsed_tour??id.replaceAll("_"," ")}`,surface?`Surface: ${surface}`:null,`Date: ${date}`,(row.round??row.parsed_round)?`Round: ${row.round??row.parsed_round}`:null].filter(Boolean).join(" | ");
  return {id,match_id:row.id,p1:row.player1_name,p2:row.player2_name,date,date_source,tournament,context,event_level:row.event_level,surface,sampling_source};
}
function observationRepresentative(id:RepresentativeId,row:ObservationCandidate,index:number):RepresentativeMatch {
  const tournament=row.tournament??`${id} warehouse match`,date=row.event_date!,surface=row.surface??null,level=id.replaceAll("_"," ");
  return {id,match_id:`warehouse:${id}:${index}`,p1:row.player_name!,p2:row.opponent_name!,date,date_source:"warehouse_event_date",tournament,context:[`Tournament: ${tournament}`,`Level: ${level}`,`Tour: ${level}`,surface?`Surface: ${surface}`:null,`Date: ${date}`].filter(Boolean).join(" | "),event_level:level,surface,sampling_source:"source_observations"};
}
function persistedPairRepresentative(id:RepresentativeId,row:PersistedPairCandidate,index:number):RepresentativeMatch {
  const date=row.as_of_date!,level=id.replaceAll("_"," "),tournament=`${id} persisted evidence pair`;
  return {id,match_id:`metric-evidence:${id}:${index}`,p1:row.player_name!,p2:row.opponent_name!,date,date_source:"persisted_as_of_date",tournament,context:[`Evidence sample: persisted metric pair`,`Level: ${level}`,`Tour: ${level}`,`Date: ${date}`].join(" | "),event_level:level,surface:null,sampling_source:"metric_evidence_store"};
}

function rankingTour(source:unknown):"ATP_MAIN"|"WTA_MAIN"|null {
  const text=String(source??"").toLowerCase();
  if(text.includes("wta"))return "WTA_MAIN";
  if(text.includes("atp"))return "ATP_MAIN";
  return null;
}
async function classifyPairFromExactRankingEvidence(p1:string,p2:string):Promise<"ATP_MAIN"|"WTA_MAIN"|null> {
  const identities=await resolveCanonicalEvidencePair(p1,p2);
  if([identities.p1.status,identities.p2.status].some(status=>status==="AMBIGUOUS"||status==="QUERY_FAILED"||status==="UNRESOLVED"))return null;
  const names=[identities.p1.canonical,identities.p2.canonical];
  const {data,error}=await db.from("source_observations").select("player_name,source_name,source_id,observation_type").eq("observation_type","RANKING").in("player_name",names).limit(100);
  if(error)return null;
  const sideTour=(name:string)=>{const tours=[...new Set((data??[]).filter((r:any)=>r.player_name===name).map((r:any)=>rankingTour(`${r.source_id??""} ${r.source_name??""}`)).filter(Boolean))];return tours.length===1?tours[0]:null;};
  const p1Tour=sideTour(names[0]),p2Tour=sideTour(names[1]);
  return p1Tour&&p1Tour===p2Tour?p1Tour:null;
}
async function classifyFromExactRankingEvidence(row:MatchCandidate):Promise<"ATP_MAIN"|"WTA_MAIN"|null> {
  const tournament=String(row.tournament_name??row.parsed_tournament??"");
  if(/challenger|wta\s*125|wta125|125k/i.test(tournament))return null;
  return classifyPairFromExactRankingEvidence(row.player1_name,row.player2_name);
}

async function representativeMatches():Promise<{matches:RepresentativeMatch[];missing_classes:RepresentativeId[];missing_class_reasons:Partial<Record<RepresentativeId,string>>}> {
  const wanted:RepresentativeId[]=["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER"],selected:RepresentativeMatch[]=[];
  const primary=await db.from("matches").select("id,player1_name,player2_name,tournament_name,event_level,scheduled_date,surface,round,created_at,active_summary_version_id").not("player1_name","is",null).not("player2_name","is",null).order("created_at", { ascending: false }).limit(1500);
  let candidates:MatchCandidate[]=[];
  if(!primary.error){candidates=await hydrateParsedHints(((primary.data??[]) as MatchCandidate[]).filter(r=>r.player1_name&&r.player2_name));for(const id of wanted){const row=candidates.find(candidate=>classifyTour(candidate)===id);if(row)selected.push(toRepresentative(id,row));}}
  const missing=()=>wanted.filter(id=>!selected.some(m=>m.id===id));
  if(!primary.error&&missing().some(id=>id==="ATP_MAIN"||id==="WTA_MAIN")){
    for(const row of candidates){if(!missing().some(id=>id==="ATP_MAIN"||id==="WTA_MAIN"))break;if(classifyTour(row))continue;const inferred=await classifyFromExactRankingEvidence(row);if(inferred&&missing().includes(inferred))selected.push(toRepresentative(inferred,row,"matches_plus_rankings"));}
  }
  if(missing().length){
    const fallback=await db.from("source_observations").select("source_id,source_name,player_name,opponent_name,tournament,event_date,surface,observation_type,sample_label").not("player_name","is",null).not("opponent_name","is",null).not("event_date","is",null).order("event_date",{ascending:false}).limit(5000);
    if(fallback.error&&primary.error)throw new Error(`production sampling failed: matches=${primary.error.message}; source_observations=${fallback.error.message}`);
    if(!fallback.error){const rows=(fallback.data??[]) as ObservationCandidate[];for(const id of missing()){const row=rows.find(r=>r.player_name&&r.opponent_name&&r.event_date&&r.player_name!==r.opponent_name&&classifyText(r.sample_label,r.tournament,`${r.source_id} ${r.source_name}`)===id);if(row)selected.push(observationRepresentative(id,row,rows.indexOf(row)));}}
  }
  if(missing().some(id=>id==="ATP_MAIN"||id==="WTA_MAIN")){
    const persisted=await db.from("metric_evidence_store").select("player_name,opponent_name,as_of_date").not("player_name","is",null).not("opponent_name","is",null).not("as_of_date","is",null).order("as_of_date",{ascending:false}).limit(1000);
    if(!persisted.error){
      const seenPairs=new Set<string>();
      const rows=((persisted.data??[]) as PersistedPairCandidate[]).filter(row=>{const p1=String(row.player_name??"").trim(),p2=String(row.opponent_name??"").trim(),date=String(row.as_of_date??"").trim();if(!p1||!p2||!date||p1===p2)return false;const key=`${[p1,p2].sort().join("|")}|${date}`;if(seenPairs.has(key))return false;seenPairs.add(key);return true;});
      for(let index=0;index<rows.length&&missing().some(id=>id==="ATP_MAIN"||id==="WTA_MAIN");index++){const row=rows[index];const inferred=await classifyPairFromExactRankingEvidence(row.player_name!,row.opponent_name!);if(inferred&&missing().includes(inferred))selected.push(persistedPairRepresentative(inferred,row,index));}
    }
  }
  if(missing().length){
    for(const id of missing()){
      const row=await sampleVerifiedEvidenceIndexMatch(id);
      if(!row)continue;
      const level=id.replaceAll("_"," ");
      selected.push({id,match_id:row.match_id,p1:row.p1,p2:row.p2,date:row.date,date_source:"verified_index_date",tournament:row.tournament,context:[`Tournament: ${row.tournament}`,`Level: ${level}`,`Tour: ${level}`,row.surface?`Surface: ${row.surface}`:null,`Date: ${row.date}`].filter(Boolean).join(" | "),event_level:level,surface:row.surface,sampling_source:"verified_pbp_index"});
    }
  }
  const missingClasses=missing(),missing_class_reasons:Partial<Record<RepresentativeId,string>>={};
  for(const id of missingClasses)missing_class_reasons[id]=`No real persisted ${id} match, qualifying paired warehouse observation, or ranking-proven persisted metric-evidence pair was available for diagnostic sampling.`;
  return {matches:selected,missing_classes:missingClasses,missing_class_reasons};
}

function codeOf(value:unknown){const match=String(value??"").match(/(\d{1,3})$/);return match?match[1].padStart(3,"0"):String(value??"").padStart(3,"0");}
async function activeMetrics():Promise<Metric[]>{const {data:doc,error:docError}=await db.from("rule_documents").select("active_version_id").eq("doc_type","METRICS").maybeSingle();if(docError)throw new Error(`metric document lookup: ${docError.message}`);if(!doc?.active_version_id)throw new Error("No active METRICS rule document version");const {data,error}=await db.from("rules").select("rule_code,rule_name,body").eq("version_id",doc.active_version_id).order("rule_code");if(error)throw new Error(`metric rules lookup: ${error.message}`);return(data??[]).filter((r:any)=>Number(r.rule_code)>=1&&Number(r.rule_code)<=81).map((r:any)=>({code:String(r.rule_code),name:String(r.rule_name),body:r.body??null}));}
async function deterministic(metric:Metric,match:RepresentativeMatch){const runners=[()=>deterministicRankingMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date}),()=>deterministicRulesContextMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date,context:match.context}),()=>deterministicEnvironmentMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date,tournament:match.tournament}),()=>deterministicMarketMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date}),()=>deterministicPbpMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date}),()=>deterministicResultsScheduleMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date,tournament:match.tournament})];const errors:string[]=[];for(const runner of runners){try{const row=await runner();if(row)return{row,errors};}catch(error){errors.push(error instanceof Error?error.message:String(error));}}return{row:null,errors};}
async function deterministicBatch(metrics:Metric[],match:RepresentativeMatch){const out=new Map<string,LocalResult>();for(let i=0;i<metrics.length;i+=DIAGNOSTIC_QUERY_CONCURRENCY){const chunk=metrics.slice(i,i+DIAGNOSTIC_QUERY_CONCURRENCY);const rows=await Promise.all(chunk.map(async metric=>[codeOf(metric.code),await deterministic(metric,match)] as const));for(const [code,result] of rows)out.set(code,result);}return out;}

export async function runEvidenceCoverageRuntimeDiagnostic(){const metrics=await activeMetrics();if(metrics.length!==81)throw new Error(`Expected 81 active metrics, found ${metrics.length}`);const sample=await representativeMatches();if(!sample.matches.length)throw new Error("No real persisted matches, paired warehouse observations, ranking-proven persisted evidence pairs, or verified PBP index matches were available for evidence coverage sampling");const matches:any[]=[];
  for(const sampled of sample.matches){
    const identities=await resolveCanonicalEvidencePair(sampled.p1,sampled.p2);
    const match:RepresentativeMatch={...sampled,p1:identities.p1.canonical,p2:identities.p2.canonical};
    const aliases=[...new Set([...safeEvidenceAliases(match.p1,match.p2),...safeEvidenceAliases(match.p2,match.p1)])];
    const identityBackedByMatch=match.sampling_source==="matches"||match.sampling_source==="matches_plus_rankings";const identityPromise=identityBackedByMatch?db.from("matches").select("id,player1_name,player2_name,event_level,scheduled_date,surface").eq("id",match.match_id).limit(1):Promise.resolve({data:[],error:null});
    const [identityResult,storedResult,packetResult]=await Promise.allSettled([identityPromise,db.from("metric_evidence_store").select("metric_code,player_name,opponent_name,treatment,evidence_family").eq("as_of_date",match.date).in("metric_code",metrics.map(m=>codeOf(m.code))).in("player_name",aliases).in("opponent_name",aliases),buildMetricObservationContext({metrics,p1:match.p1,p2:match.p2,asOfDate:match.date})]);
    const identityError=identityResult.status==="rejected"?String(identityResult.reason):(identityResult.value as any).error?.message??null,identityRows=identityResult.status==="fulfilled"?(identityResult.value as any).data??[]:[],storedError=storedResult.status==="rejected"?String(storedResult.reason):(storedResult.value as any).error?.message??null,storedRows=storedResult.status==="fulfilled"?(storedResult.value as any).data??[]:[],packetError=packetResult.status==="rejected"?String(packetResult.reason):null,packet=packetResult.status==="fulfilled"?packetResult.value as Record<string,any>:{};
    const localByCode=await deterministicBatch(metrics,match);
    const certifiedLocalRows=localMetricRows(match.p1,match.p2,match.context,metrics).map((row,index)=>certifyMetricFinding(enforceFiveMetricWiring(metrics[index],row)));
    const certifiedLocalByCode=new Map(certifiedLocalRows.map(row=>[codeOf(row.metric_code),row]));
    const details:any[]=[];
    for(const metric of metrics){const code=codeOf(metric.code),policy=policyForMetric(code),entry=packet[code]??null,p1Stored=storedRows.find((r:any)=>codeOf(r.metric_code)===code&&evidencePairMatches(r.player_name,r.opponent_name,match.p1,match.p2))??null,p2Stored=storedRows.find((r:any)=>codeOf(r.metric_code)===code&&evidencePairMatches(r.player_name,r.opponent_name,match.p2,match.p1))??null,local=localByCode.get(code)??{row:null,errors:[]},internal=certifiedLocalByCode.get(code)??null;const p1Treatment=String(p1Stored?.treatment??local.row?.p1_treatment??internal?.p1_treatment??"UNAVAILABLE"),p2Treatment=String(p2Stored?.treatment??local.row?.p2_treatment??internal?.p2_treatment??"UNAVAILABLE"),p1Usable=USABLE.has(p1Treatment),p2Usable=USABLE.has(p2Treatment),pairUsable=p1Usable&&p2Usable,oneSidedUsable=p1Usable!==p2Usable;let bucket:FailureBucket|null=null,reason:string|null=null;if(!pairUsable){const queryErrors=[storedError,packetError,...local.errors].filter(Boolean) as string[];if(queryErrors.length){bucket="EVIDENCE_QUERY_FAILURE";reason=queryErrors.join(" | ");}else if(oneSidedUsable){bucket="COVERAGE_CREDIT_FAILURE";reason=`One-sided usable evidence cannot count as pair-complete coverage (P1=${p1Treatment}, P2=${p2Treatment}).`;}else if((entry?.observations?.length??0)>0&&policy.allowed_families.includes("RESULTS_SCHEDULE")&&!(entry.observations??[]).some((o:any)=>Boolean(o?.player))){bucket="INGESTION_MISSING";reason="Only shared tournament/schedule context is present; player-specific match evidence required by this metric has not been ingested.";}else if((entry?.observations?.length??0)>0&&entry?.direct_satisfaction_allowed){bucket="EVIDENCE_WIRING_FAILURE";reason="Sufficient admissible observations exist but did not become a usable deterministic/stored finding.";}else if((entry?.observations?.length??0)>0){bucket="RECONSTRUCTION_FAILURE";reason="Support-only admissible observations exist but no permitted deterministic reconstruction recovered the metric.";}else if(policy.allowed_families.length){bucket="INGESTION_MISSING";reason=`A structured path exists for ${policy.allowed_families.join(",")} but no admissible warehouse observation was ingested for this matchup/window.`;}else{bucket="SOURCE_MISSING";reason="No provider-independent structured source-family path is registered for this metric.";}}details.push({metric_code:code,metric_name:metric.name,source_expected:policy.allowed_families,warehouse_observation_count:Number(entry?.observations?.length??0),stored_p1:Boolean(p1Stored),stored_p2:Boolean(p2Stored),p1_treatment:p1Treatment,p2_treatment:p2Treatment,p1_credited:p1Usable,p2_credited:p2Usable,pair_credited:pairUsable,one_sided_usable:oneSidedUsable,deterministic_family:local.row?.evidence_family??internal?.evidence_family??null,local_internal_p1:Boolean(internal?.p1_value),local_internal_p2:Boolean(internal?.p2_value),failure_bucket:bucket,reason});}
    const buckets:Record<string,number>={};for(const row of details)if(row.failure_bucket)buckets[row.failure_bucket]=(buckets[row.failure_bucket]??0)+1;const p1Credited=details.filter(r=>r.p1_credited).length,p2Credited=details.filter(r=>r.p2_credited).length,pairCredited=details.filter(r=>r.pair_credited).length,oneSided=details.filter(r=>r.one_sided_usable).length,falseGreens=details.filter(r=>r.one_sided_usable&&r.pair_credited).length;matches.push({id:match.id,match_id:match.match_id,pair:`${match.p1} vs ${match.p2}`,tournament:match.tournament,scheduled_date:match.date,date_source:match.date_source,event_level:match.event_level,surface:match.surface,sampling_source:match.sampling_source,canonical_identity_resolution:identities,identity:{exact_match_count:identityRows.length,query_error:identityError,blocks_evidence_classification:false},query_errors:[storedError,packetError].filter(Boolean),coverage:{p1:p1Credited,p2:p2Credited,pair:pairCredited,one_sided:oneSided,p1_percent:Number((100*p1Credited/81).toFixed(2)),p2_percent:Number((100*p2Credited/81).toFixed(2)),pair_percent:Number((100*pairCredited/81).toFixed(2))},false_green_guard:{passed:falseGreens===0,false_green_metric_count:falseGreens,one_sided_metric_count:oneSided},failure_buckets:buckets,metrics:details});
  }
  return {schema_version:9,generated_at:new Date().toISOString(),metrics:metrics.length,sampling:{source:"REAL_PERSISTED_MATCHES_WITH_WAREHOUSE_PERSISTED_PAIR_VERIFIED_INDEX_AND_CERTIFIED_LOCAL_FALLBACK",requested_classes:["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER"],sampled_classes:matches.map(m=>m.id),missing_classes:sample.missing_classes,missing_class_reasons:sample.missing_class_reasons},matches};
}