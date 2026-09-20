// Live wiring for calibration population governance. Read-only: it reads result_grades,
// audit_runs and matches and reports the population selectCalibrationPopulation computes.
// It writes nothing -- no new table, no schema change. Calibrated probabilities are a later,
// separate job; this only establishes which observations are allowed to feed one.

import { resultCaptureMatches, resultCaptureState } from "./truth-server-api";
import {
  selectCalibrationPopulation, summarizeCalibrationPopulation,
  type CalibrationCandidate, type CalibrationPopulationResult, type CalibrationPopulationSummary,
} from "./calibration-population";
import { isResolvedGrade } from "./match-result-capture";

export interface CalibrationPopulationReport {
  summary: CalibrationPopulationSummary;
  population: CalibrationCandidate[];
  excluded: CalibrationPopulationResult["excluded"];
}

export async function buildCalibrationPopulationReport(): Promise<CalibrationPopulationReport> {
  const [{ grades, runs }, { matches }] = await Promise.all([
    resultCaptureState(),
    resultCaptureMatches(),
  ]);
  const runsById = new Map<string, { run_number: number; independent_decision_committed_at: string | null }>(
    runs.map((row: any) => [String(row.id), { run_number: Number(row.run_number), independent_decision_committed_at: row.independent_decision_committed_at ?? null }]),
  );
  const scheduledByMatch = new Map<string, string | null>(
    matches.map((row: any) => [String(row.id), row.scheduled_date ?? null]),
  );

  const candidates: CalibrationCandidate[] = grades.map((g: any) => {
    const run = runsById.get(String(g.audit_run_id));
    const status = String(g.final_selection_result ?? "");
    return {
      match_id: String(g.match_id),
      audit_run_id: String(g.audit_run_id),
      run_number: run?.run_number ?? 0,
      independent_decision_committed_at: run?.independent_decision_committed_at ?? null,
      scheduled_date: scheduledByMatch.get(String(g.match_id)) ?? null,
      resolution_status: isResolvedGrade(g as Record<string, unknown>) && (status === "WIN" || status === "LOSS") ? status : "UNRESOLVED",
    };
  });

  const result = selectCalibrationPopulation(candidates);
  return { summary: summarizeCalibrationPopulation(candidates, result), population: result.population, excluded: result.excluded };
}
