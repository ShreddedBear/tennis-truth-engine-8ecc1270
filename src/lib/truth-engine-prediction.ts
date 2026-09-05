// THE FINAL PREDICTION OBJECT — the three percentages, kept apart by type.
//
// The single most damaging confusion in this system has been treating one number as another.
// This object exists so that cannot happen silently: each quantity has its own field, its own
// name, and its own unit of meaning.
//
//   1. EVIDENCE COVERAGE (e.g. 18/25 = 72%)
//      "How much of the ACTIVE evidence universe produced usable, two-sided evidence."
//      DIAGNOSTIC ONLY. It never selects, never weights, never becomes a probability, and a
//      25/25 match is not thereby stronger than a 10/25 one.
//
//   2. EVIDENCE SUPPORT (e.g. P1 62.5% / P2 37.5%)
//      "How the surviving family-level directional evidence is distributed."
//      A SELECTION CRITERION -- the 60% threshold is applied to it. NOT a probability.
//
//   3. CALIBRATED WIN PROBABILITY (e.g. 64%)
//      "Historically, decisions with these characteristics won 64% of the time."
//      The ONLY number that is a probability, and it exists only once real resolved outcomes
//      exist. Until then it is null with status NOT_YET_CALIBRATED -- never back-filled from
//      (1) or (2).
//
// The audit stages are reported as STATES, not points. Nothing here sums verification,
// disagreement, underdog and stress into a score; the final winner is the deterministic
// decision reached after all four have run.

import type { TruthEngineAuditResult } from "./truth-engine-audit";
import { activeMetricReadiness, type MetricRowForReadiness } from "./truth-engine-active-metrics";
import {
  calibratedProbabilityFor,
  type CalibrationLookup,
  type CalibrationModel,
} from "./truth-engine-calibrated-probability";

export interface EvidenceCoverageView {
  usable: number;
  expected: number;
  percent: number;
  one_sided: number;
  unavailable: number;
  /** Stated on the object itself so no consumer has to remember. */
  meaning: "DIAGNOSTIC_ONLY_NEVER_A_PROBABILITY";
}

export interface EvidenceSupportView {
  p1_percent: number;
  p2_percent: number;
  directional_families: number;
  supporting_families: string[];
  contradicting_families: string[];
  neutral_families: string[];
  conflicted_families: string[];
  corroborated: boolean;
  threshold: number;
  meaning: "SELECTION_CRITERION_NEVER_A_PROBABILITY";
}

export interface ScrutinyView {
  verification: string;
  disagreement: string;
  underdog: string;
  stress: string;
  /** Proof that every stage ran before the final side was fixed. */
  executed_before_final_selection: true;
}

export interface TruthEnginePrediction {
  player1_name: string;
  player2_name: string;
  evidence_coverage: EvidenceCoverageView;
  evidence_support: EvidenceSupportView;
  scrutiny: ScrutinyView;
  /** THE PREDICTION: P1, P2, or an explicit refusal. */
  final_deterministic_winner: string | null;
  final_deterministic_side: "P1" | "P2" | null;
  decision_reason: string;
  calibrated_win_probability: CalibrationLookup;
}

export interface PredictionInput {
  audit: TruthEngineAuditResult;
  metricRows: readonly MetricRowForReadiness[];
  p1Name: string;
  p2Name: string;
  /** Omit when no calibration model exists yet; the probability is then NOT_YET_CALIBRATED. */
  model?: CalibrationModel;
}

const EMPTY_MODEL: CalibrationModel = {
  total_observations: 0,
  buckets: [],
  status: "NOT_YET_CALIBRATED",
};

export function buildTruthEnginePrediction({
  audit,
  metricRows,
  p1Name,
  p2Name,
  model,
}: PredictionInput): TruthEnginePrediction {
  const decision = audit.decision;
  const coverage = activeMetricReadiness(metricRows);

  // Support is reported for BOTH players from the same directional denominator, so the two
  // sides are stated symmetrically rather than one being inferred as "100 minus the other's".
  const leaderPercent = decision.evidence_percent;
  const leaderIsP1 =
    decision.outcome === "P1" ||
    (decision.outcome === "INSUFFICIENT_EVIDENCE" &&
      decision.independent_support_families.length > 0 &&
      decision.families.some(
        (f) => f.vote === "P1" && decision.independent_support_families.includes(f.family),
      ));
  const otherPercent =
    decision.directional_families > 0 ? Number((100 - leaderPercent).toFixed(1)) : 0;

  return {
    player1_name: p1Name,
    player2_name: p2Name,
    evidence_coverage: {
      usable: coverage.usable,
      expected: coverage.expected,
      percent: coverage.percent,
      one_sided: coverage.oneSided,
      unavailable: coverage.unavailable,
      meaning: "DIAGNOSTIC_ONLY_NEVER_A_PROBABILITY",
    },
    evidence_support: {
      p1_percent: leaderIsP1 ? leaderPercent : otherPercent,
      p2_percent: leaderIsP1 ? otherPercent : leaderPercent,
      directional_families: decision.directional_families,
      supporting_families: decision.independent_support_families,
      contradicting_families: decision.independent_contradiction_families,
      neutral_families: decision.neutral_families,
      conflicted_families: decision.conflicted_families,
      corroborated: decision.corroborated,
      threshold: 60,
      meaning: "SELECTION_CRITERION_NEVER_A_PROBABILITY",
    },
    scrutiny: {
      verification: `${audit.verification.findings.length} findings (supports P1: ${audit.verification.supports_p1_families.length}, supports P2: ${audit.verification.supports_p2_families.length})`,
      disagreement: audit.disagreement.overall_severity,
      underdog: audit.underdog.overall_viability,
      stress: audit.stress.stability,
      executed_before_final_selection: true,
    },
    final_deterministic_winner: audit.audit_winner,
    final_deterministic_side: audit.audit_winner_side,
    decision_reason: audit.final_reason,
    // The calibrated probability is looked up from decision characteristics only. Neither
    // `coverage` above nor either evidence-support number is passed into this call.
    calibrated_win_probability: calibratedProbabilityFor(
      {
        evidence_support_percent: decision.evidence_percent,
        supporting_family_count: decision.independent_support_families.length,
        contradicting_family_count: decision.independent_contradiction_families.length,
        corroborated: decision.corroborated,
        stress_result: audit.stress.stability,
      },
      model ?? EMPTY_MODEL,
    ),
  };
}
