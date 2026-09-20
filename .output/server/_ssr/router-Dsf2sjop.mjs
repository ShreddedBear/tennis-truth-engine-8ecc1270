import { o as __toESM } from "../_runtime.mjs";
import { n as metricUniverseAccounting, r as playerEvidenceDenominatorCodes, t as classifyMetric } from "./metric-classification-BT9JbLCb.mjs";
import { s as resolveActiveRun } from "./audit-stages-Dphii188.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { c as HeadContent, d as createRouter, f as Outlet, g as Link, h as createRootRouteWithContext, j as redirect, m as createFileRoute, p as lazyRouteComponent, s as Scripts, v as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as __exportAll } from "./server-KPZuT5q2.mjs";
import { t as loadRuntimeIndex } from "./ssr.mjs";
import { a as eq, c as inArray, i as and, l as isNotNull, n as asc, p as ne, r as desc } from "../_libs/drizzle-orm.mjs";
import { t as db } from "./client.server-B14ewPcb.mjs";
import { r as auditRunsTable } from "./audit-ChUwSBsg.mjs";
import { s as matchesTable } from "./matches-CtYuxOLN.mjs";
import { c as metricEvidenceStoreTable } from "./metrics-2UTgcTdn.mjs";
import { a as ruleDocumentsTable, i as ruleDocumentVersionsTable, o as rulesTable } from "./rules-DxX2ibUx.mjs";
import { f as sourceIngestionRunsTable, p as sourceObservationsTable, t as ingestionTargetsTable } from "./sources-B3f820Qo.mjs";
import { a as parsedSummaryFieldsTable } from "./uploads-vW6NguTg.mjs";
import { M as resolveCanonicalEvidencePair, N as safeEvidenceAliases, O as policyForMetric, P as tryQuery, S as excludedSet, _ as deterministicRankingMetric, b as enforceFiveMetricWiring, g as deterministicPbpMetricFromPacket, h as deterministicPbpMetric, m as deterministicMarketMetric, o as buildMetricObservationContext, p as deterministicEnvironmentMetric, r as assertObservationFamily, s as certifyMetricFinding, u as completionSweepHistoricalFinding, v as deterministicResultsScheduleMetric, w as localMetricRows, x as evidencePairMatches, y as deterministicRulesContextMetric } from "./source-observation-metric-bridge.server-CZQCC458.mjs";
import { t as fetchBoardScreen } from "./screen-queries.functions-DIVmn9AK.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { n as useQuery, r as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
import { n as parseRuleDocument, t as activationStatus } from "./rule-parser-C8eUSSnG.mjs";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
//#region node_modules/.nitro/vite/services/ssr/assets/current-audit-state-DupmaUPp.js
function latestRunsByMatch(runs) {
	const byMatch = /* @__PURE__ */ new Map();
	for (const run of runs) {
		const list = byMatch.get(run.match_id);
		if (list) list.push(run);
		else byMatch.set(run.match_id, [run]);
	}
	const latest = /* @__PURE__ */ new Map();
	for (const [matchId, matchRuns] of byMatch) {
		const active = resolveActiveRun(matchRuns);
		if (active) latest.set(matchId, active);
	}
	return latest;
}
function currentAuditRows(matches, runs, decisions) {
	const latest = latestRunsByMatch(runs);
	const decisionsByRun = new Map(decisions.map((decision) => [decision.audit_run_id, decision]));
	return matches.map((match) => {
		const run = latest.get(match.id) ?? null;
		return {
			match,
			run,
			decision: run ? decisionsByRun.get(run.id) ?? null : null
		};
	});
}
function activeSlateMatchIds(summaryVersions) {
	return new Set(summaryVersions.filter((v) => v.is_active === true).map((v) => v.match_id));
}
function activeRunIds(runs, activeMatchIds) {
	const latest = latestRunsByMatch(runs);
	const ids = /* @__PURE__ */ new Set();
	for (const [matchId, run] of latest) if (activeMatchIds.has(matchId)) ids.add(run.id);
	return ids;
}
function isRowOnActiveSlate(row, activeMatchIds) {
	return (row._all_ids ?? [row.id]).some((id) => activeMatchIds.has(id));
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/router-Dsf2sjop.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var styles_default = "/assets/styles-9lG4UOaG.css";
/**
* Client-side error reporting.
*
* This replaces lovable-error-reporting.ts, which called
* `window.__lovableEvents.captureException` -- a hook that only exists inside Lovable's
* preview iframe and was therefore a no-op everywhere the app actually runs, production
* included.
*
* Rather than swap one vendor hook for another, this reports to the console with a stable
* prefix and a structured payload, so the boundary and route that produced an error are
* visible in the browser console and in any log collector that reads it. If a real error
* service is ever added, this is the one place that changes.
*/
function reportClientError(error, context = {}) {
	if (typeof window === "undefined") return;
	const payload = {
		message: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : void 0,
		route: window.location?.pathname,
		at: (/* @__PURE__ */ new Date()).toISOString(),
		...context
	};
	console.error("[client-error]", payload);
}
var Toaster$1 = ({ ...props }) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
		className: "toaster group",
		toastOptions: { classNames: {
			toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
			description: "group-[.toast]:text-muted-foreground",
			actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
			cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
		} },
		...props
	});
};
function NotFoundComponent() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-7xl font-bold text-foreground",
					children: "404"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-4 text-xl font-semibold text-foreground",
					children: "Page not found"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "The page you're looking for doesn't exist or has been moved."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Go home"
					})
				})
			]
		})
	});
}
function ErrorComponent({ error, reset }) {
	console.error(error);
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		reportClientError(error, { boundary: "tanstack_root_error_component" });
	}, [error]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold tracking-tight text-foreground",
					children: "This page didn't load"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Something went wrong on our end. You can try refreshing or head back home."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							router.invalidate();
							reset();
						},
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Try again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/",
						className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
						children: "Go home"
					})]
				})
			]
		})
	});
}
var Route$17 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{
				name: "author",
				content: "Tennis Matrix Audit"
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			}
		],
		links: [
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
			},
			{
				rel: "icon",
				href: "/favicon.ico",
				type: "image/x-icon"
			}
		]
	}),
	shellComponent: RootShell,
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
	errorComponent: ErrorComponent
});
function RootShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	});
}
function RootComponent() {
	const { queryClient } = Route$17.useRouteContext();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(QueryClientProvider, {
		client: queryClient,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {})]
	});
}
var $$splitComponentImporter$12 = () => import("./routes-ByO9lA2m.mjs");
var Route$16 = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({ to: "/app/upload" });
	},
	head: () => ({ meta: [
		{ title: "Tennis Matrix Independent Verification & Audit System" },
		{
			name: "description",
			content: "Deterministic tennis match audit engine: matrix firewall, symmetric P1/P2 metric sweeps, trap audits, stress tests and a calibration ledger that proves the work was done."
		},
		{
			property: "og:title",
			content: "Tennis Matrix Independent Verification & Audit System"
		},
		{
			property: "og:description",
			content: "An audit engine, not a chatbot. No execution record = no completion."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$12, "component")
});
var $$splitComponentImporter$11 = () => import("./route-Ces1nIX-.mjs");
var Route$15 = createFileRoute("/app")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$11, "component")
});
/** Length-independent comparison, so a wrong key cannot be narrowed down by timing. */
function constantTimeEquals(a, b) {
	if (a.length !== b.length) return false;
	let differing = 0;
	for (let i = 0; i < a.length; i++) differing |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return differing === 0;
}
/**
* @param envName  the variable holding the expected key
* @param supplied the key the caller presented, or null
*/
function checkApiKey(envName, supplied) {
	const expected = process.env[envName];
	if (!expected) return {
		ok: false,
		status: 503,
		body: {
			ok: false,
			error: `${envName} is not configured; refusing to serve this route.`
		}
	};
	if (!supplied || !constantTimeEquals(supplied, expected)) return {
		ok: false,
		status: 404,
		body: { ok: false }
	};
	return { ok: true };
}
var EXPECTED_CHANGED_CODES = /* @__PURE__ */ new Set([
	"004",
	"005",
	"006"
]);
function json$3(data, status = 200) {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
var Route$14 = createFileRoute("/api/admin-republish-metrics-document")({ server: { handlers: { GET: async ({ request }) => {
	const url = new URL(request.url);
	const auth = checkApiKey("REPUBLISH_KEY", url.searchParams.get("key"));
	if (!auth.ok) return json$3(auth.body, auth.status);
	const commit = url.searchParams.get("commit") === "true";
	const force = url.searchParams.get("force") === "true";
	try {
		const docResult = await tryQuery(() => db.select({
			id: ruleDocumentsTable.id,
			active_version_id: ruleDocumentsTable.active_version_id
		}).from(ruleDocumentsTable).where(eq(ruleDocumentsTable.doc_type, "METRICS")).limit(1));
		if (docResult.error) return json$3({
			ok: false,
			error: `rule_documents lookup: ${docResult.error.message}`
		}, 500);
		const doc = docResult.data?.[0];
		if (!doc) return json$3({
			ok: false,
			error: "No METRICS rule_documents row found"
		}, 500);
		const activeVersionId = doc.active_version_id;
		const versionResult = activeVersionId ? await tryQuery(() => db.select({
			id: ruleDocumentVersionsTable.id,
			version_number: ruleDocumentVersionsTable.version_number,
			user_id: ruleDocumentVersionsTable.user_id
		}).from(ruleDocumentVersionsTable).where(eq(ruleDocumentVersionsTable.id, activeVersionId)).limit(1)) : {
			data: [],
			error: null
		};
		if (versionResult.error) return json$3({
			ok: false,
			error: `active version lookup: ${versionResult.error.message}`
		}, 500);
		const activeVersion = versionResult.data?.[0];
		if (!activeVersion) return json$3({
			ok: false,
			error: "No active METRICS version found"
		}, 500);
		const { data: currentRules, error: rulesError } = await tryQuery(() => db.select({
			rule_code: rulesTable.rule_code,
			rule_name: rulesTable.rule_name
		}).from(rulesTable).where(eq(rulesTable.version_id, activeVersion.id)));
		if (rulesError) return json$3({
			ok: false,
			error: `current rules lookup: ${rulesError.message}`
		}, 500);
		const currentByCode = new Map((currentRules ?? []).map((r) => [r.rule_code, r.rule_name]));
		const seedUrl = new URL("/seed/metrics.txt", request.url);
		const seedRes = await fetch(seedUrl);
		if (!seedRes.ok) return json$3({
			ok: false,
			error: `Could not fetch ${seedUrl}: HTTP ${seedRes.status}`
		}, 500);
		const text = await seedRes.text();
		const report = parseRuleDocument(text);
		const status = activationStatus(report);
		if (report.parsed_rules !== 81 || report.expected_rules !== 81 || status !== "READY") return json$3({
			ok: false,
			error: "Corrected seed document did not parse to a clean 81-rule READY document; refusing to publish.",
			parsed_rules: report.parsed_rules,
			expected_rules: report.expected_rules,
			activation_status: status,
			ambiguous: report.ambiguous
		}, 500);
		const newByCode = new Map(report.rules.map((r) => [r.rule_code, r.rule_name]));
		const diff = [];
		for (const [code, newName] of newByCode) {
			const oldName = currentByCode.get(code) ?? null;
			if (oldName !== newName) diff.push({
				code,
				old_name: oldName,
				new_name: newName
			});
		}
		const unexpectedChanges = diff.filter((d) => !EXPECTED_CHANGED_CODES.has(d.code));
		if (!commit) return json$3({
			ok: true,
			dry_run: true,
			current_document_id: doc.id,
			current_active_version_id: doc.active_version_id,
			parsed_rules: report.parsed_rules,
			activation_status: status,
			diff,
			unexpected_changes: unexpectedChanges,
			would_publish: unexpectedChanges.length === 0 || force,
			note: "Pass commit=true to publish. If unexpected_changes is non-empty, also pass force=true after reviewing them."
		});
		if (unexpectedChanges.length > 0 && !force) return json$3({
			ok: false,
			error: "Refusing to commit: changes beyond the expected 004/005/006 fix were detected. Re-run with force=true only after reviewing unexpected_changes.",
			diff,
			unexpected_changes: unexpectedChanges
		}, 409);
		const nextNumber = (activeVersion.version_number ?? 0) + 1;
		const insertVersionResult = await tryQuery(() => db.insert(ruleDocumentVersionsTable).values({
			document_id: doc.id,
			version_number: nextNumber,
			source_filename: "/seed/metrics.txt",
			raw_text: text,
			pages_detected: report.pages_detected,
			headings_detected: report.headings_detected,
			expected_rules: report.expected_rules,
			parsed_rules: report.parsed_rules,
			unmapped_rules: report.unmapped_rules,
			parser_confidence: report.parser_confidence,
			activation_status: status,
			is_active: false,
			user_id: activeVersion.user_id
		}).returning());
		const newVersion = insertVersionResult.data?.[0];
		if (insertVersionResult.error || !newVersion) return json$3({
			ok: false,
			error: `version insert failed: ${insertVersionResult.error?.message}`
		}, 500);
		const CHUNK = 200;
		for (let i = 0; i < report.rules.length; i += CHUNK) {
			const { error: rulesInsertError } = await tryQuery(() => db.insert(rulesTable).values(report.rules.slice(i, i + CHUNK).map((r) => ({
				version_id: newVersion.id,
				rule_code: r.rule_code,
				rule_name: r.rule_name,
				body: r.body,
				severity: r.severity,
				blocking: r.blocking,
				mapping_status: r.mapping_status,
				user_id: activeVersion.user_id
			}))).returning({ id: rulesTable.id }));
			if (rulesInsertError) return json$3({
				ok: false,
				error: `rules insert failed: ${rulesInsertError.message}`,
				new_version_id: newVersion.id,
				activated: false
			}, 500);
		}
		await db.update(ruleDocumentVersionsTable).set({ is_active: false }).where(eq(ruleDocumentVersionsTable.document_id, doc.id));
		await db.update(ruleDocumentVersionsTable).set({ is_active: true }).where(eq(ruleDocumentVersionsTable.id, newVersion.id));
		await db.update(ruleDocumentsTable).set({ active_version_id: newVersion.id }).where(eq(ruleDocumentsTable.id, doc.id));
		const { error: invalidateError } = await tryQuery(() => db.update(auditRunsTable).set({
			status: "INVALIDATED — RERUN REQUIRED",
			stale_reason: "METRICS rule version changed"
		}).where(and(ne(auditRunsTable.metrics_version_id, newVersion.id), inArray(auditRunsTable.status, ["RUNNING", "COMPLETE"]))).returning({ id: auditRunsTable.id }));
		return json$3({
			ok: true,
			dry_run: false,
			committed: true,
			old_version_id: doc.active_version_id,
			new_version_id: newVersion.id,
			new_version_number: newVersion.version_number,
			diff,
			unexpected_changes: unexpectedChanges,
			forced: force && unexpectedChanges.length > 0,
			audit_runs_invalidation_error: invalidateError?.message ?? null
		});
	} catch (error) {
		return json$3({
			ok: false,
			error: error instanceof Error ? error.message : String(error)
		}, 500);
	}
} } } });
function json$2(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
var Route$13 = createFileRoute("/api/drive-audit-batch")({ server: { handlers: { POST: async ({ request }) => {
	const secret = process.env["AUDIT_CRON_SECRET"];
	if (!secret) return json$2({
		ok: false,
		error: "AUDIT_CRON_SECRET is not configured; refusing to run unattended."
	}, 503);
	if ((request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) return json$2({
		ok: false,
		error: "Unauthorized"
	}, 401);
	let body = {};
	try {
		const text = await request.text();
		if (text) body = JSON.parse(text);
	} catch {
		return json$2({
			ok: false,
			error: "Request body must be JSON"
		}, 400);
	}
	const { data: runs, error } = await tryQuery(() => db.select({ match_id: auditRunsTable.match_id }).from(auditRunsTable).where(eq(auditRunsTable.status, "RUNNING")).limit(100));
	if (error) return json$2({
		ok: false,
		error: `audit_runs lookup: ${error.message}`
	}, 500);
	const matchIds = [...new Set((runs ?? []).map((row) => row.match_id))];
	if (!matchIds.length) return json$2({
		ok: true,
		total: 0,
		note: "No RUNNING audits to drive."
	});
	const { driveAuditBatch } = await import("./audit-pipeline.functions-Cf84gMgb.mjs");
	try {
		return json$2(await driveAuditBatch({
			matchIds,
			concurrency: body.concurrency,
			budgetMs: body.budgetMs
		}));
	} catch (e) {
		return json$2({
			ok: false,
			error: e instanceof Error ? e.message : String(e)
		}, 500);
	}
} } } });
var norm = (v) => String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function validPlayers(row) {
	return Array.isArray(row.players) && row.players.length >= 2 && Boolean(String(row.players[0] ?? "").trim()) && Boolean(String(row.players[1] ?? "").trim()) && norm(row.players[0]) !== norm(row.players[1]);
}
function strictClass(row, id) {
	if (row.structurally_present !== true || !row.date || !row.match_id || !validPlayers(row)) return false;
	const circuit = String(row.circuit ?? "").trim().toUpperCase();
	const blob = norm(`${row.category ?? ""} ${row.tournament ?? ""}`);
	if (id === "ATP_MAIN") return circuit === "ATP" && ![
		"challenger",
		"wta",
		"wta 125",
		"wta125",
		"itf",
		"futures",
		"utr",
		"satellite",
		"exhibition"
	].some((x) => blob.includes(x));
	if (id === "WTA_MAIN") return circuit === "WTA" && ![
		"challenger",
		"wta 125",
		"wta125",
		"125k",
		"atp",
		"itf",
		"futures",
		"utr",
		"satellite",
		"exhibition"
	].some((x) => blob.includes(x));
	return circuit === "ATP" && blob.includes("challenger") && ![
		"wta",
		"itf",
		"futures",
		"utr",
		"satellite",
		"exhibition"
	].some((x) => blob.includes(x));
}
async function load(path) {
	try {
		const parsed = JSON.parse(await readFile(path, "utf8"));
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
async function loadApprovedWtaChallenger() {
	try {
		return (await readFile(join(process.cwd(), "data", "metrics", "pbp", "wta_challenger", "approved-index.jsonl"), "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)).filter((row) => row.status === "APPROVED_WTA_CHALLENGER_PBP" && row.tour === "WTA_CHALLENGER" && Boolean(row.match_id) && Boolean(String(row.date ?? "").slice(0, 10)) && Boolean(String(row.player1 ?? "").trim()) && Boolean(String(row.player2 ?? "").trim()) && norm(row.player1) !== norm(row.player2));
	} catch {
		return [];
	}
}
var SPECS = {
	ATP_MAIN: {
		dir: "bsd-atp-main-pbp-history",
		years: [
			2026,
			2025,
			2024
		],
		floor: "2024-01-01"
	},
	WTA_MAIN: {
		dir: "bsd-wta-main-pbp-history",
		years: [
			2026,
			2025,
			2024
		],
		floor: "2024-12-02"
	},
	ATP_CHALLENGER: {
		dir: "bsd-atp-challenger-pbp-history",
		years: [2026, 2025],
		floor: "2025-01-01"
	}
};
var BUNDLED_VERIFIED_EVIDENCE_INDEX_SAMPLES = {
	ATP_MAIN: {
		id: "ATP_MAIN",
		match_id: "verified-index:ATP_MAIN:43148",
		p1: "Alejandro Tabilo",
		p2: "Tiago Torres",
		date: "2026-07-22",
		tournament: "Estoril",
		surface: "clay",
		sampling_source: "verified_pbp_index"
	},
	WTA_MAIN: {
		id: "WTA_MAIN",
		match_id: "verified-index:WTA_MAIN:43309",
		p1: "Fiona Ferro",
		p2: "Erika Andreeva",
		date: "2026-07-22",
		tournament: "Palermo, Italy",
		surface: "clay",
		sampling_source: "verified_pbp_index"
	},
	ATP_CHALLENGER: {
		id: "ATP_CHALLENGER",
		match_id: "verified-index:ATP_CHALLENGER:31912",
		p1: "Leandro Riedi",
		p2: "Yunchaokete Bu",
		date: "2026-04-19",
		tournament: "Busan, South Korea",
		surface: "hard",
		sampling_source: "verified_pbp_index"
	},
	WTA_CHALLENGER: {
		id: "WTA_CHALLENGER",
		match_id: "approved-wta-challenger-pbp:24154",
		p1: "Lin Zhu",
		p2: "Lulu Sun",
		date: "2026-01-27",
		tournament: "WTA 125K Manila, Philippines Women Singles",
		surface: null,
		sampling_source: "verified_pbp_index"
	}
};
async function sampleVerifiedEvidenceIndexMatch(id) {
	if (id === "WTA_CHALLENGER") {
		const row = (await loadApprovedWtaChallenger()).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))[0];
		if (row) return {
			id,
			match_id: `approved-wta-challenger-pbp:${String(row.match_id)}`,
			p1: String(row.player1),
			p2: String(row.player2),
			date: String(row.date).slice(0, 10),
			tournament: String(row.tournament ?? "WTA 125 approved PBP match"),
			surface: null,
			sampling_source: "verified_pbp_index"
		};
	}
	const spec = SPECS[id];
	if (spec) for (const year of spec.years) {
		const row = (await load(join(process.cwd(), "data", "audit", spec.dir, String(year), "results.json"))).filter((r) => strictClass(r, id) && String(r.date).slice(0, 10) >= spec.floor).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))[0];
		if (!row) continue;
		return {
			id,
			match_id: `verified-index:${id}:${String(row.match_id)}`,
			p1: String(row.players[0]),
			p2: String(row.players[1]),
			date: String(row.date).slice(0, 10),
			tournament: String(row.tournament ?? `${id} verified PBP index match`),
			surface: row.surface ? String(row.surface) : null,
			sampling_source: "verified_pbp_index"
		};
	}
	return BUNDLED_VERIFIED_EVIDENCE_INDEX_SAMPLES[id] ?? null;
}
var USABLE = /* @__PURE__ */ new Set([
	"DIRECT",
	"RECONSTRUCTED",
	"PARTIAL"
]);
var DIAGNOSTIC_QUERY_CONCURRENCY = 6;
function classifyText(level, tournament, source = "") {
	const combined = `${String(level ?? "")} ${String(tournament ?? "")} ${String(source ?? "")}`.toLowerCase();
	if (/wta\s*125|wta125|125k|wta\s*chall(?:enger)?/.test(combined)) return "WTA_CHALLENGER";
	if (/challenger/.test(combined) && !/wta|women/.test(combined)) return "ATP_CHALLENGER";
	if (/wta|women/.test(combined) && !/challenger|125k/.test(combined)) return "WTA_MAIN";
	if (/atp|masters|grand slam|slam|250|500|1000/.test(combined) && !/challenger/.test(combined)) return "ATP_MAIN";
	return null;
}
function classifyTour(row) {
	return classifyText(row.event_level ?? row.parsed_event_level, row.tournament_name ?? row.parsed_tournament, row.parsed_tour);
}
async function hydrateParsedHints(rows) {
	const ids = [...new Set(rows.map((r) => r.active_summary_version_id).filter((v) => Boolean(v)))];
	if (!ids.length) return rows;
	const { data, error } = await tryQuery(() => db.select({
		summary_version_id: parsedSummaryFieldsTable.summary_version_id,
		field_key: parsedSummaryFieldsTable.field_key,
		normalized_value: parsedSummaryFieldsTable.normalized_value,
		raw_value: parsedSummaryFieldsTable.raw_value
	}).from(parsedSummaryFieldsTable).where(inArray(parsedSummaryFieldsTable.summary_version_id, ids)));
	if (error) throw new Error(`representative parsed-field sampling: ${error.message}`);
	const byVersion = /* @__PURE__ */ new Map();
	for (const field of data ?? []) {
		const value = String(field.normalized_value ?? field.raw_value ?? "").trim();
		if (!value) continue;
		const map = byVersion.get(field.summary_version_id) ?? /* @__PURE__ */ new Map();
		map.set(String(field.field_key).toLowerCase(), value);
		byVersion.set(field.summary_version_id, map);
	}
	return rows.map((row) => {
		const map = row.active_summary_version_id ? byVersion.get(row.active_summary_version_id) : null;
		return {
			...row,
			parsed_tournament: map?.get("tournament") ?? null,
			parsed_event_level: map?.get("event_level") ?? map?.get("level") ?? null,
			parsed_tour: map?.get("tour") ?? map?.get("circuit") ?? null,
			parsed_date: map?.get("scheduled_date") ?? map?.get("date") ?? null,
			parsed_surface: map?.get("surface") ?? null,
			parsed_round: map?.get("round") ?? null
		};
	});
}
function toRepresentative(id, row, sampling_source = "matches") {
	const tournament = row.tournament_name ?? row.parsed_tournament ?? `${id} production match`;
	const date = row.scheduled_date ?? row.parsed_date ?? row.created_at.slice(0, 10);
	const date_source = row.scheduled_date ? "scheduled_date" : row.parsed_date ? "parsed_summary" : "created_at";
	const surface = row.surface ?? row.parsed_surface ?? null;
	const level = row.event_level ?? row.parsed_event_level ?? id.replaceAll("_", " ");
	const context = [
		`Tournament: ${tournament}`,
		`Level: ${level}`,
		`Tour: ${row.parsed_tour ?? id.replaceAll("_", " ")}`,
		surface ? `Surface: ${surface}` : null,
		`Date: ${date}`,
		row.round ?? row.parsed_round ? `Round: ${row.round ?? row.parsed_round}` : null
	].filter(Boolean).join(" | ");
	return {
		id,
		match_id: row.id,
		p1: row.player1_name,
		p2: row.player2_name,
		date,
		date_source,
		tournament,
		context,
		event_level: row.event_level,
		surface,
		sampling_source
	};
}
function observationRepresentative(id, row, index) {
	const tournament = row.tournament ?? `${id} warehouse match`, date = row.event_date, surface = row.surface ?? null, level = id.replaceAll("_", " ");
	return {
		id,
		match_id: `warehouse:${id}:${index}`,
		p1: row.player_name,
		p2: row.opponent_name,
		date,
		date_source: "warehouse_event_date",
		tournament,
		context: [
			`Tournament: ${tournament}`,
			`Level: ${level}`,
			`Tour: ${level}`,
			surface ? `Surface: ${surface}` : null,
			`Date: ${date}`
		].filter(Boolean).join(" | "),
		event_level: level,
		surface,
		sampling_source: "source_observations"
	};
}
function persistedSurface(rows) {
	for (const row of rows) {
		if (codeOf(row.metric_code) !== "021") continue;
		const m = String(row.value_text ?? "").match(/match_surface_(hard|clay|grass|carpet)=1(?:\.0+)?/i);
		if (m) return m[1].toLowerCase();
	}
	return null;
}
function persistedPairRepresentative(id, rows, index) {
	const row = rows[0], date = row.as_of_date, level = id.replaceAll("_", " "), tournament = `${id} persisted evidence snapshot`, surface = persistedSurface(rows);
	const metricCount = new Set(rows.map((r) => codeOf(r.metric_code)).filter(Boolean)).size;
	return {
		id,
		match_id: `metric-evidence:${id}:${index}`,
		p1: row.player_name,
		p2: row.opponent_name,
		date,
		date_source: "persisted_as_of_date",
		tournament,
		context: [
			`Evidence sample: persisted metric pair`,
			`Persisted metrics: ${metricCount}`,
			`Level: ${level}`,
			`Tour: ${level}`,
			surface ? `Surface: ${surface}` : null,
			`Date: ${date}`
		].filter(Boolean).join(" | "),
		event_level: level,
		surface,
		sampling_source: "metric_evidence_store"
	};
}
function rankingTour(source) {
	const text = String(source ?? "").toLowerCase();
	if (text.includes("wta")) return "WTA_MAIN";
	if (text.includes("atp")) return "ATP_MAIN";
	return null;
}
async function classifyPairFromExactRankingEvidence(p1, p2) {
	const identities = await resolveCanonicalEvidencePair(p1, p2);
	if ([identities.p1.status, identities.p2.status].some((status) => status === "AMBIGUOUS" || status === "QUERY_FAILED" || status === "UNRESOLVED")) return null;
	const names = [identities.p1.canonical, identities.p2.canonical];
	const { data, error } = await tryQuery(() => db.select({
		player_name: sourceObservationsTable.player_name,
		source_name: sourceObservationsTable.source_name,
		source_id: sourceObservationsTable.source_id,
		observation_type: sourceObservationsTable.observation_type
	}).from(sourceObservationsTable).where(and(eq(sourceObservationsTable.observation_type, "RANKING"), inArray(sourceObservationsTable.player_name, names))).limit(100));
	if (error) return null;
	const sideTour = (name) => {
		const tours = [...new Set((data ?? []).filter((r) => r.player_name === name).map((r) => rankingTour(`${r.source_id ?? ""} ${r.source_name ?? ""}`)).filter(Boolean))];
		return tours.length === 1 ? tours[0] : null;
	};
	const p1Tour = sideTour(names[0]), p2Tour = sideTour(names[1]);
	return p1Tour && p1Tour === p2Tour ? p1Tour : null;
}
async function classifyFromExactRankingEvidence(row) {
	const tournament = String(row.tournament_name ?? row.parsed_tournament ?? "");
	if (/challenger|wta\s*125|wta125|125k/i.test(tournament)) return null;
	return classifyPairFromExactRankingEvidence(row.player1_name, row.player2_name);
}
async function representativeMatches() {
	const wanted = [
		"ATP_MAIN",
		"WTA_MAIN",
		"ATP_CHALLENGER",
		"WTA_CHALLENGER"
	], selected = [];
	const primary = await tryQuery(() => db.select().from(matchesTable).where(and(isNotNull(matchesTable.player1_name), isNotNull(matchesTable.player2_name))).orderBy(desc(matchesTable.created_at)).limit(1500));
	let candidates = [];
	if (!primary.error) {
		candidates = await hydrateParsedHints((primary.data ?? []).filter((r) => r.player1_name && r.player2_name));
		for (const id of wanted) {
			const row = candidates.find((candidate) => classifyTour(candidate) === id);
			if (row) selected.push(toRepresentative(id, row));
		}
	}
	const missing = () => wanted.filter((id) => !selected.some((m) => m.id === id));
	if (!primary.error && missing().some((id) => id === "ATP_MAIN" || id === "WTA_MAIN")) for (const row of candidates) {
		if (!missing().some((id) => id === "ATP_MAIN" || id === "WTA_MAIN")) break;
		if (classifyTour(row)) continue;
		const inferred = await classifyFromExactRankingEvidence(row);
		if (inferred && missing().includes(inferred)) selected.push(toRepresentative(inferred, row, "matches_plus_rankings"));
	}
	if (missing().length) {
		const fallback = await tryQuery(() => db.select().from(sourceObservationsTable).where(and(isNotNull(sourceObservationsTable.player_name), isNotNull(sourceObservationsTable.opponent_name), isNotNull(sourceObservationsTable.event_date))).orderBy(desc(sourceObservationsTable.event_date)).limit(5e3));
		if (fallback.error && primary.error) throw new Error(`production sampling failed: matches=${primary.error.message}; source_observations=${fallback.error.message}`);
		if (!fallback.error) {
			const rows = fallback.data ?? [];
			for (const id of missing()) {
				const row = rows.find((r) => r.player_name && r.opponent_name && r.event_date && r.player_name !== r.opponent_name && classifyText(r.sample_label, r.tournament, `${r.source_id} ${r.source_name}`) === id);
				if (row) selected.push(observationRepresentative(id, row, rows.indexOf(row)));
			}
		}
	}
	if (missing().some((id) => id === "ATP_MAIN" || id === "WTA_MAIN")) {
		const persisted = await tryQuery(() => db.select({
			player_name: metricEvidenceStoreTable.player_name,
			opponent_name: metricEvidenceStoreTable.opponent_name,
			as_of_date: metricEvidenceStoreTable.as_of_date,
			metric_code: metricEvidenceStoreTable.metric_code,
			value_text: metricEvidenceStoreTable.value_text,
			evidence_family: metricEvidenceStoreTable.evidence_family
		}).from(metricEvidenceStoreTable).where(and(isNotNull(metricEvidenceStoreTable.player_name), isNotNull(metricEvidenceStoreTable.opponent_name), isNotNull(metricEvidenceStoreTable.as_of_date))).orderBy(desc(metricEvidenceStoreTable.as_of_date)).limit(2e3));
		if (!persisted.error) {
			const grouped = /* @__PURE__ */ new Map();
			for (const row of persisted.data ?? []) {
				const p1 = String(row.player_name ?? "").trim(), p2 = String(row.opponent_name ?? "").trim(), date = String(row.as_of_date ?? "").trim();
				if (!p1 || !p2 || !date || p1 === p2) continue;
				const key = `${[p1, p2].sort().join("|")}|${date}`;
				const group = grouped.get(key) ?? [];
				group.push(row);
				grouped.set(key, group);
			}
			const groups = [...grouped.values()].sort((a, b) => {
				const ad = String(a[0]?.as_of_date ?? ""), bd = String(b[0]?.as_of_date ?? "");
				if (ad !== bd) return bd.localeCompare(ad);
				const ac = new Set(a.map((r) => codeOf(r.metric_code))).size;
				return new Set(b.map((r) => codeOf(r.metric_code))).size - ac;
			});
			for (let index = 0; index < groups.length && missing().some((id) => id === "ATP_MAIN" || id === "WTA_MAIN"); index++) {
				const group = groups[index], row = group[0];
				const inferred = await classifyPairFromExactRankingEvidence(row.player_name, row.opponent_name);
				if (inferred && missing().includes(inferred)) selected.push(persistedPairRepresentative(inferred, group, index));
			}
		}
	}
	if (missing().length) for (const id of missing()) {
		const row = await sampleVerifiedEvidenceIndexMatch(id);
		if (!row) continue;
		const level = id.replaceAll("_", " ");
		selected.push({
			id,
			match_id: row.match_id,
			p1: row.p1,
			p2: row.p2,
			date: row.date,
			date_source: "verified_index_date",
			tournament: row.tournament,
			context: [
				`Tournament: ${row.tournament}`,
				`Level: ${level}`,
				`Tour: ${level}`,
				row.surface ? `Surface: ${row.surface}` : null,
				`Date: ${row.date}`
			].filter(Boolean).join(" | "),
			event_level: level,
			surface: row.surface,
			sampling_source: row.sampling_source
		});
	}
	const class_proof = {};
	for (const id of wanted) {
		const proof = await sampleVerifiedEvidenceIndexMatch(id);
		if (proof) class_proof[id] = {
			match_id: proof.match_id,
			pair: `${proof.p1} vs ${proof.p2}`,
			date: proof.date,
			tournament: proof.tournament,
			surface: proof.surface
		};
	}
	const missingClasses = missing(), missing_class_reasons = {};
	for (const id of missingClasses) missing_class_reasons[id] = `No real persisted ${id} match, qualifying paired warehouse observation, ranking-proven current evidence snapshot, or validated repository representative was available for diagnostic sampling.`;
	return {
		matches: selected,
		missing_classes: missingClasses,
		missing_class_reasons,
		class_proof
	};
}
function usableEvidenceSide(treatment, value) {
	return USABLE.has(String(treatment ?? "")) && value !== null && value !== void 0 && String(value).trim() !== "";
}
function chooseEvidenceSide(stored, deterministic, repositoryPbp, internal, side) {
	const candidates = [
		{
			treatment: stored?.treatment,
			value: stored?.value_text,
			source: "stored"
		},
		{
			treatment: deterministic?.[`${side}_treatment`],
			value: deterministic?.[`${side}_value`],
			source: "deterministic"
		},
		{
			treatment: repositoryPbp?.[`${side}_treatment`],
			value: repositoryPbp?.[`${side}_value`],
			source: "repository_pbp"
		},
		{
			treatment: internal?.[`${side}_treatment`],
			value: internal?.[`${side}_value`],
			source: "certified_local"
		}
	];
	return candidates.find((candidate) => usableEvidenceSide(candidate.treatment, candidate.value)) ?? candidates.find((candidate) => candidate.treatment !== null && candidate.treatment !== void 0) ?? {
		treatment: "UNAVAILABLE",
		value: null,
		source: "none"
	};
}
function codeOf(value) {
	const match = String(value ?? "").match(/(\d{1,3})$/);
	return match ? match[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
async function activeMetrics() {
	const { data: docRows, error: docError } = await tryQuery(() => db.select({ active_version_id: ruleDocumentsTable.active_version_id }).from(ruleDocumentsTable).where(eq(ruleDocumentsTable.doc_type, "METRICS")).limit(1));
	if (docError) throw new Error(`metric document lookup: ${docError.message}`);
	const activeVersionId = docRows?.[0]?.active_version_id;
	if (!activeVersionId) throw new Error("No active METRICS rule document version");
	const { data, error } = await tryQuery(() => db.select({
		rule_code: rulesTable.rule_code,
		rule_name: rulesTable.rule_name,
		body: rulesTable.body
	}).from(rulesTable).where(eq(rulesTable.version_id, activeVersionId)).orderBy(asc(rulesTable.rule_code)));
	if (error) throw new Error(`metric rules lookup: ${error.message}`);
	return (data ?? []).filter((r) => Number(r.rule_code) >= 1 && Number(r.rule_code) <= 81 && classifyMetric(r.rule_code) !== "META_OR_NON_PLAYER" && classifyMetric(r.rule_code) !== "PROTECTED_UNAVAILABLE" && classifyMetric(r.rule_code) !== "MATRIX_SUMMARY_REQUIRED").map((r) => ({
		code: String(r.rule_code),
		name: String(r.rule_name),
		body: r.body ?? null
	}));
}
async function deterministic(metric, match) {
	const runners = [
		() => deterministicRankingMetric({
			metricCode: metric.code,
			p1: match.p1,
			p2: match.p2,
			asOfDate: match.date
		}),
		() => deterministicRulesContextMetric({
			metricCode: metric.code,
			p1: match.p1,
			p2: match.p2,
			asOfDate: match.date,
			context: match.context
		}),
		() => deterministicEnvironmentMetric({
			metricCode: metric.code,
			p1: match.p1,
			p2: match.p2,
			asOfDate: match.date,
			tournament: match.tournament
		}),
		() => deterministicMarketMetric({
			metricCode: metric.code,
			p1: match.p1,
			p2: match.p2,
			asOfDate: match.date
		}),
		() => deterministicPbpMetric({
			metricCode: metric.code,
			p1: match.p1,
			p2: match.p2,
			asOfDate: match.date
		}),
		() => deterministicResultsScheduleMetric({
			metricCode: metric.code,
			p1: match.p1,
			p2: match.p2,
			asOfDate: match.date,
			tournament: match.tournament
		})
	];
	const errors = [];
	for (const runner of runners) try {
		const row = await runner();
		if (row) return {
			row,
			errors
		};
	} catch (error) {
		errors.push(error instanceof Error ? error.message : String(error));
	}
	return {
		row: null,
		errors
	};
}
async function deterministicBatch(metrics, match) {
	const out = /* @__PURE__ */ new Map();
	for (let i = 0; i < metrics.length; i += DIAGNOSTIC_QUERY_CONCURRENCY) {
		const chunk = metrics.slice(i, i + DIAGNOSTIC_QUERY_CONCURRENCY);
		const rows = await Promise.all(chunk.map(async (metric) => [codeOf(metric.code), await deterministic(metric, match)]));
		for (const [code, result] of rows) out.set(code, result);
	}
	return out;
}
async function runEvidenceCoverageRuntimeDiagnostic() {
	const metrics = await activeMetrics();
	const expected = playerEvidenceDenominatorCodes().length;
	if (metrics.length !== expected) throw new Error(`Expected ${expected} active player-level metrics, found ${metrics.length}`);
	const sample = await representativeMatches();
	if (!sample.matches.length) throw new Error("No real persisted matches, paired warehouse observations, ranking-proven persisted evidence pairs, or verified PBP index matches were available for evidence coverage sampling");
	const matches = [];
	for (const sampled of sample.matches) {
		const identities = await resolveCanonicalEvidencePair(sampled.p1, sampled.p2);
		const match = {
			...sampled,
			p1: identities.p1.canonical,
			p2: identities.p2.canonical
		};
		const aliases = [.../* @__PURE__ */ new Set([...safeEvidenceAliases(match.p1, match.p2), ...safeEvidenceAliases(match.p2, match.p1)])];
		const identityPromise = match.sampling_source === "matches" || match.sampling_source === "matches_plus_rankings" ? tryQuery(() => db.select({
			id: matchesTable.id,
			player1_name: matchesTable.player1_name,
			player2_name: matchesTable.player2_name,
			event_level: matchesTable.event_level,
			scheduled_date: matchesTable.scheduled_date,
			surface: matchesTable.surface
		}).from(matchesTable).where(eq(matchesTable.id, match.match_id)).limit(1)) : Promise.resolve({
			data: [],
			error: null
		});
		const [identityResult, storedResult, packetResult] = await Promise.allSettled([
			identityPromise,
			tryQuery(() => db.select({
				metric_code: metricEvidenceStoreTable.metric_code,
				player_name: metricEvidenceStoreTable.player_name,
				opponent_name: metricEvidenceStoreTable.opponent_name,
				treatment: metricEvidenceStoreTable.treatment,
				value_text: metricEvidenceStoreTable.value_text,
				evidence_family: metricEvidenceStoreTable.evidence_family,
				sources: metricEvidenceStoreTable.sources,
				reliability: metricEvidenceStoreTable.reliability,
				sample_label: metricEvidenceStoreTable.sample_label
			}).from(metricEvidenceStoreTable).where(and(eq(metricEvidenceStoreTable.as_of_date, match.date), inArray(metricEvidenceStoreTable.metric_code, metrics.map((m) => codeOf(m.code))), inArray(metricEvidenceStoreTable.player_name, aliases), inArray(metricEvidenceStoreTable.opponent_name, aliases)))),
			buildMetricObservationContext({
				metrics,
				p1: match.p1,
				p2: match.p2,
				asOfDate: match.date,
				context: match.context
			})
		]);
		const identityError = identityResult.status === "rejected" ? String(identityResult.reason) : identityResult.value.error?.message ?? null, identityRows = identityResult.status === "fulfilled" ? identityResult.value.data ?? [] : [], storedError = storedResult.status === "rejected" ? String(storedResult.reason) : storedResult.value.error?.message ?? null, storedRows = storedResult.status === "fulfilled" ? storedResult.value.data ?? [] : [], packetError = packetResult.status === "rejected" ? String(packetResult.reason) : null, packet = packetResult.status === "fulfilled" ? packetResult.value : {};
		const localByCode = await deterministicBatch(metrics, match);
		const repositoryPbpByCode = new Map(metrics.map((metric) => {
			const code = codeOf(metric.code);
			return [code, deterministicPbpMetricFromPacket({
				metricCode: code,
				p1: match.p1,
				p2: match.p2,
				asOfDate: match.date,
				packet
			})];
		}));
		const certifiedLocalRows = localMetricRows(match.p1, match.p2, match.context, metrics).map((row, index) => certifyMetricFinding(enforceFiveMetricWiring(metrics[index], row)));
		const certifiedLocalByCode = new Map(certifiedLocalRows.map((row) => [codeOf(row.metric_code), row]));
		const historicalLocalByCode = new Map(metrics.map((metric) => [codeOf(metric.code), completionSweepHistoricalFinding({
			p1: match.p1,
			p2: match.p2,
			context: match.context
		}, metric)]));
		const details = [];
		for (const metric of metrics) {
			const code = codeOf(metric.code), policy = policyForMetric(code), entry = packet[code] ?? null, p1Stored = storedRows.find((r) => codeOf(r.metric_code) === code && evidencePairMatches(r.player_name, r.opponent_name, match.p1, match.p2)) ?? null, p2Stored = storedRows.find((r) => codeOf(r.metric_code) === code && evidencePairMatches(r.player_name, r.opponent_name, match.p2, match.p1)) ?? null, local = localByCode.get(code) ?? {
				row: null,
				errors: []
			}, repositoryPbp = repositoryPbpByCode.get(code) ?? null, internal = certifiedLocalByCode.get(code) ?? null, historicalInternal = historicalLocalByCode.get(code) ?? null, p1Internal = usableEvidenceSide(internal?.p1_treatment, internal?.p1_value) ? internal : usableEvidenceSide(historicalInternal?.p1_treatment, historicalInternal?.p1_value) ? historicalInternal : internal ?? historicalInternal, p2Internal = usableEvidenceSide(internal?.p2_treatment, internal?.p2_value) ? internal : usableEvidenceSide(historicalInternal?.p2_treatment, historicalInternal?.p2_value) ? historicalInternal : internal ?? historicalInternal, p1Chosen = chooseEvidenceSide(p1Stored, local.row, repositoryPbp, p1Internal, "p1"), p2Chosen = chooseEvidenceSide(p2Stored, local.row, repositoryPbp, p2Internal, "p2");
			const p1Treatment = String(p1Chosen.treatment ?? "UNAVAILABLE"), p2Treatment = String(p2Chosen.treatment ?? "UNAVAILABLE"), p1Usable = usableEvidenceSide(p1Treatment, p1Chosen.value), p2Usable = usableEvidenceSide(p2Treatment, p2Chosen.value), pairUsable = p1Usable && p2Usable, oneSidedUsable = p1Usable !== p2Usable;
			let bucket = null, reason = null;
			if (!pairUsable) {
				const queryErrors = [
					storedError,
					packetError,
					...local.errors
				].filter(Boolean);
				if (queryErrors.length) {
					bucket = "EVIDENCE_QUERY_FAILURE";
					reason = queryErrors.join(" | ");
				} else if (oneSidedUsable) {
					bucket = "COVERAGE_CREDIT_FAILURE";
					reason = `One-sided usable evidence cannot count as pair-complete coverage (P1=${p1Treatment}, P2=${p2Treatment}).`;
				} else if ((entry?.observations?.length ?? 0) > 0 && policy.allowed_families.includes("RESULTS_SCHEDULE") && !(entry.observations ?? []).some((o) => Boolean(o?.player))) {
					bucket = "INGESTION_MISSING";
					reason = "Only shared tournament/schedule context is present; player-specific match evidence required by this metric has not been ingested.";
				} else if ((entry?.observations?.length ?? 0) > 0 && entry?.direct_satisfaction_allowed) {
					bucket = "EVIDENCE_WIRING_FAILURE";
					reason = "Sufficient admissible observations exist but did not become a usable deterministic/stored finding.";
				} else if ((entry?.observations?.length ?? 0) > 0) {
					bucket = "RECONSTRUCTION_FAILURE";
					reason = "Support-only admissible observations exist but no permitted deterministic reconstruction recovered the metric.";
				} else if (policy.allowed_families.length) {
					bucket = "INGESTION_MISSING";
					reason = `A structured path exists for ${policy.allowed_families.join(",")} but no admissible warehouse observation was ingested for this matchup/window.`;
				} else {
					bucket = "SOURCE_MISSING";
					reason = "No provider-independent structured source-family path is registered for this metric.";
				}
			}
			details.push({
				metric_code: code,
				metric_name: metric.name,
				source_expected: policy.allowed_families,
				observed_families: Array.isArray(entry?.observed_families) ? entry.observed_families : [],
				warehouse_observation_count: Number(entry?.observations?.length ?? 0),
				stored_p1: Boolean(p1Stored),
				stored_p2: Boolean(p2Stored),
				stored_p1_family: p1Stored?.evidence_family ?? null,
				stored_p2_family: p2Stored?.evidence_family ?? null,
				stored_p1_source_count: Array.isArray(p1Stored?.sources) ? p1Stored.sources.length : 0,
				stored_p2_source_count: Array.isArray(p2Stored?.sources) ? p2Stored.sources.length : 0,
				stored_p1_reliability: p1Stored?.reliability ?? null,
				stored_p2_reliability: p2Stored?.reliability ?? null,
				stored_p1_has_sample: Boolean(p1Stored?.sample_label),
				stored_p2_has_sample: Boolean(p2Stored?.sample_label),
				p1_treatment: p1Treatment,
				p2_treatment: p2Treatment,
				p1_credited: p1Usable,
				p2_credited: p2Usable,
				pair_credited: pairUsable,
				one_sided_usable: oneSidedUsable,
				deterministic_family: repositoryPbp?.evidence_family ?? local.row?.evidence_family ?? internal?.evidence_family ?? historicalInternal?.evidence_family ?? null,
				local_internal_p1: Boolean(internal?.p1_value),
				local_internal_p2: Boolean(internal?.p2_value),
				historical_local_p1: Boolean(historicalInternal?.p1_value),
				historical_local_p2: Boolean(historicalInternal?.p2_value),
				credited_source_p1: p1Usable ? p1Chosen.source : null,
				credited_source_p2: p2Usable ? p2Chosen.source : null,
				failure_bucket: bucket,
				reason
			});
		}
		const buckets = {};
		for (const row of details) if (row.failure_bucket) buckets[row.failure_bucket] = (buckets[row.failure_bucket] ?? 0) + 1;
		const p1Credited = details.filter((r) => r.p1_credited).length, p2Credited = details.filter((r) => r.p2_credited).length, pairCredited = details.filter((r) => r.pair_credited).length, oneSided = details.filter((r) => r.one_sided_usable).length, falseGreens = details.filter((r) => r.one_sided_usable && r.pair_credited).length;
		matches.push({
			id: match.id,
			match_id: match.match_id,
			pair: `${match.p1} vs ${match.p2}`,
			tournament: match.tournament,
			scheduled_date: match.date,
			date_source: match.date_source,
			event_level: match.event_level,
			surface: match.surface,
			sampling_source: match.sampling_source,
			canonical_identity_resolution: identities,
			identity: {
				exact_match_count: identityRows.length,
				query_error: identityError,
				blocks_evidence_classification: false
			},
			query_errors: [storedError, packetError].filter(Boolean),
			coverage: {
				p1: p1Credited,
				p2: p2Credited,
				pair: pairCredited,
				one_sided: oneSided,
				p1_percent: Number((100 * p1Credited / 81).toFixed(2)),
				p2_percent: Number((100 * p2Credited / 81).toFixed(2)),
				pair_percent: Number((100 * pairCredited / 81).toFixed(2))
			},
			false_green_guard: {
				passed: falseGreens === 0,
				false_green_metric_count: falseGreens,
				one_sided_metric_count: oneSided
			},
			failure_buckets: buckets,
			metrics: details
		});
	}
	const runtimeIndex = loadRuntimeIndex();
	const runtime_index_status = {
		loaded: Boolean(runtimeIndex.generatedAt),
		loaded_generated_at: runtimeIndex.generatedAt || null,
		atp_player_count: Object.keys(runtimeIndex.ATP).length,
		wta_player_count: Object.keys(runtimeIndex.WTA).length,
		wta_main_history_player_count: Object.keys(runtimeIndex.matchHistory.WTA_MAIN).length,
		wta_challenger_history_player_count: Object.keys(runtimeIndex.matchHistory.WTA_CHALLENGER).length
	};
	return {
		schema_version: 11,
		generated_at: (/* @__PURE__ */ new Date()).toISOString(),
		runtime_index_status,
		metrics: metrics.length,
		sampling: {
			source: "REAL_PERSISTED_MATCHES_WITH_WAREHOUSE_PERSISTED_PAIR_VERIFIED_INDEX_CERTIFIED_LOCAL_AND_COMPLETION_HISTORICAL_FALLBACK",
			requested_classes: [
				"ATP_MAIN",
				"WTA_MAIN",
				"ATP_CHALLENGER",
				"WTA_CHALLENGER"
			],
			sampled_classes: matches.map((m) => m.id),
			missing_classes: sample.missing_classes,
			missing_class_reasons: sample.missing_class_reasons,
			class_proof: sample.class_proof
		},
		matches
	};
}
function allMetricFamilyAudit() {
	return Array.from({ length: 81 }, (_, index) => String(index + 1).padStart(3, "0")).map((metric_code) => {
		const policy = policyForMetric(metric_code);
		return {
			metric_code,
			allowed_families: policy.allowed_families,
			sufficient_families: policy.sufficient_families,
			support_only_families: policy.support_only_families ?? []
		};
	});
}
function classifyEvidenceAvailability(signals) {
	if (signals.pairCredited) {
		if (signals.p1Treatment === "PARTIAL" || signals.p2Treatment === "PARTIAL") return "PARTIALLY_POPULATED";
		return "EVIDENCE_RETRIEVES_CORRECTLY";
	}
	if (signals.identityQueryFailed || signals.dbLookupFailed) return "DB_EVIDENCE_LOOKUP_FAILURE";
	if (signals.identityBlocked) return "CANONICAL_IDENTITY_FAILURE";
	if (signals.tourClassified === false) return "TOUR_CLASSIFICATION_FAILURE";
	if (signals.canonicalMatchFound === false) return "MATCH_JOIN_FAILURE";
	if (signals.p1Credited !== signals.p2Credited) return "PARTIALLY_POPULATED";
	const families = new Set(signals.observedFamilies ?? []);
	if (families.has("POINT_BY_POINT")) return "PBP_EXISTS_NOT_WIRED";
	if (families.has("MARKET")) return "MARKET_EXISTS_NOT_WIRED";
	if (families.size > 0) return "OBSERVED_EVIDENCE_NOT_RECONSTRUCTED";
	if ((signals.repositoryEvidenceKnown ?? false) && !(signals.repositoryEvidenceExposed ?? false)) return "REPOSITORY_EVIDENCE_NOT_EXPOSED";
	if ((signals.storedCandidateCount ?? 0) > 0) return "DB_EVIDENCE_LOOKUP_FAILURE";
	return "GENUINELY_UNAVAILABLE";
}
var SOFTWARE_LOSS = /* @__PURE__ */ new Set([
	"REPOSITORY_EVIDENCE_NOT_EXPOSED",
	"DB_EVIDENCE_LOOKUP_FAILURE",
	"CANONICAL_IDENTITY_FAILURE",
	"MATCH_JOIN_FAILURE",
	"TOUR_CLASSIFICATION_FAILURE",
	"PBP_EXISTS_NOT_WIRED",
	"MARKET_EXISTS_NOT_WIRED",
	"OBSERVED_EVIDENCE_NOT_RECONSTRUCTED"
]);
function summarizeRecoverableCeiling(classes) {
	const total = classes.length;
	const retrieved = classes.filter((value) => value === "EVIDENCE_RETRIEVES_CORRECTLY" || value === "PARTIALLY_POPULATED").length;
	const softwareLoss = classes.filter((value) => SOFTWARE_LOSS.has(value)).length;
	const genuinelyUnavailable = classes.filter((value) => value === "GENUINELY_UNAVAILABLE").length;
	const pct = (value) => total ? Number((100 * value / total).toFixed(2)) : 0;
	return {
		total,
		retrieved,
		software_loss: softwareLoss,
		genuinely_unavailable: genuinelyUnavailable,
		retrieved_percent: pct(retrieved),
		software_loss_percent: pct(softwareLoss),
		genuine_source_unavailability_percent: pct(genuinelyUnavailable),
		maximum_recoverable_ceiling_percent: pct(total - genuinelyUnavailable)
	};
}
function classFromRuntimeMetric(match, metric) {
	if (metric.pair_credited) return classifyEvidenceAvailability({
		pairCredited: true,
		p1Credited: Boolean(metric.p1_credited),
		p2Credited: Boolean(metric.p2_credited),
		p1Treatment: metric.p1_treatment,
		p2Treatment: metric.p2_treatment
	});
	if (metric.failure_bucket === "IDENTITY_MATCH_FAILURE") return "CANONICAL_IDENTITY_FAILURE";
	if (metric.failure_bucket === "EVIDENCE_QUERY_FAILURE" || metric.failure_bucket === "NORMALIZATION_FAILURE") return "DB_EVIDENCE_LOOKUP_FAILURE";
	if (metric.failure_bucket === "COVERAGE_CREDIT_FAILURE") return "PARTIALLY_POPULATED";
	if (match?.sampling_source === "matches" && match?.identity?.exact_match_count !== 1) return "MATCH_JOIN_FAILURE";
	if (!match?.id) return "TOUR_CLASSIFICATION_FAILURE";
	const observedFamilies = Array.isArray(metric.observed_families) ? metric.observed_families : [];
	if (["EVIDENCE_WIRING_FAILURE", "RECONSTRUCTION_FAILURE"].includes(metric.failure_bucket)) return classifyEvidenceAvailability({
		pairCredited: false,
		p1Credited: Boolean(metric.p1_credited),
		p2Credited: Boolean(metric.p2_credited),
		p1Treatment: metric.p1_treatment,
		p2Treatment: metric.p2_treatment,
		observedFamilies,
		repositoryEvidenceKnown: metric.repository_evidence_known === true,
		repositoryEvidenceExposed: metric.repository_evidence_exposed === true,
		storedCandidateCount: Number(metric.stored_candidate_count ?? 0)
	});
	return "GENUINELY_UNAVAILABLE";
}
var PLAYER_DENOMINATOR_CODES = new Set(playerEvidenceDenominatorCodes());
function enrichEvidenceCoverageAccounting(report) {
	const matches = (report.matches ?? []).map((match) => {
		const metrics = (match.metrics ?? []).map((metric) => {
			const metric_classification = classifyMetric(String(metric.metric_code));
			const availability_class = metric_classification === "META_OR_NON_PLAYER" || metric_classification === "PROTECTED_UNAVAILABLE" || metric_classification === "MATRIX_SUMMARY_REQUIRED" ? metric_classification : classFromRuntimeMetric(match, metric);
			return {
				...metric,
				metric_classification,
				availability_class
			};
		});
		const classes = metrics.map((metric) => metric.availability_class);
		const byClass = {};
		for (const value of classes) byClass[value] = (byClass[value] ?? 0) + 1;
		const playerMetrics = metrics.filter((metric) => PLAYER_DENOMINATOR_CODES.has(String(metric.metric_code)));
		const playerCredited = playerMetrics.filter((metric) => metric.pair_credited).length;
		return {
			...match,
			metrics,
			availability_accounting: {
				by_class: byClass,
				...summarizeRecoverableCeiling(classes)
			},
			player_evidence_coverage: {
				legitimate_player_metrics: playerMetrics.length,
				usable_cells: playerCredited,
				percent: playerMetrics.length ? Number((100 * playerCredited / playerMetrics.length).toFixed(2)) : 0
			}
		};
	});
	const allClasses = matches.flatMap((match) => match.metrics.map((metric) => metric.availability_class));
	const allPlayerMetrics = matches.flatMap((match) => match.metrics.filter((metric) => PLAYER_DENOMINATOR_CODES.has(String(metric.metric_code))));
	const totalPlayerCells = allPlayerMetrics.length;
	const usablePlayerCells = allPlayerMetrics.filter((metric) => metric.pair_credited).length;
	return {
		...report,
		metric_family_audit: allMetricFamilyAudit(),
		metric_universe_accounting: metricUniverseAccounting(),
		availability_accounting: {
			scope: "FOUR_TOUR_REPRESENTATIVE_METRICS",
			...summarizeRecoverableCeiling(allClasses)
		},
		player_evidence_coverage: {
			scope: "FOUR_TOUR_REPRESENTATIVE_METRICS_LEGITIMATE_PLAYER_METRICS_ONLY",
			total_player_metric_tour_cells: totalPlayerCells,
			usable_player_metric_tour_cells: usablePlayerCells,
			percent: totalPlayerCells ? Number((100 * usablePlayerCells / totalPlayerCells).toFixed(2)) : 0
		},
		matches
	};
}
function json$1(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
var Route$12 = createFileRoute("/api/evidence-coverage-diagnostic")({ server: { handlers: { GET: async ({ request }) => {
	const auth = checkApiKey("EVIDENCE_COVERAGE_KEY", new URL(request.url).searchParams.get("key"));
	if (!auth.ok) return json$1(auth.body, auth.status);
	try {
		return json$1({
			ok: true,
			report: enrichEvidenceCoverageAccounting(await runEvidenceCoverageRuntimeDiagnostic())
		});
	} catch (error) {
		return json$1({
			ok: false,
			error: error instanceof Error ? error.message : String(error)
		}, 500);
	}
} } } });
/**
* Upserts observations on (source_id, source_record_key).
*
* `ignoreDuplicates` maps PostgREST's option of the same name: true means DO NOTHING (the
* first write of a record wins and re-ingesting is inert), false means DO UPDATE (a
* re-ingest refreshes the row). The distinction is not cosmetic -- the rankings, results
* and WTA feeds relied on DO NOTHING to make a repeated pull idempotent, while the rules
* feed relied on DO UPDATE to let corrected text overwrite -- so it is preserved per caller
* rather than unified.
*/
async function upsertObservations(rows, options) {
	if (!rows.length) return 0;
	const insert = db.insert(sourceObservationsTable).values(rows);
	await (options.ignoreDuplicates ? insert.onConflictDoNothing({ target: [sourceObservationsTable.source_id, sourceObservationsTable.source_record_key] }) : insert.onConflictDoUpdate({
		target: [sourceObservationsTable.source_id, sourceObservationsTable.source_record_key],
		set: excludedSet(sourceObservationsTable, rows, ["source_id", "source_record_key"])
	}));
	return rows.length;
}
/**
* Which of `keys` are actually present for this source.
*
* The feeds use this to count what a DO NOTHING upsert really wrote, rather than trusting
* the number of rows they submitted.
*/
async function confirmObservationKeys(sourceId, keys) {
	if (!keys.length) return [];
	return (await db.select({ source_record_key: sourceObservationsTable.source_record_key }).from(sourceObservationsTable).where(and(eq(sourceObservationsTable.source_id, sourceId), inArray(sourceObservationsTable.source_record_key, keys)))).map((r) => r.source_record_key).filter((k) => k !== null);
}
/** Enabled ingestion targets for a source, in no particular order (as before). */
async function enabledTargets(sourceId) {
	return await db.select({
		id: ingestionTargetsTable.id,
		source_id: ingestionTargetsTable.source_id,
		target_key: ingestionTargetsTable.target_key,
		pullback_start: ingestionTargetsTable.pullback_start,
		pullback_end: ingestionTargetsTable.pullback_end,
		config: ingestionTargetsTable.config
	}).from(ingestionTargetsTable).where(and(eq(ingestionTargetsTable.source_id, sourceId), eq(ingestionTargetsTable.enabled, true)));
}
/**
* Enabled targets that carry coordinates. The weather feed needs a venue to query, so a
* target with a null latitude or longitude is skipped rather than pulled -- that filter was
* `.not("latitude", "is", null)` before and is a real one, not a tidy-up.
*/
async function enabledGeoTargets(sourceId) {
	return await db.select({
		id: ingestionTargetsTable.id,
		source_id: ingestionTargetsTable.source_id,
		target_key: ingestionTargetsTable.target_key,
		pullback_start: ingestionTargetsTable.pullback_start,
		pullback_end: ingestionTargetsTable.pullback_end,
		config: ingestionTargetsTable.config,
		latitude: ingestionTargetsTable.latitude,
		longitude: ingestionTargetsTable.longitude,
		timezone: ingestionTargetsTable.timezone,
		tournament: ingestionTargetsTable.tournament
	}).from(ingestionTargetsTable).where(and(eq(ingestionTargetsTable.source_id, sourceId), eq(ingestionTargetsTable.enabled, true), isNotNull(ingestionTargetsTable.latitude), isNotNull(ingestionTargetsTable.longitude)));
}
/** Stamps a target as pulled. Both timestamps move together, as they did before. */
async function markTargetIngested(targetId) {
	const now = (/* @__PURE__ */ new Date()).toISOString();
	await db.update(ingestionTargetsTable).set({
		last_ingested_at: now,
		updated_at: now
	}).where(eq(ingestionTargetsTable.id, targetId));
}
/** Opens a run row and returns its id. */
async function startIngestionRun(sourceId, jobType) {
	const [run] = await db.insert(sourceIngestionRunsTable).values({
		source_id: sourceId,
		job_type: jobType,
		status: "RUNNING",
		started_at: (/* @__PURE__ */ new Date()).toISOString()
	}).returning({ id: sourceIngestionRunsTable.id });
	if (!run) throw new Error("Could not open an ingestion run: the insert returned no row.");
	return run.id;
}
async function completeIngestionRun(runId, written, metadata) {
	await db.update(sourceIngestionRunsTable).set({
		status: "COMPLETE",
		records_seen: written,
		records_inserted: written,
		metadata,
		completed_at: (/* @__PURE__ */ new Date()).toISOString()
	}).where(eq(sourceIngestionRunsTable.id, runId));
}
async function failIngestionRun(runId, message) {
	await db.update(sourceIngestionRunsTable).set({
		status: "FAILED",
		error_message: message,
		completed_at: (/* @__PURE__ */ new Date()).toISOString()
	}).where(eq(sourceIngestionRunsTable.id, runId));
}
var HOURLY = [
	"temperature_2m",
	"relative_humidity_2m",
	"precipitation",
	"pressure_msl",
	"surface_pressure",
	"wind_speed_10m",
	"wind_direction_10m",
	"wind_gusts_10m"
].join(",");
function fiveYearsAgo() {
	const d = /* @__PURE__ */ new Date();
	d.setUTCFullYear(d.getUTCFullYear() - 5);
	return d.toISOString().slice(0, 10);
}
async function ingestOpenMeteoHistorical() {
	const targets = await enabledGeoTargets("open_meteo");
	let written = 0;
	for (const target of targets ?? []) {
		const start = target.pullback_start ?? fiveYearsAgo();
		const end = target.pullback_end ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
		const url = `https://archive-api.open-meteo.com/v1/archive?${new URLSearchParams({
			latitude: String(target.latitude),
			longitude: String(target.longitude),
			start_date: start,
			end_date: end,
			hourly: HOURLY,
			timezone: target.timezone ?? "auto"
		})}`;
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${await res.text()}`);
		const json = await res.json();
		const times = json?.hourly?.time ?? [];
		const rows = [];
		for (let i = 0; i < times.length; i++) for (const key of HOURLY.split(",")) {
			const value = json?.hourly?.[key]?.[i];
			if (value === null || value === void 0) continue;
			rows.push({
				source_id: "open_meteo",
				source_name: "Open-Meteo Historical Weather",
				source_url: url,
				source_record_key: `${target.target_key}:${times[i]}:${key}`,
				tournament: target.tournament,
				event_date: String(times[i]).slice(0, 10),
				observation_type: "ENVIRONMENT",
				observation_key: key,
				numeric_value: Number(value),
				unit: json?.hourly_units?.[key] ?? null,
				sample_label: "hourly",
				window_start: start,
				window_end: end,
				raw_payload: {
					time: times[i],
					value,
					unit: json?.hourly_units?.[key] ?? null
				},
				provenance: {
					target_key: target.target_key,
					latitude: target.latitude,
					longitude: target.longitude,
					timezone: json?.timezone ?? target.timezone
				}
			});
		}
		for (let i = 0; i < rows.length; i += 1e3) {
			const chunk = rows.slice(i, i + 1e3);
			written += await upsertObservations(chunk, { ignoreDuplicates: false });
		}
		await markTargetIngested(target.id);
	}
	return {
		targets: targets.length,
		observations_written: written
	};
}
var HOST = "https://api.the-odds-api.com";
var EARLIEST = "2020-06-06T00:00:00Z";
function apiKey() {
	const key = process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY;
	if (!key) throw new Error("The Odds API historical ingestion requires THE_ODDS_API_KEY or ODDS_API_KEY.");
	return key;
}
async function getJson(path, params) {
	const qs = new URLSearchParams({
		apiKey: apiKey(),
		...params
	});
	const res = await fetch(`${HOST}${path}?${qs}`);
	if (!res.ok) throw new Error(`The Odds API ${res.status}: ${await res.text()}`);
	return await res.json();
}
async function discoverTennisSports() {
	return (await getJson("/v4/sports/", { all: "true" })).filter((sport) => sport.key.startsWith("tennis_"));
}
function clampDate(value) {
	if (!value || new Date(value) < /* @__PURE__ */ new Date(EARLIEST)) return EARLIEST;
	return new Date(value).toISOString();
}
async function ingestOddsHistorical(options = {}) {
	const from = clampDate(options.from ?? process.env.ODDS_BACKFILL_FROM);
	const to = new Date(options.to ?? process.env.ODDS_BACKFILL_TO ?? (/* @__PURE__ */ new Date()).toISOString()).toISOString();
	const maxRequests = Math.max(1, Number(options.maxRequests ?? process.env.ODDS_MAX_REQUESTS ?? 25));
	const regions = options.regions ?? process.env.ODDS_REGIONS ?? "us";
	const markets = options.markets ?? process.env.ODDS_MARKETS ?? "h2h";
	const sports = await discoverTennisSports();
	let requests = 0;
	let observations = 0;
	for (const sport of sports) {
		if (requests >= maxRequests) break;
		let cursor = to;
		while (new Date(cursor) >= new Date(from) && requests < maxRequests) {
			const snap = await getJson(`/v4/historical/sports/${sport.key}/odds`, {
				regions,
				markets,
				oddsFormat: "decimal",
				date: cursor
			});
			requests += 1;
			const rows = [];
			for (const event of snap.data ?? []) for (const book of event.bookmakers ?? []) for (const market of book.markets ?? []) for (const outcome of market.outcomes ?? []) rows.push({
				source_id: "odds_api",
				source_name: "The Odds API Historical Data",
				source_url: "https://the-odds-api.com/historical-odds-data/",
				source_record_key: `${snap.timestamp}:${event.id}:${book.key}:${market.key}:${outcome.name}`,
				player_name: outcome.name,
				opponent_name: outcome.name === event.home_team ? event.away_team : event.home_team,
				event_date: event.commence_time.slice(0, 10),
				observation_type: "MARKET",
				observation_key: `${market.key}_decimal_odds`,
				numeric_value: Number(outcome.price),
				unit: "decimal_odds",
				sample_label: `snapshot=${snap.timestamp};bookmaker=${book.title}`,
				window_start: from.slice(0, 10),
				window_end: to.slice(0, 10),
				source_published_at: market.last_update ?? book.last_update ?? snap.timestamp,
				raw_payload: {
					sport_key: event.sport_key,
					event_id: event.id,
					commence_time: event.commence_time,
					bookmaker: book,
					market: market.key,
					outcome
				},
				provenance: {
					snapshot_timestamp: snap.timestamp,
					sport_key: sport.key,
					bookmaker_key: book.key,
					market_key: market.key
				}
			});
			for (let i = 0; i < rows.length; i += 500) {
				const chunk = rows.slice(i, i + 500);
				observations += await upsertObservations(chunk, { ignoreDuplicates: false });
			}
			if (!snap.previous_timestamp) break;
			cursor = snap.previous_timestamp;
		}
	}
	return {
		sports: sports.map((s) => s.key),
		requests,
		observations_written: observations,
		from,
		to,
		max_requests: maxRequests
	};
}
var DEFAULT_URLS$2 = {
	atp: "https://www.atptour.com/en/scores/current",
	wta: "https://www.wtatennis.com/tournaments",
	atp_challenger: "https://www.atptour.com/en/scores/current"
};
var SOURCE_NAMES$2 = {
	atp: "ATP Tour Official",
	wta: "WTA Official",
	atp_challenger: "ATP Challenger Tour Official"
};
var WTA_TOURNAMENT_API$1 = "https://api.wtatennis.com/tennis/tournaments";
function asString(value) {
	if (typeof value === "string" && value.trim()) return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return null;
}
function first$1(obj, keys) {
	for (const key of keys) {
		const value = asString(obj[key]);
		if (value) return value;
	}
	return null;
}
function deepFirst$1(obj, keys, depth = 0) {
	const direct = first$1(obj, keys);
	if (direct) return direct;
	if (depth >= 3) return null;
	for (const value of Object.values(obj)) if (value && typeof value === "object" && !Array.isArray(value)) {
		const found = deepFirst$1(value, keys, depth + 1);
		if (found) return found;
	}
	return null;
}
function isoDate(value) {
	if (!value) return null;
	const m = value.match(/(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
	return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
}
function collectObjects(value, out, depth = 0) {
	if (depth > 12 || value == null) return;
	if (Array.isArray(value)) {
		for (const item of value) collectObjects(item, out, depth + 1);
		return;
	}
	if (typeof value !== "object") return;
	const obj = value;
	out.push(obj);
	for (const child of Object.values(obj)) collectObjects(child, out, depth + 1);
}
function embeddedJson(html) {
	const values = [];
	for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
		const body = match[1]?.trim();
		if (!body || !body.startsWith("{") && !body.startsWith("[")) continue;
		try {
			values.push(JSON.parse(body));
		} catch {}
	}
	return values;
}
function decodeHtml(value) {
	return value.replace(/&amp;/gi, "&").replace(/&#39;/g, "'").replace(/&quot;/gi, "\"").replace(/&nbsp;/gi, " ");
}
function stripTags(value) {
	return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
function targetYears(target) {
	const now = (/* @__PURE__ */ new Date()).getUTCFullYear();
	const start = Number((target.pullback_start ?? `${now}-01-01`).slice(0, 4));
	const end = Number((target.pullback_end ?? `${now}-12-31`).slice(0, 4));
	const lo = Number.isFinite(start) ? Math.min(start, end) : now, hi = Number.isFinite(end) ? Math.max(start, end) : now;
	const years = [];
	for (let year = lo; year <= hi; year++) years.push(year);
	return years;
}
function levelText(obj) {
	return deepFirst$1(obj, [
		"level",
		"Level",
		"eventLevel",
		"EventLevel",
		"category",
		"Category",
		"tournamentLevel",
		"TournamentLevel",
		"type",
		"Type",
		"TournamentClass",
		"tournamentClass",
		"levelName",
		"levelLabel"
	]);
}
function isChallengerLevel(level) {
	return !!level && (/challenger/i.test(level) || /\bch\b/i.test(level));
}
function isWtaMainLevel$1(level) {
	if (!level) return false;
	const normalized = level.replace(/[_-]+/g, " ").trim();
	if (/(^|\D)125\s*k?\b|wta\s*125|challenger|itf/i.test(normalized)) return false;
	return /grand\s*slam|tour\s*finals|wta\s*finals|1000|500|250|premier|international|wta/i.test(normalized);
}
function sourceMatchesTour(source, obj) {
	const level = levelText(obj);
	if (source === "wta") return isWtaMainLevel$1(level);
	if (source === "atp_challenger") return isChallengerLevel(level);
	return !isChallengerLevel(level);
}
function normalizedFromObject(source, url, target, obj) {
	if (!sourceMatchesTour(source, obj)) return [];
	const player1 = deepFirst$1(obj, [
		"player1",
		"Player1",
		"playerOne",
		"homePlayer",
		"competitor1",
		"winnerName",
		"playerA",
		"participant1"
	]);
	const player2 = deepFirst$1(obj, [
		"player2",
		"Player2",
		"playerTwo",
		"awayPlayer",
		"competitor2",
		"loserName",
		"playerB",
		"participant2"
	]);
	const tournament = deepFirst$1(obj, [
		"tournament",
		"Tournament",
		"tournamentName",
		"TournamentName",
		"event",
		"eventName",
		"competitionName",
		"SponsorTitle",
		"TournamentTitle",
		"title",
		"name",
		"Name"
	]);
	const dateRaw = deepFirst$1(obj, [
		"date",
		"Date",
		"matchDate",
		"startDate",
		"StartDate",
		"startTime",
		"scheduledAt",
		"eventDate",
		"EventDate",
		"FormattedDate"
	]);
	const endDateRaw = deepFirst$1(obj, ["endDate", "EndDate"]);
	const eventDate = isoDate(dateRaw);
	const surface = deepFirst$1(obj, [
		"surface",
		"Surface",
		"courtSurface",
		"CourtSurface"
	]);
	const round = deepFirst$1(obj, [
		"round",
		"Round",
		"roundName",
		"stage"
	]);
	const status = deepFirst$1(obj, [
		"status",
		"Status",
		"matchStatus",
		"state"
	]);
	const score = deepFirst$1(obj, [
		"score",
		"Score",
		"scoreText",
		"result"
	]);
	const winner = deepFirst$1(obj, [
		"winner",
		"Winner",
		"winnerName"
	]);
	const looksLikeMatch = Boolean(player1 && player2);
	const looksLikeSchedule = Boolean(tournament && (eventDate || dateRaw));
	if (!looksLikeMatch && !looksLikeSchedule) return [];
	const identity = [
		target.target_key,
		tournament,
		eventDate ?? dateRaw,
		player1,
		player2,
		round
	].filter(Boolean).join(":");
	const common = {
		source_id: source,
		source_name: SOURCE_NAMES$2[source],
		source_url: url,
		tournament,
		event_date: eventDate,
		surface,
		sample_label: round,
		window_start: target.pullback_start,
		window_end: target.pullback_end,
		raw_payload: obj,
		provenance: {
			target_key: target.target_key,
			tour: source,
			level: levelText(obj),
			extraction: "official_page_structured_json"
		}
	};
	const rows = [];
	if (looksLikeMatch) rows.push({
		...common,
		source_record_key: `${identity}:match_record:${player1}`,
		player_name: player1,
		opponent_name: player2,
		observation_type: "MATCH_RESULT_OR_SCHEDULE",
		observation_key: "match_record",
		text_value: JSON.stringify({
			player1,
			player2,
			round,
			status,
			score,
			winner
		}),
		numeric_value: null
	});
	if (looksLikeSchedule) rows.push({
		...common,
		source_record_key: `${identity}:event_schedule`,
		player_name: null,
		opponent_name: null,
		observation_type: "TOURNAMENT_SCHEDULE",
		observation_key: "event_schedule",
		text_value: JSON.stringify({
			tournament,
			date: eventDate ?? dateRaw,
			end_date: isoDate(endDateRaw) ?? endDateRaw,
			surface,
			round,
			status,
			level: levelText(obj)
		}),
		numeric_value: null
	});
	return rows;
}
async function request$1(url) {
	return fetch(url, { headers: {
		"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
		accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
		"accept-language": "en-US,en;q=0.9",
		"cache-control": "no-cache",
		pragma: "no-cache"
	} });
}
function atpArchiveUrl(source, year) {
	const base = `https://www.atptour.com/en/scores/results-archive?year=${year}`;
	return source === "atp_challenger" ? `${base}&tournamentType=ch` : `${base}&tournamentType=atp`;
}
function validateAtpSnapshot(source, target, snapshot) {
	if (snapshot.source !== source) throw new Error(`ATP Official snapshot source mismatch: expected ${source}, got ${snapshot.source}`);
	const parsed = new URL(snapshot.url);
	if (parsed.protocol !== "https:" || parsed.hostname !== "www.atptour.com" || !parsed.pathname.endsWith("/scores/results-archive")) throw new Error(`Invalid ATP Official snapshot URL: ${snapshot.url}`);
	const year = Number(parsed.searchParams.get("year"));
	if (!targetYears(target).includes(year)) throw new Error(`ATP Official snapshot year ${year} is outside target window`);
	const type = (parsed.searchParams.get("tournamentType") ?? "").toLowerCase();
	if (source === "atp_challenger" && type !== "ch") throw new Error("ATP Challenger snapshot must use tournamentType=ch");
	if (source === "atp" && type === "ch") throw new Error("ATP Main snapshot cannot use Challenger tournamentType=ch");
	if (!snapshot.html || snapshot.html.length < 1e3) throw new Error(`ATP Official snapshot was empty or implausibly small: ${snapshot.url}`);
	if (/Just a moment|cf-chl|captcha|Attention Required/i.test(snapshot.html)) throw new Error(`ATP Official snapshot contained a Cloudflare challenge: ${snapshot.url}`);
}
function humanizeSlug(slug) {
	return decodeURIComponent(slug).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function parseAtpArchive(source, target, url, html) {
	const rows = [];
	const seen = /* @__PURE__ */ new Set();
	for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']*\/en\/scores\/archive\/([^\/"']+)\/([^\/"']+)\/(20\d{2})\/results[^"']*)["'][^>]*>[\s\S]*?<\/a>/gi)) {
		const href = match[1];
		const slug = match[2];
		const tournamentId = match[3];
		const year = Number(match[4]);
		const absolute = href.startsWith("http") ? href : `https://www.atptour.com${href.startsWith("/") ? href : `/${href}`}`;
		const key = `${target.target_key}:${year}:${tournamentId}:event_schedule`;
		if (seen.has(key)) continue;
		seen.add(key);
		const context = stripTags(html.slice(Math.max(0, (match.index ?? 0) - 1200), match.index ?? 0));
		const tournament = humanizeSlug(slug);
		const level = source === "atp_challenger" ? "ATP_CHALLENGER" : "ATP_MAIN";
		rows.push({
			source_id: source,
			source_name: SOURCE_NAMES$2[source],
			source_url: url,
			source_record_key: key,
			player_name: null,
			opponent_name: null,
			tournament,
			event_date: null,
			surface: null,
			observation_type: "TOURNAMENT_SCHEDULE",
			observation_key: "event_schedule",
			text_value: JSON.stringify({
				tournament,
				year,
				results_url: absolute,
				competition_level: level
			}),
			numeric_value: null,
			sample_label: level,
			window_start: target.pullback_start,
			window_end: target.pullback_end,
			raw_payload: {
				tournament_slug: slug,
				tournament_id: tournamentId,
				year,
				results_url: absolute,
				context
			},
			provenance: {
				target_key: target.target_key,
				tour: source,
				competition_level: level,
				extraction: "official_atp_results_archive_browser_snapshot"
			}
		});
	}
	return rows;
}
async function fetchAtpOfficial(source, target, snapshots) {
	if (snapshots.length) {
		const rows = [];
		let seen = 0;
		for (const snapshot of snapshots) {
			validateAtpSnapshot(source, target, snapshot);
			const parsed = parseAtpArchive(source, target, snapshot.url, snapshot.html);
			seen += parsed.length;
			rows.push(...parsed);
		}
		return {
			rows,
			pages: snapshots.length,
			seen
		};
	}
	const rows = [];
	let pages = 0, seen = 0;
	for (const year of targetYears(target)) {
		const url = atpArchiveUrl(source, year);
		const res = await request$1(url);
		if (!res.ok) throw new Error(`${url} returned ${res.status}`);
		const html = await res.text();
		pages++;
		const parsed = parseAtpArchive(source, target, url, html);
		seen += parsed.length;
		rows.push(...parsed);
	}
	return {
		rows,
		pages,
		seen
	};
}
function wtaApiRows(target, url, payload) {
	const roots = [];
	if (Array.isArray(payload)) roots.push(...payload.filter((v) => !!v && typeof v === "object" && !Array.isArray(v)));
	else if (payload && typeof payload === "object") {
		const content = payload.content;
		if (Array.isArray(content)) roots.push(...content.filter((v) => !!v && typeof v === "object" && !Array.isArray(v)));
	}
	const allowedYears = new Set(targetYears(target));
	const rows = [];
	for (const obj of roots) {
		const group = obj.tournamentGroup && typeof obj.tournamentGroup === "object" && !Array.isArray(obj.tournamentGroup) ? obj.tournamentGroup : null;
		const level = (group ? first$1(group, [
			"level",
			"levelName",
			"levelLabel"
		]) : null) ?? first$1(obj, [
			"level",
			"levelName",
			"levelLabel"
		]);
		if (!isWtaMainLevel$1(level)) continue;
		const year = Number(first$1(obj, [
			"year",
			"tournamentYear",
			"seasonYear"
		]));
		if (!Number.isFinite(year) || !allowedYears.has(year)) continue;
		const groupId = (group ? first$1(group, ["id", "groupId"]) : null) ?? first$1(obj, ["tournamentGroupId", "groupId"]);
		const tournament = first$1(obj, [
			"title",
			"tournamentName",
			"name"
		]) ?? (group ? first$1(group, ["name", "title"]) : null);
		if (!groupId || !tournament) continue;
		const start = isoDate(first$1(obj, [
			"startDate",
			"date",
			"fromDate"
		]));
		const end = isoDate(first$1(obj, ["endDate", "toDate"]));
		const surface = first$1(obj, ["surface", "surfaceName"]);
		const key = `${target.target_key}:${year}:${groupId}:event_schedule`;
		rows.push({
			source_id: "wta",
			source_name: SOURCE_NAMES$2.wta,
			source_url: url,
			source_record_key: key,
			player_name: null,
			opponent_name: null,
			tournament,
			event_date: start,
			surface,
			observation_type: "TOURNAMENT_SCHEDULE",
			observation_key: "event_schedule",
			text_value: JSON.stringify({
				tournament,
				year,
				start_date: start,
				end_date: end,
				surface,
				level,
				group_id: groupId
			}),
			numeric_value: null,
			sample_label: level,
			window_start: target.pullback_start,
			window_end: target.pullback_end,
			raw_payload: obj,
			provenance: {
				target_key: target.target_key,
				tour: "wta",
				level,
				group_id: groupId,
				extraction: "official_wta_public_api"
			}
		});
	}
	return rows;
}
async function fetchWtaOfficial(target, configuredUrl) {
	const rows = /* @__PURE__ */ new Map();
	let pages = 0, seen = 0;
	const pageSize = 500;
	let expectedPages = 50;
	for (let page = 0; page < expectedPages; page++) {
		const apiUrl = `${WTA_TOURNAMENT_API$1}?${new URLSearchParams({
			page: String(page),
			pageSize: String(pageSize)
		}).toString()}`;
		const res = await request$1(apiUrl);
		if (!res.ok) throw new Error(`${apiUrl} returned ${res.status}`);
		const payload = await res.json();
		const parsed = wtaApiRows(target, apiUrl, payload);
		for (const row of parsed) rows.set(row.source_record_key, row);
		pages++;
		const content = payload && typeof payload === "object" && !Array.isArray(payload) ? payload.content : null;
		seen += Array.isArray(content) ? content.length : 0;
		if (payload && typeof payload === "object" && !Array.isArray(payload)) {
			const info = payload.pageInfo;
			const reportedPages = Number(info?.numPages ?? info?.totalPages);
			const entries = Number(info?.numEntries ?? info?.totalEntries);
			const reportedPageSize = Number(info?.pageSize);
			if (Number.isFinite(entries) && entries > 0) expectedPages = Math.min(250, Math.ceil(entries / (Number.isFinite(reportedPageSize) && reportedPageSize > 0 ? reportedPageSize : pageSize)));
			else if (Number.isFinite(reportedPages) && reportedPages > 0) expectedPages = Math.min(250, reportedPages);
			if (Array.isArray(content) && content.length === 0) break;
			if (page + 1 >= expectedPages) break;
		} else break;
	}
	if (rows.size) return {
		rows: [...rows.values()],
		pages,
		seen
	};
	const pageRes = await request$1(configuredUrl);
	if (!pageRes.ok) throw new Error(`${configuredUrl} returned ${pageRes.status}`);
	const pageUrl = pageRes.url || configuredUrl;
	const pageHtml = await pageRes.text();
	pages++;
	const objects = [];
	for (const payload of embeddedJson(pageHtml)) collectObjects(payload, objects);
	seen += objects.length;
	for (const obj of objects) for (const row of normalizedFromObject("wta", pageUrl, target, obj)) rows.set(row.source_record_key, row);
	return {
		rows: [...rows.values()],
		pages,
		seen
	};
}
async function writeRows(rows) {
	for (const row of rows) assertObservationFamily(row, "RESULTS_SCHEDULE");
	let persisted = 0;
	for (let i = 0; i < rows.length; i += 500) {
		const chunk = rows.slice(i, i + 500);
		await upsertObservations(chunk, { ignoreDuplicates: true });
		const sourceId = chunk[0]?.source_id;
		if (!sourceId) continue;
		for (let j = 0; j < chunk.length; j += 50) {
			const keys = chunk.slice(j, j + 50).map((row) => row.source_record_key);
			if (!keys.length) continue;
			persisted += new Set(await confirmObservationKeys(sourceId, keys)).size;
		}
	}
	return persisted;
}
async function ingestTourResultsAndSchedules(source, snapshots = []) {
	const targets = await enabledTargets(source);
	let observationsWritten = 0, pagesRead = 0, structuredObjectsSeen = 0;
	for (const target of targets) {
		const config = target.config ?? {};
		const configuredUrl = typeof config.url === "string" && config.url ? config.url : DEFAULT_URLS$2[source];
		const sourceSnapshots = snapshots.filter((snapshot) => snapshot.source === source);
		const fetched = source === "wta" ? await fetchWtaOfficial(target, configuredUrl) : await fetchAtpOfficial(source, target, sourceSnapshots);
		pagesRead += fetched.pages;
		structuredObjectsSeen += fetched.seen;
		observationsWritten += await writeRows(fetched.rows);
		await markTargetIngested(target.id);
	}
	return {
		source,
		source_name: SOURCE_NAMES$2[source],
		targets: targets.length,
		pages_read: pagesRead,
		structured_objects_seen: structuredObjectsSeen,
		observations_written: observationsWritten
	};
}
var WTA_TOURNAMENT_API = "https://api.wtatennis.com/tennis/tournaments";
var SOURCE_NAME = "WTA Official";
function yearsFor(target) {
	const now = (/* @__PURE__ */ new Date()).getUTCFullYear();
	const start = Number((target.pullback_start ?? `${now}-01-01`).slice(0, 4));
	const end = Number((target.pullback_end ?? `${now}-12-31`).slice(0, 4));
	const lo = Number.isFinite(start) ? Math.min(start, end) : now;
	const hi = Number.isFinite(end) ? Math.max(start, end) : now;
	const years = [];
	for (let year = lo; year <= hi; year++) years.push(year);
	return years;
}
function isWtaMainLevel(level) {
	if (!level) return false;
	const normalized = level.replace(/[_-]+/g, " ").trim();
	if (/(^|\D)125\s*k?\b|wta\s*125|challenger|itf/i.test(normalized)) return false;
	return /grand\s*slam|tour\s*finals|wta\s*finals|1000|500|250|premier|international|wta/i.test(normalized);
}
async function requestJson(url) {
	const response = await fetch(url, { headers: {
		"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
		accept: "application/json,text/plain,*/*",
		"accept-language": "en-US,en;q=0.9",
		"cache-control": "no-cache",
		pragma: "no-cache"
	} });
	if (!response.ok) throw new Error(`${url} returned ${response.status}`);
	return response.json();
}
function asObject(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function asText(value) {
	return typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}
function dateOnly(value) {
	const text = asText(value);
	if (!text) return null;
	const match = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
	return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}
async function discoverEditions(target) {
	const allowedYears = new Set(yearsFor(target));
	const editions = /* @__PURE__ */ new Map();
	const pageSize = 100;
	let expectedPages = 1;
	let pagesRead = 0;
	let objectsSeen = 0;
	for (let page = 0; page < expectedPages && page < 250; page++) {
		const url = `${WTA_TOURNAMENT_API}?page=${page}&pageSize=${pageSize}`;
		const payload = asObject(await requestJson(url));
		if (!payload) throw new Error(`WTA tournament index was not an object: ${url}`);
		const content = Array.isArray(payload.content) ? payload.content : [];
		pagesRead++;
		objectsSeen += content.length;
		for (const value of content) {
			const row = asObject(value);
			if (!row) continue;
			const group = asObject(row.tournamentGroup);
			const level = asText(group?.level ?? row.level);
			const year = Number(asText(row.year));
			const groupId = Number(asText(group?.id));
			if (!Number.isFinite(year) || !allowedYears.has(year) || !Number.isFinite(groupId) || groupId <= 0 || !isWtaMainLevel(level)) continue;
			const title = asText(row.title) || asText(group?.name) || `WTA ${groupId}`;
			editions.set(`${groupId}:${year}`, {
				groupId,
				year,
				title,
				level,
				surface: asText(row.surface)
			});
		}
		const pageInfo = asObject(payload.pageInfo);
		const entries = Number(asText(pageInfo?.numEntries ?? pageInfo?.totalEntries));
		const reportedSize = Number(asText(pageInfo?.pageSize));
		if (Number.isFinite(entries) && entries > 0) expectedPages = Math.min(250, Math.ceil(entries / (Number.isFinite(reportedSize) && reportedSize > 0 ? reportedSize : pageSize)));
		if (!content.length) break;
	}
	return {
		editions: [...editions.values()],
		pagesRead,
		objectsSeen
	};
}
function playerName(match, side) {
	return [asText(match[`PlayerNameFirst${side}`]), asText(match[`PlayerNameLast${side}`])].filter(Boolean).join(" ").trim() || null;
}
function setsWon(match, side) {
	let won = 0;
	const other = side === "A" ? "B" : "A";
	for (let set = 1; set <= 5; set++) {
		const own = Number(asText(match[`ScoreSet${set}${side}`]));
		const opp = Number(asText(match[`ScoreSet${set}${other}`]));
		if (Number.isFinite(own) && Number.isFinite(opp) && own > opp) won++;
	}
	return won;
}
function normalizeMatches(target, edition, url, payload) {
	const root = asObject(payload);
	if (!root) throw new Error(`WTA match endpoint was not an object: ${url}`);
	const tournament = asObject(root.tournament);
	const returnedGroup = asObject(tournament?.tournamentGroup);
	const returnedGroupId = Number(asText(returnedGroup?.id));
	const returnedYear = Number(asText(tournament?.year));
	const level = asText(returnedGroup?.level ?? tournament?.level);
	if (returnedGroupId !== edition.groupId || returnedYear !== edition.year) throw new Error(`WTA match endpoint identity mismatch for ${edition.groupId}/${edition.year}`);
	if (!isWtaMainLevel(level)) throw new Error(`WTA Main firewall rejected level ${level ?? "missing"} for ${edition.groupId}/${edition.year}`);
	const tournamentName = asText(tournament?.title) || edition.title;
	const surface = asText(tournament?.surface) || edition.surface;
	const matches = Array.isArray(root.matches) ? root.matches : [];
	const rows = [];
	for (const value of matches) {
		const match = asObject(value);
		if (!match) continue;
		if (asText(match.DrawMatchType) !== "S") continue;
		const playerA = playerName(match, "A");
		const playerB = playerName(match, "B");
		if (!playerA || !playerB) continue;
		const matchId = asText(match.MatchID);
		if (!matchId) continue;
		const eventYear = Number(asText(match.EventYear));
		const eventId = Number(asText(match.EventID));
		if (eventYear !== edition.year || eventId !== edition.groupId) continue;
		const aSets = setsWon(match, "A");
		const bSets = setsWon(match, "B");
		const winnerName = aSets > bSets ? playerA : bSets > aSets ? playerB : null;
		const eventDate = dateOnly(match.MatchTimeStamp);
		const score = asText(match.ScoreString);
		const result = asText(match.ResultString);
		const round = asText(match.RoundID) || asText(match.DrawLevelType);
		const common = {
			source_id: "wta",
			source_name: SOURCE_NAME,
			source_url: url,
			tournament: tournamentName,
			event_date: eventDate,
			surface,
			observation_type: "MATCH_RESULT_OR_SCHEDULE",
			observation_key: "match_record",
			text_value: JSON.stringify({
				player1: playerA,
				player2: playerB,
				player1_id: asText(match.PlayerIDA),
				player2_id: asText(match.PlayerIDB),
				round,
				status: asText(match.MatchState),
				score,
				result,
				winner: winnerName,
				competition_level: level,
				tournament_group_id: edition.groupId,
				event_year: edition.year
			}),
			numeric_value: null,
			sample_label: round,
			window_start: target.pullback_start,
			window_end: target.pullback_end,
			raw_payload: match,
			provenance: {
				target_key: target.target_key,
				tour: "wta",
				competition_level: level,
				tournament_group_id: edition.groupId,
				event_year: edition.year,
				extraction: "official_wta_tournament_match_api"
			}
		};
		rows.push({
			...common,
			source_record_key: `${target.target_key}:${edition.year}:${edition.groupId}:${matchId}:A`,
			player_name: playerA,
			opponent_name: playerB
		});
		rows.push({
			...common,
			source_record_key: `${target.target_key}:${edition.year}:${edition.groupId}:${matchId}:B`,
			player_name: playerB,
			opponent_name: playerA
		});
	}
	return {
		rows,
		matchesSeen: matches.length
	};
}
async function persistRows$1(rows) {
	for (const row of rows) assertObservationFamily(row, "RESULTS_SCHEDULE");
	let persisted = 0;
	for (let offset = 0; offset < rows.length; offset += 500) {
		const chunk = rows.slice(offset, offset + 500);
		await upsertObservations(chunk, { ignoreDuplicates: true });
		for (let confirmOffset = 0; confirmOffset < chunk.length; confirmOffset += 50) {
			const keys = chunk.slice(confirmOffset, confirmOffset + 50).map((row) => row.source_record_key);
			persisted += new Set(await confirmObservationKeys("wta", keys)).size;
		}
	}
	return persisted;
}
async function ingestWtaOfficialMatchResults() {
	const targets = await enabledTargets("wta");
	let pagesRead = 0;
	let structuredObjectsSeen = 0;
	let matchObjectsSeen = 0;
	let observationsWritten = 0;
	let tournamentEditions = 0;
	for (const target of targets ?? []) {
		const discovered = await discoverEditions(target);
		pagesRead += discovered.pagesRead;
		structuredObjectsSeen += discovered.objectsSeen;
		tournamentEditions += discovered.editions.length;
		for (let offset = 0; offset < discovered.editions.length; offset += 6) {
			const batch = discovered.editions.slice(offset, offset + 6);
			const results = await Promise.all(batch.map(async (edition) => {
				const url = `${WTA_TOURNAMENT_API}/${edition.groupId}/${edition.year}/matches`;
				return {
					normalized: normalizeMatches(target, edition, url, await requestJson(url)),
					url
				};
			}));
			for (const { normalized } of results) {
				matchObjectsSeen += normalized.matchesSeen;
				observationsWritten += await persistRows$1(normalized.rows);
			}
		}
	}
	return {
		source: "wta",
		source_name: SOURCE_NAME,
		targets: targets?.length ?? 0,
		tournament_index_pages_read: pagesRead,
		tournament_objects_seen: structuredObjectsSeen,
		tournament_editions_fetched: tournamentEditions,
		match_objects_seen: matchObjectsSeen,
		observations_written: observationsWritten
	};
}
var DEFAULT_URLS$1 = {
	atp_rankings: "https://www.atptour.com/en/rankings/singles",
	wta_rankings: "https://www.wtatennis.com/rankings/singles"
};
var SOURCE_NAMES$1 = {
	atp_rankings: "ATP Rankings Official",
	wta_rankings: "WTA Rankings Official"
};
var WTA_RANKINGS_API = "https://api.wtatennis.com/tennis/players/ranked?type=rankSingles&metric=singles&page=0&pageSize=500";
function str(v) {
	return typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : null;
}
function first(o, keys) {
	for (const k of keys) {
		const v = str(o[k]);
		if (v) return v;
	}
	return null;
}
function deepFirst(o, keys, depth = 0) {
	const direct = first(o, keys);
	if (direct) return direct;
	if (depth >= 4) return null;
	for (const v of Object.values(o)) if (v && typeof v === "object" && !Array.isArray(v)) {
		const found = deepFirst(v, keys, depth + 1);
		if (found) return found;
	}
	return null;
}
function num(v) {
	const s = str(v);
	if (!s) return null;
	const n = Number(s.replace(/,/g, "").replace(/[^0-9.-]/g, ""));
	return Number.isFinite(n) ? n : null;
}
function date(v) {
	if (!v) return null;
	const m = v.match(/(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
	return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
}
function collect(v, out, d = 0) {
	if (d > 14 || v == null) return;
	if (Array.isArray(v)) {
		for (const x of v) collect(x, out, d + 1);
		return;
	}
	if (typeof v !== "object") return;
	const o = v;
	out.push(o);
	for (const x of Object.values(o)) collect(x, out, d + 1);
}
function embedded(html) {
	const out = [];
	for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
		const b = m[1]?.trim();
		if (!b || !b.startsWith("{") && !b.startsWith("[")) continue;
		try {
			out.push(JSON.parse(b));
		} catch {}
	}
	return out;
}
function unescapeHtml(s) {
	return s.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/g, "'").replace(/&quot;/gi, "\"").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function normalize(source, url, target, o, extraction) {
	const player = deepFirst(o, [
		"playerName",
		"PlayerName",
		"fullName",
		"PlayerFullName",
		"player",
		"name",
		"competitorName"
	]);
	const rank = num(o["rank"] ?? o["Rank"] ?? o["ranking"] ?? o["position"] ?? o["currentRank"] ?? o["Position"]);
	const points = num(o["points"] ?? o["Points"] ?? o["rankingPoints"] ?? o["rankPoints"] ?? o["RankPoints"]);
	if (!player || rank === null || rank < 1 || rank > 5e3) return null;
	const d = date(deepFirst(o, [
		"rankingDate",
		"RankingDate",
		"rankedAt",
		"date",
		"week",
		"asOfDate",
		"updatedAt"
	])) ?? target.pullback_end ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
	const payload = {
		rank,
		points,
		prior_rank: num(o["previousRank"] ?? o["PreviousRank"] ?? o["prevRank"] ?? o["lastRank"] ?? o["movement"]),
		country: deepFirst(o, [
			"country",
			"Country",
			"countryCode",
			"CountryCode",
			"nation"
		])
	};
	const row = {
		source_id: source,
		source_name: SOURCE_NAMES$1[source],
		source_url: url,
		source_record_key: `${target.target_key}:${d ?? "current"}:${player}:${rank}`,
		player_name: player,
		opponent_name: null,
		tournament: null,
		event_date: d,
		surface: null,
		observation_type: "RANKING",
		observation_key: "ranking_snapshot",
		text_value: JSON.stringify(payload),
		numeric_value: rank,
		unit: "rank",
		sample_label: points === null ? null : `points=${points}`,
		window_start: target.pullback_start,
		window_end: target.pullback_end,
		raw_payload: o,
		provenance: {
			target_key: target.target_key,
			tour: source,
			extraction: extraction ?? (url.includes("api.wtatennis.com") ? "official_wta_public_api" : "official_page")
		}
	};
	assertObservationFamily(row, "RANKING");
	return row;
}
function normalizeWtaOfficialRanking(target, url, value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const o = value;
	const playerObj = o.player && typeof o.player === "object" && !Array.isArray(o.player) ? o.player : null;
	const player = playerObj ? first(playerObj, [
		"fullName",
		"playerName",
		"name"
	]) : null;
	const rank = num(o.ranking ?? o.rank ?? o.position);
	const points = num(o.points);
	if (!player || rank === null || rank < 1 || rank > 5e3) return null;
	const rankedAt = date(str(o.rankedAt ?? o.rankingDate)) ?? target.pullback_end ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
	const movement = num(o.movement);
	const country = playerObj ? first(playerObj, [
		"countryCode",
		"country",
		"nation"
	]) : null;
	const playerId = playerObj ? first(playerObj, ["id", "playerId"]) : null;
	const payload = {
		rank,
		points,
		prior_rank: null,
		movement,
		country,
		player_id: playerId,
		tournaments_played: num(o.tournamentsPlayed)
	};
	const row = {
		source_id: "wta_rankings",
		source_name: SOURCE_NAMES$1.wta_rankings,
		source_url: url,
		source_record_key: `${target.target_key}:${rankedAt}:${playerId ?? player}:${rank}`,
		player_name: player,
		opponent_name: null,
		tournament: null,
		event_date: rankedAt,
		surface: null,
		observation_type: "RANKING",
		observation_key: "ranking_snapshot",
		text_value: JSON.stringify(payload),
		numeric_value: rank,
		unit: "rank",
		sample_label: points === null ? null : `points=${points}`,
		window_start: target.pullback_start,
		window_end: target.pullback_end,
		raw_payload: o,
		provenance: {
			target_key: target.target_key,
			tour: "wta_rankings",
			extraction: "official_wta_public_api"
		}
	};
	assertObservationFamily(row, "RANKING");
	return row;
}
var MIN_PLAUSIBLE_RANKING_POINTS = 100;
var MAX_PLAUSIBLE_RANKING_POINTS = 2e4;
function rankingPointsFromCells(cells) {
	let best = null;
	for (const cell of cells.slice(1)) {
		const value = num(cell);
		if (value === null || !Number.isFinite(value)) continue;
		if (value < MIN_PLAUSIBLE_RANKING_POINTS || value > MAX_PLAUSIBLE_RANKING_POINTS) continue;
		if (best === null || value > best) best = value;
	}
	return best;
}
function parseRankingTable(html, source, target, url, extraction) {
	const rows = [];
	const seen = /* @__PURE__ */ new Set();
	const rankingDate = target.pullback_end ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
	for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
		const cells = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => unescapeHtml(m[1]));
		if (cells.length < 2) continue;
		const rankMatch = cells[0].match(/\b(\d{1,4})\b/);
		if (!rankMatch) continue;
		const rank = Number(rankMatch[1]);
		const player = (cells[1] ?? "").replace(/\b[A-Z]{3}\b/g, "").replace(/^[-+\d\s]+/, "").trim();
		if (!/[A-Za-zÀ-ž]/.test(player)) continue;
		const points = rankingPointsFromCells(cells);
		const key = `${rank}:${player}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const row = normalize(source, url, target, {
			playerName: player,
			rank,
			points,
			rankingDate
		}, extraction);
		if (row) rows.push(row);
	}
	return rows;
}
function rowsFromHtml(source, url, target, html, extraction) {
	const objects = [];
	for (const p of embedded(html)) collect(p, objects);
	const rows = /* @__PURE__ */ new Map();
	for (const o of objects) {
		const row = normalize(source, url, target, o, extraction);
		if (row) rows.set(row.source_record_key, row);
	}
	for (const row of parseRankingTable(html, source, target, url, extraction)) rows.set(row.source_record_key, row);
	return {
		rows: [...rows.values()],
		objects_seen: objects.length
	};
}
function validateAtpRankingSnapshot(snapshot) {
	if (snapshot.source !== "atp_rankings") throw new Error("ATP ranking snapshot source mismatch");
	const u = new URL(snapshot.url);
	if (u.protocol !== "https:" || u.hostname !== "www.atptour.com" || !u.pathname.endsWith("/rankings/singles")) throw new Error(`Invalid ATP Rankings Official snapshot URL: ${snapshot.url}`);
	if (snapshot.html.length < 1e3 || /Just a moment|cf-chl|captcha|Attention Required/i.test(snapshot.html)) throw new Error("Invalid ATP Rankings Official browser snapshot");
}
async function request(url) {
	return fetch(url, { headers: {
		"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
		accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
		"accept-language": "en-US,en;q=0.9"
	} });
}
async function fetchRows(source, url, target, snapshots) {
	if (source === "atp_rankings" && snapshots.length) {
		const rows = /* @__PURE__ */ new Map();
		let objects_seen = 0;
		for (const snapshot of snapshots) {
			validateAtpRankingSnapshot(snapshot);
			const parsed = rowsFromHtml(source, snapshot.url, target, snapshot.html, "official_atp_rankings_browser_snapshot");
			objects_seen += parsed.objects_seen;
			for (const row of parsed.rows) rows.set(row.source_record_key, row);
		}
		return {
			rows: [...rows.values()],
			objects_seen,
			pages: snapshots.length
		};
	}
	if (source === "wta_rankings") {
		const api = await request(WTA_RANKINGS_API);
		if (!api.ok) throw new Error(`${WTA_RANKINGS_API} returned ${api.status}`);
		const payload = await api.json();
		const values = Array.isArray(payload) ? payload : payload && typeof payload === "object" && Array.isArray(payload.content) ? payload.content : [];
		const rows = /* @__PURE__ */ new Map();
		for (const value of values) {
			const row = normalizeWtaOfficialRanking(target, WTA_RANKINGS_API, value);
			if (row) rows.set(row.source_record_key, row);
		}
		return {
			rows: [...rows.values()],
			objects_seen: values.length,
			pages: 1
		};
	}
	const r = await request(url);
	if (!r.ok) throw new Error(`${url} returned ${r.status}`);
	const effectiveUrl = r.url || url;
	if ((r.headers.get("content-type") ?? "").includes("application/json")) {
		const payload = await r.json();
		const objects = [];
		collect(payload, objects);
		const rows = /* @__PURE__ */ new Map();
		for (const o of objects) {
			const row = normalize(source, effectiveUrl, target, o);
			if (row) rows.set(row.source_record_key, row);
		}
		return {
			rows: [...rows.values()],
			objects_seen: objects.length,
			pages: 1
		};
	}
	const parsed = rowsFromHtml(source, effectiveUrl, target, await r.text(), "official_page");
	return {
		rows: parsed.rows,
		objects_seen: parsed.objects_seen,
		pages: 1
	};
}
async function persistRows(rows) {
	let persisted = 0;
	for (let i = 0; i < rows.length; i += 500) {
		const chunk = rows.slice(i, i + 500);
		await upsertObservations(chunk, { ignoreDuplicates: true });
		const sourceId = chunk[0]?.source_id;
		const keys = chunk.map((r) => r.source_record_key);
		if (!sourceId || !keys.length) continue;
		persisted += new Set(await confirmObservationKeys(sourceId, keys)).size;
	}
	return persisted;
}
async function ingestTourRankings(source, snapshots = []) {
	const targets = await enabledTargets(source);
	let observations_written = 0, pages_read = 0, objects_seen = 0;
	for (const target of targets) {
		const cfg = target.config ?? {};
		const fetched = await fetchRows(source, typeof cfg.url === "string" && cfg.url ? cfg.url : DEFAULT_URLS$1[source], target, snapshots.filter((s) => s.source === source));
		pages_read += fetched.pages;
		objects_seen += fetched.objects_seen;
		observations_written += await persistRows(fetched.rows);
		await markTargetIngested(target.id);
	}
	return {
		source,
		source_name: SOURCE_NAMES$1[source],
		targets: targets.length,
		pages_read,
		objects_seen,
		observations_written
	};
}
var DEFAULT_URLS = {
	itf_rules: "https://www.itftennis.com/en/about-us/governance/rules-and-regulations/",
	atp_rules: "https://www.atptour.com/",
	wta_rules: "https://www.wtatennis.com/"
};
var SOURCE_NAMES = {
	itf_rules: "ITF Rules and Regulations",
	atp_rules: "ATP Official Rules Context",
	wta_rules: "WTA Official Rules Context"
};
function cleanText(html) {
	return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;|&quot;|&#39;/g, " ").replace(/\s+/g, " ").trim();
}
function extractRuleFacts(text) {
	return [
		["best_of_context", /best[- ]of[- ](?:three|five)|best of (?:3|5)/gi],
		["tiebreak_context", /tie[- ]?break|tiebreak/gi],
		["retirement_walkover_context", /retirement|walkover|withdrawal/gi],
		["suspension_delay_context", /suspension|suspended|delay|interruption/gi],
		["coaching_context", /coaching|coach/gi],
		["ball_change_context", /ball change|change of balls|new balls/gi]
	].flatMap(([key, re]) => {
		const matches = [...text.matchAll(re)].slice(0, 12).map((m) => m[0]);
		return matches.length ? [{
			key,
			count: matches.length,
			matches
		}] : [];
	});
}
async function ingestRulesContext(source) {
	const targets = await enabledTargets(source);
	let pages_read = 0, observations_written = 0;
	for (const target of targets) {
		const cfg = target.config ?? {};
		const url = typeof cfg.url === "string" && cfg.url ? cfg.url : DEFAULT_URLS[source];
		const r = await fetch(url, { headers: {
			"user-agent": "TennisTruthEngine/1.0 (+warehouse ingestion)",
			accept: "text/html,*/*"
		} });
		if (!r.ok) throw new Error(`${url} returned ${r.status}`);
		const html = await r.text();
		pages_read++;
		const text = cleanText(html);
		const facts = extractRuleFacts(text);
		const rows = [];
		for (const fact of facts) {
			const row = {
				source_id: source,
				source_name: SOURCE_NAMES[source],
				source_url: url,
				source_record_key: `${target.target_key}:${fact.key}`,
				player_name: null,
				opponent_name: null,
				tournament: null,
				event_date: target.pullback_end ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
				surface: null,
				observation_type: "RULES_CONTEXT",
				observation_key: fact.key,
				text_value: JSON.stringify({
					count: fact.count,
					matches: fact.matches
				}),
				numeric_value: null,
				unit: null,
				sample_label: `objective rules text matches=${fact.count}`,
				window_start: target.pullback_start,
				window_end: target.pullback_end,
				raw_payload: { excerpt: text.slice(0, 12e3) },
				provenance: {
					target_key: target.target_key,
					extraction: "official_rules_page_text",
					objective_only: true
				}
			};
			assertObservationFamily(row, "RULES_CONTEXT");
			rows.push(row);
		}
		for (let i = 0; i < rows.length; i += 250) observations_written += await upsertObservations(rows.slice(i, i + 250), { ignoreDuplicates: false });
		await markTargetIngested(target.id);
	}
	return {
		source,
		targets: targets.length,
		pages_read,
		observations_written
	};
}
var TARGET_BACKED_SOURCES = /* @__PURE__ */ new Set([
	"open_meteo",
	"atp",
	"wta",
	"atp_challenger",
	"atp_rankings",
	"wta_rankings",
	"itf_rules",
	"atp_rules",
	"wta_rules"
]);
function assertMeaningfulIngestion(sourceId, result) {
	if (TARGET_BACKED_SOURCES.has(sourceId) && Number(result.targets ?? 0) <= 0) throw new Error(`No enabled ingestion target configured for requested source: ${sourceId}`);
	if (sourceId === "odds_api" && Number(result.requests ?? 0) <= 0) throw new Error("The Odds API ingestion completed without making any historical API requests");
	if (Number(result.observations_written ?? 0) <= 0) throw new Error(`Ingestion source ${sourceId} completed without producing any source observations`);
}
function ingestionErrorMessage(err) {
	if (err instanceof Error) return err.message;
	if (err && typeof err === "object") {
		const value = err;
		const fields = [
			"message",
			"code",
			"details",
			"hint"
		].map((key) => [key, value[key]]).filter(([, field]) => field !== void 0 && field !== null && String(field).trim());
		if (fields.length) return fields.map(([key, field]) => `${key}=${String(field)}`).join(" | ");
		try {
			return JSON.stringify(value);
		} catch {}
	}
	return String(err);
}
async function runTracked(sourceId, jobType, fn) {
	const runId = await startIngestionRun(sourceId, jobType);
	try {
		const result = await fn();
		assertMeaningfulIngestion(sourceId, result);
		await completeIngestionRun(runId, Number(result.observations_written ?? 0), result);
		return result;
	} catch (err) {
		await failIngestionRun(runId, ingestionErrorMessage(err));
		throw err;
	}
}
async function ingestTourSource(source, snapshots) {
	const schedule = await ingestTourResultsAndSchedules(source, snapshots);
	if (source !== "wta") return schedule;
	const matches = await ingestWtaOfficialMatchResults();
	const scheduleTargets = Number(schedule.targets ?? 0);
	const matchTargets = Number(matches.targets ?? 0);
	if (scheduleTargets !== matchTargets) throw new Error(`WTA official ingestion target mismatch: schedule=${scheduleTargets} matches=${matchTargets}`);
	return {
		...schedule,
		official_tournament_schedule: schedule,
		official_match_results: matches,
		targets: scheduleTargets,
		observations_written: Number(schedule.observations_written ?? 0) + Number(matches.observations_written ?? 0),
		match_observations_written: Number(matches.observations_written ?? 0),
		match_objects_seen: Number(matches.match_objects_seen ?? 0),
		tournament_editions_fetched: Number(matches.tournament_editions_fetched ?? 0)
	};
}
async function runHistoricalHardPull(sources = ["open_meteo", "odds_api"], options = {}) {
	const results = {};
	const snapshots = options.officialSnapshots ?? [];
	for (const source of sources) if (source === "open_meteo") results[source] = await runTracked(source, "HISTORICAL_BACKFILL", () => ingestOpenMeteoHistorical());
	else if (source === "odds_api") results[source] = await runTracked(source, "HISTORICAL_BACKFILL", () => ingestOddsHistorical());
	else if (source === "atp" || source === "wta" || source === "atp_challenger") results[source] = await runTracked(source, "RESULTS_SCHEDULE_PULL", () => ingestTourSource(source, snapshots.filter((s) => s.source === "atp" || s.source === "atp_challenger")));
	else if (source === "atp_rankings" || source === "wta_rankings") results[source] = await runTracked(source, "RANKING_HISTORY_PULL", () => ingestTourRankings(source, snapshots.filter((s) => s.source === "atp_rankings")));
	else if (source === "itf_rules" || source === "atp_rules" || source === "wta_rules") results[source] = await runTracked(source, "RULES_CONTEXT_PULL", () => ingestRulesContext(source));
	return results;
}
var GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
var EXPECTED_REPOSITORY = "bearisscool-maker/tennis-truth-engine-8ecc1270";
var EXPECTED_AUDIENCE = "tennis-truth-engine-warehouse-ingestion";
var WORKFLOW_PATH = ".github/workflows/historical-hard-pull.yml";
var EXPECTED_MAIN_WORKFLOW_REF = `${EXPECTED_REPOSITORY}/${WORKFLOW_PATH}@refs/heads/main`;
var OPS_VALIDATION_HEAD = "ops/historical-hard-pull-validation";
var ALLOWED_EVENTS = /* @__PURE__ */ new Set([
	"workflow_dispatch",
	"schedule",
	"push",
	"pull_request"
]);
function decodeBase64Url(input) {
	const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
	return Uint8Array.from(Buffer.from(padded, "base64"));
}
function decodeJsonSegment(segment) {
	return JSON.parse(Buffer.from(decodeBase64Url(segment)).toString("utf8"));
}
function audienceMatches(aud) {
	return Array.isArray(aud) ? aud.includes(EXPECTED_AUDIENCE) : aud === EXPECTED_AUDIENCE;
}
function isMainBaseRef(baseRef) {
	return baseRef === "main" || baseRef === "refs/heads/main";
}
function verifyWorkflowScope(claims) {
	if (!claims.event_name || !ALLOWED_EVENTS.has(claims.event_name)) throw new Error("Unsupported GitHub ingestion event");
	if (claims.event_name === "pull_request") {
		if (claims.head_ref !== OPS_VALIDATION_HEAD) throw new Error("GitHub PR ingestion is restricted to the ops validation branch");
		if (!isMainBaseRef(claims.base_ref)) throw new Error("GitHub PR ingestion must target main");
		if (!claims.ref?.startsWith("refs/pull/")) throw new Error("Invalid GitHub PR ingestion ref");
		const expectedPrWorkflowRef = `${EXPECTED_REPOSITORY}/${WORKFLOW_PATH}@${claims.ref}`;
		if (claims.workflow_ref !== expectedPrWorkflowRef) throw new Error("Invalid GitHub PR ingestion workflow");
		return;
	}
	if (claims.ref !== "refs/heads/main") throw new Error("GitHub ingestion is restricted to main");
	if (claims.workflow_ref !== EXPECTED_MAIN_WORKFLOW_REF) throw new Error("Invalid GitHub ingestion workflow");
}
async function verifyGithubActionsOidc(token) {
	const parts = token.split(".");
	if (parts.length !== 3) throw new Error("Malformed GitHub OIDC token");
	const [encodedHeader, encodedPayload, encodedSignature] = parts;
	const header = decodeJsonSegment(encodedHeader);
	const claims = decodeJsonSegment(encodedPayload);
	if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported GitHub OIDC token header");
	if (claims.iss !== GITHUB_OIDC_ISSUER) throw new Error("Invalid GitHub OIDC issuer");
	if (!audienceMatches(claims.aud)) throw new Error("Invalid GitHub OIDC audience");
	if (claims.repository !== EXPECTED_REPOSITORY) throw new Error("Invalid GitHub OIDC repository");
	verifyWorkflowScope(claims);
	const now = Math.floor(Date.now() / 1e3);
	if (!claims.exp || claims.exp <= now) throw new Error("Expired GitHub OIDC token");
	if (claims.nbf && claims.nbf > now + 30) throw new Error("GitHub OIDC token is not active yet");
	const discovery = await fetch(`${GITHUB_OIDC_ISSUER}/.well-known/openid-configuration`);
	if (!discovery.ok) throw new Error(`Could not load GitHub OIDC discovery: ${discovery.status}`);
	const discoveryJson = await discovery.json();
	if (!discoveryJson.jwks_uri) throw new Error("GitHub OIDC discovery did not include jwks_uri");
	const jwksResponse = await fetch(discoveryJson.jwks_uri);
	if (!jwksResponse.ok) throw new Error(`Could not load GitHub OIDC keys: ${jwksResponse.status}`);
	const jwk = (await jwksResponse.json()).keys?.find((key) => key.kid === header.kid);
	if (!jwk) throw new Error("GitHub OIDC signing key not found");
	const key = await crypto.subtle.importKey("jwk", jwk, {
		name: "RSASSA-PKCS1-v1_5",
		hash: "SHA-256"
	}, false, ["verify"]);
	const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
	const signature = decodeBase64Url(encodedSignature);
	if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signingInput)) throw new Error("Invalid GitHub OIDC signature");
	return claims;
}
var ALLOWED_SOURCES = /* @__PURE__ */ new Set([
	"open_meteo",
	"odds_api",
	"atp",
	"wta",
	"atp_challenger",
	"atp_rankings",
	"wta_rankings",
	"itf_rules",
	"atp_rules",
	"wta_rules"
]);
var SNAPSHOT_SOURCES = /* @__PURE__ */ new Set([
	"atp",
	"atp_challenger",
	"atp_rankings"
]);
var MAX_SNAPSHOTS = 6;
var MAX_ENCODED_BYTES = 12e6;
var MAX_HTML_BYTES = 12e6;
function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
function bridgeErrorMessage(error) {
	if (error instanceof Error) return error.message;
	if (error && typeof error === "object") {
		const value = error;
		const fields = [
			"message",
			"code",
			"details",
			"hint"
		].map((key) => [key, value[key]]).filter(([, field]) => field !== void 0 && field !== null && String(field).trim());
		if (fields.length) return fields.map(([key, field]) => `${key}=${String(field)}`).join(" | ");
		try {
			return JSON.stringify(value);
		} catch {}
	}
	return String(error);
}
function base64Bytes(value) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}
async function decodeSnapshot(input, requested) {
	const source = (input.source ?? "").trim();
	const url = (input.url ?? "").trim();
	if (!SNAPSHOT_SOURCES.has(source) || !requested.has(source)) throw new Error(`Unexpected official snapshot source: ${source || "missing"}`);
	if (input.encoding !== "gzip-base64") throw new Error("Official snapshot encoding must be gzip-base64");
	if (!url || typeof input.body !== "string" || !input.body.length) throw new Error("Official snapshot URL/body is required");
	if (input.body.length > MAX_ENCODED_BYTES) throw new Error(`Official snapshot compressed body is too large for ${source}`);
	const decompressed = new Blob([base64Bytes(input.body)]).stream().pipeThrough(new DecompressionStream("gzip"));
	const html = await new Response(decompressed).text();
	if (html.length > MAX_HTML_BYTES) throw new Error(`Official snapshot HTML is too large for ${source}`);
	return {
		source,
		url,
		html
	};
}
var Route$11 = createFileRoute("/api/warehouse-ingest")({ server: { handlers: { POST: async ({ request }) => {
	const auth = request.headers.get("authorization") ?? "";
	if (!auth.startsWith("Bearer ")) return json({
		ok: false,
		error: "Missing GitHub OIDC bearer token"
	}, 401);
	try {
		await verifyGithubActionsOidc(auth.slice(7).trim());
	} catch (error) {
		return json({
			ok: false,
			error: error instanceof Error ? error.message : "GitHub OIDC verification failed"
		}, 403);
	}
	let payload;
	try {
		payload = await request.json();
	} catch {
		return json({
			ok: false,
			error: "Request body must be JSON"
		}, 400);
	}
	const sources = (payload.sources ?? []).map((source) => source.trim()).filter(Boolean);
	if (!sources.length) return json({
		ok: false,
		error: "At least one ingestion source is required"
	}, 400);
	const uniqueSources = [...new Set(sources)];
	for (const source of uniqueSources) if (!ALLOWED_SOURCES.has(source)) return json({
		ok: false,
		error: `Unsupported ingestion source: ${source}`
	}, 400);
	const encodedSnapshots = payload.official_snapshots ?? [];
	if (encodedSnapshots.length > MAX_SNAPSHOTS) return json({
		ok: false,
		error: "Too many official browser snapshots"
	}, 400);
	let officialSnapshots = [];
	try {
		const requested = new Set(uniqueSources);
		officialSnapshots = await Promise.all(encodedSnapshots.map((snapshot) => decodeSnapshot(snapshot, requested)));
	} catch (error) {
		return json({
			ok: false,
			error: error instanceof Error ? error.message : "Invalid official browser snapshot"
		}, 400);
	}
	try {
		return json({
			ok: true,
			sources: uniqueSources,
			result: await runHistoricalHardPull(uniqueSources, { officialSnapshots })
		});
	} catch (error) {
		console.error("[warehouse-ingest] ingestion failed", error);
		return json({
			ok: false,
			error: bridgeErrorMessage(error)
		}, 500);
	}
} } } });
var $$splitComponentImporter$10 = () => import("./board-BYVo2itj.mjs");
var Route$10 = createFileRoute("/app/board")({
	head: () => ({ meta: [
		{ title: "Master Ranked Board — Tennis Matrix Audit System" },
		{
			name: "description",
			content: "One combined ranked board sorted by final audit color, then by current verified win rate."
		},
		{
			property: "og:title",
			content: "Master Ranked Board — Tennis Matrix Audit System"
		},
		{
			property: "og:description",
			content: "Audit color first, verified win rate second — never Matrix WP."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
function useBoardRows() {
	return useQuery({
		queryKey: ["board"],
		queryFn: async () => {
			const { decisions, runs, matches, fields, versions } = await fetchBoardScreen();
			const matrixFor = (matchId, key) => {
				const sv = versions?.find((v) => v.match_id === matchId && v.is_active);
				if (!sv) return null;
				return fields?.find((f) => f.summary_version_id === sv.id && f.field_key === key)?.normalized_value ?? null;
			};
			const slateMatchIds = activeSlateMatchIds(versions);
			return currentAuditRows(matches.filter((match) => slateMatchIds.has(match.id)), runs, decisions).filter((row) => row.decision).map(({ match, run, decision: d }) => {
				const snapshot = d.gate_report?.calibration_snapshot;
				const frozenRange = snapshot?.calibratedLow != null && snapshot?.calibratedHigh != null ? `${snapshot.calibratedLow}–${snapshot.calibratedHigh}%` : null;
				return {
					matchLabel: `${match.player1_name} vs ${match.player2_name}`,
					selection: d.final_selection ?? run?.independent_winner ?? "—",
					tournament: match?.tournament_name ?? "—",
					surface: match?.surface ?? "—",
					matrixPick: matrixFor(match.id, "matrix_predicted_winner") ?? "—",
					matrixWp: matrixFor(match.id, "matrix_wp") ?? "—",
					bucket: d.calibration_bucket,
					verifiedWinRate: d.verified_win_rate,
					independentWinner: run?.independent_winner ?? "—",
					independentRange: run?.independent_low != null ? `${run.independent_low}–${run.independent_high}%` : "—",
					calibratedRange: frozenRange ?? (run?.calibrated_low != null ? `${run.calibrated_low}–${run.calibrated_high}%` : "—"),
					evidence: run?.effective_evidence_count ?? 0,
					color: d.audit_complete ? d.final_audit_color : "INCOMPLETE",
					action: d.action ?? "—",
					completion: Number(d.completion_percent)
				};
			});
		}
	});
}
var $$splitComponentImporter$9 = () => import("./calibration-Ck8PF4mu.mjs");
var Route$9 = createFileRoute("/app/calibration")({
	head: () => ({ meta: [
		{ title: "Calibration Ledger — Tennis Matrix Audit System" },
		{
			name: "description",
			content: "Continuous calibration: every graded result, retirements included, creates a new immutable calibration version with updated verified win rates."
		},
		{
			property: "og:title",
			content: "Calibration Ledger — Tennis Matrix Audit System"
		},
		{
			property: "og:description",
			content: "Verified win rates recalculate on every graded result."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
var $$splitComponentImporter$8 = () => import("./calibration-history-Ge4CfpeW.mjs");
var Route$8 = createFileRoute("/app/calibration-history")({
	head: () => ({ meta: [
		{ title: "Calibration History — Tennis Matrix Audit System" },
		{
			name: "description",
			content: "Immutable calibration versions with the exact bucket records used by every past audit decision."
		},
		{
			property: "og:title",
			content: "Calibration History — Tennis Matrix Audit System"
		},
		{
			property: "og:description",
			content: "Full traceability of verified win rate changes over time."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
var $$splitComponentImporter$7 = () => import("./dashboard-cXe36S5D.mjs");
var Route$7 = createFileRoute("/app/dashboard")({
	head: () => ({ meta: [
		{ title: "Audit Dashboard — Tennis Matrix Audit System" },
		{
			name: "description",
			content: "Slate status, calibration snapshot and pipeline health for the Tennis Matrix audit engine."
		},
		{
			property: "og:title",
			content: "Audit Dashboard — Tennis Matrix Audit System"
		},
		{
			property: "og:description",
			content: "Slate status and live calibration for every audited matchup."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
var $$splitComponentImporter$6 = () => import("./logs-wXSq85ql.mjs");
var Route$6 = createFileRoute("/app/logs")({
	head: () => ({ meta: [
		{ title: "Execution Logs — Tennis Matrix Audit System" },
		{
			name: "description",
			content: "Timestamped proof of every stage executed, including whether Matrix data was visible at the time."
		},
		{
			property: "og:title",
			content: "Execution Logs — Tennis Matrix Audit System"
		},
		{
			property: "og:description",
			content: "No execution record means the stage did not happen."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import("./reports-BlMjXAfJ.mjs");
var Route$5 = createFileRoute("/app/reports")({
	head: () => ({ meta: [
		{ title: "PDF Reports — Tennis Matrix Audit System" },
		{
			name: "description",
			content: "Generate the colour-coded master audit report with calibration buckets, verified win rates and completion status."
		},
		{
			property: "og:title",
			content: "PDF Reports — Tennis Matrix Audit System"
		},
		{
			property: "og:description",
			content: "One combined report, sorted by audit colour then verified win rate."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./rules-BSyhcExX.mjs");
var Route$4 = createFileRoute("/app/rules")({
	head: () => ({ meta: [
		{ title: "Rule Knowledge Base — Tennis Matrix Audit System" },
		{
			name: "description",
			content: "Active rule document versions: verification metrics, verification audit, disagreement/trap audit and calibration record, parsed rule by rule."
		},
		{
			property: "og:title",
			content: "Rule Knowledge Base — Tennis Matrix Audit System"
		},
		{
			property: "og:description",
			content: "Every audit run clones the active rule set, so past runs stay reproducible."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("./slate-B410dtRN.mjs");
var Route$3 = createFileRoute("/app/slate")({
	head: () => ({ meta: [{ title: "Active Slate — Tennis Matrix Audit System" }] }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./sources-D5zhRFCP.mjs");
var Route$2 = createFileRoute("/app/sources")({
	head: () => ({ meta: [
		{ title: "Sources & Conflicts — Tennis Matrix Audit System" },
		{
			name: "description",
			content: "Source snapshots behind each audit plus every recorded source conflict and its resolution state."
		},
		{
			property: "og:title",
			content: "Sources & Conflicts — Tennis Matrix Audit System"
		},
		{
			property: "og:description",
			content: "Unresolved critical conflicts block completion for that match only."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./upload-D25Xzgoy.mjs");
var Route$1 = createFileRoute("/app/upload")({
	head: () => ({ meta: [{ title: "Upload Summaries — Tennis Matrix Audit System" }] }),
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./match._matchId-DlDHwYDM.mjs");
var Route = createFileRoute("/app/match/$matchId")({
	head: () => ({ meta: [
		{ title: "Match Audit Workspace — Tennis Matrix Audit System" },
		{
			name: "description",
			content: "Execute the full pipeline for one matchup: symmetric metrics, verification, trap audit, underdog pathways, stress tests and the Final Combination Gate."
		},
		{
			property: "og:title",
			content: "Match Audit Workspace — Tennis Matrix Audit System"
		},
		{
			property: "og:description",
			content: "Every stage persists an execution record. No record, no completion."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
/**
* Readiness of the graded set, next to raw processor throughput.
*
* The denominator comes from ACTIVE_METRIC_CODES (derived from COMPARISON_SPECS), so
* promoting a metric moves it automatically -- there is no literal count in this component.
*/
var IndexRoute = Route$16.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$17
});
var AppRouteRoute = Route$15.update({
	id: "/app",
	path: "/app",
	getParentRoute: () => Route$17
});
var ApiAdminRepublishMetricsDocumentRoute = Route$14.update({
	id: "/api/admin-republish-metrics-document",
	path: "/api/admin-republish-metrics-document",
	getParentRoute: () => Route$17
});
var ApiDriveAuditBatchRoute = Route$13.update({
	id: "/api/drive-audit-batch",
	path: "/api/drive-audit-batch",
	getParentRoute: () => Route$17
});
var ApiEvidenceCoverageDiagnosticRoute = Route$12.update({
	id: "/api/evidence-coverage-diagnostic",
	path: "/api/evidence-coverage-diagnostic",
	getParentRoute: () => Route$17
});
var ApiWarehouseIngestRoute = Route$11.update({
	id: "/api/warehouse-ingest",
	path: "/api/warehouse-ingest",
	getParentRoute: () => Route$17
});
var AppRouteRouteChildren = {
	AppBoardRoute: Route$10.update({
		id: "/board",
		path: "/board",
		getParentRoute: () => AppRouteRoute
	}),
	AppCalibrationRoute: Route$9.update({
		id: "/calibration",
		path: "/calibration",
		getParentRoute: () => AppRouteRoute
	}),
	AppCalibrationHistoryRoute: Route$8.update({
		id: "/calibration-history",
		path: "/calibration-history",
		getParentRoute: () => AppRouteRoute
	}),
	AppDashboardRoute: Route$7.update({
		id: "/dashboard",
		path: "/dashboard",
		getParentRoute: () => AppRouteRoute
	}),
	AppLogsRoute: Route$6.update({
		id: "/logs",
		path: "/logs",
		getParentRoute: () => AppRouteRoute
	}),
	AppReportsRoute: Route$5.update({
		id: "/reports",
		path: "/reports",
		getParentRoute: () => AppRouteRoute
	}),
	AppRulesRoute: Route$4.update({
		id: "/rules",
		path: "/rules",
		getParentRoute: () => AppRouteRoute
	}),
	AppSlateRoute: Route$3.update({
		id: "/slate",
		path: "/slate",
		getParentRoute: () => AppRouteRoute
	}),
	AppSourcesRoute: Route$2.update({
		id: "/sources",
		path: "/sources",
		getParentRoute: () => AppRouteRoute
	}),
	AppUploadRoute: Route$1.update({
		id: "/upload",
		path: "/upload",
		getParentRoute: () => AppRouteRoute
	}),
	AppMatchMatchIdRoute: Route.update({
		id: "/match/$matchId",
		path: "/match/$matchId",
		getParentRoute: () => AppRouteRoute
	})
};
var rootRouteChildren = {
	IndexRoute,
	AppRouteRoute: AppRouteRoute._addFileChildren(AppRouteRouteChildren),
	ApiAdminRepublishMetricsDocumentRoute,
	ApiDriveAuditBatchRoute,
	ApiEvidenceCoverageDiagnosticRoute,
	ApiWarehouseIngestRoute
};
var routeTree = Route$17._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
var getRouter = () => {
	const queryClient = new QueryClient();
	return createRouter({
		routeTree,
		context: { queryClient },
		scrollRestoration: true,
		defaultPreloadStaleTime: 0
	});
};
//#endregion
export { activeSlateMatchIds as a, activeRunIds as i, Route as n, currentAuditRows as o, useBoardRows as r, isRowOnActiveSlate as s, router_exports as t };
