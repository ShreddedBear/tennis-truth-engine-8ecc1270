// CALIBRATION OBSERVATIONS — turning a resolved Truth Engine decision into the one row a
// calibration layer is allowed to learn from.
//
// The learning direction, and the only one this file will assemble:
//
//     FINAL DECISION CHARACTERISTICS  ->  ACTUAL MATCH WINNER
//
// Three things are therefore NOT the input, and cannot be, because nothing here reads them
// as such:
//
//   * "25 metrics completed -> result". evidence_coverage_percent is carried on the
//     observation as a DIAGNOSTIC field. It is never a feature the probability layer may
//     key on (truth-engine-calibrated-probability.ts takes a feature key that has no
//     coverage component), and a 25/25 match and a 10/25 match with identical decision
//     characteristics land in the same bucket.
//   * "evidence support -> assumed probability". evidence_support_percent is a FEATURE of
//     the decision here, exactly like stress_result. 62.5% support is not 62.5% win
//     probability; what 62.5%-support decisions are actually worth is the thing the
//     historical population has to answer.
//   * Matrix AI's WP. It is not read, not copied and not blended. The Matrix population
//     (calibration_ledger / calibration_buckets, keyed on matrix_wp) stays separate.
//
// Pure: no DB, no clock beyond what is passed in. The Supabase wiring is in
// calibration-observations.server.ts.

import {
  provenPreMatch,
  selectCalibrationPopulation,
  type CalibrationCandidate,
} from "./calibration-population";
import { resolvePredictionOutcome, type MatchResultFacts } from "./match-result-resolution";
import type { TruthEngineDecisionRecord } from "./truth-engine-decision-record";

export interface ObservationSourceRun {
  match_id: string;
  audit_run_id: string;
  run_number: number;
  /** audit_runs.independent_decision_committed_at -- when the deterministic winner was fixed. */
  independent_decision_committed_at: string | null;
  /** The persisted decision record from final_decisions.gate_report.deterministic_decision. */
  decision: Partial<TruthEngineDecisionRecord> | null;
  /** audit_runs.independent_winner, for runs that predate the decision record. */
  independent_winner: string | null;
}

export interface ObservationSourceMatch extends MatchResultFacts {
  id: string;
  slate_id?: string | null;
  scheduled_date: string | null;
  final_score?: string | null;
}

export interface CalibrationObservation {
  match_id: string;
  audit_run_id: string;
  slate_id: string | null;
  run_number: number;
  predicted_at: string | null;
  scheduled_date: string | null;
  player1_name: string;
  player2_name: string;

  selected_player: string;
  decision_outcome: string;

  evidence_support_percent: number | null;
  directional_families: number | null;
  supporting_families: string[];
  contradicting_families: string[];
  neutral_families: string[];
  conflicted_families: string[];
  supporting_family_count: number;
  contradicting_family_count: number;
  corroborated: boolean | null;
  stability: string | null;
  verification_result: string | null;
  disagreement_result: string | null;
  underdog_result: string | null;
  stress_result: string | null;

  evidence_coverage_percent: number | null;
  evidence_coverage_usable: number | null;
  evidence_coverage_expected: number | null;

  actual_winner: string;
  result_status: string | null;
  final_score: string | null;
  prediction_outcome: "WIN" | "LOSS";

  calibration_eligible: boolean;
  eligibility_reason: string | null;
}

export interface ObservationBuildResult {
  observations: CalibrationObservation[];
  /** Runs that produced no observation, each with the reason. Nothing is dropped silently. */
  skipped: Array<{ match_id: string; audit_run_id: string; reason: string }>;
}

function selectedPlayerOf(run: ObservationSourceRun): string | null {
  if (run.decision && "selected_player" in run.decision) {
    const selected = run.decision.selected_player;
    return typeof selected === "string" && selected.trim() ? selected.trim() : null;
  }
  return String(run.independent_winner ?? "").trim() || null;
}

/**
 * Build the observation set for a slate of decided runs and their matches.
 *
 * Nothing is invented at any step:
 *   * A run with no selected player is not an observation -- there is no prediction to grade.
 *   * A match with no FINAL result (or an ambiguous winner) is not an observation. A missing
 *     winner NEVER becomes a LOSS; resolvePredictionOutcome is the only grader and it returns
 *     UNRESOLVED for every unknown.
 *   * Pre-match eligibility is decided by provenPreMatch (commit date strictly earlier than
 *     the match's calendar date). A hindsight rerun is still STORED -- the prediction history
 *     stays complete -- but with calibration_eligible false and the reason on the row, so it
 *     can never reach the learning population.
 *   * Of the eligible runs for one match, exactly one wins (the latest), so a match audited
 *     seven times carries the weight of one match.
 */
export function buildCalibrationObservations(
  runs: readonly ObservationSourceRun[],
  matches: readonly ObservationSourceMatch[],
): ObservationBuildResult {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const observations: CalibrationObservation[] = [];
  const skipped: ObservationBuildResult["skipped"] = [];
  const candidates: CalibrationCandidate[] = [];
  const draft = new Map<string, CalibrationObservation>();

  for (const run of runs) {
    const match = byId.get(run.match_id);
    if (!match) {
      skipped.push({
        match_id: run.match_id,
        audit_run_id: run.audit_run_id,
        reason: "MATCH_NOT_FOUND",
      });
      continue;
    }
    const selected = selectedPlayerOf(run);
    if (!selected) {
      skipped.push({
        match_id: run.match_id,
        audit_run_id: run.audit_run_id,
        reason: "NO_SELECTED_PLAYER",
      });
      continue;
    }
    const resolution = resolvePredictionOutcome(selected, match);
    if (!resolution.resolved) {
      skipped.push({
        match_id: run.match_id,
        audit_run_id: run.audit_run_id,
        reason: resolution.reason ?? "UNRESOLVED",
      });
      continue;
    }

    const d = run.decision ?? {};
    const supporting = d.supporting_families ?? [];
    const contradicting = d.contradicting_families ?? [];
    draft.set(run.audit_run_id, {
      match_id: match.id,
      audit_run_id: run.audit_run_id,
      slate_id: match.slate_id ?? null,
      run_number: run.run_number,
      predicted_at: run.independent_decision_committed_at,
      scheduled_date: match.scheduled_date,
      player1_name: match.player1_name,
      player2_name: match.player2_name,

      selected_player: selected,
      decision_outcome: String(d.outcome ?? resolution.selected_side ?? ""),

      evidence_support_percent: d.evidence_support_percent ?? null,
      directional_families: d.directional_families ?? null,
      supporting_families: supporting,
      contradicting_families: contradicting,
      neutral_families: d.neutral_families ?? [],
      conflicted_families: d.conflicted_families ?? [],
      supporting_family_count: supporting.length,
      contradicting_family_count: contradicting.length,
      corroborated: d.corroborated ?? null,
      stability: d.stability ?? null,
      // Recorded as STATES. No stage is converted into points, and no stage's state is
      // added to, subtracted from or weighted against any other.
      verification_result:
        d.verification_findings === undefined ? null : `${d.verification_findings} findings`,
      disagreement_result: d.disagreement_severity ?? null,
      underdog_result: d.underdog_viability ?? null,
      stress_result: d.stress_stability ?? null,

      evidence_coverage_percent: d.evidence_coverage_percent ?? null,
      evidence_coverage_usable: d.evidence_coverage_usable ?? null,
      evidence_coverage_expected: d.evidence_coverage_expected ?? null,

      actual_winner: String(match.actual_winner ?? "").trim(),
      result_status: match.result_status ?? null,
      final_score: match.final_score ?? null,
      prediction_outcome: resolution.status === "WIN" ? "WIN" : "LOSS",

      calibration_eligible: false,
      eligibility_reason: null,
    });
    candidates.push({
      match_id: match.id,
      audit_run_id: run.audit_run_id,
      run_number: run.run_number,
      independent_decision_committed_at: run.independent_decision_committed_at,
      scheduled_date: match.scheduled_date,
      resolution_status: resolution.status === "WIN" ? "WIN" : "LOSS",
    });
  }

  // Governance: one calibration-eligible observation per match, and only a provably
  // pre-match decision. Reuses the existing selector rather than re-deriving the rule.
  const { population, excluded } = selectCalibrationPopulation(candidates);
  const eligible = new Set(population.map((c) => c.audit_run_id));
  const reasons = new Map(excluded.map((e) => [e.audit_run_id, e.reason]));

  for (const observation of draft.values()) {
    observation.calibration_eligible = eligible.has(observation.audit_run_id);
    observation.eligibility_reason = observation.calibration_eligible
      ? provenPreMatch(observation.predicted_at, observation.scheduled_date).reason
      : (reasons.get(observation.audit_run_id) ?? "NOT_SELECTED_FOR_CALIBRATION");
    observations.push(observation);
  }

  return { observations, skipped };
}

export interface ObservationSummary {
  runs_inspected: number;
  observations_built: number;
  calibration_eligible: number;
  wins: number;
  losses: number;
  skipped_by_reason: Record<string, number>;
  ineligible_by_reason: Record<string, number>;
}

export function summarizeObservations(
  runsInspected: number,
  result: ObservationBuildResult,
): ObservationSummary {
  const skipped_by_reason: Record<string, number> = {};
  for (const s of result.skipped)
    skipped_by_reason[s.reason] = (skipped_by_reason[s.reason] ?? 0) + 1;
  const ineligible_by_reason: Record<string, number> = {};
  for (const o of result.observations) {
    if (o.calibration_eligible) continue;
    const reason = o.eligibility_reason ?? "UNKNOWN";
    ineligible_by_reason[reason] = (ineligible_by_reason[reason] ?? 0) + 1;
  }
  return {
    runs_inspected: runsInspected,
    observations_built: result.observations.length,
    calibration_eligible: result.observations.filter((o) => o.calibration_eligible).length,
    wins: result.observations.filter((o) => o.prediction_outcome === "WIN").length,
    losses: result.observations.filter((o) => o.prediction_outcome === "LOSS").length,
    skipped_by_reason,
    ineligible_by_reason,
  };
}
