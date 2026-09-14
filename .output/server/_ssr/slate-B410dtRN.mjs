import { o as __toESM } from "../_runtime.mjs";
import { a as canonicalizeStageRows, s as resolveActiveRun } from "./audit-stages-Dphii188.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { runAuditBatch } from "./audit-pipeline.functions-Cf84gMgb.mjs";
import { c as fetchSlateRunDetail, s as fetchSlateBase } from "./screen-queries.functions-DIVmn9AK.mjs";
import { r as StateText, t as AuditColorBadge } from "./StatusBadge-C2X-g8GE.mjs";
import { t as Button } from "./button-DRsC1qZi.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as useServerFn } from "./useServerFn-CrZF2pjq.mjs";
import { a as activeSlateMatchIds, i as activeRunIds, s as isRowOnActiveSlate } from "./router-Dsf2sjop.mjs";
import { n as isRecoverablePipelineTransportError, r as safePipelineErrorMessage } from "./pipeline-client-error-F6VIyWJR.mjs";
import { n as normalizeName } from "./summary-parser-DFGrtQjO.mjs";
import { n as activeRunExecutionPercent, t as ProgressBar } from "./ProgressBar-DxeGWXJM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/slate-B410dtRN.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var AUDIT_CONCURRENCY = 4;
function playerTokens(value) {
	return normalizeName(value).split(" ").filter(Boolean);
}
function samePlayer(a, b) {
	const x = playerTokens(a), y = playerTokens(b);
	if (!x.length || !y.length) return false;
	if (x.join(" ") === y.join(" ")) return true;
	if (x[x.length - 1] !== y[y.length - 1]) return false;
	const sx = new Set(x), sy = new Set(y), overlap = [...sx].filter((token) => sy.has(token)).length;
	return overlap === Math.min(sx.size, sy.size) || overlap >= Math.min(2, Math.min(sx.size, sy.size));
}
function samePair(a, b) {
	return samePlayer(a.player1_name, b.player1_name) && samePlayer(a.player2_name, b.player2_name) || samePlayer(a.player1_name, b.player2_name) && samePlayer(a.player2_name, b.player1_name);
}
function contextScore(match) {
	return [
		match.tournament_name,
		match.event_level,
		match.round,
		match.scheduled_date,
		match.surface,
		match.best_of,
		match.identity_status === "VERIFIED",
		match.surface_status === "VERIFIED"
	].filter(Boolean).length;
}
function mergeGroup(group, runRows) {
	const ranked = [...group].sort((a, b) => {
		const ar = runRows.filter((run) => run.match_id === a.id).sort((x, y) => y.run_number - x.run_number)[0];
		return (runRows.filter((run) => run.match_id === b.id).sort((x, y) => y.run_number - x.run_number)[0] ? 1 : 0) - (ar ? 1 : 0) || contextScore(b) - contextScore(a) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
	});
	const merged = { ...ranked[0] };
	const source = ranked.filter((match) => match.identity_status === "VERIFIED" || match.surface_status === "VERIFIED").sort((a, b) => contextScore(b) - contextScore(a))[0] ?? ranked[0];
	for (const row of ranked) {
		merged.tournament_name ||= row.tournament_name;
		merged.event_level ||= row.event_level;
		merged.round ||= row.round;
		merged.scheduled_date ||= row.scheduled_date;
		merged.surface ||= row.surface;
		merged.best_of ||= row.best_of;
	}
	if (source.identity_status === "VERIFIED") merged.identity_status = "VERIFIED";
	if (source.surface_status === "VERIFIED") {
		merged.surface_status = "VERIFIED";
		if (source.surface) merged.surface = source.surface;
	}
	return {
		...merged,
		_all_ids: ranked.map((row) => row.id)
	};
}
function Slate() {
	const qc = useQueryClient();
	const [scope, setScope] = (0, import_react.useState)("active");
	const executeBatch = useServerFn(runAuditBatch);
	const { data } = useQuery({
		queryKey: ["slate"],
		refetchInterval: 3e3,
		queryFn: async () => {
			const { matches, runs, versions } = await fetchSlateBase();
			const raw = matches, runRows = runs, groups = [];
			for (const match of raw) {
				const index = groups.findIndex((group) => samePair(group[0], match));
				if (index < 0) groups.push([match]);
				else groups[index].push(match);
			}
			const activeMatchIds = activeSlateMatchIds(versions ?? []);
			const activeRunIdList = [...activeRunIds(runRows, activeMatchIds)];
			const { decisions, stages, coverage } = await fetchSlateRunDetail({ data: { runIds: activeRunIdList } });
			return {
				matches: groups.map((group) => mergeGroup(group, runRows)),
				runs: runRows,
				decisions,
				stages,
				coverage,
				activeMatchIds: [...activeMatchIds]
			};
		}
	});
	const drive = useMutation({
		mutationFn: async (matchIds) => executeBatch({ data: {
			matchIds,
			concurrency: AUDIT_CONCURRENCY
		} }),
		onSuccess: (result) => {
			if (result.blocked) toast.error(`${result.blocked} audit run${result.blocked === 1 ? " is" : "s are"} blocked. Open the workspace for the persisted stage error.`);
			qc.invalidateQueries({ queryKey: ["slate"] });
		},
		onError: (error) => {
			if (!isRecoverablePipelineTransportError(error)) toast.error(safePipelineErrorMessage(error));
			qc.invalidateQueries({ queryKey: ["slate"] });
		}
	});
	(0, import_react.useEffect)(() => {
		if (!data || drive.isPending) return;
		const active = [...new Set(data.runs.filter((run) => run.status === "RUNNING").map((run) => run.match_id))];
		if (active.length) drive.mutate(active);
	}, [data, drive.isPending]);
	const runFor = (match) => {
		const ids = match?._all_ids ?? [match.id];
		return resolveActiveRun(data?.runs.filter((run) => ids.includes(run.match_id)) ?? []);
	};
	const stagesFor = (run) => run?.id ? canonicalizeStageRows((data?.stages ?? []).filter((stage) => stage.audit_run_id === run.id)) : [];
	const executionFor = (run) => activeRunExecutionPercent(run, data?.stages ?? []);
	const activeStageFor = (run) => {
		const running = stagesFor(run).filter(({ row }) => row?.status === "RUNNING");
		return running.length ? running[running.length - 1].row : null;
	};
	const evidenceFor = (runId) => {
		if (!runId) return null;
		const rows = (data?.coverage ?? []).filter((row) => row.audit_run_id === runId && Number(row.total_count) > 0);
		if (rows.length < 2) return null;
		return Math.min(...rows.map((row) => Number(row.usable_coverage_percent) || 0));
	};
	const activeMatchIds = new Set(data?.activeMatchIds ?? []);
	const visible = (data?.matches ?? []).filter((match) => scope === "all" || isRowOnActiveSlate(match, activeMatchIds));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-xl font-semibold",
				children: "Active slate"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted-foreground",
				children: [scope === "active" ? "Showing the current active slate -- matches cleared by Clear Slate disappear immediately." : "Showing every match ever ingested, including cleared/historical matches.", " Active runs are claimed in bounded batches and refreshed from persisted stages every few seconds. Evidence is shown only after canonical coverage rows are persisted."]
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "sm",
				variant: "secondary",
				onClick: () => setScope(scope === "active" ? "all" : "active"),
				children: scope === "active" ? `Show all matches (${data?.matches?.length ?? 0})` : "Show active slate only"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "panel overflow-x-auto",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "bg-header text-header-foreground",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
						className: "text-left",
						children: [
							"Match",
							"Tournament",
							"Round",
							"Surface",
							"Identity",
							"Surface status",
							"Audit run",
							"Color",
							"Winner",
							"Execution",
							"Evidence",
							""
						].map((label) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-2 text-xs font-semibold uppercase tracking-wide",
							children: label
						}, label))
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [visible.map((match) => {
					const run = runFor(match), decision = data?.decisions?.find((row) => row.audit_run_id === run?.id), evidence = evidenceFor(run?.id), activeStage = activeStageFor(run);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-t border-border",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "px-3 py-2 font-medium",
								children: [
									match.player1_name,
									" vs ",
									match.player2_name
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2",
								children: match.tournament_name ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2",
								children: match.round ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2",
								children: match.surface ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateText, { state: match.identity_status })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateText, { state: match.surface_status })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "mono-num px-3 py-2 text-xs",
								children: run ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [`RUN ${run.run_number} · ${run.status}`, activeStage && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 text-[10px] text-muted-foreground",
									children: [
										activeStage.stage,
										" · ",
										activeStage.done_count ?? 0,
										"/",
										activeStage.total_count ?? 0
									]
								})] }) : "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuditColorBadge, { color: decision?.final_audit_color ?? "INCOMPLETE" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2",
								children: decision?.final_selection ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProgressBar, { percent: executionFor(run) })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "mono-num px-3 py-2 text-xs",
								children: evidence === null ? "—" : `${evidence}%`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-2 text-right",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-end gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										asChild: true,
										size: "sm",
										variant: "secondary",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
											to: "/app/match/$matchId",
											params: { matchId: run?.match_id ?? match.id },
											children: "Open workspace"
										})
									}), (!run || run.status !== "COMPLETE") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										onClick: () => drive.mutate([run?.match_id ?? match.id]),
										disabled: drive.isPending,
										children: run?.status === "BLOCKED" ? "Retry blocked stage" : run ? "Audit running" : "Run Audit"
									})]
								})
							})
						]
					}, match.id);
				}), !visible.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					colSpan: 12,
					className: "px-3 py-8 text-center text-sm text-muted-foreground",
					children: scope === "active" ? "No matches on the active slate. Upload a summary PDF, or the slate was just cleared." : "No matches ingested yet."
				}) })] })]
			})
		})]
	});
}
//#endregion
export { Slate as component };
