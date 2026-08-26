import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildMetricObservationContext } from "./source-observation-metric-bridge.server";
import { resolveCanonicalEvidencePair } from "./evidence-canonical-identity.server";
import { evidencePairMatches, safeEvidenceAliases } from "./evidence-player-alias";
import { policyForMetric } from "./metric-source-family-policy";
import { deterministicEnvironmentMetric } from "./deterministic-environment-metrics.server";
import { deterministicMarketMetric } from "./deterministic-market-metrics.server";
import { deterministicRankingMetric } from "./deterministic-ranking-metrics.server";
import { deterministicResultsScheduleMetric } from "./deterministic-results-schedule-metrics.server";
import { deterministicRulesContextMetric } from "./deterministic-rules-context-metric.server";

const db = supabaseAdmin as any;
const USABLE = new Set(["DIRECT", "RECONSTRUCTED", "PARTIAL"]);
const DIAGNOSTIC_QUERY_CONCURRENCY = 6;

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

type Metric = { code: string; name: string; body: string | null };
type RepresentativeId = "ATP_MAIN" | "WTA_MAIN" | "ATP_CHALLENGER" | "WTA_CHALLENGER";
type SamplingSource = "matches" | "source_observations";
type MatchCandidate = {
  id: string;
  player1_name: string;
  player2_name: string;
  tournament_id: string | null;
  tournament_name: string | null;
  event_level: string | null;
  scheduled_date: string | null;
  surface: string | null;
  round: string | null;
  created_at: string;
  active_summary_version_id: string | null;
  parsed_tournament?: string | null;
  parsed_event_level?: string | null;
  parsed_tour?: string | null;
  parsed_date?: string | null;
  parsed_surface?: string | null;
  parsed_round?: string | null;
  registry_tournament?: string | null;
  registry_event_level?: string | null;
  registry_surface?: string | null;
};
type ObservationCandidate = {
  source_id: string | null;
  source_name: string | null;
  player_name: string | null;
  opponent_name: string | null;
  tournament: string | null;
  event_date: string | null;
  surface: string | null;
  observation_type: string | null;
  sample_label: string | null;
  retrieved_at: string | null;
};
type RepresentativeMatch = {
  id: RepresentativeId;
  match_id: string;
  p1: string;
  p2: string;
  date: string;
  date_source: "scheduled_date" | "parsed_summary" | "created_at" | "warehouse_event_date" | "warehouse_retrieved_at";
  tournament: string;
  context: string;
  event_level: string | null;
  surface: string | null;
  sampling_source: SamplingSource;
};
type LocalResult = Awaited<ReturnType<typeof deterministic>>;

function classifyText(...values: unknown[]): RepresentativeId | null {
  const combined = values.map((value) => String(value ?? "")).join(" ").toLowerCase();
  if (/wta\s*125|wta125|125k|wta[_\s-]*challenger/.test(combined)) return "WTA_CHALLENGER";
  if (/challenger/.test(combined) && /wta|women/.test(combined)) return "WTA_CHALLENGER";
  if (/challenger/.test(combined) && !/wta|women/.test(combined)) return "ATP_CHALLENGER";
  if (/wta|women/.test(combined) && !/challenger/.test(combined)) return "WTA_MAIN";
  if (/atp|masters|grand slam|slam|250|500|1000/.test(combined) && !/challenger/.test(combined)) return "ATP_MAIN";
  return null;
}

function classifyTour(row: MatchCandidate): RepresentativeId | null {
  return classifyText(row.event_level,row.parsed_event_level,row.parsed_tour,row.tournament_name,row.parsed_tournament,row.registry_event_level,row.registry_tournament);
}

async function hydrateParsedHints(rows: MatchCandidate[]) {
  const ids = [...new Set(rows.map((row) => row.active_summary_version_id).filter((v): v is string => Boolean(v)))];
  if (!ids.length) return rows;
  const { data, error } = await db.from("parsed_summary_fields").select("summary_version_id,field_key,normalized_value,raw_value").in("summary_version_id", ids);
  if (error) throw new Error(`representative parsed-field sampling: ${error.message}`);
  const byVersion = new Map<string, Map<string, string>>();
  for (const field of data ?? []) {
    const value = String(field.normalized_value ?? field.raw_value ?? "").trim();
    if (!value) continue;
    const map = byVersion.get(field.summary_version_id) ?? new Map<string, string>();
    map.set(String(field.field_key).toLowerCase(), value);
    byVersion.set(field.summary_version_id, map);
  }
  return rows.map((row) => {
    const map = row.active_summary_version_id ? byVersion.get(row.active_summary_version_id) : null;
    return {...row,parsed_tournament:map?.get("tournament")??null,parsed_event_level:map?.get("event_level")??map?.get("level")??null,parsed_tour:map?.get("tour")??map?.get("circuit")??null,parsed_date:map?.get("scheduled_date")??map?.get("date")??null,parsed_surface:map?.get("surface")??null,parsed_round:map?.get("round")??null};
  });
}

async function hydrateTournamentHints(rows: MatchCandidate[]) {
  const ids = [...new Set(rows.map((row) => row.tournament_id).filter((v): v is string => Boolean(v)))];
  if (!ids.length) return rows;
  const { data, error } = await db.from("tournaments").select("id,name,event_level,surface").in("id", ids);
  if (error) throw new Error(`representative tournament-registry sampling: ${error.message}`);
  const byId = new Map((data ?? []).map((row: any) => [row.id, row]));
  return rows.map((row) => {const tournament=row.tournament_id?byId.get(row.tournament_id):null;return {...row,registry_tournament:tournament?.name??null,registry_event_level:tournament?.event_level??null,registry_surface:tournament?.surface??null};});
}

function toRepresentative(id: RepresentativeId, row: MatchCandidate): RepresentativeMatch {
  const tournament = row.tournament_name ?? row.parsed_tournament ?? row.registry_tournament ?? `${id} production match`;
  const date = row.scheduled_date ?? row.parsed_date ?? row.created_at.slice(0, 10);
  const date_source = row.scheduled_date ? "scheduled_date" : row.parsed_date ? "parsed_summary" : "created_at";
  const surface = row.surface ?? row.parsed_surface ?? row.registry_surface ?? null;
  const level = row.event_level ?? row.parsed_event_level ?? row.registry_event_level ?? id.replaceAll("_", " ");
  const context = [`Tournament: ${tournament}`,`Level: ${level}`,`Tour: ${row.parsed_tour ?? id.replaceAll("_", " ")}`,surface?`Surface: ${surface}`:null,`Date: ${date}`,(row.round??row.parsed_round)?`Round: ${row.round??row.parsed_round}`:null].filter(Boolean).join(" | ");
  return { id, match_id: row.id, p1: row.player1_name, p2: row.player2_name, date, date_source, tournament, context, event_level: level, surface, sampling_source: "matches" };
}

function observationRepresentative(id: RepresentativeId, row: ObservationCandidate, index: number): RepresentativeMatch | null {
  const fallbackDate = row.retrieved_at?.slice(0,10) ?? null;
  const date = row.event_date ?? fallbackDate;
  if (!date || !row.player_name || !row.opponent_name) return null;
  const tournament=row.tournament??`${id} warehouse match`,surface=row.surface??null,level=id.replaceAll("_"," ");
  return {id,match_id:`warehouse:${id}:${index}`,p1:row.player_name,p2:row.opponent_name,date,date_source:row.event_date?"warehouse_event_date":"warehouse_retrieved_at",tournament,context:[`Tournament: ${tournament}`,`Level: ${level}`,`Tour: ${level}`,surface?`Surface: ${surface}`:null,`Date: ${date}`].filter(Boolean).join(" | "),event_level:level,surface,sampling_source:"source_observations"};
}

async function representativeMatches(): Promise<{ matches: RepresentativeMatch[]; missing_classes: RepresentativeId[]; sampling_errors: string[] }> {
  const wanted: RepresentativeId[]=["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"],selected:RepresentativeMatch[]=[],samplingErrors:string[]=[];
  const primary=await db.from("matches").select("id,player1_name,player2_name,tournament_id,tournament_name,event_level,scheduled_date,surface,round,created_at,active_summary_version_id").not("player1_name","is",null).not("player2_name","is",null).order("created_at",{ascending:false}).limit(2000);
  if(primary.error)samplingErrors.push(`matches=${primary.error.message}`);
  if(!primary.error){let candidates=((primary.data??[]) as MatchCandidate[]).filter((row)=>row.player1_name&&row.player2_name);candidates=await hydrateParsedHints(candidates);candidates=await hydrateTournamentHints(candidates);for(const id of wanted){const row=candidates.find((candidate)=>classifyTour(candidate)===id);if(row)selected.push(toRepresentative(id,row));}}
  const missing=()=>wanted.filter((id)=>!selected.some((match)=>match.id===id));
  if(missing().length){const fallback=await db.from("source_observations").select("source_id,source_name,player_name,opponent_name,tournament,event_date,surface,observation_type,sample_label,retrieved_at").not("player_name","is",null).not("opponent_name","is",null).order("retrieved_at",{ascending:false}).limit(5000);if(fallback.error)samplingErrors.push(`source_observations=${fallback.error.message}`);if(!fallback.error){const rows=(fallback.data??[]) as ObservationCandidate[];for(const id of missing()){const index=rows.findIndex((candidate)=>candidate.player_name&&candidate.opponent_name&&candidate.player_name!==candidate.opponent_name&&(candidate.event_date||candidate.retrieved_at)&&classifyText(candidate.sample_label,candidate.tournament,candidate.source_id,candidate.source_name)===id);if(index>=0){const representative=observationRepresentative(id,rows[index],index);if(representative)selected.push(representative);}}}}
  if(!selected.length&&samplingErrors.length)throw new Error(`production sampling failed: ${samplingErrors.join("; ")}`);
  return {matches:selected,missing_classes:missing(),sampling_errors:samplingErrors};
}

function codeOf(value: unknown){const match=String(value??"").match(/(\d{1,3})$/);return match?match[1].padStart(3,"0"):String(value??"").padStart(3,"0");}
async function activeMetrics():Promise<Metric[]>{const{data:doc,error:docError}=await db.from("rule_documents").select("active_version_id").eq("doc_type","METRICS").maybeSingle();if(docError)throw new Error(`metric document lookup: ${docError.message}`);if(!doc?.active_version_id)throw new Error("No active METRICS rule document version");const{data,error}=await db.from("rules").select("rule_code,rule_name,body").eq("version_id",doc.active_version_id).order("rule_code");if(error)throw new Error(`metric rules lookup: ${error.message}`);return(data??[]).filter((row:any)=>Number(row.rule_code)>=1&&Number(row.rule_code)<=81).map((row:any)=>({code:String(row.rule_code),name:String(row.rule_name),body:row.body??null}));}
async function deterministic(metric:Metric,match:RepresentativeMatch){const runners=[()=>deterministicRankingMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date}),()=>deterministicRulesContextMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date,context:match.context}),()=>deterministicEnvironmentMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date,tournament:match.tournament}),()=>deterministicMarketMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date}),()=>deterministicResultsScheduleMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date,tournament:match.tournament})];const errors:string[]=[];for(const runner of runners){try{const row=await runner();if(row)return{row,errors};}catch(error){errors.push(error instanceof Error?error.message:String(error));}}return{row:null,errors};}
async function deterministicBatch(metrics:Metric[],match:RepresentativeMatch){const out=new Map<string,LocalResult>();for(let i=0;i<metrics.length;i+=DIAGNOSTIC_QUERY_CONCURRENCY){const chunk=metrics.slice(i,i+DIAGNOSTIC_QUERY_CONCURRENCY);const rows=await Promise.all(chunk.map(async(metric)=>[codeOf(metric.code),await deterministic(metric,match)] as const));for(const[code,result]of rows)out.set(code,result);}return out;}
function isGenuineUnavailableReason(value:unknown){const text=String(value??"").trim().toLowerCase();if(!text||/provider|timeout|rate.?limit|network|query|error|failed|gateway|credit/.test(text))return false;return/not (?:available|published|reported|tracked)|no (?:data|record|history|market)|genuinely unavailable|source does not provide/.test(text);}

export async function runEvidenceCoverageRuntimeDiagnostic(){
 const metrics=await activeMetrics();if(metrics.length!==81)throw new Error(`Expected 81 active metrics, found ${metrics.length}`);const sample=await representativeMatches();if(!sample.matches.length)throw new Error("No real persisted matches or paired warehouse observations were available for evidence coverage sampling");const matches:any[]=[];
 for(const sampled of sample.matches){
  const identities=await resolveCanonicalEvidencePair(sampled.p1,sampled.p2);const match:RepresentativeMatch={...sampled,p1:identities.p1.canonical,p2:identities.p2.canonical};const aliases=[...new Set([...safeEvidenceAliases(match.p1,match.p2),...safeEvidenceAliases(match.p2,match.p1)])];const identityPromise=match.sampling_source==="matches"?db.from("matches").select("id,player1_name,player2_name,event_level,scheduled_date,surface").eq("id",match.match_id).limit(1):Promise.resolve({data:[],error:null});
  const[identityResult,storedResult,packetResult]=await Promise.allSettled([identityPromise,db.from("metric_evidence_store").select("metric_code,player_name,opponent_name,treatment,evidence_family,unavailable_reason").eq("as_of_date",match.date).in("metric_code",metrics.map((m)=>codeOf(m.code))).in("player_name",aliases).in("opponent_name",aliases),buildMetricObservationContext({metrics,p1:match.p1,p2:match.p2,asOfDate:match.date})]);
  const identityError=identityResult.status==="rejected"?String(identityResult.reason):(identityResult.value as any).error?.message??null,identityRows=identityResult.status==="fulfilled"?(identityResult.value as any).data??[]:[],storedError=storedResult.status==="rejected"?String(storedResult.reason):(storedResult.value as any).error?.message??null,storedRows=storedResult.status==="fulfilled"?(storedResult.value as any).data??[]:[],packetError=packetResult.status==="rejected"?String(packetResult.reason):null,packet=packetResult.status==="fulfilled"?packetResult.value as Record<string,any>:{},localByCode=await deterministicBatch(metrics,match);
  const canonicalIdentityBlocked=[identities.p1.status,identities.p2.status].some((status)=>status==="AMBIGUOUS"||status==="UNRESOLVED"),canonicalIdentityQueryFailed=[identities.p1.status,identities.p2.status].some((status)=>status==="QUERY_FAILED"),details:any[]=[];
  for(const metric of metrics){
   const code=codeOf(metric.code),policy=policyForMetric(code),entry=packet[code]??null,sameCodeStored=storedRows.filter((row:any)=>codeOf(row.metric_code)===code),p1Matches=sameCodeStored.filter((row:any)=>evidencePairMatches(row.player_name,row.opponent_name,match.p1,match.p2)),p2Matches=sameCodeStored.filter((row:any)=>evidencePairMatches(row.player_name,row.opponent_name,match.p2,match.p1)),p1Stored=p1Matches.length===1?p1Matches[0]:null,p2Stored=p2Matches.length===1?p2Matches[0]:null,local=localByCode.get(code)??{row:null,errors:[]},p1Treatment=String(p1Stored?.treatment??local.row?.p1_treatment??"UNAVAILABLE"),p2Treatment=String(p2Stored?.treatment??local.row?.p2_treatment??"UNAVAILABLE"),p1Usable=USABLE.has(p1Treatment),p2Usable=USABLE.has(p2Treatment),pairUsable=p1Usable&&p2Usable,oneSidedUsable=p1Usable!==p2Usable;let bucket:FailureBucket|null=null,reason:string|null=null;
   if(!pairUsable){const queryErrors=[storedError,packetError,...local.errors].filter(Boolean) as string[];if(canonicalIdentityQueryFailed){bucket="EVIDENCE_QUERY_FAILURE";reason=`Canonical warehouse identity lookup failed closed: ${[...identities.p1.query_errors,...identities.p2.query_errors].join(" | ")}`;}else if(canonicalIdentityBlocked){bucket="IDENTITY_MATCH_FAILURE";reason=`Surname-only identity could not be uniquely proven from warehouse evidence (P1=${identities.p1.status}, P2=${identities.p2.status}).`;}else if(queryErrors.length){bucket="EVIDENCE_QUERY_FAILURE";reason=queryErrors.join(" | ");}else if(oneSidedUsable){bucket="COVERAGE_CREDIT_FAILURE";reason=`One-sided usable evidence cannot count as pair-complete coverage (P1=${p1Treatment}, P2=${p2Treatment}).`;}else if((p1Matches.length>1||p2Matches.length>1)||(sameCodeStored.length>0&&!p1Stored&&!p2Stored)){bucket="NORMALIZATION_FAILURE";reason="Persisted evidence exists for this metric/date/alias set but cannot be mapped to exactly one canonical player/opponent orientation.";}else if([p1Stored?.unavailable_reason,p2Stored?.unavailable_reason].filter(Boolean).length>0&&[p1Stored?.unavailable_reason,p2Stored?.unavailable_reason].filter(Boolean).every(isGenuineUnavailableReason)){bucket="GENUINELY_UNAVAILABLE";reason=[p1Stored?.unavailable_reason,p2Stored?.unavailable_reason].filter(Boolean).join(" | ");}else if((entry?.observations?.length??0)>0&&entry?.direct_satisfaction_allowed){bucket="EVIDENCE_WIRING_FAILURE";reason="Sufficient admissible observations exist but did not become a usable deterministic/stored finding.";}else if((entry?.observations?.length??0)>0){bucket="RECONSTRUCTION_FAILURE";reason="Support-only admissible observations exist but no permitted deterministic reconstruction recovered the metric.";}else if(!policy.allowed_families.length){bucket="SOURCE_MISSING";reason="No provider-independent structured source family is registered for this metric.";}else{bucket="INGESTION_MISSING";reason=`A structured path exists for ${policy.allowed_families.join(",")} but no admissible warehouse observation was ingested for this matchup/window.`;}}
   details.push({metric_code:code,metric_name:metric.name,source_expected:policy.allowed_families,warehouse_observation_count:Number(entry?.observations?.length??0),stored_candidate_count:sameCodeStored.length,stored_p1:Boolean(p1Stored),stored_p2:Boolean(p2Stored),p1_treatment:p1Treatment,p2_treatment:p2Treatment,p1_credited:p1Usable,p2_credited:p2Usable,pair_credited:pairUsable,one_sided_usable:oneSidedUsable,deterministic_family:local.row?.evidence_family??null,failure_bucket:bucket,reason});
  }
  const buckets:Record<string,number>={};for(const row of details)if(row.failure_bucket)buckets[row.failure_bucket]=(buckets[row.failure_bucket]??0)+1;const p1Credited=details.filter((row)=>row.p1_credited).length,p2Credited=details.filter((row)=>row.p2_credited).length,pairCredited=details.filter((row)=>row.pair_credited).length,oneSided=details.filter((row)=>row.one_sided_usable).length;
  matches.push({id:match.id,match_id:match.match_id,pair:`${match.p1} vs ${match.p2}`,uploaded_pair:`${sampled.p1} vs ${sampled.p2}`,tournament:match.tournament,scheduled_date:sampled.date_source==="scheduled_date"?match.date:null,diagnostic_as_of_date:match.date,date_source:sampled.date_source,event_level:match.event_level,surface:match.surface,sampling_source:match.sampling_source,canonical_identity_resolution:identities,identity:{exact_match_count:identityRows.length,query_error:identityError,blocks_evidence_classification:canonicalIdentityBlocked},query_errors:[storedError,packetError].filter(Boolean),coverage:{p1:p1Credited,p2:p2Credited,pair:pairCredited,one_sided:oneSided,p1_percent:Number((100*p1Credited/81).toFixed(2)),p2_percent:Number((100*p2Credited/81).toFixed(2)),pair_percent:Number((100*pairCredited/81).toFixed(2))},false_green_guard:{passed:oneSided===0,one_sided_metric_count:oneSided},failure_buckets:buckets,metrics:details});
 }
 return{schema_version:7,generated_at:new Date().toISOString(),metrics:metrics.length,sampling:{source:"REAL_PERSISTED_MATCHES_WITH_PARSED_REGISTRY_AND_WAREHOUSE_FALLBACK",requested_classes:["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"],sampled_classes:matches.map((match)=>match.id),missing_classes:sample.missing_classes,errors:sample.sampling_errors},matches};
}
