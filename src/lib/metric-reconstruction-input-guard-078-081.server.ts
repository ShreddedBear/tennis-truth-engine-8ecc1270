import type { MetricFinding, Researcher } from "./audit-pipeline";
import { finalMetricWiringResearcher } from "./metric-wiring-078-081.server";

const TARGET = new Set(["078", "079", "081"]);
const SUBJECT: Record<string, RegExp> = {
  "079": /coaching|shot clock|violation|racket change|late night|early next day|hydration|medical timeout|first point|first game|opening game|changeover|odd game|even game|return position|serve placement|serve direction|serve pattern|scouting report|altitude|elevation|surface switch|layoff|absence|wildcard|protected ranking|qualifying|entry status|seed|draw|walkover|fine|suspension|coach opponent|coach history|lead|deficit|shot selection/i,
  "081": /ceremony|start delay|court assignment|center court|featured court|rain delay|resumption|overnight suspension|opponent substitution|lucky loser|alternate|weekday|weekend|consecutive day|training base|withdrawal|electronic line calling|major week|grand slam week|prior year round|stringer|physio|support staff|visa|transit|missed connection|travel friction|home climate|event climate|temperature|humidity|dryness/i,
};
const DENOMINATOR = /matches?|games?|sets?|points?|events?|opportunities|days?|rounds?|exposures?|visits?|resumptions?|withdrawals?|appearances?|observations?/i;
const FORBIDDEN: Record<string, RegExp> = {
  "079": /surface elo|market odds|sportsbook|sponsor pressure|ranking|age|height|handedness|hold pct|break pct/i,
  "081": /surface elo|serve profile|return profile|market odds|sportsbook|sponsor pressure|ranking|age|height|handedness|ace rate|double fault|hold pct|break pct/i,
};

function codeOf(value: unknown) {
  const m = String(value ?? "").match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function norm(value: unknown) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tag(value: string | null, key: string) {
  if (!value) return null;
  return value.match(new RegExp(`${key}\\s*=\\s*([^;]+)`, "i"))?.[1]?.trim() ?? null;
}
function exactFormulaInputs(code: string, value: string | null) {
  if (!value || code === "078") return false;
  const formula = tag(value, "FORMULA");
  const rawInputs = tag(value, "INPUTS");
  const subject = SUBJECT[code];
  const forbidden = FORBIDDEN[code];
  if (!formula || !rawInputs || !subject || !forbidden) return false;
  const inputs = rawInputs.split("|").map((x) => x.trim()).filter(Boolean);
  if (!inputs.length || !inputs.some((input) => subject.test(input))) return false;
  if (inputs.some((input) => forbidden.test(input))) return false;
  if (inputs.some((input) => !subject.test(input) && !DENOMINATOR.test(input))) return false;
  const normalizedFormula = norm(formula);
  if (inputs.some((input) => !normalizedFormula.includes(norm(input)))) return false;
  return !forbidden.test(formula);
}
function rejectReconstruction(row: MetricFinding): MetricFinding {
  const code = codeOf(row.metric_code);
  if (!TARGET.has(code)) return row;
  const p1Bad = row.p1_treatment === "RECONSTRUCTED" && !exactFormulaInputs(code, row.p1_value);
  const p2Bad = row.p2_treatment === "RECONSTRUCTED" && !exactFormulaInputs(code, row.p2_value);
  if (!p1Bad && !p2Bad) return row;
  const missing = [...new Set([...(row.missing_inputs ?? []), ...(p1Bad ? ["P1 reconstructed value lacks enumerated exact permitted INPUTS used by FORMULA"] : []), ...(p2Bad ? ["P2 reconstructed value lacks enumerated exact permitted INPUTS used by FORMULA"] : [])])];
  return {
    ...row,
    p1_value: p1Bad ? null : row.p1_value,
    p2_value: p2Bad ? null : row.p2_value,
    p1_treatment: p1Bad ? "UNAVAILABLE" : row.p1_treatment,
    p2_treatment: p2Bad ? "UNAVAILABLE" : row.p2_treatment,
    unavailable_reason: `Metric ${code} reconstruction-input guard rejected a reconstruction whose exact raw inputs were not fully enumerated and formula-bound.`,
    missing_inputs: missing,
  };
}

export function enforceReconstructionInputWiring078081(row: MetricFinding) {
  return rejectReconstruction(row);
}

export const strictFinalMetricWiringResearcher: Researcher = {
  ...finalMetricWiringResearcher,
  async metrics(input) {
    const decorated = input.metrics.map((metric) => TARGET.has(codeOf(metric.code)) ? {
      ...metric,
      body: `${metric.body ?? ""}\nRECONSTRUCTION INPUT CONTRACT: A RECONSTRUCTED value must include INPUTS=<exact raw input 1>|<exact raw input 2>; FORMULA=<explicit calculation using every listed INPUTS item>. Inputs must belong to this exact metric/submetric; unrelated inputs make the reconstruction UNAVAILABLE. Metric 078 is factual public context and is never reconstructable.`,
    } : metric);
    const rows = await finalMetricWiringResearcher.metrics({ ...input, metrics: decorated });
    return rows.map(rejectReconstruction);
  },
};
