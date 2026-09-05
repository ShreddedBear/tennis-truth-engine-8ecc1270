// LIVE WIRING for the Truth Engine calibration population.
//
// Reads the real decision history (final_decisions.gate_report -> audit_runs -> matches),
// builds the resolved observations, and persists them to
// truth_engine_calibration_observations -- the dataset the calibrated-probability layer
// learns from, and the only one it may learn from.
//
// It does not touch calibration_ledger, calibration_versions or calibration_buckets: those
// are the SEPARATE Matrix WP population, and mixing the two is exactly the confusion this
// work exists to end.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LOCAL_WORKSPACE_ID } from "./constants";
import {
  buildCalibrationObservations,
  summarizeObservations,
  type CalibrationObservation,
  type ObservationSourceMatch,
  type ObservationSourceRun,
  type ObservationSummary,
} from "./calibration-observations";
import { readDecisionRecord } from "./truth-engine-decision-record";
import {
  buildCalibrationModel,
  type CalibrationModel,
  type ResolvedObservation,
} from "./truth-engine-calibrated-probability";

export interface ObservationPopulationReport {
  summary: ObservationSummary;
  written: number;
  observations: CalibrationObservation[];
}

async function readDecidedRuns(db: typeof supabaseAdmin): Promise<ObservationSourceRun[]> {
  const { data: decisions, error: decisionError } = await db
    .from("final_decisions")
    .select("audit_run_id, gate_report");
  if (decisionError)
    throw new Error(`Database read failed (final_decisions): ${decisionError.message}`);
  const byRun = new Map(
    (decisions ?? []).map((row) => [String(row.audit_run_id), row.gate_report]),
  );
  const ids = [...byRun.keys()].filter(Boolean);
  if (!ids.length) return [];

  const runs: ObservationSourceRun[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from("audit_runs")
      .select("id, match_id, run_number, independent_winner, independent_decision_committed_at")
      .in("id", ids.slice(i, i + 200));
    if (error) throw new Error(`Database read failed (audit_runs): ${error.message}`);
    for (const row of data ?? []) {
      runs.push({
        match_id: String(row.match_id),
        audit_run_id: String(row.id),
        run_number: Number(row.run_number ?? 0),
        independent_decision_committed_at: row.independent_decision_committed_at ?? null,
        decision: readDecisionRecord(byRun.get(String(row.id))),
        independent_winner: row.independent_winner ?? null,
      });
    }
  }
  return runs;
}

async function readMatches(
  db: typeof supabaseAdmin,
  matchIds: string[],
): Promise<ObservationSourceMatch[]> {
  const out: ObservationSourceMatch[] = [];
  for (let i = 0; i < matchIds.length; i += 200) {
    const { data, error } = await db
      .from("matches")
      .select(
        "id, slate_id, player1_name, player2_name, scheduled_date, actual_winner, result_status, final_score",
      )
      .in("id", matchIds.slice(i, i + 200));
    if (error) throw new Error(`Database read failed (matches): ${error.message}`);
    for (const row of data ?? []) {
      out.push({
        id: String(row.id),
        slate_id: row.slate_id ?? null,
        player1_name: row.player1_name,
        player2_name: row.player2_name,
        scheduled_date: row.scheduled_date ?? null,
        actual_winner: row.actual_winner ?? null,
        result_status: row.result_status ?? null,
        final_score: row.final_score ?? null,
      });
    }
  }
  return out;
}

/**
 * Rebuild the observation table from the current decision history.
 *
 * Idempotent: one row per audit_run_id, upserted. A rerun that later becomes ineligible (or
 * a match whose result is corrected) is re-derived rather than accumulating duplicates.
 */
export async function populateCalibrationObservations(
  db = supabaseAdmin,
): Promise<ObservationPopulationReport> {
  const runs = await readDecidedRuns(db);
  const matches = await readMatches(db, [...new Set(runs.map((r) => r.match_id))]);
  const result = buildCalibrationObservations(runs, matches);
  const summary = summarizeObservations(runs.length, result);

  let written = 0;
  if (result.observations.length) {
    // Eligibility is unique per match; clear the previous generation for these matches first
    // so a newly-eligible run cannot collide with a stale one under
    // te_calibration_obs_eligible_match_unique.
    const matchIds = [...new Set(result.observations.map((o) => o.match_id))];
    for (let i = 0; i < matchIds.length; i += 200) {
      const { error } = await db
        .from("truth_engine_calibration_observations")
        .delete()
        .in("match_id", matchIds.slice(i, i + 200));
      if (error)
        throw new Error(
          `Database delete failed (truth_engine_calibration_observations): ${error.message}`,
        );
    }
    for (let i = 0; i < result.observations.length; i += 200) {
      const rows = result.observations
        .slice(i, i + 200)
        .map((o) => ({ ...o, user_id: LOCAL_WORKSPACE_ID }));
      const { error } = await db
        .from("truth_engine_calibration_observations")
        .insert(rows as never);
      if (error)
        throw new Error(
          `Database insert failed (truth_engine_calibration_observations): ${error.message}`,
        );
      written += rows.length;
    }
  }

  return { summary, written, observations: result.observations };
}

/**
 * The learned model, from the CALIBRATION-ELIGIBLE observations only.
 *
 * With none stored the model is empty and every lookup answers NOT_YET_CALIBRATED. That is
 * the correct live answer today (0 matches carry a final result), and it is reported as such
 * rather than substituted with the Matrix WP baseline or the evidence-support number.
 */
export async function loadCalibrationModel(db = supabaseAdmin): Promise<CalibrationModel> {
  const { data, error } = await db
    .from("truth_engine_calibration_observations")
    .select(
      "evidence_support_percent, supporting_family_count, contradicting_family_count, corroborated, stress_result, disagreement_result, underdog_result, prediction_outcome",
    )
    .eq("calibration_eligible", true);
  if (error)
    throw new Error(
      `Database read failed (truth_engine_calibration_observations): ${error.message}`,
    );
  const observations: ResolvedObservation[] = (data ?? []).map((row) => ({
    evidence_support_percent:
      row.evidence_support_percent === null ? null : Number(row.evidence_support_percent),
    supporting_family_count: Number(row.supporting_family_count ?? 0),
    contradicting_family_count: Number(row.contradicting_family_count ?? 0),
    corroborated: row.corroborated,
    stress_result: row.stress_result,
    disagreement_result: row.disagreement_result,
    underdog_result: row.underdog_result,
    prediction_outcome: row.prediction_outcome === "WIN" ? "WIN" : "LOSS",
  }));
  return buildCalibrationModel(observations);
}
