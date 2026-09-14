import { o as __toESM } from "../_runtime.mjs";
import { a as canonicalizeStageRows } from "./audit-stages-Dphii188.mjs";
import { a as evaluate, n as activeMetricReadiness, r as bucketFor } from "./audit-engine-Cw9Ig-Oc.mjs";
import { a as MATRIX_FIELDS } from "./constants-DloZsw4H.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createSsrRpc } from "./createSsrRpc-DDIv2aCY.mjs";
import { runAuditBatch } from "./audit-pipeline.functions-Cf84gMgb.mjs";
import { n as BucketBadge, r as StateText, t as AuditColorBadge } from "./StatusBadge-C2X-g8GE.mjs";
import { n as cn, t as Button } from "./button-DRsC1qZi.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Input } from "./input-DicJzR9-.mjs";
import { t as useServerFn } from "./useServerFn-CrZF2pjq.mjs";
import { n as Route } from "./router-Dsf2sjop.mjs";
import { n as isRecoverablePipelineTransportError, r as safePipelineErrorMessage, t as isPreviewForceReloadError } from "./pipeline-client-error-F6VIyWJR.mjs";
import { i as Trigger, n as List, r as Root2, t as Content } from "../_libs/radix-ui__react-tabs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/match._matchId-DlDHwYDM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var EDITABLE_AUDIT_TABLES = [
	"metric_results",
	"verification_results",
	"disagreement_results",
	"underdog_results",
	"stress_results"
];
var IDENTITY_FIELDS = ["identity_status", "surface_status"];
var IDENTITY_VALUES = [
	"UNVERIFIED",
	"VERIFIED",
	"CONFLICT"
];
var fetchMatchWorkspace = createServerFn({ method: "POST" }).inputValidator((data) => {
	const matchId = String(data?.matchId ?? "").trim();
	if (!matchId) throw new Error("A match id is required.");
	return { matchId };
}).handler(createSsrRpc("699213fb9b097345148afe27cb210e7f599179195de0b99579fc2a36e928e411"));
var fetchStageRows = createServerFn({ method: "POST" }).inputValidator((data) => {
	const runId = String(data?.runId ?? "").trim();
	if (!runId) throw new Error("A run id is required.");
	return { runId };
}).handler(createSsrRpc("35fae21b5400d987ce094e25c32686519438d8ac426497367e6ac50a70c62aa8"));
/**
* Edits one persisted audit row.
*
* The table name is checked against a fixed list rather than passed through: it used to be
* interpolated straight into supabase.from(table) from the browser, and the five result
* tables are the only ones this screen has any business writing.
*/
var patchAuditRowFn = createServerFn({ method: "POST" }).inputValidator((data) => {
	const table = data?.table;
	if (!EDITABLE_AUDIT_TABLES.includes(table)) throw new Error(`"${String(table)}" is not an editable audit table.`);
	const id = String(data?.id ?? "").trim();
	const runId = String(data?.runId ?? "").trim();
	const matchId = String(data?.matchId ?? "").trim();
	if (!id || !runId || !matchId) throw new Error("An audit row edit needs a row id, a run id and a match id.");
	if (!data.values || typeof data.values !== "object") throw new Error("An audit row edit needs values.");
	return {
		table,
		id,
		values: data.values,
		runId,
		matchId,
		stage: String(data?.stage ?? "")
	};
}).handler(createSsrRpc("13a6209230772209cd5d765390096804281734d26be8f2bb049601364ea9cb9b"));
var setIdentityField = createServerFn({ method: "POST" }).inputValidator((data) => {
	const matchId = String(data?.matchId ?? "").trim();
	if (!matchId) throw new Error("A match id is required.");
	if (!IDENTITY_FIELDS.includes(data?.field)) throw new Error(`"${String(data?.field)}" is not a settable identity field.`);
	if (!IDENTITY_VALUES.includes(data?.value)) throw new Error(`"${String(data?.value)}" is not a valid verification status.`);
	return {
		matchId,
		field: data.field,
		value: data.value,
		runId: data.runId ?? null
	};
}).handler(createSsrRpc("a9644ec28a2874973ba113f2fb0d96f1fa0a9f6d9693361ba5207da2e996a33f"));
var EVIDENCE_REQUIREMENTS = Object.fromEntries([
	[
		"001",
		"Surface Strength",
		"surface-specific results, Elo/rating history, surface sample",
		"RECONSTRUCTABLE"
	],
	[
		"002",
		"Serve Profile",
		"service games/points, first/second serve, aces, double faults, break points saved",
		"SOURCE_REQUIRED"
	],
	[
		"003",
		"Return Profile",
		"return points, first/second-serve return, breaks and break chances",
		"SOURCE_REQUIRED"
	],
	[
		"004",
		"Combined Efficiency",
		"serve/return point rates, hold/break rates, dominance and matchup-specific expected hold/break inputs",
		"RECONSTRUCTABLE"
	],
	[
		"005",
		"Recent Form",
		"last-5/last-10 results, set results, current-surface swing, opponent quality and chronological trend",
		"RECONSTRUCTABLE"
	],
	[
		"006",
		"Opponent-Adjusted Strength of Schedule",
		"recent opponent strength, comparable-strength results, bad-loss rate and common-opponent quality",
		"RECONSTRUCTABLE"
	],
	[
		"007",
		"Common-Opponent Network",
		"shared opponents, dates, surfaces, levels, score/results and opponent strength",
		"RECONSTRUCTABLE"
	],
	[
		"008",
		"Set Profile",
		"set-by-set scores and match results",
		"RECONSTRUCTABLE"
	],
	[
		"009",
		"Comeback/Pressure Behavior",
		"set sequence, tiebreaks and game/break-point histories",
		"SOURCE_REQUIRED"
	],
	[
		"010",
		"Straight-Set / 2–0 Metrics",
		"set scores, opponent quality and simulation inputs",
		"RECONSTRUCTABLE"
	],
	[
		"011",
		"Volatility/Floor",
		"match-level performance history, Elo/form variance, deciding-set/tiebreak reliance",
		"RECONSTRUCTABLE"
	],
	[
		"012",
		"Fatigue/Workload",
		"recent match dates, sets/games/minutes, qualifying, rest and travel",
		"PUBLIC_CONTEXT"
	],
	[
		"013",
		"Availability",
		"injury, withdrawal, retirement, medical-timeout and layoff history",
		"PUBLIC_CONTEXT"
	],
	[
		"014",
		"Ranking Context",
		"current/historical rankings and underlying performance history",
		"PUBLIC_CONTEXT"
	],
	[
		"015",
		"Market Layer",
		"multi-book prices, opening/current/closing odds, no-vig and prediction markets",
		"SOURCE_REQUIRED"
	],
	[
		"016",
		"Point-by-Point & Score-State Metrics",
		"point-by-point logs with score state and serve/return context",
		"SPECIALIZED_DATA"
	],
	[
		"017",
		"Shot & Rally Metrics",
		"charted shots, rally length, direction, winners/errors, net and court position",
		"SPECIALIZED_DATA"
	],
	[
		"018",
		"Momentum & Closing Metrics",
		"break/set/tiebreak sequence and lead/closing histories",
		"SOURCE_REQUIRED"
	],
	[
		"019",
		"Market Calibration",
		"historical player prices and outcomes by implied-probability bucket",
		"SOURCE_REQUIRED"
	],
	[
		"020",
		"Level/Tour Transition",
		"event-level history, opponent Elo gap and previous tournament trajectory",
		"RECONSTRUCTABLE"
	],
	[
		"021",
		"Surface & Environmental Context",
		"surface transitions, court speed, altitude, weather, schedule density and source agreement",
		"PUBLIC_CONTEXT"
	],
	[
		"022",
		"Serve/Return Shot-Level Efficiency",
		"serve+1, return+1, rally state and charted shot outcomes",
		"SPECIALIZED_DATA"
	],
	[
		"023",
		"Matchup-Adjusted Metrics",
		"serve/return splits plus opponent style, handedness and rally/shot compatibility",
		"SOURCE_REQUIRED"
	],
	[
		"024",
		"Hidden Performance Quality",
		"point/game stats, expected-vs-actual conversion and shot-quality inputs",
		"SPECIALIZED_DATA"
	],
	[
		"025",
		"Match Deterioration Metrics",
		"set-by-set serve/return/point/physical trends",
		"SPECIALIZED_DATA"
	],
	[
		"026",
		"Early-Warning / Slow-Start Metrics",
		"opening-game point/game sequence and early serve/return statistics",
		"SPECIALIZED_DATA"
	],
	[
		"027",
		"Opponent Finishing Ability",
		"opponent set/break lead histories and opponent serving-for-match outcomes",
		"RECONSTRUCTABLE"
	],
	[
		"028",
		"Scheduling/Context",
		"rest, recent load, travel, previous finish time, qualifying and round history",
		"PUBLIC_CONTEXT"
	],
	[
		"029",
		"Psychological/Behavioral Proxies",
		"score-state event sequences, pressure errors and closing/recovery histories",
		"SPECIALIZED_DATA"
	],
	[
		"030",
		"Tournament-Specific Strength",
		"exact-event history, venue/court-speed context and tournament-specific results",
		"RECONSTRUCTABLE"
	],
	[
		"031",
		"Extended Opponent-Network Metrics",
		"shared-opponent network, rankings/Elo, scores, games/sets and opponent strength",
		"RECONSTRUCTABLE"
	],
	[
		"032",
		"Point-to-Game Conversion Efficiency",
		"service/return points, games, breaks and deuce/score-state data",
		"SOURCE_REQUIRED"
	],
	[
		"033",
		"Break Quality Differential",
		"break-point sequence plus return pressure and opponent-error detail",
		"SPECIALIZED_DATA"
	],
	[
		"034",
		"Scoreline Deception Index",
		"final scoreline, total points won, expected-games model inputs/output, break opportunities, master Dominance Ratio inputs/output, and point-by-point score-state evidence for clutch dependency",
		"SPECIALIZED_DATA"
	],
	[
		"035",
		"False-Form Detector",
		"observed results plus expected performance from underlying statistics",
		"RECONSTRUCTABLE"
	],
	[
		"036",
		"Loss Autopsy Metrics",
		"chronological recent losses with pre-match favorite status, opponent quality, surface, point and break differentials, within-match serve/return deterioration, lead state, set-1/deciding-set/tiebreak state, verified physical context, match duration and competitiveness inputs for bad-loss severity",
		"SPECIALIZED_DATA"
	],
	[
		"037",
		"Win Autopsy Metrics",
		"recent win scores, opponent quality, dominance and retirement context",
		"RECONSTRUCTABLE"
	],
	[
		"038",
		"Opponent-Adjusted Residual Performance",
		"match-level hold, break, total-points, games, sets, Dominance Ratio, serve-points and return-points performance plus correctly oriented opponent-specific comparison cohorts/norms",
		"SOURCE_REQUIRED"
	],
	[
		"039",
		"Performance Surprise Rating",
		"chronological match-level actual underlying performance plus a reproducible pre-match expected-performance value frozen before each match; last-10 rolling surprise uses only those match-level residuals",
		"RECONSTRUCTABLE"
	],
	[
		"040",
		"Hidden Decline Detector",
		"chronological serve velocity, ace rate, first/second-serve points won, return points won, break opportunities, service-game danger-score/hold-vulnerability, double-fault rate, match duration and three-set dependency histories",
		"SPECIALIZED_DATA"
	],
	[
		"041",
		"Hidden Improvement Detector",
		"chronological opponent-quality-adjusted win/loss record trend plus chronological hold rate, return points won, Dominance Ratio, and break-points-created trends, including losses, in comparable evidence windows",
		"SOURCE_REQUIRED"
	],
	[
		"042",
		"Opponent Win Pathways",
		"completed independent serve/return/form/physical/style evidence families",
		"META_DERIVED"
	],
	[
		"043",
		"Favorite Failure-Mode Score",
		"favorite-role historical losses with pre-match favorite designation, the exact failure conditions observed in those losses (including serve/return and set-state conditions), and today's opponent's sourced ability to reproduce those same conditions",
		"SOURCE_REQUIRED"
	],
	[
		"044",
		"Opponent Upset Compatibility",
		"historical matches where the player was the underdog, verified upset outcomes, and similarity features for today's favorite across Elo, serve style, return quality, surface, ranking, handedness, rally style, price, and tournament level",
		"SOURCE_REQUIRED"
	],
	[
		"045",
		"Favorite Fragility Under Resistance",
		"favorite-role chronological game/score-state histories covering opponent holding the first three service games, missed early break chances, favorite being broken first, first set reaching 4-4, first-set tiebreaks, and the opponent forcing a deciding set",
		"SPECIALIZED_DATA"
	],
	[
		"046",
		"Match-State Elo",
		"chronological results and Elo-style update inputs conditioned separately on winning set 1, losing set 1, deciding-set play, tiebreak-heavy matches, big-server opponents, and strong-returner opponents, with reproducible archetype thresholds",
		"RECONSTRUCTABLE"
	],
	[
		"047",
		"Uncertainty-Adjusted Advantage",
		"metric estimates, samples and confidence/uncertainty model",
		"META_DERIVED"
	],
	[
		"048",
		"Independent-Evidence Count",
		"persisted independent evidence families and overlap/correlation context",
		"META_DERIVED"
	],
	[
		"049",
		"Data Contamination / Circularity Score",
		"source lineage and correlation/overlap metadata",
		"META_DERIVED"
	],
	[
		"050",
		"Robustness Tests",
		"independent model inputs and perturbation rules",
		"META_DERIVED"
	],
	[
		"051",
		"Opponent-Specific Set/Match Probabilities",
		"opponent-specific serve/return expectations plus set/match model",
		"META_DERIVED"
	],
	[
		"052",
		"Entropy & Lead Durability",
		"set/game probability distribution plus break/rebreak/lead histories",
		"SOURCE_REQUIRED"
	],
	[
		"053",
		"Pressure & Clean-Game Metrics",
		"game score sequences including 30-all, deuce and break points",
		"SPECIALIZED_DATA"
	],
	[
		"054",
		"Additional Shot-Level Efficiency",
		"charted rally/shot direction, position and attack/defense outcomes",
		"SPECIALIZED_DATA"
	],
	[
		"055",
		"Trajectory / Rolling Metrics",
		"chronological Elo, hold/break, serve/return, opponent-quality and result history",
		"RECONSTRUCTABLE"
	],
	[
		"056",
		"Data-Integrity Layer",
		"sample sizes and source metadata for each metric",
		"META_DERIVED"
	],
	[
		"057",
		"Evidence Freshness & Confirmation",
		"source timestamps, reliability, sample, surface relevance and family independence",
		"META_DERIVED"
	],
	[
		"058",
		"Stress Tests & Scenario Analysis",
		"completed independent inputs and scenario perturbation rules",
		"META_DERIVED"
	],
	[
		"059",
		"Loss Path Probability",
		"completed independent model inputs and pathway model",
		"META_DERIVED"
	],
	[
		"060",
		"Interaction / Matchup Residuals",
		"serve/return matchup plus point/shot, handedness, pressure and environmental histories",
		"SOURCE_REQUIRED"
	],
	[
		"061",
		"Final Advanced Tests",
		"independent inputs, removal tests and historical comparable-match database",
		"META_DERIVED"
	],
	[
		"062",
		"Motivation / Stakes",
		"ranking points defended, seeding implications and public milestone context",
		"PUBLIC_CONTEXT"
	],
	[
		"063",
		"Team / Support Context",
		"verified coaching, coaching-box and equipment-change reporting",
		"PUBLIC_CONTEXT"
	],
	[
		"064",
		"Draw Context",
		"official draw, entry route, qualifying/lucky-loser status and next-round path",
		"PUBLIC_CONTEXT"
	],
	[
		"065",
		"Physical/Medical (Limited Availability)",
		"credible illness, fitness and return-to-play reporting",
		"PUBLIC_CONTEXT"
	],
	[
		"066",
		"Equipment / Technical",
		"verified racket/string/shoe changes and conditions",
		"PUBLIC_CONTEXT"
	],
	[
		"067",
		"On-Court Behavior / Discipline",
		"code violations, challenge data, breaks and time-violation histories",
		"SOURCE_REQUIRED"
	],
	[
		"068",
		"Streaks / Milestones",
		"chronological results, event appearances and protected-ranking status",
		"RECONSTRUCTABLE"
	],
	[
		"069",
		"Stakes / Career Context",
		"verified retirement/farewell and anti-doping disruption reporting",
		"PUBLIC_CONTEXT"
	],
	[
		"070",
		"Support Team / Prep",
		"verified mental-coach, late-entry and walkover context",
		"PUBLIC_CONTEXT"
	],
	[
		"071",
		"Session / Environment",
		"official roof/session/start-time context",
		"PUBLIC_CONTEXT"
	],
	[
		"072",
		"Matchup Nuance",
		"backhand type, height/reach and junior/ITF meeting history",
		"PUBLIC_CONTEXT"
	],
	[
		"073",
		"Sentiment / Integrity",
		"public statements, social activity and exchange-volume integrity data",
		"PUBLIC_CONTEXT"
	],
	[
		"074",
		"Biomechanics / Physical Detail",
		"charted biomechanics, movement asymmetry and verified equipment specs",
		"SPECIALIZED_DATA"
	],
	[
		"075",
		"Match Format / Rules Context",
		"official event rules, best-of format and deciding-set rules",
		"PUBLIC_CONTEXT"
	],
	[
		"076",
		"Scheduling Micro-Context",
		"official order of play, court assignment and documented practice access",
		"PUBLIC_CONTEXT"
	],
	[
		"077",
		"Season-Long Fatigue Context",
		"season schedule, team events, off-season rest and previous-major workload",
		"RECONSTRUCTABLE"
	],
	[
		"078",
		"Sponsorship / Off-Court Pressure",
		"credible reporting of home-market commercial appearances, sponsor obligations or media obligations during the tournament week, with timing sufficient to establish recovery/preparation impact",
		"PUBLIC_CONTEXT"
	],
	[
		"079",
		"Additional Differentiating Metrics",
		"exact game/point/event logs for coaching visits, post-coaching games, shot-clock violations by set, racket changes, hydration/medical breaks, first point/game, changeovers, odd/even serve games, return position and serve patterns; plus official schedule/entry/walkover/altitude/surface-switch records and credible disciplinary, coach-history or scouting-report evidence for the named submetrics",
		"SOURCE_REQUIRED"
	],
	[
		"080",
		"Common-Opponent & Opponent-Caliber Metrics",
		"shared-opponent results plus opponent ranking/Elo quality",
		"RECONSTRUCTABLE"
	],
	[
		"081",
		"Further Differentiating Metrics",
		"official schedule/result/event-history evidence for ceremonies, featured-court exposure, rain/overnight resumptions, opponent substitutions, weekday/weekend splits, consecutive-day play, prior withdrawals, electronic-line-calling exposure, major-week split and prior-year round; plus credible reporting for backstage conflict, training-base relocation, support-staff turnover, travel friction and home-climate context",
		"PUBLIC_CONTEXT"
	]
].map(([code, name, requiredData, recovery]) => [code, {
	code,
	name,
	requiredData,
	recovery
}]));
var usable = /* @__PURE__ */ new Set([
	"DIRECT",
	"RECONSTRUCTED",
	"PARTIAL"
]);
function normCode(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function sideOf(row, side) {
	const p = side === "P1" ? "p1" : "p2";
	return {
		side,
		treatment: String(row[`${p}_treatment`] ?? row[`${p}_status`] ?? "UNAVAILABLE"),
		status: String(row[`${p}_status`] ?? row.status ?? "NOT STARTED"),
		value: row[`${p}_value`],
		reason: row[`${p}_unavailable_reason`] ?? row.unavailable_reason ?? null,
		providerError: row[`${p}_provider_error`] ?? row.provider_error ?? null
	};
}
function buildEvidenceGap(metrics) {
	const out = [];
	for (const row of metrics) {
		const code = normCode(row.metric_code);
		const req = EVIDENCE_REQUIREMENTS[code] ?? {
			code,
			name: String(row.metric_name ?? code),
			requiredData: "metric-specific source inputs",
			recovery: "SOURCE_REQUIRED"
		};
		for (const side of ["P1", "P2"]) {
			const s = sideOf(row, side);
			if (usable.has(s.treatment) && s.value !== null && s.value !== void 0 && s.value !== "") {
				out.push({
					code,
					metricName: String(row.metric_name ?? req.name),
					requiredData: req.requiredData,
					recovery: req.recovery,
					side,
					treatment: s.treatment,
					classification: "SUPPORTED",
					reason: "Usable treatment and persisted value are present."
				});
				continue;
			}
			if (s.value !== null && s.value !== void 0 && s.value !== "" && !usable.has(s.treatment)) {
				out.push({
					code,
					metricName: String(row.metric_name ?? req.name),
					requiredData: req.requiredData,
					recovery: req.recovery,
					side,
					treatment: s.treatment,
					classification: "MAPPING_OR_PROVENANCE",
					reason: "A value is persisted but the side is not carrying a usable evidence treatment; inspect provenance/status wiring before researching new data."
				});
				continue;
			}
			const reason = [s.reason, s.providerError].filter(Boolean).join(" · ") || `Missing required data: ${req.requiredData}`;
			out.push({
				code,
				metricName: String(row.metric_name ?? req.name),
				requiredData: req.requiredData,
				recovery: req.recovery,
				side,
				treatment: s.treatment,
				classification: req.recovery,
				reason
			});
		}
	}
	return out;
}
function evidenceGapSummary(items) {
	const counts = {};
	for (const item of items) counts[item.classification] = (counts[item.classification] ?? 0) + 1;
	const total = items.length;
	const supported = counts.SUPPORTED ?? 0;
	return {
		total,
		supported,
		unsupported: total - supported,
		counts,
		supportedPercent: total ? Math.round(supported / total * 1e3) / 10 : 0
	};
}
var order = [
	"MAPPING_OR_PROVENANCE",
	"RECONSTRUCTABLE",
	"SOURCE_REQUIRED",
	"PUBLIC_CONTEXT",
	"META_DERIVED",
	"SPECIALIZED_DATA",
	"SUPPORTED"
];
function EvidenceGapReport({ metrics, player1, player2 }) {
	const items = buildEvidenceGap(metrics);
	const summary = evidenceGapSummary(items);
	const unresolved = items.filter((x) => x.classification !== "SUPPORTED");
	const grouped = order.map((key) => [key, unresolved.filter((x) => x.classification === key)]).filter(([, rows]) => rows.length);
	const player = (side) => side === "P1" ? player1 : player2;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "panel p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-semibold",
					children: "Evidence Gap Report"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Metric-aware recovery plan. It does not change treatments or manufacture evidence."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-right text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-semibold",
						children: [
							summary.supported,
							"/",
							summary.total,
							" player-metric sides supported · ",
							summary.supportedPercent,
							"%"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-muted-foreground",
						children: [summary.unsupported, " sides still need recovery or a truthful unavailable classification."]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 grid gap-2 text-xs md:grid-cols-3 xl:grid-cols-6",
				children: order.filter((k) => k !== "SUPPORTED").map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-md border border-border p-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted-foreground",
						children: key.replaceAll("_", " ")
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mono-num font-semibold",
						children: summary.counts[key] ?? 0
					})]
				}, key))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 space-y-3",
				children: grouped.map(([key, rows]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
					open: key === "MAPPING_OR_PROVENANCE" || key === "RECONSTRUCTABLE",
					className: "rounded-md border border-border p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
						className: "cursor-pointer font-semibold",
						children: [
							key.replaceAll("_", " "),
							" · ",
							rows.length
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 overflow-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full min-w-[760px] text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "bg-muted",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "text-left",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "p-2",
											children: "Metric"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "p-2",
											children: "Player"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "p-2",
											children: "Treatment"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "p-2",
											children: "Required data"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "p-2",
											children: "Why / next recovery target"
										})
									]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-t border-border",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
										className: "p-2 align-top",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "mono-num",
												children: row.code
											}),
											" · ",
											row.metricName
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "p-2 align-top",
										children: player(row.side)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "p-2 align-top",
										children: row.treatment
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "p-2 align-top",
										children: row.requiredData
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "p-2 align-top",
										children: row.reason
									})
								]
							}, `${row.code}-${row.side}-${index}`)) })]
						})
					})]
				}, key))
			})
		]
	});
}
var Tabs = Root2;
var TabsList = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, {
	ref,
	className: cn("inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className),
	...props
}));
TabsList.displayName = List.displayName;
var TabsTrigger = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trigger, {
	ref,
	className: cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow", className),
	...props
}));
TabsTrigger.displayName = Trigger.displayName;
var TabsContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content, {
	ref,
	className: cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className),
	...props
}));
TabsContent.displayName = Content.displayName;
var STATUS_OPTIONS = [
	"NOT STARTED",
	"RUNNING",
	"COMPLETE",
	"BLOCKED",
	"UNAVAILABLE",
	"FAILED",
	"REQUIRES HUMAN REVIEW"
];
function Select({ value, options, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
		className: "h-8 rounded-md border border-input bg-card px-2 text-xs",
		value,
		onChange: (e) => onChange(e.target.value),
		children: options.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
			value: o,
			children: o
		}, o))
	});
}
function textValue(value) {
	if (value === null || value === void 0 || value === "") return "—";
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}
function sourcesValue(value) {
	return Array.isArray(value) ? value : [];
}
function Provenance({ row }) {
	const sources = sourcesValue(row.sources ?? row.source_attempts);
	const missing = row.missing_inputs ?? row.inputs?.missing;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
		className: "mt-2 rounded-md bg-muted p-2 text-xs",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
				className: "cursor-pointer font-semibold",
				children: "Evidence and provenance"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
				className: "mt-2 grid gap-1 md:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Exact reason"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: textValue(row.unavailable_reason ?? row.reconstruction_reason) })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Provider/API error"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: textValue(row.provider_error) })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Missing inputs"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: textValue(missing) })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Reconstruction"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: row.reconstruction_attempted ? `YES · ${textValue(row.reconstruction_reason)}` : "NO" })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Formula / method"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: textValue(row.formula) })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Calculation"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: textValue(row.calculation) })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Confidence / quality"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: textValue(row.reliability ?? row.confidence) })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Retrieved"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: row.retrieved_at ? new Date(row.retrieved_at).toLocaleString() : "—" })] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground",
					children: "Sources/providers"
				}), sources.length ? sources.map((source, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
					source["player_side"] ? `${source["player_side"]} · ` : "",
					textValue(source["source_name"] ?? source["provider"]),
					source["url"] ? ` · ${source["url"]}` : "",
					source["retrieved_at"] ? ` · ${source["retrieved_at"]}` : ""
				] }, index)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "—" })]
			})
		]
	});
}
function ResultCard({ title, subtitle, row }) {
	const status = textValue(row.treatment ?? row.status);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-md border border-border p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-start justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
					className: "font-semibold",
					children: title
				}), subtitle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: subtitle
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: status === "UNAVAILABLE" || status === "PARTIAL" || status === "RECONSTRUCTION_FAILED" ? "text-warn" : "text-ok",
					children: status
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
				className: "mt-2 grid gap-1 text-xs md:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Result/value"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: textValue(row.value ?? row.output ?? row.outcome ?? row.final_effect) })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Evidence"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: textValue(row.evidence ?? row.p1_finding ?? row.p1_risk ?? row.supporting_evidence) })] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted-foreground",
						children: "Player/affected side"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: textValue(row.player_side ?? `${row.p1_finding ? "P1 and P2" : "—"}`) })] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Provenance, { row })
		]
	});
}
/**
* Readiness of the graded set, next to raw processor throughput.
*
* The denominator comes from ACTIVE_METRIC_CODES (derived from COMPARISON_SPECS), so
* promoting a metric moves it automatically -- there is no literal count in this component.
*/
function ActiveEvidenceSummary({ rows, processingTotal }) {
	const readiness = activeMetricReadiness(rows);
	const cell = (label, value, tone) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md border border-border px-2 py-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10px] uppercase tracking-wide text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `mono-num text-sm ${tone ?? ""}`,
			children: value
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-2 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-4",
		children: [
			cell("Processing progress", `${rows.length}/${processingTotal} treated`),
			cell("Active Truth Engine evidence", `${readiness.usable}/${readiness.expected} usable · ${readiness.percent}%`),
			cell("One-sided (no lean)", String(readiness.oneSided)),
			cell("Unavailable / not executed", `${readiness.unavailable} / ${readiness.notExecuted}`)
		]
	});
}
function Workspace() {
	const { matchId } = Route.useParams();
	const qc = useQueryClient();
	const [showMatrix, setShowMatrix] = (0, import_react.useState)(false);
	const [running, setRunning] = (0, import_react.useState)(false);
	const [pipelineError, setPipelineError] = (0, import_react.useState)(null);
	const { data, isLoading } = useQuery({
		queryKey: ["match", matchId],
		refetchInterval: 3e3,
		queryFn: async () => {
			return fetchMatchWorkspace({ data: { matchId } });
		}
	});
	const refresh = () => {
		qc.invalidateQueries({ queryKey: ["match", matchId] });
		qc.invalidateQueries({ queryKey: ["stages", matchId] });
	};
	const currentRunId = data?.run?.id;
	const { data: stages } = useQuery({
		queryKey: [
			"stages",
			matchId,
			currentRunId
		],
		refetchInterval: 3e3,
		enabled: !!currentRunId,
		queryFn: async () => {
			return fetchStageRows({ data: { runId: currentRunId } });
		}
	});
	const executeBatch = useServerFn(runAuditBatch);
	const runAudit = async () => {
		setRunning(true);
		setPipelineError(null);
		try {
			const res = (await executeBatch({ data: {
				matchIds: [matchId],
				concurrency: 1
			} })).results[0];
			refresh();
			if (!res?.ok) {
				const message = safePipelineErrorMessage(res?.failures?.[0]?.message ?? "Pipeline failed");
				setPipelineError(message);
				toast.error(message);
				return;
			}
			if (res.complete) toast.success(`Audit executed — ${res.color ?? "gate run"} · ${Math.round(res.completionPercent ?? 0)}%`);
		} catch (e) {
			const message = safePipelineErrorMessage(e);
			setPipelineError(message);
			if (isPreviewForceReloadError(e)) {
				toast.info("The preview updated while the audit was running. Reloading the workspace; persisted progress is safe.");
				window.setTimeout(() => window.location.reload(), 350);
				return;
			}
			if (!isRecoverablePipelineTransportError(e)) toast.error(message);
		} finally {
			setRunning(false);
			refresh();
		}
	};
	(0, import_react.useEffect)(() => {
		if (data?.run?.status !== "RUNNING" || running) return;
		const timer = window.setTimeout(() => void runAudit(), 500);
		return () => window.clearTimeout(timer);
	}, [
		data?.run?.status,
		data?.run?.heartbeat_at,
		running
	]);
	if (isLoading || !data?.match) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "panel p-6 text-sm",
		children: "Loading match…"
	});
	const { match, run } = data;
	if (!run) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "panel space-y-3 p-6 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: data.wasInvalidated ? `The slate was cleared for ${match.player1_name} vs ${match.player2_name} — no active audit run yet.` : `No audit run yet for ${match.player1_name} vs ${match.player2_name}.` }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				onClick: runAudit,
				disabled: running,
				children: running ? "Running audit…" : "Run Audit"
			}),
			pipelineError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-blocked text-xs",
				children: pipelineError
			})
		]
	});
	const matrixWpRaw = data.fields?.find((f) => f.field_key === "matrix_wp")?.normalized_value ?? null;
	const matrixWp = matrixWpRaw ? Number(String(matrixWpRaw).replace(/[^\d.]/g, "")) : null;
	const engineInput = {
		match: {
			identity_status: match.identity_status,
			surface_status: match.surface_status,
			player1_name: match.player1_name,
			player2_name: match.player2_name
		},
		run: {
			research_lock_at: run.research_lock_at,
			independent_decision_committed_at: run.independent_decision_committed_at,
			matrix_revealed_at: run.matrix_revealed_at,
			independent_winner: run.independent_winner,
			independent_low: run.independent_low,
			independent_high: run.independent_high,
			calibration_version_id: run.calibration_version_id,
			effective_evidence_count: run.effective_evidence_count
		},
		metrics: data.metrics ?? [],
		verification: data.verification ?? [],
		disagreement: data.disagreement ?? [],
		underdog: data.underdog ?? [],
		stress: data.stress ?? [],
		reconstructions: data.reconstructions ?? [],
		conflicts: data.conflicts ?? [],
		matrixWp,
		stages: (stages ?? []).map((st) => ({
			stage: String(st.stage),
			status: String(st.status)
		}))
	};
	const report = evaluate(engineInput);
	const committed = !!run.independent_decision_committed_at;
	const patch = async (table, id, values, stage) => {
		if (run.status === "RUNNING" || run.status === "COMPLETE") {
			toast.error("Persisted audit evidence cannot be edited while an audit is running or after its final decision is complete.");
			return;
		}
		try {
			await patchAuditRowFn({ data: {
				table,
				id,
				values,
				runId: run.id,
				matchId,
				stage
			} });
		} catch (error) {
			toast.error(`Could not update ${table}: ${error instanceof Error ? error.message : String(error)}`);
			return;
		}
		refresh();
	};
	const commitIndependent = async () => {
		await runAudit();
	};
	const revealMatrix = async () => {
		await runAudit();
	};
	const applyCalibration = async () => {
		await runAudit();
	};
	const runGate = async () => {
		await runAudit();
	};
	const counts = report.counts;
	const metricRows = data.metrics ?? [];
	const verificationRows = data.verification ?? [];
	const disagreementRows = data.disagreement ?? [];
	const underdogRows = data.underdog ?? [];
	const stressRows = data.stress ?? [];
	const reconstructionRows = data.reconstructions ?? [];
	const unavailableItems = [
		...metricRows.flatMap((row) => [{
			...row,
			itemName: `${row.metric_name} · ${match.player1_name}`,
			treatment: row.p1_treatment ?? row.p1_status,
			unavailable_reason: row.p1_unavailable_reason ?? row.unavailable_reason,
			provider_error: row.p1_provider_error ?? row.provider_error,
			retrieved_at: row.p1_retrieved_at ?? row.retrieved_at
		}, {
			...row,
			itemName: `${row.metric_name} · ${match.player2_name}`,
			treatment: row.p2_treatment ?? row.p2_status,
			unavailable_reason: row.p2_unavailable_reason ?? row.unavailable_reason,
			provider_error: row.p2_provider_error ?? row.provider_error,
			retrieved_at: row.p2_retrieved_at ?? row.retrieved_at
		}]),
		...verificationRows.map((row) => ({
			...row,
			itemName: row.rule_name,
			treatment: row.status
		})),
		...disagreementRows.map((row) => ({
			...row,
			itemName: row.rule_name,
			treatment: row.status
		})),
		...underdogRows.map((row) => ({
			...row,
			itemName: `${row.pathway_name} · ${row.player_side}`,
			treatment: row.status
		})),
		...stressRows.map((row) => ({
			...row,
			itemName: row.test_name,
			treatment: row.status
		})),
		...reconstructionRows.map((row) => ({
			...row,
			itemName: `${row.metric_code} · ${row.player_side}`,
			treatment: row.status === "UNAVAILABLE" ? "RECONSTRUCTION_FAILED" : row.status
		}))
	].filter((row) => row.treatment === "UNAVAILABLE" || row.treatment === "PARTIAL" || row.treatment === "RECONSTRUCTION_FAILED");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "panel p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "text-xl font-semibold",
						children: [
							match.player1_name,
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground",
								children: "vs"
							}),
							" ",
							match.player2_name
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mono-num text-xs text-muted-foreground",
						children: [
							match.tournament_name ?? "tournament unverified",
							" · ",
							match.round ?? "round unverified",
							" ·",
							" ",
							match.surface ?? "surface unverified",
							" · RUN ",
							run.run_number,
							" · lock",
							" ",
							run.research_lock_at ? new Date(run.research_lock_at).toLocaleString() : "—"
						]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuditColorBadge, { color: data.decision?.final_audit_color ?? report.color }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								onClick: runAudit,
								disabled: running,
								children: running ? "Running audit…" : "Run Audit"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "secondary",
								onClick: runGate,
								children: "Run Final Combination Gate"
							})
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 flex flex-wrap gap-2",
					children: [{
						label: "Identity",
						value: match.identity_status,
						field: "identity_status"
					}, {
						label: "Surface",
						value: match.surface_status,
						field: "surface_status"
					}].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 rounded-md border border-border px-3 py-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted-foreground",
							children: s.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
							value: s.value,
							options: [
								"UNVERIFIED",
								"VERIFIED",
								"CONFLICT"
							],
							onChange: async (v) => {
								await setIdentityField({ data: {
									matchId,
									field: s.field,
									value: v,
									runId: run.id
								} });
								refresh();
							}
						})]
					}, s.field))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "panel p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold",
						children: "Execution diagnostics"
					}),
					pipelineError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-blocked",
						children: pipelineError
					}),
					!stages?.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted-foreground",
						children: "No stage has executed yet. Press Run Audit to execute the pipeline end to end."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActiveEvidenceSummary, {
						rows: metricRows,
						processingTotal: (data.metrics ?? []).length
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 grid gap-1 text-xs md:grid-cols-2",
						children: canonicalizeStageRows(stages ?? []).map(({ stage, row }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate",
									children: stage
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "mono-num flex shrink-0 items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row ? `${row.done_count}/${row.total_count} · attempt ${row.attempts}` : "not started" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateText, { state: row?.status ?? "PENDING" })]
								}),
								row?.error_message && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-blocked",
									children: row.error_message
								})
							]
						}, stage))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "panel p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold",
						children: "Completion proof"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mono-num mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4 xl:grid-cols-5",
						children: [
							[
								["Metrics", counts.metrics],
								["P1 metric treatment", counts.p1],
								["P2 metric treatment", counts.p2],
								["Verification", counts.verification],
								["Disagreement", counts.disagreement],
								["Underdog pathways", counts.underdog],
								["Stress tests", counts.stress],
								["Reconstructions", counts.reconstructions],
								["Critical conflicts resolved", counts.criticalConflicts],
								["Coverage records", {
									done: data.coverage?.length ?? 0,
									total: 2
								}],
								["Metric coverage records", {
									done: data.coverageRates?.length ?? 0,
									total: (data.metrics?.length ?? 0) * 2
								}],
								["Final decision", {
									done: data.decision ? 1 : 0,
									total: 1
								}]
							].map(([label, c]) => {
								const pair = c;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-md border border-border p-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-muted-foreground",
										children: label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: pair.total > 0 && pair.done === pair.total ? "text-ok" : "text-warn",
										children: [
											pair.done,
											" / ",
											pair.total
										]
									})]
								}, label);
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-md border border-border p-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-muted-foreground",
									children: "Matrix firewall"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: report.matrixFirewallValid ? "text-ok" : "text-blocked",
									children: report.matrixFirewallValid ? "VALID" : "VIOLATED"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-md border border-border p-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-muted-foreground",
									children: "Effective independent evidence"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: report.effectiveEvidenceCount })]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `mt-3 text-sm font-semibold ${report.auditComplete && report.stagesComplete ? "text-ok" : "text-warn"}`,
						children: report.auditComplete && report.stagesComplete ? "AUDIT COMPLETE — NO REQUIRED STEPS MISSING · NO SHORTCUTS" : !report.stagesComplete ? `AUDIT INCOMPLETE — pipeline still executing: ${report.stageGaps.join(", ")}` : "AUDIT INCOMPLETE"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 rounded-md border border-border p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-baseline justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-sm font-semibold",
									children: "Evidence coverage"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: report.coverage.usablePercent >= report.coverage.thresholdPercent ? "text-ok" : "text-warn",
									children: [
										report.coverage.usablePercent,
										"% usable · execution ",
										report.completionPercent,
										"%"
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2 grid gap-2 text-xs md:grid-cols-2",
								children: [[match.player1_name, report.coverage.p1], [match.player2_name, report.coverage.p2]].map(([player, coverage]) => {
									const c = coverage;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-md bg-muted p-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between font-semibold",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: player }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [c.usablePercent, "% usable"] })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mt-1 text-muted-foreground",
											children: [
												"DIRECT ",
												c.direct,
												" · RECONSTRUCTED ",
												c.reconstructed,
												" · PARTIAL ",
												c.partial,
												" · UNAVAILABLE ",
												c.unavailable,
												" · EXCLUDED ",
												c.excluded
											]
										})]
									}, player);
								})
							}),
							report.coverage.usablePercent < report.coverage.thresholdPercent && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-xs text-warn",
								children: "Low coverage changes the gate to INSUFFICIENT EVIDENCE; it is reported separately from execution completion."
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 grid gap-1 text-xs md:grid-cols-2",
						children: report.checks.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: c.pass ? "text-muted-foreground" : "text-blocked",
							children: [
								c.pass ? "✓" : "✗",
								" ",
								c.label,
								" — ",
								c.detail
							]
						}, c.key))
					}),
					report.greenLockReasons.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 rounded-md border border-border bg-muted p-3 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-semibold",
							children: "GREEN LOCKED"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-1 list-disc pl-4",
							children: report.greenLockReasons.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: r }, r))
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EvidenceGapReport, {
				metrics: metricRows,
				player1: match.player1_name,
				player2: match.player2_name
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel space-y-4 p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "font-semibold",
						children: ["Detailed audit results · current run ", run.run_number]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "Every persisted metric, rule, pathway, stress test, and reconstruction is shown below. Expand a row for source, timestamp, missing inputs, provider errors, and method."
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
						open: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
							className: "cursor-pointer font-semibold",
							children: ["Player 1 metrics · ", metricRows.length]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 grid gap-2",
							children: metricRows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultCard, {
								title: textValue(row.metric_name),
								subtitle: `${match.player1_name} · ${textValue(row.metric_code)}`,
								row: {
									...row,
									value: row.p1_value,
									treatment: row.p1_treatment ?? row.p1_status,
									unavailable_reason: row.p1_unavailable_reason ?? row.unavailable_reason,
									provider_error: row.p1_provider_error ?? row.provider_error,
									retrieved_at: row.p1_retrieved_at ?? row.retrieved_at
								}
							}, `${row.id}-p1`))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
						open: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
							className: "cursor-pointer font-semibold",
							children: ["Player 2 metrics · ", metricRows.length]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 grid gap-2",
							children: metricRows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultCard, {
								title: textValue(row.metric_name),
								subtitle: `${match.player2_name} · ${textValue(row.metric_code)}`,
								row: {
									...row,
									value: row.p2_value,
									treatment: row.p2_treatment ?? row.p2_status,
									unavailable_reason: row.p2_unavailable_reason ?? row.unavailable_reason,
									provider_error: row.p2_provider_error ?? row.p2_provider_error,
									retrieved_at: row.p2_retrieved_at ?? row.retrieved_at
								}
							}, `${row.id}-p2`))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
						open: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
							className: "cursor-pointer font-semibold",
							children: [
								"Verification Audit · ",
								verificationRows.length,
								" rules"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 grid gap-2",
							children: verificationRows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultCard, {
								title: textValue(row.rule_name),
								subtitle: `${textValue(row.rule_code)} · outcome ${textValue(row.outcome)} · severity ${textValue(row.severity)}`,
								row
							}, row.id))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
						open: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
							className: "cursor-pointer font-semibold",
							children: [
								"Disagreement / Trap Audit · ",
								disagreementRows.length,
								" rules"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 grid gap-2",
							children: disagreementRows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultCard, {
								title: textValue(row.rule_name),
								subtitle: `${textValue(row.rule_code)} · contradiction ${textValue(row.contradiction_severity)}`,
								row
							}, row.id))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
						open: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
							className: "cursor-pointer font-semibold",
							children: [
								"Dangerous Underdog Audit · ",
								underdogRows.length,
								" pathways"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 grid gap-2",
							children: underdogRows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultCard, {
								title: textValue(row.pathway_name),
								subtitle: `${textValue(row.pathway_code)} · ${textValue(row.player_side)} · classification ${textValue(row.classification)}`,
								row
							}, row.id))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
						open: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
							className: "cursor-pointer font-semibold",
							children: ["Stress / Removal Tests · ", stressRows.length]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 grid gap-2",
							children: stressRows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultCard, {
								title: textValue(row.test_name),
								subtitle: `${textValue(row.test_code)} · before ${textValue(row.winner_before)} · after ${textValue(row.winner_after)}`,
								row
							}, row.id))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
						open: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
							className: "cursor-pointer font-semibold",
							children: [
								"Reconstructions · ",
								reconstructionRows.length,
								" attempts"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 grid gap-2",
							children: reconstructionRows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultCard, {
								title: textValue(row.metric_code),
								subtitle: `${textValue(row.player_side)} · ${textValue(row.status)}`,
								row: {
									...row,
									value: row.output,
									missing_inputs: row.missing_inputs ?? row.inputs?.missing
								}
							}, row.id))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
						open: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
							className: "cursor-pointer font-semibold",
							children: [
								"UNAVAILABLE DATA · ",
								unavailableItems.length,
								" items"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 grid gap-2",
							children: unavailableItems.length ? unavailableItems.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultCard, {
								title: textValue(row.itemName),
								subtitle: textValue(row.treatment),
								row
							}, `${row.id ?? row.itemName}-${index}`)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-ok",
								children: "No unavailable or partial items recorded for this run."
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
						className: "cursor-pointer font-semibold",
						children: ["Source conflicts · ", data.conflicts?.length ?? 0]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 grid gap-2",
						children: (data.conflicts ?? []).map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultCard, {
							title: textValue(row.data_key),
							subtitle: `${textValue(row.resolution_status)} · critical ${textValue(row.critical)}`,
							row
						}, row.id))
					})] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
				defaultValue: "metrics",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
						className: "flex-wrap",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
								value: "metrics",
								children: "P1 vs P2 Metrics"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
								value: "verification",
								children: "Verification"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
								value: "disagreement",
								children: "Disagreement / Trap"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
								value: "underdog",
								children: "Dangerous Underdog"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
								value: "stress",
								children: "Stress / Removal"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
								value: "conclusion",
								children: "Conclusion & Matrix"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "metrics",
						className: "panel mt-3 p-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "max-h-[70vh] overflow-auto",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
								className: "w-full text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
									className: "sticky top-0 bg-header text-header-foreground",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
										className: "text-left",
										children: [
											"#",
											"Metric",
											`P1 · ${match.player1_name}`,
											"P1 status",
											`P2 · ${match.player2_name}`,
											"P2 status",
											"Metric status"
										].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "px-2 py-2 text-xs font-semibold uppercase",
											children: h
										}, h))
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: metricRows.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "border-t border-border",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "mono-num px-2 py-1 text-xs",
											children: m.metric_code
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: m.metric_name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												className: "h-8",
												defaultValue: m.p1_value ?? "",
												onBlur: (e) => patch("metric_results", m.id, { p1_value: e.target.value }, "P1 VS P2 FULL METRICS")
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
												value: m.p1_status,
												options: STATUS_OPTIONS,
												onChange: (v) => patch("metric_results", m.id, { p1_status: v }, "P1 VS P2 FULL METRICS")
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												className: "h-8",
												defaultValue: m.p2_value ?? "",
												onBlur: (e) => patch("metric_results", m.id, { p2_value: e.target.value }, "P1 VS P2 FULL METRICS")
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
												value: m.p2_status,
												options: STATUS_OPTIONS,
												onChange: (v) => patch("metric_results", m.id, { p2_status: v }, "P1 VS P2 FULL METRICS")
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
												value: m.status,
												options: STATUS_OPTIONS,
												onChange: (v) => patch("metric_results", m.id, { status: v }, "P1 VS P2 FULL METRICS")
											})
										})
									]
								}, m.id)) })]
							})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "verification",
						className: "panel mt-3 p-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "max-h-[70vh] overflow-auto",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
								className: "w-full text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
									className: "sticky top-0 bg-header text-header-foreground",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
										className: "text-left",
										children: [
											"#",
											"Rule",
											"P1 finding",
											"P2 finding",
											"Outcome",
											"Severity",
											"Status"
										].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "px-2 py-2 text-xs font-semibold uppercase",
											children: h
										}, h))
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: verificationRows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "border-t border-border",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "mono-num px-2 py-1 text-xs",
											children: r.rule_code
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: r.rule_name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												className: "h-8",
												defaultValue: r.p1_finding ?? "",
												onBlur: (e) => patch("verification_results", r.id, { p1_finding: e.target.value }, "VERIFICATION AUDIT")
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												className: "h-8",
												defaultValue: r.p2_finding ?? "",
												onBlur: (e) => patch("verification_results", r.id, { p2_finding: e.target.value }, "VERIFICATION AUDIT")
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
												value: r.outcome,
												options: [
													"NOT STARTED",
													"PASS",
													"WARN",
													"FAIL"
												],
												onChange: (v) => patch("verification_results", r.id, { outcome: v }, "VERIFICATION AUDIT")
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
												value: r.severity ?? "STANDARD",
												options: ["STANDARD", "CRITICAL"],
												onChange: (v) => patch("verification_results", r.id, { severity: v }, "VERIFICATION AUDIT")
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
												value: r.status,
												options: STATUS_OPTIONS,
												onChange: (v) => patch("verification_results", r.id, { status: v }, "VERIFICATION AUDIT")
											})
										})
									]
								}, r.id)) })]
							})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "disagreement",
						className: "panel mt-3 p-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "max-h-[70vh] overflow-auto",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
								className: "w-full text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
									className: "sticky top-0 bg-header text-header-foreground",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
										className: "text-left",
										children: [
											"#",
											"Rule",
											"P1 risk",
											"P2 risk",
											"Contradiction severity",
											"Status"
										].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "px-2 py-2 text-xs font-semibold uppercase",
											children: h
										}, h))
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: disagreementRows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "border-t border-border",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "mono-num px-2 py-1 text-xs",
											children: r.rule_code
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: r.rule_name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												className: "h-8",
												defaultValue: r.p1_risk ?? "",
												onBlur: (e) => patch("disagreement_results", r.id, { p1_risk: e.target.value }, "DISAGREEMENT / TRAP AUDIT")
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												className: "h-8",
												defaultValue: r.p2_risk ?? "",
												onBlur: (e) => patch("disagreement_results", r.id, { p2_risk: e.target.value }, "DISAGREEMENT / TRAP AUDIT")
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
												value: r.contradiction_severity ?? "NONE",
												options: [
													"NONE",
													"MINOR",
													"MATERIAL",
													"CRITICAL"
												],
												onChange: (v) => patch("disagreement_results", r.id, { contradiction_severity: v }, "DISAGREEMENT / TRAP AUDIT")
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
												value: r.status,
												options: STATUS_OPTIONS,
												onChange: (v) => patch("disagreement_results", r.id, { status: v }, "DISAGREEMENT / TRAP AUDIT")
											})
										})
									]
								}, r.id)) })]
							})
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "underdog",
						className: "panel mt-3 p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-2 text-xs text-muted-foreground",
							children: "Both players get every pathway. \"Underdog\" is the lower-confidence side of the independent audit, not the Matrix underdog."
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "max-h-[70vh] overflow-auto",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
								className: "w-full text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
									className: "sticky top-0 bg-header text-header-foreground",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
										className: "text-left",
										children: [
											"Player",
											"Pathway",
											"Evidence",
											"Classification",
											"Status"
										].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
											className: "px-2 py-2 text-xs font-semibold uppercase",
											children: h
										}, h))
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: underdogRows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
									className: "border-t border-border",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: r.player_side
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: r.pathway_name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												className: "h-8",
												defaultValue: r.evidence ?? "",
												onBlur: (e) => patch("underdog_results", r.id, { evidence: e.target.value }, "DANGEROUS UNDERDOG AUDIT")
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
												value: r.classification,
												options: [
													"UNRESOLVED",
													"WEAK",
													"REALISTIC",
													"STRONG"
												],
												onChange: (v) => patch("underdog_results", r.id, { classification: v }, "DANGEROUS UNDERDOG AUDIT")
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											className: "px-2 py-1",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
												value: r.status,
												options: STATUS_OPTIONS,
												onChange: (v) => patch("underdog_results", r.id, { status: v }, "DANGEROUS UNDERDOG AUDIT")
											})
										})
									]
								}, r.id)) })]
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "stress",
						className: "panel mt-3 p-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "bg-header text-header-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
									className: "text-left",
									children: [
										"#",
										"Test",
										"Winner before",
										"Winner after",
										"Outcome",
										"Status"
									].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-2 py-2 text-xs font-semibold uppercase",
										children: h
									}, h))
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: stressRows.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-t border-border",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "mono-num px-2 py-1 text-xs",
										children: s.test_code
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-2 py-1",
										children: s.test_name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-2 py-1",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											className: "h-8",
											defaultValue: s.winner_before ?? "",
											onBlur: (e) => patch("stress_results", s.id, { winner_before: e.target.value }, "STRESS / REMOVAL TESTS")
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-2 py-1",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											className: "h-8",
											defaultValue: s.winner_after ?? "",
											onBlur: (e) => patch("stress_results", s.id, { winner_after: e.target.value }, "STRESS / REMOVAL TESTS")
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-2 py-1",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
											value: s.outcome,
											options: [
												"NOT STARTED",
												"NOT EVALUATED",
												"STABLE",
												"MOSTLY STABLE",
												"UNSTABLE",
												"FAILS"
											],
											onChange: (v) => patch("stress_results", s.id, { outcome: v }, "STRESS / REMOVAL TESTS")
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-2 py-1",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Select, {
											value: s.status,
											options: STATUS_OPTIONS,
											onChange: (v) => patch("stress_results", s.id, { status: v }, "STRESS / REMOVAL TESTS")
										})
									})
								]
							}, s.id)) })]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "conclusion",
						className: "mt-3 grid gap-3 lg:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "panel p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-semibold",
									children: "Branch B — independent conclusion"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground",
									children: "Committed before any Matrix output is visible."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 space-y-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mono-num text-sm",
											children: [run.independent_winner ?? (committed ? "INSUFFICIENT EVIDENCE" : "not committed yet"), run.independent_low !== null && run.independent_high !== null ? ` · ${run.independent_low}–${run.independent_high}%` : ""]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "sm",
											onClick: commitIndependent,
											disabled: committed,
											children: committed ? "Committed" : "Commit independent conclusion"
										}),
										committed && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mono-num text-xs text-muted-foreground",
											children: [
												run.independent_winner ?? "INSUFFICIENT EVIDENCE",
												" · committed ",
												new Date(run.independent_decision_committed_at).toLocaleString()
											]
										})
									]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "panel p-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-semibold",
								children: "Branch A — Matrix (firewalled)"
							}), !run.matrix_revealed_at ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: "Matrix outputs are hidden. Reveal is only possible after the independent conclusion is committed."
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								className: "mt-3",
								onClick: revealMatrix,
								disabled: !committed,
								children: "Reveal Matrix & compare"
							})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mono-num mt-1 text-xs text-muted-foreground",
									children: ["revealed ", new Date(run.matrix_revealed_at).toLocaleString()]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
									className: "mono-num mt-2 grid grid-cols-2 gap-1 text-xs",
									children: MATRIX_FIELDS.map((k) => {
										const v = data.fields?.find((f) => f.field_key === k)?.normalized_value;
										if (!v && !showMatrix) return null;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "rounded border border-border p-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
												className: "text-muted-foreground",
												children: k
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: v ?? "UNAVAILABLE" })]
										}, k);
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-muted-foreground",
									children: "Matrix-derived signals never count toward independent evidence."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex items-center gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "sm",
											variant: "secondary",
											onClick: applyCalibration,
											children: "Apply current calibration"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BucketBadge, { code: bucketFor(matrixWp, data.buckets ?? [])?.bucket_code ?? null }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateText, { state: run.calibration_version_id ? "COMPLETE" : "NOT STARTED" })
									]
								})
							] })]
						})]
					})
				]
			})
		]
	});
}
//#endregion
export { Workspace as component };
