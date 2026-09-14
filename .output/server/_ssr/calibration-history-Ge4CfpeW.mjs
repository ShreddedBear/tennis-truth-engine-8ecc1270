import { l as winRate } from "./audit-engine-Cw9Ig-Oc.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as fetchCalibrationHistoryScreen } from "./screen-queries.functions-DIVmn9AK.mjs";
import { n as BucketBadge } from "./StatusBadge-C2X-g8GE.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calibration-history-Ge4CfpeW.js
var import_jsx_runtime = require_jsx_runtime();
function History() {
	const { data } = useQuery({
		queryKey: ["calibration-history"],
		queryFn: async () => {
			return fetchCalibrationHistoryScreen();
		}
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-xl font-semibold",
			children: "Calibration version history"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground",
			children: "Versions are never edited. Each graded result produces a new snapshot, so historical decisions stay auditable."
		})] }), data?.versions.map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "panel p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "font-semibold",
					children: [
						v.label,
						" ",
						v.is_active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-ok text-xs",
							children: "· ACTIVE"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mono-num text-xs text-muted-foreground",
					children: [
						"seq ",
						v.master_sequence_count,
						" · graded ",
						v.graded_sample_count,
						" · ",
						new Date(v.created_at).toLocaleString()
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 flex flex-wrap gap-2",
				children: data.buckets.filter((b) => b.calibration_version_id === v.id).map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 rounded-md border border-border px-2 py-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BucketBadge, { code: b.bucket_code }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mono-num text-xs",
						children: [
							winRate(b.wins, b.graded) ?? "—",
							"% (",
							b.wins,
							"/",
							b.graded,
							")"
						]
					})]
				}, b.id))
			})]
		}, v.id))]
	});
}
//#endregion
export { History as component };
