//#region node_modules/.nitro/vite/services/ssr/assets/metric-classification-BT9JbLCb.js
var DATE = "2026-08-27";
var QUARANTINE_DATE = "2026-09-03";
var META = [
	{
		metric_code: "059",
		metric_name: "Loss Path Probability",
		classification: "META_OR_NON_PLAYER",
		required_raw_fields: "Per-pathway probability that the model's own pick loses, broken out by mechanism",
		sources_checked: ["public/seed/metrics.txt definition text"],
		reconstruction_attempted: false,
		reconstruction_result: "NOT_APPLICABLE_NON_PLAYER_METRIC",
		reason: "Every one of this code's seven bullets is framed identically: 'the probability THE PICK loses specifically because...' (opponent serves through, return exposed, slow start, physical decline, tiebreak variance, three-set collapse, other). This is a property of the model's own prediction and its failure modes, not an observable fact about either player. Added during the Task 20/21 classification reconciliation -- this branch's earlier metric-source-family-policy.ts already excluded it from every deterministic engine's admissible-family set for the same reason; this record formalizes that into the canonical registry so it is also excluded from the coverage denominator rather than silently starved of evidence forever.",
		whether_future_ingestion_could_change_status: false,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "048",
		metric_name: "Independent-Evidence Count",
		classification: "META_OR_NON_PLAYER",
		required_raw_fields: "Count of genuinely independent signals among the model's own agreeing metrics",
		sources_checked: ["public/seed/metrics.txt definition text"],
		reconstruction_attempted: false,
		reconstruction_result: "NOT_APPLICABLE_NON_PLAYER_METRIC",
		reason: "Definition: 'the estimated number of genuinely independent signals among those that agree, after accounting for overlapping underlying data.' This describes the model's own evidence-agreement structure, not player A vs player B evidence.",
		whether_future_ingestion_could_change_status: false,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "049",
		metric_name: "Data Contamination / Circularity Score",
		classification: "META_OR_NON_PLAYER",
		required_raw_fields: "Score reflecting how much of the model's consensus comes from independent vs. recycled inputs",
		sources_checked: ["public/seed/metrics.txt definition text"],
		reconstruction_attempted: false,
		reconstruction_result: "NOT_APPLICABLE_NON_PLAYER_METRIC",
		reason: "Definition: 'a 0-100 score reflecting how much of the model's apparent consensus comes from genuinely separate data sources versus recycled/overlapping inputs.' Property of the model's evidence base, not either player.",
		whether_future_ingestion_could_change_status: false,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "050",
		metric_name: "Robustness Tests",
		classification: "META_OR_NON_PLAYER",
		required_raw_fields: "Perturbation re-runs of the model's own prediction; winner-switch threshold of the pick",
		sources_checked: ["public/seed/metrics.txt definition text"],
		reconstruction_attempted: false,
		reconstruction_result: "NOT_APPLICABLE_NON_PLAYER_METRIC",
		reason: "Definition: 'rerunning the prediction thousands of times with small, realistic perturbations to inputs ... to see how often the original winner is retained.' Tests the model's pick stability, not a player fact.",
		whether_future_ingestion_could_change_status: false,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "056",
		metric_name: "Data-Integrity Layer",
		classification: "META_OR_NON_PLAYER",
		required_raw_fields: "Sample-size adequacy assessment of the system's other metrics",
		sources_checked: ["public/seed/metrics.txt definition text"],
		reconstruction_attempted: false,
		reconstruction_result: "NOT_APPLICABLE_NON_PLAYER_METRIC",
		reason: "Definition: 'whether the sample size backing each individual metric is sufficient.' A meta-property of other metrics, not a player fact.",
		whether_future_ingestion_could_change_status: false,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "057",
		metric_name: "Evidence Freshness & Confirmation",
		classification: "META_OR_NON_PLAYER",
		required_raw_fields: "Weighted freshness score combining a metric's own reliability/recency/sample; independent-confirmation ratio across metrics",
		sources_checked: ["public/seed/metrics.txt definition text"],
		reconstruction_attempted: false,
		reconstruction_result: "NOT_APPLICABLE_NON_PLAYER_METRIC",
		reason: "Definition combines 'a metric's value, sample reliability, recency, opponent quality, and surface relevance into a single effective evidence weight' and counts 'independent evidence families that agree' — evaluates the evidence system's own outputs, not a player fact.",
		whether_future_ingestion_could_change_status: false,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "058",
		metric_name: "Stress Tests & Scenario Analysis",
		classification: "META_OR_NON_PLAYER",
		required_raw_fields: "Re-run of the model's own prediction under shifted/optimistic/pessimistic assumption sets",
		sources_checked: ["public/seed/metrics.txt definition text"],
		reconstruction_attempted: false,
		reconstruction_result: "NOT_APPLICABLE_NON_PLAYER_METRIC",
		reason: "Definition: 'rerunning the prediction with reasonable assumptions deliberately shifted' and reporting 'the favorite's win probability under' bear/base/bull cases. Scenario-analyzes the pick, not either player directly.",
		whether_future_ingestion_could_change_status: false,
		date_classified: DATE,
		review_status: "REVIEWED"
	}
];
var PROTECTED = [
	{
		metric_code: "017",
		metric_name: "Shot & Rally Metrics",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "Per-shot stroke type (forehand/backhand), court position/depth, net-approach events, rally shot sequencing",
		sources_checked: [
			"approved BSD PBP adapters (bsd-atp-main-pbp.server.ts, bsd-wta-main-pbp.server.ts, bsd-atp-challenger-pbp.server.ts, bsd-wta-challenger-pbp.server.ts) — point/score-state only, no shot-level fields",
			"four-tour historical results (runtime-tennis-index) — match-level only",
			"source_observations table — no shot-tracking observation_type",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS — approved PBP contains point winner and score state, not stroke type or court position",
		reason: "Requires shot-by-shot stroke/position data (forehand vs backhand outcome, net-point frequency, baseline depth). No shot-tracking data source is ingested anywhere in this system.",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "063",
		metric_name: "Team / Support Context",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "Coaching-staff change history, courtside coach-presence per match, equipment-sponsor change dates",
		sources_checked: [
			"four-tour historical results / schedules — no coaching or equipment fields",
			"source_observations table — no coaching/equipment observation_type",
			"approved BSD PBP — point/score-state only",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS",
		reason: "Requires coaching-change and courtside-presence history. No such dataset is ingested; this is typically sourced from tennis-media reporting, which is not currently an approved/wired public source in this project.",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "065",
		metric_name: "Physical/Medical (Limited Availability)",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "Off-season training/fitness reports, documented minor-illness reports",
		sources_checked: [
			"four-tour historical results / schedules — no medical/illness fields",
			"source_observations table — no medical observation_type",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS",
		reason: "Requires medical/illness reporting. The metric's own title in the source document ('Limited Availability') flags this by original design. No structured medical dataset exists in the approved evidence universe.",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "066",
		metric_name: "Equipment / Technical",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "Racket/string setup changes, shoe/sponsor changes, per-player string-tension weather adjustment history",
		sources_checked: [
			"four-tour historical results / schedules — no equipment fields",
			"source_observations table — no equipment observation_type",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS",
		reason: "Requires equipment-change tracking. No such dataset is ingested anywhere in this system.",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "067",
		metric_name: "On-Court Behavior / Discipline",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "Code-violation history, Hawk-Eye challenge success rate, bathroom/medical-break timing, time-violation rate",
		sources_checked: [
			"approved BSD PBP — point/score-state only, no violation/challenge/break-timing fields",
			"four-tour historical results / schedules — no discipline fields",
			"source_observations table — no discipline observation_type",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS",
		reason: "Requires officiating/discipline records (code violations, challenge outcomes, break timing). Not present in any ingested source. Hawk-Eye challenge stats are sometimes publicly reported per-tournament, so this is flagged reversible rather than permanent.",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "072",
		metric_name: "Matchup Nuance",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "Backhand grip style (one/two-handed), player reach/wingspan measurements, junior/ITF-era match history",
		sources_checked: [
			"four-tour historical results (ATP/WTA Main + Challenger) — main/challenger tour level only, no junior/ITF results",
			"source_observations table — no biometric/style fields",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS",
		reason: "Two of three sub-components require physical/style attributes (grip style, wingspan) not tracked anywhere; the third (junior/ITF H2H) needs match data below this system's tour-level scope (ATP/WTA Main and Challenger only).",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "074",
		metric_name: "Biomechanics / Physical Detail",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "Serve toss consistency, racket spec matchup, movement-asymmetry history, grip-size changes",
		sources_checked: [
			"approved BSD PBP — point/score-state only, no biomechanical fields",
			"source_observations table — no biomechanics observation_type",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS",
		reason: "Requires biomechanical/equipment-spec tracking (toss consistency, racket specs, movement asymmetry). No such dataset exists in the approved evidence universe.",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "078",
		metric_name: "Sponsorship / Off-Court Pressure",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "Sponsor/media appearance obligations during tournament week, especially home-market appearances",
		sources_checked: [
			"four-tour historical results / schedules — no sponsorship/appearance fields",
			"source_observations table — no sponsorship observation_type",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS",
		reason: "Requires sponsor-obligation/appearance tracking. No such dataset is ingested anywhere in this system.",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "054",
		metric_name: "Additional Shot-Level Efficiency",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "Rally shot-count classification (<=4 shots), court-position/depth tracking for defense-to-offense and attack-conversion detection",
		sources_checked: [
			"approved BSD PBP adapters — point winner and score state only, no shot-count or court-position fields",
			"source_observations table — no shot-tracking observation_type",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS",
		reason: "Every defined component (first-strike efficiency by rally length, neutral-rally efficiency, defense-to-offense/attack conversion, depth-pressure differential) requires shot-by-shot rally data. Same missing data class as metric 017; no shot-tracking source is ingested anywhere in this system.",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "069",
		metric_name: "Stakes / Career Context",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "Public retirement-tour announcement status, anti-doping out-of-competition testing schedule/disruption",
		sources_checked: [
			"four-tour historical results / schedules — no retirement-announcement or doping-test fields",
			"source_observations table — no matching observation_type",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS",
		reason: "Both defined components (retirement-tour/farewell-run emotional effects, anti-doping testing disruption) require public-announcement or testing-schedule data not present in any ingested source.",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "079",
		metric_name: "Additional Differentiating Metrics",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "On-court coaching-visit events and outcomes, shot-clock/time-violation events per set",
		sources_checked: [
			"approved BSD PBP adapters — point winner and score state only, no coaching-visit or violation-event fields",
			"source_observations table — no matching observation_type",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS",
		reason: "All three defined components require in-match officiating/coaching-visit event logs (chair-side coaching usage, post-visit performance, shot-clock violations by set). No such event-level dataset is ingested anywhere in this system.",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "081",
		metric_name: "Further Differentiating Metrics",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "Locker-room/backstage conflict reports, anthem/opening-ceremony delay flags, show-court vs outer-court assignment, in-match rain-delay resumption events",
		sources_checked: [
			"four-tour historical results / schedules — no conflict/ceremony/court-assignment fields",
			"environment source (open_meteo) — provides weather conditions, not an in-match delay/interruption event log",
			"source_observations table — no matching observation_type",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS",
		reason: "All four defined components need data this system doesn't ingest: conflict reports, ceremony-delay flags, court/show-court assignment, or an actual in-match rain-delay event (weather presence alone doesn't establish a delay occurred or when play resumed).",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "073",
		metric_name: "Sentiment / Integrity",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "Pre-match interview/press-conference sentiment, social-media engagement-anomaly detection, betting-exchange matched-volume spike data",
		sources_checked: [
			"four-tour historical results / schedules — no interview transcript, social-media, or exchange-volume fields",
			"source_observations table — no matching observation_type",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players ahead of a specific match, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS",
		reason: "All three defined components (public-statement sentiment, social-media engagement anomalies, betting-exchange matched-volume spikes) require data streams this system does not ingest: interview/press-conference transcripts with sentiment labeling, social-media activity monitoring, or per-exchange matched-volume feeds. No such dataset exists in the approved evidence universe.",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	},
	{
		metric_code: "076",
		metric_name: "Scheduling Micro-Context",
		classification: "PROTECTED_UNAVAILABLE",
		required_raw_fields: "Match order on the day's schedule / not-before status, outer-court vs stadium-court assignment, official practice-court access time before the match",
		sources_checked: [
			"four-tour historical results / schedules — record tournament/round/date but not order-of-play, court assignment, or practice-time fields",
			"source_observations table — no matching observation_type",
			"protected-metric-wiring.server.ts live web-search LLM researcher (aiResearcher) -- checked and found not practically productive for this fact type: the required named components essentially never appear in generically web-indexed, LLM-searchable form for individual active pro players' specific matches, so this pathway is logged as checked rather than silently omitted"
		],
		reconstruction_attempted: true,
		reconstruction_result: "NO_QUALIFYING_FIELDS",
		reason: "All three defined components (order-of-play position, outer-court/stadium-court assignment, pre-match practice-court access) require day-of order-of-play and court-scheduling data this system does not ingest. Tournament/round/date is not the same as a court assignment or a running order, so this cannot be inferred from existing results/schedule data.",
		whether_future_ingestion_could_change_status: true,
		date_classified: DATE,
		review_status: "REVIEWED"
	}
];
var MATRIX_SUMMARY = [
	["015", "Market Layer"],
	["019", "Market Calibration"],
	["022", "Serve/Return Shot-Level Efficiency"],
	["024", "Hidden Performance Quality"],
	["025", "Match Deterioration Metrics"],
	["026", "Early-Warning / Slow-Start Metrics"],
	["033", "Break Quality Differential"],
	["035", "False-Form Detector"],
	["037", "Win Autopsy Metrics"],
	["039", "Performance Surprise Rating"],
	["040", "Hidden Decline Detector"],
	["042", "Opponent Win Pathways"],
	["060", "Interaction / Matchup Residuals"],
	["070", "Support Team / Prep"],
	["075", "Match Format / Rules Context"]
].map(([metric_code, metric_name]) => ({
	metric_code,
	metric_name,
	classification: "MATRIX_SUMMARY_REQUIRED",
	required_raw_fields: "Actual Tennis Matrix AI Summary evidence uploaded into the Truth Engine, extracted and field-validated, sufficient to satisfy this code's own definition.",
	sources_checked: ["Truth Engine uploaded Tennis Matrix AI Summary evidence (none present for this code at quarantine time)"],
	reconstruction_attempted: false,
	reconstruction_result: "NOT_ATTEMPTED — deliberately not reconstructed from substitute inputs. General tennis data, external tennis sites, historical match data, estimates, defaults, placeholders, synthetic values and inferred opponent information are all inadmissible stand-ins for the missing Matrix Summary and must never be used to make this code calculable.",
	reason: "Quarantined from the ACTIVE audit pipeline pending real Tennis Matrix AI Summary evidence in the Truth Engine. Definition, formulas, schema, metric ID/name and all historical results/evidence are preserved; only current active-audit eligibility is withdrawn, so the code contributes no active weight and cannot block an audit.",
	whether_future_ingestion_could_change_status: true,
	date_classified: QUARANTINE_DATE,
	review_status: "REVIEWED"
}));
var UNKNOWN = [];
var META_OR_NON_PLAYER_CODES = new Set(META.map((r) => r.metric_code));
var PROTECTED_UNAVAILABLE_CODES = new Set(PROTECTED.map((r) => r.metric_code));
var MATRIX_SUMMARY_REQUIRED_CODES = new Set(MATRIX_SUMMARY.map((r) => r.metric_code));
var UNKNOWN_REQUIRES_REVIEW_CODES = new Set(UNKNOWN.map((r) => r.metric_code));
var ALL_RECORDS = [
	...META,
	...PROTECTED,
	...MATRIX_SUMMARY,
	...UNKNOWN
];
var BY_CODE = new Map(ALL_RECORDS.map((r) => [r.metric_code, r]));
if (BY_CODE.size !== ALL_RECORDS.length) {
	const seen = /* @__PURE__ */ new Set();
	const duplicates = ALL_RECORDS.map((r) => r.metric_code).filter((code) => seen.has(code) ? true : (seen.add(code), false));
	throw new Error(`metric-classification: a metric code carries more than one classification record: ${[...new Set(duplicates)].join(", ")}`);
}
function classificationRecordFor(metricCode) {
	return BY_CODE.get(metricCode.padStart(3, "0")) ?? null;
}
function classifyMetric(metricCode) {
	return classificationRecordFor(metricCode)?.classification ?? "LEGITIMATE_PLAYER_METRIC";
}
function playerEvidenceDenominatorCodes() {
	const codes = [];
	for (let i = 1; i <= 81; i++) {
		const code = String(i).padStart(3, "0");
		if (META_OR_NON_PLAYER_CODES.has(code) || PROTECTED_UNAVAILABLE_CODES.has(code) || MATRIX_SUMMARY_REQUIRED_CODES.has(code)) continue;
		codes.push(code);
	}
	return codes;
}
function metricUniverseAccounting() {
	const activeDenominator = 81 - META_OR_NON_PLAYER_CODES.size - PROTECTED_UNAVAILABLE_CODES.size - MATRIX_SUMMARY_REQUIRED_CODES.size;
	return {
		total_original_metric_universe: 81,
		meta_or_non_player_count: META_OR_NON_PLAYER_CODES.size,
		protected_unavailable_count: PROTECTED_UNAVAILABLE_CODES.size,
		matrix_summary_required_count: MATRIX_SUMMARY_REQUIRED_CODES.size,
		unknown_requires_review_count: UNKNOWN_REQUIRES_REVIEW_CODES.size,
		legitimate_player_metric_count: activeDenominator,
		legitimate_player_metric_count_including_quarantined: activeDenominator + MATRIX_SUMMARY_REQUIRED_CODES.size,
		meta_or_non_player_codes: [...META_OR_NON_PLAYER_CODES],
		protected_unavailable_codes: [...PROTECTED_UNAVAILABLE_CODES],
		matrix_summary_required_codes: [...MATRIX_SUMMARY_REQUIRED_CODES],
		unknown_requires_review_codes: [...UNKNOWN_REQUIRES_REVIEW_CODES]
	};
}
//#endregion
export { metricUniverseAccounting as n, playerEvidenceDenominatorCodes as r, classifyMetric as t };
