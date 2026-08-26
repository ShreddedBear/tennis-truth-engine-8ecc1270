export type ObservationFamily =
  | "RESULTS_SCHEDULE"
  | "RANKING"
  | "MARKET"
  | "ENVIRONMENT"
  | "POINT_BY_POINT"
  | "RULES_CONTEXT";

export type MetricSourcePolicy = { metric_code:string; allowed_families:ObservationFamily[]; sufficient_families:ObservationFamily[]; support_only_families?:ObservationFamily[] };

// Task 13 source-family applicability, reconciled with Task 17 for Tasks 18A-18C.
// Applicability never awards coverage by itself; metric-specific recovery must
// still prove pair-complete raw evidence and preserve treatment.
const RESULTS_SCHEDULE_METRICS=new Set(["001","002","003","005","006","007","008","009","010","011","012","013","018","020","021","022","023","024","025","026","027","028","030","031","034","035","037","038","039","041","045","046","049","050","051","052","053","054","055","056","057","058","059","064","068","071","076","077","080","081"]);
const RANKING_METRICS=new Set(["013","014","020","023","038","039","047","055","058","062","068","069","080"]);
const MARKET_METRICS=new Set(["015","019","039","043","044","047","057","073"]);
const ENVIRONMENT_METRICS=new Set(["001","030","060","071","075"]);
const PBP_METRICS=new Set(["002","003","004","008","009","010","011","016","018","022","024","025","026","027","031","032","033","034","036","037","038","039","040","041","042","043","044","045","046","051","052","053","054","059","060","069","070","071","079"]);
const RULES_METRICS=new Set(["020","064","075","076"]);

function codeOf(value:unknown){const m=String(value??"").match(/(\d{1,3})$/);return m?m[1].padStart(3,"0"):String(value??"").padStart(3,"0");}
export function policyForMetric(metricCode:unknown):MetricSourcePolicy{
 const code=codeOf(metricCode),allowed=new Set<ObservationFamily>(),sufficient=new Set<ObservationFamily>(),supportOnly=new Set<ObservationFamily>();
 if(RESULTS_SCHEDULE_METRICS.has(code))allowed.add("RESULTS_SCHEDULE");if(RANKING_METRICS.has(code))allowed.add("RANKING");if(MARKET_METRICS.has(code))allowed.add("MARKET");if(ENVIRONMENT_METRICS.has(code))allowed.add("ENVIRONMENT");if(PBP_METRICS.has(code))allowed.add("POINT_BY_POINT");if(RULES_METRICS.has(code))allowed.add("RULES_CONTEXT");
 if(["015","019"].includes(code))sufficient.add("MARKET");if(code==="021")sufficient.add("RESULTS_SCHEDULE");if(["014","062","069"].includes(code))sufficient.add("RANKING");
 for(const family of allowed)if(!sufficient.has(family))supportOnly.add(family);
 return{metric_code:code,allowed_families:[...allowed],sufficient_families:[...sufficient],support_only_families:[...supportOnly]};
}
export function observationFamily(row:{source_id?:string|null;observation_type?:string|null;observation_key?:string|null}):ObservationFamily|null{
 const source=String(row.source_id??"").toLowerCase(),type=String(row.observation_type??"").toUpperCase(),key=String(row.observation_key??"").toLowerCase();
 const resultSources=new Set(["atp","wta","atp_challenger","wta_challenger","wta_125","tennisdata_wta_challenger","production_wta_125"]);
 if(resultSources.has(source)&&["MATCH_RESULT_OR_SCHEDULE","TOURNAMENT_SCHEDULE"].includes(type))return"RESULTS_SCHEDULE";
 if(type==="RANKING"||key.includes("ranking")||key.includes("rank_points"))return"RANKING";
 if(source==="odds_api"||type==="MARKET"||key.includes("decimal_odds"))return"MARKET";
 if(source==="open_meteo"||type==="ENVIRONMENT")return"ENVIRONMENT";
 if(type==="POINT_BY_POINT"||type==="PBP")return"POINT_BY_POINT";
 if(type==="RULES"||type==="RULES_CONTEXT")return"RULES_CONTEXT";
 return null;
}
export function assertObservationFamily(row:{source_id?:string|null;observation_type?:string|null;observation_key?:string|null},expected:ObservationFamily){const actual=observationFamily(row);if(actual!==expected)throw new Error(`Observation family mismatch: expected ${expected}, got ${actual??"UNKNOWN"}`);return row;}
export function metricAllowsObservation(metricCode:unknown,row:{source_id?:string|null;observation_type?:string|null;observation_key?:string|null}){const family=observationFamily(row);return Boolean(family&&policyForMetric(metricCode).allowed_families.includes(family));}
