import { o as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { o as fetchRulesScreen } from "./screen-queries.functions-DIVmn9AK.mjs";
import { r as StateText } from "./StatusBadge-C2X-g8GE.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rules-BSyhcExX.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Rules() {
	const [selected, setSelected] = (0, import_react.useState)(null);
	const { data } = useQuery({
		queryKey: ["rules"],
		queryFn: async () => {
			const { docs, versions, rules } = await fetchRulesScreen();
			return {
				docs: docs ?? [],
				versions: versions ?? [],
				rules: rules ?? []
			};
		}
	});
	const activeVersion = (docId) => data?.versions.find((v) => v.document_id === docId && v.is_active);
	const current = selected ?? data?.docs[0]?.id ?? null;
	const version = current ? activeVersion(current) : null;
	const rules = data?.rules.filter((r) => r.version_id === version?.id) ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-xl font-semibold",
				children: "Rule knowledge base"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Rules are parsed deterministically from the uploaded documents. A version with an incomplete parse cannot be activated, so a run never silently skips a rule."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-2",
				children: data?.docs.map((d) => {
					const v = activeVersion(d.id);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setSelected(d.id),
						className: `rounded-md border px-3 py-2 text-left text-sm ${current === d.id ? "border-primary bg-muted" : "border-border"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-medium",
							children: d.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mono-num text-xs text-muted-foreground",
							children: [
								d.doc_type,
								" · v",
								v?.version_number ?? "—",
								" · ",
								v?.parsed_rules ?? 0,
								" rules"
							]
						})]
					}, d.id);
				})
			}),
			version && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "panel p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "font-semibold",
						children: ["Version ", version.version_number]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateText, { state: version.activation_status }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mono-num text-muted-foreground",
							children: [
								"declared ",
								version.expected_rules,
								" · parsed ",
								version.parsed_rules
							]
						})]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "panel overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "bg-header text-header-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
							className: "text-left",
							children: [
								"#",
								"Rule",
								"Category",
								"Severity",
								"Blocking",
								"Text"
							].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-2 py-2 text-xs font-semibold uppercase",
								children: h
							}, h))
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [rules.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-t border-border align-top",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "mono-num px-2 py-1 text-xs",
								children: r.rule_code
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1 font-medium",
								children: r.rule_name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1 text-xs",
								children: r.category ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1 text-xs",
								children: r.severity
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1 text-xs",
								children: r.blocking ? "BLOCKING" : "STANDARD"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "max-w-xl px-2 py-1 text-xs text-muted-foreground",
								children: r.body
							})
						]
					}, r.id)), rules.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						colSpan: 6,
						className: "px-3 py-8 text-center text-sm text-muted-foreground",
						children: "No parsed rules for this document version."
					}) })] })]
				})
			})
		]
	});
}
//#endregion
export { Rules as component };
