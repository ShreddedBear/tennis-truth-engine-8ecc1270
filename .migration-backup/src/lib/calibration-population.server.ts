// Live wiring for calibration population governance. Read-only: it reads result_grades,
// audit_runs and matches and reports the population selectCalibrationPopulation computes.
// It writes nothing -- no new table, no schema change. Calibrated probabilities are a later,
// separate job; this only establishes which observations are allowed to feed one.

import { inArray } from "drizzle-orm";

import { db } from "@/db/client.server";
import { auditRunsTable, matchesTable, resultGradesTable } from "@/db/schema";
import { dbCall } from "@/db/query-errors";
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
  const grades = await dbCall("read", "result_grades", () => db.select({
    match_id: resultGradesTable.match_id,
    audit_run_id: resultGradesTable.audit_run_id,
    final_selection_result: resultGradesTable.final_selection_result,
    actual_winner: resultGradesTable.actual_winner,
  }).from(resultGradesTable));

  const runIds = [...new Set(grades.map((g) => String(g.audit_run_id)).filter(Boolean))];
  const matchIds = [...new Set(grades.map((g) => String(g.match_id)).filter(Boolean))];

  // Still chunked at 200. The old limit came from PostgREST's URL length, which no longer
  // applies, but the chunking also bounds the statement's parameter count and keeps the
  // query plan stable, so it stays.
  const runsById = new Map<string, { run_number: number; independent_decision_committed_at: string | null }>();
  for (let i = 0; i < runIds.length; i += 200) {
    const rows = await dbCall("read", "audit_runs", () => db.select({
      id: auditRunsTable.id,
      run_number: auditRunsTable.run_number,
      independent_decision_committed_at: auditRunsTable.independent_decision_committed_at,
    }).from(auditRunsTable).where(inArray(auditRunsTable.id, runIds.slice(i, i + 200))));
    for (const row of rows) runsById.set(String(row.id), { run_number: Number(row.run_number), independent_decision_committed_at: row.independent_decision_committed_at });
  }

  const scheduledByMatch = new Map<string, string | null>();
  for (let i = 0; i < matchIds.length; i += 200) {
    const rows = await dbCall("read", "matches", () => db.select({
      id: matchesTable.id, scheduled_date: matchesTable.scheduled_date,
    }).from(matchesTable).where(inArray(matchesTable.id, matchIds.slice(i, i + 200))));
    for (const row of rows) scheduledByMatch.set(String(row.id), row.scheduled_date);
  }

  const candidates: CalibrationCandidate[] = grades.map((g) => {
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
