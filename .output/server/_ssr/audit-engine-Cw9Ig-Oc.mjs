import { t as classifyMetric } from "./metric-classification-BT9JbLCb.mjs";
import { c as unmetDependencies, t as FINAL_STAGE } from "./audit-stages-Dphii188.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/audit-engine-Cw9Ig-Oc.js
var USABLE_TREATMENTS$2 = /* @__PURE__ */ new Set([
	"DIRECT",
	"RECONSTRUCTED",
	"PARTIAL"
]);
var COMPARISON_SPECS = {
	"001": {
		field: "surface_elo",
		bareScalarFallback: true,
		direction: "HIGHER_IS_BETTER",
		family: "SURFACE_STRENGTH",
		materiality: 10,
		label: "Surface Elo"
	},
	"005": {
		field: "last10_win_pct",
		direction: "HIGHER_IS_BETTER",
		family: "RECENT_FORM",
		materiality: 5,
		label: "Last-10 win %"
	},
	"008": {
		field: "set3_deciding_set_win_pct",
		fieldAliases: ["deciding_set_win_pct"],
		direction: "HIGHER_IS_BETTER",
		family: "SET_PROFILE",
		materiality: 5,
		label: "Deciding-set win %"
	},
	"010": {
		field: "straight_set_match_win_pct",
		fieldAliases: ["straight_set_win_pct"],
		direction: "HIGHER_IS_BETTER",
		family: "SET_PROFILE",
		materiality: 5,
		label: "Straight-set win %"
	},
	"011": {
		field: "match_win_pct",
		direction: "HIGHER_IS_BETTER",
		family: "RESULTS_HISTORY",
		materiality: 5,
		label: "Match win %"
	},
	"031": {
		field: "opponent_adjusted_set_differential",
		direction: "HIGHER_IS_BETTER",
		family: "COMMON_OPPONENT",
		materiality: .15,
		label: "Opponent-adjusted set differential"
	},
	"027": {
		field: "lead_protection_rate_pct",
		direction: "HIGHER_IS_BETTER",
		family: "CLOSING_ABILITY",
		materiality: 5,
		label: "Lead protection %"
	},
	"051": {
		field: "shrunk_win_probability_pct",
		direction: "HIGHER_IS_BETTER",
		family: "H2H_PROBABILITY",
		materiality: 3,
		label: "Opponent-specific win probability %"
	},
	"002": {
		field: "service_point_win_pct",
		sampleField: ["service_points"],
		minSample: 30,
		direction: "HIGHER_IS_BETTER",
		family: "POINT_BY_POINT",
		materiality: 10,
		label: "Service point win %"
	},
	"003": {
		field: "return_point_win_pct",
		sampleField: ["return_points"],
		minSample: 30,
		direction: "HIGHER_IS_BETTER",
		family: "POINT_BY_POINT",
		materiality: 10,
		label: "Return point win %"
	},
	"009": {
		field: "pressure_win_pct",
		sampleField: ["pressure_points"],
		minSample: 15,
		direction: "HIGHER_IS_BETTER",
		family: "POINT_BY_POINT",
		materiality: 18,
		label: "Pressure point win %"
	},
	"018": {
		field: "breakback_rate_pct",
		sampleField: ["breakback_opportunities"],
		minSample: 10,
		direction: "HIGHER_IS_BETTER",
		family: "POINT_BY_POINT",
		materiality: 40,
		label: "Breakback rate %"
	},
	"032": {
		field: "bp_converted_pct",
		sampleField: ["break_chances"],
		minSample: 10,
		direction: "HIGHER_IS_BETTER",
		family: "POINT_BY_POINT",
		materiality: 40,
		label: "Break-point conversion %"
	},
	"034": {
		field: "dominance_ratio",
		sampleField: ["total_points_played"],
		minSample: 60,
		direction: "HIGHER_IS_BETTER",
		family: "POINT_BY_POINT",
		materiality: .15,
		label: "Dominance ratio"
	},
	"053": {
		field: "pressure_index_pct",
		sampleField: ["pressure_points"],
		minSample: 15,
		direction: "HIGHER_IS_BETTER",
		family: "POINT_BY_POINT",
		materiality: 18,
		label: "Pressure index %"
	},
	"007": {
		field: "win_pct",
		sampleField: ["ranked_common_opponent_matches"],
		minSample: 10,
		direction: "HIGHER_IS_BETTER",
		family: "COMMON_OPPONENT",
		materiality: 20,
		label: "Common-opponent win %"
	},
	"029": {
		field: "after_close_set_loss_match_win_pct",
		minusField: "baseline_match_win_rate_pct",
		sampleField: ["after_close_set_loss_n"],
		minSample: 8,
		direction: "HIGHER_IS_BETTER",
		family: "PSYCH_RESPONSE",
		materiality: 25,
		label: "Response after a close set loss, vs own baseline"
	},
	"036": {
		field: "favorite_losses_rate_pct",
		sampleField: ["trailing_losses_used"],
		minSample: 10,
		direction: "LOWER_IS_BETTER",
		family: "LOSS_PROFILE",
		materiality: 15,
		label: "Losses as favourite %"
	},
	"006": {
		field: "bad_loss_rate_pct",
		sampleField: ["quality_observed_matches", "eligible_losses_n"],
		minSample: 5,
		direction: "LOWER_IS_BETTER",
		family: "LOSS_PROFILE",
		materiality: 25,
		label: "Bad-loss rate %"
	},
	"041": {
		field: "recent_elo_adjusted_surplus",
		minusField: "earlier_elo_adjusted_surplus",
		direction: "HIGHER_IS_BETTER",
		family: "IMPROVEMENT_TREND",
		materiality: .1,
		label: "Elo-adjusted surplus, recent vs earlier"
	},
	"055": {
		field: "elo_change_last10",
		direction: "HIGHER_IS_BETTER",
		family: "RECENT_FORM",
		materiality: 20,
		label: "Elo change over last 10"
	},
	"016": {
		field: "score_state_break_point_win_pct",
		sampleField: ["score_state_break_point_n"],
		minSample: 8,
		direction: "HIGHER_IS_BETTER",
		family: "POINT_BY_POINT",
		materiality: 24,
		label: "Break-point score-state win %"
	},
	"045": {
		field: "forced_deciding_set_win_pct",
		sampleField: ["forced_deciding_set_n"],
		minSample: 8,
		direction: "HIGHER_IS_BETTER",
		family: "SET_PROFILE",
		materiality: 25,
		label: "Deciding-set win % as pre-match favourite"
	},
	"068": {
		field: "current_streak_signed",
		sampleField: ["season_matches"],
		minSample: 5,
		direction: "HIGHER_IS_BETTER",
		family: "RECENT_FORM",
		materiality: 5,
		label: "Current win/loss streak (signed match count)"
	},
	"080": {
		field: "favorable_divergent_outcomes",
		minusField: "unfavorable_divergent_outcomes",
		direction: "HIGHER_IS_BETTER",
		family: "COMMON_OPPONENT",
		materiality: 1,
		label: "Common-opponent net divergent outcomes"
	}
};
/**
* Parses both persisted shapes seen in metric_results: a bare scalar ("1483.15") and a
* keyed string ("last10_win_pct=10; trend_direction=DECLINING"). Provenance-prefixed
* values ("PLAYER=x; SOURCE=y; SAMPLE=5; k=v") parse into the same field map, so a
* spec'd field is still found inside them.
*/
function parseMetricValue(raw) {
	const text = String(raw ?? "").trim();
	const fields = /* @__PURE__ */ new Map();
	if (!text) return {
		scalar: null,
		fields
	};
	for (const part of text.split(";")) {
		const eq = part.indexOf("=");
		if (eq <= 0) continue;
		const key = part.slice(0, eq).trim();
		const value = part.slice(eq + 1).trim();
		if (key) fields.set(key, value);
	}
	for (const [key, value] of [...fields.entries()]) {
		if (!value.startsWith("{")) continue;
		let payload;
		try {
			payload = JSON.parse(value);
		} catch {
			continue;
		}
		if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
		for (const [innerKey, innerValue] of Object.entries(payload)) {
			if (fields.has(innerKey)) continue;
			if (typeof innerValue === "number" && Number.isFinite(innerValue)) fields.set(innerKey, String(innerValue));
			else if (innerKey === "score_state_performance_json" && typeof innerValue === "string") fields.set(innerKey, innerValue);
		}
	}
	const scoreStateRaw = fields.get("score_state_performance_json");
	if (scoreStateRaw && scoreStateRaw.startsWith("{")) try {
		const states = JSON.parse(scoreStateRaw);
		if (states && typeof states === "object" && !Array.isArray(states)) {
			const breakPoint = states["Break Point"];
			if (breakPoint && typeof breakPoint === "object") {
				const { n, win_pct } = breakPoint;
				if (typeof n === "number" && Number.isFinite(n) && !fields.has("score_state_break_point_n")) fields.set("score_state_break_point_n", String(n));
				if (typeof win_pct === "number" && Number.isFinite(win_pct) && !fields.has("score_state_break_point_win_pct")) fields.set("score_state_break_point_win_pct", String(win_pct));
			}
		}
	} catch {}
	const currentStreakRaw = fields.get("current_streak");
	if (currentStreakRaw && !fields.has("current_streak_signed")) {
		const m = /^([WL])(\d+)$/i.exec(currentStreakRaw.trim());
		if (m) {
			const sign = m[1].toUpperCase() === "W" ? 1 : -1;
			fields.set("current_streak_signed", String(sign * Number(m[2])));
		}
	}
	const bare = Number(text);
	return {
		scalar: Number.isFinite(bare) && text !== "" ? bare : null,
		fields
	};
}
/** "NA"/""/non-numeric all yield null -- never 0. */
function numeric(value) {
	if (value === void 0) return null;
	const trimmed = value.trim();
	if (!trimmed || trimmed.toUpperCase() === "NA" || trimmed.toUpperCase() === "NULL") return null;
	const n = Number(trimmed);
	return Number.isFinite(n) ? n : null;
}
/** First declared name (canonical, then aliases) that carries a numeric value. */
function lookup(parsed, field, aliases) {
	for (const name of [field, ...aliases ?? []]) {
		const value = numeric(parsed.fields.get(name));
		if (value !== null) return value;
	}
	return null;
}
function extract(spec, parsed) {
	if (spec.field === null) return parsed.scalar;
	const primary = lookup(parsed, spec.field, spec.fieldAliases) ?? (spec.bareScalarFallback ? parsed.scalar : null);
	if (primary === null) return null;
	if (!spec.minusField) return primary;
	const secondary = lookup(parsed, spec.minusField, void 0);
	if (secondary === null) return null;
	return primary - secondary;
}
function codeOf(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
/**
* Compares one persisted metric row. Pure: no DB, no network, no AI. Never throws, and
* never returns a P1/P2 lean unless BOTH sides carried usable, parseable evidence.
*/
function compareMetricRow(row) {
	const code = codeOf(row.metric_code);
	const spec = COMPARISON_SPECS[code];
	const base = {
		metric_code: code,
		label: spec?.label ?? null,
		family: spec?.family ?? null,
		p1_number: null,
		p2_number: null,
		differential: null,
		advantage_p1: null,
		direction: spec?.direction ?? null
	};
	if (!spec) return {
		...base,
		status: "NO_COMPARISON_SPEC",
		favours: "UNAVAILABLE",
		reason: `No declared comparable field/direction for metric ${code}; excluded from the decision rather than guessed.`
	};
	const p1Usable = USABLE_TREATMENTS$2.has(String(row.p1_treatment ?? ""));
	const p2Usable = USABLE_TREATMENTS$2.has(String(row.p2_treatment ?? ""));
	if (!p1Usable || !p2Usable) return {
		...base,
		status: "TREATMENT_NOT_USABLE",
		favours: "UNAVAILABLE",
		reason: `Treatment not usable on ${!p1Usable && !p2Usable ? "both sides" : !p1Usable ? "P1" : "P2"} (p1=${row.p1_treatment ?? "none"}, p2=${row.p2_treatment ?? "none"}); no comparison made and no side credited.`
	};
	const p1Number = extract(spec, parseMetricValue(row.p1_value));
	const p2Number = extract(spec, parseMetricValue(row.p2_value));
	if (p1Number === null && p2Number === null) return {
		...base,
		status: "VALUE_NOT_PARSEABLE",
		favours: "UNAVAILABLE",
		reason: `Neither side carried a parseable "${spec.field ?? "scalar"}" value; treated as UNAVAILABLE, never as zero.`
	};
	if (p1Number === null || p2Number === null) return {
		...base,
		p1_number: p1Number,
		p2_number: p2Number,
		status: "ONE_SIDED_EVIDENCE",
		favours: "UNAVAILABLE",
		reason: `Only ${p1Number === null ? "P2" : "P1"} carried a parseable "${spec.field ?? "scalar"}" value. One-sided evidence is never a lean for the side that happens to have it.`
	};
	if (spec.sampleField && spec.minSample !== void 0) {
		const p1Sample = lookup(parseMetricValue(row.p1_value), spec.sampleField[0], spec.sampleField.slice(1));
		const p2Sample = lookup(parseMetricValue(row.p2_value), spec.sampleField[0], spec.sampleField.slice(1));
		if (p1Sample === null || p2Sample === null || p1Sample < spec.minSample || p2Sample < spec.minSample) {
			const describe = (n) => n === null ? "not persisted" : String(n);
			return {
				...base,
				p1_number: p1Number,
				p2_number: p2Number,
				status: "INSUFFICIENT_SAMPLE",
				favours: "UNAVAILABLE",
				reason: `"${spec.label}" needs at least ${spec.minSample} ${spec.sampleField[0]} on both sides; P1 has ${describe(p1Sample)} and P2 has ${describe(p2Sample)}. A gap measured over too few attempts is noise, so neither side is credited.`
			};
		}
	}
	const differential = Number((p1Number - p2Number).toFixed(6));
	const advantageP1 = Number((spec.direction === "HIGHER_IS_BETTER" ? differential : -differential).toFixed(6));
	const favours = Math.abs(differential) <= spec.materiality ? "NEUTRAL" : advantageP1 > 0 ? "P1" : "P2";
	return {
		...base,
		p1_number: p1Number,
		p2_number: p2Number,
		differential,
		advantage_p1: advantageP1,
		status: "COMPARED",
		favours,
		reason: favours === "NEUTRAL" ? `P1 ${p1Number} vs P2 ${p2Number} (${spec.label}); |difference| ${Math.abs(differential)} is within the ${spec.materiality} materiality threshold, so neither side is credited.` : `P1 ${p1Number} vs P2 ${p2Number} (${spec.label}, ${spec.direction}); favours ${favours}.`
	};
}
function compareMetricRows(rows) {
	return rows.map(compareMetricRow);
}
/**
* Reasons that represent a TRANSIENT/technical hiccup rather than a proven absence of data:
* the exact set audit-pipeline.ts's bounded metric retry loop re-attempts within the same
* audit run. If retries are exhausted and one of these is still the reason, it becomes
* PRODUCER_FAILURE (the pipeline genuinely could not get through, not proof nothing exists).
*/
var RETRIABLE_REASONS = /* @__PURE__ */ new Set(["PROVIDER_TIMEOUT", "API_RATE_LIMIT"]);
/** Statuses that legitimately excuse a match from this metric's evidence-coverage denominator. */
var DENOMINATOR_EXCUSED_STATUSES = /* @__PURE__ */ new Set([
	"SOURCE_EMPTY",
	"INSUFFICIENT_SAMPLE",
	"GENUINELY_UNAVAILABLE"
]);
var USABLE_TREATMENTS$1 = /* @__PURE__ */ new Set([
	"DIRECT",
	"RECONSTRUCTED",
	"PARTIAL"
]);
function isUsable(treatment, value) {
	return USABLE_TREATMENTS$1.has(String(treatment ?? "")) && Boolean(String(value ?? "").trim());
}
/**
* Classifies ONE side of ONE metric for ONE match. Pure function: same inputs, same
* output, every time -- nothing here can be influenced by anything other than what was
* actually observed for this side.
*/
function classifySideActivation(input) {
	if (!input.executed) return "NOT_ATTEMPTED";
	if (isUsable(input.treatment, input.value)) return "ACTIVATED";
	const reason = input.reason ?? null;
	if (reason && RETRIABLE_REASONS.has(reason)) return input.retriesExhausted ? "PRODUCER_FAILURE" : "RETRYING";
	switch (reason) {
		case "PLAYER_NOT_FOUND": return "IDENTITY_MISMATCH";
		case "MATCH_NOT_FOUND":
		case "SURFACE_DATA_NOT_FOUND": return "CONTEXT_MISMATCH";
		case "PARSING_FAILED": return "PARSE_FAILURE";
		case "MISSING_REQUIRED_INPUT":
		case "SOURCE_CONFLICT":
		case "RECONSTRUCTION_FAILED":
		case "PROVIDER_AUTH_FAILED":
		case "PRODUCER_FAILED_WITHOUT_REASON": return "PRODUCER_FAILURE";
		case "INSUFFICIENT_SAMPLE": return "INSUFFICIENT_SAMPLE";
		case "NO_SOURCE_FOUND": return "SOURCE_EMPTY";
		case "HISTORICAL_DATA_UNAVAILABLE": return "GENUINELY_UNAVAILABLE";
		default: return "PRODUCER_FAILURE";
	}
}
function classifyMetricActivation(code, p1, p2) {
	const p1Status = classifySideActivation(p1);
	const p2Status = classifySideActivation(p2);
	const bothExcused = DENOMINATOR_EXCUSED_STATUSES.has(p1Status) && DENOMINATOR_EXCUSED_STATUSES.has(p2Status);
	return {
		code,
		p1: p1Status,
		p2: p2Status,
		activated: p1Status === "ACTIVATED" && p2Status === "ACTIVATED",
		countsTowardDenominator: !bothExcused
	};
}
var ACTIVE_METRIC_CODES = Object.keys(COMPARISON_SPECS).sort();
function isActiveMetricCode(code) {
	return ACTIVE_METRIC_CODES.includes(normalizeMetricCode(code));
}
function normalizeMetricCode(code) {
	const match = String(code ?? "").match(/(\d{1,3})$/);
	return match ? match[1].padStart(3, "0") : String(code ?? "").padStart(3, "0");
}
/** Treatments that represent evidence the engine may actually read. */
var USABLE_TREATMENTS = [
	"DIRECT",
	"RECONSTRUCTED",
	"PARTIAL"
];
function sideUsable(treatment, value) {
	return USABLE_TREATMENTS.includes(String(treatment ?? "")) && Boolean(String(value ?? "").trim());
}
/**
* Readiness of the ACTIVE set for one run.
*
* `codes` is injectable purely so promotion can be tested without mutating the real
* registry; production callers use the default.
*
* Nothing here converts a non-success into a success: UNAVAILABLE, NO_SOURCE, EXCLUDED, a
* missing row, a treatment with no value behind it, and one-sided evidence are all counted
* as what they are. Only both-sides-usable increments `usable`.
*/
function activeMetricReadiness(rows, codes = ACTIVE_METRIC_CODES) {
	const byCode = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const code = normalizeMetricCode(row.metric_code);
		if (!byCode.get(code)) byCode.set(code, row);
		else if (sideUsable(row.p1_treatment, row.p1_value) || sideUsable(row.p2_treatment, row.p2_value)) byCode.set(code, row);
	}
	const outcomes = codes.map((code) => {
		const row = byCode.get(code);
		const activation = classifyMetricActivation(code, {
			executed: Boolean(row),
			treatment: row?.p1_treatment,
			value: row?.p1_value,
			reason: row?.p1_unavailable_reason
		}, {
			executed: Boolean(row),
			treatment: row?.p2_treatment,
			value: row?.p2_value,
			reason: row?.p2_unavailable_reason
		});
		if (!row) return {
			code,
			outcome: "NOT_EXECUTED",
			activation
		};
		const p1 = sideUsable(row.p1_treatment, row.p1_value);
		const p2 = sideUsable(row.p2_treatment, row.p2_value);
		if (p1 && p2) return {
			code,
			outcome: "USABLE_TWO_SIDED",
			activation
		};
		if (p1 || p2) return {
			code,
			outcome: "ONE_SIDED",
			activation
		};
		return {
			code,
			outcome: "UNAVAILABLE",
			activation
		};
	});
	const count = (outcome) => outcomes.filter((entry) => entry.outcome === outcome).length;
	const usable = count("USABLE_TWO_SIDED");
	const eligible = outcomes.filter((entry) => entry.activation.countsTowardDenominator).length;
	return {
		expected: codes.length,
		usable,
		eligible,
		eligiblePercent: eligible > 0 ? Number((usable / eligible * 100).toFixed(1)) : 0,
		oneSided: count("ONE_SIDED"),
		unavailable: count("UNAVAILABLE"),
		notExecuted: count("NOT_EXECUTED"),
		percent: codes.length > 0 ? Number((usable / codes.length * 100).toFixed(1)) : 0,
		byCode: outcomes
	};
}
var DONE_STATES = [
	"COMPLETE",
	"UNAVAILABLE",
	"EXCLUDED",
	"NO_SOURCE"
];
function isProcessMetaCode(code) {
	if (!code) return false;
	const match = String(code).match(/(\d{1,3})$/);
	const normalized = match ? match[1].padStart(3, "0") : String(code).padStart(3, "0");
	return classifyMetric(normalized) === "META_OR_NON_PLAYER";
}
function isNoSourceMetricCode(code) {
	if (!code) return false;
	const match = String(code).match(/(\d{1,3})$/);
	const normalized = match ? match[1].padStart(3, "0") : String(code).padStart(3, "0");
	const classification = classifyMetric(normalized);
	return classification === "PROTECTED_UNAVAILABLE" || classification === "MATRIX_SUMMARY_REQUIRED";
}
var pair = (rows) => ({
	done: rows.filter((r) => DONE_STATES.includes(r.status)).length,
	total: rows.length
});
var full = (p) => p.total > 0 && p.done === p.total;
var COVERAGE_THRESHOLD = 70;
function coverageFor(metrics, side) {
	const statuses = metrics.map((metric) => {
		if (isProcessMetaCode(metric.metric_code)) return "EXCLUDED";
		if (isNoSourceMetricCode(metric.metric_code)) return "NO_SOURCE";
		const treatment = side === "p1" ? metric.p1_treatment ?? metric.p1_status : metric.p2_treatment ?? metric.p2_status;
		const hasEvidenceColumns = Object.prototype.hasOwnProperty.call(metric, `${side}_value`) || Object.prototype.hasOwnProperty.call(metric, "sources");
		const sideValue = side === "p1" ? metric.p1_value : metric.p2_value;
		const backed = !hasEvidenceColumns || Boolean(String(sideValue ?? "").trim() && Array.isArray(metric.sources) && metric.sources.some((source) => source && typeof source === "object" && String(source.source_name ?? "").trim()));
		const value = [
			"DIRECT",
			"RECONSTRUCTED",
			"PARTIAL"
		].includes(treatment) && !backed ? "UNAVAILABLE" : treatment;
		return [
			"DIRECT",
			"RECONSTRUCTED",
			"PARTIAL",
			"UNAVAILABLE",
			"EXCLUDED",
			"NO_SOURCE"
		].includes(value) ? value : "UNAVAILABLE";
	});
	const count = (status) => statuses.filter((value) => value === status).length;
	const excluded = count("EXCLUDED");
	const noSource = count("NO_SOURCE");
	const denominator = metrics.length - excluded - noSource;
	const usable = count("DIRECT") + count("RECONSTRUCTED") + count("PARTIAL");
	return {
		direct: count("DIRECT"),
		reconstructed: count("RECONSTRUCTED"),
		partial: count("PARTIAL"),
		unavailable: count("UNAVAILABLE"),
		excluded,
		noSource,
		total: metrics.length,
		usablePercent: denominator > 0 ? Number((usable / denominator * 100).toFixed(1)) : 0,
		statuses
	};
}
function explicitEvidenceFamily(metric) {
	const family = String(metric.evidence_family ?? "").trim();
	const defaultName = String(metric.metric_name ?? "").trim();
	return family && family !== defaultName ? family : null;
}
function evaluate(input) {
	const { match, run } = input;
	const metrics = {
		done: input.metrics.filter((m) => DONE_STATES.includes(m.p1_status) && DONE_STATES.includes(m.p2_status)).length,
		total: input.metrics.length
	};
	const p1 = {
		done: input.metrics.filter((m) => DONE_STATES.includes(m.p1_status)).length,
		total: input.metrics.length
	};
	const p2 = {
		done: input.metrics.filter((m) => DONE_STATES.includes(m.p2_status)).length,
		total: input.metrics.length
	};
	const verification = pair(input.verification);
	const disagreement = pair(input.disagreement);
	const underdog = pair(input.underdog);
	const stress = pair(input.stress);
	const reconstructions = pair(input.reconstructions);
	const criticalConflicts = {
		total: input.conflicts.filter((c) => c.critical).length,
		done: input.conflicts.filter((c) => c.critical && c.resolution_status.startsWith("RESOLVED")).length
	};
	const families = /* @__PURE__ */ new Set();
	input.metrics.forEach((m) => {
		if (m.matrix_derived) return;
		if (!(DONE_STATES.includes(m.p1_status) && DONE_STATES.includes(m.p2_status))) return;
		const usableTreatment = (t) => [
			"DIRECT",
			"RECONSTRUCTED",
			"PARTIAL"
		].includes(String(t ?? ""));
		if (!usableTreatment(m.p1_treatment) && !usableTreatment(m.p2_treatment)) return;
		const family = explicitEvidenceFamily(m);
		if (family) families.add(family);
	});
	const effectiveEvidenceCount = families.size;
	const p1Coverage = coverageFor(input.metrics, "p1");
	const p2Coverage = coverageFor(input.metrics, "p2");
	const activeReadiness = activeMetricReadiness(input.metrics);
	const usableCoveragePercent = activeReadiness.eligiblePercent;
	const lowCoverage = activeReadiness.eligible > 0 && usableCoveragePercent < COVERAGE_THRESHOLD;
	const firewallValid = !run.matrix_revealed_at || !!run.independent_decision_committed_at && new Date(run.matrix_revealed_at).getTime() >= new Date(run.independent_decision_committed_at).getTime();
	const matrixRemoval = input.stress.filter((s) => s.test_code === "ST01" || s.test_code === "ST02");
	const matrixRemovalSurvived = matrixRemoval.length > 0 && matrixRemoval.every((s) => s.status === "COMPLETE" && (s.outcome === "STABLE" || s.outcome === "MOSTLY STABLE"));
	const stressActuallyEvaluated = input.stress.filter((s) => s.status === "COMPLETE");
	const familyRemoval = input.stress.find((s) => s.test_code === "ST03");
	const familyRemovalSurvived = !!familyRemoval && familyRemoval.status === "COMPLETE" && familyRemoval.outcome !== "FAILS";
	const normaliseName = (value) => String(value ?? "").trim().toLowerCase();
	const selectedName = normaliseName(run.independent_winner);
	const strongUnderdogPathways = input.underdog.filter((u) => u.classification === "STRONG" && (selectedName === "" || normaliseName(u.player_side) !== selectedName)).length;
	const unresolvedCritical = input.verification.some((v) => v.outcome === "FAIL" && v.severity === "CRITICAL") || input.disagreement.some((d) => d.contradiction_severity === "CRITICAL");
	const stageGaps = unmetDependencies(FINAL_STAGE, input.stages);
	const stagesComplete = stageGaps.length === 0;
	const colorRelevantStageGaps = stageGaps.filter((stage) => stage !== "FINAL DECISION");
	const colorStagesComplete = colorRelevantStageGaps.length === 0;
	const checks = [
		{
			key: "identity",
			label: "Match identity resolved to a terminal state",
			pass: [
				"VERIFIED",
				"UNVERIFIED",
				"UNAVAILABLE"
			].includes(match.identity_status),
			detail: match.identity_status
		},
		{
			key: "surface",
			label: "Surface verified or unavailable",
			pass: ["VERIFIED", "UNAVAILABLE"].includes(match.surface_status),
			detail: match.surface_status
		},
		{
			key: "lock",
			label: "Pre-match research lock set",
			pass: !!run.research_lock_at,
			detail: run.research_lock_at ?? "not locked"
		},
		{
			key: "conflicts",
			label: "Critical source conflicts resolved",
			pass: criticalConflicts.done === criticalConflicts.total,
			detail: `${criticalConflicts.done}/${criticalConflicts.total}`
		},
		{
			key: "p1",
			label: "Player 1 metric sweep complete",
			pass: full(p1),
			detail: `${p1.done}/${p1.total}`
		},
		{
			key: "p2",
			label: "Player 2 metric sweep complete",
			pass: full(p2),
			detail: `${p2.done}/${p2.total}`
		},
		{
			key: "recon",
			label: "Reconstructions resolved",
			pass: reconstructions.total === 0 || full(reconstructions),
			detail: `${reconstructions.done}/${reconstructions.total}`
		},
		{
			key: "verification",
			label: "Verification Audit complete",
			pass: full(verification),
			detail: `${verification.done}/${verification.total}`
		},
		{
			key: "disagreement",
			label: "Disagreement / Trap Audit complete",
			pass: full(disagreement),
			detail: `${disagreement.done}/${disagreement.total}`
		},
		{
			key: "underdog",
			label: "Dangerous Underdog Audit complete",
			pass: full(underdog),
			detail: `${underdog.done}/${underdog.total}`
		},
		{
			key: "stress",
			label: "Stress / removal tests complete",
			pass: full(stress),
			detail: `${stress.done}/${stress.total}`
		},
		{
			key: "committed",
			label: "Independent conclusion committed",
			pass: !!run.independent_decision_committed_at,
			detail: run.independent_winner ?? "INSUFFICIENT EVIDENCE"
		},
		{
			key: "firewall",
			label: "Matrix firewall respected",
			pass: firewallValid,
			detail: firewallValid ? "VALID" : "VIOLATED"
		},
		{
			key: "reveal",
			label: "Matrix comparison complete",
			pass: !!run.matrix_revealed_at,
			detail: run.matrix_revealed_at ?? "not revealed"
		},
		{
			key: "calibration",
			label: "Current calibration applied",
			pass: !!run.calibration_version_id,
			detail: run.calibration_version_id ? "COMPLETE" : "INCOMPLETE"
		}
	];
	const auditComplete = checks.every((c) => c.pass);
	const completionPercent = Number((checks.filter((c) => c.pass).length / checks.length * 100).toFixed(1));
	const greenLockReasons = [];
	if (!auditComplete) greenLockReasons.push("Required stages incomplete");
	if (!colorStagesComplete) greenLockReasons.push(`Pipeline execution incomplete: ${colorRelevantStageGaps.join(", ")}`);
	if (!firewallValid) greenLockReasons.push("Matrix firewall violated");
	if (!matrixRemovalSurvived) greenLockReasons.push("GREEN LOCKED — Matrix-removal test not survived");
	if (!familyRemovalSurvived) greenLockReasons.push("Strongest-family removal not survived");
	if (!full(underdog)) greenLockReasons.push("Dangerous Underdog audit incomplete");
	if (effectiveEvidenceCount < 3) greenLockReasons.push(`Effective independent evidence families = ${effectiveEvidenceCount} (min 3)`);
	if (lowCoverage) greenLockReasons.push(`Usable active-metric coverage = ${usableCoveragePercent}% (${activeReadiness.usable} of ${activeReadiness.eligible} eligible; min ${COVERAGE_THRESHOLD}%)`);
	if (strongUnderdogPathways >= 2) greenLockReasons.push("Multiple STRONG opposing underdog pathways");
	if (unresolvedCritical) greenLockReasons.push("Unresolved CRITICAL contradiction");
	if (input.matrixWp !== null && input.matrixWp <= 55) greenLockReasons.push("No-edge floor: favorite probability ≤55%");
	let color = "INCOMPLETE";
	if (!auditComplete) color = "INCOMPLETE";
	else if (!run.independent_winner) color = "INSUFFICIENT EVIDENCE";
	else if (unresolvedCritical || strongUnderdogPathways >= 2 || !matrixRemovalSurvived || input.matrixWp !== null && input.matrixWp <= 55) color = "RED / PASS";
	else if (greenLockReasons.length > 0) color = "YELLOW";
	else if (effectiveEvidenceCount >= 5 && stressActuallyEvaluated.length > 0 && stressActuallyEvaluated.every((s) => s.outcome === "STABLE") && strongUnderdogPathways === 0 && !input.underdog.some((u) => u.classification === "UNRESOLVED")) color = "DOUBLE GREEN";
	else color = "GREEN";
	const action = color === "DOUBLE GREEN" || color === "GREEN" ? `PLAY — ${run.independent_winner ?? ""}` : color === "YELLOW" ? "MONITOR / REDUCE" : color === "RED / PASS" ? "PASS" : color === "INSUFFICIENT EVIDENCE" ? "INSUFFICIENT EVIDENCE" : "CONTINUE PROCESSING";
	return {
		counts: {
			metrics,
			p1,
			p2,
			verification,
			disagreement,
			underdog,
			stress,
			reconstructions,
			criticalConflicts
		},
		checks,
		completionPercent,
		auditComplete,
		stageGaps,
		stagesComplete,
		matrixFirewallValid: firewallValid,
		effectiveEvidenceCount,
		coverage: {
			p1: p1Coverage,
			p2: p2Coverage,
			usablePercent: usableCoveragePercent,
			thresholdPercent: COVERAGE_THRESHOLD,
			activeUsable: activeReadiness.usable,
			activeEligible: activeReadiness.eligible,
			activeExpected: activeReadiness.expected
		},
		greenLocked: greenLockReasons.length > 0,
		greenLockReasons,
		color,
		action
	};
}
function bucketFor(wp, buckets) {
	if (wp === null || wp === void 0) return null;
	return buckets.find((b) => wp >= b.wp_min && wp <= b.wp_max) ?? null;
}
function winRate(wins, graded) {
	return graded === 0 ? null : Number((wins / graded * 100).toFixed(1));
}
//#endregion
export { evaluate as a, parseMetricValue as c, compareMetricRows as i, winRate as l, activeMetricReadiness as n, isActiveMetricCode as o, bucketFor as r, normalizeMetricCode as s, COMPARISON_SPECS as t };
