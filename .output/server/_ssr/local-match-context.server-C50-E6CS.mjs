import { r as __exportAll } from "../_runtime.mjs";
import { s as __exportAll$1 } from "./server-KPZuT5q2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/local-match-context.server-C50-E6CS.js
var local_match_context_server_C50_E6CS_exports = /* @__PURE__ */ __exportAll({
	n: () => resolveLocalMatchContext,
	t: () => local_match_context_server_exports
});
var local_match_context_server_exports = /* @__PURE__ */ __exportAll$1({ resolveLocalMatchContext: () => resolveLocalMatchContext });
function norm(v) {
	return String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function usable(v) {
	const s = String(v ?? "").trim();
	if (!s) return null;
	const n = norm(s);
	if (/^(unavailable|unknown|n a|na|null|none|-)$/.test(n)) return null;
	return s;
}
function cleanTournament(v) {
	const good = usable(v);
	if (!good) return null;
	const raw = good.replace(/^\$?[\d,]+\s*(?:vol(?:ume)?)?\s*/i, "").trim();
	const n = norm(raw);
	if (/cincinn/.test(n)) return "Cincinnati Open";
	if (/montreal|canadian open|rogers cup/.test(n)) return "Canadian Open";
	if (/us open/.test(n)) return "US Open";
	return raw || null;
}
function normalizeRound(v) {
	const good = usable(v);
	if (!good) return null;
	const s = norm(good);
	if (/quarter/.test(s)) return "Quarterfinals";
	if (/semi/.test(s)) return "Semifinals";
	if (/^final/.test(s)) return "Final";
	if (/round of 16|2nd round|second round/.test(s)) return "Round of 16";
	if (/round of 32|1st round|first round/.test(s)) return "Round of 32";
	if (/round of 64/.test(s)) return "Round of 64";
	return good;
}
function hintTournament(hints) {
	return cleanTournament(hints.tournament ?? hints.event ?? null);
}
function hintDate(hints) {
	const v = usable(hints.scheduled_date ?? hints.date ?? null);
	if (!v) return null;
	const iso = v.match(/20\d{2}-\d{2}-\d{2}/)?.[0];
	if (iso) return iso;
	const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
	if (/\btoday\b/i.test(v)) return today;
	const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
	if (/\btomorrow\b/i.test(v)) return tomorrow;
	return null;
}
function registryContext(tournament) {
	const n = norm(tournament);
	if (/cincinnati/.test(n)) return {
		tournament: "Cincinnati Open",
		event_level: null,
		round: null,
		scheduled_date: null,
		surface: "Hard",
		best_of: "3"
	};
	return {
		tournament: null,
		event_level: null,
		round: null,
		scheduled_date: null,
		surface: null,
		best_of: null
	};
}
function resolveLocalMatchContext(_p1, _p2, hints) {
	const tournament = hintTournament(hints);
	const registry = registryContext(tournament);
	const hintedLevel = usable(hints.event_level);
	const hintedSurface = usable(hints.surface);
	const hintedBestOf = usable(hints.best_of);
	const fields = {
		tournament: registry.tournament ?? tournament,
		event_level: hintedLevel,
		round: normalizeRound(hints.round),
		scheduled_date: hintDate(hints),
		surface: hintedSurface ?? registry.surface,
		best_of: hintedBestOf ?? registry.best_of
	};
	const sources = [];
	if (registry.tournament) sources.push("Static tournament context registry");
	return {
		ok: Object.values(fields).some(Boolean),
		fields,
		sources,
		sourceUrl: null,
		unresolvedReason: "Fast local resolver supplies deterministic event facts only; exact current round/date require persisted or bounded web verification."
	};
}
//#endregion
export { resolveLocalMatchContext as n, local_match_context_server_C50_E6CS_exports as t };
