import { a as eq, c as inArray, n as asc, r as desc } from "../_libs/drizzle-orm.mjs";
import { t as db } from "./client.server-B14ewPcb.mjs";
import { i as auditStageRunsTable, n as auditCoverageTable, o as executionLogsTable, r as auditRunsTable } from "./audit-ChUwSBsg.mjs";
import { n as calibrationLedgerTable, r as calibrationVersionsTable, t as calibrationBucketsTable } from "./calibration-BTgOpQAP.mjs";
import { t as finalDecisionsTable } from "./decisions-D8mHqU7D.mjs";
import { s as matchesTable } from "./matches-CtYuxOLN.mjs";
import { a as ruleDocumentsTable, i as ruleDocumentVersionsTable, o as rulesTable } from "./rules-DxX2ibUx.mjs";
import { l as sourceConflictsTable, m as sourceSnapshotsTable } from "./sources-B3f820Qo.mjs";
import { a as parsedSummaryFieldsTable, c as summaryVersionsTable, s as summaryUploadsTable } from "./uploads-vW6NguTg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/screen-queries.server-BzV7orGb.js
async function loadLogsScreen() {
	const [logs, runs, versions] = await Promise.all([
		db.select().from(executionLogsTable).orderBy(desc(executionLogsTable.created_at)).limit(300),
		db.select({
			id: auditRunsTable.id,
			match_id: auditRunsTable.match_id,
			run_number: auditRunsTable.run_number,
			status: auditRunsTable.status
		}).from(auditRunsTable),
		db.select({
			match_id: summaryVersionsTable.match_id,
			is_active: summaryVersionsTable.is_active
		}).from(summaryVersionsTable)
	]);
	return {
		logs,
		runs,
		versions
	};
}
async function loadSourcesScreen() {
	const [snapshots, conflicts] = await Promise.all([db.select().from(sourceSnapshotsTable).orderBy(desc(sourceSnapshotsTable.retrieved_at)).limit(200), db.select().from(sourceConflictsTable).orderBy(desc(sourceConflictsTable.created_at)).limit(200)]);
	return {
		snapshots,
		conflicts
	};
}
async function resolveSourceConflict(id, resolution) {
	await db.update(sourceConflictsTable).set({ resolution_status: resolution }).where(eq(sourceConflictsTable.id, id));
}
async function loadRulesScreen() {
	const [docs, versions, rules] = await Promise.all([
		db.select().from(ruleDocumentsTable).orderBy(asc(ruleDocumentsTable.doc_type)),
		db.select().from(ruleDocumentVersionsTable).orderBy(asc(ruleDocumentVersionsTable.version_number)),
		db.select().from(rulesTable).orderBy(asc(rulesTable.rule_code))
	]);
	return {
		docs,
		versions,
		rules
	};
}
async function loadCalibrationHistoryScreen() {
	const versions = await db.select().from(calibrationVersionsTable).orderBy(desc(calibrationVersionsTable.version_number)).limit(40);
	const ids = versions.map((v) => v.id);
	return {
		versions,
		buckets: ids.length ? await db.select().from(calibrationBucketsTable).where(inArray(calibrationBucketsTable.calibration_version_id, ids)).orderBy(asc(calibrationBucketsTable.wp_min)) : []
	};
}
/** The one active calibration version, or null. */
async function activeCalibrationVersion() {
	const [version] = await db.select().from(calibrationVersionsTable).where(eq(calibrationVersionsTable.is_active, true)).limit(1);
	return version ?? null;
}
async function bucketsFor(versionId) {
	if (!versionId) return [];
	return db.select().from(calibrationBucketsTable).where(eq(calibrationBucketsTable.calibration_version_id, versionId)).orderBy(asc(calibrationBucketsTable.wp_min));
}
async function loadCalibrationScreen() {
	const version = await activeCalibrationVersion();
	const [buckets, ledger] = await Promise.all([bucketsFor(version?.id ?? null), db.select().from(calibrationLedgerTable).orderBy(desc(calibrationLedgerTable.master_sequence)).limit(100)]);
	return {
		version,
		buckets,
		ledger
	};
}
async function loadDashboardScreen() {
	const [matches, runs, decisions, version, uploads, slateVersions] = await Promise.all([
		db.select({
			id: matchesTable.id,
			match_status: matchesTable.match_status,
			identity_status: matchesTable.identity_status,
			surface_status: matchesTable.surface_status
		}).from(matchesTable),
		db.select({
			id: auditRunsTable.id,
			match_id: auditRunsTable.match_id,
			run_number: auditRunsTable.run_number,
			status: auditRunsTable.status
		}).from(auditRunsTable),
		db.select({
			audit_run_id: finalDecisionsTable.audit_run_id,
			final_audit_color: finalDecisionsTable.final_audit_color,
			audit_complete: finalDecisionsTable.audit_complete
		}).from(finalDecisionsTable),
		activeCalibrationVersion(),
		db.select({ id: summaryUploadsTable.id }).from(summaryUploadsTable),
		db.select({
			match_id: summaryVersionsTable.match_id,
			upload_id: summaryVersionsTable.upload_id,
			is_active: summaryVersionsTable.is_active
		}).from(summaryVersionsTable)
	]);
	return {
		matches,
		runs,
		decisions,
		version,
		uploads,
		slateVersions,
		buckets: await bucketsFor(version?.id ?? null)
	};
}
async function loadBoardScreen() {
	const [decisions, runs, matches, fields, versions] = await Promise.all([
		db.select().from(finalDecisionsTable),
		db.select().from(auditRunsTable),
		db.select().from(matchesTable),
		db.select({
			summary_version_id: parsedSummaryFieldsTable.summary_version_id,
			field_key: parsedSummaryFieldsTable.field_key,
			normalized_value: parsedSummaryFieldsTable.normalized_value
		}).from(parsedSummaryFieldsTable),
		db.select({
			id: summaryVersionsTable.id,
			match_id: summaryVersionsTable.match_id,
			is_active: summaryVersionsTable.is_active
		}).from(summaryVersionsTable)
	]);
	return {
		decisions,
		runs,
		matches,
		fields,
		versions
	};
}
async function loadSlateBase() {
	const [matches, runs, versions] = await Promise.all([
		db.select().from(matchesTable).orderBy(desc(matchesTable.created_at)),
		db.select({
			id: auditRunsTable.id,
			match_id: auditRunsTable.match_id,
			status: auditRunsTable.status,
			run_number: auditRunsTable.run_number,
			heartbeat_at: auditRunsTable.heartbeat_at,
			lease_expires_at: auditRunsTable.lease_expires_at
		}).from(auditRunsTable),
		db.select({
			match_id: summaryVersionsTable.match_id,
			upload_id: summaryVersionsTable.upload_id,
			created_at: summaryVersionsTable.created_at,
			is_active: summaryVersionsTable.is_active
		}).from(summaryVersionsTable)
	]);
	return {
		matches,
		runs,
		versions
	};
}
async function loadSlateRunDetail(runIds) {
	if (!runIds.length) return {
		decisions: [],
		stages: [],
		coverage: []
	};
	const [decisions, stages, coverage] = await Promise.all([
		db.select({
			audit_run_id: finalDecisionsTable.audit_run_id,
			final_audit_color: finalDecisionsTable.final_audit_color,
			completion_percent: finalDecisionsTable.completion_percent,
			audit_complete: finalDecisionsTable.audit_complete,
			final_selection: finalDecisionsTable.final_selection
		}).from(finalDecisionsTable).where(inArray(finalDecisionsTable.audit_run_id, runIds)),
		db.select({
			audit_run_id: auditStageRunsTable.audit_run_id,
			stage: auditStageRunsTable.stage,
			stage_order: auditStageRunsTable.stage_order,
			status: auditStageRunsTable.status,
			done_count: auditStageRunsTable.done_count,
			total_count: auditStageRunsTable.total_count,
			started_at: auditStageRunsTable.started_at,
			finished_at: auditStageRunsTable.finished_at,
			heartbeat_at: auditStageRunsTable.heartbeat_at
		}).from(auditStageRunsTable).where(inArray(auditStageRunsTable.audit_run_id, runIds)),
		db.select({
			audit_run_id: auditCoverageTable.audit_run_id,
			player_side: auditCoverageTable.player_side,
			usable_coverage_percent: auditCoverageTable.usable_coverage_percent,
			total_count: auditCoverageTable.total_count
		}).from(auditCoverageTable).where(inArray(auditCoverageTable.audit_run_id, runIds))
	]);
	return {
		decisions,
		stages,
		coverage
	};
}
//#endregion
export { loadBoardScreen, loadCalibrationHistoryScreen, loadCalibrationScreen, loadDashboardScreen, loadLogsScreen, loadRulesScreen, loadSlateBase, loadSlateRunDetail, loadSourcesScreen, resolveSourceConflict };
