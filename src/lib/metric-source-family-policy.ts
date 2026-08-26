export type ObservationFamily =
  | "RESULTS_SCHEDULE"
  | "RANKING"
  | "MARKET"
  | "ENVIRONMENT"
  | "POINT_BY_POINT"
  | "RULES_CONTEXT";

export type MetricSourcePolicy = {
  metric_code: string;
  allowed_families: ObservationFamily[];
  sufficient_families: ObservationFamily[];
  support_only_families?: ObservationFamily[];
};

const RESULTS_SCHEDULE_METRICS = new Set(["012", "028", "030", "064", "071", "076", "077", "081"]);
const RANKING_METRICS = new Set(["062", "069"]);
const MARKET_METRICS = new Set(["015", "019", "043", "044"]);
const ENVIRONMENT_METRICS = new Set(["021", "030", "060", "071"]);
const PBP_METRICS = new Set(["024", "025", "033", "036", "040", "042", "043", "044", "060", "079"]);
const RULES_METRICS = new Set(["075"]);

function codeOf(value: unknown) {
  const m = String(value ?? "").match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}

export function policyForMetric(metricCode: unknown): MetricSourcePolicy {
  const code = codeOf(metricCode);
  const allowed = new Set<ObservationFamily>();
  const sufficient = new Set<ObservationFamily>();
  const supportOnly = new Set<ObservationFamily>();

  if (RESULTS_SCHEDULE_METRICS.has(code)) allowed.add("RESULTS_SCHEDULE");
  if (RANKING_METRICS.has(code)) allowed.add("RANKING");
  if (MARKET_METRICS.has(code)) allowed.add("MARKET");
  if (ENVIRONMENT_METRICS.has(code)) allowed.add("ENVIRONMENT");
  if (PBP_METRICS.has(code)) allowed.add("POINT_BY_POINT");
  if (RULES_METRICS.has(code)) allowed.add("RULES_CONTEXT");

  if (["015", "019"].includes(code)) sufficient.add("MARKET");
  if (code === "021") sufficient.add("ENVIRONMENT");
  if (["062", "069"].includes(code)) sufficient.add("RANKING");

  if (RESULTS_SCHEDULE_METRICS.has(code)) supportOnly.add("RESULTS_SCHEDULE");
  if (code === "030") supportOnly.add("ENVIRONMENT");
  if (code === "071") supportOnly.add("ENVIRONMENT");
  if (["043", "044"].includes(code)) {
    supportOnly.add("MARKET");
    supportOnly.add("POINT_BY_POINT");
  }
  if (code === "060") {
    supportOnly.add("ENVIRONMENT");
    supportOnly.add("POINT_BY_POINT");
  }
  if (code === "079") supportOnly.add("POINT_BY_POINT");
  if (code === "075") supportOnly.add("RULES_CONTEXT");

  return {
    metric_code: code,
    allowed_families: [...allowed],
    sufficient_families: [...sufficient],
    support_only_families: [...supportOnly],
  };
}

export function observationFamily(row: { source_id?: string | null; observation_type?: string | null; observation_key?: string | null }): ObservationFamily | null {
  const source = String(row.source_id ?? "").toLowerCase();
  const type = String(row.observation_type ?? "").toUpperCase();
  const key = String(row.observation_key ?? "").toLowerCase();

  // All four competition lanes are legitimate results/schedule evidence, but
  // remain isolated records. Adding WTA Challenger/WTA 125 here only classifies
  // its own observations; it does not allow one tour's row to satisfy another.
  const resultSources = new Set([
    "atp", "wta", "atp_challenger", "wta_challenger", "wta_125",
    "tennisdata_wta_challenger", "production_wta_125",
  ]);
  if (resultSources.has(source) && ["MATCH_RESULT_OR_SCHEDULE", "TOURNAMENT_SCHEDULE"].includes(type)) {
    return "RESULTS_SCHEDULE";
  }
  if (type === "RANKING" || key.includes("ranking") || key.includes("rank_points")) return "RANKING";
  if (source === "odds_api" || type === "MARKET" || key.includes("decimal_odds")) return "MARKET";
  if (source === "open_meteo" || type === "ENVIRONMENT") return "ENVIRONMENT";
  if (type === "POINT_BY_POINT" || type === "PBP") return "POINT_BY_POINT";
  if (type === "RULES" || type === "RULES_CONTEXT") return "RULES_CONTEXT";
  return null;
}

export function assertObservationFamily(
  row: { source_id?: string | null; observation_type?: string | null; observation_key?: string | null },
  expected: ObservationFamily,
) {
  const actual = observationFamily(row);
  if (actual !== expected) {
    throw new Error(`Observation family mismatch: expected ${expected}, got ${actual ?? "UNKNOWN"}`);
  }
  return row;
}

export function metricAllowsObservation(metricCode: unknown, row: { source_id?: string | null; observation_type?: string | null; observation_key?: string | null }) {
  const family = observationFamily(row);
  if (!family) return false;
  return policyForMetric(metricCode).allowed_families.includes(family);
}
