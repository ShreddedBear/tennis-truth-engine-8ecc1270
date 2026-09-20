import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as Button } from "./button-DRsC1qZi.mjs";
import { t as buildBoardPdf } from "./report-pdf-Dl1ytcAD.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { r as useBoardRows } from "./router-Dsf2sjop.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reports-BlMjXAfJ.js
var import_jsx_runtime = require_jsx_runtime();
function Reports() {
	const { data } = useBoardRows();
	const rows = data ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-xl font-semibold",
			children: "PDF reports"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground",
			children: "The report mirrors the master ranked board exactly: audit colour first, verified win rate second, calibration buckets colour-coded, and unresolved matches shown as incomplete rather than hidden."
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "panel p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mono-num text-sm",
				children: [
					rows.length,
					" matches ready · ",
					rows.filter((r) => r.completion === 100).length,
					" complete ·",
					" ",
					rows.filter((r) => r.completion < 100).length,
					" unresolved"
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "mt-3",
				disabled: rows.length === 0,
				onClick: async () => {
					await buildBoardPdf(rows);
					toast.success("Report downloaded");
				},
				children: "Generate master audit report"
			})]
		})]
	});
}
//#endregion
export { Reports as component };
