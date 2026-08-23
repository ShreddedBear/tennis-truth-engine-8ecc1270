import type { MetricFinding, Researcher } from "./audit-pipeline";
import { validatedCompletionResearcher } from "./validated-completion-research.server";

type Component = { name: string; terms: string[]; reconstructedOnly?: boolean };

const PROTECTED_COMPONENTS: Record<string, Component[]> = {
  "041": [
    { name: "opponent-quality-adjusted record trend", terms: ["opponent quality adjusted record trend", "opponent-quality-adjusted record trend"] },
    { name: "hold-rate trend", terms: ["hold rate trend", "hold-rate trend", "hold rate improving", "hold improvement"] },
    { name: "return-points-won trend", terms: ["return points won trend", "return-points-won trend", "return points won improving", "return improvement"] },
    { name: "Dominance Ratio trend", terms: ["dominance ratio trend", "dominance ratio improving", "dominance ratio improvement"] },
    { name: "break-points-created trend", terms: ["break points created trend", "break-points-created trend", "break points created improving", "break point creation trend"] },
    { name: "loss-inclusive chronology", terms: ["including losses", "despite losses", "loss-inclusive", "losses included", "while the win loss record lags"] },
  ],
  "043": [
    { name: "favorite-role designation", terms: ["current favorite", "pre match favorite", "pre-match favorite", "favorite role", "favored player"] },
    { name: "favorite-role historical losses", terms: ["historical losses", "favorite losses", "losses as favorite", "favorite-role historical losses"] },
    { name: "documented favorite failure-mode condition", terms: ["failure mode profile", "failure-mode profile", "failure condition", "low first serve", "first serve failure", "serve deterioration", "opponent return points won", "return pressure", "third set", "deciding set", "set state", "set-state"] },
    { name: "today's opponent compatibility", terms: ["today s opponent", "today's opponent", "opponent compatibility", "opponent can reproduce", "opponent can create"] },
  ],
  "044": [
    { name: "underdog-role history", terms: ["current underdog", "underdog role", "as underdog", "historical underdog"] },
    { name: "verified upset outcomes", terms: ["upset wins", "upset outcomes", "verified upset", "favorites beaten"] },
    { name: "favorite Elo similarity", terms: ["elo"] },
    { name: "favorite serve-style similarity", terms: ["serve style", "serving style"] },
    { name: "favorite return-quality similarity", terms: ["return quality", "return strength"] },
    { name: "surface similarity", terms: ["surface", "court surface"] },
    { name: "ranking similarity", terms: ["ranking"] },
    { name: "handedness similarity", terms: ["handedness", "left handed", "right handed", "left-handed", "right-handed"] },
    { name: "rally-style similarity", terms: ["rally style", "rally profile"] },
    { name: "price similarity", terms: ["price", "odds", "implied probability"] },
    { name: "tournament-level similarity", terms: ["tournament level", "event level", "tour level"] },
    { name: "today's favorite orientation", terms: ["today s favorite", "today's favorite", "current favorite"] },
  ],
  "045": [
    { name: "favorite-role designation", terms: ["current favorite", "pre match favorite", "pre-match favorite", "favorite role", "favored player"] },
    { name: "opponent holds first three service games", terms: ["opponent holds first 3 service games", "opponent holds first three service games", "first three service games"] },
    { name: "failed early break chances", terms: ["failing early break chances", "failed early break chances", "missed early break points", "missed early break chances"] },
    { name: "favorite broken first", terms: ["losing first break", "broken first", "favorite being broken first"] },
    { name: "first set reaches 4-4", terms: ["set reaches 4 4", "set reaches 4-4", "first set reaches 4 4", "first set reaches 4-4"] },
    { name: "first-set tiebreak", terms: ["set reaches a tiebreak", "first set tiebreak", "first-set tiebreak"] },
    { name: "opponent forces deciding set", terms: ["opponent forces set 3", "opponent forces a deciding set", "pushed to a deciding set", "forces deciding set"] },
  ],
  "046": [
    { name: "Elo after winning set 1", terms: ["elo after winning set 1", "elo after winning the first set"] },
    { name: "Elo after losing set 1", terms: ["elo after losing set 1", "elo after losing the first set"] },
    { name: "Elo in deciding sets", terms: ["elo in deciding sets", "deciding set elo", "deciding-set elo"] },
    { name: "Elo in tiebreak-heavy matches", terms: ["elo in tiebreak heavy matches", "elo in tiebreak-heavy matches", "tiebreak heavy elo"] },
    { name: "Elo against big servers", terms: ["elo against big servers", "big server elo", "big-server elo"] },
    { name: "Elo against strong returners", terms: ["elo against strong returners", "strong returner elo", "strong-returner elo"] },
    { name: "big-server threshold", terms: ["big server threshold", "big-server threshold", "big server definition"], reconstructedOnly: true },
    { name: "strong-returner threshold", terms: ["strong returner threshold", "strong-returner threshold", "strong returner definition"], reconstructedOnly: true },
  ],
};

function familyCode(code: string) {
  const m = String(code).match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(code).padStart(3, "0");
}
function norm(v: string | null) {
  return String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function containsAny(value: string | null, terms: string[]) {
  const v = norm(value);
  return terms.some((term) => v.includes(norm(term)));
}
function hasUsableSource(sources: MetricFinding["sources"]) {
  return Boolean(sources?.some((s) => Boolean(String(s.source_name ?? "").trim())));
}

function validateSide(value: string | null, treatment: MetricFinding["p1_treatment"], sources: MetricFinding["sources"], components: Component[]) {
  if (treatment === "UNAVAILABLE" || treatment === "EXCLUDED") return { value, treatment, missing: [] as string[] };
  if (!value || !hasUsableSource(sources)) {
    return { value: null, treatment: "UNAVAILABLE" as const, missing: components.filter((c) => !c.reconstructedOnly || treatment === "RECONSTRUCTED").map((c) => c.name) };
  }
  const required = components.filter((c) => !c.reconstructedOnly || treatment === "RECONSTRUCTED");
  const hits = required.filter((c) => containsAny(value, c.terms));
  const missing = required.filter((c) => !hits.includes(c)).map((c) => c.name);
  if (!missing.length) return { value, treatment, missing };
  if (hits.length) return { value, treatment: "PARTIAL" as const, missing };
  return { value: null, treatment: "UNAVAILABLE" as const, missing };
}

export function validateProtectedMetricWiring(finding: MetricFinding): MetricFinding {
  const code = familyCode(finding.metric_code);
  const components = PROTECTED_COMPONENTS[code];
  if (!components) return finding;
  const p1 = validateSide(finding.p1_value, finding.p1_treatment, finding.sources, components);
  const p2 = validateSide(finding.p2_value, finding.p2_treatment, finding.sources, components);
  const missing = [...new Set([...(p1.missing ?? []), ...(p2.missing ?? [])])];
  return {
    ...finding,
    p1_value: p1.value,
    p2_value: p2.value,
    p1_treatment: p1.treatment,
    p2_treatment: p2.treatment,
    unavailable_reason: missing.length
      ? `Protected metric wiring guard: only exact master-definition components are admissible for ${code}; unsupported components remain missing (${missing.join(", ")}).`
      : finding.unavailable_reason,
    missing_inputs: missing.length ? [...new Set([...(finding.missing_inputs ?? []), ...missing])] : finding.missing_inputs,
  };
}

export const protectedMetricWiringResearcher: Researcher = {
  ...validatedCompletionResearcher,
  async metrics(input) {
    const rows = await validatedCompletionResearcher.metrics(input);
    return rows.map(validateProtectedMetricWiring);
  },
};
