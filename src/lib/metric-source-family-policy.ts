export type ObservationFamily =
  | "RESULTS_SCHEDULE"
  | "RANKING"
  | "MARKET"
  | "ENVIRONMENT"
  | "POINT_BY_POINT"
  | "RULES_CONTEXT";

export type MetricSourcePolicy = { metric_code:string; allowed_families:ObservationFamily[]; sufficient_families:ObservationFamily[]; support_only_families?:ObservationFamily[] };

// Task 19 rebuild: these sets are keyed to the TRUE canonical metric
// identities in public/seed/metrics.txt, read directly (title + full body)
// for all 81 codes. The previous version of this file was keyed to a stale
// numbering scheme shared with metric-recoverability-map.ts — verified by
// comparing every code's old assumed name against metrics.txt's actual title;
// 77 of 81 codes had drifted (e.g. old "070 Breakback Rate" [PBP-appropriate]
// vs true "070 Support Team / Prep" [not PBP-appropriate at all]). Rebuilding
// this file is a false-green-firewall fix, not a coverage-percentage change:
// a wrong family here can let a metric accept evidence it was never defined
// to use. Applicability never awards coverage by itself; metric-specific
// recovery must still prove pair-complete raw evidence and preserve treatment.
//
// Codes intentionally absent from every set below (017, 048, 049, 050, 054,
// 056, 057, 058, 063, 065, 066, 067, 069, 072, 074, 078, 079, 081) are either
// META_OR_NON_PLAYER or PROTECTED_UNAVAILABLE per src/lib/metric-classification.ts
// — their true definitions require fields no approved source provides, or
// aren't player-comparison metrics at all. See that file for the full,
// documented reasoning per code.
const RESULTS_SCHEDULE_METRICS=new Set(["001","002","003","005","006","007","008","009","010","011","012","013","019","020","021","022","023","025","027","028","030","031","034","035","036","037","038","039","041","043","044","046","051","052","055","059","061","064","068","070","071","076","077","080"]);
const RANKING_METRICS=new Set(["006","014","020","036","038","039","041","044","047","055","062","068","080"]);
const MARKET_METRICS=new Set(["015","019","043","044","047","073"]);
const ENVIRONMENT_METRICS=new Set(["001","021","030","060","071"]);
const PBP_METRICS=new Set(["002","003","004","008","009","011","016","018","022","023","024","025","026","027","029","031","032","033","034","036","037","038","040","041","042","043","044","045","046","051","052","053","055","059","060"]);
const RULES_METRICS=new Set(["064","075"]);

function codeOf(value:unknown){const m=String(value??"").match(/(\d{1,3})$/);return m?m[1].padStart(3,"0"):String(value??"").padStart(3,"0");}
export function policyForMetric(metricCode:unknown):MetricSourcePolicy{
 const code=codeOf(metricCode),allowed=new Set<ObservationFamily>(),sufficient=new Set<ObservationFamily>(),supportOnly=new Set<ObservationFamily>();
 if(RESULTS_SCHEDULE_METRICS.has(code))allowed.add("RESULTS_SCHEDULE");if(RANKING_METRICS.has(code))allowed.add("RANKING");if(MARKET_METRICS.has(code))allowed.add("MARKET");if(ENVIRONMENT_METRICS.has(code))allowed.add("ENVIRONMENT");if(PBP_METRICS.has(code))allowed.add("POINT_BY_POINT");if(RULES_METRICS.has(code))allowed.add("RULES_CONTEXT");
 if(["015","019"].includes(code))sufficient.add("MARKET");if(code==="021")sufficient.add("RESULTS_SCHEDULE");if(["014","062"].includes(code))sufficient.add("RANKING");
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
