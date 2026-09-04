// TRUTH ENGINE — DETERMINISTIC P1 vs P2 METRIC COMPARISON
//
// Why this exists (forensic finding, docs/audit-truth-engine-decision-core.md):
// every decision stage in this pipeline (verification, disagreement, underdog,
// conclusion, stress) delegated entirely to the LLM researcher, with no deterministic
// fallback. Across 405 persisted runs that produced 0 verification findings, 0
// disagreement risks, 0 underdog classifications and 0 independent winners, while the
// stages themselves still reported COMPLETE. Metric execution, by contrast, works and
// has persisted real two-sided evidence (7,713 P1 / 7,342 P2 values).
//
// This module turns that already-computed metric evidence into a comparable, auditable
// P1-vs-P2 signal WITHOUT any AI call and without inventing data.
//
// THREE RULES THIS MODULE ENFORCES ABSOLUTELY:
//
// 1. UNAVAILABLE IS NEVER ZERO. A missing/NA/unparseable value yields status
//    "UNAVAILABLE" and takes no part in the comparison. It is never coerced to 0, which
//    would silently read as "this player scored nothing" and hand the other side a win.
//
// 2. MISSING EVIDENCE NEVER FAVOURS THE OTHER PLAYER. A comparison requires BOTH sides
//    to parse. One-sided evidence is "UNAVAILABLE" (one_sided), never a P1 or P2 lean.
//
// 3. DIRECTION IS EXPLICIT, NEVER INFERRED. Every comparable metric must declare which
//    direction is better in COMPARISON_SPECS below. A metric with no spec is reported
//    NO_COMPARISON_SPEC and excluded from the decision rather than guessed at -- guessing
//    a direction is exactly how a P1/P2 selection silently inverts.

export type ComparisonDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
export type ComparisonFavours = "P1" | "P2" | "NEUTRAL" | "UNAVAILABLE";
export type ComparisonStatus =
  | "COMPARED"
  | "NO_COMPARISON_SPEC"
  | "TREATMENT_NOT_USABLE"
  | "ONE_SIDED_EVIDENCE"
  | "VALUE_NOT_PARSEABLE";

const USABLE_TREATMENTS = new Set(["DIRECT", "RECONSTRUCTED", "PARTIAL"]);

export interface ComparisonSpec {
  /** Keyed field to compare, e.g. "last10_win_pct". null means the whole value is a bare scalar (e.g. metric 001's Elo). */
  field: string | null;
  /**
   * Alternate persisted names for the SAME quantity. Producers have emitted more than one
   * key name for one measurement (e.g. 008 persists "deciding_set_win_pct" in 87 rows and
   * "set3_deciding_set_win_pct" in 1). An alias is only legitimate when it denotes the
   * identical quantity in the identical units and direction -- never a similar-sounding
   * substitute, which would silently change what is being compared.
   */
  fieldAliases?: string[];
  /**
   * Accept a bare scalar value when no keyed field is present. Only legitimate where the
   * bare form is unambiguously the SAME measurement as `field`: metric 001 persists its
   * surface Elo as a bare "1521.13" in 189 rows and as "surface_elo=1429" in 102. It is
   * never set for a metric whose bare scalar has an unknown meaning -- 008/010 persist
   * bare counts of unknown definition, and those stay VALUE_NOT_PARSEABLE by design.
   */
  bareScalarFallback?: boolean;
  /** Optional second field subtracted from `field` (e.g. favourable - unfavourable outcomes). */
  minusField?: string;
  direction: ComparisonDirection;
  /** Independent evidence family. Metrics sharing a family are correlated and must vote ONCE (anti-double-counting). */
  family: string;
  /** Differences at or below this are NEUTRAL — guards against treating noise as a signal. */
  materiality: number;
  label: string;
}

// Only metrics whose comparable quantity and direction are defensible from the metric's
// own definition are listed. This registry is deliberately conservative: an absent code
// is reported NO_COMPARISON_SPEC and contributes nothing, which is honest, rather than
// being assigned a guessed direction. Quarantined codes (MATRIX_SUMMARY_REQUIRED) are
// intentionally absent and must never be added here while quarantined.
export const COMPARISON_SPECS: Record<string, ComparisonSpec> = {
  // Surface-specific Elo rating; the single most decision-relevant strength signal.
  "001": { field: "surface_elo", bareScalarFallback: true, direction: "HIGHER_IS_BETTER", family: "SURFACE_STRENGTH", materiality: 10, label: "Surface Elo" },
  // Recent form: share of the last 10 matches won.
  "005": { field: "last10_win_pct", direction: "HIGHER_IS_BETTER", family: "RECENT_FORM", materiality: 5, label: "Last-10 win %" },
  // Set Profile: deciding-set win rate.
  "008": { field: "set3_deciding_set_win_pct", fieldAliases: ["deciding_set_win_pct"], direction: "HIGHER_IS_BETTER", family: "SET_PROFILE", materiality: 5, label: "Deciding-set win %" },
  // Straight-set control.
  "010": { field: "straight_set_match_win_pct", fieldAliases: ["straight_set_win_pct"], direction: "HIGHER_IS_BETTER", family: "SET_PROFILE", materiality: 5, label: "Straight-set win %" },
  // Volatility/floor: overall match win rate component.
  "011": { field: "match_win_pct", direction: "HIGHER_IS_BETTER", family: "RESULTS_HISTORY", materiality: 5, label: "Match win %" },
  // Common-opponent adjusted set differential (opponent-quality adjusted).
  "031": { field: "opponent_adjusted_set_differential", direction: "HIGHER_IS_BETTER", family: "COMMON_OPPONENT", materiality: 0.15, label: "Opponent-adjusted set differential" },
  // Opponent finishing ability: how reliably a lead is protected.
  "027": { field: "lead_protection_rate_pct", direction: "HIGHER_IS_BETTER", family: "CLOSING_ABILITY", materiality: 5, label: "Lead protection %" },
  // Opponent-specific (H2H-shrunk) win probability.
  "051": { field: "shrunk_win_probability_pct", direction: "HIGHER_IS_BETTER", family: "H2H_PROBABILITY", materiality: 3, label: "Opponent-specific win probability %" },
  // Common-opponent caliber: favourable minus unfavourable divergent outcomes.
  // Deliberately shares COMMON_OPPONENT with 031 -- they read the same shared-opponent
  // pool, so they must not count as two independent pieces of evidence.
  "080": { field: "favorable_divergent_outcomes", minusField: "unfavorable_divergent_outcomes", direction: "HIGHER_IS_BETTER", family: "COMMON_OPPONENT", materiality: 1, label: "Common-opponent net divergent outcomes" },
};

export interface ParsedMetricValue {
  scalar: number | null;
  fields: Map<string, string>;
}

/**
 * Parses both persisted shapes seen in metric_results: a bare scalar ("1483.15") and a
 * keyed string ("last10_win_pct=10; trend_direction=DECLINING"). Provenance-prefixed
 * values ("PLAYER=x; SOURCE=y; SAMPLE=5; k=v") parse into the same field map, so a
 * spec'd field is still found inside them.
 */
export function parseMetricValue(raw: string | null | undefined): ParsedMetricValue {
  const text = String(raw ?? "").trim();
  const fields = new Map<string, string>();
  if (!text) return { scalar: null, fields };
  for (const part of text.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) fields.set(key, value);
  }
  const bare = Number(text);
  return { scalar: Number.isFinite(bare) && text !== "" ? bare : null, fields };
}

/** "NA"/""/non-numeric all yield null -- never 0. */
function numeric(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "NA" || trimmed.toUpperCase() === "NULL") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** First declared name (canonical, then aliases) that carries a numeric value. */
function lookup(parsed: ParsedMetricValue, field: string, aliases: string[] | undefined): number | null {
  for (const name of [field, ...(aliases ?? [])]) {
    const value = numeric(parsed.fields.get(name));
    if (value !== null) return value;
  }
  return null;
}

function extract(spec: ComparisonSpec, parsed: ParsedMetricValue): number | null {
  if (spec.field === null) return parsed.scalar;
  const primary = lookup(parsed, spec.field, spec.fieldAliases) ?? (spec.bareScalarFallback ? parsed.scalar : null);
  if (primary === null) return null;
  if (!spec.minusField) return primary;
  const secondary = lookup(parsed, spec.minusField, undefined);
  if (secondary === null) return null;
  return primary - secondary;
}

export interface MetricComparison {
  metric_code: string;
  label: string | null;
  family: string | null;
  status: ComparisonStatus;
  favours: ComparisonFavours;
  p1_number: number | null;
  p2_number: number | null;
  /** Always oriented as (P1 - P2) in the metric's own units, regardless of direction. */
  differential: number | null;
  /** Positive means "better for P1" after applying direction; sign is decision-facing. */
  advantage_p1: number | null;
  direction: ComparisonDirection | null;
  reason: string;
}

export interface MetricRowForComparison {
  metric_code: string;
  p1_value?: string | null;
  p2_value?: string | null;
  p1_treatment?: string | null;
  p2_treatment?: string | null;
}

function codeOf(value: unknown) {
  const m = String(value ?? "").match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}

/**
 * Compares one persisted metric row. Pure: no DB, no network, no AI. Never throws, and
 * never returns a P1/P2 lean unless BOTH sides carried usable, parseable evidence.
 */
export function compareMetricRow(row: MetricRowForComparison): MetricComparison {
  const code = codeOf(row.metric_code);
  const spec = COMPARISON_SPECS[code];
  const base = { metric_code: code, label: spec?.label ?? null, family: spec?.family ?? null, p1_number: null, p2_number: null, differential: null, advantage_p1: null, direction: spec?.direction ?? null };

  if (!spec) {
    return { ...base, status: "NO_COMPARISON_SPEC", favours: "UNAVAILABLE", reason: `No declared comparable field/direction for metric ${code}; excluded from the decision rather than guessed.` };
  }
  const p1Usable = USABLE_TREATMENTS.has(String(row.p1_treatment ?? ""));
  const p2Usable = USABLE_TREATMENTS.has(String(row.p2_treatment ?? ""));
  if (!p1Usable || !p2Usable) {
    // Explicitly NOT a lean for whichever side happens to be usable.
    return { ...base, status: "TREATMENT_NOT_USABLE", favours: "UNAVAILABLE", reason: `Treatment not usable on ${!p1Usable && !p2Usable ? "both sides" : !p1Usable ? "P1" : "P2"} (p1=${row.p1_treatment ?? "none"}, p2=${row.p2_treatment ?? "none"}); no comparison made and no side credited.` };
  }

  const p1Number = extract(spec, parseMetricValue(row.p1_value));
  const p2Number = extract(spec, parseMetricValue(row.p2_value));
  if (p1Number === null && p2Number === null) {
    return { ...base, status: "VALUE_NOT_PARSEABLE", favours: "UNAVAILABLE", reason: `Neither side carried a parseable "${spec.field ?? "scalar"}" value; treated as UNAVAILABLE, never as zero.` };
  }
  if (p1Number === null || p2Number === null) {
    return { ...base, p1_number: p1Number, p2_number: p2Number, status: "ONE_SIDED_EVIDENCE", favours: "UNAVAILABLE", reason: `Only ${p1Number === null ? "P2" : "P1"} carried a parseable "${spec.field ?? "scalar"}" value. One-sided evidence is never a lean for the side that happens to have it.` };
  }

  const differential = Number((p1Number - p2Number).toFixed(6));
  const advantageP1 = Number((spec.direction === "HIGHER_IS_BETTER" ? differential : -differential).toFixed(6));
  const favours: ComparisonFavours = Math.abs(differential) <= spec.materiality ? "NEUTRAL" : advantageP1 > 0 ? "P1" : "P2";
  return {
    ...base,
    p1_number: p1Number,
    p2_number: p2Number,
    differential,
    advantage_p1: advantageP1,
    status: "COMPARED",
    favours,
    reason: favours === "NEUTRAL"
      ? `P1 ${p1Number} vs P2 ${p2Number} (${spec.label}); |difference| ${Math.abs(differential)} is within the ${spec.materiality} materiality threshold, so neither side is credited.`
      : `P1 ${p1Number} vs P2 ${p2Number} (${spec.label}, ${spec.direction}); favours ${favours}.`,
  };
}

export function compareMetricRows(rows: MetricRowForComparison[]): MetricComparison[] {
  return rows.map(compareMetricRow);
}
