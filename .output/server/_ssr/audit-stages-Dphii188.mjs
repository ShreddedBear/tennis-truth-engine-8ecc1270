//#region node_modules/.nitro/vite/services/ssr/assets/audit-stages-Dphii188.js
var STAGES = [
	"MATCH INGESTION / PDF EXTRACTION",
	"MATCH IDENTITY VERIFICATION",
	"MATCH CONTEXT RESOLUTION",
	"DEFINITION INSTANTIATION",
	"P1 METRIC EXECUTION",
	"P2 METRIC EXECUTION",
	"VERIFICATION AUDIT",
	"DISAGREEMENT / TRAP AUDIT",
	"DANGEROUS UNDERDOG AUDIT",
	"STRESS / REMOVAL TESTS",
	"INDEPENDENT CONCLUSION",
	"MATRIX REVEAL AND COMPARISON",
	"CURRENT CALIBRATION APPLICATION",
	"COVERAGE PERSISTENCE / EVIDENCE VALIDATION",
	"FINAL DECISION",
	"FINAL COMBINATION GATE"
];
var FINAL_STAGE = STAGES[STAGES.length - 1];
var INVALIDATED_RUN_STATUS = "INVALIDATED — RERUN REQUIRED";
function isActiveRunStatus(status) {
	return !!status && status !== "INVALIDATED — RERUN REQUIRED";
}
function resolveActiveRun(runs) {
	if (!runs.length) return null;
	const latest = [...runs].sort((a, b) => b.run_number - a.run_number)[0];
	return isActiveRunStatus(latest.status) ? latest : null;
}
var STAGE_DEPENDENCIES = Object.freeze(Object.fromEntries(STAGES.map((stage, index) => [stage, Object.freeze(STAGES.slice(0, index))])));
function unmetDependencies(stage, rows) {
	const byStage = new Map(rows.map((row) => [row.stage, row.status]));
	return STAGE_DEPENDENCIES[stage].filter((dep) => byStage.get(dep) !== "COMPLETE");
}
function canonicalizeStageRows(rows) {
	const rank = (status) => status === "COMPLETE" ? 3 : status === "RUNNING" || status === "PARTIAL" ? 2 : status === "BLOCKED" || status === "FAILED" ? 1 : 0;
	const byStage = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const existing = byStage.get(row.stage);
		if (!existing || rank(row.status) > rank(existing.status)) byStage.set(row.stage, row);
	}
	return STAGES.map((stage) => ({
		stage,
		row: byStage.get(stage) ?? null
	}));
}
//#endregion
export { canonicalizeStageRows as a, unmetDependencies as c, STAGE_DEPENDENCIES as i, INVALIDATED_RUN_STATUS as n, isActiveRunStatus as o, STAGES as r, resolveActiveRun as s, FINAL_STAGE as t };
