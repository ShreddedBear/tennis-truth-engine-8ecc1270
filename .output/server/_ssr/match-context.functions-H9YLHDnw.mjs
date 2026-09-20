import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createServerRpc } from "./createServerRpc-BLr1vCfx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/match-context.functions-H9YLHDnw.js
var KEYS = [
	"tournament",
	"event_level",
	"round",
	"scheduled_date",
	"surface",
	"best_of"
];
var ONLINE_ENRICHMENT_BUDGET_MS = 4e3;
function norm(v) {
	return String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function nameTokens(v) {
	return norm(v).split(" ").filter(Boolean);
}
function samePlayer(a, b) {
	const x = nameTokens(a), y = nameTokens(b);
	if (!x.length || !y.length) return false;
	if (x.join(" ") === y.join(" ")) return true;
	if (x[x.length - 1] !== y[y.length - 1]) return false;
	const sx = new Set(x), sy = new Set(y);
	const overlap = [...sx].filter((t) => sy.has(t)).length;
	const shorter = Math.min(sx.size, sy.size);
	return overlap === shorter || overlap >= Math.min(2, shorter);
}
function samePair(a1, a2, b1, b2) {
	return samePlayer(a1, b1) && samePlayer(a2, b2) || samePlayer(a1, b2) && samePlayer(a2, b1);
}
function compatible(a, b) {
	const x = norm(a), y = norm(b);
	return !x || !y || x === y || x.includes(y) || y.includes(x);
}
function suspicious(key, value) {
	const v = String(value ?? "").trim(), n = norm(v);
	if (!v) return true;
	if (/^(unavailable|unknown|n a|na|null|none|-)$/.test(n)) return true;
	if (key === "scheduled_date" && !/^20\d{2}-\d{2}-\d{2}$/.test(v)) return true;
	if (key === "surface" && !/^(hard|clay|grass|carpet)$/i.test(v)) return true;
	if (key === "best_of" && !/^[35]$/.test(v)) return true;
	if (key === "tournament") {
		if (/[\$%()[\]{}<>]/.test(v)) return true;
		if (/\b(?:perf|pere|nta|vo n|volume|vol)\b/i.test(v)) return true;
		if (/cincinn/i.test(v)) {
			if (!/^(?:cincinnati open|atp cincinnati|wta cincinnati|cincinnati masters)$/i.test(v.trim())) return true;
		}
	}
	return false;
}
function mergePreferVerified(base, extra) {
	const out = { ...base };
	for (const key of KEYS) {
		const candidate = extra[key];
		if (!candidate) continue;
		if (!out[key] || suspicious(key, out[key])) out[key] = candidate;
	}
	return out;
}
function missing(fields) {
	return KEYS.filter((key) => !fields[key] || suspicious(key, fields[key]));
}
function tourFromLevel(level) {
	const n = norm(level);
	if (!n) return null;
	if (/\bwta\b/.test(n)) return "WTA";
	if (/\batp\b|masters 1000|challenger/.test(n)) return "ATP";
	return null;
}
function playerTourFromHistory(rows, player) {
	const tours = /* @__PURE__ */ new Set();
	for (const row of rows) {
		if (!samePlayer(player, row.player1_name) && !samePlayer(player, row.player2_name)) continue;
		const tour = tourFromLevel(row.event_level);
		if (tour) tours.add(tour);
	}
	return tours.size === 1 ? [...tours][0] : null;
}
function deterministicEventLevel(tournament, tour) {
	if (!tour) return null;
	const n = norm(tournament);
	if (/cincinnati/.test(n)) return tour === "WTA" ? "WTA 1000" : "Masters 1000";
	return null;
}
async function persistedContext(p1, p2, hints) {
	try {
		const { loadMatchContextHistory } = await import("./match-context.server-B5n9N_9N.mjs");
		const rows = await loadMatchContextHistory();
		const pairRows = rows.filter((r) => samePair(p1, p2, r.player1_name, r.player2_name));
		const tournamentHint = hints.tournament;
		const contextual = pairRows.filter((r) => compatible(r.tournament_name, tournamentHint));
		const best = (contextual.length ? contextual : pairRows)[0] ?? null;
		const p1Tour = playerTourFromHistory(rows, p1), p2Tour = playerTourFromHistory(rows, p2);
		const historyTour = p1Tour && p2Tour && p1Tour === p2Tour ? p1Tour : null;
		const derivedLevel = deterministicEventLevel(best?.tournament_name ?? tournamentHint ?? null, historyTour);
		const fields = {
			tournament: best?.tournament_name ?? null,
			event_level: best?.event_level ?? derivedLevel,
			round: best?.round ?? null,
			scheduled_date: best?.scheduled_date ?? null,
			surface: best?.surface ?? null,
			best_of: best?.best_of === null || best?.best_of === void 0 ? null : String(best.best_of)
		};
		const sources = [];
		if (best) sources.push("Persisted exact player-pair match context");
		if (derivedLevel && !best?.event_level) sources.push("Persisted player-tour history + deterministic tournament level");
		return {
			fields,
			sources
		};
	} catch {
		return {
			fields: {},
			sources: []
		};
	}
}
var resolveMatchContext_createServerFn_handler = createServerRpc({
	id: "47913d188f947f7b0458fd054a8852f3b57132ea03476fbfc9e2c0c9e7ce83f2",
	name: "resolveMatchContext",
	filename: "src/lib/match-context.functions.ts"
}, (opts) => resolveMatchContext.__executeServer(opts));
var resolveMatchContext = createServerFn({ method: "POST" }).inputValidator((data) => {
	if (!data || !data.p1?.trim() || !data.p2?.trim()) throw new Error("Both player names are required");
	return {
		p1: data.p1.trim(),
		p2: data.p2.trim(),
		hints: data.hints ?? {}
	};
}).handler(resolveMatchContext_createServerFn_handler, async ({ data }) => {
	const persisted = await persistedContext(data.p1, data.p2, data.hints);
	const { resolveLocalMatchContext } = await import("./local-match-context.server-C50-E6CS.mjs").then((n) => n.t).then((n) => n.t);
	const local = resolveLocalMatchContext(data.p1, data.p2, mergePreferVerified(data.hints, persisted.fields));
	let fields = mergePreferVerified(data.hints, persisted.fields);
	fields = mergePreferVerified(fields, local.fields);
	const sources = [...persisted.sources, ...local.sources];
	if (missing(fields).length) try {
		const { resolveMatchIdentity } = await import("./audit-research.server-D8MhZa1Z.mjs").then((n) => n.n).then((n) => n.n);
		const webPromise = resolveMatchIdentity({
			p1: data.p1,
			p2: data.p2,
			hints: fields
		}).catch(() => null);
		const web = await Promise.race([webPromise, new Promise((resolve) => setTimeout(() => resolve(null), ONLINE_ENRICHMENT_BUDGET_MS))]);
		if (web) {
			fields = mergePreferVerified(fields, {
				tournament: web.tournament,
				event_level: web.event_level,
				round: web.round,
				scheduled_date: web.scheduled_date,
				surface: web.surface,
				best_of: web.best_of === null || web.best_of === void 0 ? null : String(web.best_of)
			});
			sources.push(...web.sources.map((s) => s.source_name).filter(Boolean));
		}
	} catch {}
	const unresolved = missing(fields);
	return {
		ok: Object.values(fields).some(Boolean),
		fields,
		sources: [...new Set(sources)],
		unresolvedReason: unresolved.length ? `Still unresolved: ${unresolved.join(", ")}` : null
	};
});
//#endregion
export { resolveMatchContext_createServerFn_handler };
