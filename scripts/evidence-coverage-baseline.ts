import { writeFileSync, readFileSync } from "node:fs";
import { parseRuleDocument } from "../src/lib/rule-parser";
import { finalMetricWiringResearcher } from "../src/lib/metric-wiring-078-081.server";

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

const USABLE = new Set(["DIRECT", "RECONSTRUCTED", "PARTIAL"]);
const EXPECTED_FAMILY: Record<string, string[]> = {
  "012":["RESULTS_SCHEDULE"], "015":["MARKET"], "019":["MARKET"], "021":["ENVIRONMENT"],
  "024":["POINT_BY_POINT"], "025":["POINT_BY_POINT"], "028":["RESULTS_SCHEDULE"],
  "030":["RESULTS_SCHEDULE","ENVIRONMENT"], "033":["POINT_BY_POINT"], "036":["POINT_BY_POINT"],
  "040":["POINT_BY_POINT"], "042":["POINT_BY_POINT"], "043":["MARKET","POINT_BY_POINT"],
  "044":["MARKET","POINT_BY_POINT"], "060":["ENVIRONMENT","POINT_BY_POINT"], "062":["RANKING"],
  "064":["RESULTS_SCHEDULE"], "069":["RANKING"], "071":["RESULTS_SCHEDULE","ENVIRONMENT"],
  "075":["RULES_CONTEXT"], "076":["RESULTS_SCHEDULE"], "077":["RESULTS_SCHEDULE"],
  "079":["POINT_BY_POINT"], "081":["RESULTS_SCHEDULE"],
};

function codeOf(v: unknown) {
  const m = String(v ?? "").match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(v ?? "").padStart(3, "0");
}
function status(treatment: string | null | undefined): SideStatus {
  if (treatment === "PARTIAL") return "PARTIAL";
  if (treatment === "EXCLUDED") return "EXCLUDED";
  return USABLE.has(String(treatment)) ? "AVAILABLE" : "UNAVAILABLE";
}
function classify(args: { code:string; p1Treatment:string; p2Treatment:string; family:string|null; sourceCount:number; reason:string|null; missing:string[] }): FailureBucket | null {
  const { code, p1Treatment, p2Treatment, family, sourceCount, reason, missing } = args;
  if (USABLE.has(p1Treatment) || USABLE.has(p2Treatment)) return null;
  const text = `${reason ?? ""} ${missing.join(" ")}`.toLowerCase();
  if (/identity|player orientation|player match|opponent match|ambiguous player|ambiguous match/.test(text)) return "IDENTITY_MATCH_FAILURE";
  if (/query|lookup|row not found|no matching row|store miss|database lookup/.test(text)) return "EVIDENCE_QUERY_FAILURE";
  if (/normalize|normalization|format|canonical/.test(text)) return "NORMALIZATION_FAILURE";
  if (/formula|reconstruct|derived input|missing input/.test(text)) return "RECONSTRUCTION_FAILURE";
  if (/credit|coverage|availability accounting|counted/.test(text)) return "COVERAGE_CREDIT_FAILURE";
  if (/wiring|provenance|source provenance|master-definition|exact component|family/.test(text)) return "EVIDENCE_WIRING_FAILURE";
  if (/ingest|warehouse|historical hard pull|upstream|source observation/.test(text)) return "INGESTION_MISSING";
  if (sourceCount === 0 && EXPECTED_FAMILY[code]?.length) return "SOURCE_MISSING";
  if (family && EXPECTED_FAMILY[code] && !EXPECTED_FAMILY[code].includes(family)) return "EVIDENCE_WIRING_FAILURE";
  return "GENUINELY_UNAVAILABLE";
}

const parsed = parseRuleDocument(readFileSync("public/seed/metrics.txt", "utf8"));
const metrics = parsed.rules.filter((r) => Number(r.rule_code) >= 1 && Number(r.rule_code) <= 81).map((r) => ({ code:r.rule_code, name:r.rule_name, body:r.body }));
if (metrics.length !== 81) throw new Error(`Expected 81 metrics, parsed ${metrics.length}`);

const matches = [
  { id:"ATP_MAIN_BASELINE", tour:"ATP_MAIN", p1:"Arthur Fils", p2:"Flavio Cobolli", context:"Tournament: Cincinnati Open | Level: ATP Masters 1000 | Tour: ATP Main | Surface: hard | Date: 2026-08-22" },
  { id:"WTA_MAIN_BASELINE", tour:"WTA_MAIN", p1:"Iga Swiatek", p2:"Jessica Pegula", context:"Tournament: Cincinnati Open | Level: WTA 1000 | Tour: WTA Main | Surface: hard | Date: 2026-08-22" },
  { id:"ATP_CHALLENGER_BASELINE", tour:"ATP_CHALLENGER", p1:"Emilio Nava", p2:"Patrick Kypson", context:"Tournament: ATP Challenger representative | Level: ATP Challenger | Tour: ATP Challenger | Surface: hard | Date: 2026-08-22" },
] as const;

const report:any = { schema_version:1, generated_at:new Date().toISOString(), mode:"provider_independent_pre_production_change_baseline", invariant:"No production logic changed before this baseline.", metrics_parsed:metrics.length, matches:[] };

for (const match of matches) {
  let rows:any[]=[];
  let resolverError:string|null=null;
  try {
    rows = await finalMetricWiringResearcher.metrics({ p1:match.p1, p2:match.p2, context:match.context, dossier:"", metrics });
  } catch (error) {
    resolverError = error instanceof Error ? error.message : String(error);
  }
  const detail = metrics.map((metric) => {
    const code=codeOf(metric.code); const row=rows.find((r)=>codeOf(r.metric_code)===code);
    const p1Treatment=String(row?.p1_treatment??"UNAVAILABLE"), p2Treatment=String(row?.p2_treatment??"UNAVAILABLE");
    const sources=row?.sources??[], family=row?.evidence_family??null;
    const missing=[...(row?.missing_inputs??[]), ...(resolverError ? [`resolver error: ${resolverError}`] : [])];
    const bucket=classify({code,p1Treatment,p2Treatment,family,sourceCount:sources.length,reason:row?.unavailable_reason??resolverError,missing});
    return {
      metric:{code,name:metric.name}, requested_evidence:metric.body??null, source_expected:EXPECTED_FAMILY[code]??[],
      source_actually_found:sources.map((s:any)=>({name:s.source_name,url:s.url??null})), database_evidence_found:null,
      player_identity_status:"NOT_DB_PROBED", match_identity_status:"NOT_DB_PROBED",
      resolver_result:{p1_value:row?.p1_value??null,p2_value:row?.p2_value??null,p1_treatment:p1Treatment,p2_treatment:p2Treatment,evidence_family:family,sample:row?.sample??null},
      reconstruction_result:p1Treatment==="RECONSTRUCTED"||p2Treatment==="RECONSTRUCTED"?"RECOVERED":missing.some((x:string)=>/reconstruct|formula|input/i.test(x))?"FAILED_OR_INCOMPLETE":"NOT_ATTEMPTED_OR_NOT_REQUIRED",
      audit_availability_status:{p1:status(p1Treatment),p2:status(p2Treatment)}, coverage_credit:{p1:USABLE.has(p1Treatment),p2:USABLE.has(p2Treatment),partial_preserved:p1Treatment==="PARTIAL"||p2Treatment==="PARTIAL"},
      failure_bucket:bucket, reason:row?.unavailable_reason??resolverError??(bucket?missing.join("; ")||"No usable evidence survived resolver":null), missing_inputs:missing,
    };
  });
  const p1Credit=detail.filter((d:any)=>d.coverage_credit.p1).length, p2Credit=detail.filter((d:any)=>d.coverage_credit.p2).length;
  const buckets:Record<string,number>={}; for(const d of detail) if(d.failure_bucket) buckets[d.failure_bucket]=(buckets[d.failure_bucket]??0)+1;
  report.matches.push({...match,resolver_error:resolverError,coverage:{p1_credited:p1Credit,p2_credited:p2Credit,p1_percent:Number((100*p1Credit/81).toFixed(2)),p2_percent:Number((100*p2Credit/81).toFixed(2))},failure_buckets:buckets,metrics:detail});
}
writeFileSync("data/audit/evidence-coverage-baseline.json",`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report.matches.map((m:any)=>({id:m.id,resolver_error:m.resolver_error,coverage:m.coverage,failure_buckets:m.failure_buckets})),null,2));
