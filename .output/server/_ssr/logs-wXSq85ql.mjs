import { o as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { a as fetchLogsScreen } from "./screen-queries.functions-DIVmn9AK.mjs";
import { r as StateText } from "./StatusBadge-C2X-g8GE.mjs";
import { t as Button } from "./button-DRsC1qZi.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { a as activeSlateMatchIds, i as activeRunIds } from "./router-Dsf2sjop.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/logs-wXSq85ql.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Logs() {
	const [scope, setScope] = (0, import_react.useState)("active");
	const { data } = useQuery({
		queryKey: ["logs"],
		queryFn: async () => {
			const { logs, runs, versions } = await fetchLogsScreen();
			return {
				logs,
				activeRunIds: [...activeRunIds(runs, activeSlateMatchIds(versions))]
			};
		}
	});
	const activeSet = new Set(data?.activeRunIds ?? []);
	const visible = (data?.logs ?? []).filter((l) => scope === "all" || l.audit_run_id !== null && activeSet.has(l.audit_run_id));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-xl font-semibold",
				children: "Execution logs"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: scope === "active" ? "Scoped to active/current runs -- cleared matches and invalidated runs disappear immediately. Each row proves a stage ran; the Matrix-visible flag makes any firewall violation detectable after the fact." : "Historical view: every execution ever logged, including cleared matches and invalidated runs."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "sm",
				variant: "secondary",
				onClick: () => setScope(scope === "active" ? "all" : "active"),
				children: scope === "active" ? "Show full history" : "Show active runs only"
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
							"Time",
							"Stage",
							"Status",
							"Matrix visible",
							"Output"
						].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-2 text-xs font-semibold uppercase",
							children: h
						}, h))
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [visible.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-t border-border align-top",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "mono-num px-2 py-1 text-xs whitespace-nowrap",
							children: new Date(l.created_at).toLocaleString()
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-1",
							children: l.stage
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-1",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateText, { state: l.status })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: `px-2 py-1 text-xs ${l.matrix_visible ? "text-warn" : "text-muted-foreground"}`,
							children: l.matrix_visible ? "VISIBLE" : "HIDDEN"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "mono-num max-w-lg truncate px-2 py-1 text-xs text-muted-foreground",
							children: l.output ? JSON.stringify(l.output) : "—"
						})
					]
				}, l.id)), !visible.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					colSpan: 5,
					className: "px-3 py-8 text-center text-sm text-muted-foreground",
					children: scope === "active" ? "No active executions logged. Try \"Show full history\" for past runs." : "No executions logged yet."
				}) })] })]
			})
		})]
	});
}
//#endregion
export { Logs as component };
