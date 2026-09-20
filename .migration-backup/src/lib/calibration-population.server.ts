// Live wiring for calibration population governance. Read-only: it reads result_grades,
// audit_runs and matches and reports the population selectCalibrationPopulation computes.
// It writes nothing -- no new table, no schema change. Calibrated probabilities are a later,
// separate job; this only establishes which observations are allowed to feed one.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
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

export async function buildCalibrationPopulationReport(db = supabaseAdmin): Promise<CalibrationPopulationReport> {
  const { data: grades, error: gradesError } = await db.from("result_grades").select("match_id, audit_run_id, final_selection_result, actual_winner");
  if (gradesError) throw new Error(`Database read failed (result_grades): ${gradesError.message}`);

  const runIds = [...new Set((grades ?? []).map((g) => String(g.audit_run_id)).filter(Boolean))];
  const matchIds = [...new Set((grades ?? []).map((g) => String(g.match_id)).filter(Boolean))];

  const runsById = new Map<string, { run_number: number; independent_decision_committed_at: string | null }>();
  for (let i = 0; i < runIds.length; i += 200) {
    const { data, error } = await db.from("audit_runs").select("id, run_number, independent_decision_committed_at").in("id", runIds.slice(i, i + 200));
    if (error) throw new Error(`Database read failed (audit_runs): ${error.message}`);
    for (const row of data ?? []) runsById.set(String(row.id), { run_number: Number(row.run_number), independent_decision_committed_at: row.independent_decision_committed_at });
  }

  const scheduledByMatch = new Map<string, string | null>();
  for (let i = 0; i < matchIds.length; i += 200) {
    const { data, error } = await db.from("matches").select("id, scheduled_date").in("id", matchIds.slice(i, i + 200));
    if (error) throw new Error(`Database read failed (matches): ${error.message}`);
    for (const row of data ?? []) scheduledByMatch.set(String(row.id), row.scheduled_date);
  }

  const candidates: CalibrationCandidate[] = (grades ?? []).map((g) => {
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
