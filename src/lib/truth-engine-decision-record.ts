import type { TruthEngineAuditResult } from "./truth-engine-audit";
import { activeMetricReadiness, type MetricRowForReadiness } from "./truth-engine-active-metrics";

// THE DECISION RECORD — structured features of one finished Truth Engine decision.
//
// Purpose, and its limit: this captures WHAT the engine decided and WHAT the evidence
// looked like when it decided, so that a future calibration layer can learn — from real
// match outcomes — how often decisions with a given shape actually win. It deliberately
// assigns NO weights and computes NO probability. Nothing here converts an audit result
// into a number of points, and evidence_support_percent is never a win probability.
//
// The forensic review that motivated this found the four concepts already correctly
// separated in code (coverage never reaches bucketFor; the two bucketFor call sites both
// take the Matrix WP), but the decision->outcome dataset did not exist at all:
// calibration_ledger held 0 rows, matches.actual_winner was 0 of 55, and the decision's own
// features (evidence share, families, stress) were never persisted -- they survived only as
// prose inside a rationale string. Without them a resolved observation cannot be
// reconstructed, so no calibration could ever be honest about what it had learned from.
//
// The four quantities stay explicitly separate here, and the field names say so:
//   evidence_coverage_*      -> DIAGNOSTIC. How much evidence was usable. Never a probability.
//   evidence_support_percent -> SELECTION FEATURE. How the surviving evidence is distributed.
//   selected_player          -> THE PREDICTION.
//   actual_winner            -> THE CALIBRATION TARGET (filled in later, when known).

export interface DecisionFamilyRecord {
  family: string;
  vote: string;
  /** Metric codes inside this family, preserved so family structure is auditable later. */
  supporting_metrics: string[];
  opposing_metrics: string[];
  neutral_metrics: string[];
}

export interface TruthEngineDecisionRecord {
  schema_version: 1;
  recorded_at: string;

  /** THE PREDICTION. */
  outcome: string;
  selected_player: string | null;

  /** SELECTION FEATURES -- inputs to the decision, not probabilities. */
  evidence_support_percent: number;
  directional_families: number;
  corroborated: boolean;
  stability: string;
  supporting_families: string[];
  contradicting_families: string[];
  neutral_families: string[];
  conflicted_families: string[];
  /** Same-family agreement that was deliberately NOT counted again. */
  duplicated_support_metrics: string[];
  families: DecisionFamilyRecord[];

  /** AUDIT-LAYER FEATURES, recorded as states -- never scored, never summed. */
  verification_findings: number;
  disagreement_severity: string;
  underdog_viability: string;
  underdog_player: string | null;
  stress_stability: string;
  stress_changed: boolean;

  /** DIAGNOSTIC ONLY. Present so it can be analysed, never so it can be predicted from. */
  evidence_coverage_usable: number;
  evidence_coverage_expected: number;
  evidence_coverage_percent: number;
  evidence_coverage_one_sided: number;
  evidence_coverage_unavailable: number;

  /**
   * THE CALIBRATION TARGET. Null until the real result is known. A record with a null
   * actual_winner is an OPEN observation and must never be counted as a resolved one.
   */
  actual_winner: string | null;
  /** Whether the engine's selection matched the result. Null while unresolved. */
  decision_correct: boolean | null;
}

export interface DecisionRecordInput {
  audit: TruthEngineAuditResult;
  metricRows: readonly MetricRowForReadiness[];
  now?: Date;
  /** Supplied only when the match has actually been played and graded. */
  actualWinner?: string | null;
}

/**
 * Assemble the record. Pure: no DB, no network, no clock beyond the injected `now`.
 *
 * Recording an outcome does not grade it here — `decision_correct` is a plain comparison of
 * two names, and stays null whenever either side is unknown, so an unresolved match can
 * never be silently scored as a loss.
 */
export function buildDecisionRecord({ audit, metricRows, now, actualWinner }: DecisionRecordInput): TruthEngineDecisionRecord {
  const decision = audit.decision;
  const coverage = activeMetricReadiness(metricRows);
  const selected = decision.selected_player;
  const resolved = Boolean(selected) && Boolean(actualWinner);

  return {
    schema_version: 1,
    recorded_at: (now ?? new Date()).toISOString(),

    outcome: decision.outcome,
    selected_player: selected,

    evidence_support_percent: decision.evidence_percent,
    directional_families: decision.directional_families,
    corroborated: decision.corroborated,
    stability: decision.stability,
    supporting_families: decision.independent_support_families,
    contradicting_families: decision.independent_contradiction_families,
    neutral_families: decision.neutral_families,
    conflicted_families: decision.conflicted_families,
    duplicated_support_metrics: decision.duplicated_support_metrics,
    families: decision.families.map((family) => ({
      family: family.family,
      vote: family.vote,
      supporting_metrics: family.supporting_metrics,
      opposing_metrics: family.opposing_metrics,
      neutral_metrics: family.neutral_metrics,
    })),

    verification_findings: audit.verification.findings.length,
    disagreement_severity: audit.disagreement.overall_severity,
    underdog_viability: audit.underdog.overall_viability,
    underdog_player: audit.underdog.underdog_player,
    stress_stability: audit.stress.stability,
    stress_changed: audit.stress.changed,

    evidence_coverage_usable: coverage.usable,
    evidence_coverage_expected: coverage.expected,
    evidence_coverage_percent: coverage.percent,
    evidence_coverage_one_sided: coverage.oneSided,
    evidence_coverage_unavailable: coverage.unavailable,

    actual_winner: actualWinner ?? null,
    decision_correct: resolved ? namesMatch(selected!, actualWinner!) : null,
  };
}

/** Lenient enough for "Bueno" vs "Gonzalo Bueno", strict enough not to match two players. */
function namesMatch(a: string, b: string) {
  const norm = (v: string) => v.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const [x, y] = [norm(a), norm(b)];
  if (!x || !y) return false;
  if (x === y) return true;
  const [xt, yt] = [x.split(" "), y.split(" ")];
  // Surnames must agree; a shared given name alone is never enough.
  return xt[xt.length - 1] === yt[yt.length - 1];
}

/**
 * A record is a usable calibration observation only when the engine actually made a
 * prediction AND the real result is known. Everything else is an open record.
 */
export function isResolvedObservation(record: TruthEngineDecisionRecord) {
  return record.selected_player !== null && record.actual_winner !== null && record.decision_correct !== null;
}
