import { t as BUCKET_TOKEN } from "./constants-DloZsw4H.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/StatusBadge-C2X-g8GE.js
var import_jsx_runtime = require_jsx_runtime();
var AUDIT_TOKEN = {
	"DOUBLE GREEN": "var(--double-green)",
	GREEN: "var(--green)",
	YELLOW: "var(--yellow)",
	"RED / PASS": "var(--red)",
	"INSUFFICIENT EVIDENCE": "var(--yellow)",
	RED: "var(--red)",
	INCOMPLETE: "var(--incomplete)"
};
function AuditColorBadge({ color }) {
	const bg = AUDIT_TOKEN[color] ?? "var(--incomplete)";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
		style: {
			backgroundColor: bg,
			color: color === "YELLOW" ? "var(--foreground)" : "var(--primary-foreground)"
		},
		children: color
	});
}
function BucketBadge({ code, children }) {
	if (!code) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "text-xs text-muted-foreground",
		children: "—"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "mono-num inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold",
		style: {
			backgroundColor: BUCKET_TOKEN[code] ?? "var(--muted)",
			color: "var(--primary-foreground)"
		},
		children: children ?? code
	});
}
var STATE_CLASS = {
	COMPLETE: "text-ok",
	RUNNING: "text-primary",
	BLOCKED: "text-blocked",
	FAILED: "text-blocked",
	UNAVAILABLE: "text-warn",
	EXCLUDED: "text-muted-foreground",
	"NOT STARTED": "text-muted-foreground",
	"REQUIRES HUMAN REVIEW": "text-warn"
};
function StateText({ state }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: `text-xs font-medium ${STATE_CLASS[state] ?? "text-muted-foreground"}`,
		children: state
	});
}
//#endregion
export { BucketBadge as n, StateText as r, AuditColorBadge as t };
