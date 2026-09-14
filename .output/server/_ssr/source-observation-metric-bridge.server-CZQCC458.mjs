import { n as reconstruct, r as sanitizeEvidence, t as RECONSTRUCTION_SPECS } from "./engine-tr9AM3Mg.mjs";
import { t as loadRuntimeIndex } from "./ssr.mjs";
import { T as getTableColumns, a as eq, c as inArray, d as lt, f as lte, i as and, k as sql, m as notInArray, n as asc, o as gte, r as desc, s as ilike, u as isNull } from "../_libs/drizzle-orm.mjs";
import { t as db } from "./client.server-B14ewPcb.mjs";
import { c as playersTable, s as matchesTable } from "./matches-CtYuxOLN.mjs";
import { c as metricEvidenceStoreTable } from "./metrics-2UTgcTdn.mjs";
import { p as sourceObservationsTable } from "./sources-B3f820Qo.mjs";
import { t as aiResearcher } from "./audit-research.server-D8MhZa1Z.mjs";
import { n as resolveLocalMatchContext } from "./local-match-context.server-C50-E6CS.mjs";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
//#region node_modules/.nitro/vite/services/ssr/assets/source-observation-metric-bridge.server-CZQCC458.js
/**
* Builds the `set` for onConflictDoUpdate: every column appearing in `rows`, taken from
* the proposed row, minus the conflict-target columns (updating a key to itself is
* pointless and Postgres rejects it in some shapes).
*/
function excludedSet(table, rows, conflictColumns) {
	const columns = getTableColumns(table);
	const targeted = new Set(conflictColumns);
	const touched = /* @__PURE__ */ new Set();
	for (const row of rows) for (const key of Object.keys(row)) touched.add(key);
	const set = {};
	for (const key of touched) {
		if (targeted.has(key)) continue;
		const column = columns[key];
		if (!column) throw new Error(`Column "${key}" is not defined on this table.`);
		set[key] = sql.raw(`excluded.${escapeIdentifier(column.name)}`);
	}
	if (Object.keys(set).length === 0) throw new Error("An upsert whose payload is only its conflict key updates nothing; use insert ... on conflict do nothing.");
	return set;
}
function escapeIdentifier(name) {
	return `"${name.replace(/"/gu, "\"\"")}"`;
}
async function tryQuery(run) {
	try {
		return {
			data: await run(),
			error: null
		};
	} catch (error) {
		return {
			data: null,
			error: error instanceof Error ? error : new Error(String(error))
		};
	}
}
/**
* The audited match's date, parsed from the pipeline's context string
* ("tournament X · date 2024-05-02 · surface clay"). Null means the boundary could not be
* established, which callers must treat as "no admissible evidence", never as "no filter".
*/
function auditCutoff(context) {
	return context.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
/**
* True only when `rowDate` is present and strictly before the boundary. Strictly before,
* not on-or-before: a match played on the audited day is not information available for
* predicting that day's match. A missing date returns false -- unprovable is not admissible.
*/
function isBeforeCutoff(rowDate, cutoff) {
	return typeof rowDate === "string" && rowDate.length > 0 && rowDate < cutoff;
}
/** True when `rowDate` is present and at or before the boundary (for opponent-state lookups). */
function isAtOrBeforeCutoff(rowDate, cutoff) {
	return typeof rowDate === "string" && rowDate.length > 0 && rowDate <= cutoff;
}
var RESULTS_SCHEDULE_METRICS = /* @__PURE__ */ new Set([
	"001",
	"002",
	"003",
	"005",
	"006",
	"007",
	"008",
	"009",
	"010",
	"011",
	"012",
	"013",
	"018",
	"020",
	"021",
	"022",
	"023",
	"024",
	"025",
	"026",
	"027",
	"028",
	"029",
	"030",
	"031",
	"034",
	"035",
	"036",
	"037",
	"038",
	"041",
	"043",
	"044",
	"045",
	"046",
	"047",
	"049",
	"050",
	"051",
	"052",
	"053",
	"054",
	"055",
	"056",
	"058",
	"061",
	"064",
	"068",
	"071",
	"076",
	"077",
	"080",
	"081"
]);
var RANKING_METRICS = /* @__PURE__ */ new Set([
	"013",
	"014",
	"020",
	"023",
	"038",
	"055",
	"058",
	"062",
	"068",
	"080"
]);
var MARKET_METRICS = /* @__PURE__ */ new Set([
	"015",
	"019",
	"043",
	"044",
	"073"
]);
var ENVIRONMENT_METRICS = /* @__PURE__ */ new Set([
	"001",
	"021",
	"030",
	"060",
	"071",
	"075"
]);
var PBP_METRICS = /* @__PURE__ */ new Set([
	"002",
	"003",
	"004",
	"008",
	"009",
	"010",
	"011",
	"016",
	"018",
	"022",
	"024",
	"025",
	"031",
	"032",
	"033",
	"034",
	"037",
	"040",
	"041",
	"042",
	"043",
	"044",
	"045",
	"046",
	"051",
	"052",
	"053",
	"054",
	"060",
	"070",
	"071"
]);
var RULES_METRICS = /* @__PURE__ */ new Set([
	"020",
	"064",
	"075",
	"076"
]);
function codeOf$10(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function policyForMetric(metricCode) {
	const code = codeOf$10(metricCode), allowed = /* @__PURE__ */ new Set(), sufficient = /* @__PURE__ */ new Set(), supportOnly = /* @__PURE__ */ new Set();
	if (RESULTS_SCHEDULE_METRICS.has(code)) allowed.add("RESULTS_SCHEDULE");
	if (RANKING_METRICS.has(code)) allowed.add("RANKING");
	if (MARKET_METRICS.has(code)) allowed.add("MARKET");
	if (ENVIRONMENT_METRICS.has(code)) allowed.add("ENVIRONMENT");
	if (PBP_METRICS.has(code)) allowed.add("POINT_BY_POINT");
	if (RULES_METRICS.has(code)) allowed.add("RULES_CONTEXT");
	if (["015", "019"].includes(code)) sufficient.add("MARKET");
	if (code === "021") sufficient.add("RESULTS_SCHEDULE");
	if (["014", "062"].includes(code)) sufficient.add("RANKING");
	for (const family of allowed) if (!sufficient.has(family)) supportOnly.add(family);
	return {
		metric_code: code,
		allowed_families: [...allowed],
		sufficient_families: [...sufficient],
		support_only_families: [...supportOnly]
	};
}
function observationFamily(row) {
	const source = String(row.source_id ?? "").toLowerCase(), type = String(row.observation_type ?? "").toUpperCase(), key = String(row.observation_key ?? "").toLowerCase();
	if ((/* @__PURE__ */ new Set([
		"atp",
		"wta",
		"atp_challenger",
		"wta_challenger",
		"wta_125",
		"tennisdata_wta_challenger",
		"production_wta_125"
	])).has(source) && ["MATCH_RESULT_OR_SCHEDULE", "TOURNAMENT_SCHEDULE"].includes(type)) return "RESULTS_SCHEDULE";
	if (type === "RANKING" || key.includes("ranking") || key.includes("rank_points")) return "RANKING";
	if (source === "odds_api" || type === "MARKET" || key.includes("decimal_odds")) return "MARKET";
	if (source === "open_meteo" || type === "ENVIRONMENT") return "ENVIRONMENT";
	if (type === "POINT_BY_POINT" || type === "PBP") return "POINT_BY_POINT";
	if (type === "RULES" || type === "RULES_CONTEXT") return "RULES_CONTEXT";
	return null;
}
function assertObservationFamily(row, expected) {
	const actual = observationFamily(row);
	if (actual !== expected) throw new Error(`Observation family mismatch: expected ${expected}, got ${actual ?? "UNKNOWN"}`);
	return row;
}
function metricAllowsObservation(metricCode, row) {
	const family = observationFamily(row);
	return Boolean(family && policyForMetric(metricCode).allowed_families.includes(family));
}
var SUPPORTED$2 = /* @__PURE__ */ new Set([
	"021",
	"030",
	"060",
	"071"
]);
var KEYS = [
	"temperature_2m",
	"relative_humidity_2m",
	"precipitation",
	"pressure_msl",
	"surface_pressure",
	"wind_speed_10m",
	"wind_direction_10m",
	"wind_gusts_10m"
];
function codeOf$9(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function mean$4(values) {
	return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
function round$2(value, digits = 1) {
	if (value === null) return null;
	const p = 10 ** digits;
	return Math.round(value * p) / p;
}
function isoShift(date, days) {
	const d = /* @__PURE__ */ new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}
async function deterministicEnvironmentMetric(args) {
	const code = codeOf$9(args.metricCode);
	if (!SUPPORTED$2.has(code)) return null;
	const tournament = String(args.tournament ?? "").trim();
	if (!tournament) return null;
	const query = () => db.select().from(sourceObservationsTable).where(and(eq(sourceObservationsTable.source_id, "open_meteo"), eq(sourceObservationsTable.observation_type, "ENVIRONMENT"), eq(sourceObservationsTable.tournament, tournament), gte(sourceObservationsTable.event_date, isoShift(args.asOfDate, -1)), lte(sourceObservationsTable.event_date, args.asOfDate)));
	const { data, error } = await tryQuery(query);
	if (error) return null;
	const rows = (data ?? []).filter((row) => KEYS.includes(String(row.observation_key ?? "")) && metricAllowsObservation(code, row));
	if (!rows.length) return null;
	const byKey = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const key = String(row.observation_key ?? "");
		if (row.numeric_value === null || !Number.isFinite(Number(row.numeric_value))) continue;
		const arr = byKey.get(key) ?? [];
		arr.push(Number(row.numeric_value));
		byKey.set(key, arr);
	}
	const t = round$2(mean$4(byKey.get("temperature_2m") ?? []));
	const rh = round$2(mean$4(byKey.get("relative_humidity_2m") ?? []));
	const rain = round$2(mean$4(byKey.get("precipitation") ?? []), 2);
	const wind = round$2(mean$4(byKey.get("wind_speed_10m") ?? []));
	const gust = round$2(mean$4(byKey.get("wind_gusts_10m") ?? []));
	const pressure = round$2(mean$4(byKey.get("pressure_msl") ?? byKey.get("surface_pressure") ?? []));
	const parts = [
		t === null ? null : `temp=${t}`,
		rh === null ? null : `humidity=${rh}`,
		rain === null ? null : `precip=${rain}`,
		wind === null ? null : `wind=${wind}`,
		gust === null ? null : `gust=${gust}`,
		pressure === null ? null : `pressure=${pressure}`
	].filter(Boolean);
	if (!parts.length) return null;
	const units = new Map(rows.map((row) => [String(row.observation_key), row.unit]));
	const value = `${parts.join(" | ")} | shared match environment`;
	const sourceMap = /* @__PURE__ */ new Map();
	for (const row of rows) sourceMap.set(`${row.source_name}|${row.source_url}`, {
		source_name: row.source_name,
		url: row.source_url
	});
	return {
		metric_code: code,
		p1_value: value,
		p2_value: value,
		p1_treatment: "PARTIAL",
		p2_treatment: "PARTIAL",
		differential: null,
		evidence_family: "ENVIRONMENT",
		reliability: rows.length >= 12 ? 85 : 70,
		sample: `Open-Meteo ${tournament} hourly observations=${rows.length}; units temp=${units.get("temperature_2m") ?? "unknown"}, humidity=${units.get("relative_humidity_2m") ?? "unknown"}, wind=${units.get("wind_speed_10m") ?? "unknown"}`,
		unavailable_reason: null,
		sources: [...sourceMap.values()]
	};
}
function normalizeEvidenceIdentity(value) {
	return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function surname(value) {
	const parts = normalizeEvidenceIdentity(value).split(" ").filter(Boolean);
	return parts.length >= 2 ? parts[parts.length - 1] : null;
}
function isSurnameOnlyEvidenceIdentity(value) {
	return normalizeEvidenceIdentity(value).split(" ").filter(Boolean).length === 1;
}
/**
* Resolve a surname-only uploaded identity only when the warehouse candidate
* set proves exactly one full canonical name. This is intentionally strict:
* no fuzzy matching, initials, prefix matching, or best-effort selection.
*/
function uniqueCanonicalWarehouseIdentity(uploaded, warehouseCandidates) {
	if (!isSurnameOnlyEvidenceIdentity(uploaded)) return uploaded;
	const wantedSurname = normalizeEvidenceIdentity(uploaded);
	if (!wantedSurname) return null;
	const byNormalized = /* @__PURE__ */ new Map();
	for (const candidate of warehouseCandidates) {
		const display = String(candidate ?? "").trim();
		const normalized = normalizeEvidenceIdentity(display);
		const parts = normalized.split(" ").filter(Boolean);
		if (parts.length < 2 || parts[parts.length - 1] !== wantedSurname) continue;
		if (!byNormalized.has(normalized)) byNormalized.set(normalized, display);
	}
	if (byNormalized.size === 1) return [...byNormalized.values()][0];
	const candidates = [...byNormalized.entries()].map(([normalized, display]) => ({
		display,
		parts: normalized.split(" ").filter(Boolean)
	}));
	const full = candidates.filter(({ parts }) => parts.length >= 2 && parts[0].length > 1);
	if (full.length !== 1) return null;
	const [canonical] = full;
	const firstInitial = canonical.parts[0][0];
	const canonicalSurname = canonical.parts[canonical.parts.length - 1];
	return candidates.every(({ parts }) => {
		if (parts.join(" ") === canonical.parts.join(" ")) return true;
		return parts.length === 2 && parts[0].length === 1 && parts[0] === firstInitial && parts[1] === canonicalSurname;
	}) ? canonical.display : null;
}
/**
* Evidence written by older completion sweeps sometimes used only a surname
* (for example "Gauff") while the audit asks for the canonical display name
* ("Coco Gauff"). Recover only the exact surname alias implied by an already
* canonical matchup; no fuzzy/edit-distance matching is permitted here.
*/
function safeEvidenceAliases(player, opponent) {
	const aliases = /* @__PURE__ */ new Set([player]);
	const playerSurname = surname(player);
	const opponentSurname = surname(opponent);
	if (playerSurname && playerSurname !== opponentSurname) aliases.add(playerSurname);
	return [...aliases];
}
function evidenceNameMatches(stored, requested, opponent) {
	return new Set(safeEvidenceAliases(requested, opponent).map(normalizeEvidenceIdentity)).has(normalizeEvidenceIdentity(stored));
}
function evidencePairMatches(storedPlayer, storedOpponent, player, opponent) {
	return evidenceNameMatches(storedPlayer, player, opponent) && evidenceNameMatches(storedOpponent, opponent, player);
}
function ascii(value) {
	return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}
function normalizeEvidenceText(value) {
	return ascii(value).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim() || null;
}
function normalizeEvidenceTournament(value) {
	let normalized = normalizeEvidenceText(value);
	if (!normalized) return null;
	normalized = normalized.replace(/\b(?:presented by|powered by)\b.*$/g, " ").replace(/\b20\d{2}\b/g, " ").replace(/\b(?:atp|wta)\s*(?:tour)?\b/g, " ").replace(/\b(?:wta\s*)?125\b|\b125k\b/g, " ").replace(/\bchallenger(?:\s+\d{2,3})?\b/g, " ").replace(/\b(?:250|500|1000)\b/g, " ").replace(/\s+/g, " ").trim();
	return normalized || null;
}
function normalizeEvidenceRound(value) {
	const normalized = normalizeEvidenceText(value);
	if (!normalized) return null;
	return {
		f: "final",
		final: "final",
		finals: "final",
		sf: "semifinal",
		semifinal: "semifinal",
		semifinals: "semifinal",
		qf: "quarterfinal",
		quarterfinal: "quarterfinal",
		quarterfinals: "quarterfinal",
		r128: "round 128",
		r64: "round 64",
		r32: "round 32",
		r16: "round 16",
		q1: "qualifying 1",
		q2: "qualifying 2",
		q3: "qualifying 3"
	}[normalized] ?? normalized.replace(/^round of (\d+)$/, "round $1");
}
function normalizeEvidenceDate(value) {
	const text = String(value ?? "").trim();
	if (!text) return null;
	const direct = text.match(/^(\d{4}-\d{2}-\d{2})/);
	if (direct) return direct[1];
	const parsed = new Date(text);
	return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
}
function evidenceDateCompatible(a, b, toleranceDays = 1) {
	const left = normalizeEvidenceDate(a), right = normalizeEvidenceDate(b);
	if (!left || !right) return true;
	return Math.abs((/* @__PURE__ */ new Date(`${left}T00:00:00Z`)).getTime() - (/* @__PURE__ */ new Date(`${right}T00:00:00Z`)).getTime()) <= toleranceDays * 864e5;
}
function normalizeEvidenceCompetitionLevel(value) {
	const normalized = normalizeEvidenceText(value);
	if (!normalized) return null;
	if (/\bwta\s*125\b|\bwta125\b|\b125k\b/.test(normalized)) return "WTA_125";
	if (/\bchallenger\b/.test(normalized)) return "CHALLENGER";
	if (/\bgrand slam\b|\bslam\b/.test(normalized)) return "GRAND_SLAM";
	if (/\bmasters\b|\b1000\b/.test(normalized)) return "1000";
	if (/\b500\b/.test(normalized)) return "500";
	if (/\b250\b/.test(normalized)) return "250";
	return normalized.toUpperCase().replace(/ /g, "_");
}
function classifyEvidenceTourFamily(...values) {
	const text = values.map((value) => normalizeEvidenceText(value) ?? "").join(" ");
	if (!text.trim()) return null;
	if (/\bwta\s*125\b|\bwta125\b|\b125k\b|\bwta\s+challenger\b|\bwomen(?:s)?\s+challenger\b/.test(text)) return "WTA_CHALLENGER";
	if (/\batp\s+challenger\b/.test(text) || /\bchallenger\b/.test(text) && !/\bwta\b|\bwomen/.test(text)) return "ATP_CHALLENGER";
	if (/\bwta\b|\bwomen/.test(text)) return /\bchallenger\b/.test(text) ? "WTA_CHALLENGER" : "WTA_MAIN";
	if (/\batp\b|\bmasters\b|\bgrand slam\b|\bslam\b|\b250\b|\b500\b|\b1000\b/.test(text)) return /\bchallenger\b/.test(text) ? "ATP_CHALLENGER" : "ATP_MAIN";
	return null;
}
function evidenceTourCompatible(expected, candidate) {
	if (!expected || !candidate) return false;
	return expected === candidate;
}
function playerIdentity(stableId, name) {
	const id = normalizeEvidenceText(stableId);
	if (id) return `id:${id}`;
	return `name:${normalizeEvidenceText(name) ?? "unknown"}`;
}
function buildCanonicalEvidenceMatchIdentity(input) {
	const players = [playerIdentity(input.player1StableId, input.player1Name), playerIdentity(input.player2StableId, input.player2Name)].sort();
	const tournament = normalizeEvidenceTournament(input.tournament);
	const date = normalizeEvidenceDate(input.date);
	const round = normalizeEvidenceRound(input.round);
	const tourFamily = classifyEvidenceTourFamily(input.tour, input.eventLevel, input.tournament);
	const competitionLevel = normalizeEvidenceCompetitionLevel(input.eventLevel);
	const key = [
		players.join("~"),
		tourFamily ?? "UNRESOLVED_TOUR",
		competitionLevel ?? "UNRESOLVED_LEVEL",
		tournament ?? "UNRESOLVED_EVENT",
		date ?? "UNRESOLVED_DATE",
		round ?? "UNRESOLVED_ROUND"
	].join("|");
	return {
		playerPair: players.join("~"),
		tournament,
		date,
		round,
		tourFamily,
		competitionLevel,
		key
	};
}
function codeOf$8(value) {
	const m = String(value).match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value).padStart(3, "0");
}
var CERTIFIED_METRIC_POLICIES = {
	"012": {
		code: "012",
		name: "Fatigue/Workload",
		permittedRawInputs: [
			"pre-match recent match dates",
			"completed-match duration/minutes",
			"set and game counts from completed recent matches",
			"completed match format / deciding-set count",
			"documented match finish time",
			"upcoming-match scheduled time for rest-hours calculation",
			"qualifying-round participation/results",
			"documented tournament locations / coordinates",
			"documented event time-zone offsets"
		],
		exactInputMarkers: [
			/matches?_last_7_days|matches? in 7 days|past week/i,
			/minutes?(_on_court)?|actual minutes|duration/i,
			/sets?(_last_| played)|games?(_last_| played)/i,
			/three[_ -]?setters?|went the distance/i,
			/late finish/i,
			/rest[_ -]?hours?/i,
			/qualifying/i,
			/travel(_km| distance)?|time[_ -]?zone/i
		],
		reconstructionGroups: [
			[/matches?_last_7_days|matches? in 7 days|past week/i],
			[/minutes?(_on_court)?|actual minutes|duration/i],
			[/sets?(_last_| played)|games?(_last_| played)/i],
			[/three[_ -]?setters?|went the distance/i],
			[/late finish/i],
			[/rest[_ -]?hours?/i],
			[/qualifying/i],
			[/travel(_km| distance)?|time[_ -]?zone/i]
		],
		forbiddenProxyOnly: [
			/\belo\b/i,
			/\branking\b/i,
			/generic recent form/i
		]
	},
	"019": {
		code: "019",
		name: "Market Calibration",
		permittedRawInputs: [
			"historical pre-match player prices/odds",
			"bookmaker or prediction-market implied probabilities",
			"explicit no-vig transformation where required",
			"historical match outcomes",
			"a reproducible implied-probability bucket definition",
			"bucket sample size / wins / graded outcomes"
		],
		exactInputMarkers: [
			/historical.*(odds|price)|implied[_ -]?probab|no[_ -]?vig/i,
			/bucket/i,
			/outcomes?|wins?|losses?|graded/i,
			/calibrat/i
		],
		reconstructionGroups: [
			[/(historical.*(odds|price))|implied[_ -]?probab|no[_ -]?vig/i],
			[/bucket/i],
			[/outcomes?|wins?|losses?|graded/i]
		],
		forbiddenProxyOnly: [
			/current odds only/i,
			/model probability only/i,
			/\belo\b/i,
			/\branking\b/i
		]
	},
	"022": {
		code: "022",
		name: "Serve/Return Shot-Level Efficiency",
		permittedRawInputs: [
			"charted serve+1 outcomes",
			"charted return+1 outcomes",
			"rally-state labels",
			"shot-level outcomes tied to player and score context"
		],
		exactInputMarkers: [
			/serve\s*\+?\s*1|serve[_ -]?plus[_ -]?1/i,
			/return\s*\+?\s*1|return[_ -]?plus[_ -]?1/i,
			/rally[_ -]?state/i,
			/charted.*shot|shot[_ -]?outcome/i
		],
		reconstructionGroups: [
			[/serve\s*\+?\s*1|serve[_ -]?plus[_ -]?1/i],
			[/return\s*\+?\s*1|return[_ -]?plus[_ -]?1/i],
			[/rally[_ -]?state/i],
			[/charted.*shot|shot[_ -]?outcome/i]
		],
		forbiddenProxyOnly: [
			/hold %|hold_pct/i,
			/break %|break_pct/i,
			/ace rate/i,
			/return points won/i
		]
	},
	"024": {
		code: "024",
		name: "Hidden Performance Quality",
		permittedRawInputs: [
			"point-level or game-level performance observations",
			"expected conversion values",
			"actual conversion values",
			"charted shot-quality inputs where the submetric requires them"
		],
		exactInputMarkers: [
			/point[_ -]?level|game[_ -]?level|points? won|games? won/i,
			/expected/i,
			/actual|conversion/i,
			/shot[_ -]?quality|charted shot/i
		],
		reconstructionGroups: [
			[/point[_ -]?level|game[_ -]?level|points? won|games? won/i],
			[/expected/i],
			[/actual|conversion/i],
			[/shot[_ -]?quality|charted shot/i]
		],
		forbiddenProxyOnly: [
			/scoreline only/i,
			/\belo\b/i,
			/\branking\b/i,
			/win loss record only/i
		]
	},
	"025": {
		code: "025",
		name: "Match Deterioration Metrics",
		permittedRawInputs: [
			"chronological set-by-set observations",
			"set-level serve performance",
			"set-level return performance",
			"set-level point performance",
			"documented/observed physical trend evidence when required"
		],
		exactInputMarkers: [
			/set[_ -]?by[_ -]?set|set\s*[123]/i,
			/serve/i,
			/return/i,
			/points?/i,
			/physical|movement|medical/i
		],
		reconstructionGroups: [
			[/set[_ -]?by[_ -]?set|set\s*[123]/i],
			[/serve/i],
			[/return/i],
			[/points?/i],
			[/physical|movement|medical/i]
		],
		forbiddenProxyOnly: [
			/final score only/i,
			/season average only/i,
			/\belo\b/i,
			/\branking\b/i
		]
	},
	"072": {
		code: "072",
		name: "Matchup Nuance",
		permittedRawInputs: [
			"verified one-handed/two-handed backhand type",
			"opponent dominant shot pattern needed for the backhand matchup interaction",
			"verified height/reach/wingspan observations for the matchup differential",
			"documented junior/ITF-era head-to-head meetings and results"
		],
		exactInputMarkers: [
			/one[- ]handed|two[- ]handed|backhand type|backhand matchup/i,
			/reach|wingspan|height differential/i,
			/junior.*(head|meeting|h2h)|ITF.*(head|meeting|h2h)|junior\/ITF/i
		],
		reconstructionGroups: [
			[/one[- ]handed|two[- ]handed|backhand type|backhand matchup/i],
			[/dominant shot pattern|forehand pattern|backhand pattern|shot pattern/i],
			[/reach|wingspan|height differential/i],
			[/junior.*(head|meeting|h2h)|ITF.*(head|meeting|h2h)|junior\/ITF/i]
		],
		forbiddenProxyOnly: [/generic style|style score|\branking\b|\belo\b|career h2h only|height alone|weather|market odds|fatigue/i],
		requireCompleteForFullTreatment: true,
		allowReconstructed: false,
		rejectForbiddenFields: true
	},
	"073": {
		code: "073",
		name: "Sentiment / Integrity",
		permittedRawInputs: [
			"attributable pre-match player public statements/interviews/press conferences",
			"documented player social-media engagement/activity observations with a reproducible anomaly basis",
			"named betting-exchange matched-volume data tied to the match"
		],
		exactInputMarkers: [
			/public statement|interview|press conference|player statement/i,
			/social[- ]media.*(engagement|activity|anomal)|engagement anomal/i,
			/betting exchange.*(matched volume|volume spike)|matched[- ]volume/i
		],
		reconstructionGroups: [
			[/public statement|interview|press conference|player statement/i],
			[/social[- ]media.*(engagement|activity|anomal)|engagement anomal/i],
			[/betting exchange.*(matched volume|volume spike)|matched[- ]volume/i]
		],
		forbiddenProxyOnly: [/fans? think|fan chatter|rumou?r|generic sentiment|sportsbook odds|line movement|injury speculation|social chatter|surface elo|serve profile|weather/i],
		requireCompleteForFullTreatment: true,
		allowReconstructed: false,
		rejectForbiddenFields: true
	},
	"074": {
		code: "074",
		name: "Biomechanics / Physical Detail",
		permittedRawInputs: [
			"charted serve-toss placement observations sufficient to measure consistency",
			"verified racket head size/string pattern/stiffness plus opponent spin/power interaction evidence",
			"charted/documented directional movement asymmetry attributable to a past injury",
			"verified recent grip-size or grip-style changes"
		],
		exactInputMarkers: [
			/serve toss.*(consisten|variab|placement)|toss placement/i,
			/racket.*(head size|string pattern|stiffness)|head size|racket specs/i,
			/movement asymmetry|directional court coverage|favors? .*leg|favors? .*side/i,
			/grip[- ]size|grip style|grip adjustment/i
		],
		reconstructionGroups: [
			[/serve toss.*(consisten|variab|placement)|toss placement/i],
			[/racket.*(head size|string pattern|stiffness)|head size|racket specs/i],
			[/spin|power style|opponent interaction|against this opponent/i],
			[/movement asymmetry|directional court coverage|favors? .*leg|favors? .*side/i],
			[/grip[- ]size|grip style|grip adjustment/i]
		],
		forbiddenProxyOnly: [/injury history only|generic injury|height|wingspan|serve speed|ace rate|hold %|generic movement|fitness report|\branking\b|market|weather/i],
		requireCompleteForFullTreatment: true,
		allowReconstructed: false,
		rejectForbiddenFields: true
	},
	"075": {
		code: "075",
		name: "Match Format / Rules Context",
		permittedRawInputs: [
			"official deciding-set tiebreak rule for the event",
			"best-of-3/best-of-5 format plus player-specific historical format adjustment evidence",
			"actual challenge/review count remaining at the relevant in-match stage when admissible"
		],
		exactInputMarkers: [
			/deciding[- ]set.*(tiebreak|breaker)|10[- ]point breaker|7[- ]point breaker|advantage set/i,
			/best[- ]of[- ]?[35]|bo[35].*(adjust|split|profile)|format adjustment/i,
			/challenge.*remaining|review.*remaining|hawk[- ]eye.*remaining/i
		],
		reconstructionGroups: [
			[/deciding[- ]set.*(tiebreak|breaker)|10[- ]point breaker|7[- ]point breaker|advantage set/i],
			[/best[- ]of[- ]?[35]|bo[35]/i],
			[/adjust|split|profile|historical/i],
			[/challenge.*remaining|review.*remaining|hawk[- ]eye.*remaining/i]
		],
		forbiddenProxyOnly: [/event level|surface|roof|order of play|court assignment|practice access|weather|travel|fatigue/i],
		requireCompleteForFullTreatment: true,
		allowReconstructed: false,
		rejectForbiddenFields: true
	},
	"076": {
		code: "076",
		name: "Scheduling Micro-Context",
		permittedRawInputs: [
			"official order-of-play position / first-on / not-before time",
			"official outer-court versus stadium/show-court assignment",
			"documented official practice-court access or hitting-time evidence before the match"
		],
		exactInputMarkers: [
			/match order|order of play|first on court|not before/i,
			/outer court|stadium court|show court|court assignment/i,
			/practice[- ]court access|official hitting time|practice access/i
		],
		reconstructionGroups: [
			[/match order|order of play|first on court|not before/i],
			[/outer court|stadium court|show court|court assignment/i],
			[/practice[- ]court access|official hitting time|practice access/i]
		],
		forbiddenProxyOnly: [/rest hours|days since last match|travel|time zone|weather|wind|roof|generic fatigue|schedule density|best-of|deciding-set tiebreak/i],
		requireCompleteForFullTreatment: true,
		allowReconstructed: false,
		rejectForbiddenFields: true
	}
};
function textOf(finding, side) {
	return String(side === "P1" ? finding.p1_value ?? "" : finding.p2_value ?? "");
}
function treatmentOf(finding, side) {
	return side === "P1" ? finding.p1_treatment : finding.p2_treatment;
}
function hasSource(finding) {
	return (finding.sources ?? []).some((s) => Boolean(String(s.source_name ?? "").trim()));
}
function hasExactInput(policy, text) {
	return policy.exactInputMarkers.some((r) => r.test(text));
}
function reconstructionComplete(policy, text) {
	if (!policy.reconstructionGroups.length) return true;
	return policy.reconstructionGroups.every((group) => group.some((r) => r.test(text)));
}
function hasForbiddenField(policy, text) {
	return policy.forbiddenProxyOnly.some((r) => r.test(text));
}
function proxyOnly(policy, text) {
	return hasForbiddenField(policy, text) && !reconstructionComplete(policy, text);
}
function validateSide(policy, finding, side) {
	const value = side === "P1" ? finding.p1_value : finding.p2_value;
	const treatment = treatmentOf(finding, side);
	if (treatment === "EXCLUDED") return {
		value,
		treatment,
		reason: null
	};
	if (value === null || value === void 0 || value === "") return {
		value: null,
		treatment: "UNAVAILABLE",
		reason: "No persisted metric value for this player side."
	};
	const text = textOf(finding, side);
	if (!hasSource(finding)) return {
		value: null,
		treatment: "UNAVAILABLE",
		reason: "Usable evidence lacked persisted named-source provenance."
	};
	if (policy.rejectForbiddenFields && hasForbiddenField(policy, text)) return {
		value: null,
		treatment: "UNAVAILABLE",
		reason: `Cross-wired/forbidden fields were mixed into metric ${policy.code}; the side is rejected rather than counting unrelated evidence.`
	};
	if (proxyOnly(policy, text)) return {
		value: null,
		treatment: "UNAVAILABLE",
		reason: `Only proxy/cross-wired evidence was present for metric ${policy.code}; exact permitted inputs were absent.`
	};
	if (!hasExactInput(policy, text)) return {
		value: null,
		treatment: "UNAVAILABLE",
		reason: `Value did not expose any exact permitted raw input for metric ${policy.code}.`
	};
	const complete = reconstructionComplete(policy, text);
	if (treatment === "RECONSTRUCTED" && policy.allowReconstructed === false) return {
		value,
		treatment: "PARTIAL",
		reason: `Metric ${policy.code} has no approved deterministic reconstruction formula; sourced exact components may remain PARTIAL but cannot be promoted to RECONSTRUCTED.`
	};
	if ((treatment === "RECONSTRUCTED" || policy.requireCompleteForFullTreatment && treatment === "DIRECT") && !complete) return {
		value,
		treatment: "PARTIAL",
		reason: `The broad metric ${policy.code} was only partly satisfied; exact supported components are retained as PARTIAL, never promoted to full DIRECT/RECONSTRUCTED treatment.`
	};
	return {
		value,
		treatment,
		reason: null
	};
}
/**
* Conservative post-validation for the sequentially certified metric families.
* It never upgrades evidence. It may only preserve or downgrade a provider/local
* finding when provenance, semantic inputs, or reconstruction completeness fail.
*/
function certifyMetricFinding(finding) {
	const policy = CERTIFIED_METRIC_POLICIES[codeOf$8(finding.metric_code)];
	if (!policy) return finding;
	const p1 = validateSide(policy, finding, "P1");
	const p2 = validateSide(policy, finding, "P2");
	const reasons = [p1.reason, p2.reason].filter(Boolean);
	return {
		...finding,
		p1_value: p1.value,
		p2_value: p2.value,
		p1_treatment: p1.treatment,
		p2_treatment: p2.treatment,
		unavailable_reason: reasons.length ? reasons.join(" | ") : finding.unavailable_reason,
		missing_inputs: reasons.length ? [.../* @__PURE__ */ new Set([...finding.missing_inputs ?? [], ...reasons])] : finding.missing_inputs
	};
}
var MARKET_CODES = /* @__PURE__ */ new Set([
	"015",
	"019",
	"043",
	"044"
]);
var from = "2020-06-06";
function codeOf$7(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function mean$3(values) {
	return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
function median(values) {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function implied(decimalOdds) {
	return decimalOdds > 1 ? 1 / decimalOdds : null;
}
function snapshotKey(row) {
	return String(row.provenance?.snapshot_timestamp ?? row.source_published_at ?? row.source_record_key ?? "unknown");
}
function bookmakerKey(row) {
	return String(row.provenance?.bookmaker_key ?? row.sample_label ?? "unknown");
}
function deVigForPlayer(playerRows, opponentRows) {
	const oppByPair = /* @__PURE__ */ new Map();
	for (const row of opponentRows) {
		if (!row.numeric_value) continue;
		oppByPair.set(`${snapshotKey(row)}|${bookmakerKey(row)}`, row.numeric_value);
	}
	const probs = [];
	for (const row of playerRows) {
		if (!row.numeric_value) continue;
		const oppOdds = oppByPair.get(`${snapshotKey(row)}|${bookmakerKey(row)}`);
		if (!oppOdds) continue;
		const p = implied(row.numeric_value);
		const q = implied(oppOdds);
		if (p == null || q == null || p + q <= 0) continue;
		probs.push(p / (p + q));
	}
	return probs;
}
function movement(rows) {
	const pts = rows.filter((r) => typeof r.numeric_value === "number" && r.numeric_value > 1).map((r) => ({
		t: Date.parse(String(r.source_published_at ?? r.provenance?.snapshot_timestamp ?? "")),
		p: implied(r.numeric_value)
	})).filter((x) => Number.isFinite(x.t) && x.p != null).sort((a, b) => a.t - b.t);
	if (pts.length < 2) return null;
	return pts[pts.length - 1].p - pts[0].p;
}
function eventCompatible(row, tournament) {
	if (!tournament) return true;
	const expected = normalizeEvidenceTournament(tournament);
	const actual = normalizeEvidenceTournament(row.tournament ?? row.provenance?.tournament ?? row.raw_payload?.sport_title);
	if (!expected || !actual) return true;
	return expected === actual || expected.includes(actual) || actual.includes(expected);
}
function rowTourFamily(row) {
	return classifyEvidenceTourFamily(row.tournament, row.raw_payload?.sport_key, row.raw_payload?.sport_title, row.provenance?.sport_key, row.sample_label);
}
function expectedMarketFamily(args, rows) {
	const explicit = classifyEvidenceTourFamily(args.context, args.tournament);
	if (explicit) return explicit;
	const families = new Set(rows.map(rowTourFamily).filter((family) => Boolean(family)));
	return families.size === 1 ? [...families][0] : null;
}
async function loadSide(player, opponent, matchDate, tournament) {
	const playerAliases = safeEvidenceAliases(player, opponent);
	const opponentAliases = safeEvidenceAliases(opponent, player);
	const { data, error } = await tryQuery(() => db.select().from(sourceObservationsTable).where(and(eq(sourceObservationsTable.source_id, "odds_api"), eq(sourceObservationsTable.observation_type, "MARKET"), eq(sourceObservationsTable.event_date, matchDate), inArray(sourceObservationsTable.player_name, playerAliases), inArray(sourceObservationsTable.opponent_name, opponentAliases))).orderBy(asc(sourceObservationsTable.source_published_at)));
	if (error) return [];
	return (data ?? []).filter((row) => evidencePairMatches(row.player_name, row.opponent_name, player, opponent) && eventCompatible(row, tournament));
}
function summarizeMarket(rows, opponentRows) {
	const odds = rows.map((r) => Number(r.numeric_value)).filter((v) => Number.isFinite(v) && v > 1);
	const rawImplied = odds.map((o) => 1 / o);
	const devig = deVigForPlayer(rows, opponentRows);
	return {
		observations: odds.length,
		paired_devig_observations: devig.length,
		avg_decimal_odds: mean$3(odds),
		median_decimal_odds: median(odds),
		avg_raw_implied_probability: mean$3(rawImplied),
		avg_devig_probability: mean$3(devig),
		probability_movement: movement(rows),
		favorite_share: rawImplied.length ? rawImplied.filter((p) => p > .5).length / rawImplied.length : null
	};
}
function fmtPct(v) {
	return v == null ? "n/a" : `${(v * 100).toFixed(1)}%`;
}
function valueText(summary) {
	return [
		`avg_de_vig=${fmtPct(summary.avg_devig_probability)}`,
		`avg_raw=${fmtPct(summary.avg_raw_implied_probability)}`,
		`move=${fmtPct(summary.probability_movement)}`,
		`favorite_share=${fmtPct(summary.favorite_share)}`,
		`n=${summary.observations}`,
		`paired=${summary.paired_devig_observations}`
	].join("; ");
}
async function deterministicMarketMetric(args) {
	const code = codeOf$7(args.metricCode);
	if (!MARKET_CODES.has(code) || args.asOfDate < from) return null;
	const [p1RowsRaw, p2RowsRaw] = await Promise.all([loadSide(args.p1, args.p2, args.asOfDate, args.tournament), loadSide(args.p2, args.p1, args.asOfDate, args.tournament)]);
	const expectedFamily = expectedMarketFamily(args, [...p1RowsRaw, ...p2RowsRaw]);
	if (!expectedFamily) return null;
	const p1Rows = p1RowsRaw.filter((row) => metricAllowsObservation(code, row) && evidenceTourCompatible(expectedFamily, rowTourFamily(row)));
	const p2Rows = p2RowsRaw.filter((row) => metricAllowsObservation(code, row) && evidenceTourCompatible(expectedFamily, rowTourFamily(row)));
	if (!p1Rows.length && !p2Rows.length) return null;
	const p1Summary = summarizeMarket(p1Rows, p2Rows);
	const p2Summary = summarizeMarket(p2Rows, p1Rows);
	const sourceUrl = p1Rows[0]?.source_url ?? p2Rows[0]?.source_url;
	const sourceName = p1Rows[0]?.source_name ?? p2Rows[0]?.source_name;
	if (!sourceName) return null;
	const isCoreMarket = code === "015" || code === "019";
	return certifyMetricFinding({
		metric_code: code,
		p1_value: valueText(p1Summary),
		p2_value: valueText(p2Summary),
		p1_treatment: isCoreMarket ? "RECONSTRUCTED" : "PARTIAL",
		p2_treatment: isCoreMarket ? "RECONSTRUCTED" : "PARTIAL",
		differential: p1Summary.avg_devig_probability != null && p2Summary.avg_devig_probability != null ? `${((p1Summary.avg_devig_probability - p2Summary.avg_devig_probability) * 100).toFixed(1)} pp de-vig` : null,
		evidence_family: "MARKET",
		reliability: Math.min(95, 55 + Math.min(40, Math.floor((p1Summary.paired_devig_observations + p2Summary.paired_devig_observations) / 4))),
		sample: `The Odds API canonical four-tour match ${args.asOfDate}${args.tournament ? ` @ ${args.tournament}` : ""}; tour_family=${expectedFamily}; p1_n=${p1Summary.observations}; p2_n=${p2Summary.observations}`,
		unavailable_reason: code === "019" ? "Outcome-linked calibration completion still requires verified result labels; this row supplies deterministic historical market probability components." : null,
		sources: [{
			source_name: sourceName,
			url: sourceUrl
		}]
	});
}
var TASK18B_METRIC_CODES = /* @__PURE__ */ new Set([
	"009",
	"018",
	"032",
	"002",
	"003",
	"016"
]);
var SIDES = ["player1", "player2"];
var other = (s) => s === "player1" ? "player2" : "player1";
var slot = (v) => {
	const s = String(v ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
	return [
		"player1",
		"p1",
		"1",
		"home",
		"first"
	].includes(s) ? "player1" : [
		"player2",
		"p2",
		"2",
		"away",
		"second"
	].includes(s) ? "player2" : null;
};
var bool = (v) => typeof v === "boolean" ? v : v === 1 || v === "1" || String(v ?? "").toLowerCase() === "true" ? true : v === 0 || v === "0" || String(v ?? "").toLowerCase() === "false" ? false : null;
function codedIndicator(p, kind) {
	const explicit = kind === "ace" ? bool(p?.ace ?? p?.is_ace) : bool(p?.double_fault ?? p?.doubleFault ?? p?.is_double_fault);
	if (explicit !== null) return explicit;
	const coded = [
		p?.code,
		p?.point_code,
		p?.pointCode,
		p?.label
	].filter((v) => v !== null && v !== void 0 && String(v).trim()).join(" ").toLowerCase();
	if (!coded) return null;
	return kind === "ace" ? /(^|\W)ace($|\W)/.test(coded) : /double[ _-]?fault|(^|\W)df($|\W)/.test(coded);
}
function explicitSetNo(v) {
	for (const x of [
		v?.set_number,
		v?.setNumber,
		v?.set_no,
		v?.setNo,
		v?.set_index,
		v?.setIndex
	]) {
		const n = Number(x);
		if (Number.isInteger(n) && n >= 0) return n === 0 ? 1 : n;
	}
	return null;
}
function postGames(v) {
	const a = Number(v?.player1_games), b = Number(v?.player2_games);
	return Number.isInteger(a) && a >= 0 && Number.isInteger(b) && b >= 0 ? {
		player1: a,
		player2: b
	} : null;
}
function inferTiebreak(v, winner, post) {
	if (bool(v?.tiebreak ?? v?.tie_break ?? v?.is_tiebreak ?? v?.isTieBreak) === true) return true;
	if (!winner || !post) return false;
	const pre = { ...post };
	pre[winner] -= 1;
	return pre.player1 === 6 && pre.player2 === 6;
}
function collectGames(payload) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	const walk = (v, ctx) => {
		if (!v || typeof v !== "object" || seen.has(v)) return;
		seen.add(v);
		if (Array.isArray(v)) {
			for (const x of v) walk(x, ctx);
			return;
		}
		if (Array.isArray(v.points)) {
			const server = slot(v.server ?? v.server_slot ?? v.serving_player ?? v.servingPlayer);
			if (server) {
				const points = [];
				let complete = v.points.length > 0;
				for (const p of v.points) {
					if (!p || typeof p !== "object") {
						complete = false;
						continue;
					}
					const winner = slot(p.winner ?? p.point_winner ?? p.pointWinner ?? p.winner_slot ?? p.won_by);
					if (!winner) {
						complete = false;
						continue;
					}
					points.push({
						winner,
						ace: codedIndicator(p, "ace"),
						doubleFault: codedIndicator(p, "doubleFault")
					});
				}
				const winner = slot(v.winner ?? v.game_winner ?? v.gameWinner ?? v.winner_slot), post = postGames(v);
				if (points.length) out.push({
					setNo: explicitSetNo(v) ?? ctx.setNo,
					server,
					points,
					tiebreak: inferTiebreak(v, winner, post),
					winner,
					complete: complete && points.length === v.points.length,
					postGames: post
				});
			}
		}
		for (const [k, x] of Object.entries(v)) {
			if (k === "points") continue;
			if (Array.isArray(x) && /sets?/i.test(k)) {
				x.forEach((item, i) => walk(item, { setNo: i + 1 }));
				continue;
			}
			walk(x, { setNo: explicitSetNo(v) ?? ctx.setNo });
		}
	};
	walk(payload, { setNo: null });
	return out;
}
function gameWinner(g) {
	if (!g.complete) return null;
	if (g.winner) return g.winner;
	if (g.tiebreak) return null;
	let a = 0, b = 0;
	for (const p of g.points) {
		if (p.winner === "player1") a++;
		else b++;
		if ((a >= 4 || b >= 4) && Math.abs(a - b) >= 2) return a > b ? "player1" : "player2";
	}
	return null;
}
function wouldWinGame(s0, r0, w) {
	const s = s0 + (w === "server" ? 1 : 0), r = r0 + (w === "returner" ? 1 : 0);
	return (s >= 4 || r >= 4) && Math.abs(s - r) >= 2;
}
function wouldWinSet(ownGames, oppGames) {
	const own = ownGames + 1;
	return own >= 6 && own - oppGames >= 2 || own === 7;
}
function scoreLabel(n) {
	return n === 0 ? "0" : n === 1 ? "15" : n === 2 ? "30" : "40";
}
function stateLabelFor(mine, theirs) {
	if (mine >= 3 && theirs >= 3) {
		if (mine === theirs) return "Deuce";
		if (mine - theirs === 1) return "Advantage";
		return null;
	}
	if (mine > 3 || theirs > 3) return null;
	return `${scoreLabel(mine)}-${scoreLabel(theirs)}`;
}
var pct$4 = (n, d) => d > 0 ? Number((100 * n / d).toFixed(4)) : null;
var ratio = (n, d) => d > 0 ? Number((n / d).toFixed(4)) : null;
function binomialCoefficient(n, k) {
	if (k < 0 || k > n) return 0;
	let r = 1;
	for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
	return r;
}
function gameWinProbFromPointProb(p) {
	const q = 1 - p;
	let winOutright = 0;
	for (let r = 0; r <= 2; r++) winOutright += binomialCoefficient(3 + r, r) * p ** 4 * q ** r;
	const reachDeuce = binomialCoefficient(6, 3) * p ** 3 * q ** 3, winFromDeuce = p * p + q * q > 0 ? p * p / (p * p + q * q) : .5;
	return winOutright + reachDeuce * winFromDeuce;
}
function emptyTotals() {
	return {
		pointsWon: 0,
		pointsLost: 0,
		servicePoints: 0,
		servicePointsWon: 0,
		returnPoints: 0,
		returnPointsWon: 0,
		serviceGames: 0,
		serviceGamesWon: 0,
		returnGames: 0,
		returnGamesWon: 0,
		breakPointsFaced: 0,
		breakPointsSaved: 0,
		breakChances: 0,
		breakPointsConverted: 0,
		deucePoints: 0,
		deucePointsWon: 0,
		pressurePoints: 0,
		pressurePointsWon: 0,
		aces: 0,
		aceKnownServicePoints: 0,
		doubleFaults: 0,
		doubleFaultKnownServicePoints: 0,
		breakbackOpportunities: 0,
		breakbacks: 0,
		closeoutOpportunities: 0,
		closeouts: 0,
		ntServiceGames: 0,
		ntHolds: 0,
		holdsAfterSavingBP: 0,
		cleanHolds: 0,
		loveFifteenHolds: 0,
		ntReturnGames: 0,
		ntBreaks: 0,
		cleanBreaks: 0,
		pressureReturnGamesReached: 0,
		pressureReturnGameStreakCur: 0,
		pressureReturnGameStreakLongest: 0
	};
}
function reconstructPbpScoreState(payload) {
	const games = collectGames(payload), pointCount = games.reduce((n, g) => n + g.points.length, 0), hasSetBoundaries = games.length > 0 && games.every((g) => Number.isInteger(g.setNo)), winners = games.map(gameWinner), allGameWinners = games.length > 0 && winners.every(Boolean), allPointsComplete = games.length > 0 && games.every((g) => g.complete);
	const fieldSupport = {
		server: games.length > 0,
		point_winner: pointCount > 0,
		score_state: allGameWinners && allPointsComplete,
		set_boundary: hasSetBoundaries,
		ace_indicator: false,
		double_fault_indicator: false,
		serve_number: false,
		rally_length: false,
		shot_type: false,
		shot_placement: false,
		handedness: false
	};
	if (!games.length || !pointCount || !allGameWinners || !allPointsComplete) return {
		valid: false,
		reason: "PBP lacks a complete server/point-winner game structure; incomplete points or ambiguous game outcomes are not credited.",
		game_count: games.length,
		point_count: pointCount,
		derived: {
			player1: {},
			player2: {}
		},
		field_support: fieldSupport
	};
	const totals = {
		player1: emptyTotals(),
		player2: emptyTotals()
	}, setGames = /* @__PURE__ */ new Map();
	let previousGame = null;
	const stateTallies = {
		player1: {},
		player2: {}
	};
	const recordState = (side, label, won) => {
		const bucket = stateTallies[side];
		bucket[label] ??= {
			wins: 0,
			total: 0
		};
		bucket[label].total++;
		if (won) bucket[label].wins++;
	};
	const streak = {
		player1: {
			cur: 0,
			longest: 0
		},
		player2: {
			cur: 0,
			longest: 0
		}
	};
	for (let gi = 0; gi < games.length; gi++) {
		const g = games[gi], server = g.server, returner = other(server), winner = winners[gi], st = totals[server], rt = totals[returner];
		st.serviceGames++;
		rt.returnGames++;
		if (winner === server) st.serviceGamesWon++;
		else rt.returnGamesWon++;
		let sp = 0, rp = 0, facedBP = false, reachedDeuce = false, pressureGame = false;
		for (const p of g.points) {
			totals[p.winner].pointsWon++;
			totals[other(p.winner)].pointsLost++;
			st.servicePoints++;
			rt.returnPoints++;
			if (p.winner === server) st.servicePointsWon++;
			else rt.returnPointsWon++;
			streak[p.winner].cur++;
			streak[p.winner].longest = Math.max(streak[p.winner].longest, streak[p.winner].cur);
			streak[other(p.winner)].cur = 0;
			if (p.ace !== null) {
				fieldSupport.ace_indicator = true;
				st.aceKnownServicePoints++;
				if (p.ace) st.aces++;
			}
			if (p.doubleFault !== null) {
				fieldSupport.double_fault_indicator = true;
				st.doubleFaultKnownServicePoints++;
				if (p.doubleFault) st.doubleFaults++;
			}
			if (!g.tiebreak) {
				const bp = wouldWinGame(sp, rp, "returner"), deuce = sp >= 3 && rp >= 3 && sp === rp;
				const serverLabel = stateLabelFor(sp, rp), returnerLabel = stateLabelFor(rp, sp);
				if (serverLabel) recordState(server, serverLabel, p.winner === server);
				if (returnerLabel) recordState(returner, returnerLabel, p.winner === returner);
				if (bp) {
					recordState(server, "Break Point", p.winner === server);
					recordState(returner, "Break Point", p.winner === returner);
				}
				if (bp) {
					st.breakPointsFaced++;
					rt.breakChances++;
					facedBP = true;
					if (p.winner === server) st.breakPointsSaved++;
					else rt.breakPointsConverted++;
				}
				if (deuce) {
					st.deucePoints++;
					rt.deucePoints++;
					reachedDeuce = true;
					if (p.winner === server) st.deucePointsWon++;
					else rt.deucePointsWon++;
				}
				if (bp || deuce) {
					st.pressurePoints++;
					rt.pressurePoints++;
					pressureGame = true;
					if (p.winner === server) st.pressurePointsWon++;
					else rt.pressurePointsWon++;
				}
				if (p.winner === server) sp++;
				else rp++;
			} else {
				st.pressurePoints++;
				rt.pressurePoints++;
				if (p.winner === server) st.pressurePointsWon++;
				else rt.pressurePointsWon++;
			}
		}
		if (!g.tiebreak) {
			st.ntServiceGames++;
			rt.ntReturnGames++;
			if (winner === server) {
				st.ntHolds++;
				if (facedBP) st.holdsAfterSavingBP++;
				if (!facedBP && !reachedDeuce) st.cleanHolds++;
				if (rp <= 1) st.loveFifteenHolds++;
			} else {
				rt.ntBreaks++;
				if (!reachedDeuce) rt.cleanBreaks++;
			}
			if (pressureGame) {
				rt.pressureReturnGamesReached++;
				rt.pressureReturnGameStreakCur++;
			} else rt.pressureReturnGameStreakCur = 0;
			rt.pressureReturnGameStreakLongest = Math.max(rt.pressureReturnGameStreakLongest, rt.pressureReturnGameStreakCur);
		}
		if (hasSetBoundaries) {
			const sn = g.setNo, score = setGames.get(sn) ?? {
				player1: 0,
				player2: 0
			};
			if (previousGame && previousGame.setNo === sn && previousGame.brokenPlayer === returner) {
				totals[returner].breakbackOpportunities++;
				if (winner === returner) totals[returner].breakbacks++;
			}
			if (wouldWinSet(score[server], score[returner])) {
				st.closeoutOpportunities++;
				if (winner === server) st.closeouts++;
			}
			previousGame = winner === returner ? {
				setNo: sn,
				brokenPlayer: server
			} : null;
			score[winner]++;
			if (g.postGames && (score.player1 !== g.postGames.player1 || score.player2 !== g.postGames.player2)) return {
				valid: false,
				reason: "PBP game counters conflict with reconstructed chronological game state.",
				game_count: games.length,
				point_count: pointCount,
				derived: {
					player1: {},
					player2: {}
				},
				field_support: fieldSupport
			};
			setGames.set(sn, score);
		}
	}
	const derived = {
		player1: {},
		player2: {}
	};
	for (const s of SIDES) {
		const t = totals[s], ot = totals[other(s)], add = (code, treatment, value, raw, transform) => {
			derived[s][code] = {
				treatment,
				value,
				raw_fields: raw,
				transformation: transform
			};
		};
		add("002", "PARTIAL", {
			service_points: t.servicePoints,
			service_points_won: t.servicePointsWon,
			service_point_win_pct: pct$4(t.servicePointsWon, t.servicePoints),
			service_games: t.serviceGames,
			service_games_won: t.serviceGamesWon,
			hold_pct: pct$4(t.serviceGamesWon, t.serviceGames),
			aces: fieldSupport.ace_indicator ? t.aces : null,
			double_faults: fieldSupport.double_fault_indicator ? t.doubleFaults : null,
			serve_number_available: false
		}, [
			"server",
			"point_winner",
			"game_winner",
			"ace/DF only when encoded"
		], "Aggregate objective service-point and service-game outcomes; serve-number dimensions remain unavailable.");
		add("003", "PARTIAL", {
			return_points: t.returnPoints,
			return_points_won: t.returnPointsWon,
			return_point_win_pct: pct$4(t.returnPointsWon, t.returnPoints),
			return_games: t.returnGames,
			return_games_won: t.returnGamesWon,
			break_pct: pct$4(t.returnGamesWon, t.returnGames),
			serve_number_available: false
		}, [
			"server",
			"point_winner",
			"game_winner"
		], "Orient each point and game to the non-server; serve-number splits are not inferred.");
		add("009", "PARTIAL", {
			pressure_points: t.pressurePoints,
			pressure_points_won: t.pressurePointsWon,
			pressure_win_pct: pct$4(t.pressurePointsWon, t.pressurePoints),
			set_boundaries: hasSetBoundaries
		}, [
			"server",
			"chronological point_winner",
			"set boundary when encoded"
		], "Break-point/deuce/tiebreak pressure is deterministic; the full deciding/late-set contract is not broadened beyond encoded state.");
		add("032", "PARTIAL", {
			break_chances: t.breakChances,
			break_points_converted: t.breakPointsConverted,
			bp_converted_pct: pct$4(t.breakPointsConverted, t.breakChances)
		}, ["server", "chronological point_winner"], "Replay score and count return-side break chances converted -- only \"break opportunities per successful break\" of this composite metric's 10 named sub-components (see COMPOSITE_COMPONENTS[\"032\"] in validated-completion-research.server.ts) is covered by deterministic replay; points-to-games/sets expectation modeling, deuce-game win rate, and 0-30/15-30/30-0/40-15 game-state splits are not built here, so treatment is corrected to PARTIAL rather than the composite's full RECONSTRUCTED bar. Retargeted from the mismatched code 037/004 to real code 032 (\"Point-to-Game Conversion Efficiency\").");
		if (hasSetBoundaries) add("018", "RECONSTRUCTED", {
			breakback_opportunities: t.breakbackOpportunities,
			breakbacks: t.breakbacks,
			breakback_rate_pct: pct$4(t.breakbacks, t.breakbackOpportunities),
			closeout_opportunities: t.closeoutOpportunities,
			closeouts: t.closeouts,
			closeout_rate_pct: pct$4(t.closeouts, t.closeoutOpportunities)
		}, [
			"server",
			"game winner",
			"set boundary",
			"chronological game order"
		], "Grade the immediate return game after being broken (breakback) and serving-for-set closeouts within the same set. Retargeted from the mismatched codes 070/071 to real code 018 (\"Momentum & Closing Metrics\"), whose own bullets name both \"Performance Following Momentum Events\" (breaking/being broken) and \"Closing Ability\" (serving-for-match/set position).");
		add("053", "PARTIAL", {
			pressure_points: t.pressurePoints,
			pressure_points_won: t.pressurePointsWon,
			pressure_index_pct: pct$4(t.pressurePointsWon, t.pressurePoints),
			pressure_return_games_reached: t.pressureReturnGamesReached,
			pressure_return_game_longest_streak: t.pressureReturnGameStreakLongest,
			serve_escape_dependency_pct: pct$4(t.holdsAfterSavingBP, t.ntHolds),
			clean_hold_pct: pct$4(t.cleanHolds, t.ntHolds),
			clean_break_pct: pct$4(t.cleanBreaks, t.ntBreaks),
			love_fifteen_hold_pct: pct$4(t.loveFifteenHolds, t.ntHolds),
			nt_holds: t.ntHolds,
			nt_breaks: t.ntBreaks,
			set_boundaries: hasSetBoundaries
		}, [
			"server",
			"chronological point_winner",
			"per-game deuce/break-point state",
			"set boundary when encoded"
		], "Composite metric's 6 named sub-components (see COMPOSITE_COMPONENTS[\"053\"] in validated-completion-research.server.ts): \"pressure accumulation score\" is now covered two ways -- the original match-wide pressure-point win-rate (pressure_index_pct) plus, closer to the bullet's literal wording (\"consecutive return games in which a player reaches 30-all, deuce, or break point\"), pressure_return_games_reached and pressure_return_game_longest_streak, replayed per side across only that side's own return games in chronological order. \"Serve Escape Dependency\" (holds that required saving a break point, vs routine holds), \"Clean-Hold Rate\" (service games held without ever reaching deuce or facing a break point), \"Clean-Break Rate\" (breaks achieved without the return game ever reaching deuce), and \"Love/15 Hold Rate\" (service games held while conceding 0 or 1 points) are newly added here, each denominated over non-tiebreak service/return games only (nt_holds/nt_breaks) since deuce/break-point are not defined inside a tiebreak's own scoring. \"Return-Game Abandonment Rate\" (how often a player \"generates no further pressure ... after falling behind early\") is deliberately NOT computed: distinguishing a returner who stopped competing after falling behind from one who simply lost points normally requires an intent judgment this replay cannot make from score state alone -- forcing a definition (e.g. \"lost the return game 0 or 1 points\") would conflate routine holds against a strong server with genuine abandonment, so it is excluded rather than guessed, the same way 032's own excluded sub-components are documented. Treatment stays PARTIAL because of that one excluded sub-component. Retargeted from the mismatched code 079 to real code 053 (\"Pressure & Clean-Game Metrics\").");
		{
			const oppRpwPct = pct$4(ot.returnPointsWon, ot.returnPoints), ownRpwPct = pct$4(t.returnPointsWon, t.returnPoints);
			const pService = ratio(t.servicePointsWon, t.servicePoints), pReturn = ratio(t.returnPointsWon, t.returnPoints);
			const expectedGamesWon = pService === null || pReturn === null ? null : Number((t.serviceGames * gameWinProbFromPointProb(pService) + t.returnGames * gameWinProbFromPointProb(pReturn)).toFixed(4));
			add("034", "PARTIAL", {
				total_points_won: t.pointsWon,
				total_points_played: t.pointsWon + t.pointsLost,
				total_points_won_pct: pct$4(t.pointsWon, t.pointsWon + t.pointsLost),
				actual_games_won: t.serviceGamesWon + t.returnGamesWon,
				expected_games_won: expectedGamesWon,
				break_chances: t.breakChances,
				break_points_converted: t.breakPointsConverted,
				bp_converted_pct: pct$4(t.breakPointsConverted, t.breakChances),
				own_return_points_won_pct: ownRpwPct,
				opponent_return_points_won_pct: oppRpwPct,
				dominance_ratio: ownRpwPct !== null && oppRpwPct !== null && oppRpwPct > 0 ? Number((ownRpwPct / oppRpwPct).toFixed(4)) : null,
				pressure_points_won_pct: pct$4(t.pressurePointsWon, t.pressurePoints),
				clutch_dependency_gap: (() => {
					const overall = pct$4(t.pointsWon, t.pointsWon + t.pointsLost), pressure = pct$4(t.pressurePointsWon, t.pressurePoints);
					return overall === null || pressure === null ? null : Number((pressure - overall).toFixed(4));
				})()
			}, [
				"server",
				"chronological point_winner",
				"both sides' return-point totals from the same match"
			], "Component-level reconstruction of all 5 named catalog bullets (see the long comment immediately above this add() call for what each field covers and why no fused index number is produced); expected_games_won uses a documented, verifiable i.i.d.-points probability model, not an official catalog formula, and dominance_ratio reuses matchup-efficiency.server.ts's own canonical formula rather than inventing a new one.");
		}
		const states = stateTallies[s], stateEntries = Object.entries(states).filter(([, v]) => v.total > 0).map(([label, v]) => [label, {
			n: v.total,
			win_pct: pct$4(v.wins, v.total)
		}]);
		add("016", "PARTIAL", {
			longest_point_win_streak: streak[s].longest,
			score_state_performance_json: stateEntries.length ? JSON.stringify(Object.fromEntries(stateEntries)) : null
		}, ["server", "chronological point_winner"], "Replay the intra-game score point-by-point to tag each point's pre-point state (0-30/15-30/30-30/Deuce/Advantage/Break Point) and the match-wide longest point-win streak; only states actually reached are reported, none are zero-filled. Serve-direction, return positioning/depth, rally-length, winner/unforced-error, and set-point/match-point bullets require shot-level or set/match-score tracking this file does not build, so treatment stays PARTIAL.");
	}
	return {
		valid: true,
		reason: null,
		game_count: games.length,
		point_count: pointCount,
		derived,
		field_support: fieldSupport
	};
}
function blankOpeningProfile() {
	return {
		opening_service_game_held: null,
		opening_return_game_broken: null,
		first_4_games_win_differential: null,
		first_6_games_point_differential: null,
		early_break_conceded: null,
		time_to_first_break_games: null,
		slow_start_flag: null
	};
}
function deriveOpeningWindowProfile(payload) {
	const games = collectGames(payload), winners = games.map(gameWinner);
	const allGameWinners = games.length > 0 && winners.every(Boolean), allPointsComplete = games.length > 0 && games.every((g) => g.complete);
	if (!games.length || !allGameWinners || !allPointsComplete) return {
		valid: false,
		reason: "PBP lacks a complete server/point-winner game structure for the opening-window replay.",
		derived: {
			player1: null,
			player2: null
		}
	};
	const derived = {
		player1: blankOpeningProfile(),
		player2: blankOpeningProfile()
	};
	const gamesWon = {
		player1: 0,
		player2: 0
	}, pointsWon = {
		player1: 0,
		player2: 0
	};
	let firstBreakGameIndex = null;
	for (let gi = 0; gi < games.length; gi++) {
		const g = games[gi], server = g.server, returner = other(server), winner = winners[gi];
		if (gi < 4) gamesWon[winner]++;
		if (gi < 6) for (const p of g.points) pointsWon[p.winner]++;
		if (winner === returner && firstBreakGameIndex === null) firstBreakGameIndex = gi + 1;
		if (derived[server].opening_service_game_held === null) derived[server].opening_service_game_held = winner === server;
		if (derived[returner].opening_return_game_broken === null) derived[returner].opening_return_game_broken = winner === returner;
	}
	for (const side of SIDES) {
		let ownServiceGamesSeen = 0;
		for (let gi = 0; gi < games.length && ownServiceGamesSeen < 2; gi++) {
			if (games[gi].server !== side) continue;
			ownServiceGamesSeen++;
			if (winners[gi] !== side) {
				derived[side].early_break_conceded = true;
				break;
			}
		}
		if (derived[side].early_break_conceded === null && ownServiceGamesSeen > 0) derived[side].early_break_conceded = false;
	}
	for (const side of SIDES) {
		const opp = other(side);
		derived[side].first_4_games_win_differential = games.length >= 4 ? gamesWon[side] - gamesWon[opp] : null;
		derived[side].first_6_games_point_differential = games.length >= 6 ? pointsWon[side] - pointsWon[opp] : null;
		derived[side].time_to_first_break_games = firstBreakGameIndex;
		const diff = derived[side].first_4_games_win_differential;
		derived[side].slow_start_flag = diff === null ? null : diff <= -2;
	}
	return {
		valid: true,
		reason: null,
		derived
	};
}
var SUPPORTED$1 = /* @__PURE__ */ new Set([
	.../* @__PURE__ */ new Set([
		"016",
		"024",
		"025",
		"033",
		"042",
		"043",
		"044",
		"060"
	]),
	"034",
	"053",
	...TASK18B_METRIC_CODES
]);
var codeOf$6 = (v) => {
	const m = String(v ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(v ?? "").padStart(3, "0");
};
function sourceRefs$1(rows) {
	const seen = /* @__PURE__ */ new Set(), out = [];
	for (const row of rows) {
		if (!row.source_name) continue;
		const key = `${row.source_name}|${row.source_url ?? ""}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({
			source_name: row.source_name,
			url: row.source_url,
			retrieved_at: null
		});
	}
	return out;
}
function warehouseSummary(player, opponent, rows) {
	const side = rows.filter((row) => evidenceNameMatches(row.player_name, player, opponent));
	if (!side.length) return null;
	const numeric = side.map((row) => Number(row.numeric_value)).filter(Number.isFinite), keys = [...new Set(side.map((row) => String(row.observation_key ?? "")).filter(Boolean))].slice(0, 12), dates = side.map((row) => row.event_date).filter((v) => Boolean(v)).sort();
	return {
		observations: side.length,
		numeric_observations: numeric.length,
		avg_numeric_value: numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null,
		observed_keys: keys,
		first_date: dates[0] ?? null,
		last_date: dates.at(-1) ?? null
	};
}
function warehouseText(v) {
	if (!v) return null;
	return `pbp_observations=${v.observations}; numeric_observations=${v.numeric_observations}; avg_numeric=${v.avg_numeric_value == null ? "NA" : v.avg_numeric_value.toFixed(4)}; keys=${v.observed_keys.join(",") || "NA"}; window=${v.first_date ?? "NA"}→${v.last_date ?? "NA"}`;
}
function metricText(rows, code) {
	const values = rows.map((r) => r.value?.derived?.[code]).filter(Boolean);
	if (!values.length) return null;
	const last = values.at(-1);
	return `reconstructed_matches=${values.length}; treatment=${last.treatment}; output=${JSON.stringify(last.value)}; raw_fields=${last.raw_fields.join(",")}; transformation=${last.transformation}`;
}
function aggregateOnlyText(rows) {
	const aggregate = rows.filter((r) => r.value?.task18b_raw_fields_available === false);
	if (!aggregate.length) return null;
	const points = aggregate.map((r) => Number(r.value?.total_points)).filter(Number.isFinite), games = aggregate.map((r) => Number(r.value?.total_games)).filter(Number.isFinite);
	return `point_rows=${aggregate.length}; total_points_observed=${points.length}; total_games_observed=${games.length}; aggregate_only=true`;
}
function deterministicPbpMetricFromPacket(args) {
	const code = codeOf$6(args.metricCode);
	if (!SUPPORTED$1.has(code)) return null;
	const entry = args.packet?.[code];
	const rows = Array.isArray(entry?.observations) ? entry.observations.filter((r) => r?.family === "POINT_BY_POINT" && isBeforeCutoff(r.event_date, args.asOfDate)) : [];
	if (!rows.length) return null;
	const p1Rows = rows.filter((r) => evidenceNameMatches(r.player, args.p1, args.p2) && Boolean(r.value?.derived?.[code]));
	const p2Rows = rows.filter((r) => evidenceNameMatches(r.player, args.p2, args.p1) && Boolean(r.value?.derived?.[code]));
	let p1 = metricText(p1Rows, code), p2 = metricText(p2Rows, code);
	let p1Treatment = p1Rows.at(-1)?.value?.derived?.[code]?.treatment ?? "UNAVAILABLE", p2Treatment = p2Rows.at(-1)?.value?.derived?.[code]?.treatment ?? "UNAVAILABLE";
	if (!p1) {
		const agg = aggregateOnlyText(rows.filter((r) => evidenceNameMatches(r.player, args.p1, args.p2)));
		if (agg) {
			p1 = agg;
			p1Treatment = "PARTIAL";
		}
	}
	if (!p2) {
		const agg = aggregateOnlyText(rows.filter((r) => evidenceNameMatches(r.player, args.p2, args.p1)));
		if (agg) {
			p2 = agg;
			p2Treatment = "PARTIAL";
		}
	}
	if (!p1 && !p2) return null;
	const seen = /* @__PURE__ */ new Set(), sources = [];
	for (const row of rows) {
		const sourceName = String(row.source ?? "").trim();
		if (!sourceName) continue;
		const url = row.url ? String(row.url) : null, key = `${sourceName}|${url ?? ""}`;
		if (seen.has(key)) continue;
		seen.add(key);
		sources.push({
			source_name: sourceName,
			url,
			retrieved_at: null
		});
	}
	const pairComplete = Boolean(p1 && p2);
	return {
		metric_code: code,
		p1_value: p1,
		p2_value: p2,
		p1_treatment: p1Treatment,
		p2_treatment: p2Treatment,
		differential: null,
		evidence_family: "POINT_BY_POINT",
		reliability: pairComplete ? 90 : 72,
		sample: `Task 18B approved tour-scoped PBP through ${args.asOfDate}; p1_matches=${p1Rows.length}; p2_matches=${p2Rows.length}; pair_complete=${pairComplete}`,
		unavailable_reason: pairComplete ? null : "Metric-specific PBP evidence is one-sided or lacks the required raw fields; missing evidence is not synthesized.",
		sources
	};
}
async function deterministicPbpMetric(args) {
	const code = codeOf$6(args.metricCode);
	if (!SUPPORTED$1.has(code)) return null;
	const start = /* @__PURE__ */ new Date(`${args.asOfDate}T00:00:00Z`);
	start.setUTCFullYear(start.getUTCFullYear() - 2);
	const p1Aliases = safeEvidenceAliases(args.p1, args.p2), p2Aliases = safeEvidenceAliases(args.p2, args.p1), forSide = (aliases) => tryQuery(() => db.select().from(sourceObservationsTable).where(and(gte(sourceObservationsTable.event_date, start.toISOString().slice(0, 10)), lt(sourceObservationsTable.event_date, args.asOfDate), inArray(sourceObservationsTable.observation_type, ["POINT_BY_POINT", "PBP"]), inArray(sourceObservationsTable.player_name, aliases))).orderBy(desc(sourceObservationsTable.event_date)).limit(1200));
	const [p1Result, p2Result] = await Promise.all([forSide(p1Aliases), forSide(p2Aliases)]);
	if (p1Result.error && p2Result.error) return null;
	const rows = [...p1Result.error ? [] : p1Result.data ?? [], ...p2Result.error ? [] : p2Result.data ?? []].filter((row) => metricAllowsObservation(code, row));
	if (!rows.length) return null;
	const p1 = warehouseText(warehouseSummary(args.p1, args.p2, rows)), p2 = warehouseText(warehouseSummary(args.p2, args.p1, rows));
	if (!p1 && !p2) return null;
	return {
		metric_code: code,
		p1_value: p1,
		p2_value: p2,
		p1_treatment: p1 ? "PARTIAL" : "UNAVAILABLE",
		p2_treatment: p2 ? "PARTIAL" : "UNAVAILABLE",
		differential: null,
		evidence_family: "POINT_BY_POINT",
		reliability: 75,
		sample: `warehouse PBP through ${args.asOfDate}; metric-specific raw-field provenance not guaranteed`,
		unavailable_reason: "Persisted generic PBP remains PARTIAL unless a tour-scoped Task 18B packet proves the metric-specific raw-field contract.",
		sources: sourceRefs$1(rows)
	};
}
var DAY_MS$1 = 864e5;
var K = 32;
function dateOk(v) {
	return /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "").slice(0, 10));
}
function daysBefore(date, asOf) {
	return Math.floor((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS$1);
}
function surfaceKey$1(v) {
	return String(v ?? "").trim().toLowerCase();
}
function roundOrder(v) {
	return {
		Q1: 1,
		Q2: 2,
		Q3: 3,
		R128: 10,
		R64: 20,
		R32: 30,
		R16: 40,
		QF: 50,
		SF: 60,
		F: 70
	}[v.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")] ?? 35;
}
function expected(a, b) {
	return 1 / (1 + 10 ** ((b - a) / 400));
}
function update(a, b, aWon) {
	const s = aWon ? 1 : 0;
	return [a + K * (s - expected(a, b)), b + K * (1 - s - expected(b, a))];
}
function getSurfaceRating(store, surface, player) {
	let bucket = store.get(surface);
	if (!bucket) {
		bucket = /* @__PURE__ */ new Map();
		store.set(surface, bucket);
	}
	return {
		bucket,
		rating: bucket.get(player) ?? 1500
	};
}
function pct$3(w, t) {
	return t ? Number((100 * w / t).toFixed(1)) : null;
}
var rounded = (v) => Math.round(v);
var unique$1 = (v) => [...new Set(v.filter(Boolean))].sort();
function laneMatchesBefore(lane, asOfDate) {
	const matches = /* @__PURE__ */ new Map();
	for (const [playerKey, rows] of Object.entries(lane ?? {})) {
		const player = normalizeEvidenceIdentity(playerKey);
		if (!player || !Array.isArray(rows)) continue;
		for (const entry of rows) {
			const [dateRaw, tournamentRaw, surfaceRaw, opponentRaw, wonRaw, roundRaw, sourceRaw] = entry;
			const date = String(dateRaw ?? "").slice(0, 10);
			if (!dateOk(date) || date >= asOfDate) continue;
			const opponent = normalizeEvidenceIdentity(String(opponentRaw ?? ""));
			if (!opponent || opponent === player || wonRaw !== 0 && wonRaw !== 1) continue;
			const tournament = String(tournamentRaw ?? "").trim(), surface = surfaceKey$1(surfaceRaw), round = String(roundRaw ?? "").trim(), source = String(sourceRaw ?? "").trim() || "Repository four-tour history";
			const pair = [player, opponent].sort();
			const key = [
				date,
				normalizeEvidenceIdentity(tournament),
				surface,
				normalizeEvidenceIdentity(round),
				pair[0],
				pair[1]
			].join("|");
			const winner = wonRaw === 1 ? player : opponent;
			const candidate = {
				key,
				date,
				tournament,
				surface,
				round,
				p1: pair[0],
				p2: pair[1],
				winner,
				source
			};
			const existing = matches.get(key);
			if (existing === null) continue;
			if (existing && existing.winner !== winner) {
				matches.set(key, null);
				continue;
			}
			if (!existing) matches.set(key, candidate);
		}
	}
	return [...matches.values()].filter((m) => Boolean(m)).sort((a, b) => a.date.localeCompare(b.date) || roundOrder(a.round) - roundOrder(b.round) || a.key.localeCompare(b.key));
}
function replayElo(lane, asOfDate) {
	const overall = /* @__PURE__ */ new Map(), surface = /* @__PURE__ */ new Map(), perspectives = [], sources = [];
	for (const match of laneMatchesBefore(lane, asOfDate)) {
		const a = overall.get(match.p1) ?? 1500, b = overall.get(match.p2) ?? 1500, aWon = match.winner === match.p1, surfaceName = match.surface || "unknown", sa = getSurfaceRating(surface, surfaceName, match.p1), sb = getSurfaceRating(surface, surfaceName, match.p2), [nextA, nextB] = update(a, b, aWon), [nextSa, nextSb] = update(sa.rating, sb.rating, aWon);
		overall.set(match.p1, nextA);
		overall.set(match.p2, nextB);
		sa.bucket.set(match.p1, nextSa);
		sb.bucket.set(match.p2, nextSb);
		perspectives.push({
			date: match.date,
			tournament: match.tournament,
			surface: match.surface,
			round: match.round,
			player: match.p1,
			opponent: match.p2,
			won: aWon,
			pre_elo: a,
			opponent_pre_elo: b,
			pre_surface_elo: sa.rating,
			opponent_pre_surface_elo: sb.rating
		}, {
			date: match.date,
			tournament: match.tournament,
			surface: match.surface,
			round: match.round,
			player: match.p2,
			opponent: match.p1,
			won: !aWon,
			pre_elo: b,
			opponent_pre_elo: a,
			pre_surface_elo: sb.rating,
			opponent_pre_surface_elo: sa.rating
		});
		sources.push(match.source);
	}
	return {
		overall,
		surface,
		perspectives,
		source_names: unique$1(sources)
	};
}
function playerRows$1(replay, player) {
	const key = normalizeEvidenceIdentity(player);
	return replay.perspectives.filter((r) => r.player === key).sort((a, b) => b.date.localeCompare(a.date));
}
function recent$1(rows, asOf, days) {
	return rows.filter((r) => {
		const d = daysBefore(r.date, asOf);
		return d > 0 && d <= days;
	});
}
function surfaceStrengthValue(replay, rows, asOf, player, currentSurface) {
	const key = normalizeEvidenceIdentity(player), surfaceRows = recent$1(rows.filter((r) => r.surface === currentSurface), asOf, 365);
	if (!surfaceRows.length) return null;
	const wins = surfaceRows.filter((r) => r.won).length, rating = replay.surface.get(currentSurface)?.get(key);
	if (!Number.isFinite(rating)) return null;
	return `surface=${currentSurface}; surface_elo=${rounded(rating)}; matches_52w=${surfaceRows.length}; wins_52w=${wins}; win_pct_52w=${pct$3(wins, surfaceRows.length)}`;
}
function eloValue(replay, player, currentSurface) {
	const key = normalizeEvidenceIdentity(player), overall = replay.overall.get(key);
	if (!Number.isFinite(overall)) return null;
	const surface = currentSurface ? replay.surface.get(currentSurface)?.get(key) : null;
	return `overall_elo=${rounded(overall)}; surface=${currentSurface ?? "NA"}; surface_elo=${Number.isFinite(surface) ? rounded(surface) : "NA"}; k=${K}; initial=1500`;
}
function computeHistoryMetric(args) {
	const replay = replayElo(args.lane, args.asOfDate), p1Rows = playerRows$1(replay, args.p1), p2Rows = playerRows$1(replay, args.p2);
	if (!p1Rows.length || !p2Rows.length) return null;
	const currentSurface = surfaceKey$1(args.surface) || null;
	let p1 = null, p2 = null, differential = null;
	const treatment = "RECONSTRUCTED", reliability = 86, unavailableReason = null;
	let window = "strict pre-match chronology", calculation = "deterministic K=32 Elo replay";
	const elo1 = eloValue(replay, args.p1, currentSurface), elo2 = eloValue(replay, args.p2, currentSurface);
	if (!elo1 || !elo2) return null;
	const a = replay.overall.get(normalizeEvidenceIdentity(args.p1)), b = replay.overall.get(normalizeEvidenceIdentity(args.p2));
	differential = Number.isFinite(a) && Number.isFinite(b) ? `overall_elo_delta_p1_minus_p2=${rounded(a - b)}; elo_win_probability_p1=${(100 * expected(a, b)).toFixed(1)}%` : null;
	const strength1 = currentSurface ? surfaceStrengthValue(replay, p1Rows, args.asOfDate, args.p1, currentSurface) : null, strength2 = currentSurface ? surfaceStrengthValue(replay, p2Rows, args.asOfDate, args.p2, currentSurface) : null;
	p1 = strength1 ? `${elo1}; ${strength1}` : elo1;
	p2 = strength2 ? `${elo2}; ${strength2}` : elo2;
	window = currentSurface ? "pre-match Elo chronology + trailing 52 weeks surface record" : "pre-match Elo chronology";
	calculation = "deterministic K=32 Elo replay + Elo differential" + (strength1 && strength2 ? " + surface Elo/W-L" : "");
	if (!p1 || !p2) return null;
	const sample = [
		`source_observations=${replay.perspectives.length / 2}`,
		`date_window=${window}`,
		`players=${args.p1} vs ${args.p2}`,
		`calculation=${calculation}`,
		"output=pair-complete",
		`metric=${args.code}`,
		`tour=${args.family}`,
		`match_date=${args.asOfDate}`,
		"future_leakage=blocked(date<match_date)"
	].join("; ");
	return {
		p1_value: p1,
		p2_value: p2,
		differential,
		treatment,
		reliability,
		unavailable_reason: unavailableReason,
		sample,
		source_names: replay.source_names
	};
}
var OWNED$1 = /* @__PURE__ */ new Set(["001", "014"]);
var HISTORY_CODES = /* @__PURE__ */ new Set(["001"]);
function codeOf$5(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function days(a, b) {
	return Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
}
function payload(row) {
	try {
		return JSON.parse(row.text_value ?? "{}");
	} catch {
		return {};
	}
}
function rank(row) {
	const p = payload(row);
	const n = Number(p.rank ?? row.numeric_value);
	return Number.isFinite(n) && n > 0 ? n : null;
}
function points(row) {
	const p = payload(row);
	const n = Number(p.points);
	return Number.isFinite(n) && n >= 0 ? n : null;
}
function agreedPoints(rowsForSlot) {
	const values = [...new Set(rowsForSlot.map(points).filter((v) => v !== null))];
	return values.length === 1 ? values[0] : null;
}
function sourceRefs(rows) {
	const out = [], seen = /* @__PURE__ */ new Set();
	for (const row of rows) {
		if (!row.source_name) continue;
		const key = `${row.source_name}|${row.source_url ?? ""}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({
			source_name: row.source_name,
			url: row.source_url,
			retrieved_at: null
		});
	}
	return out;
}
function nearest(rows, asOf, targetDays) {
	return rows.filter((row) => row.event_date && days(row.event_date, asOf) >= targetDays).sort((a, b) => Math.abs(days(a.event_date, asOf) - targetDays) - Math.abs(days(b.event_date, asOf) - targetDays))[0] ?? null;
}
function rankingSummary(player, opponent, rows, asOf) {
	const playerRows = rows.filter((row) => evidenceNameMatches(row.player_name, player, opponent) && row.event_date && row.event_date <= asOf).sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)));
	const current = playerRows[0] ?? null;
	if (!current) return null;
	const currentRank = rank(current);
	if (currentRank === null) return null;
	const r30 = nearest(playerRows, asOf, 30), r90 = nearest(playerRows, asOf, 90);
	const movement = (row) => {
		const value = row ? rank(row) : null;
		return value === null ? null : value - currentRank;
	};
	const ranks52 = playerRows.filter((row) => row.event_date && days(row.event_date, asOf) >= 0 && days(row.event_date, asOf) <= 365).map(rank).filter((x) => x !== null);
	return {
		rank: currentRank,
		points: agreedPoints(playerRows.filter((row) => row.event_date === current.event_date && rank(row) === currentRank)),
		observation_date: current.event_date,
		rank_change_30d: movement(r30),
		rank_change_90d: movement(r90),
		best_rank_52w: ranks52.length ? Math.min(...ranks52) : currentRank,
		snapshots_52w: ranks52.length
	};
}
function rankingValue(summary) {
	if (!summary) return null;
	return `rank=${summary.rank}; points=${summary.points ?? "NA"}; observation_date=${summary.observation_date}; rank_change_30d=${summary.rank_change_30d ?? "NA"}; rank_change_90d=${summary.rank_change_90d ?? "NA"}; best_rank_52w=${summary.best_rank_52w}; snapshots_52w=${summary.snapshots_52w}`;
}
function rowCircuit(row) {
	const family = classifyEvidenceTourFamily(row.source_id, row.source_name, row.sample_label, row.observation_type, row.observation_key, row.text_value);
	if (family === "ATP_MAIN" || family === "ATP_CHALLENGER") return "ATP";
	if (family === "WTA_MAIN" || family === "WTA_CHALLENGER") return "WTA";
	return null;
}
function familyFromContext(context) {
	return classifyEvidenceTourFamily(context);
}
function expectedCircuit(context, rows) {
	const family = familyFromContext(context);
	if (family === "ATP_MAIN" || family === "ATP_CHALLENGER") return "ATP";
	if (family === "WTA_MAIN" || family === "WTA_CHALLENGER") return "WTA";
	const circuits = new Set(rows.map(rowCircuit).filter((value) => Boolean(value)));
	return circuits.size === 1 ? [...circuits][0] : null;
}
function surfaceFromContext$2(context) {
	return String(context ?? "").match(/\bsurface\s*:?[ ]*(hard|clay|grass|carpet)\b/i)?.[1]?.toLowerCase() ?? null;
}
async function rankingRows(p1, p2, start, asOfDate) {
	const aliases = [.../* @__PURE__ */ new Set([...safeEvidenceAliases(p1, p2), ...safeEvidenceAliases(p2, p1)])];
	const results = await Promise.all(aliases.map((alias) => tryQuery(() => db.select().from(sourceObservationsTable).where(and(gte(sourceObservationsTable.event_date, start), lte(sourceObservationsTable.event_date, asOfDate), ilike(sourceObservationsTable.player_name, `%${alias}%`))).orderBy(desc(sourceObservationsTable.event_date)).limit(2e3))));
	if (results.some((result) => result.error)) return null;
	const dedup = /* @__PURE__ */ new Map();
	for (const result of results) for (const row of result.data ?? []) {
		const key = String(row.id ?? `${row.source_id}|${row.player_name}|${row.event_date}|${row.observation_key}|${row.numeric_value}|${row.text_value}`);
		dedup.set(key, row);
	}
	return [...dedup.values()];
}
async function directRankingFinding(args) {
	const start = /* @__PURE__ */ new Date(`${args.asOfDate}T00:00:00Z`);
	start.setUTCFullYear(start.getUTCFullYear() - 2);
	const fetched = await rankingRows(args.p1, args.p2, start.toISOString().slice(0, 10), args.asOfDate);
	if (!fetched) return null;
	const circuit = expectedCircuit(args.context, fetched);
	if (!circuit) return null;
	const rows = fetched.filter((row) => metricAllowsObservation("014", row) && rowCircuit(row) === circuit && row.event_date && row.event_date <= args.asOfDate);
	if (!rows.length) return null;
	const p1Summary = rankingSummary(args.p1, args.p2, rows, args.asOfDate), p2Summary = rankingSummary(args.p2, args.p1, rows, args.asOfDate);
	const p1 = rankingValue(p1Summary), p2 = rankingValue(p2Summary);
	if (!p1 || !p2) return null;
	return {
		metric_code: "014",
		p1_value: p1,
		p2_value: p2,
		p1_treatment: "DIRECT",
		p2_treatment: "DIRECT",
		differential: p1Summary && p2Summary ? `ranking_gap_p1_minus_p2=${p1Summary.rank - p2Summary.rank}` : null,
		evidence_family: "RANKING",
		reliability: 95,
		sample: `source_observations=official ${circuit} ranking snapshots; date_window=observation_date<=${args.asOfDate}; players=${args.p1} vs ${args.p2}; calculation=latest valid ranking plus historical trend; output=pair-complete; metric=014; circuit=${circuit}; match_date=${args.asOfDate}; future_leakage=blocked`,
		unavailable_reason: null,
		sources: sourceRefs(rows)
	};
}
function historyFinding(args) {
	const family = familyFromContext(args.context);
	if (!family) return null;
	const lane = loadRuntimeIndex()?.matchHistory?.[family];
	if (!lane || typeof lane !== "object") return null;
	const result = computeHistoryMetric({
		code: args.code,
		p1: args.p1,
		p2: args.p2,
		asOfDate: args.asOfDate,
		family,
		surface: surfaceFromContext$2(args.context),
		lane
	});
	if (!result) return null;
	return {
		metric_code: args.code,
		p1_value: result.p1_value,
		p2_value: result.p2_value,
		p1_treatment: result.treatment,
		p2_treatment: result.treatment,
		differential: result.differential,
		evidence_family: "RANKING_FORM",
		reliability: result.reliability,
		sample: result.sample,
		unavailable_reason: result.unavailable_reason,
		sources: result.source_names.map((source_name) => ({
			source_name,
			url: null,
			retrieved_at: null
		}))
	};
}
async function deterministicRankingMetric(args) {
	const code = codeOf$5(args.metricCode);
	if (!OWNED$1.has(code)) return null;
	if (code === "014") return directRankingFinding(args);
	if (!HISTORY_CODES.has(code)) return null;
	return historyFinding({
		...args,
		code
	});
}
function norm$18(value) {
	return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
/**
* Tournament identity across sources. The index and the audited match disagree on
* decoration ("US Open Men Singles" vs "US Open", "ATP Challenger Como" vs "Como"), so
* tour/gender/level words are stripped before comparing. What remains is the event's actual
* name, which is what "same tournament" means.
*/
function tournamentKey$1(value) {
	return norm$18(String(value ?? "")).replace(/\b(atp|wta|challenger|chall|men|women|singles|tour|itf|125k|125|250|500|1000)\b/g, "").replace(/\s+/g, " ").trim();
}
/** Surname-plus-initial index keys ("rublev a") against a full name ("Andrey Rublev"). */
function keyMatchesPlayer(indexKey, player) {
	const key = norm$18(indexKey), name = norm$18(player);
	if (key === name) return true;
	const keyTokens = key.split(" ").filter(Boolean), nameTokens = name.split(" ").filter(Boolean);
	if (keyTokens.length < 2 || nameTokens.length < 2) return false;
	const initial = keyTokens[keyTokens.length - 1];
	if (initial.length !== 1) return false;
	return keyTokens.slice(0, -1).join(" ") === nameTokens.slice(1).join(" ") && initial === nameTokens[0][0];
}
/**
* The player's record at one tournament, strictly BEFORE the audited date.
*
* `asOfDate` is exclusive on purpose: a match played on the audited day may BE the audited
* match, and cannot be prior evidence for itself (see temporal-boundary.ts).
*/
function sameTournamentHistory(player, tournament, asOfDate, withinYears = 5) {
	const wanted = tournamentKey$1(tournament);
	const empty = {
		matches: 0,
		wins: 0,
		win_pct: null
	};
	if (!wanted || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) return empty;
	const earliest = `${Number(asOfDate.slice(0, 4)) - withinYears}${asOfDate.slice(4)}`;
	const history = loadRuntimeIndex().matchHistory;
	const seen = /* @__PURE__ */ new Set();
	let matches = 0, wins = 0;
	for (const lane of Object.keys(history ?? {})) for (const [indexKey, entries] of Object.entries(history[lane] ?? {})) {
		if (!Array.isArray(entries) || !keyMatchesPlayer(indexKey, player)) continue;
		for (const entry of entries) {
			if (!Array.isArray(entry)) continue;
			const [dateRaw, tournamentRaw, , opponentRaw, wonRaw] = entry;
			const date = String(dateRaw ?? "").slice(0, 10);
			if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= asOfDate || date < earliest) continue;
			if (wonRaw !== 0 && wonRaw !== 1) continue;
			if (tournamentKey$1(String(tournamentRaw ?? "")) !== wanted) continue;
			const id = `${date}|${norm$18(String(opponentRaw ?? ""))}`;
			if (seen.has(id)) continue;
			seen.add(id);
			matches += 1;
			if (wonRaw === 1) wins += 1;
		}
	}
	return {
		matches,
		wins,
		win_pct: matches > 0 ? Number((100 * wins / matches).toFixed(2)) : null
	};
}
var FAMILIES = [
	"ATP_MAIN",
	"WTA_MAIN",
	"ATP_CHALLENGER",
	"WTA_CHALLENGER"
];
function sourceId(family) {
	switch (family) {
		case "ATP_MAIN": return "atp";
		case "WTA_MAIN": return "wta";
		case "ATP_CHALLENGER": return "atp_challenger";
		case "WTA_CHALLENGER": return "wta_challenger";
	}
}
function surnameInitialKeyCandidates(value) {
	const parts = normalizeEvidenceIdentity(value).split(" ").filter(Boolean);
	if (parts.length < 2) return [];
	const firstInitial = parts[0][0];
	return [.../* @__PURE__ */ new Set([`${parts.slice(1).join(" ")} ${firstInitial}`, `${parts[parts.length - 1]} ${firstInitial}`])];
}
var SURNAME_INITIAL_FALLBACK_FAMILIES = /* @__PURE__ */ new Set(["WTA_MAIN", "WTA_CHALLENGER"]);
function historyRows(player, family) {
	const key = normalizeEvidenceIdentity(player);
	if (!key) return [];
	const lane = loadRuntimeIndex()?.matchHistory?.[family];
	const direct = lane?.[key];
	if (Array.isArray(direct)) return direct;
	if (SURNAME_INITIAL_FALLBACK_FAMILIES.has(family)) for (const candidate of surnameInitialKeyCandidates(player)) {
		const fallback = lane?.[candidate];
		if (Array.isArray(fallback)) return fallback;
	}
	return [];
}
function repositoryHistoryAvailable(player, family) {
	return historyRows(player, family).length > 0;
}
function inferRepositoryMatchContext(args) {
	const expectedTournament = normalizeEvidenceTournament(args.tournament);
	const found = /* @__PURE__ */ new Map();
	for (const family of FAMILIES) for (const entry of historyRows(args.p1, family)) {
		const [dateRaw, tournamentRaw, surfaceRaw, opponentRaw, , roundRaw] = entry;
		const date = String(dateRaw ?? "").slice(0, 10);
		const opponent = String(opponentRaw ?? "").trim();
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date !== args.asOfDate || !evidencePairMatches(args.p1, opponent, args.p1, args.p2)) continue;
		const tournament = String(tournamentRaw ?? "").trim() || null;
		const normalizedTournament = normalizeEvidenceTournament(tournament);
		if (expectedTournament && normalizedTournament && expectedTournament !== normalizedTournament) continue;
		const round = String(roundRaw ?? "").trim() || null;
		const surface = String(surfaceRaw ?? "").trim() || null;
		found.set(`${family}|${normalizedTournament}|${date}|${round ?? ""}`, {
			family,
			date,
			tournament,
			surface,
			round
		});
	}
	if (found.size !== 1) return null;
	const row = [...found.values()][0];
	const level = row.family.replaceAll("_", " ");
	return [
		`Tournament: ${row.tournament ?? args.tournament ?? "unknown"}`,
		`Level: ${level}`,
		`Tour: ${level}`,
		row.surface ? `Surface: ${row.surface}` : null,
		`Date: ${row.date}`,
		row.round ? `Round: ${row.round}` : null
	].filter(Boolean).join(" | ");
}
function repositoryResultsRows(player, family, asOfDate, options = {}) {
	const rows = historyRows(player, family);
	if (!rows.length) return [];
	const out = [];
	for (const entry of rows) {
		const [dateRaw, tournamentRaw, surfaceRaw, opponentRaw, wonRaw, roundRaw, sourceRaw, detailRaw] = entry;
		const date = String(dateRaw ?? "").slice(0, 10);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (options.strictBefore ? date >= asOfDate : date > asOfDate)) continue;
		const opponent = String(opponentRaw ?? "").trim();
		if (!opponent) continue;
		const won = wonRaw === 1 ? true : wonRaw === 0 ? false : null;
		const winner = won === true ? player : won === false ? opponent : null;
		const tournament = String(tournamentRaw ?? "").trim() || null;
		const surface = String(surfaceRaw ?? "").trim() || null;
		const round = String(roundRaw ?? "").trim() || null;
		const source = String(sourceRaw ?? "").trim() || `Repository ${family} history`;
		const history_detail = detailRaw && typeof detailRaw === "object" ? detailRaw : {};
		const payload = {
			winner,
			round,
			tour_family: family,
			repository_history: true,
			history_detail
		};
		out.push({
			source_id: sourceId(family),
			source_name: source,
			source_url: null,
			player_name: player,
			opponent_name: opponent,
			tournament,
			event_date: date,
			surface,
			observation_type: "MATCH_RESULT_OR_SCHEDULE",
			observation_key: "match_record",
			text_value: JSON.stringify(payload),
			sample_label: round,
			raw_payload: payload,
			provenance: {
				repository_history: true,
				tour_family: family,
				strict_before_target: Boolean(options.strictBefore),
				raw_score_preserved: history_detail.raw_score != null
			}
		});
	}
	return out;
}
var TASK18A_HISTORICAL_RESULTS_CODES = [
	"005",
	"006",
	"007",
	"008",
	"010",
	"011",
	"013",
	"017",
	"068",
	"080"
];
var pct$2 = (n, d) => d > 0 ? Number((100 * n / d).toFixed(2)) : null;
var avg = (xs) => xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3)) : null;
var variance$1 = (xs) => {
	if (xs.length < 2) return 0;
	const m = xs.reduce((a, b) => a + b, 0) / xs.length;
	return Number((xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length).toFixed(4));
};
var surfaceKey = (v) => String(v ?? "").trim().toLowerCase();
var isCompleted = (r) => r.won !== null && !/(walkover|w\/o|wo\b|cancel)/i.test(r.status ?? "");
var scored = (r) => r.setsFor !== null && r.setsAgainst !== null;
var setRows = (r) => r.setScores.length ? r.setScores : scored(r) ? [] : [];
var totalSets = (r) => r.setsFor !== null && r.setsAgainst !== null ? r.setsFor + r.setsAgainst : r.setScores.length ? r.setScores.length : null;
var dayDiff$1 = (a, b) => Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
var quality = (r) => r.opponentRank !== null ? `rank:${r.opponentRank}` : r.opponentElo !== null ? `elo:${r.opponentElo}` : null;
var qualityBand = (r) => r.opponentRank !== null ? r.opponentRank <= 10 ? "rank_1_10" : r.opponentRank <= 50 ? "rank_11_50" : r.opponentRank <= 100 ? "rank_51_100" : "rank_101_plus" : r.opponentElo !== null ? r.opponentElo >= 2e3 ? "elo_2000_plus" : r.opponentElo >= 1800 ? "elo_1800_1999" : "elo_below_1800" : null;
var blowoutSet = ([a, b]) => Math.abs(a - b) >= 4;
var bagelSet = ([a, b]) => a === 0 || b === 0;
var tiebreakSet = ([a, b]) => a === 7 && b === 6 || a === 6 && b === 7;
function completed(rows) {
	return rows.filter(isCompleted);
}
function withSurface(rows, surface) {
	const s = surfaceKey(surface);
	return s ? rows.filter((r) => surfaceKey(r.surface) === s) : rows;
}
function baseRecord(rows) {
	const c = completed(rows);
	const wins = c.filter((r) => r.won === true).length;
	return {
		matches: c.length,
		wins,
		losses: c.length - wins,
		winPct: pct$2(wins, c.length)
	};
}
function scoreSummary(rows) {
	const c = completed(rows).filter(scored);
	const wins = c.filter((r) => r.won === true);
	const straightWins = wins.filter((r) => r.setsAgainst === 0).length;
	const setsLost = c.map((r) => r.setsAgainst).filter(Number.isFinite);
	const setScores = c.flatMap(setRows);
	const tb = setScores.filter(tiebreakSet);
	const bagels = setScores.filter(bagelSet);
	const blowouts = setScores.filter(blowoutSet);
	return {
		matches: c.length,
		wins: wins.length,
		straightWins,
		straightWinPct: pct$2(straightWins, wins.length),
		setsLostPerMatch: avg(setsLost),
		sets: setScores.length,
		tiebreakSets: tb.length,
		bagelSets: bagels.length,
		blowoutSets: blowouts.length,
		gamesPerSet: avg(setScores.map(([a, b]) => a + b))
	};
}
function rankedRecord(rows) {
	const usable = completed(rows).filter((r) => qualityBand(r) !== null);
	const bands = {};
	for (const r of usable) {
		const b = qualityBand(r);
		bands[b] ??= {
			w: 0,
			n: 0
		};
		bands[b].n++;
		if (r.won) bands[b].w++;
	}
	return {
		matches: usable.length,
		bands: Object.fromEntries(Object.entries(bands).map(([k, v]) => [k, {
			matches: v.n,
			wins: v.w,
			winPct: pct$2(v.w, v.n)
		}]))
	};
}
function recent(rows, asOfDate, days) {
	return rows.filter((r) => {
		const d = dayDiff$1(r.date, asOfDate);
		return d > 0 && d <= days;
	});
}
function decidingRows(rows) {
	return completed(rows).filter((r) => {
		const t = totalSets(r);
		if (t === null) return false;
		if (r.bestOf === 3) return t === 3;
		if (r.bestOf === 5) return t === 5;
		return false;
	});
}
function statusRows(rows) {
	return rows.filter((r) => r.status !== null && r.status.trim() !== "");
}
var tournamentKey = (v) => String(v ?? "").trim().toLowerCase();
function longestWinStreak(rowsAsc) {
	let run = 0, longest = 0;
	for (const r of rowsAsc) if (r.won) {
		run++;
		longest = Math.max(longest, run);
	} else run = 0;
	return longest;
}
function currentStreak(rowsDesc) {
	if (!rowsDesc.length) return null;
	const dir = rowsDesc[0].won;
	let len = 0;
	for (const r of rowsDesc) {
		if (r.won !== dir) break;
		len++;
	}
	return {
		won: dir,
		length: len
	};
}
function deriveHistoricalResultMetric(args) {
	const code = String(args.code).padStart(3, "0");
	if (!TASK18A_HISTORICAL_RESULTS_CODES.includes(code)) return null;
	const history = args.rows.filter((r) => r.player === args.player && r.date < args.asOfDate);
	if (!history.length) return null;
	const complete = completed(history);
	const record = baseRecord(history);
	const scoredRows = complete.filter(scored);
	const score = scoreSummary(history);
	const reconstruction = (value, sampleSize, rawInputs, transformation, treatment = "RECONSTRUCTED") => ({
		value,
		treatment,
		sampleSize,
		rawInputs,
		transformation
	});
	if (code === "005") {
		const desc = [...complete].sort((a, b) => b.date.localeCompare(a.date));
		if (!desc.length) return null;
		const last5 = desc.slice(0, 5), last10 = desc.slice(0, 10);
		const winPct5 = pct$2(last5.filter((r) => r.won).length, last5.length), winPct10 = pct$2(last10.filter((r) => r.won).length, last10.length);
		const scoredWins5 = last5.filter((r) => r.won).filter(scored);
		const straightSetWins5 = scoredWins5.filter((r) => r.setsAgainst === 0).length;
		const straightSetControlPct = pct$2(straightSetWins5, scoredWins5.length);
		const avgSetsConcededInWins = avg(scoredWins5.map((r) => r.setsAgainst).filter(Number.isFinite));
		const avgOpponentRankLast5 = avg(last5.filter((r) => r.opponentRank !== null).map((r) => r.opponentRank));
		const half = Math.min(5, Math.floor(desc.length / 2));
		let trend = null;
		if (half >= 2) {
			const recentHalf = desc.slice(0, half), priorHalf = desc.slice(half, half * 2);
			const recentWinPct = pct$2(recentHalf.filter((r) => r.won).length, recentHalf.length), priorWinPct = pct$2(priorHalf.filter((r) => r.won).length, priorHalf.length);
			if (recentWinPct !== null && priorWinPct !== null) trend = recentWinPct > priorWinPct ? "IMPROVING" : recentWinPct < priorWinPct ? "DECLINING" : "STABLE";
		}
		return reconstruction(`last5_matches=${last5.length}; last5_win_pct=${winPct5 ?? "NA"}; last10_matches=${last10.length}; last10_win_pct=${winPct10 ?? "NA"}${trend ? `; trend_direction=${trend}` : ""}${straightSetControlPct !== null ? `; straight_set_control_pct=${straightSetControlPct}` : ""}${avgSetsConcededInWins !== null ? `; avg_sets_conceded_in_wins=${avgSetsConcededInWins}` : ""}${avgOpponentRankLast5 !== null ? `; avg_opponent_rank_last5=${avgOpponentRankLast5}` : ""}`, last5.length, {
			last5: last5.map((r) => ({
				date: r.date,
				opponent: r.opponent,
				won: r.won,
				surface: r.surface
			})),
			last10_count: last10.length,
			trend_window_size: half
		}, "Sort completed prior results chronologically descending; take the most recent 5 and 10 for win-percentage summaries. Trend direction compares the win rate of the most recent half-window against the immediately preceding half-window of equal size (2-5 matches each, whichever the history supports). Straight-set control rate and average sets conceded are computed only over recent wins with preserved set scores. \"Current Hard-Court Swing\" and \"Recent-Performance Acceleration\" are not covered -- the former requires identifying a contiguous same-surface tournament run this row type cannot reliably distinguish from an isolated hard-court result, and the latter requires a rate-of-change model finer than a two-window trend comparison honestly supports -- so treatment stays PARTIAL.", "PARTIAL");
	}
	if (code === "010") {
		if (!score.matches) return null;
		const ss = scoreSummary(withSurface(scoredRows, args.surface));
		return reconstruction(`scored_wins=${score.wins}; straight_set_wins=${score.straightWins}; straight_set_win_pct=${score.straightWinPct ?? "NA"}; same_surface_straight_set_win_pct=${ss.straightWinPct ?? "NA"}`, score.matches, {
			scored_matches: score.matches,
			surface: args.surface ?? null
		}, "Classify completed wins with zero sets lost; separately repeat on the target surface when present.");
	}
	if (code === "011") {
		if (!score.matches || !score.sets) return null;
		const winSeries = complete.map((r) => r.won ? 1 : 0);
		const setMargins = scoredRows.map((r) => r.setsFor - r.setsAgainst);
		return reconstruction(`match_win_pct=${record.winPct ?? "NA"}; result_variance=${variance$1(winSeries)}; set_margin_variance=${variance$1(setMargins)}; straight_win_pct=${score.straightWinPct ?? "NA"}; blowout_set_pct=${pct$2(score.blowoutSets, score.sets) ?? "NA"}; tiebreak_set_pct=${pct$2(score.tiebreakSets, score.sets) ?? "NA"}`, score.matches, {
			completed_matches: complete.length,
			scored_matches: score.matches,
			set_count: score.sets
		}, "Measure floor/volatility from realized match outcomes and observed game-level set margins, straight-set, blowout and tiebreak distributions. Full reconstruction requires preserved per-set game scores.");
	}
	if (code === "007") {
		const opponentHistory = args.rows.filter((r) => r.player === args.opponent && r.date < args.asOfDate && isCompleted(r));
		const theirs = new Set(opponentHistory.map((r) => r.opponent));
		const common = complete.filter((r) => r.opponent !== args.opponent && theirs.has(r.opponent) && quality(r) !== null);
		if (!common.length) return null;
		const w = common.filter((r) => r.won).length;
		return reconstruction(`ranked_common_opponent_matches=${common.length}; wins=${w}; win_pct=${pct$2(w, common.length) ?? "NA"}; common_opponents=${new Set(common.map((r) => r.opponent)).size}`, common.length, {
			common_opponents: [...new Set(common.map((r) => r.opponent))].slice(0, 50),
			quality_labels: common.slice(0, 50).map((r) => quality(r))
		}, "Intersect canonical opponent identities across both players, require ranking/Elo quality evidence, then aggregate this player's prior results against those shared opponents. Retargeted from the mismatched code 013 to real code 007 (\"Common-Opponent Network\").");
	}
	if (code === "080") {
		const opponentHistory = args.rows.filter((r) => r.player === args.opponent && r.date < args.asOfDate && isCompleted(r));
		if (!opponentHistory.length) return null;
		const theirResultsByOpponent = /* @__PURE__ */ new Map();
		for (const r of opponentHistory) {
			const arr = theirResultsByOpponent.get(r.opponent) ?? [];
			arr.push(r.won === true);
			theirResultsByOpponent.set(r.opponent, arr);
		}
		const sharedOpponents = [...new Set(complete.filter((r) => r.opponent !== args.opponent && theirResultsByOpponent.has(r.opponent)).map((r) => r.opponent))];
		if (!sharedOpponents.length) return null;
		let favorable = 0, unfavorable = 0;
		for (const opp of sharedOpponents) {
			const mine = complete.filter((r) => r.opponent === opp);
			const theirs = theirResultsByOpponent.get(opp);
			const iEverWon = mine.some((r) => r.won === true), iEverLost = mine.some((r) => r.won === false);
			const theyEverWon = theirs.some((w) => w === true), theyEverLost = theirs.some((w) => w === false);
			if (iEverWon && theyEverLost) favorable++;
			if (iEverLost && theyEverWon) unfavorable++;
		}
		return reconstruction(`common_opponents=${sharedOpponents.length}; favorable_divergent_outcomes=${favorable}; unfavorable_divergent_outcomes=${unfavorable}`, sharedOpponents.length, { common_opponents: sharedOpponents.slice(0, 50) }, "Intersect canonical opponent identities across both players (same method as code 007); for each shared opponent, flag a favorable divergence when this player has ever beaten them while the other match player has ever lost to them, and an unfavorable divergence in the reverse case. \"Opponent-Caliber Performance Gap\" is not covered -- it requires each player's own historical rank/Elo at match time to compute a ceiling-vs-floor gap relative to their own level, which this row type does not carry -- so treatment stays PARTIAL.", "PARTIAL");
	}
	if (code === "006") {
		const r = recent(history, args.asOfDate, 90).filter((x) => isCompleted(x) && quality(x) !== null);
		if (!r.length) return null;
		const q = rankedRecord(r);
		const w = r.filter((x) => x.won).length;
		return reconstruction(`window_days=90; quality_observed_matches=${r.length}; wins=${w}; win_pct=${pct$2(w, r.length) ?? "NA"}; bands=${JSON.stringify(q.bands)}`, r.length, {
			window_start_days: 90,
			quality_observations: r.map((x) => ({
				date: x.date,
				opponent: x.opponent,
				quality: quality(x),
				surface: x.surface,
				won: x.won
			})).slice(0, 100)
		}, "Use only prior 90-day realized results with observed opponent rank/Elo; preserve quality bands rather than imputing missing quality. Retargeted from the mismatched code 020 to real code 006 (\"Opponent-Adjusted Strength of Schedule\"): this computation's per-band recent win rate against rank/Elo-quality-classified opponents is an exact match for 006's \"recent opponent strength, comparable-strength results\" bullets, not for real code 020 (\"Level/Tour Transition\": event-level history, opponent Elo gap, previous-tournament trajectory), which this computation says nothing about (no tournament-level/event data is read here at all). This does not conflict with wta-official-match-evidence.server.ts's/hybrid-audit-research.server.ts's own existing '020' handling -- those independently compute a genuine tournament-level-based same-level-matches/win-pct signal, which IS a real match for 020, and are left untouched.");
	}
	if (code === "017") {
		if (!score.sets) return null;
		return reconstruction(`sets=${score.sets}; bagel_sets=${score.bagelSets}; bagel_set_pct=${pct$2(score.bagelSets, score.sets) ?? "NA"}; blowout_sets=${score.blowoutSets}; blowout_set_pct=${pct$2(score.blowoutSets, score.sets) ?? "NA"}`, score.matches, {
			scored_matches: score.matches,
			set_count: score.sets
		}, "Parse player-oriented set scores; count 6-0 sets and sets with a game margin of at least four. Retargeted/merged from the mismatched codes 023/054/055 to real code 017 (\"Shot & Rally Metrics\"), satisfying only its \"Set-Level Dominance\" bullet; the other 017 bullets (forehand/backhand, net play, hold vulnerability, etc.) require shot-level data this file does not have, so treatment stays PARTIAL.", "PARTIAL");
	}
	if (code === "008") {
		const d = decidingRows(history);
		if (!d.length) return null;
		const w = d.filter((r) => r.won).length;
		return reconstruction(`deciding_matches=${d.length}; deciding_wins=${w}; deciding_set_win_pct=${pct$2(w, d.length) ?? "NA"}`, d.length, {
			best_of_observed: d.map((r) => r.bestOf),
			set_totals: d.map(totalSets)
		}, "Use only matches whose observed best-of format and set total prove that a deciding set was played.");
	}
	if (code === "013") {
		const sr = statusRows(history);
		if (!sr.length) return null;
		const rw = sr.filter((r) => /(retir|walkover|w\/o|wo\b)/i.test(r.status ?? "")).length;
		return reconstruction(`status_observed_matches=${sr.length}; retirement_or_walkover=${rw}; observed_status_rate_pct=${pct$2(rw, sr.length) ?? "NA"}`, sr.length, { status_values: sr.map((r) => r.status).slice(0, 100) }, "Use only rows with an explicitly preserved status field; because status preservation is incomplete, keep treatment PARTIAL. Retargeted from the mismatched code 057 to real code 013 (\"Availability\"), whose \"Retirements\" bullet is an exact match.", "PARTIAL");
	}
	if (code === "068") {
		if (!complete.length) return null;
		const desc = [...complete].sort((a, b) => b.date.localeCompare(a.date));
		const asc = [...complete].sort((a, b) => a.date.localeCompare(b.date));
		const cur = currentStreak(desc);
		if (!cur) return null;
		const season = args.asOfDate.slice(0, 4), seasonRows = asc.filter((r) => r.date.slice(0, 4) === season);
		const longest = longestWinStreak(seasonRows);
		const tKey = tournamentKey(args.tournament);
		const debut = tKey ? !history.some((r) => tournamentKey(r.tournament) === tKey) : null;
		return reconstruction(`current_streak=${cur.won ? "W" : "L"}${cur.length}; longest_win_streak_${season}=${longest}; season_matches=${seasonRows.length}${debut === null ? "" : `; tournament_debut=${debut}`}`, complete.length, {
			completed_matches: complete.length,
			season,
			season_matches: seasonRows.length,
			tournament: args.tournament ?? null
		}, "Sort completed prior results chronologically; the current streak is the unbroken run of identical results ending at the most recent prior match, and the longest win streak scans consecutive wins within the calendar year of the target date. Tournament debut status compares the current match's tournament name against every prior tournament played (only reported when a tournament name is supplied). Protected-ranking status is not covered -- this row type carries no ranking-protection flag -- so treatment stays PARTIAL.", "PARTIAL");
	}
	return null;
}
var PIPELINE_EXCLUDED = /* @__PURE__ */ new Set(["006"]);
var OWNED = new Set(TASK18A_HISTORICAL_RESULTS_CODES.filter((code) => !PIPELINE_EXCLUDED.has(code)));
function codeOf$4(v) {
	const m = String(v ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(v ?? "").padStart(3, "0");
}
function contextSurface$1(context) {
	const m = String(context ?? "").match(/(?:^|[|·;])\s*surface\s*[:=]?\s*(hard|clay|grass|carpet)\b/i);
	return m ? m[1] : null;
}
function canonicalKey(value) {
	return normalizeEvidenceIdentity(String(value ?? ""));
}
function parsePayload(row) {
	const p = row.raw_payload ?? {};
	const d = p.history_detail && typeof p.history_detail === "object" ? p.history_detail : {};
	const n = (v) => {
		const x = Number(v);
		return Number.isFinite(x) && v !== null && v !== "" ? x : null;
	};
	const pairs = Array.isArray(d.set_scores) ? d.set_scores.flatMap((v) => Array.isArray(v) && v.length >= 2 && Number.isFinite(Number(v[0])) && Number.isFinite(Number(v[1])) ? [[Number(v[0]), Number(v[1])]] : []) : [];
	return {
		winner: canonicalKey(String(p.winner ?? "")) || null,
		detail: {
			setsFor: n(d.sets_for),
			setsAgainst: n(d.sets_against),
			setScores: pairs,
			bestOf: n(d.best_of),
			opponentRank: n(d.opponent_rank),
			opponentElo: n(d.opponent_elo),
			status: d.status == null ? null : String(d.status)
		}
	};
}
function historicalRows(rows) {
	return rows.flatMap((row) => {
		if (!row.event_date || !row.player_name || !row.opponent_name) return [];
		const player = canonicalKey(row.player_name), opponent = canonicalKey(row.opponent_name);
		if (!player || !opponent) return [];
		const parsed = parsePayload(row);
		const won = parsed.winner === player ? true : parsed.winner === opponent ? false : null;
		return [{
			date: row.event_date,
			player,
			opponent,
			won,
			surface: row.surface,
			tournament: row.tournament,
			...parsed.detail
		}];
	});
}
function refs$1(rows) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const row of rows) {
		const k = row.source_name;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push({
			source_name: k,
			url: null,
			retrieved_at: null
		});
	}
	return out;
}
async function deterministicHistoricalResultsMetric(args) {
	const code = codeOf$4(args.metricCode);
	if (!OWNED.has(code)) return null;
	const family = args.tourFamily ?? classifyEvidenceTourFamily(args.context, args.tournament);
	if (!family) return null;
	if (!repositoryHistoryAvailable(args.p1, family) && !repositoryHistoryAvailable(args.p2, family)) return null;
	const p1Rows = repositoryResultsRows(args.p1, family, args.asOfDate, { strictBefore: true });
	const p2Rows = repositoryResultsRows(args.p2, family, args.asOfDate, { strictBefore: true });
	if (!p1Rows.length && !p2Rows.length) return null;
	const allObs = [...p1Rows, ...p2Rows];
	const rows = historicalRows(allObs);
	const surface = args.surface ?? contextSurface$1(args.context);
	const p1 = canonicalKey(args.p1), p2 = canonicalKey(args.p2);
	if (!p1 || !p2 || p1 === p2) return null;
	const a = deriveHistoricalResultMetric({
		code,
		player: p1,
		opponent: p2,
		rows,
		asOfDate: args.asOfDate,
		surface,
		tournament: args.tournament
	});
	const b = deriveHistoricalResultMetric({
		code,
		player: p2,
		opponent: p1,
		rows,
		asOfDate: args.asOfDate,
		surface,
		tournament: args.tournament
	});
	const aOk = !!a && a.sampleSize > 0, bOk = !!b && b.sampleSize > 0;
	if (!aOk && !bOk) return null;
	const treatment = (aOk ? a : b).treatment;
	const provenance = {
		metric: code,
		tour_family: family,
		target_match: buildCanonicalEvidenceMatchIdentity({
			player1Name: args.p1,
			player2Name: args.p2,
			tournament: args.tournament,
			date: args.asOfDate,
			tour: family
		}).key,
		surface,
		cutoff: `strictly before ${args.asOfDate}`,
		p1: aOk ? {
			raw_inputs: a.rawInputs,
			transformation: a.transformation,
			output: a.value,
			sample_size: a.sampleSize
		} : { unavailable: true },
		p2: bOk ? {
			raw_inputs: b.rawInputs,
			transformation: b.transformation,
			output: b.value,
			sample_size: b.sampleSize
		} : { unavailable: true }
	};
	const partialReason = treatment === "PARTIAL" ? "Retirement/walkover status is only credited for rows with explicitly preserved status; missing status is never treated as a normal completion." : null;
	return {
		metric_code: code,
		p1_value: aOk ? a.value : null,
		p2_value: bOk ? b.value : null,
		p1_treatment: aOk ? a.treatment : "UNAVAILABLE",
		p2_treatment: bOk ? b.treatment : "UNAVAILABLE",
		differential: null,
		evidence_family: "RESULTS_HISTORY",
		reliability: aOk || bOk ? treatment === "PARTIAL" ? 72 : 92 : null,
		sample: JSON.stringify(provenance),
		unavailable_reason: !aOk || !bOk ? partialReason ?? "This player has no qualifying historical events for this metric's own definition (e.g. zero deciding-set matches, zero common opponents) in the available repository history." : partialReason,
		p1_unavailable_reason: aOk ? null : "This player has no qualifying historical events for this metric's own definition in the available repository history.",
		p2_unavailable_reason: bOk ? null : "This player has no qualifying historical events for this metric's own definition in the available repository history.",
		sources: refs$1(allObs)
	};
}
var SCHEDULE_SUPPORTED = /* @__PURE__ */ new Set([
	"012",
	"028",
	"030",
	"064",
	"071",
	"076",
	"077",
	"081"
]);
var HISTORICAL_SUPPORTED = new Set(TASK18A_HISTORICAL_RESULTS_CODES);
function codeOf$3(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function daysBetween(a, b) {
	return Math.floor(((/* @__PURE__ */ new Date(`${b}T00:00:00Z`)).getTime() - (/* @__PURE__ */ new Date(`${a}T00:00:00Z`)).getTime()) / 864e5);
}
function parseText(row) {
	if (!row.text_value) return {};
	try {
		return JSON.parse(row.text_value);
	} catch {
		return {};
	}
}
function isMatch(row) {
	return row.observation_key === "match_record" && !!row.event_date && !!row.player_name;
}
function sources$2(rows) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const row of rows) {
		if (!row.source_name) continue;
		const key = `${row.source_name}|${row.source_url ?? ""}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({
			source_name: row.source_name,
			url: row.source_url,
			retrieved_at: null
		});
	}
	return out;
}
function stringifyHint(value) {
	if (typeof value === "string") return value;
	if (value == null) return "";
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}
function observationTourFamily(row) {
	return classifyEvidenceTourFamily(row.sample_label, row.tournament, row.source_id, row.source_name, row.observation_type, row.observation_key, row.text_value, stringifyHint(row.raw_payload), stringifyHint(row.provenance));
}
function inferExpectedFamily(args, rows, p1, p2) {
	const explicit = args.tourFamily ?? classifyEvidenceTourFamily(args.tour, args.eventLevel, args.tournament, args.context);
	if (explicit) return explicit;
	const families = /* @__PURE__ */ new Set();
	for (const row of rows) {
		if (!evidenceNameMatches(row.player_name, p1, p2) && !evidenceNameMatches(row.player_name, p2, p1)) continue;
		const family = observationTourFamily(row);
		if (family) families.add(family);
	}
	return families.size === 1 ? [...families][0] : null;
}
function sameTournament(a, b) {
	if (!b) return true;
	const left = normalizeEvidenceTournament(a), right = normalizeEvidenceTournament(b);
	return !!left && !!right && left === right;
}
function directScheduleRows(rows, tournament, expectedFamily) {
	if (!expectedFamily) return [];
	return rows.filter((row) => row.observation_key === "event_schedule" && sameTournament(row.tournament, tournament) && evidenceTourCompatible(expectedFamily, observationTourFamily(row)));
}
function matchHistoryDate(row) {
	return row.scheduled_date ?? row.scheduled_local_at?.slice(0, 10) ?? row.scheduled_utc_at?.slice(0, 10) ?? null;
}
function matchHistoryFamily(row) {
	return classifyEvidenceTourFamily(row.event_level, row.tournament_name, row.canonical_key);
}
function currentEventHistoryRows(rows, args, expectedFamily) {
	if (!expectedFamily) return [];
	const event = normalizeEvidenceTournament(args.tournament), round = normalizeEvidenceRound(args.round);
	return rows.filter((row) => {
		if (!(evidenceNameMatches(row.player1_name, args.p1, args.p2) && evidenceNameMatches(row.player2_name, args.p2, args.p1) || evidenceNameMatches(row.player1_name, args.p2, args.p1) && evidenceNameMatches(row.player2_name, args.p1, args.p2)) || !evidenceTourCompatible(expectedFamily, matchHistoryFamily(row))) return false;
		const rowEvent = normalizeEvidenceTournament(row.tournament_name);
		if (event && rowEvent && event !== rowEvent) return false;
		if (!evidenceDateCompatible(args.asOfDate, matchHistoryDate(row))) return false;
		const rowRound = normalizeEvidenceRound(row.round);
		if (round && rowRound && round !== rowRound) return false;
		return true;
	});
}
function uniqueCurrentEventHistoryRows(rows, args, expectedFamily) {
	const candidates = currentEventHistoryRows(rows, args, expectedFamily);
	return candidates.length === 1 ? candidates : [];
}
function componentsFor(player, opponent, rows, asOfDate, tournament, expectedFamily, historyRows, round) {
	const playerRows = rows.filter((r) => evidenceNameMatches(r.player_name, player, opponent) && isMatch(r) && evidenceTourCompatible(expectedFamily, observationTourFamily(r)));
	const recent = (days) => playerRows.filter((r) => r.event_date && daysBetween(r.event_date, asOfDate) >= 0 && daysBetween(r.event_date, asOfDate) <= days);
	const r14 = recent(14), r30 = recent(30), r52w = recent(364), last = playerRows.map((r) => r.event_date).sort().reverse()[0] ?? null;
	const sameTournamentRows = tournament ? playerRows.filter((r) => sameTournament(r.tournament, tournament) && r.event_date && daysBetween(r.event_date, asOfDate) <= 1825) : [];
	let sameTournamentWins = 0;
	for (const row of sameTournamentRows) {
		const payload = parseText(row);
		if (evidenceNameMatches(String(payload.winner ?? ""), player, opponent)) sameTournamentWins += 1;
	}
	const qualifying = r14.filter((r) => /qual/i.test(String(r.sample_label ?? parseText(r).round ?? "")));
	const direct = directScheduleRows(rows, tournament, expectedFamily), history = uniqueCurrentEventHistoryRows(historyRows, {
		p1: player,
		p2: opponent,
		asOfDate,
		tournament,
		round
	}, expectedFamily);
	const kind = direct.length ? "DIRECT_EVENT_SCHEDULE" : history.length === 1 ? "MATCH_HISTORY_SCHEDULE_CONTEXT" : "UNAVAILABLE";
	return {
		matches_14d: r14.length,
		matches_30d: r30.length,
		matches_52w: r52w.length,
		days_since_last_match: last ? daysBetween(last, asOfDate) : null,
		distinct_tournaments_30d: new Set(r30.map((r) => normalizeEvidenceTournament(r.tournament)).filter(Boolean)).size,
		same_tournament_matches_5y: sameTournamentRows.length,
		same_tournament_wins_5y: sameTournamentWins,
		qualifying_matches_14d: qualifying.length,
		scheduled_current_event_rows: direct.length,
		match_history_schedule_rows: history.length,
		schedule_context_kind: kind
	};
}
function value030(c, player, tournament, asOfDate) {
	const reconstructed = sameTournamentHistory(player, tournament, asOfDate);
	const matches = Math.max(c.same_tournament_matches_5y, reconstructed.matches);
	const wins = reconstructed.matches >= c.same_tournament_matches_5y ? reconstructed.wins : c.same_tournament_wins_5y;
	return `same_tournament_matches_5y=${matches}; same_tournament_wins_5y=${wins}; same_tournament_win_pct=${(matches > 0 ? Number((100 * wins / matches).toFixed(2)) : null) ?? "NA"}; warehouse_matches_5y=${c.same_tournament_matches_5y}; reconstructed_matches_5y=${reconstructed.matches}`;
}
function valueFor(code, c, player, tournament, asOfDate) {
	switch (code) {
		case "012":
		case "077": return `matches_14d=${c.matches_14d}; matches_30d=${c.matches_30d}; matches_52w=${c.matches_52w}; days_since_last_match=${c.days_since_last_match ?? "NA"}`;
		case "028": return `matches_30d=${c.matches_30d}; distinct_tournaments_30d=${c.distinct_tournaments_30d}; days_since_last_match=${c.days_since_last_match ?? "NA"}`;
		case "030": return value030(c, player, tournament, asOfDate);
		case "064": return `qualifying_matches_14d=${c.qualifying_matches_14d}; current_event_schedule_rows=${c.scheduled_current_event_rows}; match_history_schedule_rows=${c.match_history_schedule_rows}; schedule_context=${c.schedule_context_kind}`;
		case "071": return `days_since_last_match=${c.days_since_last_match ?? "NA"}; current_event_schedule_rows=${c.scheduled_current_event_rows}; match_history_schedule_rows=${c.match_history_schedule_rows}; schedule_context=${c.schedule_context_kind}`;
		case "076": return `matches_14d=${c.matches_14d}; qualifying_matches_14d=${c.qualifying_matches_14d}; days_since_last_match=${c.days_since_last_match ?? "NA"}`;
		case "081": return `matches_30d=${c.matches_30d}; distinct_tournaments_30d=${c.distinct_tournaments_30d}; qualifying_matches_14d=${c.qualifying_matches_14d}`;
		default: return null;
	}
}
async function playerObservationRows(p1, p2, start, asOfDate, select) {
	const aliases = [.../* @__PURE__ */ new Set([...safeEvidenceAliases(p1, p2), ...safeEvidenceAliases(p2, p1)])];
	const results = await Promise.all(aliases.map((alias) => tryQuery(() => db.select().from(sourceObservationsTable).where(and(gte(sourceObservationsTable.event_date, start), lte(sourceObservationsTable.event_date, asOfDate), ilike(sourceObservationsTable.player_name, `%${alias}%`))).orderBy(desc(sourceObservationsTable.event_date)).limit(2500))));
	if (results.some((result) => result.error)) return null;
	const dedup = /* @__PURE__ */ new Map();
	for (const result of results) for (const row of result.data ?? []) {
		const key = String(row.id ?? [
			row.source_id,
			row.player_name,
			row.opponent_name,
			row.tournament,
			row.event_date,
			row.observation_key,
			row.text_value
		].join("|"));
		dedup.set(key, row);
	}
	return [...dedup.values()];
}
async function deterministicResultsScheduleMetric(args) {
	const code = codeOf$3(args.metricCode);
	if (HISTORICAL_SUPPORTED.has(code)) return deterministicHistoricalResultsMetric({
		...args,
		metricCode: code
	});
	if (!SCHEDULE_SUPPORTED.has(code)) return null;
	const start = /* @__PURE__ */ new Date(`${args.asOfDate}T00:00:00Z`);
	start.setUTCFullYear(start.getUTCFullYear() - 5);
	const startDate = start.toISOString().slice(0, 10);
	const select = "id,source_id,source_name,source_url,player_name,opponent_name,tournament,event_date,surface,observation_type,observation_key,text_value,sample_label,raw_payload,provenance";
	const aliases = [.../* @__PURE__ */ new Set([...safeEvidenceAliases(args.p1, args.p2), ...safeEvidenceAliases(args.p2, args.p1)])];
	const [playerRowsResult, sharedResult, historyResult] = await Promise.all([
		playerObservationRows(args.p1, args.p2, startDate, args.asOfDate, select),
		tryQuery(() => db.select().from(sourceObservationsTable).where(and(gte(sourceObservationsTable.event_date, startDate), lte(sourceObservationsTable.event_date, args.asOfDate), isNull(sourceObservationsTable.player_name))).orderBy(desc(sourceObservationsTable.event_date)).limit(2e3)),
		tryQuery(() => db.select().from(matchesTable).where(and(inArray(matchesTable.player1_name, aliases), inArray(matchesTable.player2_name, aliases))).orderBy(desc(matchesTable.created_at)).limit(2e3))
	]);
	if (!playerRowsResult || sharedResult.error || historyResult.error) return null;
	let rows = [...playerRowsResult, ...sharedResult.data ?? []].filter((row) => metricAllowsObservation(code, row));
	const repositoryContext = inferRepositoryMatchContext({
		p1: args.p1,
		p2: args.p2,
		asOfDate: args.asOfDate,
		tournament: args.tournament
	});
	const expectedFamily = inferExpectedFamily({
		...args,
		context: args.context ?? repositoryContext
	}, rows, args.p1, args.p2) ?? classifyEvidenceTourFamily(repositoryContext);
	const historyRows = historyResult.data ?? [];
	if (!expectedFamily) return null;
	rows.push(...repositoryResultsRows(args.p1, expectedFamily, args.asOfDate), ...repositoryResultsRows(args.p2, expectedFamily, args.asOfDate));
	const seen = /* @__PURE__ */ new Set();
	rows = rows.filter((row) => {
		const key = [
			row.source_id,
			row.player_name,
			row.opponent_name,
			row.tournament,
			row.event_date,
			row.observation_key,
			row.text_value
		].join("|");
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	const playerRows = rows.filter((r) => (evidenceNameMatches(r.player_name, args.p1, args.p2) || evidenceNameMatches(r.player_name, args.p2, args.p1)) && evidenceTourCompatible(expectedFamily, observationTourFamily(r)));
	const currentHistory = currentEventHistoryRows(historyRows, {
		p1: args.p1,
		p2: args.p2,
		asOfDate: args.asOfDate,
		tournament: args.tournament,
		round: args.round
	}, expectedFamily);
	if (currentHistory.length > 1) return null;
	if (!playerRows.length && !currentHistory.length) return null;
	const uniqueHistory = currentHistory.length === 1 ? currentHistory[0] : null;
	const canonicalMatch = buildCanonicalEvidenceMatchIdentity({
		player1StableId: uniqueHistory?.player1_id,
		player2StableId: uniqueHistory?.player2_id,
		player1Name: args.p1,
		player2Name: args.p2,
		tournament: args.tournament ?? uniqueHistory?.tournament_name,
		date: args.asOfDate,
		round: args.round ?? uniqueHistory?.round,
		tour: expectedFamily,
		eventLevel: args.eventLevel ?? uniqueHistory?.event_level
	});
	const c1 = componentsFor(args.p1, args.p2, rows, args.asOfDate, args.tournament ?? null, expectedFamily, historyRows, args.round), c2 = componentsFor(args.p2, args.p1, rows, args.asOfDate, args.tournament ?? null, expectedFamily, historyRows, args.round), p1 = valueFor(code, c1, args.p1, args.tournament ?? null, args.asOfDate), p2 = valueFor(code, c2, args.p2, args.tournament ?? null, args.asOfDate);
	if (!p1 || !p2) return null;
	return certifyMetricFinding({
		metric_code: code,
		p1_value: p1,
		p2_value: p2,
		p1_treatment: "PARTIAL",
		p2_treatment: "PARTIAL",
		differential: null,
		evidence_family: "RESULTS_SCHEDULE",
		reliability: 80,
		sample: `deterministic four-tour warehouse/repository components through ${args.asOfDate}; tour_family=${expectedFamily}; match_identity=${canonicalMatch.key}`,
		unavailable_reason: null,
		sources: sources$2(rows)
	});
}
function sources$1(rows) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const r of rows) {
		if (!r.source_name) continue;
		const k = `${r.source_name}|${r.source_url ?? ""}`;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push({
			source_name: r.source_name,
			url: r.source_url,
			retrieved_at: null
		});
	}
	return out;
}
async function deterministicRulesContextMetric(args) {
	const code = String(args.metricCode).match(/(\d{1,3})$/)?.[1]?.padStart(3, "0") ?? String(args.metricCode).padStart(3, "0");
	if (code !== "075") return null;
	const { data, error } = await tryQuery(() => db.select().from(sourceObservationsTable).where(lte(sourceObservationsTable.event_date, args.asOfDate)).orderBy(desc(sourceObservationsTable.event_date)).limit(300));
	if (error) return null;
	const rows = (data ?? []).filter((r) => metricAllowsObservation(code, r));
	if (!rows.length) return null;
	const keys = [...new Set(rows.map((r) => r.observation_key).filter(Boolean))];
	const context = String(args.context ?? "");
	const value = `best_of=${context.match(/best of\s+(\d)/i)?.[1] ?? "NA"}; setting=${/\bindoor\b/i.test(context) ? "indoor" : /\boutdoor\b/i.test(context) ? "outdoor" : "NA"}; objective_rule_components=${keys.join(",")}`;
	return {
		metric_code: "075",
		p1_value: value,
		p2_value: value,
		p1_treatment: "PARTIAL",
		p2_treatment: "PARTIAL",
		differential: null,
		evidence_family: "RULES_CONTEXT",
		reliability: 85,
		sample: `official rules context through ${args.asOfDate}`,
		unavailable_reason: null,
		sources: sources$1(rows)
	};
}
var pageSlice = (from, to) => ({
	limit: to - from + 1,
	offset: from
});
var EXCLUDED_OBSERVATION_TYPES$1 = [
	"POINT_BY_POINT",
	"PBP",
	"MARKET"
];
var PAGE_SIZE = 1e3;
var MAX_PAGES_PER_LANE = 20;
var MAX_PLAYER_PAGES = 50;
var playerDirectoryPromise = null;
function candidateNames(rows, fields) {
	const out = [];
	for (const row of rows) for (const field of fields) {
		const value = String(row?.[field] ?? "").trim();
		if (value) out.push(value);
	}
	return out;
}
function exactCanonicalCandidates(uploaded, names) {
	const candidates = /* @__PURE__ */ new Map();
	for (const value of names) {
		const canonical = uniqueCanonicalWarehouseIdentity(uploaded, [value]);
		if (!canonical) continue;
		candidates.set(normalizeEvidenceIdentity(canonical), canonical);
	}
	return candidates;
}
async function loadPlayerDirectory() {
	if (playerDirectoryPromise) return playerDirectoryPromise;
	playerDirectoryPromise = (async () => {
		const rows = [];
		for (let page = 0; page < MAX_PLAYER_PAGES; page++) {
			const from = page * PAGE_SIZE;
			let result;
			try {
				const slice = pageSlice(from, from + PAGE_SIZE - 1);
				result = await tryQuery(() => db.select({
					id: playersTable.id,
					canonical_name: playersTable.canonical_name,
					normalized_key: playersTable.normalized_key,
					aliases: playersTable.aliases,
					tour: playersTable.tour
				}).from(playersTable).orderBy(asc(playersTable.id)).limit(slice.limit).offset(slice.offset));
			} catch (error) {
				return {
					rows,
					errors: [error instanceof Error ? error.message : String(error)],
					truncated: false
				};
			}
			if (result.error) return {
				rows,
				errors: [result.error.message],
				truncated: false
			};
			const pageRows = result.data ?? [];
			rows.push(...pageRows);
			if (pageRows.length < PAGE_SIZE) return {
				rows,
				errors: [],
				truncated: false
			};
		}
		return {
			rows,
			errors: [],
			truncated: true
		};
	})();
	return playerDirectoryPromise;
}
function rowIdentityKeys(row) {
	return new Set([
		normalizeEvidenceIdentity(row.canonical_name),
		normalizeEvidenceIdentity(row.normalized_key ?? ""),
		...(row.aliases ?? []).map(normalizeEvidenceIdentity)
	].filter(Boolean));
}
function rowSurnameKeys(row) {
	const keys = /* @__PURE__ */ new Set();
	for (const value of [row.canonical_name, ...row.aliases ?? []]) {
		const tokens = normalizeEvidenceIdentity(value).split(" ").filter(Boolean);
		if (tokens.length >= 2) keys.add(tokens[tokens.length - 1]);
	}
	return keys;
}
function directoryMatches(input, rows) {
	const normalized = normalizeEvidenceIdentity(input);
	const stableId = String(input ?? "").trim().toLowerCase();
	const surnameOnly = isSurnameOnlyEvidenceIdentity(input);
	const matches = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const idMatch = String(row.id ?? "").toLowerCase() === stableId;
		const exactNameMatch = rowIdentityKeys(row).has(normalized);
		const surnameMatch = surnameOnly && rowSurnameKeys(row).has(normalized);
		if (!idMatch && !exactNameMatch && !surnameMatch) continue;
		matches.set(String(row.id), row);
	}
	return [...matches.values()];
}
function resolvedFromDirectory(input, row) {
	return {
		input,
		canonical: row.canonical_name,
		status: normalizeEvidenceIdentity(input) === normalizeEvidenceIdentity(row.canonical_name) ? "ALREADY_CANONICAL" : "RESOLVED",
		candidates: [row.canonical_name],
		query_errors: [],
		stable_id: row.id,
		normalized_key: row.normalized_key,
		aliases: row.aliases ?? [],
		tour: row.tour
	};
}
async function pagedLane(input, fields, makeQuery) {
	const names = [];
	for (let page = 0; page < MAX_PAGES_PER_LANE; page++) {
		const from = page * PAGE_SIZE;
		let result;
		try {
			result = await makeQuery(from, from + PAGE_SIZE - 1);
		} catch (error) {
			return {
				names,
				errors: [error instanceof Error ? error.message : String(error)],
				truncated: false
			};
		}
		if (result.error) return {
			names,
			errors: [result.error.message],
			truncated: false
		};
		const rows = result.data ?? [];
		names.push(...candidateNames(rows, fields));
		if (exactCanonicalCandidates(input, names).size > 1) return {
			names,
			errors: [],
			truncated: false
		};
		if (rows.length < PAGE_SIZE) return {
			names,
			errors: [],
			truncated: false
		};
	}
	return {
		names,
		errors: [],
		truncated: true
	};
}
async function queryEvidenceCandidates(input) {
	const token = normalizeEvidenceIdentity(input);
	if (!token || !/^[a-z0-9]+$/.test(token)) return {
		names: [],
		errors: ["Identity token is not query-safe."],
		truncated: false
	};
	const pattern = `%${token}%`;
	const lanes = await Promise.all([
		pagedLane(input, ["player_name"], (from, to) => tryQuery(() => db.select({
			id: sourceObservationsTable.id,
			player_name: sourceObservationsTable.player_name
		}).from(sourceObservationsTable).where(and(notInArray(sourceObservationsTable.observation_type, EXCLUDED_OBSERVATION_TYPES$1), ilike(sourceObservationsTable.player_name, pattern))).orderBy(asc(sourceObservationsTable.id)).limit(pageSlice(from, to).limit).offset(pageSlice(from, to).offset))),
		pagedLane(input, ["opponent_name"], (from, to) => tryQuery(() => db.select({
			id: sourceObservationsTable.id,
			opponent_name: sourceObservationsTable.opponent_name
		}).from(sourceObservationsTable).where(and(notInArray(sourceObservationsTable.observation_type, EXCLUDED_OBSERVATION_TYPES$1), ilike(sourceObservationsTable.opponent_name, pattern))).orderBy(asc(sourceObservationsTable.id)).limit(pageSlice(from, to).limit).offset(pageSlice(from, to).offset))),
		pagedLane(input, ["player_name"], (from, to) => tryQuery(() => db.select({
			id: metricEvidenceStoreTable.id,
			player_name: metricEvidenceStoreTable.player_name
		}).from(metricEvidenceStoreTable).where(ilike(metricEvidenceStoreTable.player_name, pattern)).orderBy(asc(metricEvidenceStoreTable.id)).limit(pageSlice(from, to).limit).offset(pageSlice(from, to).offset))),
		pagedLane(input, ["opponent_name"], (from, to) => tryQuery(() => db.select({
			id: metricEvidenceStoreTable.id,
			opponent_name: metricEvidenceStoreTable.opponent_name
		}).from(metricEvidenceStoreTable).where(ilike(metricEvidenceStoreTable.opponent_name, pattern)).orderBy(asc(metricEvidenceStoreTable.id)).limit(pageSlice(from, to).limit).offset(pageSlice(from, to).offset)))
	]);
	return {
		names: lanes.flatMap((lane) => lane.names),
		errors: lanes.flatMap((lane) => lane.errors),
		truncated: lanes.some((lane) => lane.truncated)
	};
}
async function resolveCanonicalEvidenceIdentity(input) {
	const directory = await loadPlayerDirectory();
	const matches = directoryMatches(input, directory.rows);
	if (!directory.errors.length && !directory.truncated) {
		if (matches.length === 1) return resolvedFromDirectory(input, matches[0]);
		if (matches.length > 1) return {
			input,
			canonical: input,
			status: "AMBIGUOUS",
			candidates: matches.map((row) => row.canonical_name).sort(),
			query_errors: []
		};
	}
	if (!isSurnameOnlyEvidenceIdentity(input)) {
		if (directory.errors.length || directory.truncated) return {
			input,
			canonical: input,
			status: "QUERY_FAILED",
			candidates: matches.map((row) => row.canonical_name).sort(),
			query_errors: [...directory.errors, ...directory.truncated ? ["Canonical player directory lookup exceeded its bounded pagination window."] : []]
		};
		return {
			input,
			canonical: input,
			status: "ALREADY_CANONICAL",
			candidates: [input],
			query_errors: []
		};
	}
	const lookup = await queryEvidenceCandidates(input);
	const candidates = [...exactCanonicalCandidates(input, [...matches.map((row) => row.canonical_name), ...lookup.names]).values()].sort();
	const errors = [...directory.errors, ...lookup.errors];
	const truncated = directory.truncated || lookup.truncated;
	if (errors.length || truncated) return {
		input,
		canonical: input,
		status: "QUERY_FAILED",
		candidates,
		query_errors: [...errors, ...truncated ? ["Canonical warehouse identity lookup exceeded its bounded pagination window."] : []]
	};
	const canonical = uniqueCanonicalWarehouseIdentity(input, candidates);
	if (canonical) {
		const row = matches.find((entry) => normalizeEvidenceIdentity(entry.canonical_name) === normalizeEvidenceIdentity(canonical));
		return row ? resolvedFromDirectory(input, row) : {
			input,
			canonical,
			status: "RESOLVED",
			candidates,
			query_errors: []
		};
	}
	return {
		input,
		canonical: input,
		status: candidates.length > 1 ? "AMBIGUOUS" : "UNRESOLVED",
		candidates,
		query_errors: []
	};
}
async function resolveCanonicalEvidencePair(p1, p2) {
	const [left, right] = await Promise.all([resolveCanonicalEvidenceIdentity(p1), resolveCanonicalEvidenceIdentity(p2)]);
	if (normalizeEvidenceIdentity(left.canonical) === normalizeEvidenceIdentity(right.canonical)) return {
		p1: {
			...left,
			canonical: p1,
			status: left.status === "ALREADY_CANONICAL" ? left.status : "AMBIGUOUS"
		},
		p2: {
			...right,
			canonical: p2,
			status: right.status === "ALREADY_CANONICAL" ? right.status : "AMBIGUOUS"
		}
	};
	return {
		p1: left,
		p2: right
	};
}
var SOURCE_NAME$16 = "Tennis-Data.co.uk WTA historical results";
var SOURCE_URL$14 = "https://www.tennis-data.co.uk/alldata.php";
var DATA_PATH = "data/public/tennis-data-wta/wta_matches_2007_2016.csv";
var cache$9 = null;
function norm$17(v) {
	return String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tokens$4(v) {
	return norm$17(v).split(" ").filter(Boolean);
}
function n$3(v) {
	const x = Number(v);
	return Number.isFinite(x) ? x : null;
}
function parseCsv$7(text) {
	const rows = [];
	let row = [], cell = "", quoted = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === "\"") {
			if (quoted && text[i + 1] === "\"") {
				cell += "\"";
				i++;
			} else quoted = !quoted;
		} else if (ch === "," && !quoted) {
			row.push(cell);
			cell = "";
		} else if ((ch === "\n" || ch === "\r") && !quoted) {
			if (ch === "\r" && text[i + 1] === "\n") i++;
			row.push(cell);
			cell = "";
			if (row.some(Boolean)) rows.push(row);
			row = [];
		} else cell += ch;
	}
	if (cell.length || row.length) {
		row.push(cell);
		rows.push(row);
	}
	if (!rows.length) return [];
	const headers = rows[0].map((h) => h.trim());
	return rows.slice(1).map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()])));
}
function load$14() {
	if (cache$9) return cache$9;
	const path = join(process.cwd(), DATA_PATH);
	if (!existsSync(path)) return [];
	try {
		return cache$9 = parseCsv$7(readFileSync(path, "utf8"));
	} catch {
		return [];
	}
}
function resolvePlayer(rows, requested) {
	const needle = norm$17(requested);
	if (!needle) return null;
	const names = [...new Set(rows.flatMap((r) => [r.winner, r.loser]).filter(Boolean))];
	const exact = names.filter((x) => norm$17(x) === needle);
	if (exact.length === 1) {
		const canonical = exact[0];
		return {
			canonical,
			rows: rows.filter((r) => r.winner === canonical || r.loser === canonical)
		};
	}
	const req = tokens$4(requested), surname = req.at(-1);
	if (!surname) return null;
	const candidates = names.filter((name) => {
		const nt = tokens$4(name);
		if (!nt.length || nt.at(-1) !== surname) return false;
		if (req.length === 1) return true;
		const set = new Set(nt);
		return req.every((t) => set.has(t));
	});
	if (candidates.length !== 1) return null;
	const canonical = candidates[0];
	return {
		canonical,
		rows: rows.filter((r) => r.winner === canonical || r.loser === canonical)
	};
}
function cutoffFromContext$1(context) {
	return context.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function surfaceFromContext$1(context) {
	return context.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase() ?? null;
}
function source$3(retrievedAt) {
	return [{
		source_name: SOURCE_NAME$16,
		url: SOURCE_URL$14,
		retrieved_at: retrievedAt
	}];
}
function stat$16(player, key, value, retrievedAt, surface, sample) {
	return {
		key,
		player,
		value,
		surface,
		window: "HISTORICAL_WTA_2007_2016_PRE_MATCH",
		tour_level: null,
		sample,
		origin: "DIRECT",
		sources: source$3(retrievedAt)
	};
}
/**
* Historical WTA match evidence from Tennis-Data.co.uk.
*
* Critical guardrail: this adapter does not manufacture current form. It emits
* only aggregate historical match/set/surface facts actually present before
* the audited cutoff. The source archive used by this app ends at 2016.
*/
function getTennisDataWtaHistoricalStats(player, context) {
	const resolved = resolvePlayer(load$14(), player);
	if (!resolved) return [];
	const cutoff = cutoffFromContext$1(context), surface = surfaceFromContext$1(context);
	if (!cutoff) return [];
	let rows = resolved.rows.filter((r) => isBeforeCutoff(r.date, cutoff));
	if (!rows.length) return [];
	const surfaceRows = surface ? rows.filter((r) => norm$17(r.surface) === surface) : [];
	const use = surface && surfaceRows.length ? surfaceRows : rows;
	const retrievedAt = (/* @__PURE__ */ new Date()).toISOString();
	const wins = use.filter((r) => r.winner === resolved.canonical).length;
	const losses = use.length - wins;
	let setsWon = 0, setsLost = 0, straightWins = 0, deciding = 0, decidingWins = 0;
	let rankSamples = 0, rankSum = 0;
	for (const r of use) {
		const won = r.winner === resolved.canonical;
		const wf = n$3(r.winner_sets), lf = n$3(r.loser_sets);
		if (wf !== null && lf !== null) {
			setsWon += won ? wf : lf;
			setsLost += won ? lf : wf;
			if (won && lf === 0) straightWins++;
			const total = wf + lf;
			if (total === 3 || total === 5) {
				deciding++;
				if (won) decidingWins++;
			}
		}
		const rank = n$3(won ? r.winner_rank : r.loser_rank);
		if (rank !== null && rank > 0) {
			rankSum += rank;
			rankSamples++;
		}
	}
	const out = [];
	const sample = use.length;
	out.push(stat$16(player, "matches_played", sample, retrievedAt, surface, sample));
	out.push(stat$16(player, "wins", wins, retrievedAt, surface, sample));
	out.push(stat$16(player, "losses", losses, retrievedAt, surface, sample));
	out.push(stat$16(player, "matches_won", wins, retrievedAt, surface, sample));
	out.push(stat$16(player, "surface_matches", sample, retrievedAt, surface, sample));
	out.push(stat$16(player, "surface_wins", wins, retrievedAt, surface, sample));
	out.push(stat$16(player, "surface_losses", losses, retrievedAt, surface, sample));
	if (sample) {
		out.push(stat$16(player, "win_pct", 100 * wins / sample, retrievedAt, surface, sample));
		out.push(stat$16(player, "surface_win_pct", 100 * wins / sample, retrievedAt, surface, sample));
	}
	if (setsWon + setsLost > 0) {
		out.push(stat$16(player, "sets_played", setsWon + setsLost, retrievedAt, surface, sample));
		out.push(stat$16(player, "sets_won", setsWon, retrievedAt, surface, sample));
		out.push(stat$16(player, "set_win_pct", 100 * setsWon / (setsWon + setsLost), retrievedAt, surface, sample));
	}
	out.push(stat$16(player, "straight_set_wins", straightWins, retrievedAt, surface, sample));
	if (wins > 0) out.push(stat$16(player, "straight_set_win_pct", 100 * straightWins / wins, retrievedAt, surface, wins));
	out.push(stat$16(player, "deciding_sets_played", deciding, retrievedAt, surface, deciding));
	out.push(stat$16(player, "deciding_sets_won", decidingWins, retrievedAt, surface, deciding));
	if (deciding > 0) out.push(stat$16(player, "deciding_set_win_pct", 100 * decidingWins / deciding, retrievedAt, surface, deciding));
	if (rankSamples > 0) out.push(stat$16(player, "average_historical_rank", rankSum / rankSamples, retrievedAt, surface, rankSamples));
	return out;
}
var SOURCE_URL$13 = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
var SOURCE_NAME$15 = "PredixSport public tennis ratings (CC BY 4.0)";
var atpRowsCache = null;
var wtaRowsCache = null;
function norm$16(v) {
	return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tokens$3(v) {
	return norm$16(v).split(" ").filter(Boolean);
}
/** Resolve OCR/legacy shortened names to one unique dataset identity.
* Exact match wins. Otherwise require surname agreement and a unique candidate.
* Ambiguous surnames are deliberately rejected rather than guessed.
*/
function resolvePlayerRows(rows, requested) {
	const needle = norm$16(requested);
	if (!needle) return null;
	const exact = rows.filter((r) => norm$16(r.player ?? "") === needle);
	if (exact.length) return {
		canonical: exact[0].player,
		rows: exact
	};
	const req = tokens$3(requested), surname = req[req.length - 1];
	if (!surname) return null;
	const candidates = [...new Set(rows.map((r) => r.player ?? "").filter(Boolean))].filter((name) => {
		const nt = tokens$3(name);
		if (!nt.length || nt[nt.length - 1] !== surname) return false;
		if (req.length === 1) return true;
		const ns = new Set(nt);
		return req.every((t) => ns.has(t));
	});
	if (candidates.length !== 1) return null;
	const canonical = candidates[0];
	return {
		canonical,
		rows: rows.filter((r) => r.player === canonical)
	};
}
function parseCsv$6(text) {
	const rows = [];
	let row = [], cell = "", quoted = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === "\"") {
			if (quoted && text[i + 1] === "\"") {
				cell += "\"";
				i++;
			} else quoted = !quoted;
		} else if (ch === "," && !quoted) {
			row.push(cell);
			cell = "";
		} else if ((ch === "\n" || ch === "\r") && !quoted) {
			if (ch === "\r" && text[i + 1] === "\n") i++;
			row.push(cell);
			cell = "";
			if (row.some((x) => x.length)) rows.push(row);
			row = [];
		} else cell += ch;
	}
	if (cell.length || row.length) {
		row.push(cell);
		rows.push(row);
	}
	if (!rows.length) return [];
	const headers = rows[0].map((h) => h.trim());
	return rows.slice(1).map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()])));
}
function load$13(tour) {
	if (tour === "ATP" && atpRowsCache) return atpRowsCache;
	if (tour === "WTA" && wtaRowsCache) return wtaRowsCache;
	const rel = tour === "ATP" ? "data/public/predixsport/atp/atp_elo_matches.csv" : "data/public/predixsport/wta/wta_elo_ratings.csv";
	try {
		const rows = parseCsv$6(readFileSync(join(process.cwd(), rel), "utf8"));
		if (tour === "ATP") atpRowsCache = rows;
		else wtaRowsCache = rows;
		return rows;
	} catch {
		return [];
	}
}
function cutoffFromContext(context) {
	return context.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function surfaceFromContext(context) {
	return context.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase() ?? null;
}
function before$1(row, cutoff) {
	return cutoff !== null && isBeforeCutoff(row.date, cutoff);
}
function number$1(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}
function source$2(retrievedAt) {
	return [{
		source_name: SOURCE_NAME$15,
		url: SOURCE_URL$13,
		retrieved_at: retrievedAt
	}];
}
function stat$15(player, key, value, retrievedAt, surface = null, sample = null) {
	return {
		key,
		player,
		value,
		surface,
		window: "PRE_MATCH_HISTORY",
		tour_level: null,
		sample,
		origin: "DIRECT",
		sources: source$2(retrievedAt)
	};
}
function atpEvidence(player, context) {
	const cutoff = cutoffFromContext(context), surface = surfaceFromContext(context);
	const resolved = resolvePlayerRows(load$13("ATP"), player);
	if (!resolved) return null;
	const rows = resolved.rows.filter((r) => before$1(r, cutoff)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
	if (!rows.length) return null;
	const retrievedAt = (/* @__PURE__ */ new Date()).toISOString();
	const surfaceRows = surface ? rows.filter((r) => (r.surface ?? "").toLowerCase() === surface) : rows;
	const use = surfaceRows.length ? surfaceRows : rows;
	const latest = use[use.length - 1];
	const elo = number$1(latest.elo_post) ?? number$1(latest.elo_pre);
	const vals = use.flatMap((r) => [number$1(r.elo_pre), number$1(r.elo_post)].filter((n) => n !== null));
	const peak = vals.length ? Math.max(...vals) : null;
	const wins = use.filter((r) => r.won === "1").length, losses = use.filter((r) => r.won === "0").length;
	const setsWon = use.reduce((s, r) => s + (number$1(r.sets_for) ?? 0), 0), setsLost = use.reduce((s, r) => s + (number$1(r.sets_against) ?? 0), 0);
	const straightWins = use.filter((r) => r.won === "1" && number$1(r.sets_against) === 0).length;
	const deciding = use.filter((r) => {
		const a = number$1(r.sets_for), b = number$1(r.sets_against);
		return a !== null && b !== null && (a + b === 3 || a + b === 5);
	});
	const decidingWins = deciding.filter((r) => r.won === "1").length;
	let last28 = 0;
	if (cutoff) {
		const end = (/* @__PURE__ */ new Date(`${cutoff}T00:00:00Z`)).getTime(), start = end - 24192e5;
		last28 = rows.filter((r) => {
			const t = Date.parse(`${r.date}T00:00:00Z`);
			return Number.isFinite(t) && t >= start && t < end;
		}).length;
	}
	const stats = [];
	if (elo !== null) stats.push(stat$15(player, "surface_elo", elo, retrievedAt, surface, use.length));
	if (peak !== null) stats.push(stat$15(player, "peak_surface_elo", peak, retrievedAt, surface, use.length));
	stats.push(stat$15(player, "surface_matches", use.length, retrievedAt, surface, use.length), stat$15(player, "surface_wins", wins, retrievedAt, surface, use.length), stat$15(player, "surface_losses", losses, retrievedAt, surface, use.length));
	if (use.length) stats.push(stat$15(player, "surface_win_pct", 100 * wins / use.length, retrievedAt, surface, use.length));
	stats.push(stat$15(player, "sets_played", setsWon + setsLost, retrievedAt, surface, use.length), stat$15(player, "sets_won", setsWon, retrievedAt, surface, use.length));
	if (setsWon + setsLost) stats.push(stat$15(player, "set_win_pct", 100 * setsWon / (setsWon + setsLost), retrievedAt, surface, use.length));
	stats.push(stat$15(player, "matches_won", wins, retrievedAt, surface, use.length), stat$15(player, "straight_set_wins", straightWins, retrievedAt, surface, use.length));
	if (wins) stats.push(stat$15(player, "straight_set_win_pct", 100 * straightWins / wins, retrievedAt, surface, wins));
	stats.push(stat$15(player, "deciding_sets_played", deciding.length, retrievedAt, surface, deciding.length), stat$15(player, "deciding_sets_won", decidingWins, retrievedAt, surface, deciding.length));
	if (deciding.length) stats.push(stat$15(player, "deciding_set_win_pct", 100 * decidingWins / deciding.length, retrievedAt, surface, deciding.length));
	stats.push(stat$15(player, "wins", wins, retrievedAt, surface, use.length), stat$15(player, "losses", losses, retrievedAt, surface, use.length), stat$15(player, "matches_played", use.length, retrievedAt, surface, use.length));
	if (use.length) stats.push(stat$15(player, "win_pct", 100 * wins / use.length, retrievedAt, surface, use.length));
	if (cutoff) stats.push(stat$15(player, "matches_last_28_days", last28, retrievedAt, surface, last28));
	return {
		tour: "ATP",
		player,
		canonicalPlayer: resolved.canonical,
		context,
		cutoff,
		surface,
		stats,
		summary: {
			observations: use.length,
			wins,
			losses,
			elo,
			peak_elo: peak,
			last_date: latest.date ?? null,
			canonical_player: resolved.canonical
		}
	};
}
function wtaEvidence(player, context) {
	const cutoff = cutoffFromContext(context), surface = surfaceFromContext(context);
	const historical = getTennisDataWtaHistoricalStats(player, context);
	const resolved = resolvePlayerRows(load$13("WTA"), player);
	if (!resolved) {
		if (!historical.length) return null;
		return {
			tour: "WTA",
			player,
			canonicalPlayer: player,
			context,
			cutoff,
			surface,
			stats: historical,
			summary: {
				observations: historical.find((s) => s.key === "matches_played")?.value ?? historical[0]?.sample ?? 0,
				elo: null,
				peak_elo: null,
				last_date: null,
				canonical_player: player
			}
		};
	}
	const rows = resolved.rows.filter((r) => before$1(r, cutoff)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
	if (!rows.length && !historical.length) return null;
	const stats = [...historical];
	if (!rows.length) return {
		tour: "WTA",
		player,
		canonicalPlayer: resolved.canonical,
		context,
		cutoff,
		surface,
		stats,
		summary: {
			observations: historical.find((s) => s.key === "matches_played")?.value ?? historical[0]?.sample ?? 0,
			elo: null,
			peak_elo: null,
			last_date: null,
			canonical_player: resolved.canonical
		}
	};
	const retrievedAt = (/* @__PURE__ */ new Date()).toISOString(), surfaceRows = surface ? rows.filter((r) => (r.surface ?? "").toLowerCase() === surface) : rows, use = surfaceRows.length ? surfaceRows : rows, latest = use[use.length - 1], elo = number$1(latest.elo), vals = use.map((r) => number$1(r.elo)).filter((n) => n !== null), peak = vals.length ? Math.max(...vals) : null;
	if (elo !== null) stats.push(stat$15(player, "surface_elo", elo, retrievedAt, surface, use.length));
	if (peak !== null) stats.push(stat$15(player, "peak_surface_elo", peak, retrievedAt, surface, use.length));
	return {
		tour: "WTA",
		player,
		canonicalPlayer: resolved.canonical,
		context,
		cutoff,
		surface,
		stats,
		summary: {
			observations: use.length,
			elo,
			peak_elo: peak,
			last_date: latest.date ?? null,
			canonical_player: resolved.canonical
		}
	};
}
function getPredixDatasetEvidence(player, context) {
	return atpEvidence(player, context) ?? wtaEvidence(player, context);
}
function predixDatasetDossier(player, context) {
	const e = getPredixDatasetEvidence(player, context);
	if (!e) return "";
	return `PREDIXSPORT_LOCAL_DATA:${JSON.stringify({
		tour: e.tour,
		player: e.player,
		canonicalPlayer: e.canonicalPlayer,
		cutoff: e.cutoff,
		surface: e.surface,
		summary: e.summary,
		stats: e.stats,
		source: SOURCE_URL$13,
		license: "CC BY 4.0"
	})}`;
}
function statsFromPredixDatasetDossier(dossier, player) {
	const i = dossier.indexOf("PREDIXSPORT_LOCAL_DATA:");
	if (i < 0) return [];
	const tail = dossier.slice(i + 23).split("\n")[0];
	try {
		return (JSON.parse(tail).stats ?? []).filter((s) => s.player === player);
	} catch {
		return [];
	}
}
var SOURCE_URL$12 = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
var SOURCE_NAME$14 = "PredixSport bundled public tennis history (CC BY 4.0)";
function norm$15(v) {
	return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function toks$1(v) {
	return norm$15(v).split(" ").filter(Boolean);
}
function surface$5(context) {
	return context.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase() ?? null;
}
function cutoff$5(context) {
	return context.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function resolve$3(map, requested) {
	const n = norm$15(requested);
	if (map[n]) return map[n];
	const t = toks$1(requested), last = t[t.length - 1];
	if (!last) return null;
	const candidates = Object.values(map).filter((p) => {
		const pt = toks$1(p.name);
		if (pt[pt.length - 1] !== last) return false;
		const s = new Set(pt);
		return t.length === 1 || t.every((x) => s.has(x));
	});
	return candidates.length === 1 ? candidates[0] : null;
}
function findPlayer(name) {
	const runtimeIndex = loadRuntimeIndex();
	return resolve$3(runtimeIndex.ATP, name) ?? resolve$3(runtimeIndex.WTA, name);
}
function source$1() {
	return [{
		source_name: SOURCE_NAME$14,
		url: SOURCE_URL$12,
		retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
	}];
}
function stat$14(player, key, value, sample, surf) {
	return {
		key,
		player,
		value,
		surface: surf,
		window: "PRE_MATCH_HISTORY",
		tour_level: null,
		sample,
		origin: "RECONSTRUCTED",
		sources: source$1()
	};
}
function pct$1(a, b) {
	return b ? 100 * a / b : null;
}
function getRuntimeHistoricalStats(player, context) {
	const p = findPlayer(player);
	if (!p) return [];
	const surf = surface$5(context), b = surf && p.surface[surf] || p.overall, out = [];
	const add = (k, v, n = b.n) => {
		if (v !== null && Number.isFinite(v)) out.push(stat$14(player, k, v, n, surf));
	};
	add("surface_elo", b.elo);
	add("current_surface_elo", b.elo);
	add("peak_surface_elo", b.peak);
	add("observed_peak_surface_elo", b.peak);
	add("surface_matches", b.n);
	add("surface_win_pct", pct$1(b.w, b.n));
	add("wins", b.w);
	add("losses", b.l);
	add("win_pct", pct$1(b.w, b.n));
	add("matches_played", b.n);
	add("sets_played", b.sets);
	add("sets_won", b.setsWon);
	add("set_win_pct", pct$1(b.setsWon, b.sets));
	add("matches_won", b.w);
	add("straight_set_wins", b.straightWins);
	add("straight_set_win_pct", pct$1(b.straightWins, b.w), b.w);
	add("historical_straight_set_win_pct", pct$1(b.straightWins, b.w), b.w);
	add("deciding_matches_played", b.deciding, b.deciding);
	add("historical_deciding_set_win_pct", pct$1(b.decidingWins, b.deciding), b.deciding);
	const recent = b.recent ?? [], last10 = recent.slice(-10), last5 = recent.slice(-5);
	add("last10_win_pct", pct$1(last10.filter((r) => r[1] === 1).length, last10.length), last10.length);
	add("last5_win_pct", pct$1(last5.filter((r) => r[1] === 1).length, last5.length), last5.length);
	add("overall_recent20_win_pct", pct$1(recent.filter((r) => r[1] === 1).length, recent.length), recent.length);
	if (recent.length) {
		const seq = recent.map((r) => r[1]);
		const last = seq[seq.length - 1], sign = last === 1 ? 1 : -1;
		let streak = 0;
		for (let i = seq.length - 1; i >= 0 && seq[i] === last; i--) streak++;
		add("current_streak_signed", sign * streak, seq.length);
		let best = 0, run = 0;
		for (const w of seq) if (w === 1) {
			run++;
			best = Math.max(best, run);
		} else run = 0;
		add("longest_win_streak_observed", best, seq.length);
	}
	const cut = cutoff$5(context);
	if (cut) {
		const end = Date.parse(`${cut}T00:00:00Z`);
		for (const [days, key] of [
			[7, "matches_last_7_days"],
			[14, "matches_last_14_days"],
			[28, "matches_last_28_days"]
		]) {
			const start = end - days * 864e5, n = recent.filter((r) => {
				const t = Date.parse(`${r[0]}T00:00:00Z`);
				return Number.isFinite(t) && t >= start && t < end;
			}).length;
			add(key, n, n);
		}
		if (b.lastDate) {
			const d = Date.parse(`${b.lastDate}T00:00:00Z`);
			if (Number.isFinite(d)) add("days_since_last_match", Math.max(0, (end - d) / 864e5), 1);
		}
	}
	return out;
}
var SOURCE_URL$11 = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
var SOURCE_NAME$13 = "PredixSport public tennis ratings (CC BY 4.0)";
var cache$8 = null;
function norm$14(v) {
	return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tokens$2(v) {
	return norm$14(v).split(" ").filter(Boolean);
}
function num$4(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}
function parseCsv$5(text) {
	const rows = [];
	let row = [], cell = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === "\"") {
			if (q && text[i + 1] === "\"") {
				cell += "\"";
				i++;
			} else q = !q;
		} else if (ch === "," && !q) {
			row.push(cell);
			cell = "";
		} else if ((ch === "\n" || ch === "\r") && !q) {
			if (ch === "\r" && text[i + 1] === "\n") i++;
			row.push(cell);
			cell = "";
			if (row.some(Boolean)) rows.push(row);
			row = [];
		} else cell += ch;
	}
	if (cell || row.length) {
		row.push(cell);
		rows.push(row);
	}
	if (!rows.length) return [];
	const h = rows[0].map((x) => x.trim());
	return rows.slice(1).map((c) => Object.fromEntries(h.map((k, i) => [k, (c[i] ?? "").trim()])));
}
function load$12() {
	if (cache$8) return cache$8;
	try {
		return cache$8 = parseCsv$5(readFileSync(join(process.cwd(), "data/public/predixsport/atp/atp_elo_matches.csv"), "utf8"));
	} catch {
		return [];
	}
}
function resolve$2(rows, name) {
	const n = norm$14(name), names = [...new Set(rows.map((r) => r.player).filter(Boolean))];
	const exact = names.filter((x) => norm$14(x) === n);
	if (exact.length === 1) return exact[0];
	const t = tokens$2(name), last = t[t.length - 1];
	if (!last) return null;
	const c = names.filter((x) => {
		const xt = tokens$2(x);
		if (xt[xt.length - 1] !== last) return false;
		const s = new Set(xt);
		return t.length === 1 || t.every((v) => s.has(v));
	});
	return c.length === 1 ? c[0] : null;
}
function cutoff$4(context) {
	return context.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function surface$4(context) {
	return context.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase() ?? null;
}
function stat$13(player, key, value, sample, surfaceValue) {
	return {
		key,
		player,
		value,
		surface: surfaceValue,
		window: "PRE_MATCH_HISTORY",
		tour_level: null,
		sample,
		origin: "RECONSTRUCTED",
		sources: [{
			source_name: SOURCE_NAME$13,
			url: SOURCE_URL$11,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	};
}
function winPct(rows) {
	return rows.length ? 100 * rows.filter((r) => r.won === "1").length / rows.length : null;
}
function setPct(rows) {
	const sw = rows.reduce((s, r) => s + (num$4(r.sets_for) ?? 0), 0), sl = rows.reduce((s, r) => s + (num$4(r.sets_against) ?? 0), 0);
	return sw + sl ? 100 * sw / (sw + sl) : null;
}
function straightPct(rows) {
	const wins = rows.filter((r) => r.won === "1");
	return wins.length ? 100 * wins.filter((r) => num$4(r.sets_against) === 0).length / wins.length : null;
}
function withinDays(rows, cut, days) {
	if (!cut) return [];
	const end = Date.parse(`${cut}T00:00:00Z`), start = end - days * 864e5;
	return rows.filter((r) => {
		const t = Date.parse(`${r.date}T00:00:00Z`);
		return Number.isFinite(t) && t >= start && t < end;
	});
}
function latestOpponentElo(all, opponent, date, surf) {
	const n = norm$14(opponent);
	const candidates = all.filter((r) => norm$14(r.player ?? "") === n && (!date || !r.date || r.date <= date) && (!surf || !r.surface || r.surface.toLowerCase() === surf)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
	const r = candidates[candidates.length - 1];
	return r ? num$4(r.elo_pre) ?? num$4(r.elo_post) : null;
}
function getRecentReconstruction(player, context) {
	const all = load$12(), canonical = resolve$2(all, player);
	if (!canonical) return getRuntimeHistoricalStats(player, context);
	const cut = cutoff$4(context), surf = surface$4(context);
	if (!cut) return [];
	const rows = all.filter((r) => r.player === canonical && isBeforeCutoff(r.date, cut)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
	if (!rows.length) return getRuntimeHistoricalStats(player, context);
	const last10 = rows.slice(-10), last5 = rows.slice(-5);
	rows.slice(-3);
	const surfaceRecent = surf ? rows.filter((r) => (r.surface ?? "").toLowerCase() === surf).slice(-10) : last10;
	const d7 = withinDays(rows, cut, 7), d14 = withinDays(rows, cut, 14), d28 = withinDays(rows, cut, 28), d60 = withinDays(rows, cut, 60), d90 = withinDays(rows, cut, 90);
	const out = [];
	const add = (key, v, sample) => {
		if (v !== null && Number.isFinite(v)) out.push(stat$13(player, key, v, sample, surf));
	};
	add("last5_win_pct", winPct(last5), last5.length);
	add("last10_win_pct", winPct(last10), last10.length);
	add("last5_set_win_pct", setPct(last5), last5.length);
	add("last10_set_win_pct", setPct(last10), last10.length);
	add("recent_straight_set_control_pct", straightPct(last10), last10.length);
	add("current_surface_recent_win_pct", winPct(surfaceRecent), surfaceRecent.length);
	add("win_pct_60d", winPct(d60), d60.length);
	add("win_pct_90d", winPct(d90), d90.length);
	const firstHalf = last10.slice(0, Math.floor(last10.length / 2)), secondHalf = last10.slice(Math.floor(last10.length / 2));
	const a = winPct(firstHalf), b = winPct(secondHalf);
	add("recent_form_trend", a !== null && b !== null ? b - a : null, last10.length);
	const recentElos = last10.map((r) => num$4(r.elo_post) ?? num$4(r.elo_pre)).filter((x) => x !== null);
	if (recentElos.length >= 2) add("surface_elo_trend", recentElos[recentElos.length - 1] - recentElos[0], recentElos.length);
	const current = recentElos[recentElos.length - 1] ?? null, peak = rows.flatMap((r) => [num$4(r.elo_pre), num$4(r.elo_post)].filter((x) => x !== null));
	if (current !== null && peak.length) add("peak_vs_current_elo_gap", Math.max(...peak) - current, rows.length);
	add("matches_last_7_days", d7.length, d7.length);
	add("matches_last_14_days", d14.length, d14.length);
	add("matches_last_28_days", d28.length, d28.length);
	add("sets_last_14_days", d14.reduce((s, r) => s + (num$4(r.sets_for) ?? 0) + (num$4(r.sets_against) ?? 0), 0), d14.length);
	add("three_setters_last_14_days", d14.filter((r) => (num$4(r.sets_for) ?? 0) + (num$4(r.sets_against) ?? 0) === 3).length, d14.length);
	if (cut && rows.length) {
		const last = rows[rows.length - 1]?.date;
		if (last) add("rest_days", (Date.parse(`${cut}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 864e5, 1);
	}
	const oq = last10.map((r) => latestOpponentElo(all, r.opponent ?? "", r.date ?? "", surf)).filter((x) => x !== null);
	if (oq.length) add("recent_opponent_avg_elo", oq.reduce((s, x) => s + x, 0) / oq.length, oq.length);
	const winOq = last10.filter((r) => r.won === "1").map((r) => latestOpponentElo(all, r.opponent ?? "", r.date ?? "", surf)).filter((x) => x !== null);
	if (winOq.length) add("best_recent_win_opponent_elo", Math.max(...winOq), winOq.length);
	const ownCurrent = current;
	if (ownCurrent !== null) {
		let bad = 0, eligible = 0;
		for (const r of last10.filter((r) => r.won === "0")) {
			const oe = latestOpponentElo(all, r.opponent ?? "", r.date ?? "", surf);
			if (oe !== null) {
				eligible++;
				if (oe <= ownCurrent - 100) bad++;
			}
		}
		if (eligible) add("bad_loss_rate_pct", 100 * bad / eligible, eligible);
	}
	const seq = rows.map((r) => r.won).filter((x) => x === "0" || x === "1");
	if (seq.length) {
		const last = seq[seq.length - 1], sign = last === "1" ? 1 : -1;
		let streak = 0;
		for (let i = seq.length - 1; i >= 0 && seq[i] === last; i--) streak++;
		add("current_streak_signed", sign * streak, seq.length);
		let best = 0, run = 0;
		for (const x of seq) if (x === "1") {
			run++;
			best = Math.max(best, run);
		} else run = 0;
		add("longest_win_streak_observed", best, seq.length);
	}
	return out;
}
var SOURCE_URL$10 = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
var SOURCE_NAME$12 = "PredixSport public tennis ratings (CC BY 4.0)";
var cache$7 = null;
function norm$13(v) {
	return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function toks(v) {
	return norm$13(v).split(" ").filter(Boolean);
}
function num$3(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}
function parseCsv$4(text) {
	const rows = [];
	let row = [], cell = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === "\"") {
			if (q && text[i + 1] === "\"") {
				cell += "\"";
				i++;
			} else q = !q;
		} else if (ch === "," && !q) {
			row.push(cell);
			cell = "";
		} else if ((ch === "\n" || ch === "\r") && !q) {
			if (ch === "\r" && text[i + 1] === "\n") i++;
			row.push(cell);
			cell = "";
			if (row.some(Boolean)) rows.push(row);
			row = [];
		} else cell += ch;
	}
	if (cell || row.length) {
		row.push(cell);
		rows.push(row);
	}
	if (!rows.length) return [];
	const h = rows[0].map((x) => x.trim());
	return rows.slice(1).map((c) => Object.fromEntries(h.map((k, i) => [k, (c[i] ?? "").trim()])));
}
function load$11() {
	if (cache$7) return cache$7;
	try {
		return cache$7 = parseCsv$4(readFileSync(join(process.cwd(), "data/public/predixsport/atp/atp_elo_matches.csv"), "utf8"));
	} catch {
		return [];
	}
}
function resolve$1(rows, name) {
	const n = norm$13(name), names = [...new Set(rows.map((r) => r.player).filter(Boolean))], exact = names.filter((x) => norm$13(x) === n);
	if (exact.length === 1) return exact[0];
	const t = toks(name), last = t[t.length - 1];
	if (!last) return null;
	const c = names.filter((x) => {
		const xt = toks(x);
		if (xt[xt.length - 1] !== last) return false;
		const s = new Set(xt);
		return t.length === 1 || t.every((v) => s.has(v));
	});
	return c.length === 1 ? c[0] : null;
}
function cutoff$3(context) {
	return context.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function surface$3(context) {
	return context.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase() ?? null;
}
function stat$12(player, key, value, sample, surf) {
	return {
		key,
		player,
		value,
		surface: surf,
		window: "PRE_MATCH_HISTORY",
		tour_level: null,
		sample,
		origin: "RECONSTRUCTED",
		sources: [{
			source_name: SOURCE_NAME$12,
			url: SOURCE_URL$10,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	};
}
function oppElo$1(all, opp, date, surf) {
	const n = norm$13(opp), r = all.filter((x) => norm$13(x.player ?? "") === n && (!date || !x.date || x.date <= date) && (!surf || !x.surface || x.surface.toLowerCase() === surf)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
	const z = r[r.length - 1];
	return z ? num$3(z.elo_pre) ?? num$3(z.elo_post) : null;
}
function mean$2(a) {
	return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
}
function sd$1(a) {
	const m = mean$2(a);
	return m === null || a.length < 2 ? null : Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}
function getDerivedHistoricalStats(player, context) {
	const all = load$11(), canonical = resolve$1(all, player);
	if (!canonical) return getRuntimeHistoricalStats(player, context);
	const cut = cutoff$3(context), surf = surface$3(context);
	if (!cut) return [];
	const rows = all.filter((r) => r.player === canonical && isBeforeCutoff(r.date, cut)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
	if (!rows.length) return getRuntimeHistoricalStats(player, context);
	const use = surf ? rows.filter((r) => (r.surface ?? "").toLowerCase() === surf) : rows, recent = use.slice(-20), last10 = use.slice(-10), out = [];
	const add = (k, v, n) => {
		if (v !== null && Number.isFinite(v)) out.push(stat$12(player, k, v, n, surf));
	};
	if (cut) {
		const end = Date.parse(`${cut}T00:00:00Z`), start = end - 31536e6, yr = use.filter((r) => {
			const t = Date.parse(`${r.date}T00:00:00Z`);
			return Number.isFinite(t) && t >= start && t < end;
		});
		add("surface_win_pct_52w", yr.length ? 100 * yr.filter((r) => r.won === "1").length / yr.length : null, yr.length);
		add("surface_matches_52w", yr.length, yr.length);
	}
	if (last10.length >= 6) {
		const p = last10.slice(0, Math.max(1, last10.length - 5)), q = last10.slice(-5), wp = (x) => 100 * x.filter((r) => r.won === "1").length / x.length;
		add("recent_performance_acceleration", wp(q) - wp(p), last10.length);
	}
	const conceded = last10.filter((r) => r.won === "1").map((r) => num$3(r.sets_against)).filter((x) => x !== null);
	add("avg_sets_conceded_in_recent_wins", mean$2(conceded), conceded.length);
	const margins = recent.map((r) => {
		const sf = num$3(r.sets_for), sa = num$3(r.sets_against);
		return sf !== null && sa !== null ? sf - sa : null;
	}).filter((x) => x !== null);
	add("set_margin_mean", mean$2(margins), margins.length);
	add("performance_variance", sd$1(margins), margins.length);
	if (margins.length) add("performance_floor_ceiling_set_margin_range", Math.max(...margins) - Math.min(...margins), margins.length);
	const close = recent.filter((r) => {
		const sf = num$3(r.sets_for), sa = num$3(r.sets_against);
		return sf !== null && sa !== null && (sf + sa === 3 || sf + sa === 5);
	});
	add("deciding_match_reliance_pct", recent.length ? 100 * close.length / recent.length : null, recent.length);
	add("close_match_win_pct", close.length ? 100 * close.filter((r) => r.won === "1").length / close.length : null, close.length);
	const deltas = recent.map((r) => {
		const a = num$3(r.elo_pre), b = num$3(r.elo_post);
		return a !== null && b !== null ? b - a : null;
	}).filter((x) => x !== null);
	if (deltas.length) {
		add("recent_elo_delta_mean", mean$2(deltas), deltas.length);
		add("recent_elo_delta_variance", sd$1(deltas), deltas.length);
		add("recent_elo_best_delta", Math.max(...deltas), deltas.length);
		add("recent_elo_worst_delta", Math.min(...deltas), deltas.length);
		add("floor_ceiling_elo_range", Math.max(...deltas) - Math.min(...deltas), deltas.length);
	}
	const comparable = recent.filter((r) => {
		const own = num$3(r.elo_pre), oe = oppElo$1(all, r.opponent ?? "", r.date ?? "", surf);
		return own !== null && oe !== null && Math.abs(own - oe) <= 100;
	});
	add("comparable_strength_win_pct", comparable.length ? 100 * comparable.filter((r) => r.won === "1").length / comparable.length : null, comparable.length);
	let weakerOpp = 0, weakerLoss = 0;
	for (const r of recent) {
		const own = num$3(r.elo_pre), oe = oppElo$1(all, r.opponent ?? "", r.date ?? "", surf);
		if (own !== null && oe !== null && own - oe >= 100) {
			weakerOpp++;
			if (r.won === "0") weakerLoss++;
		}
	}
	add("upset_resistance_pct", weakerOpp ? 100 * (1 - weakerLoss / weakerOpp) : null, weakerOpp);
	const comparableStraightWins = comparable.filter((r) => r.won === "1" && num$3(r.sets_against) === 0).length;
	add("straight_set_match_win_pct_comparable", comparable.length ? 100 * comparableStraightWins / comparable.length : null, comparable.length);
	if (cut) {
		const end = Date.parse(`${cut}T00:00:00Z`), start = end - 12096e5, q = rows.filter((r) => {
			const t = Date.parse(`${r.date}T00:00:00Z`);
			return Number.isFinite(t) && t >= start && t < end && /qual|q[1-3]?/i.test(r.round ?? "");
		});
		add("qualifying_matches_last_14_days", q.length, q.length);
	}
	return out;
}
var SOURCE_URL$9 = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
var SOURCE_NAME$11 = "PredixSport public tennis ratings (CC BY 4.0)";
var WTA_SOURCE_NAME = "PredixSport public tennis ratings (CC BY 4.0) -- WTA elo-only index";
var cache$6 = null;
var wtaCache$1 = null;
function norm$12(v) {
	return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function num$2(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}
function parse$6(text) {
	const rows = [];
	let r = [], c = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const x = text[i];
		if (x === "\"") {
			if (q && text[i + 1] === "\"") {
				c += "\"";
				i++;
			} else q = !q;
		} else if (x === "," && !q) {
			r.push(c);
			c = "";
		} else if ((x === "\n" || x === "\r") && !q) {
			if (x === "\r" && text[i + 1] === "\n") i++;
			r.push(c);
			c = "";
			if (r.some(Boolean)) rows.push(r);
			r = [];
		} else c += x;
	}
	if (c || r.length) {
		r.push(c);
		rows.push(r);
	}
	if (!rows.length) return [];
	const h = rows[0].map((x) => x.trim());
	return rows.slice(1).map((a) => Object.fromEntries(h.map((k, i) => [k, (a[i] ?? "").trim()])));
}
function load$10() {
	if (cache$6) return cache$6;
	try {
		return cache$6 = parse$6(readFileSync(join(process.cwd(), "data/public/predixsport/atp/atp_elo_matches.csv"), "utf8"));
	} catch {
		return [];
	}
}
function loadWta() {
	if (wtaCache$1) return wtaCache$1;
	try {
		return wtaCache$1 = parse$6(readFileSync(join(process.cwd(), "data/public/predixsport/wta/wta_elo_ratings.csv"), "utf8"));
	} catch {
		return [];
	}
}
function cut$5(ctx) {
	return ctx.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function surf$2(ctx) {
	return ctx.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase() ?? null;
}
function stat$11(p, k, v, n, s, sourceName = SOURCE_NAME$11) {
	return {
		key: k,
		player: p,
		value: v,
		surface: s,
		window: "PRE_MATCH_HISTORY",
		tour_level: null,
		sample: n,
		origin: "RECONSTRUCTED",
		sources: [{
			source_name: sourceName,
			url: SOURCE_URL$9,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	};
}
function getStrengthTrajectoryStats(player, context) {
	const all = load$10(), pn = norm$12(player), c = cut$5(context), s = surf$2(context);
	if (!c) return [];
	const rows = all.filter((r) => norm$12(r.player ?? "") === pn && isBeforeCutoff(r.date, c)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
	if (rows.length) return atpStats(player, rows, s);
	const wtaRows = loadWta().filter((r) => norm$12(r.player ?? "") === pn && isBeforeCutoff(r.date, c)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
	if (!wtaRows.length) return [];
	return wtaEloOnlyStats(player, wtaRows, s);
}
function atpStats(player, rows, s) {
	const eloRows = rows.filter((r) => num$2(r.elo_pre) !== null), out = [];
	if (!eloRows.length) return out;
	const current = num$2(eloRows[eloRows.length - 1].elo_pre);
	const vals = eloRows.map((r) => num$2(r.elo_pre)).filter(Number.isFinite), peak = Math.max(...vals), low = Math.min(...vals);
	out.push(stat$11(player, "current_overall_elo", current, eloRows.length, s), stat$11(player, "career_observed_peak_elo", peak, eloRows.length, s), stat$11(player, "career_observed_low_elo", low, eloRows.length, s), stat$11(player, "elo_below_peak", peak - current, eloRows.length, s));
	const recent = eloRows.slice(-20), first = num$2(recent[0].elo_pre), last = num$2(recent[recent.length - 1].elo_pre);
	out.push(stat$11(player, "elo_change_last20", last - first, recent.length, s));
	if (recent.length > 1) out.push(stat$11(player, "elo_change_per_match_last20", (last - first) / (recent.length - 1), recent.length, s));
	for (const size of [5, 10]) {
		const a = eloRows.slice(-size);
		if (a.length >= 2) {
			const x = num$2(a[0].elo_pre), y = num$2(a[a.length - 1].elo_pre);
			out.push(stat$11(player, `elo_change_last${size}`, y - x, a.length, s));
		}
	}
	if (s) {
		const sr = rows.filter((r) => (r.surface ?? "").toLowerCase() === s && num$2(r.elo_pre) !== null);
		if (sr.length) {
			const sv = sr.map((r) => num$2(r.elo_pre)), cur = sv[sv.length - 1], pk = Math.max(...sv);
			out.push(stat$11(player, "current_surface_elo", cur, sr.length, s), stat$11(player, "observed_peak_surface_elo", pk, sr.length, s), stat$11(player, "surface_elo_below_peak", pk - cur, sr.length, s));
			const r10 = sr.slice(-10);
			if (r10.length >= 2) out.push(stat$11(player, "surface_elo_change_last10", num$2(r10[r10.length - 1].elo_pre) - num$2(r10[0].elo_pre), r10.length, s));
		}
	}
	const recentMatches = rows.slice(-20), wins = recentMatches.filter((r) => r.won === "1").length;
	out.push(stat$11(player, "overall_recent20_win_pct", 100 * wins / recentMatches.length, recentMatches.length, s));
	return out;
}
function wtaEloOnlyStats(player, rows, s) {
	const eloRows = rows.filter((r) => num$2(r.elo) !== null), out = [];
	if (!eloRows.length) return out;
	const current = num$2(eloRows[eloRows.length - 1].elo);
	const vals = eloRows.map((r) => num$2(r.elo)).filter(Number.isFinite), peak = Math.max(...vals), low = Math.min(...vals);
	out.push(stat$11(player, "current_overall_elo", current, eloRows.length, s, WTA_SOURCE_NAME), stat$11(player, "career_observed_peak_elo", peak, eloRows.length, s, WTA_SOURCE_NAME), stat$11(player, "career_observed_low_elo", low, eloRows.length, s, WTA_SOURCE_NAME), stat$11(player, "elo_below_peak", peak - current, eloRows.length, s, WTA_SOURCE_NAME));
	const recent = eloRows.slice(-20), first = num$2(recent[0].elo), last = num$2(recent[recent.length - 1].elo);
	out.push(stat$11(player, "elo_change_last20", last - first, recent.length, s, WTA_SOURCE_NAME));
	if (recent.length > 1) out.push(stat$11(player, "elo_change_per_match_last20", (last - first) / (recent.length - 1), recent.length, s, WTA_SOURCE_NAME));
	for (const size of [5, 10]) {
		const a = eloRows.slice(-size);
		if (a.length >= 2) {
			const x = num$2(a[0].elo), y = num$2(a[a.length - 1].elo);
			out.push(stat$11(player, `elo_change_last${size}`, y - x, a.length, s, WTA_SOURCE_NAME));
		}
	}
	if (s) {
		const sr = rows.filter((r) => (r.surface ?? "").toLowerCase() === s && num$2(r.elo) !== null);
		if (sr.length) {
			const sv = sr.map((r) => num$2(r.elo)), cur = sv[sv.length - 1], pk = Math.max(...sv);
			out.push(stat$11(player, "current_surface_elo", cur, sr.length, s, WTA_SOURCE_NAME), stat$11(player, "observed_peak_surface_elo", pk, sr.length, s, WTA_SOURCE_NAME), stat$11(player, "surface_elo_below_peak", pk - cur, sr.length, s, WTA_SOURCE_NAME));
			const r10 = sr.slice(-10);
			if (r10.length >= 2) out.push(stat$11(player, "surface_elo_change_last10", num$2(r10[r10.length - 1].elo) - num$2(r10[0].elo), r10.length, s, WTA_SOURCE_NAME));
		}
	}
	return out;
}
/**
* Ranking-performance context that is safe without an official ranking feed.
* IMPORTANT: Elo is NOT an ATP/WTA ranking. This module never labels Elo as rank.
* It reconstructs performance-vs-strength signals only. Official rank/ranking points
* remain unavailable until a commercially compatible ranking source is connected.
*/
function getRankingPerformanceStats(player, context) {
	const all = [...getStrengthTrajectoryStats(player, context), ...getDerivedHistoricalStats(player, context)];
	const by = new Map(all.map((s) => [s.key, s]));
	const out = [];
	const base = by.get("current_overall_elo") ?? by.get("current_surface_elo") ?? null;
	const add = (key, value, sample) => {
		if (value === null || !Number.isFinite(value) || !base) return;
		out.push({
			...base,
			key,
			value,
			sample,
			origin: "RECONSTRUCTED"
		});
	};
	const cur = by.get("current_overall_elo")?.value ?? null, peak = by.get("career_observed_peak_elo")?.value ?? null;
	const form20 = by.get("overall_recent20_win_pct")?.value ?? null, comp = by.get("comparable_strength_win_pct")?.value ?? null;
	const surface52 = by.get("surface_win_pct_52w")?.value ?? null, trend = by.get("elo_change_last20")?.value ?? null;
	add("strength_vs_peak_pct", cur !== null && peak && peak > 0 ? 100 * cur / peak : null, by.get("current_overall_elo")?.sample ?? 0);
	add("performance_vs_comparable_strength_pct", comp, by.get("comparable_strength_win_pct")?.sample ?? 0);
	add("recent_form_strength_signal", form20 !== null && trend !== null ? form20 + Math.max(-20, Math.min(20, trend / 5)) : null, by.get("overall_recent20_win_pct")?.sample ?? 0);
	add("surface_performance_strength_signal", surface52 !== null && cur !== null ? surface52 + (cur - 1500) / 50 : null, by.get("surface_win_pct_52w")?.sample ?? 0);
	add("favorite_fragility_strength_gap", peak !== null && cur !== null ? peak - cur : null, by.get("career_observed_peak_elo")?.sample ?? 0);
	add("observed_vs_expected_wl_gap_pct", form20 !== null && comp !== null ? form20 - comp : null, Math.min(by.get("overall_recent20_win_pct")?.sample ?? 0, by.get("comparable_strength_win_pct")?.sample ?? 0));
	return out;
}
var SOURCE_URL$8 = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
var SOURCE_NAME$10 = "PredixSport public tennis ratings (CC BY 4.0)";
var cache$5 = null;
function norm$11(v) {
	return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function parse$5(text) {
	const rs = [];
	let r = [], c = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const x = text[i];
		if (x === "\"") {
			if (q && text[i + 1] === "\"") {
				c += "\"";
				i++;
			} else q = !q;
		} else if (x === "," && !q) {
			r.push(c);
			c = "";
		} else if ((x === "\n" || x === "\r") && !q) {
			if (x === "\r" && text[i + 1] === "\n") i++;
			r.push(c);
			c = "";
			if (r.some(Boolean)) rs.push(r);
			r = [];
		} else c += x;
	}
	if (c || r.length) {
		r.push(c);
		rs.push(r);
	}
	if (!rs.length) return [];
	const h = rs[0];
	return rs.slice(1).map((a) => Object.fromEntries(h.map((k, i) => [k.trim(), (a[i] ?? "").trim()])));
}
function load$9() {
	if (cache$5) return cache$5;
	try {
		return cache$5 = parse$5(readFileSync(join(process.cwd(), "data/public/predixsport/atp/atp_elo_matches.csv"), "utf8"));
	} catch {
		return [];
	}
}
function cut$4(ctx) {
	return ctx.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function surf$1(ctx) {
	return ctx.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase() ?? null;
}
function stat$10(p, k, v, n, s) {
	return {
		key: k,
		player: p,
		value: v,
		surface: s,
		window: "PRE_MATCH_HISTORY",
		tour_level: null,
		sample: n,
		origin: "RECONSTRUCTED",
		sources: [{
			source_name: SOURCE_NAME$10,
			url: SOURCE_URL$8,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	};
}
function getH2HStats(player, opponent, context) {
	const rows = load$9(), c = cut$4(context), s = surf$1(context), pn = norm$11(player), on = norm$11(opponent);
	if (!c) return [];
	let h = rows.filter((r) => norm$11(r.player ?? "") === pn && norm$11(r.opponent ?? "") === on && isBeforeCutoff(r.date, c));
	if (!h.length) return [];
	const all = h, w = all.filter((r) => r.won === "1").length, out = [
		stat$10(player, "h2h_matches", all.length, all.length, s),
		stat$10(player, "h2h_wins", w, all.length, s),
		stat$10(player, "h2h_win_pct", 100 * w / all.length, all.length, s)
	];
	if (s) {
		h = all.filter((r) => (r.surface ?? "").toLowerCase() === s);
		if (h.length) {
			const sw = h.filter((r) => r.won === "1").length;
			out.push(stat$10(player, "h2h_surface_matches", h.length, h.length, s), stat$10(player, "h2h_surface_wins", sw, h.length, s), stat$10(player, "h2h_surface_win_pct", 100 * sw / h.length, h.length, s));
		}
	}
	const recent = all.slice(-3), rw = recent.filter((r) => r.won === "1").length;
	out.push(stat$10(player, "h2h_recent3_win_pct", 100 * rw / recent.length, recent.length, s));
	return out;
}
var SOURCE_URL$7 = "https://datahub.io/core/atp-world-tour-tennis-data";
var SOURCE_NAME$9 = "DataHub ATP World Tour tennis data (CC BY 4.0)";
var HISTORICAL_MIN_YEAR$1 = 2005;
var matchesCache = null;
function norm$10(v) {
	return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tokens$1(v) {
	return norm$10(v).split(" ").filter(Boolean);
}
function n$2(v) {
	const x = Number(v);
	return Number.isFinite(x) ? x : null;
}
function parseCsv$3(text) {
	const rows = [];
	let row = [], cell = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === "\"") {
			if (q && text[i + 1] === "\"") {
				cell += "\"";
				i++;
			} else q = !q;
		} else if (ch === "," && !q) {
			row.push(cell);
			cell = "";
		} else if ((ch === "\n" || ch === "\r") && !q) {
			if (ch === "\r" && text[i + 1] === "\n") i++;
			row.push(cell);
			cell = "";
			if (row.some(Boolean)) rows.push(row);
			row = [];
		} else cell += ch;
	}
	if (cell || row.length) {
		row.push(cell);
		rows.push(row);
	}
	if (!rows.length) return [];
	const h = rows[0].map((x) => x.trim());
	return rows.slice(1).map((c) => Object.fromEntries(h.map((k, i) => [k, (c[i] ?? "").trim()])));
}
function yearOf$1(r) {
	return Number((r.tourney_year_id ?? "").slice(0, 4));
}
function availableFiles(prefix) {
	const dir = join(process.cwd(), "data/public/datahub-atp");
	return [
		`${prefix}_1991-2016.csv`,
		`${prefix}_2017.csv`,
		`${prefix}_2018.csv`
	].filter((f) => existsSync(join(dir, f)));
}
function load$8() {
	if (matchesCache) return matchesCache;
	try {
		const dir = join(process.cwd(), "data/public/datahub-atp"), scoreFiles = availableFiles("match_scores"), statFiles = availableFiles("match_stats"), scores = scoreFiles.flatMap((f) => parseCsv$3(readFileSync(join(dir, f), "utf8"))).filter((r) => yearOf$1(r) >= HISTORICAL_MIN_YEAR$1), stats = statFiles.flatMap((f) => parseCsv$3(readFileSync(join(dir, f), "utf8"))), sm = new Map(scores.map((r) => [r.match_id, r]));
		matchesCache = stats.map((r) => ({
			score: sm.get(r.match_id),
			stats: r
		})).filter((x) => !!x.score);
		return matchesCache;
	} catch {
		return matchesCache = [];
	}
}
function resolveName(input, matches) {
	const names = [...new Set(matches.flatMap((m) => [m.score.winner_name, m.score.loser_name]).filter(Boolean))], needle = norm$10(input), exact = names.filter((x) => norm$10(x) === needle);
	if (exact.length === 1) return exact[0];
	const req = tokens$1(input), last = req[req.length - 1];
	if (!last) return null;
	const c = names.filter((x) => {
		const t = tokens$1(x);
		if (t[t.length - 1] !== last) return false;
		const s = new Set(t);
		return req.length === 1 || req.every((v) => s.has(v));
	});
	return c.length === 1 ? c[0] : null;
}
function cutoffYear$1(context) {
	const m = context.match(/(?:date\s+)?(20\d{2})-\d{2}-\d{2}/i);
	return m ? Number(m[1]) : null;
}
function stat$9(player, key, value, sample, maxYear) {
	return {
		key,
		player,
		value,
		surface: null,
		window: `HISTORICAL_2005_THROUGH_${maxYear}`,
		tour_level: null,
		sample,
		origin: "RECONSTRUCTED",
		sources: [{
			source_name: SOURCE_NAME$9,
			url: SOURCE_URL$7,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	};
}
function addRatio(out, player, key, a, b, sample, maxYear) {
	if (b > 0) out.push(stat$9(player, key, 100 * a / b, sample, maxYear));
}
function getHistoricalServeReturnStats(player, context) {
	const all = load$8(), canonical = resolveName(player, all);
	if (!canonical) return [];
	const cy = cutoffYear$1(context);
	const ms = all.filter((m) => {
		const year = yearOf$1(m.score);
		if (year < HISTORICAL_MIN_YEAR$1 || cy && year >= cy) return false;
		return m.score.winner_name === canonical || m.score.loser_name === canonical;
	});
	if (!ms.length) return [];
	const maxYear = Math.max(...ms.map((m) => yearOf$1(m.score)));
	let ace = 0, df = 0, fsIn = 0, fsTot = 0, fsWon = 0, fsPts = 0, ssWon = 0, ssPts = 0, bpSaved = 0, bpServe = 0, spWon = 0, spTot = 0, frWon = 0, frTot = 0, srWon = 0, srTot = 0, bpConv = 0, bpRet = 0, svcGames = 0, retGames = 0, retWon = 0, retTot = 0, tpWon = 0, tpTot = 0, breaksAgainst = 0;
	for (const m of ms) {
		const winner = m.score.winner_name === canonical, p = winner ? "winner_" : "loser_", o = winner ? "loser_" : "winner_", r = m.stats;
		const val = (k) => n$2(r[p + k]) ?? 0, oval = (k) => n$2(r[o + k]) ?? 0;
		ace += val("aces");
		df += val("double_faults");
		fsIn += val("first_serves_in");
		fsTot += val("first_serves_total");
		fsWon += val("first_serve_points_won");
		fsPts += val("first_serve_points_total");
		ssWon += val("second_serve_points_won");
		ssPts += val("second_serve_points_total");
		bpSaved += val("break_points_saved");
		bpServe += val("break_points_serve_total");
		spWon += val("service_points_won");
		spTot += val("service_points_total");
		frWon += val("first_serve_return_won");
		frTot += val("first_serve_return_total");
		srWon += val("second_serve_return_won");
		srTot += val("second_serve_return_total");
		bpConv += val("break_points_converted");
		bpRet += val("break_points_return_total");
		svcGames += val("service_games_played");
		retGames += val("return_games_played");
		retWon += val("return_points_won");
		retTot += val("return_points_total");
		tpWon += val("total_points_won");
		tpTot += val("total_points_total");
		breaksAgainst += oval("break_points_converted");
	}
	const out = [], sample = ms.length;
	addRatio(out, player, "service_points_won_pct", spWon, spTot, sample, maxYear);
	addRatio(out, player, "first_serve_in_pct", fsIn, fsTot, sample, maxYear);
	addRatio(out, player, "first_serve_points_won_pct", fsWon, fsPts, sample, maxYear);
	addRatio(out, player, "second_serve_points_won_pct", ssWon, ssPts, sample, maxYear);
	addRatio(out, player, "ace_rate_pct", ace, spTot, sample, maxYear);
	addRatio(out, player, "double_fault_rate_pct", df, spTot, sample, maxYear);
	addRatio(out, player, "break_points_saved_pct", bpSaved, bpServe, sample, maxYear);
	addRatio(out, player, "return_points_won_pct", retWon, retTot, sample, maxYear);
	addRatio(out, player, "first_serve_return_points_won_pct", frWon, frTot, sample, maxYear);
	addRatio(out, player, "second_serve_return_points_won_pct", srWon, srTot, sample, maxYear);
	addRatio(out, player, "break_point_conversion_pct", bpConv, bpRet, sample, maxYear);
	addRatio(out, player, "hold_pct", Math.max(0, svcGames - breaksAgainst), svcGames, sample, maxYear);
	addRatio(out, player, "break_pct", bpConv, retGames, sample, maxYear);
	addRatio(out, player, "total_points_won_pct", tpWon, tpTot, sample, maxYear);
	if (svcGames > 0) out.push(stat$9(player, "service_games_held", Math.max(0, svcGames - breaksAgainst), sample, maxYear));
	if (retGames > 0) out.push(stat$9(player, "return_games_played", retGames, sample, maxYear));
	if (bpRet > 0 && retGames > 0) out.push(stat$9(player, "break_points_created_per_return_game", bpRet / retGames, sample, maxYear));
	return out;
}
var SOURCE_URL$6 = "https://datahub.io/core/atp-world-tour-tennis-data";
var SOURCE_NAME$8 = "DataHub ATP World Tour tennis data (CC BY 4.0)";
var HISTORICAL_MIN_YEAR = 2005;
var cache$4 = null;
function norm$9(v) {
	return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function parse$4(text) {
	const rows = [];
	let r = [], c = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const x = text[i];
		if (x === "\"") {
			if (q && text[i + 1] === "\"") {
				c += "\"";
				i++;
			} else q = !q;
		} else if (x === "," && !q) {
			r.push(c);
			c = "";
		} else if ((x === "\n" || x === "\r") && !q) {
			if (x === "\r" && text[i + 1] === "\n") i++;
			r.push(c);
			c = "";
			if (r.some(Boolean)) rows.push(r);
			r = [];
		} else c += x;
	}
	if (c || r.length) {
		r.push(c);
		rows.push(r);
	}
	if (!rows.length) return [];
	const h = rows[0].map((x) => x.trim());
	return rows.slice(1).map((a) => Object.fromEntries(h.map((k, i) => [k, (a[i] ?? "").trim()])));
}
function yearOf(r) {
	return Number((r.tourney_year_id ?? "").slice(0, 4));
}
function load$7() {
	if (cache$4) return cache$4;
	try {
		return cache$4 = ["match_scores_1991-2016.csv", "match_scores_2017.csv"].flatMap((f) => parse$4(readFileSync(join(process.cwd(), "data/public/datahub-atp", f), "utf8"))).filter((r) => yearOf(r) >= HISTORICAL_MIN_YEAR);
	} catch {
		return [];
	}
}
function cutoffYear(context) {
	const m = context.match(/(?:date\s+)?(20\d{2})-\d{2}-\d{2}/i);
	return m ? Number(m[1]) : null;
}
function stat$8(p, k, v, n) {
	return {
		key: k,
		player: p,
		value: v,
		surface: null,
		window: "HISTORICAL_2005_THROUGH_2017",
		tour_level: null,
		sample: n,
		origin: "RECONSTRUCTED",
		sources: [{
			source_name: SOURCE_NAME$8,
			url: SOURCE_URL$6,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	};
}
function parseDataHubSets(score) {
	return score.split(/\s+/).map((s) => s.trim()).filter(Boolean).map((s) => {
		const hyphen = s.match(/^(\d+)-(\d+)/);
		if (hyphen) {
			const a = Number(hyphen[1]), b = Number(hyphen[2]);
			return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
		}
		const compact = s.match(/^(\d)(\d)(?:\([^)]*\))?$/);
		if (compact) return [Number(compact[1]), Number(compact[2])];
		return null;
	}).filter((x) => !!x);
}
function n$1(v) {
	const x = Number(v);
	return Number.isFinite(x) ? x : null;
}
function isDecidingMatch(row) {
	const w = n$1(row.winner_sets_won), l = n$1(row.loser_sets_won);
	return w === 2 && l === 1 || w === 3 && l === 2;
}
function hasTiebreak(sets) {
	return sets.some(([a, b]) => a === 7 && b === 6 || a === 6 && b === 7);
}
function hasNarrowSet(sets) {
	return sets.some(([a, b]) => Math.max(a, b) >= 7 && Math.abs(a - b) <= 2);
}
function computeHistoricalScoreProfileStatsFromRows(rows, player, context) {
	const pn = norm$9(player), cy = cutoffYear(context);
	const ms = rows.filter((r) => {
		const y = yearOf(r);
		return y >= HISTORICAL_MIN_YEAR && (!cy || y < cy) && (norm$9(r.winner_name ?? "") === pn || norm$9(r.loser_name ?? "") === pn);
	});
	if (!ms.length) return [];
	let s1 = 0, s1w = 0, s2 = 0, s2w = 0, afterLoss = 0, afterLossW = 0, afterWin = 0, afterWinW = 0, secondAfterLoss = 0, secondAfterLossW = 0, tb = 0, tbw = 0, deciding = 0, decidingW = 0, straightWins = 0, wins = 0, parsedMatches = 0, closeDependentWins = 0, decidingOrTbWins = 0;
	for (const m of ms) {
		const isW = norm$9(m.winner_name ?? "") === pn;
		const ss = parseDataHubSets(m.match_score_tiebreaks ?? "");
		if (!ss.length) continue;
		parsedMatches++;
		const view = ss.map(([a, b]) => isW ? [a, b] : [b, a]);
		if (view[0]) {
			s1++;
			if (view[0][0] > view[0][1]) s1w++;
		}
		if (view[1]) {
			s2++;
			if (view[1][0] > view[1][1]) s2w++;
		}
		if (view[0]) {
			if (view[0][0] < view[0][1]) {
				afterLoss++;
				if (isW) afterLossW++;
				if (view[1]) {
					secondAfterLoss++;
					if (view[1][0] > view[1][1]) secondAfterLossW++;
				}
			} else if (view[0][0] > view[0][1]) {
				afterWin++;
				if (isW) afterWinW++;
			}
		}
		for (const [a, b] of view) if (a === 7 && b === 6 || a === 6 && b === 7) {
			tb++;
			if (a > b) tbw++;
		}
		const decidingMatch = isDecidingMatch(m);
		if (decidingMatch && view.length) {
			deciding++;
			const d = view[view.length - 1];
			if (d[0] > d[1]) decidingW++;
		}
		if (isW) {
			wins++;
			if (view.every(([a, b]) => a > b)) straightWins++;
			if (decidingMatch || hasNarrowSet(view)) closeDependentWins++;
			if (decidingMatch || hasTiebreak(view)) decidingOrTbWins++;
		}
	}
	const out = [];
	const add = (k, a, b) => {
		if (b > 0) out.push(stat$8(player, k, 100 * a / b, b));
	};
	add("set1_win_pct", s1w, s1);
	add("set2_win_pct", s2w, s2);
	add("win_after_losing_set1_pct", afterLossW, afterLoss);
	add("win_after_winning_set1_pct", afterWinW, afterWin);
	add("second_set_after_losing_set1_win_pct", secondAfterLossW, secondAfterLoss);
	add("tiebreak_win_pct", tbw, tb);
	add("historical_deciding_set_win_pct", decidingW, deciding);
	add("set3_deciding_set_win_pct", decidingW, deciding);
	add("historical_straight_set_control_pct", straightWins, wins);
	add("straight_set_match_win_pct", straightWins, parsedMatches);
	add("close_match_dependency_pct", closeDependentWins, wins);
	add("deciding_tiebreak_win_reliance_pct", decidingOrTbWins, wins);
	if (tb > 0) out.push(stat$8(player, "tiebreaks_played", tb, tb));
	if (deciding > 0) out.push(stat$8(player, "deciding_matches_played", deciding, deciding));
	return out;
}
function getHistoricalScoreProfileStats(player, context) {
	return computeHistoricalScoreProfileStatsFromRows(load$7(), player, context);
}
function synthesizeDataHubRow(o) {
	const setScores = o.raw_payload.history_detail?.set_scores;
	if (!setScores || !setScores.length) return null;
	const winner = o.raw_payload.winner ?? null;
	if (winner !== o.player_name && winner !== o.opponent_name) return null;
	const playerWon = winner === o.player_name;
	const winnerOrientedSets = setScores.map(([a, b]) => playerWon ? [a, b] : [b, a]);
	if (winnerOrientedSets.some(([a, b]) => !Number.isFinite(a) || !Number.isFinite(b))) return null;
	const winnerSetsWon = winnerOrientedSets.filter(([a, b]) => a > b).length;
	const loserSetsWon = winnerOrientedSets.filter(([a, b]) => a < b).length;
	const year = (o.event_date ?? "").slice(0, 4);
	if (!/^\d{4}$/.test(year)) return null;
	return {
		tourney_year_id: `${year}-repo`,
		winner_name: winner,
		loser_name: playerWon ? o.opponent_name ?? "" : o.player_name,
		match_score_tiebreaks: winnerOrientedSets.map(([a, b]) => `${a}-${b}`).join(" "),
		winner_sets_won: String(winnerSetsWon),
		loser_sets_won: String(loserSetsWon)
	};
}
var FAMILIES_WITH_SET_SCORES = ["WTA_MAIN", "ATP_CHALLENGER"];
function mean$1(a) {
	return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
}
function sd(a) {
	const m = mean$1(a);
	return m === null || a.length < 2 ? null : Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}
function repositorySetMarginStats(player, family, asOfDate) {
	const margins = repositoryResultsRows(player, family, asOfDate, { strictBefore: true }).filter((o) => o.event_date).sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? "")).slice(-20).map((o) => {
		const setScores = o.raw_payload.history_detail?.set_scores;
		if (!setScores || !setScores.length) return null;
		return setScores.filter(([a, b]) => a > b).length - setScores.filter(([a, b]) => a < b).length;
	}).filter((x) => x !== null);
	if (!margins.length) return [];
	const out = [];
	const variance = sd(margins);
	if (variance !== null) out.push({
		key: "performance_variance",
		player,
		value: variance,
		surface: null,
		window: "PRE_MATCH_HISTORY",
		tour_level: null,
		sample: margins.length,
		origin: "RECONSTRUCTED",
		sources: [{
			source_name: `Repository ${family} history (set-margin variance)`,
			url: "",
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	});
	out.push({
		key: "performance_floor_ceiling_set_margin_range",
		player,
		value: Math.max(...margins) - Math.min(...margins),
		surface: null,
		window: "PRE_MATCH_HISTORY",
		tour_level: null,
		sample: margins.length,
		origin: "RECONSTRUCTED",
		sources: [{
			source_name: `Repository ${family} history (set-margin variance)`,
			url: "",
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	});
	return out;
}
function getRepositoryScoreProfileStats(player, context) {
	const family = classifyEvidenceTourFamily(context);
	if (!family || !FAMILIES_WITH_SET_SCORES.includes(family)) return [];
	const asOfDate = context.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1];
	if (!asOfDate) return [];
	const synthRows = repositoryResultsRows(player, family, asOfDate, { strictBefore: true }).map(synthesizeDataHubRow).filter((r) => r !== null);
	return [...synthRows.length ? computeHistoricalScoreProfileStatsFromRows(synthRows, player, `date ${asOfDate}`).map((s) => ({
		...s,
		sources: [{
			source_name: `Repository ${family} history (set-score profile)`,
			url: "",
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	})) : [], ...repositorySetMarginStats(player, family, asOfDate)];
}
function pick$1(stats, key) {
	return stats.find((s) => s.key === key)?.value ?? null;
}
function base(stats) {
	return stats[0] ?? null;
}
function statLike$1(src, key, value) {
	return {
		...src,
		key,
		value,
		origin: "RECONSTRUCTED"
	};
}
/**
* Matchup-specific efficiency reconstructed from each player's historical
* service/return rates. These are simple transparent interaction estimates,
* not model probabilities and not current-form stats.
*/
function getMatchupEfficiencyStats(player, opponent, context) {
	const p = getHistoricalServeReturnStats(player, context), o = getHistoricalServeReturnStats(opponent, context), src = base(p);
	if (!src) return [];
	const out = [];
	const pHold = pick$1(p, "hold_pct"), pBreak = pick$1(p, "break_pct"), pSPW = pick$1(p, "service_points_won_pct"), pRPW = pick$1(p, "return_points_won_pct");
	const oHold = pick$1(o, "hold_pct"), oBreak = pick$1(o, "break_pct"), oSPW = pick$1(o, "service_points_won_pct"), oRPW = pick$1(o, "return_points_won_pct");
	if (pHold !== null && oBreak !== null) out.push(statLike$1(src, "matchup_expected_hold_pct", (pHold + (100 - oBreak)) / 2));
	if (pBreak !== null && oHold !== null) out.push(statLike$1(src, "matchup_expected_break_pct", (pBreak + (100 - oHold)) / 2));
	const eh = out.find((s) => s.key === "matchup_expected_hold_pct")?.value ?? null, eb = out.find((s) => s.key === "matchup_expected_break_pct")?.value ?? null;
	if (eh !== null && eb !== null) out.push(statLike$1(src, "expected_hold_break_differential", eh - eb));
	if (pRPW !== null && oRPW !== null && oRPW > 0) out.push(statLike$1(src, "dominance_ratio", pRPW / oRPW));
	if (pSPW !== null && oRPW !== null) out.push(statLike$1(src, "serve_vs_opponent_return_edge", pSPW - (100 - oRPW)));
	if (pRPW !== null && oSPW !== null) out.push(statLike$1(src, "return_vs_opponent_serve_edge", pRPW - (100 - oSPW)));
	if (pSPW !== null && pRPW !== null) out.push(statLike$1(src, "combined_point_efficiency", pSPW + pRPW - 100));
	return out;
}
var SOURCE_URL$5 = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
var SOURCE_NAME$7 = "PredixSport public tennis ratings (CC BY 4.0)";
var cache$3 = null;
function norm$8(v) {
	return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function num$1(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}
function parse$3(text) {
	const rows = [];
	let r = [], c = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const x = text[i];
		if (x === "\"") {
			if (q && text[i + 1] === "\"") {
				c += "\"";
				i++;
			} else q = !q;
		} else if (x === "," && !q) {
			r.push(c);
			c = "";
		} else if ((x === "\n" || x === "\r") && !q) {
			if (x === "\r" && text[i + 1] === "\n") i++;
			r.push(c);
			c = "";
			if (r.some(Boolean)) rows.push(r);
			r = [];
		} else c += x;
	}
	if (c || r.length) {
		r.push(c);
		rows.push(r);
	}
	if (!rows.length) return [];
	const h = rows[0].map((x) => x.trim());
	return rows.slice(1).map((a) => Object.fromEntries(h.map((k, i) => [k, (a[i] ?? "").trim()])));
}
function load$6() {
	if (cache$3) return cache$3;
	try {
		return cache$3 = parse$3(readFileSync(join(process.cwd(), "data/public/predixsport/atp/atp_elo_matches.csv"), "utf8"));
	} catch {
		return [];
	}
}
function cut$3(c) {
	return c.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function surf(c) {
	return c.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase() ?? null;
}
function contextLevel(c) {
	return c.match(/(?:event_level|event level|level)\s+([^·|,]+)/i)?.[1]?.trim().toLowerCase() ?? null;
}
function rowLevel(r) {
	return (r.tournament_level ?? r.event_level ?? r.tour_level ?? r.level ?? "").trim().toLowerCase() || null;
}
function stat$7(p, k, v, n, s, sourceOverride) {
	return {
		key: k,
		player: p,
		value: v,
		surface: s,
		window: "PRE_MATCH_HISTORY",
		tour_level: null,
		sample: n,
		origin: "RECONSTRUCTED",
		sources: [{
			source_name: sourceOverride?.name ?? SOURCE_NAME$7,
			url: sourceOverride?.url ?? SOURCE_URL$5,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	};
}
function weight(d, c) {
	if (!d) return 0;
	const x = (Date.parse(`${c}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 864e5;
	return !Number.isFinite(x) || x < 0 ? 0 : Math.exp(-x / 365);
}
function before(r, c) {
	return isBeforeCutoff(r.date, c);
}
function sameSurface(r, s) {
	return !s || !!r.surface && r.surface.toLowerCase() === s;
}
function levelOk(r, l) {
	if (!l) return true;
	const a = rowLevel(r);
	return a !== null && a === l;
}
function oppElo(rows, opp, date) {
	if (!date) return null;
	const n = norm$8(opp), r = rows.filter((x) => norm$8(x.player ?? "") === n && isAtOrBeforeCutoff(x.date, date)).sort((a, b) => (a.date || "").localeCompare(b.date || "")), z = r[r.length - 1];
	return z ? num$1(z.elo_pre) ?? num$1(z.elo_post) : null;
}
function chain(rows, opp, c, s) {
	const n = norm$8(opp), h = rows.filter((r) => norm$8(r.player ?? "") === n && before(r, c) && sameSurface(r, s) && (r.won === "0" || r.won === "1"));
	return h.length ? 100 * h.filter((r) => r.won === "1").length / h.length : null;
}
var NO_COVERAGE = {
	directCommonOpponents: false,
	sharedWinLossComparison: false,
	scorelineComparison: "UNAVAILABLE",
	recencyWeighting: false,
	surfaceMatching: false,
	tournamentLevelMatching: false,
	opponentStrengthWeighting: false,
	transitiveChains: false
};
function computeEnhancedCommonOpponentStatsFromRows(all, player, opponent, context, sourceOverride) {
	const pn = norm$8(player), on = norm$8(opponent), c = cut$3(context), s = surf(context), l = contextLevel(context);
	if (!c) return {
		stats: [],
		coverage: NO_COVERAGE
	};
	const base = (r) => before(r, c) && sameSurface(r, s), pa = all.filter((r) => norm$8(r.player ?? "") === pn && base(r)), oa = all.filter((r) => norm$8(r.player ?? "") === on && base(r)), hasLevel = all.some((r) => rowLevel(r) !== null), applyLevel = !!l && hasLevel, pr = applyLevel ? pa.filter((r) => levelOk(r, l)) : pa, or = applyLevel ? oa.filter((r) => levelOk(r, l)) : oa, os = new Set(or.map((r) => norm$8(r.opponent ?? "")).filter(Boolean)), common = pr.filter((r) => os.has(norm$8(r.opponent ?? ""))), names = new Set(common.map((r) => norm$8(r.opponent ?? "")).filter(Boolean));
	const coverage = {
		directCommonOpponents: names.size > 0,
		sharedWinLossComparison: common.some((r) => r.won === "0" || r.won === "1"),
		scorelineComparison: common.some((r) => num$1(r.sets_for) !== null && num$1(r.sets_against) !== null) ? "SETS_ONLY" : "UNAVAILABLE",
		recencyWeighting: common.length > 0,
		surfaceMatching: !!s && common.length > 0,
		tournamentLevelMatching: applyLevel,
		opponentStrengthWeighting: false,
		transitiveChains: false
	};
	if (!common.length) return {
		stats: [],
		coverage
	};
	let rw = 0, rww = 0, sm = 0, smt = 0, sw = 0, swt = 0, cd = 0, cdt = 0;
	for (const r of common) {
		const w = weight(r.date ?? "", c);
		if (w <= 0) continue;
		rw += w;
		if (r.won === "1") rww += w;
		const sf = num$1(r.sets_for), sa = num$1(r.sets_against);
		if (sf !== null && sa !== null) {
			sm += w * (sf - sa);
			smt += w;
		}
		const e = oppElo(all, r.opponent ?? "", r.date ?? "");
		if (e !== null && (r.won === "0" || r.won === "1")) {
			const q = Math.max(.25, Math.min(2, e / 1500));
			sw += w * q * (r.won === "1" ? 1 : 0);
			swt += w * q;
			coverage.opponentStrengthWeighting = true;
		}
		const ch = chain(all, r.opponent ?? "", c, s);
		if (ch !== null) {
			cd += w * ch;
			cdt += w;
			coverage.transitiveChains = true;
		}
	}
	const out = [], wins = common.filter((r) => r.won === "1").length, losses = common.filter((r) => r.won === "0").length;
	out.push(stat$7(player, "direct_common_opponents", names.size, common.length, s, sourceOverride), stat$7(player, "common_opponent_matches", common.length, common.length, s, sourceOverride), stat$7(player, "common_opponent_wins", wins, common.length, s, sourceOverride), stat$7(player, "common_opponent_losses", losses, common.length, s, sourceOverride));
	if (wins + losses) out.push(stat$7(player, "common_opponent_win_pct", 100 * wins / (wins + losses), common.length, s, sourceOverride));
	if (rw) out.push(stat$7(player, "common_opponent_recency_weighted_win_pct", 100 * rww / rw, common.length, s, sourceOverride));
	if (smt) out.push(stat$7(player, "common_opponent_weighted_set_margin", sm / smt, common.length, s, sourceOverride));
	if (swt) out.push(stat$7(player, "common_opponent_strength_weighted_win_pct", 100 * sw / swt, common.length, s, sourceOverride));
	if (cdt) out.push(stat$7(player, "common_opponent_second_degree_strength_pct", cd / cdt, common.length, s, sourceOverride));
	out.push(stat$7(player, "surface_matched_common_opponents", names.size, common.length, s, sourceOverride));
	if (applyLevel) out.push(stat$7(player, "tournament_level_matched_common_opponents", names.size, common.length, s, sourceOverride));
	return {
		stats: out,
		coverage
	};
}
function toFlatRow(o) {
	const detail = o.raw_payload.history_detail ?? {};
	const winner = o.raw_payload.winner ?? null;
	const won = winner === o.player_name ? "1" : winner === o.opponent_name ? "0" : "";
	return {
		player: o.player_name,
		opponent: o.opponent_name ?? "",
		date: o.event_date ?? "",
		surface: o.surface ?? "",
		won,
		sets_for: detail.sets_for != null ? String(detail.sets_for) : "",
		sets_against: detail.sets_against != null ? String(detail.sets_against) : ""
	};
}
function repositoryFallbackCommonOpponentRows(player, opponent, context) {
	const c = cut$3(context);
	if (!c) return [];
	const family = classifyEvidenceTourFamily(context);
	if (!family) return [];
	const playerRows = repositoryResultsRows(player, family, c, { strictBefore: true }), opponentRows = repositoryResultsRows(opponent, family, c, { strictBefore: true });
	return [...playerRows, ...opponentRows].map(toFlatRow);
}
var REPOSITORY_SOURCE = {
	name: "Repository match-results history (all tours, WTA-inclusive fallback)",
	url: ""
};
function getEnhancedCommonOpponentStats(p, o, c) {
	const primary = computeEnhancedCommonOpponentStatsFromRows(load$6(), p, o, c).stats;
	if (primary.length) return primary;
	const fallbackRows = repositoryFallbackCommonOpponentRows(p, o, c);
	if (!fallbackRows.length) return [];
	return computeEnhancedCommonOpponentStatsFromRows(fallbackRows, p, o, c, REPOSITORY_SOURCE).stats;
}
var SOURCE_URL$4 = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
var SOURCE_NAME$6 = "PredixSport public tennis ratings (CC BY 4.0)";
var atpCache = null;
var wtaCache = null;
function norm$7(v) {
	return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function parse$2(text) {
	const rows = [];
	let r = [], c = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const x = text[i];
		if (x === "\"") {
			if (q && text[i + 1] === "\"") {
				c += "\"";
				i++;
			} else q = !q;
		} else if (x === "," && !q) {
			r.push(c);
			c = "";
		} else if ((x === "\n" || x === "\r") && !q) {
			if (x === "\r" && text[i + 1] === "\n") i++;
			r.push(c);
			c = "";
			if (r.some(Boolean)) rows.push(r);
			r = [];
		} else c += x;
	}
	if (c || r.length) {
		r.push(c);
		rows.push(r);
	}
	if (!rows.length) return [];
	const h = rows[0].map((x) => x.trim());
	return rows.slice(1).map((a) => Object.fromEntries(h.map((k, i) => [k, (a[i] ?? "").trim()])));
}
function load$5(kind) {
	try {
		if (kind === "ATP") {
			if (atpCache) return atpCache;
			return atpCache = parse$2(readFileSync(join(process.cwd(), "data/public/predixsport/atp/atp_elo_matches.csv"), "utf8"));
		}
		if (wtaCache) return wtaCache;
		return wtaCache = parse$2(readFileSync(join(process.cwd(), "data/public/predixsport/wta/wta_elo_ratings.csv"), "utf8"));
	} catch {
		return [];
	}
}
function cutoff$2(ctx) {
	return ctx.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function stat$6(player, key, value, sample) {
	return {
		key,
		player,
		value,
		surface: null,
		window: "PRE_MATCH_HISTORY",
		tour_level: null,
		sample,
		origin: "RECONSTRUCTED",
		sources: [{
			source_name: SOURCE_NAME$6,
			url: SOURCE_URL$4,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	};
}
function matchesAbbreviatedKey(indexKey, player) {
	const keyTokens = norm$7(indexKey).split(" ").filter(Boolean), nameTokens = norm$7(player).split(" ").filter(Boolean);
	if (keyTokens.length < 2 || nameTokens.length < 2) return false;
	const initial = keyTokens[keyTokens.length - 1];
	if (initial.length !== 1) return false;
	const surname = keyTokens.slice(0, -1).join(" ");
	const givenInitial = nameTokens[0][0];
	return surname === nameTokens.slice(1).join(" ") && initial === givenInitial;
}
function indexHistoryRows(player) {
	const key = norm$7(player);
	const out = [];
	const history = loadRuntimeIndex().matchHistory;
	for (const lane of Object.keys(history ?? {})) for (const [playerKey, entries] of Object.entries(history[lane] ?? {})) {
		if (norm$7(playerKey) !== key && !matchesAbbreviatedKey(playerKey, player) || !Array.isArray(entries)) continue;
		for (const entry of entries) {
			if (!Array.isArray(entry)) continue;
			const [dateRaw, tournamentRaw, surfaceRaw, opponentRaw, wonRaw] = entry;
			const date = String(dateRaw ?? "").slice(0, 10);
			if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || wonRaw !== 0 && wonRaw !== 1) continue;
			out.push({
				date,
				player,
				opponent: String(opponentRaw ?? ""),
				tournament: String(tournamentRaw ?? ""),
				surface: String(surfaceRaw ?? ""),
				won: String(wonRaw)
			});
		}
	}
	const seen = /* @__PURE__ */ new Set();
	return out.filter((r) => {
		const k = `${r.date}|${norm$7(r.opponent ?? "")}`;
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	}).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}
function playerRows(player) {
	const n = norm$7(player), atp = load$5("ATP").filter((r) => norm$7(r.player ?? "") === n);
	if (atp.length) return atp;
	const wta = load$5("WTA").filter((r) => norm$7(r.player ?? "") === n);
	if (!wta.some((r) => r.won === "0" || r.won === "1")) {
		const reconstructed = indexHistoryRows(player);
		if (reconstructed.length) return reconstructed;
	}
	return wta;
}
function dateMs(s) {
	const t = Date.parse(`${s}T00:00:00Z`);
	return Number.isFinite(t) ? t : null;
}
function crossesCalendarYearBoundary$1(earlierDate, laterDate) {
	return earlierDate.slice(0, 4) !== laterDate.slice(0, 4);
}
function computeAvailabilityStatsFromRows(rows, player, c) {
	if (!c) return [];
	rows = [...rows].filter((r) => isBeforeCutoff(r.date, c)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
	if (!rows.length || !c) return [];
	const out = [], end = dateMs(c), last = rows[rows.length - 1], lastMs = last?.date ? dateMs(last.date) : null;
	if (end !== null && lastMs !== null) out.push(stat$6(player, "days_since_last_match", Math.max(0, (end - lastMs) / 864e5), 1));
	let longest = 0, recentGap = 0, gapsOver30 = 0, gapsOver60 = 0, gapsOver90 = 0, inSeasonGaps = 0;
	for (let i = 1; i < rows.length; i++) {
		const a = dateMs(rows[i - 1].date ?? ""), b = dateMs(rows[i].date ?? "");
		if (a === null || b === null) continue;
		const d = (b - a) / 864e5;
		recentGap = d;
		if (crossesCalendarYearBoundary$1(rows[i - 1].date ?? "", rows[i].date ?? "")) continue;
		inSeasonGaps++;
		longest = Math.max(longest, d);
		if (d >= 30) gapsOver30++;
		if (d >= 60) gapsOver60++;
		if (d >= 90) gapsOver90++;
	}
	out.push(stat$6(player, "longest_observed_layoff_days", longest, inSeasonGaps), stat$6(player, "recent_inter_match_gap_days", recentGap, Math.max(0, rows.length - 1)), stat$6(player, "observed_layoffs_30d_plus", gapsOver30, inSeasonGaps), stat$6(player, "observed_layoffs_60d_plus", gapsOver60, inSeasonGaps), stat$6(player, "observed_layoffs_90d_plus", gapsOver90, inSeasonGaps));
	const returnMatches = [];
	for (let i = 1; i < rows.length; i++) {
		const a = dateMs(rows[i - 1].date ?? ""), b = dateMs(rows[i].date ?? "");
		if (a === null || b === null) continue;
		if (crossesCalendarYearBoundary$1(rows[i - 1].date ?? "", rows[i].date ?? "")) continue;
		if ((b - a) / 864e5 >= 45) returnMatches.push(...rows.slice(i, Math.min(i + 3, rows.length)));
	}
	const usable = returnMatches.filter((r) => r.won === "0" || r.won === "1");
	if (usable.length) out.push(stat$6(player, "return_after_layoff_win_pct", 100 * usable.filter((r) => r.won === "1").length / usable.length, usable.length));
	return out;
}
function getAvailabilityHistoryStats(player, context) {
	return computeAvailabilityStatsFromRows(playerRows(player), player, cutoff$2(context));
}
var SOURCE_URL$3 = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
var SOURCE_NAME$5 = "PredixSport public tennis ratings (CC BY 4.0)";
var atp$1 = null;
var wta$1 = null;
function norm$6(v) {
	return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function parse$1(text) {
	const rows = [];
	let r = [], c = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const x = text[i];
		if (x === "\"") {
			if (q && text[i + 1] === "\"") {
				c += "\"";
				i++;
			} else q = !q;
		} else if (x === "," && !q) {
			r.push(c);
			c = "";
		} else if ((x === "\n" || x === "\r") && !q) {
			if (x === "\r" && text[i + 1] === "\n") i++;
			r.push(c);
			c = "";
			if (r.some(Boolean)) rows.push(r);
			r = [];
		} else c += x;
	}
	if (c || r.length) {
		r.push(c);
		rows.push(r);
	}
	if (!rows.length) return [];
	const h = rows[0].map((x) => x.trim());
	return rows.slice(1).map((a) => Object.fromEntries(h.map((k, i) => [k, (a[i] ?? "").trim()])));
}
function load$4(kind) {
	try {
		if (kind === "ATP") {
			if (atp$1) return atp$1;
			return atp$1 = parse$1(readFileSync(join(process.cwd(), "data/public/predixsport/atp/atp_elo_matches.csv"), "utf8"));
		}
		if (wta$1) return wta$1;
		return wta$1 = parse$1(readFileSync(join(process.cwd(), "data/public/predixsport/wta/wta_elo_ratings.csv"), "utf8"));
	} catch {
		return [];
	}
}
function rowsFor$1(player) {
	const n = norm$6(player), a = load$4("ATP").filter((r) => norm$6(r.player ?? "") === n);
	return a.length ? a : load$4("WTA").filter((r) => norm$6(r.player ?? "") === n);
}
function field$1(r, names) {
	for (const k of names) {
		const hit = Object.keys(r).find((x) => norm$6(x) === norm$6(k));
		if (hit && r[hit]) return r[hit];
	}
	return null;
}
function cut$2(ctx) {
	return ctx.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function tournament$1(ctx) {
	return ctx.match(/tournament\s+([^·]+)/i)?.[1]?.trim() ?? null;
}
function round$1(ctx) {
	return ctx.match(/round\s+([^·]+)/i)?.[1]?.trim() ?? null;
}
function level$1(ctx) {
	return ctx.match(/level\s+([^·]+)/i)?.[1]?.trim() ?? null;
}
function stat$5(p, k, v, n) {
	return {
		key: k,
		player: p,
		value: v,
		surface: null,
		window: "PRE_MATCH_HISTORY",
		tour_level: null,
		sample: n,
		origin: "RECONSTRUCTED",
		sources: [{
			source_name: SOURCE_NAME$5,
			url: SOURCE_URL$3,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	};
}
function computeTournamentContextStatsFromRows(allRows, player, context) {
	const c = cut$2(context);
	if (!c) return [];
	const tn = tournament$1(context), rn = round$1(context), lv = level$1(context), n = norm$6(player), rows = allRows.filter((r) => norm$6(r.player ?? "") === n && isBeforeCutoff(r.date, c));
	if (!rows.length) return [];
	const out = [];
	const trows = tn ? rows.filter((r) => norm$6(field$1(r, [
		"tournament",
		"tourney_name",
		"event",
		"event_name"
	]) ?? "") === norm$6(tn)) : [];
	if (trows.length) {
		const w = trows.filter((r) => r.won === "1").length;
		out.push(stat$5(player, "same_tournament_matches", trows.length, trows.length), stat$5(player, "same_tournament_win_pct", 100 * w / trows.length, trows.length));
	}
	const rrows = rn ? rows.filter((r) => norm$6(field$1(r, ["round", "round_name"]) ?? "") === norm$6(rn)) : [];
	if (rrows.length) {
		const w = rrows.filter((r) => r.won === "1").length;
		out.push(stat$5(player, "same_round_matches", rrows.length, rrows.length), stat$5(player, "same_round_win_pct", 100 * w / rrows.length, rrows.length));
	}
	const lrows = lv ? rows.filter((r) => norm$6(field$1(r, [
		"level",
		"event_level",
		"tourney_level",
		"tour_level"
	]) ?? "") === norm$6(lv)) : [];
	if (lrows.length) {
		const w = lrows.filter((r) => r.won === "1").length;
		out.push(stat$5(player, "same_level_matches", lrows.length, lrows.length), stat$5(player, "same_level_win_pct", 100 * w / lrows.length, lrows.length));
	}
	const recent = rows.slice(-10), switches = recent.slice(1).reduce((n, r, i) => {
		const a = field$1(recent[i], [
			"tournament",
			"tourney_name",
			"event",
			"event_name"
		]), b = field$1(r, [
			"tournament",
			"tourney_name",
			"event",
			"event_name"
		]);
		return n + (a && b && norm$6(a) !== norm$6(b) ? 1 : 0);
	}, 0);
	if (recent.length > 1) out.push(stat$5(player, "tournament_switches_last10", switches, recent.length));
	const countries = recent.map((r) => field$1(r, [
		"country",
		"event_country",
		"tourney_country",
		"location_country"
	])).filter((x) => !!x);
	if (countries.length > 1) {
		let changes = 0;
		for (let i = 1; i < countries.length; i++) if (norm$6(countries[i]) !== norm$6(countries[i - 1])) changes++;
		out.push(stat$5(player, "country_changes_last10", changes, countries.length));
	}
	return out;
}
function getTournamentContextStats(player, context) {
	return computeTournamentContextStatsFromRows(rowsFor$1(player), player, context);
}
var SOURCE_URL$2 = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
var SOURCE_NAME$4 = "PredixSport public tennis ratings (CC BY 4.0)";
var atp = null;
var wta = null;
function norm$5(v) {
	return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function parse(text) {
	const rows = [];
	let r = [], c = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const x = text[i];
		if (x === "\"") {
			if (q && text[i + 1] === "\"") {
				c += "\"";
				i++;
			} else q = !q;
		} else if (x === "," && !q) {
			r.push(c);
			c = "";
		} else if ((x === "\n" || x === "\r") && !q) {
			if (x === "\r" && text[i + 1] === "\n") i++;
			r.push(c);
			c = "";
			if (r.some(Boolean)) rows.push(r);
			r = [];
		} else c += x;
	}
	if (c || r.length) {
		r.push(c);
		rows.push(r);
	}
	if (!rows.length) return [];
	const h = rows[0].map((x) => x.trim());
	return rows.slice(1).map((a) => Object.fromEntries(h.map((k, i) => [k, (a[i] ?? "").trim()])));
}
function load$3(kind) {
	try {
		if (kind === "ATP") {
			if (atp) return atp;
			return atp = parse(readFileSync(join(process.cwd(), "data/public/predixsport/atp/atp_elo_matches.csv"), "utf8"));
		}
		if (wta) return wta;
		return wta = parse(readFileSync(join(process.cwd(), "data/public/predixsport/wta/wta_elo_ratings.csv"), "utf8"));
	} catch {
		return [];
	}
}
function rowsFor(player) {
	const n = norm$5(player), a = load$3("ATP").filter((r) => norm$5(r.player ?? "") === n);
	return a.length ? a : load$3("WTA").filter((r) => norm$5(r.player ?? "") === n);
}
function field(r, names) {
	for (const k of names) {
		const hit = Object.keys(r).find((x) => norm$5(x) === norm$5(k));
		if (hit && r[hit]) return r[hit];
	}
	return null;
}
function num(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}
function cut$1(ctx) {
	return ctx.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function rad(x) {
	return x * Math.PI / 180;
}
function km(a, b, c, d) {
	const R = 6371, dl = rad(c - a), dn = rad(d - b), q = Math.sin(dl / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dn / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(q));
}
function stat$4(p, k, v, n) {
	return {
		key: k,
		player: p,
		value: v,
		surface: null,
		window: "PRE_MATCH_HISTORY",
		tour_level: null,
		sample: n,
		origin: "RECONSTRUCTED",
		sources: [{
			source_name: SOURCE_NAME$4,
			url: SOURCE_URL$2,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	};
}
function computeTravelBurdenStatsFromRows(allRows, player, context) {
	const c = cut$1(context);
	if (!c) return [];
	const n = norm$5(player), rows = allRows.filter((r) => norm$5(r.player ?? "") === n && isBeforeCutoff(r.date, c)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
	if (rows.length < 2) return [];
	const recent = rows.slice(-10), out = [];
	let total = 0, legs = 0, long = 0;
	for (let i = 1; i < recent.length; i++) {
		const a = recent[i - 1], b = recent[i], aLat = num(field(a, [
			"lat",
			"latitude",
			"event_latitude",
			"tourney_latitude"
		])), aLon = num(field(a, [
			"lon",
			"lng",
			"longitude",
			"event_longitude",
			"tourney_longitude"
		])), bLat = num(field(b, [
			"lat",
			"latitude",
			"event_latitude",
			"tourney_latitude"
		])), bLon = num(field(b, [
			"lon",
			"lng",
			"longitude",
			"event_longitude",
			"tourney_longitude"
		]));
		if (aLat === null || aLon === null || bLat === null || bLon === null) continue;
		const d = km(aLat, aLon, bLat, bLon);
		total += d;
		legs++;
		if (d >= 3e3) long++;
	}
	if (legs) out.push(stat$4(player, "observed_travel_km_last10", total, legs), stat$4(player, "avg_observed_travel_km_per_move", total / legs, legs), stat$4(player, "long_haul_moves_3000km_plus_last10", long, legs));
	const tz = recent.map((r) => num(field(r, [
		"timezone_offset",
		"utc_offset",
		"event_utc_offset",
		"timezone_offset_hours"
	]))).filter((x) => x !== null);
	if (tz.length > 1) {
		let shift = 0, max = 0;
		for (let i = 1; i < tz.length; i++) {
			const d = Math.abs(tz[i] - tz[i - 1]);
			shift += d;
			max = Math.max(max, d);
		}
		out.push(stat$4(player, "observed_timezone_shift_hours_last10", shift, tz.length - 1), stat$4(player, "max_observed_timezone_shift_hours_last10", max, tz.length - 1));
	}
	return out;
}
function getTravelBurdenStats(player, context) {
	return computeTravelBurdenStatsFromRows(rowsFor(player), player, context);
}
var CONTEXT_SOURCE = "Uploaded match context / verified identity context";
function source() {
	return [{
		source_name: CONTEXT_SOURCE,
		url: "local://match-context",
		retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
	}];
}
function stat$3(player, key, value, window = "MATCH_CONTEXT") {
	return {
		key,
		player,
		value,
		surface: null,
		window,
		tour_level: null,
		sample: 1,
		origin: "RECONSTRUCTED",
		sources: source()
	};
}
function token$1(ctx, label) {
	return ctx.match(new RegExp(`${label}\\s+([^·]+)`, `i`))?.[1]?.trim() ?? null;
}
function normalized(v) {
	return (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function getCourtContextStats(player, context) {
	const out = [];
	const surface = normalized(token$1(context, "surface"));
	const indoorRaw = normalized(token$1(context, "indoor"));
	const courtSpeedRaw = normalized(token$1(context, "court(?:_| )?speed"));
	if (surface) {
		if (/hard/.test(surface)) out.push(stat$3(player, "match_surface_hard", 1));
		else if (/clay/.test(surface)) out.push(stat$3(player, "match_surface_clay", 1));
		else if (/grass/.test(surface)) out.push(stat$3(player, "match_surface_grass", 1));
		else if (/carpet/.test(surface)) out.push(stat$3(player, "match_surface_carpet", 1));
	}
	if (indoorRaw) {
		if (/^(true|yes|indoor|1)$/.test(indoorRaw)) out.push(stat$3(player, "match_indoor", 1));
		else if (/^(false|no|outdoor|0)$/.test(indoorRaw)) out.push(stat$3(player, "match_indoor", 0));
	}
	if (courtSpeedRaw) {
		const n = Number(courtSpeedRaw);
		if (Number.isFinite(n) && n >= 0 && n <= 100) out.push(stat$3(player, "verified_court_speed_index", n));
		else if (/very slow/.test(courtSpeedRaw)) out.push(stat$3(player, "verified_court_speed_band", 1));
		else if (/slow/.test(courtSpeedRaw)) out.push(stat$3(player, "verified_court_speed_band", 2));
		else if (/medium|neutral/.test(courtSpeedRaw)) out.push(stat$3(player, "verified_court_speed_band", 3));
		else if (/very fast/.test(courtSpeedRaw)) out.push(stat$3(player, "verified_court_speed_band", 5));
		else if (/fast/.test(courtSpeedRaw)) out.push(stat$3(player, "verified_court_speed_band", 4));
	}
	return out;
}
var SOURCE_NAME$3 = "Uploaded match context / verified weather context";
function sources() {
	return [{
		source_name: SOURCE_NAME$3,
		url: "local://match-context",
		retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
	}];
}
function stat$2(player, key, value) {
	return {
		key,
		player,
		value,
		surface: null,
		window: "MATCH_CONTEXT",
		tour_level: null,
		sample: 1,
		origin: "RECONSTRUCTED",
		sources: sources()
	};
}
function token(ctx, label) {
	return ctx.match(new RegExp(`(?:^|·|\\s)${label}\\s+([^·]+)`, `i`))?.[1]?.trim() ?? null;
}
function number(v) {
	if (!v) return null;
	const m = v.match(/-?\d+(?:\.\d+)?/);
	if (!m) return null;
	const n = Number(m[0]);
	return Number.isFinite(n) ? n : null;
}
function fahrenheitToCelsius(f) {
	return (f - 32) * 5 / 9;
}
function mphToKph(m) {
	return m * 1.609344;
}
function getWeatherContextStats(player, context) {
	const out = [];
	const tempRaw = token(context, "(?:temperature|temp)");
	let temp = number(tempRaw);
	if (temp !== null) {
		if (/°?f\b|fahrenheit/i.test(tempRaw ?? "")) temp = fahrenheitToCelsius(temp);
		if (temp >= -30 && temp <= 60) out.push(stat$2(player, "match_temperature_c", temp));
	}
	const humidity = number(token(context, "humidity"));
	if (humidity !== null && humidity >= 0 && humidity <= 100) out.push(stat$2(player, "match_humidity_pct", humidity));
	const windRaw = token(context, "(?:wind|wind_speed)");
	let wind = number(windRaw);
	if (wind !== null) {
		if (/mph/i.test(windRaw ?? "")) wind = mphToKph(wind);
		if (wind >= 0 && wind <= 250) out.push(stat$2(player, "match_wind_kph", wind));
	}
	const altitudeRaw = token(context, "(?:altitude|elevation)");
	let altitude = number(altitudeRaw);
	if (altitude !== null) {
		if (/\bft\b|feet/i.test(altitudeRaw ?? "")) altitude *= .3048;
		if (altitude >= -500 && altitude <= 9e3) out.push(stat$2(player, "match_altitude_m", altitude));
	}
	const roof = (token(context, "roof") ?? "").toLowerCase();
	if (/closed/.test(roof)) out.push(stat$2(player, "match_roof_closed", 1));
	else if (/open/.test(roof)) out.push(stat$2(player, "match_roof_closed", 0));
	return out;
}
var SOURCE_URL$1 = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
var SOURCE_NAME$2 = "PredixSport public tennis ratings (CC BY 4.0)";
var cache$2 = null;
function norm$4(v) {
	return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tokens(v) {
	return norm$4(v).split(" ").filter(Boolean);
}
function parseCsv$2(text) {
	const rows = [];
	let row = [], cell = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === "\"") {
			if (q && text[i + 1] === "\"") {
				cell += "\"";
				i++;
			} else q = !q;
		} else if (ch === "," && !q) {
			row.push(cell);
			cell = "";
		} else if ((ch === "\n" || ch === "\r") && !q) {
			if (ch === "\r" && text[i + 1] === "\n") i++;
			row.push(cell);
			cell = "";
			if (row.some(Boolean)) rows.push(row);
			row = [];
		} else cell += ch;
	}
	if (cell || row.length) {
		row.push(cell);
		rows.push(row);
	}
	if (!rows.length) return [];
	const h = rows[0].map((x) => x.trim());
	return rows.slice(1).map((c) => Object.fromEntries(h.map((k, i) => [k, (c[i] ?? "").trim()])));
}
function load$2() {
	if (cache$2) return cache$2;
	try {
		return cache$2 = parseCsv$2(readFileSync(join(process.cwd(), "data/public/predixsport/atp/atp_elo_matches.csv"), "utf8"));
	} catch {
		return [];
	}
}
function resolve$4(rows, name) {
	const n = norm$4(name), names = [...new Set(rows.map((r) => r.player).filter(Boolean))], exact = names.filter((x) => norm$4(x) === n);
	if (exact.length === 1) return exact[0];
	const t = tokens(name), last = t[t.length - 1];
	if (!last) return null;
	const c = names.filter((x) => {
		const xt = tokens(x);
		if (xt[xt.length - 1] !== last) return false;
		const s = new Set(xt);
		return t.length === 1 || t.every((v) => s.has(v));
	});
	return c.length === 1 ? c[0] : null;
}
function cutoff$1(c) {
	return c.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function surface$2(c) {
	return c.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase() ?? null;
}
function getCommonOpponentEvidence(p1, p2, context) {
	const rows = load$2(), a = resolve$4(rows, p1), b = resolve$4(rows, p2);
	if (!a || !b) return null;
	const cut = cutoff$1(context), surf = surface$2(context);
	if (!cut) return null;
	const usable = (r) => isBeforeCutoff(r.date, cut), same = (r) => !surf || !!r.surface && r.surface.toLowerCase() === surf, filtered = rows.filter((r) => usable(r) && same(r)), ar = filtered.filter((r) => r.player === a), br = filtered.filter((r) => r.player === b), ao = new Set(ar.map((r) => norm$4(r.opponent ?? "")).filter(Boolean)), bo = new Set(br.map((r) => norm$4(r.opponent ?? "")).filter(Boolean)), common = [...ao].filter((x) => bo.has(x));
	if (!common.length) return null;
	const cs = new Set(common), aw = ar.filter((r) => cs.has(norm$4(r.opponent ?? "")) && r.won === "1").length, al = ar.filter((r) => cs.has(norm$4(r.opponent ?? "")) && r.won === "0").length, bw = br.filter((r) => cs.has(norm$4(r.opponent ?? "")) && r.won === "1").length, bl = br.filter((r) => cs.has(norm$4(r.opponent ?? "")) && r.won === "0").length;
	return {
		p1: a,
		p2: b,
		commonCount: common.length,
		p1Wins: aw,
		p1Losses: al,
		p2Wins: bw,
		p2Losses: bl,
		p1WinPct: aw + al ? 100 * aw / (aw + al) : null,
		p2WinPct: bw + bl ? 100 * bw / (bw + bl) : null,
		source: {
			source_name: SOURCE_NAME$2,
			url: SOURCE_URL$1,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}
	};
}
var APPROVED_SPEC_IDS = new Set(RECONSTRUCTION_SPECS.map((s) => s.id));
var FIXED_WINDOW_ZERO_EVENT_KEYS = [
	"matches_last_7_days",
	"matches_last_14_days",
	"matches_last_28_days",
	"sets_last_14_days",
	"three_setters_last_14_days",
	"qualifying_matches_last_14_days"
];
var normName = (v) => String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function samePlayer(a, b) {
	const x = normName(a);
	const y = normName(b);
	if (!x || !y) return false;
	if (x === y) return true;
	return x.split(" ").filter(Boolean).sort().join(" ") === y.split(" ").filter(Boolean).sort().join(" ");
}
function pickSource(evidence, persisted) {
	const persistedNames = persisted ? new Set(persisted.map((s) => normName(s.source_name))) : null;
	for (const source of evidence.sources ?? []) {
		const name = String(source?.source_name ?? "").trim();
		if (!name) continue;
		if (persistedNames && !persistedNames.has(normName(name))) continue;
		return source;
	}
	return null;
}
function isFixedWindowZeroEventObservation(value) {
	if (!value) return false;
	return FIXED_WINDOW_ZERO_EVENT_KEYS.some((key) => new RegExp(`(?:^|;\\s*)${key}\\s*=\\s*0(?:\\.0+)?(?=\\s*;|$)`, "i").test(value));
}
/**
* Normalize one side of already-produced internal evidence into the tagged
* form the certified guards require. Returns an UNAVAILABLE side (with the
* precise missing input) whenever the provenance cannot be proved.
*/
function normalizeTrustedSide(side, expectedPlayer, evidence, persistedSources) {
	const reject = (missing) => ({
		value: null,
		treatment: "UNAVAILABLE",
		sample: null,
		sources: [],
		missing
	});
	if (!evidence || !evidence.value || !String(evidence.value).trim()) return reject([]);
	if (evidence.treatment === "UNAVAILABLE" || evidence.treatment === "EXCLUDED") return {
		value: null,
		treatment: evidence.treatment,
		sample: null,
		sources: [],
		missing: []
	};
	if (!samePlayer(evidence.player, expectedPlayer)) return reject([`${side} exact PLAYER=${expectedPlayer}`]);
	const source = pickSource(evidence, persistedSources);
	if (!source) return reject([`${side} SOURCE matching persisted provenance`]);
	const rawSample = evidence.sample === null || evidence.sample === void 0 || String(evidence.sample).trim() === "" ? null : String(evidence.sample).trim();
	if (!rawSample) return reject([`${side} actual side-specific SAMPLE denominator`]);
	const sample = rawSample === "0" ? isFixedWindowZeroEventObservation(evidence.value) ? "FIXED_WINDOW_ZERO_EVENT" : null : rawSample;
	if (!sample) return reject([`${side} actual side-specific SAMPLE denominator`]);
	let treatment = evidence.treatment;
	const missing = [];
	let formulaTag = "";
	if (treatment === "RECONSTRUCTED") {
		const provenance = evidence.formula;
		if (!(!!provenance && !!String(provenance.formula ?? "").trim() && Array.isArray(provenance.inputs) && provenance.inputs.length > 0 && (!provenance.spec_id || APPROVED_SPEC_IDS.has(provenance.spec_id)))) {
			treatment = "PARTIAL";
			missing.push(`${side} approved deterministic reconstruction formula provenance`);
		} else formulaTag = `; INPUTS=${provenance.inputs.join("|")}; FORMULA=${provenance.formula}`;
	}
	const value = `PLAYER=${expectedPlayer}; SOURCE=${String(source.source_name).trim()}; SAMPLE=${sample}${formulaTag}; ${String(evidence.value).trim()}`;
	const persistedNames = persistedSources ? new Set(persistedSources.map((s) => normName(s.source_name))) : null;
	const ordered = [source, ...(evidence.sources ?? []).filter((s) => String(s?.source_name ?? "").trim() && (!persistedNames || persistedNames.has(normName(s.source_name)))).filter((s) => s !== source)];
	return {
		value,
		treatment,
		sample,
		sources: ordered,
		missing
	};
}
/**
* Build a MetricFinding from side-scoped trusted internal evidence. Only the
* sources actually referenced by a surviving side are persisted, so an
* unrelated row source can never support a side.
*/
function buildTrustedInternalFinding(input) {
	const p1 = normalizeTrustedSide("P1", input.players.p1, input.p1, input.persistedSources);
	const p2 = normalizeTrustedSide("P2", input.players.p2, input.p2, input.persistedSources);
	const anyUsable = p1.value !== null || p2.value !== null;
	const sources = [...p1.sources, ...p2.sources].filter((s, i, a) => a.findIndex((z) => normName(z.source_name) === normName(s.source_name) && (z.url ?? null) === (s.url ?? null)) === i);
	const missing = [.../* @__PURE__ */ new Set([
		...input.missing_inputs ?? [],
		...p1.missing,
		...p2.missing
	])];
	return {
		metric_code: input.metric_code,
		p1_value: p1.value,
		p2_value: p2.value,
		p1_treatment: p1.treatment,
		p2_treatment: p2.treatment,
		differential: input.differential ?? null,
		evidence_family: anyUsable ? input.evidence_family : null,
		reliability: anyUsable ? input.reliability : null,
		sample: anyUsable ? `P1:${p1.sample ?? "UNAVAILABLE"} | P2:${p2.sample ?? "UNAVAILABLE"}` : null,
		unavailable_reason: anyUsable ? input.unavailable_reason : missing.length ? `Trusted internal evidence adapter could not prove side/provenance lineage: ${missing.join(", ")}.` : input.unavailable_reason,
		missing_inputs: missing.length ? missing : input.missing_inputs,
		sources
	};
}
/**
* Truthful residue: a finding where no side survived certification must not
* keep a sample/reliability/source that implies evidence exists. This never
* changes a treatment and never counts anything as evidence.
*/
function clearPhantomEvidenceMetadata(finding) {
	const usable = (value, treatment) => value !== null && treatment !== "UNAVAILABLE" && treatment !== "EXCLUDED";
	if (usable(finding.p1_value, finding.p1_treatment) || usable(finding.p2_value, finding.p2_treatment)) return finding;
	if (finding.sample === null && finding.reliability === null && (finding.sources ?? []).length === 0) return finding;
	return {
		...finding,
		sample: null,
		reliability: null,
		sources: []
	};
}
var BASE$1 = "https://api.wtatennis.com/tennis";
var RANKED = `${BASE$1}/players/ranked?type=rankSingles&metric=singles&page=0&pageSize=500`;
var SUPPORTED = /* @__PURE__ */ new Set([
	"005",
	"006",
	"007",
	"008",
	"009",
	"010",
	"011",
	"012",
	"013",
	"020",
	"028",
	"030",
	"068",
	"080"
]);
var norm$3 = (value) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
var pct = (a, b) => b > 0 ? 100 * a / b : null;
var codeOf$2 = (value) => {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
};
function contextDate(context) {
	return context.match(/(?:date|scheduled_date)\s*[:=]?\s*(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function contextSurface(context) {
	return context.match(/surface\s*[:=]?\s*(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase() ?? null;
}
function contextTournament(context) {
	return context.match(/tournament\s*[:=]\s*([^|·\n]+)/i)?.[1]?.trim() ?? null;
}
function explicitWtaMain(context) {
	const s = norm$3(context);
	if (!/(^| )wta( |$)/.test(s)) return false;
	if ([
		"125",
		"challenger",
		"itf",
		"futures",
		"utr"
	].some((x) => s.includes(x))) return false;
	return true;
}
function allowedMainLevel(level) {
	const s = norm$3(level);
	if (!s || [
		"125",
		"challenger",
		"itf",
		"futures"
	].some((x) => s.includes(x))) return false;
	return /(grand slam|wta 1000|wta 500|wta 250|tour finals|wta finals|premier|international)/.test(s);
}
function dayDiff(a, b) {
	return Math.max(0, Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 864e5));
}
function crossesCalendarYearBoundary(earlierDate, laterDate) {
	return earlierDate.slice(0, 4) !== laterDate.slice(0, 4);
}
function mean(values) {
	return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
function variance(values) {
	if (!values.length) return null;
	const m = mean(values);
	return values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
}
async function getJson(url) {
	const r = await fetch(url, {
		headers: {
			accept: "application/json",
			"user-agent": "tennis-truth-engine-evidence-coverage/1.0"
		},
		signal: AbortSignal.timeout(12e3)
	});
	if (!r.ok) throw new Error(`WTA official API ${r.status}: ${url}`);
	return r.json();
}
async function resolvePlayerId$1(player) {
	const payload = await getJson(RANKED);
	const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.content) ? payload.content : [];
	const target = norm$3(player);
	const exact = rows.filter((row) => norm$3(row.player?.fullName) === target && row.player?.id != null);
	if (exact.length !== 1) return null;
	return String(exact[0].player.id);
}
async function loadHistory(player, asOfDate) {
	const playerId = await resolvePlayerId$1(player);
	if (!playerId) return null;
	const year = Number(asOfDate.slice(0, 4));
	const urls = [year - 1, year].filter((y) => y >= 1960).map((y) => `${BASE$1}/players/${encodeURIComponent(playerId)}/matches?year=${y}&page=0&pageSize=500`);
	const matches = (await Promise.all(urls.map(async (url) => {
		try {
			return await getJson(url);
		} catch {
			return null;
		}
	}))).flatMap((payload) => Array.isArray(payload?.matches) ? payload.matches : []).filter((row) => String(row.s_d_flag ?? "").toUpperCase() === "S").filter((row) => row.opponent?.fullName && row.scores && row.StartDate).filter((row) => String(row.StartDate).slice(0, 10) <= asOfDate).filter((row) => allowedMainLevel(row.tournament?.tournamentGroup?.level ?? row.tournament?.level ?? row.TournamentLevel));
	const seen = /* @__PURE__ */ new Set();
	return {
		playerId,
		urls,
		matches: matches.filter((row) => {
			const k = [
				row.StartDate,
				row.TournamentName,
				row.round_name,
				row.player_1,
				row.player_2,
				row.scores
			].join("|");
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		}).sort((a, b) => String(b.StartDate).localeCompare(String(a.StartDate)))
	};
}
function parseSets(score) {
	const out = [];
	for (const token of score.replace(/RET|W\/O|DEF/gi, " ").split(/\s+/)) {
		const m = token.match(/^(\d+)-(\d+)(?:\([^)]*\))?$/);
		if (!m) continue;
		out.push([Number(m[1]), Number(m[2])]);
	}
	return out;
}
function playerWon(row, playerId) {
	const side = String(row.player_1 ?? "").trim() === playerId ? 1 : String(row.player_2 ?? "").trim() === playerId ? 2 : null;
	return side != null && Number(row.winner) === side;
}
function orientedSets(row, playerId) {
	const sets = parseSets(String(row.scores ?? ""));
	const playerSide = String(row.player_1 ?? "").trim() === playerId ? 1 : String(row.player_2 ?? "").trim() === playerId ? 2 : null;
	if (!playerSide) return [];
	return playerSide === 1 ? sets : sets.map(([a, b]) => [b, a]);
}
function summarize$2(history, asOfDate, context) {
	const cutoff = /* @__PURE__ */ new Date(`${asOfDate}T00:00:00Z`);
	cutoff.setUTCDate(cutoff.getUTCDate() - 370);
	const minDate = cutoff.toISOString().slice(0, 10);
	const rows = history.matches.filter((r) => String(r.StartDate).slice(0, 10) >= minDate);
	if (!rows.length) return null;
	contextSurface(context);
	const tournament = contextTournament(context), levelMatch = context.match(/(?:level|tour)\s*[:=]\s*([^|·\n]+)/i)?.[1]?.trim() ?? "WTA MAIN";
	const winFlags = rows.map((r) => playerWon(r, history.playerId));
	const wins = winFlags.filter(Boolean).length;
	const setRecords = rows.map((r) => orientedSets(r, history.playerId));
	const totalSets = setRecords.reduce((n, s) => n + s.length, 0), setsWon = setRecords.reduce((n, s) => n + s.filter(([a, b]) => a > b).length, 0);
	const recentPct = (n) => pct(winFlags.slice(0, n).filter(Boolean).length, Math.min(n, winFlags.length));
	const setRecentPct = (n) => {
		const s = setRecords.slice(0, n).flat();
		return pct(s.filter(([a, b]) => a > b).length, s.length);
	};
	const set1 = setRecords.map((s) => s[0]).filter(Boolean), set2 = setRecords.map((s) => s[1]).filter(Boolean);
	const deciding = setRecords.map((s) => s.length >= 3 ? s[2] : null).filter((x) => !!x);
	const lost1 = rows.map((r, i) => ({
		won: winFlags[i],
		sets: setRecords[i]
	})).filter((x) => x.sets[0] && x.sets[0][0] < x.sets[0][1]);
	const won1 = rows.map((r, i) => ({
		won: winFlags[i],
		sets: setRecords[i]
	})).filter((x) => x.sets[0] && x.sets[0][0] > x.sets[0][1]);
	const straightWins = rows.map((r, i) => winFlags[i] && setRecords[i].length === 2 && setRecords[i].every(([a, b]) => a > b)).filter(Boolean).length;
	const tbs = setRecords.flat().filter(([a, b]) => Math.max(a, b) === 7 && Math.min(a, b) >= 6);
	const setMargins = setRecords.map((s) => s.reduce((n, [a, b]) => n + (a > b ? 1 : -1), 0));
	const dates = rows.map((r) => String(r.StartDate).slice(0, 10));
	const gaps = dates.slice(0, -1).map((d, i) => dayDiff(dates[i + 1], d));
	const inSeason = dates.slice(0, -1).map((d, i) => !crossesCalendarYearBoundary(dates[i + 1], d));
	const inSeasonGaps = gaps.filter((_, i) => inSeason[i]);
	const returns = rows.slice(0, -1).map((r, i) => ({
		gap: gaps[i],
		won: winFlags[i],
		inSeason: inSeason[i]
	}));
	let streak = 0;
	for (let i = 0; i < winFlags.length; i++) if (i === 0) streak = winFlags[i] ? 1 : -1;
	else if (streak > 0 === winFlags[i]) streak += winFlags[i] ? 1 : -1;
	else break;
	let longest = 0, cur = 0;
	for (const won of [...winFlags].reverse()) {
		cur = won ? cur + 1 : 0;
		longest = Math.max(longest, cur);
	}
	const d7 = dates.filter((d) => dayDiff(d, asOfDate) <= 7).length, d14 = dates.filter((d) => dayDiff(d, asOfDate) <= 14).length, d28 = dates.filter((d) => dayDiff(d, asOfDate) <= 28).length;
	const idx14 = dates.map((d, i) => dayDiff(d, asOfDate) <= 14 ? i : -1).filter((i) => i >= 0), sets14 = idx14.reduce((n, i) => n + setRecords[i].length, 0), three14 = idx14.filter((i) => setRecords[i].length >= 3).length, qual14 = idx14.filter((i) => /qual/i.test(String(rows[i].round_name ?? ""))).length;
	const last10 = rows.slice(0, 10), switches = last10.slice(1).filter((r, i) => norm$3(r.TournamentName ?? r.tournament?.title) !== norm$3(last10[i].TournamentName ?? last10[i].tournament?.title)).length;
	const sameLevel = rows.filter((r) => allowedMainLevel(r.tournament?.tournamentGroup?.level ?? r.TournamentLevel) && !norm$3(levelMatch).includes("125"));
	const sameTournament = tournament ? rows.filter((r) => norm$3(r.TournamentName ?? r.tournament?.title).includes(norm$3(tournament)) || norm$3(tournament).includes(norm$3(r.TournamentName ?? r.tournament?.title))) : [];
	const opponentRank = (r) => {
		const side = String(r.player_1 ?? "").trim() === history.playerId ? 1 : String(r.player_2 ?? "").trim() === history.playerId ? 2 : null;
		const value = side === 1 ? r.rank_2 : side === 2 ? r.rank_1 : null;
		const n = Number(value);
		return Number.isFinite(n) && n > 0 ? n : null;
	};
	const ranked = rows.map((r, i) => ({
		rank: opponentRank(r),
		won: winFlags[i]
	})).filter((x) => x.rank != null);
	const recentRanks = ranked.slice(0, 10).map((x) => x.rank), winningRanks = ranked.filter((x) => x.won).map((x) => x.rank);
	const bucket = (maxRank) => {
		const x = ranked.filter((v) => v.rank <= maxRank);
		return pct(x.filter((v) => v.won).length, x.length);
	};
	const weakLosses = ranked.filter((x) => x.rank >= 100), sourceUrls = history.urls;
	return {
		matches: rows.length,
		wins,
		winPct: pct(wins, rows.length),
		last5WinPct: recentPct(5),
		last10WinPct: recentPct(10),
		setsWon,
		setsPlayed: totalSets,
		setWinPct: pct(setsWon, totalSets),
		last5SetWinPct: setRecentPct(5),
		last10SetWinPct: setRecentPct(10),
		set1WinPct: pct(set1.filter(([a, b]) => a > b).length, set1.length),
		set2WinPct: pct(set2.filter(([a, b]) => a > b).length, set2.length),
		decidingSetWinPct: pct(deciding.filter(([a, b]) => a > b).length, deciding.length),
		decidingSetsPlayed: deciding.length,
		winAfterLosingSet1Pct: pct(lost1.filter((x) => x.won).length, lost1.length),
		winAfterWinningSet1Pct: pct(won1.filter((x) => x.won).length, won1.length),
		secondSetAfterLosingSet1WinPct: pct(lost1.filter((x) => x.sets[1] && x.sets[1][0] > x.sets[1][1]).length, lost1.filter((x) => x.sets[1]).length),
		straightSetMatchWinPct: pct(straightWins, rows.length),
		comebackWinPct: pct(lost1.filter((x) => x.won).length, lost1.length),
		tiebreakWinPct: pct(tbs.filter(([a, b]) => a > b).length, tbs.length),
		tiebreaksPlayed: tbs.length,
		performanceVariance: variance(setMargins),
		floorCeilingRange: setMargins.length ? Math.max(...setMargins) - Math.min(...setMargins) : null,
		matches7: d7,
		matches14: d14,
		matches28: d28,
		sets14,
		threeSetters14: three14,
		qualifying14: qual14,
		daysSinceLastMatch: dates[0] ? dayDiff(dates[0], asOfDate) : null,
		recentInterMatchGapDays: gaps[0] ?? null,
		tournamentSwitchesLast10: switches,
		currentStreakSigned: streak,
		longestWinStreak: longest,
		longestLayoffDays: inSeasonGaps.length ? Math.max(...inSeasonGaps) : null,
		layoffs30: inSeasonGaps.filter((g) => g >= 30).length,
		layoffs60: inSeasonGaps.filter((g) => g >= 60).length,
		layoffs90: inSeasonGaps.filter((g) => g >= 90).length,
		returnAfterLayoffWinPct: pct(returns.filter((x) => x.inSeason && x.gap >= 30 && x.won).length, returns.filter((x) => x.inSeason && x.gap >= 30).length),
		sameLevelMatches: sameLevel.length,
		sameLevelWinPct: pct(sameLevel.filter((r) => playerWon(r, history.playerId)).length, sameLevel.length),
		sameTournamentMatches: sameTournament.length,
		sameTournamentWinPct: pct(sameTournament.filter((r) => playerWon(r, history.playerId)).length, sameTournament.length),
		avgOpponentRankLast10: mean(recentRanks),
		bestRankedRecentWin: winningRanks.length ? Math.min(...winningRanks) : null,
		top20WinPct: bucket(20),
		top50WinPct: bucket(50),
		top100WinPct: bucket(100),
		badLossRateRank100Plus: pct(weakLosses.filter((x) => !x.won).length, weakLosses.length),
		sourceUrls
	};
}
function fmt(v, digits = 1) {
	return v == null ? "NA" : v.toFixed(digits);
}
function metricValue(code, s) {
	switch (code) {
		case "005": return `last5_win_pct=${fmt(s.last5WinPct)}; last10_win_pct=${fmt(s.last10WinPct)}; last5_set_win_pct=${fmt(s.last5SetWinPct)}; last10_set_win_pct=${fmt(s.last10SetWinPct)}; set_win_pct=${fmt(s.setWinPct)}; sample_matches=${s.matches}`;
		case "006": return `official_opponent_rank_avg_last10=${fmt(s.avgOpponentRankLast10)}; best_ranked_recent_win=${fmt(s.bestRankedRecentWin, 0)}; win_pct_vs_top20=${fmt(s.top20WinPct)}; win_pct_vs_top50=${fmt(s.top50WinPct)}; win_pct_vs_top100=${fmt(s.top100WinPct)}; loss_rate_vs_rank100_plus=${fmt(s.badLossRateRank100Plus)}`;
		case "008": return `set1_win_pct=${fmt(s.set1WinPct)}; set2_win_pct=${fmt(s.set2WinPct)}; deciding_set_win_pct=${fmt(s.decidingSetWinPct)}; deciding_sets_played=${s.decidingSetsPlayed}; win_after_losing_set1_pct=${fmt(s.winAfterLosingSet1Pct)}; win_after_winning_set1_pct=${fmt(s.winAfterWinningSet1Pct)}; second_set_after_losing_set1_win_pct=${fmt(s.secondSetAfterLosingSet1WinPct)}`;
		case "009": return `win_after_losing_set1_pct=${fmt(s.comebackWinPct)}; tiebreak_win_pct=${fmt(s.tiebreakWinPct)}; tiebreaks_played=${s.tiebreaksPlayed}`;
		case "010": return `straight_set_match_win_pct=${fmt(s.straightSetMatchWinPct)}; all_match_denominator=${s.matches}`;
		case "011": return `performance_variance=${fmt(s.performanceVariance, 3)}; performance_floor_ceiling_set_margin_range=${fmt(s.floorCeilingRange, 0)}`;
		case "012": return `matches_last_7_days=${s.matches7}; matches_last_14_days=${s.matches14}; matches_last_28_days=${s.matches28}; sets_last_14_days=${s.sets14}; three_setters_last_14_days=${s.threeSetters14}; qualifying_matches_last_14_days=${s.qualifying14}; days_since_last_match=${fmt(s.daysSinceLastMatch, 0)}; recent_inter_match_gap_days=${fmt(s.recentInterMatchGapDays, 0)}; tournament_switches_last10=${s.tournamentSwitchesLast10}`;
		case "013": return `longest_observed_layoff_days=${fmt(s.longestLayoffDays, 0)}; observed_layoffs_30d_plus=${s.layoffs30}; observed_layoffs_60d_plus=${s.layoffs60}; observed_layoffs_90d_plus=${s.layoffs90}; return_after_layoff_win_pct=${fmt(s.returnAfterLayoffWinPct)}`;
		case "020": return `same_level_matches=${s.sameLevelMatches}; same_level_win_pct=${fmt(s.sameLevelWinPct)}`;
		case "028": return `matches_last_14_days=${s.matches14}; matches_last_28_days=${s.matches28}; days_since_last_match=${fmt(s.daysSinceLastMatch, 0)}; recent_inter_match_gap_days=${fmt(s.recentInterMatchGapDays, 0)}; tournament_switches_last10=${s.tournamentSwitchesLast10}`;
		case "030": return s.sameTournamentMatches ? `same_tournament_matches=${s.sameTournamentMatches}; same_tournament_win_pct=${fmt(s.sameTournamentWinPct)}` : null;
		case "068": return `current_streak_signed=${s.currentStreakSigned}; longest_win_streak_observed=${s.longestWinStreak}`;
		case "080": return `official_opponent_rank_avg_last10=${fmt(s.avgOpponentRankLast10)}; best_ranked_recent_win=${fmt(s.bestRankedRecentWin, 0)}; win_pct_vs_top20=${fmt(s.top20WinPct)}; win_pct_vs_top50=${fmt(s.top50WinPct)}; win_pct_vs_top100=${fmt(s.top100WinPct)}`;
		default: return null;
	}
}
function commonOpponentPair(a, b, asOfDate) {
	if (!a || !b) return null;
	const cutoff = /* @__PURE__ */ new Date(`${asOfDate}T00:00:00Z`);
	cutoff.setUTCDate(cutoff.getUTCDate() - 370);
	const min = cutoff.toISOString().slice(0, 10);
	const usable = (h) => h.matches.filter((r) => String(r.StartDate).slice(0, 10) >= min && r.opponent?.fullName && allowedMainLevel(r.tournament?.tournamentGroup?.level ?? r.TournamentLevel));
	const group = (h) => {
		const m = /* @__PURE__ */ new Map();
		for (const r of usable(h)) {
			const k = norm$3(r.opponent?.fullName), old = m.get(k) ?? {
				name: String(r.opponent?.fullName),
				matches: 0,
				wins: 0
			};
			old.matches++;
			if (playerWon(r, h.playerId)) old.wins++;
			m.set(k, old);
		}
		return m;
	};
	const am = group(a), bm = group(b), keys = [...am.keys()].filter((k) => bm.has(k));
	if (!keys.length) return null;
	const av = keys.reduce((n, k) => n + am.get(k).matches, 0), aw = keys.reduce((n, k) => n + am.get(k).wins, 0), bv = keys.reduce((n, k) => n + bm.get(k).matches, 0), bw = keys.reduce((n, k) => n + bm.get(k).wins, 0);
	return {
		p1: `direct_common_opponents=${keys.length}; common_opponent_matches=${av}; common_opponent_wins=${aw}; common_opponent_losses=${av - aw}; common_opponent_win_pct=${fmt(pct(aw, av))}; opponents=${keys.slice(0, 8).map((k) => am.get(k).name).join(",")}`,
		p2: `direct_common_opponents=${keys.length}; common_opponent_matches=${bv}; common_opponent_wins=${bw}; common_opponent_losses=${bv - bw}; common_opponent_win_pct=${fmt(pct(bw, bv))}; opponents=${keys.slice(0, 8).map((k) => bm.get(k).name).join(",")}`,
		sample: keys.length
	};
}
function refs(urls) {
	return urls.map((url) => ({
		source_name: "WTA Official Match History",
		url,
		retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
	}));
}
async function officialWtaMetricRows(args) {
	if (!explicitWtaMain(args.context)) return null;
	const asOfDate = contextDate(args.context);
	const [a, b] = await Promise.all([loadHistory(args.p1, asOfDate), loadHistory(args.p2, asOfDate)]);
	const [sa, sb] = [a ? summarize$2(a, asOfDate, args.context) : null, b ? summarize$2(b, asOfDate, args.context) : null];
	if (!sa && !sb) return null;
	const common = commonOpponentPair(a, b, asOfDate);
	return args.metrics.map((metric) => {
		const code = codeOf$2(metric.code);
		if (!SUPPORTED.has(code)) return buildTrustedInternalFinding({
			metric_code: metric.code,
			players: {
				p1: args.p1,
				p2: args.p2
			},
			p1: null,
			p2: null,
			evidence_family: null,
			reliability: 90,
			unavailable_reason: "Official WTA match history is not an allowed source for this metric family",
			persistedSources: []
		});
		const av = code === "007" ? common?.p1 ?? null : sa ? metricValue(code, sa) : null, bv = code === "007" ? common?.p2 ?? null : sb ? metricValue(code, sb) : null;
		const sources = [...sa ? refs(sa.sourceUrls) : [], ...sb ? refs(sb.sourceUrls) : []].filter((s, i, x) => x.findIndex((v) => v.url === s.url) === i);
		const sample = code === "007" ? common?.sample ?? null : null;
		return buildTrustedInternalFinding({
			metric_code: metric.code,
			players: {
				p1: args.p1,
				p2: args.p2
			},
			p1: av ? {
				player: args.p1,
				value: av,
				treatment: "PARTIAL",
				sample: sample ?? sa?.matches ?? null,
				sources: sa ? refs(sa.sourceUrls) : []
			} : null,
			p2: bv ? {
				player: args.p2,
				value: bv,
				treatment: "PARTIAL",
				sample: sample ?? sb?.matches ?? null,
				sources: sb ? refs(sb.sourceUrls) : []
			} : null,
			evidence_family: code === "007" ? "WTA_OFFICIAL_COMMON_OPPONENT_NETWORK" : "WTA_OFFICIAL_MATCH_HISTORY",
			reliability: 90,
			unavailable_reason: av || bv ? "Official WTA results reconstruct only explicitly supported match/set/ranking/workload components; game/point-only components remain unavailable." : "No qualifying WTA Main match-history component was available for this metric",
			persistedSources: sources
		});
	});
}
function isProviderFailure(error) {
	const m = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
	return /402|credit|quota|429|rate limit|timeout|provider|api key|auth|fetch|not configured/.test(m);
}
function localIdentity(input) {
	const ctx = resolveLocalMatchContext(input.p1, input.p2, input.hints), context = Object.entries(ctx.fields).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(" · "), a = getPredixDatasetEvidence(input.p1, context), b = getPredixDatasetEvidence(input.p2, context);
	return {
		player1_canonical: a?.canonicalPlayer ?? (a ? input.p1 : null),
		player2_canonical: b?.canonicalPlayer ?? (b ? input.p2 : null),
		player1_status: a ? "VERIFIED" : "UNVERIFIED",
		player2_status: b ? "VERIFIED" : "UNVERIFIED",
		tournament: ctx.fields.tournament ?? null,
		event_level: ctx.fields.event_level ?? null,
		round: ctx.fields.round ?? null,
		scheduled_date: ctx.fields.scheduled_date ?? null,
		surface: ctx.fields.surface ?? null,
		indoor: null,
		best_of: ctx.fields.best_of ? Number(ctx.fields.best_of) : null,
		surface_status: ctx.fields.surface ? "VERIFIED" : "UNVERIFIED",
		unresolved_reason: ctx.unresolvedReason,
		sources: ctx.sources.map((name) => ({
			source_name: name,
			url: ctx.sourceUrl,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		})),
		conflicts: []
	};
}
function mergeIdentity(a, b) {
	const c = (x, y) => y ?? x ?? null;
	return {
		player1_canonical: c(a.player1_canonical, b.player1_canonical),
		player2_canonical: c(a.player2_canonical, b.player2_canonical),
		player1_status: b.player1_status === "VERIFIED" ? "VERIFIED" : a.player1_status,
		player2_status: b.player2_status === "VERIFIED" ? "VERIFIED" : a.player2_status,
		tournament: c(a.tournament, b.tournament),
		event_level: c(a.event_level, b.event_level),
		round: c(a.round, b.round),
		scheduled_date: c(a.scheduled_date, b.scheduled_date),
		surface: c(a.surface, b.surface),
		indoor: c(a.indoor, b.indoor),
		best_of: c(a.best_of, b.best_of),
		surface_status: b.surface_status === "VERIFIED" ? "VERIFIED" : a.surface_status,
		unresolved_reason: b.unresolved_reason ?? a.unresolved_reason,
		sources: [...a.sources ?? [], ...b.sources ?? []],
		conflicts: [...a.conflicts ?? [], ...b.conflicts ?? []]
	};
}
function familyCode$1(code) {
	const m = String(code).match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(code).padStart(3, "0");
}
function pickedStats(map, keys) {
	return keys.map((k) => map.get(k)).filter((x) => !!x);
}
function summarize$1(map, keys) {
	const p = pickedStats(map, keys);
	return p.length ? p.map((s) => `${s.key}=${Number(s.value).toFixed(2)}`).join("; ") : null;
}
function summaryMeta(map, keys) {
	const p = pickedStats(map, keys);
	if (!p.length) return null;
	const samples = p.map((x) => x.sample).filter((x) => typeof x === "number" && Number.isFinite(x)), sources = p.flatMap((x) => x.sources ?? []).filter((x, i, a) => a.findIndex((y) => y.source_name === x.source_name && y.url === x.url) === i);
	return {
		sample: samples.length ? Math.min(...samples) : null,
		sources
	};
}
var SUMMARY_KEYS = {
	"001": [
		"surface_elo",
		"current_surface_elo",
		"peak_surface_elo",
		"observed_peak_surface_elo",
		"surface_win_pct",
		"surface_matches",
		"surface_elo_trend",
		"surface_elo_change_last10",
		"peak_vs_current_elo_gap",
		"surface_elo_below_peak",
		"surface_win_pct_52w",
		"surface_matches_52w"
	],
	"002": [
		"service_points_won_pct",
		"first_serve_in_pct",
		"first_serve_points_won_pct",
		"second_serve_points_won_pct",
		"ace_rate_pct",
		"double_fault_rate_pct",
		"break_points_saved_pct",
		"hold_pct",
		"service_games_held"
	],
	"003": [
		"return_points_won_pct",
		"first_serve_return_points_won_pct",
		"second_serve_return_points_won_pct",
		"break_point_conversion_pct",
		"break_pct",
		"return_games_played",
		"break_points_created_per_return_game"
	],
	"004": [
		"service_points_won_pct",
		"return_points_won_pct",
		"total_points_won_pct",
		"hold_pct",
		"break_pct",
		"matchup_expected_hold_pct",
		"matchup_expected_break_pct",
		"expected_hold_break_differential",
		"dominance_ratio",
		"combined_point_efficiency"
	],
	"005": [
		"last5_win_pct",
		"last10_win_pct",
		"last5_set_win_pct",
		"last10_set_win_pct",
		"current_surface_recent_win_pct",
		"win_pct_60d",
		"win_pct_90d",
		"recent_form_trend",
		"recent_straight_set_control_pct",
		"recent_performance_acceleration",
		"avg_sets_conceded_in_recent_wins",
		"set_margin_mean",
		"overall_recent20_win_pct"
	],
	"006": [
		"recent_opponent_avg_elo",
		"best_recent_win_opponent_elo",
		"bad_loss_rate_pct",
		"comparable_strength_win_pct",
		"performance_vs_comparable_strength_pct"
	],
	"007": [
		"direct_common_opponents",
		"common_opponent_matches",
		"common_opponent_wins",
		"common_opponent_losses",
		"common_opponent_win_pct",
		"surface_matched_common_opponents",
		"tournament_level_matched_common_opponents",
		"common_opponent_recency_weighted_win_pct",
		"common_opponent_strength_weighted_win_pct",
		"common_opponent_weighted_set_margin",
		"common_opponent_second_degree_strength_pct"
	],
	"008": [
		"set1_win_pct",
		"set2_win_pct",
		"set3_deciding_set_win_pct",
		"deciding_set_win_pct",
		"historical_deciding_set_win_pct",
		"win_after_losing_set1_pct",
		"win_after_winning_set1_pct",
		"second_set_after_losing_set1_win_pct",
		"deciding_matches_played",
		"set_win_pct",
		"sets_played",
		"sets_won"
	],
	"009": [
		"win_after_losing_set1_pct",
		"tiebreak_win_pct",
		"tiebreaks_played"
	],
	"010": ["straight_set_match_win_pct", "straight_set_match_win_pct_comparable"],
	"011": [
		"performance_variance",
		"performance_floor_ceiling_set_margin_range",
		"close_match_dependency_pct",
		"deciding_tiebreak_win_reliance_pct"
	],
	"012": [
		"matches_last_7_days",
		"matches_last_14_days",
		"matches_last_28_days",
		"sets_last_14_days",
		"three_setters_last_14_days",
		"rest_days",
		"qualifying_matches_last_14_days",
		"days_since_last_match",
		"recent_inter_match_gap_days",
		"tournament_switches_last10",
		"country_changes_last10",
		"observed_travel_km_last10",
		"avg_observed_travel_km_per_move",
		"long_haul_moves_3000km_plus_last10",
		"observed_timezone_shift_hours_last10",
		"max_observed_timezone_shift_hours_last10"
	],
	"013": [
		"longest_observed_layoff_days",
		"observed_layoffs_30d_plus",
		"observed_layoffs_60d_plus",
		"observed_layoffs_90d_plus",
		"return_after_layoff_win_pct"
	],
	"020": ["same_level_matches", "same_level_win_pct"],
	"021": [
		"match_surface_hard",
		"match_surface_clay",
		"match_surface_grass",
		"match_surface_carpet",
		"match_indoor",
		"verified_court_speed_index",
		"verified_court_speed_band",
		"match_temperature_c",
		"match_humidity_pct",
		"match_wind_kph",
		"match_altitude_m",
		"match_roof_closed"
	],
	"023": [
		"serve_vs_opponent_return_edge",
		"return_vs_opponent_serve_edge",
		"serve_aggression_proxy",
		"serve_reliance_proxy",
		"return_pressure_proxy",
		"balanced_efficiency_proxy",
		"close_match_resilience_proxy",
		"style_serve_vs_return_edge",
		"style_return_vs_serve_edge",
		"style_balance_edge",
		"style_resilience_edge"
	],
	"028": [
		"matches_last_14_days",
		"matches_last_28_days",
		"days_since_last_match",
		"recent_inter_match_gap_days",
		"tournament_switches_last10",
		"country_changes_last10",
		"observed_travel_km_last10",
		"avg_observed_travel_km_per_move",
		"long_haul_moves_3000km_plus_last10",
		"observed_timezone_shift_hours_last10",
		"max_observed_timezone_shift_hours_last10",
		"same_round_matches",
		"same_round_win_pct"
	],
	"030": ["same_tournament_matches", "same_tournament_win_pct"],
	"035": ["observed_vs_expected_wl_gap_pct"],
	"055": [
		"elo_change_last5",
		"elo_change_last10",
		"elo_change_last20",
		"elo_change_per_match_last20",
		"surface_elo_change_last10",
		"recent_performance_acceleration",
		"recent_form_trend"
	],
	"068": ["current_streak_signed", "longest_win_streak_observed"],
	"080": [
		"recent_opponent_avg_elo",
		"best_recent_win_opponent_elo",
		"bad_loss_rate_pct",
		"comparable_strength_win_pct",
		"performance_vs_comparable_strength_pct",
		"common_opponent_strength_weighted_win_pct",
		"common_opponent_recency_weighted_win_pct"
	]
};
function summaryFor(map, code) {
	const keys = SUMMARY_KEYS[familyCode$1(code)];
	if (!keys) return null;
	const value = summarize$1(map, keys);
	if (!value) return null;
	const meta = summaryMeta(map, keys);
	return {
		value,
		sample: meta?.sample ?? null,
		sources: meta?.sources ?? []
	};
}
function metricLooksH2H(m) {
	return /\bh2h\b|head\s*[- ]?to\s*[- ]?head|direct meetings?|prior meetings?/i.test(`${m.name} ${m.body ?? ""}`);
}
function h2hSummary(map) {
	const keys = [
		"h2h_matches",
		"h2h_wins",
		"h2h_win_pct",
		"h2h_surface_matches",
		"h2h_surface_wins",
		"h2h_surface_win_pct",
		"h2h_recent3_win_pct"
	], value = summarize$1(map, keys), meta = summaryMeta(map, keys);
	return value ? {
		value,
		sample: meta?.sample ?? null,
		sources: meta?.sources ?? []
	} : null;
}
function selectedStats(p, o, c, requested) {
	const codes = new Set(requested.map((m) => familyCode$1(m.code))), out = [];
	const add = (rows) => out.push(...rows);
	if ([
		"001",
		"005",
		"055",
		"008"
	].some((code) => codes.has(code))) {
		add(getPredixDatasetEvidence(p, c)?.stats ?? []);
		add(getStrengthTrajectoryStats(p, c));
	}
	if ([
		"005",
		"006",
		"012"
	].some((code) => codes.has(code))) add(getRecentReconstruction(p, c));
	if ([
		"005",
		"035",
		"068"
	].some((code) => codes.has(code))) add(getDerivedHistoricalStats(p, c));
	if (["006", "080"].some((code) => codes.has(code))) add(getRankingPerformanceStats(p, c));
	if (requested.some(metricLooksH2H)) add(getH2HStats(p, o, c));
	if ([
		"002",
		"003",
		"004"
	].some((code) => codes.has(code))) add(getHistoricalServeReturnStats(p, c));
	if ([
		"008",
		"009",
		"010",
		"011"
	].some((code) => codes.has(code))) {
		add(getHistoricalScoreProfileStats(p, c));
		add(getRepositoryScoreProfileStats(p, c));
	}
	if (["004", "023"].some((code) => codes.has(code))) add(getMatchupEfficiencyStats(p, o, c));
	if (["007", "080"].some((code) => codes.has(code))) add(getEnhancedCommonOpponentStats(p, o, c));
	if (codes.has("013")) add(getAvailabilityHistoryStats(p, c));
	if ([
		"020",
		"028",
		"030"
	].some((code) => codes.has(code))) add(getTournamentContextStats(p, c));
	if (["012", "028"].some((code) => codes.has(code))) add(getTravelBurdenStats(p, c));
	if (codes.has("021")) {
		add(getCourtContextStats(p, c));
		add(getWeatherContextStats(p, c));
	}
	return out;
}
function localMetricRows(p1, p2, context, requested) {
	const amap = new Map(selectedStats(p1, p2, context, requested).map((s) => [s.key, s])), bmap = new Map(selectedStats(p2, p1, context, requested).map((s) => [s.key, s])), common = requested.some((m) => familyCode$1(m.code) === "007") ? getCommonOpponentEvidence(p1, p2, context) : null;
	return requested.map((m) => {
		let xs = metricLooksH2H(m) ? h2hSummary(amap) : summaryFor(amap, m.code), ys = metricLooksH2H(m) ? h2hSummary(bmap) : summaryFor(bmap, m.code);
		if (familyCode$1(m.code) === "007" && common) {
			const ax = summaryFor(amap, m.code), bx = summaryFor(bmap, m.code), src = [common.source];
			xs = {
				value: [
					`direct_common_opponents=${common.commonCount}`,
					`record=${common.p1Wins}-${common.p1Losses}`,
					`win_pct=${common.p1WinPct?.toFixed(1) ?? "NA"}`,
					ax?.value ?? null
				].filter(Boolean).join("; "),
				sample: Math.max(common.commonCount, ax?.sample ?? 0),
				sources: [...src, ...ax?.sources ?? []]
			};
			ys = {
				value: [
					`direct_common_opponents=${common.commonCount}`,
					`record=${common.p2Wins}-${common.p2Losses}`,
					`win_pct=${common.p2WinPct?.toFixed(1) ?? "NA"}`,
					bx?.value ?? null
				].filter(Boolean).join("; "),
				sample: Math.max(common.commonCount, bx?.sample ?? 0),
				sources: [...src, ...bx?.sources ?? []]
			};
		}
		const sources = [...xs?.sources ?? [], ...ys?.sources ?? []].filter((s, i, a) => a.findIndex((z) => z.source_name === s.source_name && z.url === s.url) === i), historicalDataHub = sources.some((s) => s.source_name.includes("DataHub ATP")), f = familyCode$1(m.code), evidenceFamily = xs || ys ? metricLooksH2H(m) ? "PUBLIC_HISTORICAL_H2H" : f === "007" ? "PUBLIC_COMMON_OPPONENT_NETWORK" : f === "020" ? "PUBLIC_TOUR_LEVEL_HISTORY" : f === "021" ? "VERIFIED_SURFACE_ENVIRONMENT" : f === "023" ? "PUBLIC_MATCHUP_COMPATIBILITY" : f === "028" ? "PUBLIC_SCHEDULING_CONTEXT" : f === "030" ? "PUBLIC_TOURNAMENT_HISTORY" : historicalDataHub ? `HISTORICAL_DATAHUB_FAMILY_${f}` : `PUBLIC_HISTORICAL_DATA_FAMILY_${f}` : null;
		const partialReason = f === "007" && (xs || ys) ? "PARTIAL: public match history supports direct shared-opponent records, recency weighting, same-surface filtering, set-margin comparison, opponent-strength weighting and second-degree chains when inputs exist. Exact game-by-game scoreline comparison and tournament-level matching remain source-dependent and are not inferred when absent." : f === "008" && (xs || ys) ? "PARTIAL: explicit set scores support Set-1/Set-2 win rates, deciding-set rate, records after winning/losing Set 1, and second-set response after losing Set 1. First-break frequency, immediate break-back rate, and set-by-set hold/return improvement require game/point sequence data and are not inferred from set scores." : f === "009" && (xs || ys) ? "PARTIAL: explicit score history supports comeback frequency from a Set-1 deficit and tiebreak record. Break-consolidation, serving-for-set, serving-for-match, combined pressure-point performance, and high-leverage clutch hold/break rates require chronological game/point state and are not replaced with generic break-point or close-match statistics." : f === "010" && (xs || ys) ? "PARTIAL: public score history supports straight-set match win rate and an Elo-comparable-opposition straight-set match win rate with the correct all-match denominator. A Monte Carlo straight-set probability for both players requires a legitimate independent simulation model and is not taken from Matrix outputs or invented from historical rates." : f === "011" && (xs || ys) ? "PARTIAL: public results support match-to-match set-margin variance, an observed recent floor-to-ceiling set-margin range, close-win dependency, and deciding-set/tiebreak win reliance. Upset Resistance explicitly requires lower-ranked opponents; Elo-defined weaker opponents are not substituted for official ranking evidence." : null;
		return buildTrustedInternalFinding({
			metric_code: m.code,
			players: {
				p1,
				p2
			},
			p1: xs ? {
				player: p1,
				value: xs.value,
				treatment: "PARTIAL",
				sample: xs.sample,
				sources: xs.sources
			} : null,
			p2: ys ? {
				player: p2,
				value: ys.value,
				treatment: "PARTIAL",
				sample: ys.sample,
				sources: ys.sources
			} : null,
			evidence_family: evidenceFamily,
			reliability: historicalDataHub ? 70 : 85,
			unavailable_reason: !xs && !ys ? "Synced public historical data does not support this metric family" : partialReason,
			persistedSources: sources
		});
	});
}
function mergeMetrics(live, local) {
	const by = new Map(live.map((m) => [String(m.metric_code), m]));
	return local.map((l) => {
		const m = by.get(String(l.metric_code));
		if (!m) return l;
		const p1 = m.p1_treatment !== "UNAVAILABLE" && m.p1_treatment !== "EXCLUDED" && m.p1_value !== null, p2 = m.p2_treatment !== "UNAVAILABLE" && m.p2_treatment !== "EXCLUDED" && m.p2_value !== null, p1Treatment = p1 ? m.p1_treatment : l.p1_value !== null ? l.p1_treatment : m.p1_treatment, p2Treatment = p2 ? m.p2_treatment : l.p2_value !== null ? l.p2_treatment : m.p2_treatment, partial = p1Treatment === "PARTIAL" || p2Treatment === "PARTIAL";
		return {
			...m,
			p1_value: p1 ? m.p1_value : l.p1_value,
			p1_treatment: p1Treatment,
			p2_value: p2 ? m.p2_value : l.p2_value,
			p2_treatment: p2Treatment,
			evidence_family: m.evidence_family ?? l.evidence_family,
			reliability: m.reliability ?? l.reliability,
			sample: m.sample ?? l.sample,
			sources: [...m.sources ?? [], ...l.sources ?? []].filter((s, i, a) => a.findIndex((z) => z.source_name === s.source_name && z.url === s.url) === i),
			unavailable_reason: partial ? m.unavailable_reason ?? l.unavailable_reason : p1 || p2 || l.p1_value !== null || l.p2_value !== null ? null : m.unavailable_reason ?? l.unavailable_reason
		};
	});
}
var hybridResearcher = {
	async identity(input) {
		const local = localIdentity(input);
		try {
			return mergeIdentity(local, await aiResearcher.identity(input));
		} catch (e) {
			if (!isProviderFailure(e)) throw e;
			return local;
		}
	},
	async dossier({ player, opponent, context }) {
		const local = predixDatasetDossier(player, context);
		try {
			return [local, await aiResearcher.dossier?.({
				player,
				opponent,
				context
			}) ?? ""].filter(Boolean).join("\n");
		} catch (e) {
			if (!isProviderFailure(e)) throw e;
			return local;
		}
	},
	async extractStats({ player, opponent: opponentIn, dossier, context }) {
		const opponent = opponentIn ?? "";
		const local = [
			...statsFromPredixDatasetDossier(dossier, player),
			...getRecentReconstruction(player, context),
			...getDerivedHistoricalStats(player, context),
			...getStrengthTrajectoryStats(player, context),
			...getRankingPerformanceStats(player, context),
			...getH2HStats(player, opponent, context),
			...getHistoricalServeReturnStats(player, context),
			...getHistoricalScoreProfileStats(player, context),
			...getRepositoryScoreProfileStats(player, context),
			...getMatchupEfficiencyStats(player, opponent, context),
			...getEnhancedCommonOpponentStats(player, opponent, context),
			...getAvailabilityHistoryStats(player, context),
			...getTournamentContextStats(player, context),
			...getTravelBurdenStats(player, context),
			...getCourtContextStats(player, context),
			...getWeatherContextStats(player, context)
		];
		try {
			const live = await aiResearcher.extractStats?.({
				player,
				dossier,
				context
			}) ?? [], seen = new Set(live.map((s) => `${s.key}|${s.surface ?? ""}|${s.window ?? ""}`));
			return [...live, ...local.filter((s) => !seen.has(`${s.key}|${s.surface ?? ""}|${s.window ?? ""}`))];
		} catch (e) {
			if (!isProviderFailure(e)) throw e;
			return local;
		}
	},
	async metrics(input) {
		const local = localMetricRows(input.p1, input.p2, input.context, input.metrics);
		let augmented = local;
		try {
			const wta = await officialWtaMetricRows({
				p1: input.p1,
				p2: input.p2,
				context: input.context,
				metrics: input.metrics
			});
			if (wta) augmented = mergeMetrics(local, wta);
		} catch (e) {
			if (!isProviderFailure(e)) throw e;
		}
		try {
			return mergeMetrics(await aiResearcher.metrics(input), augmented);
		} catch (e) {
			if (!isProviderFailure(e)) throw e;
			return augmented;
		}
	},
	rules: (i) => aiResearcher.rules(i),
	underdog: (i) => aiResearcher.underdog(i),
	conclusion: (i) => aiResearcher.conclusion(i),
	stress: (i) => aiResearcher.stress(i)
};
function providerFailure(error) {
	const m = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
	return /402|credit|quota|429|rate limit|timeout|provider|api key|auth|fetch|not configured|all research providers failed/.test(m);
}
function usableMetrics(evidence) {
	return evidence.metrics.filter((m) => m.p1 !== null || m.p2 !== null);
}
/**
* A provider outage must never turn partial metric availability into PASS.
* Rules that require semantic/falsification reasoning stay explicitly unavailable
* unless the real rule researcher executes them. This preserves honest coverage.
*/
function localRules(input) {
	const usable = usableMetrics(input.evidence);
	return input.rules.map((rule) => ({
		rule_code: rule.code,
		p1_finding: null,
		p2_finding: null,
		outcome: "UNAVAILABLE",
		severity: rule.severity === "CRITICAL" ? "CRITICAL" : "STANDARD",
		decision_effect: null,
		contradiction_severity: "NONE",
		supporting_evidence: usable.length ? `Independent evidence preserved (${usable.length} usable metric rows), but this rule was not semantically executed.` : null,
		opposing_evidence: null,
		final_effect: null,
		unavailable_reason: "RESEARCH_PROVIDER_UNAVAILABLE",
		missing_inputs: ["semantic rule execution"],
		sources: []
	}));
}
/** No invented WEAK classification: an unexecuted pathway is unresolved. */
function localUnderdog(input) {
	const usable = input.evidence.metrics.filter((m) => m.p1 !== null || m.p2 !== null);
	return input.pathways.map((p) => ({
		pathway_code: p.code,
		player_side: input.player_side,
		classification: "UNRESOLVED",
		evidence: usable.length ? `${usable.length} independent metric rows were preserved, but pathway-specific reasoning was not executed.` : null,
		repeatable: false,
		unavailable_reason: "RESEARCH_PROVIDER_UNAVAILABLE",
		missing_inputs: ["pathway-specific semantic execution"],
		sources: []
	}));
}
/** Stress tests cannot be called stable merely because an earlier winner exists. */
function localStress(input) {
	return input.tests.map((t) => ({
		test_code: t.code,
		winner_after: null,
		range_after: null,
		outcome: "UNAVAILABLE",
		note: "Stress test not executed because the semantic research provider was unavailable; no stability result was fabricated.",
		unavailable_reason: "RESEARCH_PROVIDER_UNAVAILABLE",
		missing_inputs: ["stress-test execution"],
		sources: []
	}));
}
function localConclusion(input) {
	const metrics = input.evidence.metrics.filter((m) => m.p1 !== null && m.p2 !== null);
	if (!metrics.length) return {
		winner: null,
		low: null,
		high: null,
		rationale: null,
		insufficient_reason: "No symmetric independent metric evidence was available."
	};
	return {
		winner: null,
		low: null,
		high: null,
		rationale: `${metrics.length} symmetric independent metric rows were preserved, but no deterministic conclusion scorer is available for provider-outage mode.`,
		insufficient_reason: "RESEARCH_PROVIDER_UNAVAILABLE"
	};
}
var resilientResearcher = {
	...hybridResearcher,
	async rules(input) {
		try {
			return await hybridResearcher.rules(input);
		} catch (e) {
			if (!providerFailure(e)) throw e;
			return localRules(input);
		}
	},
	async underdog(input) {
		try {
			return await hybridResearcher.underdog(input);
		} catch (e) {
			if (!providerFailure(e)) throw e;
			return localUnderdog(input);
		}
	},
	async conclusion(input) {
		try {
			return await hybridResearcher.conclusion(input);
		} catch (e) {
			if (!providerFailure(e)) throw e;
			return localConclusion(input);
		}
	},
	async stress(input) {
		try {
			return await hybridResearcher.stress(input);
		} catch (e) {
			if (!providerFailure(e)) throw e;
			return localStress(input);
		}
	}
};
function pick(stats, key) {
	return stats.find((s) => s.key === key)?.value ?? null;
}
function src(stats) {
	return stats[0] ?? null;
}
function statLike(base, key, value) {
	return {
		...base,
		key,
		value,
		origin: "RECONSTRUCTED"
	};
}
function clamp(v, min = 0, max = 100) {
	return Math.max(min, Math.min(max, v));
}
/**
* Builds transparent statistical tendencies from observed serve/return/score data.
* These are NOT subjective labels such as "aggressive baseliner" or "counterpuncher".
* They are numeric proxies used only when the underlying statistics exist.
*/
function getStyleProfileStats(player, context) {
	const sr = getHistoricalServeReturnStats(player, context), sp = getHistoricalScoreProfileStats(player, context), base = src(sr) ?? src(sp);
	if (!base) return [];
	const out = [];
	const ace = pick(sr, "ace_rate_pct"), df = pick(sr, "double_fault_rate_pct"), hold = pick(sr, "hold_pct"), brk = pick(sr, "break_pct"), spw = pick(sr, "service_points_won_pct"), rpw = pick(sr, "return_points_won_pct"), tb = pick(sp, "tiebreak_win_pct"), dec = pick(sp, "historical_deciding_set_win_pct");
	if (ace !== null && df !== null) out.push(statLike(base, "serve_aggression_proxy", clamp(50 + 2.5 * (ace - df))));
	if (hold !== null && brk !== null) out.push(statLike(base, "serve_reliance_proxy", clamp(50 + (hold - (100 - brk)))));
	if (rpw !== null && brk !== null) out.push(statLike(base, "return_pressure_proxy", clamp(rpw + brk)));
	if (spw !== null && rpw !== null) out.push(statLike(base, "balanced_efficiency_proxy", clamp(50 + 2 * (spw + rpw - 100))));
	if (tb !== null && dec !== null) out.push(statLike(base, "close_match_resilience_proxy", clamp((tb + dec) / 2)));
	return out;
}
/**
* Pairwise style interaction derived from each player's numeric proxies.
* Positive values mean this player's statistical profile is better positioned
* relative to the opponent on the available dimensions; it is not a win probability.
*/
function getStyleMatchupStats(player, opponent, context) {
	const a = getStyleProfileStats(player, context), b = getStyleProfileStats(opponent, context), base = src(a);
	if (!base) return [];
	const out = [];
	const ap = (k) => pick(a, k), bp = (k) => pick(b, k);
	const serve = ap("serve_aggression_proxy"), oppReturn = bp("return_pressure_proxy");
	if (serve !== null && oppReturn !== null) out.push(statLike(base, "style_serve_vs_return_edge", serve - oppReturn));
	const ret = ap("return_pressure_proxy"), oppServe = bp("serve_aggression_proxy");
	if (ret !== null && oppServe !== null) out.push(statLike(base, "style_return_vs_serve_edge", ret - oppServe));
	const bal = ap("balanced_efficiency_proxy"), obal = bp("balanced_efficiency_proxy");
	if (bal !== null && obal !== null) out.push(statLike(base, "style_balance_edge", bal - obal));
	const res = ap("close_match_resilience_proxy"), ores = bp("close_match_resilience_proxy");
	if (res !== null && ores !== null) out.push(statLike(base, "style_resilience_edge", res - ores));
	return out;
}
var clean = (v) => (v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
var date = (v) => {
	const x = clean(v).replace(/ /g, "-");
	const m = x.match(/(20\d{2})[-]?(\d{2})[-]?(\d{2})/);
	return m ? `${m[1]}-${m[2]}-${m[3]}` : x;
};
function canonicalMatchKey(m) {
	const players = [clean(m.player1), clean(m.player2)].sort();
	return [
		clean(m.tour),
		date(m.date),
		clean(m.tournament),
		clean(m.round),
		players[0],
		players[1]
	].join("|");
}
var PRIORITY = [
	"official",
	"datahub",
	"tennis-data",
	"current",
	"archive",
	"other"
];
function priority(source) {
	const s = clean(source);
	const i = PRIORITY.findIndex((x) => s.includes(x));
	return i < 0 ? PRIORITY.length : i;
}
function dedupeHistoricalMatches(rows) {
	const groups = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const k = canonicalMatchKey(row);
		const g = groups.get(k) ?? [];
		g.push(row);
		groups.set(k, g);
	}
	const out = [];
	for (const [canonicalKey, items] of groups) {
		items.sort((a, b) => priority(a.source) - priority(b.source));
		const primary = items[0];
		out.push({
			canonicalKey,
			primary,
			duplicates: items.slice(1),
			sources: [...new Set(items.map((x) => x.source))]
		});
	}
	return out;
}
function enrichWithoutDoubleCounting(group) {
	const merged = { ...group.primary };
	for (const d of group.duplicates) for (const [k, v] of Object.entries(d)) if ((merged[k] === null || merged[k] === void 0 || merged[k] === "") && v !== null && v !== void 0 && v !== "") merged[k] = v;
	merged.source = group.sources.join(" + ");
	return merged;
}
var HISTORICAL_SOURCE_POLICIES = [
	{
		id: "current",
		tours: ["ATP", "WTA"],
		priority: 0,
		enabled: true,
		mayFillHistoricalGaps: true,
		reuseTermsVerified: true
	},
	{
		id: "official",
		tours: ["ATP", "WTA"],
		priority: 1,
		enabled: true,
		mayFillHistoricalGaps: true,
		reuseTermsVerified: true
	},
	{
		id: "tennis-data",
		tours: ["ATP", "WTA"],
		priority: 2,
		enabled: true,
		mayFillHistoricalGaps: true,
		reuseTermsVerified: true
	},
	{
		id: "datahub-atp",
		tours: ["ATP"],
		priority: 3,
		enabled: true,
		mayFillHistoricalGaps: true,
		reuseTermsVerified: true
	},
	{
		id: "tennismylife",
		tours: ["ATP", "WTA"],
		priority: 4,
		enabled: false,
		mayFillHistoricalGaps: false,
		reuseTermsVerified: false
	}
];
function isOnOrAfterHistoricalCutoff(value) {
	if (!value) return false;
	const d = value instanceof Date ? value : new Date(value);
	return Number.isFinite(d.getTime()) && d.getTime() >= Date.parse(`2005-01-01T00:00:00Z`);
}
function sourcePolicy(id) {
	const policy = HISTORICAL_SOURCE_POLICIES.find((x) => x.id === id);
	if (!policy) throw new Error(`Unknown historical source: ${id}`);
	return policy;
}
function sourceCanContribute(id, tour, date) {
	const p = sourcePolicy(id);
	return p.enabled && p.reuseTermsVerified && p.tours.includes(tour) && isOnOrAfterHistoricalCutoff(date);
}
var ROOT$1 = join(process.cwd(), "data/public/tennis-data");
var SOURCE_NAME$1 = "Tennis-Data historical ATP/WTA results";
var cache$1 = null;
function norm$2(v) {
	return (v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function parseCsv$1(text) {
	const rows = [];
	let r = [], c = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const x = text[i];
		if (x === "\"") {
			if (q && text[i + 1] === "\"") {
				c += "\"";
				i++;
			} else q = !q;
		} else if (x === "," && !q) {
			r.push(c);
			c = "";
		} else if ((x === "\n" || x === "\r") && !q) {
			if (x === "\r" && text[i + 1] === "\n") i++;
			r.push(c);
			c = "";
			if (r.some(Boolean)) rows.push(r);
			r = [];
		} else c += x;
	}
	if (c || r.length) {
		r.push(c);
		rows.push(r);
	}
	if (!rows.length) return [];
	const h = rows[0].map((x) => x.trim());
	return rows.slice(1).map((a) => Object.fromEntries(h.map((k, i) => [k, (a[i] ?? "").trim()])));
}
function toMatch(r) {
	const tour = (r.tour ?? "").toUpperCase();
	if (tour !== "ATP" && tour !== "WTA" || !r.date || !r.winner || !r.loser || !sourceCanContribute("tennis-data", tour, r.date)) return null;
	return {
		source: "tennis-data",
		sourceMatchId: null,
		sourceUrl: r.source_url ?? "https://www.tennis-data.co.uk/alldata.php",
		tour,
		date: r.date,
		tournament: r.tournament ?? "",
		location: r.location ?? "",
		eventLevel: r.event_level ?? "",
		court: r.court ?? "",
		surface: r.surface ?? "",
		round: r.round ?? "",
		bestOf: r.best_of ?? "",
		winner: r.winner,
		loser: r.loser,
		winnerRank: r.winner_rank ?? "",
		loserRank: r.loser_rank ?? "",
		score: r.score ?? "",
		comment: r.comment ?? "",
		player1: r.winner,
		player2: r.loser
	};
}
function load$1() {
	if (cache$1) return cache$1;
	const all = [];
	try {
		for (const tour of ["atp", "wta"]) {
			const dir = join(ROOT$1, tour);
			if (!existsSync(dir)) continue;
			for (const f of readdirSync(dir).filter((x) => /^20\d{2}\.csv$/.test(x)).sort()) for (const r of parseCsv$1(readFileSync(join(dir, f), "utf8"))) {
				const m = toMatch(r);
				if (m) all.push(m);
			}
		}
	} catch {
		return [];
	}
	cache$1 = dedupeHistoricalMatches(all).map(enrichWithoutDoubleCounting);
	return cache$1;
}
function cut(ctx) {
	return ctx.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function surface$1(ctx) {
	return ctx.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase() ?? null;
}
function tournament(ctx) {
	return ctx.match(/tournament\s+([^·]+)/i)?.[1]?.trim() ?? null;
}
function round(ctx) {
	return ctx.match(/round\s+([^·]+)/i)?.[1]?.trim() ?? null;
}
function level(ctx) {
	return ctx.match(/(?:event_?level|level)\s+([^·]+)/i)?.[1]?.trim() ?? null;
}
function n(v) {
	const x = Number(v);
	return Number.isFinite(x) ? x : null;
}
function stat$1(player, key, value, sample, url, surfaceName = null) {
	return {
		key,
		player,
		value,
		surface: surfaceName,
		window: "HISTORICAL_2005_PRE_MATCH",
		tour_level: null,
		sample,
		origin: "DIRECT",
		sources: [{
			source_name: SOURCE_NAME$1,
			url,
			retrieved_at: null
		}]
	};
}
function playerMatches(player, ctx) {
	const pn = norm$2(player), c = cut(ctx);
	if (!c) return [];
	return load$1().filter((m) => isBeforeCutoff(m.date, c) && m.date >= "2005-01-01" && (norm$2(m.winner) === pn || norm$2(m.loser) === pn)).sort((a, b) => a.date.localeCompare(b.date));
}
function won(m, p) {
	return norm$2(m.winner) === norm$2(p);
}
function sets(score) {
	return score.split(/\s+/).map((s) => s.match(/^(\d+)-(\d+)/)).filter((m) => !!m).map((m) => [Number(m[1]), Number(m[2])]);
}
function getTennisDataHistoricalStats(player, context) {
	const rows = playerMatches(player, context);
	if (!rows.length) return [];
	const s = surface$1(context), surfaceRows = s ? rows.filter((r) => norm$2(r.surface) === s) : rows, chosen = surfaceRows.length ? surfaceRows : rows, url = chosen[chosen.length - 1]?.sourceUrl ?? "https://www.tennis-data.co.uk/alldata.php", out = [];
	const wins = chosen.filter((r) => won(r, player)).length, losses = chosen.length - wins;
	out.push(stat$1(player, "wins", wins, chosen.length, url, s), stat$1(player, "losses", losses, chosen.length, url, s), stat$1(player, "matches_played", chosen.length, chosen.length, url, s), stat$1(player, "win_pct", 100 * wins / chosen.length, chosen.length, url, s));
	if (s) out.push(stat$1(player, "surface_matches", chosen.length, chosen.length, url, s), stat$1(player, "surface_wins", wins, chosen.length, url, s), stat$1(player, "surface_losses", losses, chosen.length, url, s), stat$1(player, "surface_win_pct", 100 * wins / chosen.length, chosen.length, url, s));
	let setsPlayed = 0, setsWon = 0, straightWins = 0, deciding = 0, decidingWins = 0;
	for (const m of chosen) {
		const isW = won(m, player), ss = sets(m.score);
		if (!ss.length) continue;
		for (const [a, b] of ss) {
			setsPlayed++;
			setsWon += isW ? a > b ? 1 : 0 : a < b ? 1 : 0;
		}
		if (isW && ss.every(([a, b]) => a > b)) straightWins++;
		if (ss.length >= 3) {
			deciding++;
			if (isW) decidingWins++;
		}
	}
	if (setsPlayed) out.push(stat$1(player, "sets_played", setsPlayed, chosen.length, url, s), stat$1(player, "sets_won", setsWon, chosen.length, url, s), stat$1(player, "set_win_pct", 100 * setsWon / setsPlayed, chosen.length, url, s));
	if (wins) out.push(stat$1(player, "matches_won", wins, chosen.length, url, s), stat$1(player, "straight_set_wins", straightWins, chosen.length, url, s), stat$1(player, "straight_set_win_pct", 100 * straightWins / wins, wins, url, s));
	if (deciding) out.push(stat$1(player, "deciding_sets_played", deciding, deciding, url, s), stat$1(player, "deciding_sets_won", decidingWins, deciding, url, s), stat$1(player, "deciding_set_win_pct", 100 * decidingWins / deciding, deciding, url, s));
	const c = cut(context);
	if (c) {
		const end = Date.parse(`${c}T00:00:00Z`), start = end - 24192e5, recent = rows.filter((r) => {
			const t = Date.parse(`${r.date}T00:00:00Z`);
			return Number.isFinite(t) && t >= start && t < end;
		});
		out.push(stat$1(player, "matches_last_28_days", recent.length, recent.length, url, s));
		const last = rows[rows.length - 1];
		if (last) {
			const days = Math.max(0, Math.floor((end - Date.parse(`${last.date}T00:00:00Z`)) / 864e5));
			out.push(stat$1(player, "days_since_last_match", days, rows.length, url, s));
		}
	}
	const tn = tournament(context), rn = round(context), lv = level(context);
	if (tn) {
		const z = rows.filter((r) => norm$2(r.tournament) === norm$2(tn));
		if (z.length) {
			const w = z.filter((r) => won(r, player)).length;
			out.push(stat$1(player, "same_tournament_matches", z.length, z.length, url, s), stat$1(player, "same_tournament_win_pct", 100 * w / z.length, z.length, url, s));
		}
	}
	if (rn) {
		const z = rows.filter((r) => norm$2(r.round) === norm$2(rn));
		if (z.length) {
			const w = z.filter((r) => won(r, player)).length;
			out.push(stat$1(player, "same_round_matches", z.length, z.length, url, s), stat$1(player, "same_round_win_pct", 100 * w / z.length, z.length, url, s));
		}
	}
	if (lv) {
		const z = rows.filter((r) => norm$2(r.eventLevel) === norm$2(lv));
		if (z.length) {
			const w = z.filter((r) => won(r, player)).length;
			out.push(stat$1(player, "same_level_matches", z.length, z.length, url, s), stat$1(player, "same_level_win_pct", 100 * w / z.length, z.length, url, s));
		}
	}
	const latestRank = [...rows].reverse().map((m) => won(m, player) ? n(m.winnerRank) : n(m.loserRank)).find((x) => x !== null);
	if (latestRank !== void 0) out.push(stat$1(player, "ranking", latestRank, 1, url, s));
	const ranks = rows.map((m) => won(m, player) ? n(m.winnerRank) : n(m.loserRank)).filter((x) => x !== null);
	if (ranks.length) {
		const peak = Math.min(...ranks);
		out.push(stat$1(player, "peak_ranking", peak, ranks.length, url, s), stat$1(player, "ranking_gap_to_peak", latestRank !== void 0 ? latestRank - peak : 0, ranks.length, url, s));
	}
	return out;
}
var ROOT = join(process.cwd(), "data/public/tennis-data");
var SOURCE_NAME = "Tennis-Data historical ATP/WTA results";
var SOURCE_URL = "https://www.tennis-data.co.uk/alldata.php";
var cache = null;
function norm$1(v) {
	return (v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function parseCsv(text) {
	const rows = [];
	let r = [], c = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const x = text[i];
		if (x === "\"") {
			if (q && text[i + 1] === "\"") {
				c += "\"";
				i++;
			} else q = !q;
		} else if (x === "," && !q) {
			r.push(c);
			c = "";
		} else if ((x === "\n" || x === "\r") && !q) {
			if (x === "\r" && text[i + 1] === "\n") i++;
			r.push(c);
			c = "";
			if (r.some(Boolean)) rows.push(r);
			r = [];
		} else c += x;
	}
	if (c || r.length) {
		r.push(c);
		rows.push(r);
	}
	if (!rows.length) return [];
	const h = rows[0].map((x) => x.trim());
	return rows.slice(1).map((a) => Object.fromEntries(h.map((k, i) => [k, (a[i] ?? "").trim()])));
}
function load() {
	if (cache) return cache;
	const out = [];
	try {
		for (const tour of ["atp", "wta"]) {
			const dir = join(ROOT, tour);
			if (!existsSync(dir)) continue;
			for (const f of readdirSync(dir).filter((x) => /^20\d{2}\.csv$/.test(x))) for (const r of parseCsv(readFileSync(join(dir, f), "utf8"))) if (r.date && r.winner && r.loser) out.push({
				date: r.date,
				surface: r.surface ?? "",
				winner: r.winner,
				loser: r.loser,
				score: r.score ?? "",
				winnerRank: r.winner_rank ?? "",
				loserRank: r.loser_rank ?? ""
			});
		}
	} catch {
		return [];
	}
	cache = out.sort((a, b) => a.date.localeCompare(b.date));
	return cache;
}
function cutoff(ctx) {
	return ctx.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
}
function surface(ctx) {
	return ctx.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase() ?? null;
}
function scoreSets(score) {
	return score.split(/\s+/).map((s) => s.match(/^(\d+)-(\d+)/)).filter((m) => !!m).map((m) => [Number(m[1]), Number(m[2])]);
}
function computeOffseasonRestLengthDays(matchDates, cutoffDate) {
	const year = cutoffDate.slice(0, 4), priorYear = String(Number(year) - 1);
	const priorYearMs = matchDates.filter((d) => d.startsWith(priorYear)).map((d) => Date.parse(`${d}T00:00:00Z`));
	if (!priorYearMs.length) return null;
	const seasonMs = matchDates.filter((d) => d.startsWith(year)).map((d) => Date.parse(`${d}T00:00:00Z`)).sort((a, b) => a - b);
	const lastPriorYearMatch = Math.max(...priorYearMs);
	const seasonStart = seasonMs.length ? seasonMs[0] : Date.parse(`${cutoffDate}T00:00:00Z`);
	return {
		days: Math.max(0, Math.round((seasonStart - lastPriorYearMatch) / 864e5)),
		priorYearMatches: priorYearMs.length
	};
}
function stat(player, key, value, sample, s) {
	return {
		key,
		player,
		value,
		surface: s,
		window: "HISTORICAL_2005_PRE_MATCH",
		tour_level: null,
		sample,
		origin: "RECONSTRUCTED",
		sources: [{
			source_name: SOURCE_NAME,
			url: SOURCE_URL,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}]
	};
}
function getExtendedTennisDataStats(player, context) {
	const pn = norm$1(player), cut = cutoff(context), surf = surface(context);
	if (!cut) return [];
	let rows = load().filter((m) => isBeforeCutoff(m.date, cut) && (norm$1(m.winner) === pn || norm$1(m.loser) === pn));
	if (!rows.length) return [];
	const surfaceRows = surf ? rows.filter((m) => norm$1(m.surface) === surf) : [];
	const chosen = surfaceRows.length ? surfaceRows : rows;
	const out = [];
	const isWin = (m) => norm$1(m.winner) === pn;
	const seq = rows.map(isWin);
	if (seq.length) {
		const last = seq[seq.length - 1], sign = last ? 1 : -1;
		let streak = 0;
		for (let i = seq.length - 1; i >= 0 && seq[i] === last; i--) streak++;
		out.push(stat(player, "current_streak_signed", sign * streak, seq.length, surf));
		let best = 0, run = 0;
		for (const w of seq) if (w) {
			run++;
			best = Math.max(best, run);
		} else run = 0;
		out.push(stat(player, "longest_win_streak_observed", best, seq.length, surf));
	}
	let firstSetWins = 0, converted = 0, deciding = 0, decidingWins = 0;
	for (const m of chosen) {
		const ss = scoreSets(m.score);
		if (!ss.length) continue;
		const w = isWin(m);
		const [a, b] = ss[0];
		if (w ? a > b : a < b) {
			firstSetWins++;
			if (w) converted++;
		}
		if (ss.length >= 3) {
			deciding++;
			if (w) decidingWins++;
		}
	}
	if (firstSetWins) {
		out.push(stat(player, "first_set_win_to_match_conversion_pct", 100 * converted / firstSetWins, firstSetWins, surf));
		out.push(stat(player, "one_set_up_collapse_rate_pct", 100 * (firstSetWins - converted) / firstSetWins, firstSetWins, surf));
	}
	if (deciding) out.push(stat(player, "deciding_set_closing_pct", 100 * decidingWins / deciding, deciding, surf));
	if (cut) {
		const year = cut.slice(0, 4), season = rows.filter((m) => m.date.startsWith(year));
		out.push(stat(player, "season_matches_before_lock", season.length, season.length, surf));
		const offseason = computeOffseasonRestLengthDays(rows.map((m) => m.date), cut);
		if (offseason) out.push(stat(player, "offseason_rest_length_days", offseason.days, offseason.priorYearMatches, surf));
	}
	const winRanks = rows.filter(isWin).slice(-10).map((m) => Number(m.loserRank)).filter(Number.isFinite);
	if (winRanks.length) out.push(stat(player, "recent_win_opponent_rank_mean", winRanks.reduce((a, b) => a + b, 0) / winRanks.length, winRanks.length, surf));
	return out;
}
function familyCode(code) {
	const m = String(code).match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(code).padStart(3, "0");
}
function summarize(stats) {
	return stats.length ? stats.map((s) => `${s.key}=${Number(s.value).toFixed(2)}`).join("; ") : null;
}
function usable(v, t) {
	return v !== null && t !== "UNAVAILABLE" && t !== "EXCLUDED";
}
function unresolved(m) {
	return !m || !usable(m.p1_value, m.p1_treatment) || !usable(m.p2_value, m.p2_treatment);
}
function dedupe(stats) {
	const m = /* @__PURE__ */ new Map();
	for (const s of stats) {
		const k = `${s.key}|${s.player.toLowerCase()}|${s.surface ?? ""}|${s.window ?? ""}`, old = m.get(k);
		if (!old || old.origin === "RECONSTRUCTED" && s.origin === "DIRECT") m.set(k, s);
	}
	return [...m.values()];
}
function withDeterministicReconstruction(stats) {
	const direct = sanitizeEvidence(stats), outcome = reconstruct(direct);
	return dedupe([...direct, ...outcome.derived]);
}
function localHistorical(p, c) {
	try {
		return dedupe([...getTennisDataHistoricalStats(p, c), ...getExtendedTennisDataStats(p, c)]);
	} catch {
		return [];
	}
}
function sourcesFor(stats) {
	return stats.flatMap((s) => s.sources ?? []).filter((s, i, a) => a.findIndex((x) => x.source_name === s.source_name && x.url === s.url) === i);
}
function selected(stats, keys) {
	const w = new Set(keys);
	return stats.filter((s) => w.has(s.key));
}
var HISTORICAL_KEYS = {
	"001": ["surface_win_pct", "surface_matches"],
	"005": [
		"win_pct",
		"surface_win_pct",
		"set_win_pct",
		"matches_last_28_days",
		"days_since_last_match"
	],
	"014": [
		"ranking",
		"peak_ranking",
		"ranking_gap_to_peak"
	],
	"020": ["same_level_matches", "same_level_win_pct"],
	"027": [
		"first_set_win_to_match_conversion_pct",
		"one_set_up_collapse_rate_pct",
		"deciding_set_closing_pct"
	],
	"028": [
		"matches_last_28_days",
		"days_since_last_match",
		"same_round_matches",
		"same_round_win_pct"
	],
	"030": ["same_tournament_matches", "same_tournament_win_pct"],
	"068": ["current_streak_signed", "longest_win_streak_observed"],
	"077": [
		"offseason_rest_length_days",
		"season_matches_before_lock",
		"matches_last_28_days",
		"days_since_last_match"
	]
};
var CONSERVATIVE_PARTIAL_FAMILIES = /* @__PURE__ */ new Set([
	"007",
	"008",
	"009",
	"010",
	"011",
	"035",
	"055",
	"068",
	"080"
]);
var NO_RETRY_COMPOSITE_FAMILIES = /* @__PURE__ */ new Set([
	"007",
	"008",
	"009",
	"010",
	"011"
]);
var STRICT_FIELDS = {
	"007": /* @__PURE__ */ new Set([
		"direct_common_opponents",
		"record",
		"win_pct",
		"common_opponent_matches",
		"common_opponent_wins",
		"common_opponent_losses",
		"common_opponent_win_pct",
		"surface_matched_common_opponents",
		"tournament_level_matched_common_opponents",
		"common_opponent_recency_weighted_win_pct",
		"common_opponent_strength_weighted_win_pct",
		"common_opponent_weighted_set_margin",
		"common_opponent_second_degree_strength_pct"
	]),
	"008": /* @__PURE__ */ new Set([
		"set1_win_pct",
		"set2_win_pct",
		"set3_deciding_set_win_pct",
		"historical_deciding_set_win_pct",
		"win_after_losing_set1_pct",
		"win_after_winning_set1_pct",
		"second_set_after_losing_set1_win_pct"
	]),
	"009": /* @__PURE__ */ new Set([
		"win_after_losing_set1_pct",
		"tiebreak_win_pct",
		"tiebreaks_played"
	]),
	"010": /* @__PURE__ */ new Set(["straight_set_match_win_pct", "straight_set_match_win_pct_comparable"]),
	"011": /* @__PURE__ */ new Set([
		"performance_variance",
		"performance_floor_ceiling_set_margin_range",
		"close_match_dependency_pct",
		"deciding_tiebreak_win_reliance_pct"
	])
};
var STRICT_SOURCES = {
	"007": /PredixSport/i,
	"008": /DataHub ATP/i,
	"009": /DataHub ATP/i,
	"010": /(DataHub ATP|PredixSport)/i,
	"011": /(DataHub ATP|PredixSport)/i
};
var STRICT_FAMILY = {
	"007": "PUBLIC_COMMON_OPPONENT_NETWORK",
	"008": "HISTORICAL_DATAHUB_FAMILY_008",
	"009": "HISTORICAL_DATAHUB_FAMILY_009",
	"010": "PUBLIC_STRAIGHT_SET_HISTORY",
	"011": "PUBLIC_VOLATILITY_FLOOR_HISTORY"
};
var STRICT_MISSING = {
	"007": ["full game-score comparison where unavailable", "tournament-level matching where row level is absent"],
	"008": [
		"first-break frequency",
		"break-back rate",
		"Set 1 to Sets 2/3 hold/return improvement"
	],
	"009": [
		"break-consolidation rate",
		"serving-for-set conversion",
		"serving-for-match conversion",
		"combined break/set/match pressure-point performance",
		"high-leverage clutch hold/break performance"
	],
	"010": ["independent Monte Carlo straight-set probability for both players"],
	"011": ["official-ranking-based upset resistance"]
};
function strictSegments(v, a) {
	if (!v) return null;
	const k = v.split(";").map((x) => x.trim()).filter(Boolean).filter((x) => {
		const i = x.indexOf("=");
		return i > 0 && a.has(x.slice(0, i).trim());
	});
	return k.length ? k.join("; ") : null;
}
function enforceFiveMetricWiring(metric, finding) {
	const f = familyCode(metric.code), a = STRICT_FIELDS[f];
	if (!a) return finding;
	const p1 = strictSegments(finding.p1_value, a), p2 = strictSegments(finding.p2_value, a), sources = (finding.sources ?? []).filter((s) => STRICT_SOURCES[f].test(s.source_name)), ok = sources.length > 0, p1ok = !!p1 && ok, p2ok = !!p2 && ok, missing = [.../* @__PURE__ */ new Set([...finding.missing_inputs ?? [], ...STRICT_MISSING[f]])];
	return {
		...finding,
		p1_value: p1ok ? p1 : null,
		p2_value: p2ok ? p2 : null,
		p1_treatment: p1ok ? "PARTIAL" : "UNAVAILABLE",
		p2_treatment: p2ok ? "PARTIAL" : "UNAVAILABLE",
		evidence_family: p1ok || p2ok ? STRICT_FAMILY[f] : null,
		sources,
		unavailable_reason: p1ok || p2ok ? `PARTIAL: exact-field guard retained only master-definition inputs; unsupported components remain missing (${STRICT_MISSING[f].join(", ")}).` : `UNAVAILABLE: no approved exact-field value with matching provenance survived the post-fix wiring guard.`,
		missing_inputs: missing
	};
}
function completionSweepHistoricalFinding(input, metric) {
	const f = familyCode(metric.code), keys = HISTORICAL_KEYS[f];
	if (!keys) return null;
	const a = withDeterministicReconstruction(localHistorical(input.p1, input.context)), b = withDeterministicReconstruction(localHistorical(input.p2, input.context));
	let p1 = selected(a, keys), p2 = selected(b, keys);
	if (f === "027") {
		const x = p1;
		p1 = p2;
		p2 = x;
	}
	const p1Value = summarize(p1), p2Value = summarize(p2);
	if (!p1Value && !p2Value) return null;
	return {
		metric_code: metric.code,
		p1_value: p1Value,
		p2_value: p2Value,
		p1_treatment: p1Value ? "PARTIAL" : "UNAVAILABLE",
		p2_treatment: p2Value ? "PARTIAL" : "UNAVAILABLE",
		differential: null,
		evidence_family: `TENNIS_DATA_HISTORY_${f}`,
		reliability: 70,
		sample: String(Math.max(...[...p1, ...p2].map((s) => s.sample ?? 0), 0)) || null,
		unavailable_reason: !p1Value || !p2Value ? "One player side lacked the sourced historical inputs required for this metric family." : null,
		missing_inputs: !p1Value || !p2Value ? ["sourced historical inputs for unsupported player side"] : void 0,
		sources: sourcesFor([...p1, ...p2])
	};
}
function prefer(a, b) {
	if (!b) return a;
	if (!a) return b;
	const p1 = usable(a.p1_value, a.p1_treatment), p2 = usable(a.p2_value, a.p2_treatment);
	return {
		...a,
		p1_value: p1 ? a.p1_value : b.p1_value,
		p1_treatment: p1 ? a.p1_treatment : b.p1_treatment,
		p2_value: p2 ? a.p2_value : b.p2_value,
		p2_treatment: p2 ? a.p2_treatment : b.p2_treatment,
		evidence_family: a.evidence_family ?? b.evidence_family,
		reliability: a.reliability ?? b.reliability,
		sample: a.sample ?? b.sample,
		unavailable_reason: p1 || p2 || b.p1_value || b.p2_value ? null : a.unavailable_reason ?? b.unavailable_reason,
		missing_inputs: p1 && p2 ? void 0 : a.missing_inputs ?? b.missing_inputs,
		sources: [...a.sources ?? [], ...b.sources ?? []].filter((s, i, x) => x.findIndex((z) => z.source_name === s.source_name && z.url === s.url) === i)
	};
}
function conservativePartial(metric, finding) {
	const f = familyCode(metric.code);
	if (!CONSERVATIVE_PARTIAL_FAMILIES.has(f)) return finding;
	const a = finding.p1_treatment === "DIRECT" || finding.p1_treatment === "RECONSTRUCTED", b = finding.p2_treatment === "DIRECT" || finding.p2_treatment === "RECONSTRUCTED";
	return {
		...finding,
		p1_treatment: a ? "PARTIAL" : finding.p1_treatment,
		p2_treatment: b ? "PARTIAL" : finding.p2_treatment,
		unavailable_reason: a || b ? finding.unavailable_reason ?? "Composite family capped at PARTIAL unless every master-definition component is independently verified." : finding.unavailable_reason
	};
}
var completionSweepResearcher = {
	...resilientResearcher,
	async metrics(input) {
		const base = await resilientResearcher.metrics(input), by = new Map(base.map((m) => [String(m.metric_code), m]));
		for (const m of input.metrics) by.set(String(m.code), prefer(by.get(String(m.code)), completionSweepHistoricalFinding(input, m)));
		const retry = input.metrics.filter((m) => !NO_RETRY_COMPOSITE_FAMILIES.has(familyCode(m.code)) && unresolved(by.get(String(m.code))));
		for (const m of retry) try {
			const c = (await resilientResearcher.metrics({
				...input,
				metrics: [m]
			})).find((x) => String(x.metric_code) === String(m.code));
			if (c) by.set(String(m.code), prefer(by.get(String(m.code)), c));
		} catch {}
		return input.metrics.map((m) => certifyMetricFinding(enforceFiveMetricWiring(m, conservativePartial(m, by.get(String(m.code)) ?? {
			metric_code: m.code,
			p1_value: null,
			p2_value: null,
			p1_treatment: "UNAVAILABLE",
			p2_treatment: "UNAVAILABLE",
			differential: null,
			evidence_family: null,
			reliability: null,
			sample: null,
			unavailable_reason: "All configured direct and approved reconstruction paths were exhausted without sufficient sourced inputs.",
			missing_inputs: ["no supported sourced inputs after completion sweep"],
			sources: []
		}))));
	},
	async extractStats(input) {
		const base = await resilientResearcher.extractStats?.(input) ?? [], historical = localHistorical(input.player, input.context), reconstructed = withDeterministicReconstruction([...base, ...historical]), style = [...getStyleProfileStats(input.player, input.context), ...getStyleMatchupStats(input.player, input.opponent ?? "", input.context)];
		return dedupe([...reconstructed, ...style]);
	}
};
function canonicalApprovedPbpIdentity(args) {
	const identity = buildCanonicalEvidenceMatchIdentity({
		player1Name: args.player1,
		player2Name: args.player2,
		tournament: args.tournament,
		date: args.date,
		round: args.round,
		tour: args.tour,
		eventLevel: args.eventLevel
	});
	if (!evidenceTourCompatible(args.tour, identity.tourFamily)) return null;
	const freeTextTourFamily = classifyEvidenceTourFamily(args.eventLevel, args.tournament);
	if (freeTextTourFamily && !evidenceTourCompatible(args.tour, freeTextTourFamily)) return null;
	return identity;
}
function claimUniqueApprovedPbp(args) {
	const matchId = String(args.matchId ?? "").trim();
	if (!matchId || !args.identity) return false;
	if (args.seenMatchIds.has(matchId) || args.seenCanonicalKeys.has(args.identity.key)) return false;
	args.seenMatchIds.add(matchId);
	args.seenCanonicalKeys.add(args.identity.key);
	return true;
}
var BASE = "https://api.livetennisapi.com/api/public/v1";
var MIN_INTERVAL_MS = 1100;
var DAILY_BUDGET = 1e3;
var DAY_MS = 864e5;
var MAX_CANDIDATES_PER_PLAYER = 4;
var lastRequestAt = 0;
var dailyWindowStart = Date.now();
var dailyCount = 0;
function budgetOk() {
	const now = Date.now();
	if (now - dailyWindowStart > DAY_MS) {
		dailyWindowStart = now;
		dailyCount = 0;
	}
	return dailyCount < DAILY_BUDGET;
}
async function throttledFetch(path, token) {
	const now0 = Date.now();
	if (now0 - dailyWindowStart > DAY_MS) {
		dailyWindowStart = now0;
		dailyCount = 0;
	}
	const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
	if (wait > 0) await new Promise((res) => setTimeout(res, wait));
	lastRequestAt = Date.now();
	dailyCount++;
	return fetch(`${BASE}${path}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			"User-Agent": "tennis-truth-engine-live-tennis-api/1.0"
		},
		signal: AbortSignal.timeout(12e3)
	});
}
var norm = (v) => String(v ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function classifyPbpFetchFailure(input) {
	if (input.dailyBudgetExhausted) return "Live Tennis API daily request budget (1,000/day, Basic tier) is exhausted for this process -- a provider quota limit, not evidence this match's point-by-point data is absent.";
	if (input.networkError) return `Live Tennis API point-by-point request failed: ${input.networkError}`;
	if (input.status === 402) return "Live Tennis API returned HTTP 402 (payment/credits required) -- a provider billing failure, not evidence this match's point-by-point data is absent.";
	if (input.status === 401 || input.status === 403) return `Live Tennis API returned HTTP ${input.status} (authentication/authorization failed).`;
	if (input.status === 429) return "Live Tennis API returned HTTP 429 (rate limited).";
	if (input.status === 404) return "Live Tennis API returned HTTP 404 (match not found or point-by-point not yet available).";
	if (typeof input.status === "number" && input.badRequest) return `Live Tennis API rejected the request (HTTP ${input.status}): ${input.badRequest}`;
	if (typeof input.status === "number") return `Live Tennis API returned HTTP ${input.status}.`;
	if (input.parseError) return "Live Tennis API point-by-point response was not valid JSON.";
	return "Live Tennis API point-by-point request failed for an unspecified reason.";
}
function tapeToGamesPayload(response) {
	const tape = Array.isArray(response?.tape) ? response.tape : [];
	const games = [];
	if (tape.length === 0) return { games };
	const mapSide = (n) => n === 1 ? "player1" : n === 2 ? "player2" : null;
	const gamesEqual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
	const setLen = (g) => Array.isArray(g?.[0]) ? g[0].length : 1;
	const atSet = (arr, setIndex) => Array.isArray(arr) && arr.length > setIndex ? Number(arr[setIndex]) : 0;
	let currentServer = mapSide(tape[0]?.server) ?? "player1";
	let currentPoints = [];
	let priorGames = tape[0]?.games;
	let setNo = setLen(priorGames);
	for (let i = 1; i < tape.length; i++) {
		const row = tape[i];
		const winner = mapSide(row?.point_winner);
		if (winner) currentPoints.push({ winner });
		if (!gamesEqual(row?.games, priorGames)) {
			if (currentPoints.length) {
				const g0 = Array.isArray(row?.games) ? row.games[0] : void 0;
				const g1 = Array.isArray(row?.games) ? row.games[1] : void 0;
				games.push({
					set_number: setNo,
					server: currentServer,
					points: currentPoints,
					tiebreak: Boolean(row?.is_tiebreak),
					player1_games: atSet(g0, setNo - 1),
					player2_games: atSet(g1, setNo - 1)
				});
			}
			currentPoints = [];
			currentServer = mapSide(row?.server) ?? currentServer;
			setNo = setLen(row?.games);
			priorGames = row?.games;
		}
	}
	if (currentPoints.length) games.push({
		set_number: setNo,
		server: currentServer,
		points: currentPoints,
		tiebreak: false
	});
	return { games };
}
function classifyTour(m) {
	const gender = norm(m.gender);
	const isWomen = gender === "women" || gender === "w" || gender === "female";
	const isMen = gender === "men" || gender === "m" || gender === "male";
	if (!isWomen && !isMen) return null;
	const blob = norm(`${m.tour ?? ""} ${m.round ?? ""} ${m.tournament ?? ""}`);
	const isChallengerTier = /(challenger|itf|futures|utr|satellite|exhibition|\bm1[0-9]\b|\bm2[0-9]\b|\bw1[0-9]\b|\bw2[0-9]\b)/.test(blob);
	const isMainTour = /(^| )(atp|wta)( |$)/.test(blob) && !isChallengerTier;
	return isMen ? isMainTour ? "ATP_MAIN" : "ATP_CHALLENGER" : isMainTour ? "WTA_MAIN" : "WTA_CHALLENGER";
}
async function resolvePlayerId(name, token) {
	const key = norm(name);
	if (!key) return null;
	if (!budgetOk()) return null;
	const tokens = key.split(" ").filter(Boolean);
	const searchTerm = tokens[tokens.length - 1] ?? key;
	try {
		const r = await throttledFetch(`/players?search=${encodeURIComponent(searchTerm)}`, token);
		if (!r.ok) return null;
		const body = await r.json().catch(() => null);
		const exact = (Array.isArray(body?.data) ? body.data : []).filter((c) => norm(c.name) === key);
		return exact.length === 1 ? exact[0].id : null;
	} catch {
		return null;
	}
}
async function discoverHistoricalMatches(playerId, asOfDate, token) {
	if (!budgetOk()) return [];
	try {
		const r = await throttledFetch(`/history/matches?player=${playerId}&limit=25&offset=0`, token);
		if (!r.ok) return [];
		const body = await r.json().catch(() => null);
		return (Array.isArray(body?.data) ? body.data : []).filter((row) => row?.outcome === "completed" && row?.scheduled_time && String(row.scheduled_time).slice(0, 10) < asOfDate).sort((a, b) => String(b.scheduled_time).localeCompare(String(a.scheduled_time))).slice(0, MAX_CANDIDATES_PER_PLAYER).map((row) => ({
			id: Number(row.id),
			date: row.scheduled_time ? String(row.scheduled_time).slice(0, 10) : null,
			gender: row?.gender ?? null,
			tour: row?.tour ?? null,
			surface: row?.surface ?? null,
			tournament: row?.tournament ?? null,
			round: row?.round ?? null,
			players: [String(row?.players?.p1?.name ?? ""), String(row?.players?.p2?.name ?? "")]
		}));
	} catch {
		return [];
	}
}
async function fetchTape(matchId, token) {
	if (!budgetOk()) return {
		ok: false,
		reason: classifyPbpFetchFailure({ dailyBudgetExhausted: true })
	};
	try {
		const r = await throttledFetch(`/history/matches/${matchId}?points=complete`, token);
		if (!r.ok) {
			let detail;
			try {
				detail = (await r.json())?.detail;
			} catch {}
			return {
				ok: false,
				reason: classifyPbpFetchFailure({
					status: r.status,
					badRequest: detail
				})
			};
		}
		let body;
		try {
			body = await r.json();
		} catch {
			return {
				ok: false,
				reason: classifyPbpFetchFailure({ parseError: true })
			};
		}
		const tape = body?.tape;
		if (!Array.isArray(tape) || tape.length === 0) return {
			ok: false,
			reason: "Live Tennis API returned an empty point-by-point tape for this match."
		};
		return {
			ok: true,
			payload: body
		};
	} catch (error) {
		return {
			ok: false,
			reason: classifyPbpFetchFailure({ networkError: error instanceof Error ? error.message : String(error) })
		};
	}
}
var codeOf$1 = (v) => {
	const m = String(v ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(v ?? "").padStart(3, "0");
};
var observationCache = /* @__PURE__ */ new Map();
async function computeObservations(args) {
	const key = `${norm(args.p1)}|${norm(args.p2)}|${args.asOfDate}`;
	const cached = observationCache.get(key);
	if (cached) return cached;
	const promise = (async () => {
		const status = {
			eligible: true,
			reason: "",
			matches_used: 0,
			rejected_pbp: 0,
			source: "Live Tennis API",
			fetch_failures: 0,
			fetch_failure_sample: null
		};
		const token = process.env.Live_Tennis_Api;
		if (!token) {
			status.eligible = false;
			status.reason = "Live_Tennis_Api is not configured.";
			return {
				status,
				observations: []
			};
		}
		const [id1, id2] = await Promise.all([resolvePlayerId(args.p1, token), resolvePlayerId(args.p2, token)]);
		if (!id1 && !id2) {
			status.reason = "Neither player resolved to a Live Tennis API player id.";
			return {
				status,
				observations: []
			};
		}
		const seenMatchIds = /* @__PURE__ */ new Set(), seenCanonicalKeys = /* @__PURE__ */ new Set();
		const claimed = [];
		for (const id of [id1, id2].filter((x) => typeof x === "number")) for (const row of await discoverHistoricalMatches(id, args.asOfDate, token)) {
			if (row.players.some((p) => !p)) continue;
			const tour = classifyTour(row);
			if (!tour) continue;
			const identity = canonicalApprovedPbpIdentity({
				tour,
				player1: row.players[0],
				player2: row.players[1],
				tournament: row.tournament,
				date: row.date,
				round: row.round
			});
			if (!claimUniqueApprovedPbp({
				matchId: row.id,
				identity,
				seenMatchIds,
				seenCanonicalKeys
			})) {
				status.rejected_pbp++;
				continue;
			}
			claimed.push({
				row,
				identity
			});
		}
		const observations = [];
		await Promise.all(claimed.map(async ({ row, identity }) => {
			const fetched = await fetchTape(row.id, token);
			if (!fetched.ok) {
				status.fetch_failures++;
				status.fetch_failure_sample ??= fetched.reason;
				return;
			}
			const recovery = reconstructPbpScoreState(tapeToGamesPayload(fetched.payload));
			if (!recovery.valid) {
				status.rejected_pbp++;
				return;
			}
			for (const target of [args.p1, args.p2]) {
				const idx = row.players.findIndex((n) => norm(n) === norm(target));
				if (idx < 0) continue;
				const side = idx === 0 ? "player1" : "player2";
				const derived = recovery.derived[side];
				if (!Object.keys(derived).length) continue;
				observations.push({
					family: "POINT_BY_POINT",
					source: "Live Tennis API",
					url: `${BASE}/history/matches/${row.id}`,
					player: target,
					opponent: row.players[idx === 0 ? 1 : 0],
					tournament: row.tournament ?? null,
					event_date: row.date,
					surface: row.surface ?? null,
					key: "task18b_approved_pbp_score_state",
					value: {
						match_id: row.id,
						totalPoints: recovery.point_count,
						gamesObserved: recovery.game_count,
						derived,
						field_support: recovery.field_support
					},
					sample: `${recovery.point_count} parsed points; ${recovery.game_count} complete games`,
					provenance: {
						tour: classifyTour(row),
						match_id: String(row.id),
						canonical_match_key: identity.key,
						player_orientation: side,
						approved_only: true,
						approval_source: "Live Tennis API history/matches point-by-point",
						raw_pbp_ref: `${BASE}/history/matches/${row.id}`,
						parsed_point_state: true,
						transformation: "pbp-score-state-recovery",
						duplicate_match_guard: true,
						one_match_one_pbp: true
					}
				});
				status.matches_used++;
			}
		}));
		status.reason = observations.length ? "Live Tennis API PBP reconstructed through canonical match identity where metric-specific raw fields are satisfied." : "No matching Live Tennis API PBP satisfied Task 18B field requirements.";
		return {
			status,
			observations
		};
	})();
	observationCache.set(key, promise);
	promise.catch(() => observationCache.delete(key));
	return promise;
}
async function buildLiveTennisApiPbpContext(args) {
	const status = {
		eligible: false,
		reason: "",
		matches_used: 0,
		rejected_pbp: 0,
		source: "Live Tennis API",
		fetch_failures: 0,
		fetch_failure_sample: null
	};
	if (!args.metrics.some((metric) => TASK18B_METRIC_CODES.has(codeOf$1(metric.code)))) {
		status.reason = "No requested metric uses the point-by-point family.";
		return {
			packet: {},
			status
		};
	}
	const { status: computedStatus, observations } = await computeObservations(args);
	const packet = {};
	for (const metric of args.metrics) {
		const code = codeOf$1(metric.code);
		const codeRows = observations.filter((o) => Boolean(o.value?.derived?.[code]));
		if (!TASK18B_METRIC_CODES.has(code) || !codeRows.length) continue;
		const p = policyForMetric(code);
		packet[code] = {
			metric_name: metric.name,
			allowed_families: [.../* @__PURE__ */ new Set([...p.allowed_families, "POINT_BY_POINT"])],
			sufficient_families: [.../* @__PURE__ */ new Set([...p.sufficient_families, "POINT_BY_POINT"])],
			support_only_families: (p.support_only_families ?? []).filter((x) => x !== "POINT_BY_POINT"),
			observed_families: ["POINT_BY_POINT"],
			direct_satisfaction_allowed: false,
			observations: codeRows.slice(0, 80),
			tour_guard: "LIVE_TENNIS_API_CLASSIFIED",
			evidence_treatment: "RECONSTRUCTED_OR_TASK17_PARTIAL_ONLY"
		};
	}
	return {
		packet,
		status: { ...computedStatus }
	};
}
var EXCLUDED_OBSERVATION_TYPES = [
	"POINT_BY_POINT",
	"PBP",
	"MARKET"
];
function codeOf(value) {
	const match = String(value ?? "").match(/(\d{1,3})$/);
	return match ? match[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function unique(values) {
	return [...new Set(values)];
}
function compactObservation(row) {
	return {
		family: observationFamily(row),
		source: row.source_name ?? row.source_id,
		url: row.source_url,
		player: row.player_name,
		opponent: row.opponent_name,
		tournament: row.tournament,
		event_date: row.event_date,
		surface: row.surface,
		key: row.observation_key,
		value: row.text_value ?? row.numeric_value,
		sample: row.sample_label,
		window_start: row.window_start,
		window_end: row.window_end
	};
}
async function loadCandidateRows(player, opponent, asOfDate) {
	const start = /* @__PURE__ */ new Date(`${asOfDate}T00:00:00Z`);
	start.setUTCFullYear(start.getUTCFullYear() - 5);
	const aliases = unique([...safeEvidenceAliases(player, opponent), ...safeEvidenceAliases(opponent, player)]);
	const observations = (where, ordered) => tryQuery(() => {
		const query = db.select().from(sourceObservationsTable).where(where);
		return (ordered ? query.orderBy(desc(sourceObservationsTable.event_date)) : query).limit(1e3);
	});
	const datedWindow = and(gte(sourceObservationsTable.event_date, start.toISOString().slice(0, 10)), lte(sourceObservationsTable.event_date, asOfDate));
	const marketWindow = and(eq(sourceObservationsTable.event_date, asOfDate), eq(sourceObservationsTable.observation_type, "MARKET"));
	const notExcluded = notInArray(sourceObservationsTable.observation_type, EXCLUDED_OBSERVATION_TYPES);
	const playerIsAlias = inArray(sourceObservationsTable.player_name, aliases);
	const [otherResult, marketResult, sharedResult, nullDatePlayerResult] = await Promise.all([
		observations(and(datedWindow, playerIsAlias, notExcluded), true),
		observations(and(marketWindow, playerIsAlias), true),
		observations(and(datedWindow, isNull(sourceObservationsTable.player_name), notExcluded), true),
		observations(and(isNull(sourceObservationsTable.event_date), playerIsAlias, notExcluded), false)
	]);
	const results = [
		otherResult,
		marketResult,
		sharedResult,
		nullDatePlayerResult
	];
	if (results.some((result) => result.error)) return [];
	const rows = results.flatMap((result) => result.data ?? []);
	const seen = /* @__PURE__ */ new Set();
	return rows.filter((row) => {
		if (row.observation_type === "MARKET" && !(evidencePairMatches(row.player_name, row.opponent_name, player, opponent) || evidencePairMatches(row.player_name, row.opponent_name, opponent, player))) return false;
		const key = [
			row.source_id,
			row.source_url,
			row.player_name,
			row.opponent_name,
			row.event_date,
			row.observation_key,
			row.text_value,
			row.numeric_value
		].join("|");
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
function contextFromObservationRows(args, rows) {
	const classified = rows.filter((row) => row.event_date === args.asOfDate && (evidencePairMatches(row.player_name, row.opponent_name, args.p1, args.p2) || evidencePairMatches(row.player_name, row.opponent_name, args.p2, args.p1))).map((row) => ({
		row,
		tour: classifyEvidenceTourFamily(row.sample_label, row.tournament, row.source_id, row.source_name)
	})).filter((entry) => entry.tour !== null);
	const tours = unique(classified.map((entry) => entry.tour));
	if (tours.length !== 1) return null;
	const row = classified[0].row;
	return [
		`Tournament: ${row.tournament ?? "unknown"}`,
		`Level: ${tours[0].replaceAll("_", " ")}`,
		`Tour: ${tours[0].replaceAll("_", " ")}`,
		row.surface ? `Surface: ${row.surface}` : null,
		`Date: ${args.asOfDate}`
	].filter(Boolean).join(" | ");
}
async function inferCanonicalMatchContext(args, rows) {
	const fromRows = contextFromObservationRows(args, rows);
	if (fromRows) return fromRows;
	const fromRepository = inferRepositoryMatchContext(args);
	if (fromRepository) return fromRepository;
	const { data, error } = await tryQuery(() => db.select().from(matchesTable).where(eq(matchesTable.scheduled_date, args.asOfDate)).limit(250));
	if (error) return null;
	const classified = (data ?? []).filter((row) => evidencePairMatches(row.player1_name, row.player2_name, args.p1, args.p2) || evidencePairMatches(row.player1_name, row.player2_name, args.p2, args.p1)).map((row) => ({
		row,
		tour: classifyEvidenceTourFamily(row.event_level, row.tournament_name)
	})).filter((entry) => entry.tour !== null);
	const tours = unique(classified.map((entry) => entry.tour));
	if (classified.length !== 1 || tours.length !== 1) return null;
	const row = classified[0].row;
	const tour = tours[0];
	return [
		`Tournament: ${row.tournament_name ?? "unknown"}`,
		`Level: ${row.event_level ?? tour.replaceAll("_", " ")}`,
		`Tour: ${tour.replaceAll("_", " ")}`,
		row.surface ? `Surface: ${row.surface}` : null,
		`Date: ${args.asOfDate}`,
		row.round ? `Round: ${row.round}` : null
	].filter(Boolean).join(" | ");
}
async function approvedPbpPacket(args, rows) {
	const context = args.context ?? await inferCanonicalMatchContext(args, rows);
	if (!classifyEvidenceTourFamily(context) || !context) return {};
	return (await buildLiveTennisApiPbpContext({
		metrics: args.metrics,
		p1: args.p1,
		p2: args.p2,
		asOfDate: args.asOfDate,
		context
	})).packet;
}
function mergePacketEntry(base, pbp) {
	if (!base) return pbp;
	if (!pbp) return base;
	const observations = [...base.observations ?? [], ...pbp.observations ?? []];
	const seen = /* @__PURE__ */ new Set();
	const deduped = observations.filter((row) => {
		const matchId = (row?.value ?? {})?.match_id ?? String(row?.url ?? "").match(/\/matches\/(\d+)\//)?.[1] ?? "";
		const key = row?.family === "POINT_BY_POINT" && matchId ? [
			row?.family,
			row?.source,
			matchId
		].join("|") : [
			row?.family,
			row?.source,
			row?.player,
			row?.opponent,
			row?.player1,
			row?.player2,
			row?.event_date,
			row?.key
		].join("|");
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	return {
		...base,
		observed_families: unique([...base.observed_families ?? [], ...pbp.observed_families ?? []]),
		direct_satisfaction_allowed: Boolean(base.direct_satisfaction_allowed || pbp.direct_satisfaction_allowed),
		observations: deduped.slice(0, 80),
		pbp_tour_guard: pbp.tour_guard ?? null
	};
}
async function buildMetricObservationContext(args) {
	const rows = await loadCandidateRows(args.p1, args.p2, args.asOfDate);
	const pbpPacket = await approvedPbpPacket(args, rows);
	const packet = {};
	for (const metric of args.metrics) {
		const code = codeOf(metric.code);
		const policy = policyForMetric(code);
		const allowed = rows.filter((row) => metricAllowsObservation(code, row));
		if (allowed.length) {
			const families = unique(allowed.map((row) => observationFamily(row)).filter(Boolean));
			const supportOnly = policy.support_only_families ?? [];
			const sufficient = policy.sufficient_families ?? [];
			packet[code] = {
				metric_name: metric.name,
				allowed_families: policy.allowed_families,
				sufficient_families: sufficient,
				support_only_families: supportOnly,
				observed_families: families,
				direct_satisfaction_allowed: families.some((family) => sufficient.includes(family)),
				observations: allowed.slice(0, 80).map(compactObservation)
			};
		}
		packet[code] = mergePacketEntry(packet[code], pbpPacket[code]);
		if (!packet[code]) delete packet[code];
	}
	return packet;
}
function appendMetricObservationContext(baseContext, packet) {
	if (!Object.keys(packet).length) return baseContext ?? "";
	const appendix = `\n\nWAREHOUSE_OBSERVATION_CONTEXT\n${JSON.stringify(packet)}\nEND_WAREHOUSE_OBSERVATION_CONTEXT\nRules: use only observations listed under the requested metric code; never borrow an observation family from another metric; support-only families may inform reconstruction but cannot alone justify DIRECT treatment or a complete metric answer.`;
	return `${baseContext ?? ""}${appendix}`;
}
//#endregion
export { replayElo as A, laneMatchesBefore as C, officialWtaMetricRows as D, normalizeEvidenceTournament as E, resolveCanonicalEvidencePair as M, safeEvidenceAliases as N, policyForMetric as O, tryQuery as P, excludedSet as S, normalizeEvidenceIdentity as T, deterministicRankingMetric as _, buildLiveTennisApiPbpContext as a, enforceFiveMetricWiring as b, classifyEvidenceTourFamily as c, completionSweepResearcher as d, deriveOpeningWindowProfile as f, deterministicPbpMetricFromPacket as g, deterministicPbpMetric as h, auditCutoff as i, repositoryResultsRows as j, reconstructPbpScoreState as k, clearPhantomEvidenceMetadata as l, deterministicMarketMetric as m, appendMetricObservationContext as n, buildMetricObservationContext as o, deterministicEnvironmentMetric as p, assertObservationFamily as r, certifyMetricFinding as s, TASK18B_METRIC_CODES as t, completionSweepHistoricalFinding as u, deterministicResultsScheduleMetric as v, localMetricRows as w, evidencePairMatches as x, deterministicRulesContextMetric as y };
