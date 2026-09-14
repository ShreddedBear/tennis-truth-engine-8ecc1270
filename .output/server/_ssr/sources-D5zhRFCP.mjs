import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { l as fetchSourcesScreen, u as resolveConflict } from "./screen-queries.functions-DIVmn9AK.mjs";
import { r as StateText } from "./StatusBadge-C2X-g8GE.mjs";
import { t as Button } from "./button-DRsC1qZi.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sources-D5zhRFCP.js
var import_jsx_runtime = require_jsx_runtime();
function Sources() {
	const qc = useQueryClient();
	const { data } = useQuery({
		queryKey: ["sources"],
		queryFn: async () => {
			return fetchSourcesScreen();
		}
	});
	const resolve = async (id, resolution) => {
		await resolveConflict({ data: {
			id,
			resolution
		} });
		toast.success(`Conflict marked ${resolution}`);
		qc.invalidateQueries({ queryKey: ["sources"] });
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-xl font-semibold",
				children: "Source conflicts"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Conflicting values are never silently averaged. Critical conflicts must be resolved or the match cannot complete."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "panel mt-2 overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "bg-header text-header-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
							className: "text-left",
							children: [
								"Field",
								"Values",
								"Selected",
								"Severity",
								"Status",
								""
							].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-2 py-2 text-xs font-semibold uppercase",
								children: h
							}, h))
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [data?.conflicts.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-t border-border",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1",
								children: c.data_key
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1",
								children: JSON.stringify(c.values)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1",
								children: c.selected_value ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1 text-xs",
								children: c.critical ? "CRITICAL" : "STANDARD"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateText, { state: c.resolution_status })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1 text-right",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex justify-end gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "secondary",
										onClick: () => resolve(c.id, "RESOLVED"),
										children: "Resolve"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: () => resolve(c.id, "UNRESOLVABLE"),
										children: "Unresolvable"
									})]
								})
							})
						]
					}, c.id)), !data?.conflicts.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						colSpan: 6,
						className: "px-3 py-8 text-center text-sm text-muted-foreground",
						children: "No conflicts recorded."
					}) })] })]
				})
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "text-lg font-semibold",
			children: "Source snapshots"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "panel mt-2 overflow-x-auto",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "bg-header text-header-foreground",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
						className: "text-left",
						children: [
							"Captured",
							"Source",
							"Key",
							"Value",
							"Reliability"
						].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-2 text-xs font-semibold uppercase",
							children: h
						}, h))
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [data?.snapshots.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-t border-border",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "mono-num px-2 py-1 text-xs whitespace-nowrap",
							children: new Date(s.retrieved_at).toLocaleString()
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-1",
							children: s.source_name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-1 text-xs",
							children: s.data_key
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "mono-num max-w-md truncate px-2 py-1 text-xs text-muted-foreground",
							children: s.normalized_value ?? s.raw_value ?? "—"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-1 text-xs",
							children: s.reliability ?? "—"
						})
					]
				}, s.id)), !data?.snapshots.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					colSpan: 5,
					className: "px-3 py-8 text-center text-sm text-muted-foreground",
					children: "No snapshots captured yet."
				}) })] })]
			})
		})] })]
	});
}
//#endregion
export { Sources as component };
