// The match workspace's reads and edits. SERVER ONLY.
//
// This screen was the browser's largest read surface -- nineteen queries across thirteen
// tables -- plus two write paths: editing persisted audit evidence, and setting the match
// identity/surface verification status. All of it ran with the publishable key.
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db/client.server";
import {
  auditCoverageTable, auditRunsTable, auditStageRunsTable, calibrationBucketsTable,
  calibrationVersionsTable, disagreementResultsTable, finalDecisionsTable, matchesTable,
  metricCoverageRatesTable, metricResultsTable, parsedSummaryFieldsTable,
  reconstructionResultsTable, sourceConflictsTable, stressResultsTable, summaryVersionsTable,
  underdogResultsTable, verificationResultsTable,
} from "@/db/schema";
import { resolveActiveRun } from "./audit-stages";
import { log } from "./audit-runs.server";

/** The five result tables the workspace may edit. Anything else is refused. */
export const EDITABLE_AUDIT_TABLES = [
  "metric_results", "verification_results", "disagreement_results",
  "underdog_results", "stress_results",
] as const;
export type EditableAuditTable = (typeof EDITABLE_AUDIT_TABLES)[number];

const EDITABLE = {
  metric_results: metricResultsTable,
  verification_results: verificationResultsTable,
  disagreement_results: disagreementResultsTable,
  underdog_results: underdogResultsTable,
  stress_results: stressResultsTable,
} as const;

/** The two match columns the workspace may set, and the values they accept. */
export const IDENTITY_FIELDS = ["identity_status", "surface_status"] as const;
export const IDENTITY_VALUES = ["UNVERIFIED", "VERIFIED", "CONFLICT"] as const;
export type IdentityField = (typeof IDENTITY_FIELDS)[number];

export async function loadMatchWorkspace(matchId: string) {
  let match;
  try {
    [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
  } catch (error) {
    throw new Error(`Could not load match: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!match) throw new Error(`Could not load match: no match with id ${matchId}`);

  let runs;
  try {
    runs = await db.select().from(auditRunsTable)
      .where(eq(auditRunsTable.match_id, matchId))
      .orderBy(desc(auditRunsTable.run_number));
  } catch (error) {
    throw new Error(`Could not load audit runs: ${error instanceof Error ? error.message : String(error)}`);
  }

  // resolveActiveRun resolves straight through an INVALIDATED run (Clear Slate, or a
  // rule-version change) to null, so the screen shows a true zero-state rather than a dead
  // run's stale diagnostics.
  const run = resolveActiveRun(runs);
  const wasInvalidated = !run && runs.length > 0;
  if (!run) return { match, run: null, wasInvalidated };

  const byRun = eq;
  const [
    metrics, verification, disagreement, underdog, stress, conflicts, reconstructions,
    decisionRows, coverage, coverageRates, buckets, versionRows, activeSummaryVersion,
  ] = await Promise.all([
    db.select().from(metricResultsTable).where(byRun(metricResultsTable.audit_run_id, run.id)).orderBy(asc(metricResultsTable.metric_code)),
    db.select().from(verificationResultsTable).where(byRun(verificationResultsTable.audit_run_id, run.id)).orderBy(asc(verificationResultsTable.rule_code)),
    db.select().from(disagreementResultsTable).where(byRun(disagreementResultsTable.audit_run_id, run.id)).orderBy(asc(disagreementResultsTable.rule_code)),
    db.select().from(underdogResultsTable).where(byRun(underdogResultsTable.audit_run_id, run.id)).orderBy(asc(underdogResultsTable.pathway_code)),
    db.select().from(stressResultsTable).where(byRun(stressResultsTable.audit_run_id, run.id)).orderBy(asc(stressResultsTable.test_code)),
    db.select().from(sourceConflictsTable).where(byRun(sourceConflictsTable.audit_run_id, run.id)),
    db.select().from(reconstructionResultsTable).where(byRun(reconstructionResultsTable.audit_run_id, run.id)),
    db.select().from(finalDecisionsTable).where(byRun(finalDecisionsTable.audit_run_id, run.id)).limit(1),
    db.select().from(auditCoverageTable).where(byRun(auditCoverageTable.audit_run_id, run.id)).orderBy(asc(auditCoverageTable.player_side)),
    db.select().from(metricCoverageRatesTable).where(byRun(metricCoverageRatesTable.audit_run_id, run.id)),
    db.select().from(calibrationBucketsTable).orderBy(asc(calibrationBucketsTable.wp_min)),
    // The run's own calibration version when it recorded one, otherwise whichever is
    // currently active -- the run's recorded version is what its decision was graded
    // against, so it must win.
    run.calibration_version_id
      ? db.select().from(calibrationVersionsTable).where(eq(calibrationVersionsTable.id, run.calibration_version_id)).limit(1)
      : db.select().from(calibrationVersionsTable).where(eq(calibrationVersionsTable.is_active, true)).limit(1),
    db.select({ id: summaryVersionsTable.id }).from(summaryVersionsTable)
      .where(and(eq(summaryVersionsTable.match_id, matchId), eq(summaryVersionsTable.is_active, true))).limit(1),
  ]);

  const summaryVersionId = activeSummaryVersion[0]?.id ?? null;
  const fields = summaryVersionId
    ? await db.select().from(parsedSummaryFieldsTable).where(eq(parsedSummaryFieldsTable.summary_version_id, summaryVersionId))
    : [];
  const version = versionRows[0] ?? null;

  return {
    match, run, wasInvalidated: false,
    metrics, verification, disagreement, underdog, stress, conflicts, reconstructions,
    decision: decisionRows[0] ?? null,
    coverage, coverageRates,
    buckets: buckets.filter((b) => b.calibration_version_id === version?.id),
    version,
    fields,
  };
}

/**
 * Stage rows for ONE run. Scoped by run id, never by match id: audit_stage_runs keeps a
 * full set of stage rows per run_number, so filtering by match would mix a prior run's
 * stale COMPLETE rows into the current run's in-progress ones.
 */
export async function loadStageRows(runId: string) {
  return db.select().from(auditStageRunsTable)
    .where(eq(auditStageRunsTable.audit_run_id, runId))
    .orderBy(asc(auditStageRunsTable.stage_order));
}

/**
 * Edits one persisted audit row.
 *
 * The "cannot edit while RUNNING or after COMPLETE" rule was a client-side check only. It
 * is enforced here as well now -- the browser keeps its check so the UI still explains
 * itself, but the rule is no longer something a caller can simply skip.
 */
export async function patchAuditRow(
  table: EditableAuditTable, id: string, values: Record<string, unknown>,
  context: { runId: string; matchId: string; stage: string },
): Promise<void> {
  const [run] = await db.select({
    id: auditRunsTable.id, status: auditRunsTable.status,
    matrix_revealed_at: auditRunsTable.matrix_revealed_at,
  }).from(auditRunsTable).where(eq(auditRunsTable.id, context.runId)).limit(1);
  if (!run) throw new Error("That audit run no longer exists.");
  if (run.status === "RUNNING" || run.status === "COMPLETE") {
    throw new Error("Persisted audit evidence cannot be edited while an audit is running or after its final decision is complete.");
  }

  const target = EDITABLE[table];
  try {
    await db.update(target).set(values as never).where(eq(target.id, id));
  } catch (error) {
    throw new Error(`Could not update ${table}: ${error instanceof Error ? error.message : String(error)}`);
  }

  await log({
    audit_run_id: context.runId, match_id: context.matchId, stage: context.stage,
    status: "COMPLETE", output: values, matrix_visible: Boolean(run.matrix_revealed_at),
  });
}

/** Sets identity_status or surface_status on a match and records the change. */
export async function setMatchIdentityField(
  matchId: string, field: IdentityField, value: string, runId: string | null,
): Promise<void> {
  await db.update(matchesTable).set({ [field]: value } as never).where(eq(matchesTable.id, matchId));
  await log({
    audit_run_id: runId, match_id: matchId,
    stage: "MATCH IDENTITY VERIFICATION", status: value,
  });
}
