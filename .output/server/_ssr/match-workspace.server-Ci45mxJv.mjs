import { s as resolveActiveRun } from "./audit-stages-Dphii188.mjs";
import { a as eq, i as and, n as asc, r as desc } from "../_libs/drizzle-orm.mjs";
import { t as db } from "./client.server-B14ewPcb.mjs";
import { g as verificationResultsTable, h as underdogResultsTable, i as disagreementResultsTable, m as stressResultsTable, p as reconstructionResultsTable } from "./analysis-y60jAvTu.mjs";
import { i as auditStageRunsTable, n as auditCoverageTable, r as auditRunsTable } from "./audit-ChUwSBsg.mjs";
import { r as calibrationVersionsTable, t as calibrationBucketsTable } from "./calibration-BTgOpQAP.mjs";
import { t as finalDecisionsTable } from "./decisions-D8mHqU7D.mjs";
import { s as matchesTable } from "./matches-CtYuxOLN.mjs";
import { s as metricCoverageRatesTable, u as metricResultsTable } from "./metrics-2UTgcTdn.mjs";
import { l as sourceConflictsTable } from "./sources-B3f820Qo.mjs";
import { a as parsedSummaryFieldsTable, c as summaryVersionsTable } from "./uploads-vW6NguTg.mjs";
import { t as log } from "./audit-runs.server-BHLIQ7ng.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/match-workspace.server-Ci45mxJv.js
var EDITABLE = {
	metric_results: metricResultsTable,
	verification_results: verificationResultsTable,
	disagreement_results: disagreementResultsTable,
	underdog_results: underdogResultsTable,
	stress_results: stressResultsTable
};
async function loadMatchWorkspace(matchId) {
	let match;
	try {
		[match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
	} catch (error) {
		throw new Error(`Could not load match: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!match) throw new Error(`Could not load match: no match with id ${matchId}`);
	let runs;
	try {
		runs = await db.select().from(auditRunsTable).where(eq(auditRunsTable.match_id, matchId)).orderBy(desc(auditRunsTable.run_number));
	} catch (error) {
		throw new Error(`Could not load audit runs: ${error instanceof Error ? error.message : String(error)}`);
	}
	const run = resolveActiveRun(runs);
	const wasInvalidated = !run && runs.length > 0;
	if (!run) return {
		match,
		run: null,
		wasInvalidated
	};
	const byRun = eq;
	const [metrics, verification, disagreement, underdog, stress, conflicts, reconstructions, decisionRows, coverage, coverageRates, buckets, versionRows, activeSummaryVersion] = await Promise.all([
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
		run.calibration_version_id ? db.select().from(calibrationVersionsTable).where(eq(calibrationVersionsTable.id, run.calibration_version_id)).limit(1) : db.select().from(calibrationVersionsTable).where(eq(calibrationVersionsTable.is_active, true)).limit(1),
		db.select({ id: summaryVersionsTable.id }).from(summaryVersionsTable).where(and(eq(summaryVersionsTable.match_id, matchId), eq(summaryVersionsTable.is_active, true))).limit(1)
	]);
	const summaryVersionId = activeSummaryVersion[0]?.id ?? null;
	const fields = summaryVersionId ? await db.select().from(parsedSummaryFieldsTable).where(eq(parsedSummaryFieldsTable.summary_version_id, summaryVersionId)) : [];
	const version = versionRows[0] ?? null;
	return {
		match,
		run,
		wasInvalidated: false,
		metrics,
		verification,
		disagreement,
		underdog,
		stress,
		conflicts,
		reconstructions,
		decision: decisionRows[0] ?? null,
		coverage,
		coverageRates,
		buckets: buckets.filter((b) => b.calibration_version_id === version?.id),
		version,
		fields
	};
}
/**
* Stage rows for ONE run. Scoped by run id, never by match id: audit_stage_runs keeps a
* full set of stage rows per run_number, so filtering by match would mix a prior run's
* stale COMPLETE rows into the current run's in-progress ones.
*/
async function loadStageRows(runId) {
	return db.select().from(auditStageRunsTable).where(eq(auditStageRunsTable.audit_run_id, runId)).orderBy(asc(auditStageRunsTable.stage_order));
}
/**
* Edits one persisted audit row.
*
* The "cannot edit while RUNNING or after COMPLETE" rule was a client-side check only. It
* is enforced here as well now -- the browser keeps its check so the UI still explains
* itself, but the rule is no longer something a caller can simply skip.
*/
async function patchAuditRow(table, id, values, context) {
	const [run] = await db.select({
		id: auditRunsTable.id,
		status: auditRunsTable.status,
		matrix_revealed_at: auditRunsTable.matrix_revealed_at
	}).from(auditRunsTable).where(eq(auditRunsTable.id, context.runId)).limit(1);
	if (!run) throw new Error("That audit run no longer exists.");
	if (run.status === "RUNNING" || run.status === "COMPLETE") throw new Error("Persisted audit evidence cannot be edited while an audit is running or after its final decision is complete.");
	const target = EDITABLE[table];
	try {
		await db.update(target).set(values).where(eq(target.id, id));
	} catch (error) {
		throw new Error(`Could not update ${table}: ${error instanceof Error ? error.message : String(error)}`);
	}
	await log({
		audit_run_id: context.runId,
		match_id: context.matchId,
		stage: context.stage,
		status: "COMPLETE",
		output: values,
		matrix_visible: Boolean(run.matrix_revealed_at)
	});
}
/** Sets identity_status or surface_status on a match and records the change. */
async function setMatchIdentityField(matchId, field, value, runId) {
	await db.update(matchesTable).set({ [field]: value }).where(eq(matchesTable.id, matchId));
	await log({
		audit_run_id: runId,
		match_id: matchId,
		stage: "MATCH IDENTITY VERIFICATION",
		status: value
	});
}
//#endregion
export { loadMatchWorkspace, loadStageRows, patchAuditRow, setMatchIdentityField };
