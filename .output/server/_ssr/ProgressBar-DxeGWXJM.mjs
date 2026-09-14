import { a as canonicalizeStageRows } from "./audit-stages-Dphii188.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ProgressBar-DxeGWXJM.js
var import_jsx_runtime = require_jsx_runtime();
var TOTAL_PIPELINE_STAGES = 16;
function stageFraction(row) {
	if (row.status === "COMPLETE") return 1;
	const total = Number(row.total_count) || 0;
	if (row.status === "RUNNING" && total > 0) return Math.min(Math.max((Number(row.done_count) || 0) / total, 0), 1);
	return 0;
}
function dedupeByStage(rows) {
	const rank = (row) => row.status === "COMPLETE" ? 2 : row.status === "RUNNING" ? 1 : 0;
	const byStage = /* @__PURE__ */ new Map();
	let anonymousIndex = 0;
	for (const row of rows) {
		const key = row.stage ?? `__row_${anonymousIndex++}`;
		const existing = byStage.get(key);
		if (!existing || rank(row) > rank(existing) || rank(row) === rank(existing) && (Number(row.done_count) || 0) > (Number(existing.done_count) || 0)) byStage.set(key, row);
	}
	return [...byStage.values()];
}
function computeExecutionPercent(rows, blockedStatus) {
	const sum = dedupeByStage(rows).reduce((acc, row) => acc + stageFraction(row), 0);
	const pct = Math.round(Math.min(sum, TOTAL_PIPELINE_STAGES) / TOTAL_PIPELINE_STAGES * 100);
	return blockedStatus === "BLOCKED" ? Math.min(pct, 99) : pct;
}
function computeBatchExecutionPercent(rowsByRunId) {
	if (!rowsByRunId.size) return 0;
	let sum = 0;
	for (const rows of rowsByRunId.values()) for (const row of dedupeByStage(rows)) sum += stageFraction(row);
	const totalStages = rowsByRunId.size * TOTAL_PIPELINE_STAGES;
	return Math.round(Math.min(sum, totalStages) / totalStages * 100);
}
function activeRunExecutionPercent(run, stageRows) {
	if (!run) return 0;
	const scoped = stageRows.filter((row) => row.audit_run_id === run.id);
	return computeExecutionPercent(canonicalizeStageRows(scoped).map(({ stage, row }) => ({
		stage,
		status: row?.status ?? "PENDING",
		done_count: row?.done_count ?? 0,
		total_count: row?.total_count ?? 0
	})), run.status);
}
function ProgressBar({ percent, widthClassName = "w-16" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `h-1.5 ${widthClassName} overflow-hidden rounded-full bg-muted`,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-full rounded-full bg-primary transition-all",
				style: { width: `${Math.max(0, Math.min(100, percent))}%` }
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "mono-num text-xs",
			children: [percent, "%"]
		})]
	});
}
//#endregion
export { activeRunExecutionPercent as n, computeBatchExecutionPercent as r, ProgressBar as t };
