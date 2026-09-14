import { o as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { f as Outlet, g as Link, l as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createSsrRpc } from "./createSsrRpc-DDIv2aCY.mjs";
import { a as ListChecks, c as Gauge, d as ChartColumn, f as BookOpen, l as FileText, o as LayoutDashboard, r as ScrollText, s as History, t as Upload, u as Database } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/route-Ces1nIX-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var NAV = [
	{
		to: "/app/dashboard",
		label: "Dashboard",
		icon: LayoutDashboard
	},
	{
		to: "/app/upload",
		label: "Upload Summaries",
		icon: Upload
	},
	{
		to: "/app/slate",
		label: "Active Slate",
		icon: ListChecks
	},
	{
		to: "/app/board",
		label: "Master Ranked Board",
		icon: ChartColumn
	},
	{
		to: "/app/calibration",
		label: "Calibration",
		icon: Gauge
	},
	{
		to: "/app/calibration-history",
		label: "Calibration History",
		icon: History
	},
	{
		to: "/app/rules",
		label: "Rules / Knowledge Base",
		icon: BookOpen
	},
	{
		to: "/app/sources",
		label: "Sources",
		icon: Database
	},
	{
		to: "/app/logs",
		label: "Execution Logs",
		icon: ScrollText
	},
	{
		to: "/app/reports",
		label: "PDF Reports",
		icon: FileText
	}
];
function AppShell({ children }) {
	const path = useRouterState({ select: (s) => s.location.pathname });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "bg-header text-header-foreground",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-semibold tracking-wide uppercase",
						children: "Tennis Matrix — Independent Verification & Audit"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs opacity-70",
						children: "The Matrix may be compared to the audit. It may not determine the audit."
					})] })
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "md:hidden overflow-x-auto border-b border-border bg-card",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "flex w-max gap-1 px-2 py-2",
					children: NAV.map((item) => {
						const Icon = item.icon;
						const active = path.startsWith(item.to);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: item.to,
							className: `flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3.5" }), item.label]
						}) }, item.to);
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-[1600px] gap-4 px-4 py-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "hidden w-60 shrink-0 md:block",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "panel sticky top-4 space-y-0.5 p-2",
						children: NAV.map((item) => {
							const Icon = item.icon;
							const active = path.startsWith(item.to);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: item.to,
								className: `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }), item.label]
							}) }, item.to);
						})
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "min-w-0 flex-1 pb-16",
					children
				})]
			})
		]
	});
}
var ensureBootstrapped = createServerFn({ method: "POST" }).handler(createSsrRpc("dec04ff8509ade9639271594d872ef0d8a91e1ba50c88ab25627721958d4e446"));
function AppLayout() {
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		ensureBootstrapped().finally(() => setReady(true));
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "panel p-6 text-sm text-muted-foreground",
		children: "Loading rule documents and calibration…"
	}) });
}
//#endregion
export { AppLayout as component };
