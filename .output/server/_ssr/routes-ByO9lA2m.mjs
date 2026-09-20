import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as Button } from "./button-DRsC1qZi.mjs";
import { a as ListChecks, c as Gauge, i as Lock, n as ShieldCheck } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-ByO9lA2m.js
var import_jsx_runtime = require_jsx_runtime();
var PILLARS = [
	{
		icon: Lock,
		title: "Matrix firewall",
		body: "The independent conclusion is committed and timestamped before any Matrix output is revealed."
	},
	{
		icon: ListChecks,
		title: "Symmetric sweeps",
		body: "Player 1 and Player 2 are processed for every applicable metric and audit rule, or the match cannot complete."
	},
	{
		icon: Gauge,
		title: "Live calibration",
		body: "Verified win rates recompute from the graded ledger. Yellow non-graded results advance the sequence only."
	},
	{
		icon: ShieldCheck,
		title: "Deterministic completion",
		body: "Application logic — never generated text — decides COMPLETE, GREEN or PASS."
	}
];
function Landing() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-background",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "bg-header text-header-foreground",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-5xl items-center justify-between px-6 py-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm font-semibold tracking-wide uppercase",
					children: "Tennis Matrix Audit"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "secondary",
					size: "sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/app/dashboard",
						children: "Open workspace"
					})
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "mx-auto max-w-5xl px-6 py-16",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "max-w-3xl text-4xl font-bold tracking-tight md:text-5xl",
					children: "Independent verification & audit for every Tennis Matrix matchup."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-5 max-w-2xl text-lg text-muted-foreground",
					children: "Upload the summary PDFs, run the full pipeline, and let the engine prove execution through persisted state. The Matrix may be compared to the audit — it may never determine it."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-8 flex gap-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						size: "lg",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/app/dashboard",
							children: "Open the audit engine"
						})
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "mt-16 grid gap-4 md:grid-cols-2",
					children: PILLARS.map((p) => {
						const Icon = p.icon;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: "panel p-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-5 text-primary" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "mt-3 font-semibold",
									children: p.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-muted-foreground",
									children: p.body
								})
							]
						}, p.title);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mono-num mt-16 text-xs uppercase tracking-widest text-muted-foreground",
					children: "No execution record = no completion."
				})
			]
		})]
	});
}
//#endregion
export { Landing as component };
