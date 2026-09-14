import { n as matchSideForName, r as playerNamesMatch } from "./match-result-resolution-BrkpAhxT.mjs";
import { t as classifyMetric } from "./metric-classification-BT9JbLCb.mjs";
import { c as unmetDependencies, i as STAGE_DEPENDENCIES, n as INVALIDATED_RUN_STATUS, o as isActiveRunStatus, r as STAGES, s as resolveActiveRun } from "./audit-stages-Dphii188.mjs";
import { a as evaluate, c as parseMetricValue, i as compareMetricRows, l as winRate, n as activeMetricReadiness, o as isActiveMetricCode, r as bucketFor, s as normalizeMetricCode, t as COMPARISON_SPECS } from "./audit-engine-Cw9Ig-Oc.mjs";
import { o as STRESS_TESTS, s as UNDERDOG_PATHWAYS } from "./constants-DloZsw4H.mjs";
import { r as familyOf } from "./stat-catalog-qDs35q_a.mjs";
import { n as reconstruct } from "./engine-tr9AM3Mg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/audit-pipeline-DMtBExXh.js
function buildCalibrationSnapshot(args) {
	const bucket = bucketFor(args.matrixWp, args.buckets);
	const verifiedWinRate = bucket ? winRate(bucket.wins, bucket.graded) : null;
	const hasIndependentRange = args.independentLow !== null && args.independentHigh !== null;
	const centre = verifiedWinRate ?? (hasIndependentRange ? (args.independentLow + args.independentHigh) / 2 : null);
	return {
		calibrationVersionId: args.versionId,
		bucketCode: bucket?.bucket_code ?? null,
		bucketWins: bucket?.wins ?? null,
		bucketGraded: bucket?.graded ?? null,
		verifiedWinRate,
		calibratedLow: centre === null ? null : Math.max(0, Math.round(centre - 5)),
		calibratedHigh: centre === null ? null : Math.min(100, Math.round(centre + 5))
	};
}
function voteFor(comparisons) {
	const p1 = comparisons.filter((c) => c.favours === "P1").map((c) => c.metric_code);
	const p2 = comparisons.filter((c) => c.favours === "P2").map((c) => c.metric_code);
	const neutral = comparisons.filter((c) => c.favours === "NEUTRAL").map((c) => c.metric_code);
	if (p1.length && p2.length) return {
		vote: "INTERNALLY_CONFLICTED",
		supporting: p1,
		opposing: p2,
		neutral
	};
	if (p1.length) return {
		vote: "P1",
		supporting: p1,
		opposing: [],
		neutral
	};
	if (p2.length) return {
		vote: "P2",
		supporting: p2,
		opposing: [],
		neutral
	};
	return {
		vote: "NEUTRAL",
		supporting: [],
		opposing: [],
		neutral
	};
}
function buildFamilies(comparisons) {
	const byFamily = /* @__PURE__ */ new Map();
	for (const c of comparisons) {
		if (c.status !== "COMPARED" || !c.family) continue;
		byFamily.set(c.family, [...byFamily.get(c.family) ?? [], c]);
	}
	return [...byFamily.entries()].filter(([, rows]) => rows.length >= 1).map(([family, rows]) => {
		const { vote, supporting, opposing, neutral } = voteFor(rows);
		return {
			family,
			vote,
			supporting_metrics: supporting,
			opposing_metrics: opposing,
			neutral_metrics: neutral,
			comparisons: rows
		};
	}).sort((a, b) => a.family.localeCompare(b.family));
}
/** Leader from family votes alone. Each family counts once, regardless of how many metrics it holds. */
function leaderOf(families) {
	const p1 = families.filter((f) => f.vote === "P1").length;
	const p2 = families.filter((f) => f.vote === "P2").length;
	if (p1 === p2) return {
		leader: null,
		p1,
		p2
	};
	return {
		leader: p1 > p2 ? "P1" : "P2",
		p1,
		p2
	};
}
function decideTruthEngineSelection({ comparisons, p1Name, p2Name }) {
	const families = buildFamilies(comparisons.filter((c) => isActiveMetricCode(c.metric_code)));
	const unavailable = comparisons.filter((c) => c.status !== "COMPARED").map((c) => ({
		metric_code: c.metric_code,
		status: c.status,
		reason: c.reason
	}));
	const duplicatedSupport = [];
	const duplicatedContradiction = [];
	const base = leaderOf(families);
	const neutralFamilies = families.filter((f) => f.vote === "NEUTRAL").map((f) => f.family);
	const conflictedFamilies = families.filter((f) => f.vote === "INTERNALLY_CONFLICTED").map((f) => f.family);
	const evidenceShare = (support, contra) => {
		const directional = support.length + contra.length + conflictedFamilies.length;
		const rawPercent = directional > 0 ? support.length / directional * 100 : 0;
		return {
			directional,
			rawPercent,
			percent: directional > 0 ? Number(rawPercent.toFixed(1)) : 0
		};
	};
	const shell = (outcome, reason, stability, support = [], contra = [], flipping = [], tieInducing = []) => ({
		outcome,
		selected_player: outcome === "P1" ? p1Name : outcome === "P2" ? p2Name : null,
		stability,
		evidence_percent: evidenceShare(support, contra).percent,
		directional_families: evidenceShare(support, contra).directional,
		corroborated: support.length >= 2,
		independent_support_families: support,
		independent_contradiction_families: contra,
		neutral_families: neutralFamilies,
		conflicted_families: conflictedFamilies,
		flipping_families: flipping,
		tie_inducing_families: tieInducing,
		unavailable,
		duplicated_support_metrics: duplicatedSupport,
		duplicated_contradiction_metrics: duplicatedContradiction,
		families,
		reason,
		evidence_chain: families.map((f) => `${f.family}: ${f.vote}${f.supporting_metrics.length ? ` (from ${f.supporting_metrics.join(", ")})` : ""}${f.opposing_metrics.length ? ` vs ${f.opposing_metrics.join(", ")}` : ""}`)
	});
	if (!families.length) return shell("INSUFFICIENT_EVIDENCE", `No metric produced a usable two-sided comparison (${unavailable.length} metric(s) unavailable). The Truth Engine cannot select a side and does not guess.`, "NOT_APPLICABLE");
	if (!base.leader) {
		const p1Families = families.filter((f) => f.vote === "P1").map((f) => f.family);
		const p2Families = families.filter((f) => f.vote === "P2").map((f) => f.family);
		return shell("INSUFFICIENT_EVIDENCE", `Independent evidence families are tied (${base.p1} for ${p1Name} vs ${base.p2} for ${p2Name}). Neither side reaches the 60% selection threshold. No side is selected.`, "NOT_APPLICABLE", p1Families, p2Families);
	}
	const leader = base.leader;
	const support = families.filter((f) => f.vote === leader);
	const contra = families.filter((f) => f.vote !== leader && f.vote !== "NEUTRAL" && f.vote !== "INTERNALLY_CONFLICTED");
	const supportNames = support.map((f) => f.family);
	const contraNames = contra.map((f) => f.family);
	for (const f of support) duplicatedSupport.push(...f.supporting_metrics.slice(1));
	for (const f of contra) duplicatedContradiction.push(...f.supporting_metrics.slice(1));
	const { percent: evidencePercent, rawPercent, directional } = evidenceShare(supportNames, contraNames);
	if (rawPercent < 60) return shell("INSUFFICIENT_EVIDENCE", `${leader === "P1" ? p1Name : p2Name} holds ${evidencePercent}% of the directional evidence (${supportNames.length} supporting famil${supportNames.length === 1 ? "y" : "ies"} of ${directional} directional: ${supportNames.join(", ") || "none"}${contraNames.length ? ` against ${contraNames.join(", ")}` : ""}${conflictedFamilies.length ? `, with ${conflictedFamilies.join(", ")} internally conflicted` : ""}), below the 60% selection threshold. No side is selected.`, "NOT_APPLICABLE", supportNames, contraNames);
	const flipping = [];
	const tieInducing = [];
	for (const f of families) {
		const { leader: without } = leaderOf(families.filter((other) => other.family !== f.family));
		if (without && without !== leader) flipping.push(f.family);
		else if (!without) tieInducing.push(f.family);
	}
	const selectedName = leader === "P1" ? p1Name : p2Name;
	if (flipping.length) return shell("INSUFFICIENT_EVIDENCE", `${selectedName} leads ${supportNames.length}-${contraNames.length} on independent families, but the lead does not survive leave-one-family-out: removing ${flipping.join(" or ")} REVERSES the leader. A selection that a single family can invert is reported as insufficient rather than asserted.`, "FRAGILE", supportNames, contraNames, flipping, tieInducing);
	const stability = contraNames.length === 0 && tieInducing.length === 0 ? "ROBUST" : "STABLE";
	return shell(leader, `${selectedName} holds ${evidencePercent}% of the directional evidence, at or above the 60% selection threshold: supported by ${supportNames.length} independent evidence famil${supportNames.length === 1 ? "y" : "ies"} (${supportNames.join(", ")})${contraNames.length ? ` against ${contraNames.length} independent contradiction${contraNames.length === 1 ? "" : "s"} (${contraNames.join(", ")})` : " with no independent contradiction"}${conflictedFamilies.length ? `, with ${conflictedFamilies.join(", ")} internally conflicted` : ""}; no single family's removal reverses the leader${tieInducing.length ? `, though removing ${tieInducing.join(" or ")} would leave it tied` : ""}.${supportNames.length < 2 ? ` NOTE: this selection rests on a single evidence family, so it is uncorroborated by an independent second family.` : ""}${duplicatedSupport.length ? ` ${duplicatedSupport.length} same-family agreeing metric(s) were deliberately not counted again.` : ""}`, stability, supportNames, contraNames, flipping, tieInducing);
}
/**
* Magnitude of an observed edge expressed in units of that metric's OWN declared noise
* floor (its materiality). A ratio of 3 means "three times larger than the smallest
* difference this metric treats as real". This is the single derivation every severity and
* viability judgement in this file is built on, so those judgements are measured rather
* than asserted.
*/
function magnitudeRatio(comparison) {
	const spec = COMPARISON_SPECS[comparison.metric_code];
	if (!spec || comparison.differential === null) return null;
	if (spec.materiality <= 0) return null;
	return Math.abs(comparison.differential) / spec.materiality;
}
function severityFromRatio(ratio) {
	if (ratio === null || ratio <= 1) return "NONE";
	if (ratio < 2) return "MINOR";
	if (ratio < 4) return "MODERATE";
	if (ratio < 8) return "MAJOR";
	return "CRITICAL";
}
var SEVERITY_ORDER = [
	"NONE",
	"MINOR",
	"MODERATE",
	"MAJOR",
	"CRITICAL"
];
function maxSeverity(values) {
	return values.reduce((worst, v) => SEVERITY_ORDER.indexOf(v) > SEVERITY_ORDER.indexOf(worst) ? v : worst, "NONE");
}
function escalate(severity, steps) {
	return SEVERITY_ORDER[Math.min(SEVERITY_ORDER.length - 1, SEVERITY_ORDER.indexOf(severity) + Math.max(0, steps))];
}
/**
* Computes, per independent evidence family, what the evidence says about EACH player.
* Both findings are produced from the family's own measured values -- P2's finding is never
* inferred as "the opposite of P1's".
*/
function runVerificationAudit(comparisons, p1Name, p2Name) {
	const compared = comparisons.filter((c) => c.status === "COMPARED" && c.family);
	const byFamily = /* @__PURE__ */ new Map();
	for (const c of compared) byFamily.set(c.family, [...byFamily.get(c.family) ?? [], c]);
	const findings = [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([family, rows]) => {
		const p1Wins = rows.filter((r) => r.favours === "P1");
		const p2Wins = rows.filter((r) => r.favours === "P2");
		const metrics = rows.map((r) => ({
			metric_code: r.metric_code,
			label: r.label,
			p1: r.p1_number,
			p2: r.p2_number,
			differential: r.differential,
			magnitude_ratio: magnitudeRatio(r),
			favours: r.favours
		}));
		let outcome;
		if (p1Wins.length && p2Wins.length) outcome = "INSUFFICIENT_EVIDENCE";
		else if (p1Wins.length) outcome = "SUPPORTS_P1";
		else if (p2Wins.length) outcome = "SUPPORTS_P2";
		else outcome = "NEUTRAL";
		const decisive = outcome === "SUPPORTS_P1" ? p1Wins : outcome === "SUPPORTS_P2" ? p2Wins : [];
		const severity = outcome === "INSUFFICIENT_EVIDENCE" ? "NONE" : maxSeverity(decisive.map((r) => severityFromRatio(magnitudeRatio(r))));
		const describe = (side) => rows.map((r) => `${r.label ?? r.metric_code}=${side === "p1" ? r.p1_number : r.p2_number}`).join("; ");
		return {
			family,
			outcome,
			severity,
			metrics,
			p1_finding: `${p1Name}: ${describe("p1")}`,
			p2_finding: `${p2Name}: ${describe("p2")}`,
			decision_effect: outcome === "SUPPORTS_P1" ? `Supports ${p1Name} (${severity} magnitude on ${decisive.map((r) => r.metric_code).join(", ")}).` : outcome === "SUPPORTS_P2" ? `Supports ${p2Name} (${severity} magnitude on ${decisive.map((r) => r.metric_code).join(", ")}).` : outcome === "NEUTRAL" ? "No material difference; this family credits neither player." : `Family is internally inconsistent (${p1Wins.map((r) => r.metric_code).join(", ")} favour ${p1Name}; ${p2Wins.map((r) => r.metric_code).join(", ")} favour ${p2Name}); it credits neither player.`
		};
	});
	return {
		findings,
		supports_p1_families: findings.filter((f) => f.outcome === "SUPPORTS_P1").map((f) => f.family),
		supports_p2_families: findings.filter((f) => f.outcome === "SUPPORTS_P2").map((f) => f.family),
		neutral_families: findings.filter((f) => f.outcome === "NEUTRAL").map((f) => f.family),
		insufficient_families: findings.filter((f) => f.outcome === "INSUFFICIENT_EVIDENCE").map((f) => f.family),
		unavailable_metrics: comparisons.filter((c) => c.status !== "COMPARED").map((c) => ({
			metric_code: c.metric_code,
			status: c.status,
			reason: c.reason
		}))
	};
}
/**
* Adversarial: given the currently selected side, this asks only "what legitimate evidence
* argues for the OTHER player?". It never re-predicts. Severity is derived from measured
* magnitude, then escalated by the number of INDEPENDENT contradiction families -- so five
* correlated dissents never outrank two genuinely independent ones.
*/
function runDisagreementAudit(comparisons, selected, p1Name, p2Name) {
	const compared = comparisons.filter((c) => c.status === "COMPARED" && c.family);
	const opposingSide = selected === "P1" ? "P2" : selected === "P2" ? "P1" : null;
	const byFamily = /* @__PURE__ */ new Map();
	for (const c of compared) byFamily.set(c.family, [...byFamily.get(c.family) ?? [], c]);
	const contradictionFamilies = [];
	const duplicated = [];
	if (opposingSide) for (const [family, rows] of [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		const opposing = rows.filter((r) => r.favours === opposingSide);
		const supporting = rows.filter((r) => r.favours === selected);
		if (!opposing.length || supporting.length) continue;
		contradictionFamilies.push({
			family,
			severity: maxSeverity(opposing.map((r) => severityFromRatio(magnitudeRatio(r)))),
			metrics: opposing.map((r) => r.metric_code),
			evidence: opposing.map((r) => `${r.label ?? r.metric_code}: ${p1Name}=${r.p1_number} vs ${p2Name}=${r.p2_number} (${r.differential > 0 ? "+" : ""}${r.differential}, ${magnitudeRatio(r)?.toFixed(1)}x noise floor)`).join("; ")
		});
		duplicated.push(...opposing.slice(1).map((r) => r.metric_code));
	}
	const base = maxSeverity(contradictionFamilies.map((f) => f.severity));
	const overall = contradictionFamilies.length >= 2 ? escalate(base, contradictionFamilies.length - 1) : base;
	const riskFor = (side) => {
		if (side !== opposingSide || !contradictionFamilies.length) return side === selected ? `Selected side; challenged by ${contradictionFamilies.length} independent contradiction famil${contradictionFamilies.length === 1 ? "y" : "ies"}.` : "No independent contradiction evidence found for this side.";
		return `${contradictionFamilies.length} independent famil${contradictionFamilies.length === 1 ? "y" : "ies"} favour this player against the selection: ${contradictionFamilies.map((f) => `${f.family} (${f.severity})`).join(", ")}.`;
	};
	return {
		challenged_side: selected,
		contradiction_families: contradictionFamilies,
		duplicated_contradiction_metrics: duplicated,
		overall_severity: overall,
		p1_risk: riskFor("P1"),
		p2_risk: riskFor("P2"),
		supporting_evidence: selected ? compared.filter((c) => c.favours === selected).map((c) => c.metric_code).join(", ") || "none" : "none",
		opposing_evidence: contradictionFamilies.map((f) => f.evidence).join(" | ") || "none",
		final_effect: !selected ? "No selection to challenge." : contradictionFamilies.length === 0 ? "No independent evidence family contradicts the selection." : `${contradictionFamilies.length} independent contradiction famil${contradictionFamilies.length === 1 ? "y" : "ies"} (${contradictionFamilies.map((f) => f.family).join(", ")}); overall severity ${overall}.`
	};
}
/** Evidence family -> the concrete match pathway that family's advantage would express itself through. */
var FAMILY_PATHWAY = {
	SURFACE_STRENGTH: "SURFACE_ADVANTAGE",
	RECENT_FORM: "RECENT_FORM_ADVANTAGE",
	H2H_PROBABILITY: "MATCHUP_TACTICAL_ADVANTAGE",
	CLOSING_ABILITY: "FAVORITE_COLLAPSE",
	COMMON_OPPONENT: "COMMON_OPPONENT_ADVANTAGE",
	SET_PROFILE: "DECIDING_SET_PATHWAY",
	RESULTS_HISTORY: "RESULTS_HISTORY_ADVANTAGE"
};
function viabilityFromRatio(ratio) {
	if (ratio === null || ratio <= 1) return "NO_VIABLE_PATHWAY";
	if (ratio < 2) return "POTENTIAL_PATHWAY";
	if (ratio < 4) return "VIABLE_PATHWAY";
	return "STRONG_PATHWAY";
}
/** Pathways for ONE named side, from that side's own measured edges. Never inferred. */
function pathwaysForSide(comparisons, side, player) {
	const compared = comparisons.filter((c) => c.status === "COMPARED" && c.family);
	const byFamily = /* @__PURE__ */ new Map();
	for (const c of compared) byFamily.set(c.family, [...byFamily.get(c.family) ?? [], c]);
	const pathways = [];
	for (const [family, rows] of [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		const favouring = rows.filter((r) => r.favours === side);
		if (!favouring.length) continue;
		const ratio = Math.max(...favouring.map((r) => magnitudeRatio(r) ?? 0));
		const viability = viabilityFromRatio(ratio);
		if (viability === "NO_VIABLE_PATHWAY") continue;
		pathways.push({
			pathway_type: FAMILY_PATHWAY[family] ?? `${family}_ADVANTAGE`,
			family,
			viability,
			supporting_metrics: favouring.map((r) => r.metric_code),
			evidence: favouring.map((r) => `${r.label ?? r.metric_code}: ${player}=${side === "P1" ? r.p1_number : r.p2_number} vs ${side === "P1" ? r.p2_number : r.p1_number} (${(magnitudeRatio(r) ?? 0).toFixed(1)}x noise floor)`).join("; "),
			conditions_required: `${player} must convert the measured ${family.toLowerCase().replace(/_/g, " ")} edge into match outcomes.`,
			magnitude_ratio: Number(ratio.toFixed(3))
		});
	}
	const order = [
		"NO_VIABLE_PATHWAY",
		"POTENTIAL_PATHWAY",
		"VIABLE_PATHWAY",
		"STRONG_PATHWAY"
	];
	let overall = pathways.reduce((best, p) => order.indexOf(p.viability) > order.indexOf(best) ? p.viability : best, "NO_VIABLE_PATHWAY");
	if (pathways.length >= 2) overall = order[Math.min(order.length - 1, order.indexOf(overall) + 1)];
	return {
		pathways,
		overall
	};
}
/**
* A pathway exists ONLY where a player measurably leads an independent evidence family.
* Theoretical tennis possibilities are never enumerated: if no family favours the player,
* the answer is NO_VIABLE_PATHWAY, not a narrative.
*
* Both players are always analysed, from their own values. `selected` decides only which of
* the two is the DESIGNATED underdog (the non-selected side) -- it never decides who gets
* analysed. This stage remains diagnostic: it reports pathways and can withhold a colour
* upgrade, and it can never select or veto a winner.
*/
function runUnderdogAnalysis(comparisons, selected, p1Name, p2Name) {
	const underdogSide = selected === "P1" ? "P2" : selected === "P2" ? "P1" : null;
	const sides = ["P1", "P2"].map((side) => {
		const player = side === "P1" ? p1Name : p2Name;
		const { pathways, overall } = pathwaysForSide(comparisons, side, player);
		return {
			side,
			player,
			is_designated_underdog: underdogSide === side,
			pathways,
			overall_viability: overall,
			reason: pathways.length ? `${player} holds ${pathways.length} evidence-supported pathway(s): ${pathways.map((p) => `${p.pathway_type} (${p.viability})`).join(", ")}.` : `No independent evidence family measurably favours ${player}; no viable pathway exists on the available evidence.`
		};
	});
	const designated = sides.find((s) => s.is_designated_underdog) ?? null;
	return {
		underdog_side: underdogSide,
		underdog_player: designated?.player ?? null,
		pathways: designated?.pathways ?? [],
		overall_viability: designated?.overall_viability ?? "NO_VIABLE_PATHWAY",
		reason: designated ? designated.reason : `No selection was made, so neither player is the designated underdog. Both players were still analysed: ${sides.map((s) => `${s.player} ${s.overall_viability}`).join("; ")}.`,
		sides
	};
}
/**
* Erodes ONE side's own measured edges by one of each metric's declared noise floors, and
* touches nothing else.
*
* This replaces a uniform shift applied to every comparison. That shift had two properties
* that made it unusable as evidence about the two players:
*
*  1. It MANUFACTURED opposing evidence. A comparison the engine had declared NEUTRAL --
*     "both players measured, no material difference" -- has |advantage| <= materiality, so
*     subtracting one materiality could push it past the floor into a vote for the opponent.
*     Parity became directional evidence that no measurement supported.
*  2. It could only ever be pointed at the selected side, so the opponent's profile was
*     never subjected to the same erosion before the leader's selection was withdrawn.
*
* Here a comparison is altered only when it currently favours `side`, and its magnitude is
* reduced toward zero and clamped there. The sign therefore cannot flip: an eroded edge
* either still clears its floor (still that side's) or falls to NEUTRAL. A NEUTRAL
* comparison and a comparison favouring the other player are returned untouched.
*/
function erodeEdgesOf(comparisons, side) {
	return comparisons.map((c) => {
		if (c.status !== "COMPARED" || c.advantage_p1 === null) return c;
		if (c.favours !== side) return c;
		const spec = COMPARISON_SPECS[c.metric_code];
		if (!spec) return c;
		const eroded = Math.max(0, Math.abs(c.advantage_p1) - spec.materiality);
		const advantage = Number(((side === "P1" ? 1 : -1) * eroded).toFixed(6));
		const favours = Math.abs(advantage) <= spec.materiality ? "NEUTRAL" : advantage > 0 ? "P1" : "P2";
		return {
			...c,
			advantage_p1: advantage,
			favours
		};
	});
}
function outcomeOf(decision) {
	return decision.outcome;
}
/**
* Erodes EVERY directional edge by one of its own metric's noise floors, whichever player
* it favours. This is the like-for-like case: the single assumption "every measured edge
* overstates the true edge by about the amount this metric already treats as noise",
* applied to both players at once and to nobody preferentially.
*
* It is the only case that can produce a comparative finding. A one-sided erosion cannot:
* eroding a side can only ever weaken it, so the other player winning that case says
* nothing about the other player's own durability. Eroding both at once does -- a lead
* built from edges barely clearing their floors dissolves, while one built on an edge many
* floors wide survives, and whichever survives is the more durable of the two.
*
* Like the one-sided case, magnitudes are clamped at zero, so no comparison can cross into
* favouring the player it did not already favour, and a NEUTRAL comparison stays NEUTRAL.
*/
function erodeAllEdges(comparisons) {
	return erodeEdgesOf(erodeEdgesOf(comparisons, "P1"), "P2");
}
/** Share of the directional evidence held by `side`, unrounded. Both sides off one census. */
function directionalShare(side, decision) {
	const mine = decision.families.filter((f) => f.vote === side).length;
	const theirs = decision.families.filter((f) => (f.vote === "P1" || f.vote === "P2") && f.vote !== side).length;
	const conflicted = decision.conflicted_families.length;
	const directional = mine + theirs + conflicted;
	return directional > 0 ? mine / directional * 100 : 0;
}
/**
* Recomputes the FULL selection (family voting, threshold, leave-one-family-out and all)
* with EACH player's own edges eroded in turn, and reports the two results against each
* other.
*
* Both sides are stressed on identical terms. Nothing here is computed for one player and
* assumed to be the inverse for the other, and the test never nominates a winner: it only
* reports which of the two profiles survives its own erosion. What the caller does with
* that is decided in runTruthEngineAudit.
*/
function runStressTest(comparisons, p1Name, p2Name) {
	const base = decideTruthEngineSelection({
		comparisons,
		p1Name,
		p2Name
	});
	const before = outcomeOf(base);
	const p1Stressed = decideTruthEngineSelection({
		comparisons: erodeEdgesOf(comparisons, "P1"),
		p1Name,
		p2Name
	});
	const p2Stressed = decideTruthEngineSelection({
		comparisons: erodeEdgesOf(comparisons, "P2"),
		p1Name,
		p2Name
	});
	const symmetricDecision = decideTruthEngineSelection({
		comparisons: erodeAllEdges(comparisons),
		p1Name,
		p2Name
	});
	const sides = ["P1", "P2"].map((side) => {
		const ownStressed = side === "P1" ? p1Stressed : p2Stressed;
		const other = side === "P1" ? "P2" : "P1";
		const outcome = outcomeOf(ownStressed);
		return {
			side,
			player: side === "P1" ? p1Name : p2Name,
			support_percent_before: Number(directionalShare(side, base).toFixed(6)),
			support_percent_after: Number(directionalShare(side, symmetricDecision).toFixed(6)),
			outcome_when_stressed: outcome,
			status: outcome === side ? "ROBUST" : outcome === other ? "REVERSED" : "REMOVED"
		};
	});
	const p1Profile = sides[0];
	const p2Profile = sides[1];
	if (before === "INSUFFICIENT_EVIDENCE") return {
		winner_before: before,
		winner_after: before,
		changed: false,
		cases: [{
			case_name: "BASE",
			winner: before,
			support_families: base.independent_support_families.length,
			contradiction_families: base.independent_contradiction_families.length,
			assumption: "Observed evidence as measured."
		}],
		sides,
		comparative_robustness: "NOT_APPLICABLE",
		stability: "NOT_APPLICABLE",
		reason: "No selection was made, so there is no leader whose robustness could be compared against the other player's."
	};
	const selected = before;
	const challenger = selected === "P1" ? "P2" : "P1";
	const selectedProfile = selected === "P1" ? p1Profile : p2Profile;
	const challengerProfile = selected === "P1" ? p2Profile : p1Profile;
	const selectedStressed = selected === "P1" ? p1Stressed : p2Stressed;
	const challengerStressed = selected === "P1" ? p2Stressed : p1Stressed;
	const symmetric = symmetricDecision;
	const symmetricOutcome = outcomeOf(symmetric);
	const after = outcomeOf(selectedStressed);
	const cases = [
		{
			case_name: "BASE",
			winner: before,
			support_families: base.independent_support_families.length,
			contradiction_families: base.independent_contradiction_families.length,
			assumption: "Observed evidence as measured."
		},
		{
			case_name: "ADVERSE",
			winner: after,
			support_families: selectedStressed.independent_support_families.length,
			contradiction_families: selectedStressed.independent_contradiction_families.length,
			assumption: "Every edge favouring the SELECTED side eroded by one of that metric's own noise floors; neutral and opposing evidence untouched."
		},
		{
			case_name: "MIRROR",
			winner: outcomeOf(challengerStressed),
			support_families: challengerStressed.independent_support_families.length,
			contradiction_families: challengerStressed.independent_contradiction_families.length,
			assumption: "The identical erosion applied to the OTHER player instead -- diagnostic only, since eroding a side can only weaken it."
		},
		{
			case_name: "SYMMETRIC",
			winner: symmetricOutcome,
			support_families: symmetric.independent_support_families.length,
			contradiction_families: symmetric.independent_contradiction_families.length,
			assumption: "Every directional edge eroded by one of its own metric's noise floors, both players at once. This is the case the comparative verdict is read from."
		}
	];
	const comparative = symmetricOutcome === selected ? "LEADER_ROBUST" : symmetricOutcome === challenger ? "CHALLENGER_MORE_ROBUST" : "LEADER_FRAGILE_UNCONTESTED";
	const stability = comparative === "CHALLENGER_MORE_ROBUST" ? "UNSTABLE" : comparative === "LEADER_FRAGILE_UNCONTESTED" ? "FRAGILE" : base.independent_contradiction_families.length === 0 && base.stability === "ROBUST" ? "ROBUST" : "STABLE";
	const describe = (p) => `${p.player} ${p.support_percent_before.toFixed(1)}% -> ${p.support_percent_after.toFixed(1)}% (${p.status})`;
	return {
		winner_before: before,
		winner_after: after,
		changed: after !== before,
		cases,
		sides,
		comparative_robustness: comparative,
		stability,
		reason: comparative === "LEADER_ROBUST" ? `The selection survives eroding every edge that favours it by one of that metric's own noise floors. ${describe(selectedProfile)} vs ${describe(challengerProfile)}.` : comparative === "CHALLENGER_MORE_ROBUST" ? `Under identical scrutiny the other player is the more robust of the two: eroding the selected side's edges hands the match to ${challengerProfile.player}, and eroding ${challengerProfile.player}'s own edges still leaves ${challengerProfile.player} ahead. ${describe(selectedProfile)} vs ${describe(challengerProfile)}.` : `The selection does not survive its own erosion, but neither does the other player survive theirs, so the stress test establishes no comparative winner and does not withdraw the selection. ${describe(selectedProfile)} vs ${describe(challengerProfile)}.`
	};
}
/**
* The single entry point: evidence in, auditable winner (or an explicit refusal) out.
*
* The winner comes from the deterministic decision core. Verification, Disagreement,
* Underdog and Stress are genuine audit layers over that same evidence -- and the stress
* result can DOWNGRADE the outcome to a refusal (a selection that reverses under a
* one-noise-floor erosion is not reported as a winner), but no layer can invent a winner.
*/
function runTruthEngineAudit(comparisons, p1Name, p2Name) {
	const decision = decideTruthEngineSelection({
		comparisons,
		p1Name,
		p2Name
	});
	const selected = decision.outcome === "INSUFFICIENT_EVIDENCE" ? null : decision.outcome;
	const verification = runVerificationAudit(comparisons, p1Name, p2Name);
	const disagreement = runDisagreementAudit(comparisons, selected, p1Name, p2Name);
	const underdog = runUnderdogAnalysis(comparisons, selected, p1Name, p2Name);
	const stress = runStressTest(comparisons, p1Name, p2Name);
	const stressRefuses = selected !== null && stress.comparative_robustness === "CHALLENGER_MORE_ROBUST";
	const finalSide = stressRefuses ? null : selected;
	const winner = finalSide === "P1" ? p1Name : finalSide === "P2" ? p2Name : null;
	const supportCount = decision.independent_support_families.length;
	const contraCount = decision.independent_contradiction_families.length;
	const evidenceStrength = finalSide === null ? "NONE" : supportCount >= 3 && contraCount === 0 && stress.stability === "ROBUST" ? "HIGH" : supportCount >= 3 || supportCount >= 2 && contraCount === 0 ? "MODERATE" : "LOW";
	const evidenceChain = [
		`Metric comparisons: ${comparisons.filter((c) => c.status === "COMPARED").length} compared, ${comparisons.filter((c) => c.status !== "COMPARED").length} unavailable (never zeroed).`,
		`Independent evidence families: ${decision.families.length} (support ${supportCount}, contradiction ${contraCount}, neutral ${decision.neutral_families.length}, conflicted ${decision.conflicted_families.length}).`,
		...verification.findings.map((f) => `VERIFICATION ${f.family}: ${f.outcome} (${f.severity}) -- ${f.decision_effect}`),
		`DISAGREEMENT: ${disagreement.final_effect}`,
		`UNDERDOG: ${underdog.reason} Overall ${underdog.overall_viability}.`,
		`STRESS: base=${stress.winner_before} adverse=${stress.winner_after} comparative=${stress.comparative_robustness} stability=${stress.stability}; ${stress.sides.map((sp) => `${sp.player} ${sp.support_percent_before.toFixed(1)}%->${sp.support_percent_after.toFixed(1)}% ${sp.status}`).join(" | ")}.`,
		`LEAVE-ONE-FAMILY-OUT: ${decision.flipping_families.length ? `reversed by ${decision.flipping_families.join(", ")}` : "no single family reverses the leader"}.`
	];
	return {
		audit_winner: winner,
		audit_winner_side: finalSide,
		refused: finalSide === null,
		evidence_strength: evidenceStrength,
		decision,
		verification,
		disagreement,
		underdog,
		stress,
		independent_evidence_families: supportCount,
		contradiction_families: contraCount,
		leave_one_family_out_winner: decision.flipping_families.length ? "CHANGES" : decision.outcome,
		final_reason: stressRefuses ? `Refused: ${decision.selected_player} led on the measured evidence, but ${stress.reason}` : finalSide === null ? `Refused: ${decision.reason}` : `${winner} is the audit winner. ${decision.reason} ${disagreement.final_effect} Underdog: ${underdog.overall_viability}. Stress: ${stress.stability}.`,
		evidence_chain: evidenceChain
	};
}
/**
* Assemble the record. Pure: no DB, no network, no clock beyond the injected `now`.
*
* Recording an outcome does not grade it here — `decision_correct` is a plain comparison of
* two names, and stays null whenever either side is unknown, so an unresolved match can
* never be silently scored as a loss.
*/
function buildDecisionRecord({ audit, metricRows, now, actualWinner }) {
	const decision = audit.decision;
	const coverage = activeMetricReadiness(metricRows);
	const selected = decision.selected_player;
	const resolved = Boolean(selected) && Boolean(actualWinner);
	return {
		schema_version: 1,
		recorded_at: (now ?? /* @__PURE__ */ new Date()).toISOString(),
		outcome: decision.outcome,
		selected_player: selected,
		evidence_support_percent: decision.evidence_percent,
		directional_families: decision.directional_families,
		corroborated: decision.corroborated,
		stability: decision.stability,
		supporting_families: decision.independent_support_families,
		contradicting_families: decision.independent_contradiction_families,
		neutral_families: decision.neutral_families,
		conflicted_families: decision.conflicted_families,
		duplicated_support_metrics: decision.duplicated_support_metrics,
		families: decision.families.map((family) => ({
			family: family.family,
			vote: family.vote,
			supporting_metrics: family.supporting_metrics,
			opposing_metrics: family.opposing_metrics,
			neutral_metrics: family.neutral_metrics
		})),
		verification_findings: audit.verification.findings.length,
		disagreement_severity: audit.disagreement.overall_severity,
		underdog_viability: audit.underdog.overall_viability,
		underdog_player: audit.underdog.underdog_player,
		stress_stability: audit.stress.stability,
		stress_changed: audit.stress.changed,
		evidence_coverage_usable: coverage.usable,
		evidence_coverage_expected: coverage.expected,
		evidence_coverage_percent: coverage.percent,
		evidence_coverage_one_sided: coverage.oneSided,
		evidence_coverage_unavailable: coverage.unavailable,
		evidence_coverage_eligible: coverage.eligible,
		evidence_coverage_eligible_percent: coverage.eligiblePercent,
		metric_activation: coverage.byCode.map((entry) => ({
			code: entry.code,
			p1_status: entry.activation.p1,
			p2_status: entry.activation.p2,
			activated: entry.activation.activated,
			counts_toward_denominator: entry.activation.countsTowardDenominator
		})),
		actual_winner: actualWinner ?? null,
		decision_correct: resolved ? playerNamesMatch(selected, actualWinner) : null
	};
}
var codeOf = (v) => {
	const m = String(v ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(v ?? "").padStart(3, "0");
};
var DETERMINISTIC_RULE_EVALUATORS = {
	"003": (audit) => {
		const flipped = audit.decision.flipping_families.length > 0;
		const contradictions = audit.contradiction_families;
		return {
			outcome: flipped ? "FAIL" : "PASS",
			severity: flipped ? "CRITICAL" : "STANDARD",
			p1Finding: `Independent contradiction families against the selection: ${contradictions}.`,
			p2Finding: `Leave-one-family-out result: ${audit.decision.flipping_families.length ? `reversed by ${audit.decision.flipping_families.join(", ")}` : "no single family reverses the leader"}.`,
			effect: flipped ? "FAIL: the selection can be reversed by removing a single evidence family, which is exactly the single-family flip this rule prohibits." : `PASS: the selection does not rest on any single family; ${contradictions} independent contradiction famil${contradictions === 1 ? "y was" : "ies were"} counted separately rather than aggregated.`
		};
	},
	"007": (audit, p1, p2) => {
		const h2h = audit.verification.findings.find((f) => f.family === "H2H_PROBABILITY");
		if (!h2h) return {
			outcome: "UNAVAILABLE",
			severity: "STANDARD",
			p1Finding: "No usable head-to-head evidence.",
			p2Finding: "No usable head-to-head evidence.",
			effect: "UNAVAILABLE: no comparable H2H evidence was produced for this match, so H2H quality control has nothing to weight."
		};
		return {
			outcome: "PASS",
			severity: "CRITICAL",
			p1Finding: `${p1}: ${h2h.metrics.map((m) => `${m.label}=${m.p1}`).join("; ")}`,
			p2Finding: `${p2}: ${h2h.metrics.map((m) => `${m.label}=${m.p2}`).join("; ")}`,
			effect: `PASS: head-to-head entered the audit only through metric 051's sample-shrunk probability (raw H2H is shrunk toward the general expectation by H2H sample size), so a thin H2H cannot dominate. Family outcome: ${h2h.outcome} (${h2h.severity}).`
		};
	},
	"008": (audit) => {
		const rawMetrics = audit.verification.findings.reduce((n, f) => n + f.metrics.length, 0);
		const families = audit.verification.findings.length;
		const compressed = rawMetrics - families;
		return {
			outcome: "PASS",
			severity: "STANDARD",
			p1Finding: `Raw comparable metric signals: ${rawMetrics}.`,
			p2Finding: `Independent evidence families after compression: ${families}.`,
			effect: `PASS: ${rawMetrics} raw metric signals were compressed into ${families} independent evidence famil${families === 1 ? "y" : "ies"}; ${compressed} correlated signal(s) were deliberately not counted again. Duplicated support: ${audit.decision.duplicated_support_metrics.join(", ") || "none"}. Duplicated contradiction: ${audit.disagreement.duplicated_contradiction_metrics.join(", ") || "none"}.`
		};
	},
	"017": (audit, p1, p2) => ({
		outcome: "PASS",
		severity: "STANDARD",
		p1Finding: `${p1} evaluated from its own persisted values across ${audit.verification.findings.length} famil${audit.verification.findings.length === 1 ? "y" : "ies"}.`,
		p2Finding: `${p2} evaluated independently from its own persisted values across the same families.`,
		effect: "PASS: every family's finding is computed from each player's own measured values; neither side's result is inferred as the inverse of the other's, and swapping the two players swaps every verdict (regression-tested)."
	}),
	"019": (audit) => ({
		outcome: audit.underdog.overall_viability === "NO_VIABLE_PATHWAY" ? "PASS" : "WARN",
		severity: "STANDARD",
		p1Finding: `Underdog: ${audit.underdog.underdog_player ?? "none"}.`,
		p2Finding: `Evidence-supported pathways: ${audit.underdog.pathways.length}.`,
		effect: `${audit.underdog.overall_viability}: ${audit.underdog.reason}`
	})
};
/** The exact evidence each unmapped rule would need, so an UNAVAILABLE row is still informative. */
var RULE_MISSING_EVIDENCE = {
	"001": "post-hoc calibration ledger ordering; not a per-match evidence question.",
	"002": "an independently reconstructed favourite probability for this match; metric 051 supplies an opponent-specific probability only where H2H/general evidence exists.",
	"004": "opponent-quality history for the underdog (wins over Top 10/20/50), which requires opponent-ranking evidence the active metric set does not currently establish per match.",
	"005": "30/60/90-day and same-surface splits as separate comparable signals; the active set exposes recent form as one window.",
	"006": "a headline favourite probability to test the exemption against.",
	"009": "the underdog's five strongest pre-match arguments as discrete scored items.",
	"010": "completed-match results and a calibration ledger; this is a post-result rule, not a pre-match one."
};
function verificationRowPatch(ruleCode, audit, p1, p2, now) {
	const code = codeOf(ruleCode);
	const evaluator = DETERMINISTIC_RULE_EVALUATORS[code];
	if (!evaluator) return {
		evaluated: false,
		patch: {
			p1_finding: null,
			p2_finding: null,
			outcome: "UNAVAILABLE",
			unavailable_reason: "MISSING_REQUIRED_INPUT",
			unavailable_detail: `No deterministic evaluator: this rule requires ${RULE_MISSING_EVIDENCE[code] ?? "evidence the active metric set does not establish for a single match"}. Reported unavailable rather than answered from the audit's overall verdict, which would claim an evaluation that did not occur.`,
			provider_error: null,
			missing_inputs: [],
			sources: [],
			source_attempts: [],
			reconstruction_attempted: false,
			retrieved_at: now,
			status: "UNAVAILABLE"
		}
	};
	const r = evaluator(audit, p1, p2);
	return {
		evaluated: r.outcome !== "UNAVAILABLE",
		patch: {
			p1_finding: r.p1Finding,
			p2_finding: r.p2Finding,
			outcome: r.outcome,
			severity: r.severity,
			decision_effect: r.effect,
			unavailable_reason: r.outcome === "UNAVAILABLE" ? "MISSING_REQUIRED_INPUT" : null,
			unavailable_detail: r.outcome === "UNAVAILABLE" ? r.effect : null,
			provider_error: null,
			missing_inputs: [],
			reconstruction_attempted: false,
			sources: [{
				source_name: "Truth Engine deterministic audit (metric_results evidence)",
				url: null,
				retrieved_at: null
			}],
			source_attempts: [],
			retrieved_at: now,
			status: r.outcome === "UNAVAILABLE" ? "UNAVAILABLE" : "COMPLETE"
		}
	};
}
function disagreementRowPatch(ruleCode, audit, p1, p2, now) {
	const code = codeOf(ruleCode);
	const evaluator = DETERMINISTIC_RULE_EVALUATORS[code];
	const contradiction = audit.disagreement;
	if (!evaluator) return {
		evaluated: false,
		patch: {
			p1_risk: null,
			p2_risk: null,
			supporting_evidence: null,
			opposing_evidence: null,
			contradiction_severity: "NONE",
			final_effect: null,
			unavailable_reason: "MISSING_REQUIRED_INPUT",
			unavailable_detail: `No deterministic evaluator: requires ${RULE_MISSING_EVIDENCE[code] ?? "evidence the active metric set does not establish for a single match"}.`,
			provider_error: null,
			missing_inputs: [],
			sources: [],
			source_attempts: [],
			reconstruction_attempted: false,
			retrieved_at: now,
			status: "UNAVAILABLE"
		}
	};
	const r = evaluator(audit, p1, p2);
	return {
		evaluated: true,
		patch: {
			p1_risk: contradiction.p1_risk,
			p2_risk: contradiction.p2_risk,
			supporting_evidence: contradiction.supporting_evidence,
			opposing_evidence: contradiction.opposing_evidence,
			contradiction_severity: contradiction.overall_severity === "NONE" ? "NONE" : contradiction.overall_severity,
			final_effect: `${r.effect} ${contradiction.final_effect}`,
			unavailable_reason: null,
			unavailable_detail: null,
			provider_error: null,
			missing_inputs: [],
			sources: [{
				source_name: "Truth Engine deterministic audit (metric_results evidence)",
				url: null,
				retrieved_at: null
			}],
			source_attempts: [],
			reconstruction_attempted: false,
			retrieved_at: now,
			status: "COMPLETE"
		}
	};
}
/** Evidence family -> the persisted pathway code it legitimately evidences. */
var FAMILY_TO_PATHWAY_CODE = {
	SURFACE_STRENGTH: "SURFACE_TRANSITION",
	RECENT_FORM: "RANKING_LAG",
	H2H_PROBABILITY: "STYLE_MISMATCH",
	CLOSING_ABILITY: "FAV_COLLAPSE",
	SET_PROFILE: "DECIDING_SET"
};
/** Pathways no active metric can establish, with the reason. Honest rather than silent. */
var PATHWAY_MISSING_EVIDENCE = {
	SERVE_THROUGH: "serve-hold/point-level evidence (metrics 002/016 families) is not among the active comparable set for this match.",
	RETURN_PRESSURE: "return-point/break-pressure evidence is not among the active comparable set for this match.",
	SECOND_SERVE: "serve-number splits do not exist in the approved point-by-point payloads (serve_number_available:false).",
	SHORT_RALLY: "rally-length evidence requires shot-level charting data this system does not hold.",
	LONG_RALLY: "rally-length evidence requires shot-level charting data this system does not hold.",
	MOVEMENT: "movement/biomechanics evidence is classified PROTECTED_UNAVAILABLE.",
	SLOW_START: "metric 026 (Early-Warning / Slow-Start) is quarantined pending Matrix Summary evidence.",
	TIEBREAK: "tiebreak-specific evidence is not among the active comparable set for this match.",
	FATIGUE: "fatigue/workload metrics have no declared comparison direction and are excluded from deterministic comparison.",
	MARKET_INFO: "market metrics 015/019 are quarantined pending Matrix Summary evidence."
};
/**
* Evidence-backed pathways whose family has no persisted pathway code in this schema.
* The persisted pathway vocabulary is tactical (serve/return/rally); several comparable
* evidence families are outcome-level and have no counterpart row. Without this, such a
* pathway would be measured by the audit and then silently vanish, because no row exists
* to carry it. It is surfaced in the stage detail instead of being dropped.
*/
function unmappedUnderdogPathways(audit) {
	return audit.underdog.pathways.filter((p) => !FAMILY_TO_PATHWAY_CODE[p.family]).map((p) => ({
		family: p.family,
		pathway_type: p.pathway_type,
		viability: p.viability
	}));
}
/**
* Resolves a persisted underdog row to a CANONICAL SIDE.
*
* `underdog_results.player_side` holds a player NAME in production, not "P1"/"P2", and the
* previous implementation compared that name against the underdog's name to decide whether
* to evaluate the row. That made evaluation depend on string identity -- the exact coupling
* the architecture forbids for winner identity -- and it silently failed for any row whose
* stored name did not match character-for-character.
*
* Both encodings are accepted here and reduced to a side, so identity travels as P1/P2 and
* a name is only ever a lookup key, never the decision.
*/
function resolvePlayerSide(playerSide, p1, p2) {
	const value = String(playerSide ?? "").trim();
	if (!value) return null;
	const upper = value.toUpperCase();
	if (upper === "P1" || upper === "P2") return upper;
	const exact = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
	const exactP1 = exact(value, p1);
	const exactP2 = exact(value, p2);
	if (exactP1 && !exactP2) return "P1";
	if (exactP2 && !exactP1) return "P2";
	if (exactP1 && exactP2) return null;
	const fuzzyP1 = playerNamesMatch(value, p1);
	const fuzzyP2 = playerNamesMatch(value, p2);
	if (fuzzyP1 && !fuzzyP2) return "P1";
	if (fuzzyP2 && !fuzzyP1) return "P2";
	return null;
}
function underdogRowPatch(pathwayCode, playerSide, audit, p1, p2, now) {
	const code = String(pathwayCode ?? "");
	const side = resolvePlayerSide(playerSide, p1, p2);
	const analysis = side ? audit.underdog.sides.find((s) => s.side === side) ?? null : null;
	if (!analysis) return {
		evaluated: false,
		patch: {
			classification: "UNRESOLVED",
			evidence: `Row player "${playerSide}" does not resolve to either side of this match (${p1} / ${p2}).`,
			repeatable: false,
			status: "UNAVAILABLE",
			unavailable_reason: "MISSING_REQUIRED_INPUT",
			unavailable_detail: "Underdog row could not be bound to a canonical player side.",
			provider_error: null,
			missing_inputs: [],
			sources: [],
			source_attempts: [],
			reconstruction_attempted: false,
			retrieved_at: now
		}
	};
	const designation = analysis.is_designated_underdog ? "designated underdog (the non-selected side)" : audit.underdog.underdog_side ? "selected side" : "no selection was made, so neither side is the designated underdog";
	const pathway = analysis.pathways.find((pw) => FAMILY_TO_PATHWAY_CODE[pw.family] === code);
	if (pathway) return {
		evaluated: true,
		patch: {
			classification: pathway.viability === "STRONG_PATHWAY" ? "STRONG" : pathway.viability === "VIABLE_PATHWAY" ? "REALISTIC" : "WEAK",
			evidence: `[${analysis.side} ${analysis.player}, ${designation}] ${pathway.pathway_type} (${pathway.viability}, ${pathway.magnitude_ratio}x noise floor). ${pathway.evidence}. Required: ${pathway.conditions_required}`,
			repeatable: true,
			status: "COMPLETE",
			unavailable_reason: null,
			unavailable_detail: null,
			provider_error: null,
			missing_inputs: [],
			sources: [{
				source_name: "Truth Engine deterministic underdog analysis",
				url: null,
				retrieved_at: null
			}],
			source_attempts: [],
			reconstruction_attempted: false,
			retrieved_at: now
		}
	};
	const mapped = Object.values(FAMILY_TO_PATHWAY_CODE).includes(code);
	return {
		evaluated: mapped,
		patch: {
			classification: "WEAK",
			evidence: mapped ? `[${analysis.side} ${analysis.player}, ${designation}] No measurable edge in the evidence family backing this pathway; evaluated and found not viable.` : `Not evaluable: ${PATHWAY_MISSING_EVIDENCE[code] ?? "no active evidence family can establish this pathway."}`,
			repeatable: false,
			status: mapped ? "COMPLETE" : "UNAVAILABLE",
			unavailable_reason: mapped ? null : "MISSING_REQUIRED_INPUT",
			unavailable_detail: mapped ? null : PATHWAY_MISSING_EVIDENCE[code] ?? null,
			provider_error: null,
			missing_inputs: [],
			sources: mapped ? [{
				source_name: "Truth Engine deterministic underdog analysis",
				url: null,
				retrieved_at: null
			}] : [],
			source_attempts: [],
			reconstruction_attempted: false,
			retrieved_at: now
		}
	};
}
/**
* ST03 ("Remove strongest independent favorite family") is exactly the leave-one-family-out
* recomputation the decision core performs, and ST05/ST06/ST07 are the adverse/favourable
* re-derivations the stress engine performs. Those are populated with genuinely recomputed
* winners. Tests requiring quarantined market evidence or data this system does not hold are
* reported UNAVAILABLE with the reason rather than given a manufactured outcome.
*/
var STRESS_MISSING_EVIDENCE = {
	ST04: "market metrics 015/019 are quarantined pending Matrix Summary evidence; there is no market signal to remove.",
	ST08: "a conservative probability floor requires an independently reconstructed match probability, which the active comparable set does not produce for every match.",
	ST09: "a dangerous-underdog ceiling event requires opponent-quality history the active comparable set does not establish per match.",
	ST10: "physical/conditions evidence is not among the active comparable set."
};
/**
* The outcome recorded for a test that produced NO result, because the evidence it needs does
* not exist for this match.
*
* It used to be "UNSTABLE" -- a never-run test reported as a failed one. That is the same
* category of error the decision core is scrupulous about elsewhere (UNAVAILABLE is never
* zero): absence of a result is not a finding of instability. It also had a concrete
* consequence, because audit-engine.ts's DOUBLE GREEN test asks whether every stress test
* came back STABLE: ST04/ST08/ST09/ST10 can never be evaluated from the active metric set,
* so four rows were permanently "UNSTABLE" and DOUBLE GREEN was unreachable for every match,
* forever, regardless of the evidence. Production confirmed it: 0 DOUBLE GREEN in 60
* completed runs, with 240 rows (60 x 4) carrying status UNAVAILABLE alongside outcome
* UNSTABLE.
*
* The row's `status` already carries the execution state (UNAVAILABLE); this makes the
* OUTCOME field say the same honest thing instead of contradicting it.
*/
var STRESS_OUTCOME_NOT_EVALUATED = "NOT EVALUATED";
function stressRowPatch(testCode, audit, now) {
	const code = String(testCode ?? "");
	const before = audit.stress.winner_before;
	const rangeOf = (w) => w === "INSUFFICIENT_EVIDENCE" ? null : w;
	if (code === "ST03") {
		const reversed = audit.decision.flipping_families.length > 0;
		const tie = audit.decision.tie_inducing_families.length > 0;
		return {
			evaluated: true,
			patch: {
				winner_before: rangeOf(before),
				winner_after: reversed ? "REVERSED" : tie ? "NO_LEADER" : rangeOf(before),
				range_before: null,
				range_after: null,
				outcome: reversed ? "FAILS" : tie ? "MOSTLY STABLE" : "STABLE",
				status: "COMPLETE",
				unavailable_reason: null,
				unavailable_detail: `Removing each independent evidence family in turn: ${reversed ? `reversed by ${audit.decision.flipping_families.join(", ")}` : tie ? `no reversal; removing ${audit.decision.tie_inducing_families.join(" or ")} would leave it tied` : "leader unchanged by any single removal"}.`,
				provider_error: null,
				missing_inputs: [],
				sources: [{
					source_name: "Truth Engine leave-one-family-out recomputation",
					url: null,
					retrieved_at: null
				}],
				source_attempts: [],
				reconstruction_attempted: false,
				retrieved_at: now
			}
		};
	}
	if (code === "ST05" || code === "ST06" || code === "ST07") {
		const adverse = audit.stress.cases.find((c) => c.case_name === "ADVERSE");
		if (!adverse) return {
			evaluated: false,
			patch: {
				winner_before: null,
				winner_after: null,
				range_before: null,
				range_after: null,
				outcome: STRESS_OUTCOME_NOT_EVALUATED,
				status: "UNAVAILABLE",
				unavailable_reason: "MISSING_REQUIRED_INPUT",
				unavailable_detail: "No side was selected on the available evidence, so there is no selection to stress-test.",
				provider_error: null,
				missing_inputs: [],
				sources: [],
				source_attempts: [],
				reconstruction_attempted: false,
				retrieved_at: now
			}
		};
		return {
			evaluated: true,
			patch: {
				winner_before: rangeOf(before),
				winner_after: rangeOf(audit.stress.winner_after),
				range_before: null,
				range_after: null,
				outcome: audit.stress.changed ? "UNSTABLE" : "STABLE",
				status: "COMPLETE",
				unavailable_reason: null,
				unavailable_detail: `Adverse recomputation (${adverse.assumption}): support families ${audit.stress.cases[0].support_families} -> ${adverse.support_families}; winner ${before} -> ${audit.stress.winner_after}.`,
				provider_error: null,
				missing_inputs: [],
				sources: [{
					source_name: "Truth Engine adverse-case recomputation",
					url: null,
					retrieved_at: null
				}],
				source_attempts: [],
				reconstruction_attempted: false,
				retrieved_at: now
			}
		};
	}
	return {
		evaluated: false,
		patch: {
			winner_before: rangeOf(before),
			winner_after: null,
			range_before: null,
			range_after: null,
			outcome: STRESS_OUTCOME_NOT_EVALUATED,
			status: "UNAVAILABLE",
			unavailable_reason: "MISSING_REQUIRED_INPUT",
			unavailable_detail: STRESS_MISSING_EVIDENCE[code] ?? "No deterministic evidence path for this stress test.",
			provider_error: null,
			missing_inputs: [],
			sources: [],
			source_attempts: [],
			reconstruction_attempted: false,
			retrieved_at: now
		}
	};
}
function isProcessMetaRuleCode(ruleCode) {
	return classifyMetric(ruleCode) === "META_OR_NON_PLAYER";
}
function isNoSourceRuleCode(ruleCode) {
	const classification = classifyMetric(ruleCode);
	return classification === "PROTECTED_UNAVAILABLE" || classification === "MATRIX_SUMMARY_REQUIRED";
}
function isMatrixSummaryQuarantinedRuleCode(ruleCode) {
	return classifyMetric(ruleCode) === "MATRIX_SUMMARY_REQUIRED";
}
var TREATMENTS = [
	"DIRECT",
	"RECONSTRUCTED",
	"PARTIAL",
	"UNAVAILABLE",
	"EXCLUDED",
	"NO_SOURCE"
];
/**
* Resolves a deterministic P1/P2 outcome to the match's own player_id, never by
* name-matching. Returns null when the outcome is INSUFFICIENT_EVIDENCE, or when the
* match's own player1_id/player2_id has not been resolved (identity work outside this
* pipeline) -- an unresolved ID is left null, never fabricated or guessed from a name.
*/
function resolveWinnerId(outcome, match) {
	if (outcome === "P1") return match.player1_id ?? null;
	if (outcome === "P2") return match.player2_id ?? null;
	return null;
}
var METRIC_BATCH = 15;
var DEFAULT_BUDGET_MS = 45e3;
var RESEARCH_LOCK_TTL_MS = 18e5;
var s = (v) => v === null || v === void 0 ? null : String(v);
function lockExpired(lockAt, now) {
	if (!lockAt) return false;
	const lockMs = new Date(lockAt).getTime();
	if (Number.isNaN(lockMs)) return false;
	return now.getTime() - lockMs > RESEARCH_LOCK_TTL_MS;
}
function providerReason(error) {
	const m = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
	if (m.includes("timeout") || m.includes("timed out")) return "PROVIDER_TIMEOUT";
	if (m.includes("401") || m.includes("403") || m.includes("auth") || m.includes("api key")) return "PROVIDER_AUTH_FAILED";
	if (m.includes("429") || m.includes("rate limit")) return "API_RATE_LIMIT";
	if (m.includes("402") || m.includes("credit") || m.includes("quota")) return "PROVIDER_CREDITS";
	if (m.includes("player") && m.includes("not found")) return "PLAYER_NOT_FOUND";
	if (m.includes("match") && m.includes("not found")) return "MATCH_NOT_FOUND";
	if (m.includes("surface")) return "SURFACE_DATA_NOT_FOUND";
	if (m.includes("parse") || m.includes("json")) return "PARSING_FAILED";
	return "PRODUCER_FAILED_WITHOUT_REASON";
}
function errorDetail(error) {
	return error instanceof Error ? error.message.slice(0, 800) : error ? String(error).slice(0, 800) : null;
}
function digestFrom(match, metrics) {
	return {
		p1: match.player1_name,
		p2: match.player2_name,
		context: [
			match.tournament_name && `tournament ${match.tournament_name}`,
			match.event_level && `level ${match.event_level}`,
			match.round && `round ${match.round}`,
			match.scheduled_date && `date ${match.scheduled_date}`,
			match.surface && `surface ${match.surface}`,
			match.indoor === null || match.indoor === void 0 ? null : match.indoor ? "indoor" : "outdoor",
			match.best_of && `best of ${match.best_of}`
		].filter(Boolean).join(" · "),
		metrics: metrics.filter((m) => m["p1_value"] || m["p2_value"]).map((m) => ({
			code: String(m["metric_code"]),
			name: String(m["metric_name"]),
			p1: s(m["p1_value"]),
			p2: s(m["p2_value"]),
			family: s(m["evidence_family"])
		}))
	};
}
var treatmentToStatus = (t) => t === "UNAVAILABLE" ? "UNAVAILABLE" : t === "EXCLUDED" ? "EXCLUDED" : "COMPLETE";
function enforceStageDependencies(stage, patch, rows) {
	if (patch["status"] !== "COMPLETE") return {
		patch,
		blocked: false,
		missing: []
	};
	const missing = unmetDependencies(stage, rows);
	if (!missing.length) return {
		patch,
		blocked: false,
		missing: []
	};
	return {
		patch: {
			...patch,
			status: "BLOCKED",
			finished_at: null,
			error_code: "UPSTREAM_DEPENDENCY_INCOMPLETE",
			error_message: `Cannot complete ${stage}: upstream stage(s) not complete: ${missing.join(", ")}.`
		},
		blocked: true,
		missing
	};
}
async function runPipeline(deps, matchId, opts = {}) {
	const budget = Math.max(1, opts.budgetMs ?? DEFAULT_BUDGET_MS), startedAt = Date.now(), deadline = startedAt + budget, outOfTime = () => Date.now() > deadline;
	const match = await deps.getMatch(matchId);
	if (!match) throw new Error(`Match ${matchId} not found`);
	const run = await ensureRun(deps, match, opts.forceNewRun === true), failures = [];
	let nextStage = null;
	const owner = `audit:${matchId}:${startedAt}:${Math.random().toString(36).slice(2)}`;
	let leaseAcquired = false;
	const initial = await deps.getStages(run.id);
	const allComplete = STAGES.every((st) => initial.find((f) => f.stage === st)?.status === "COMPLETE");
	if (run.status === "COMPLETE" && allComplete) return pipelineResult(deps, matchId, run.id, initial, [], null);
	if (deps.acquireRunLease) {
		leaseAcquired = await deps.acquireRunLease(run.id, owner, Math.max(6e5, budget * 3));
		if (!leaseAcquired) {
			const waiting = STAGES.find((st) => initial.find((f) => f.stage === st)?.status !== "COMPLETE") ?? null;
			return pipelineResult(deps, matchId, run.id, initial, [], waiting, true);
		}
	} else leaseAcquired = true;
	const stageState = new Map(initial.map((r) => [r.stage, r]));
	try {
		for (const stage of STAGES) {
			const current = stageState.get(stage);
			if (current?.status === "COMPLETE") {
				const staleGaps = unmetDependencies(stage, Array.from(stageState.values()));
				if (!staleGaps.length) continue;
				const message = `Stage ${stage} was marked COMPLETE but upstream stage(s) are not: ${staleGaps.join(", ")}. Downgraded for re-execution in dependency order.`;
				try {
					await deps.setStage(run.id, matchId, stage, {
						status: "BLOCKED",
						error_code: "UPSTREAM_DEPENDENCY_INCOMPLETE",
						error_message: message,
						finished_at: null,
						heartbeat_at: deps.now().toISOString()
					});
				} catch {}
				stageState.set(stage, {
					...current,
					status: "BLOCKED",
					error_message: message
				});
				failures.push({
					stage,
					message
				});
				nextStage = stage;
				break;
			}
			if (outOfTime()) {
				nextStage = stage;
				break;
			}
			const preGaps = unmetDependencies(stage, Array.from(stageState.values()));
			if (preGaps.length) {
				const message = `Cannot start ${stage}: upstream stage(s) not complete: ${preGaps.join(", ")}.`;
				try {
					await deps.setStage(run.id, matchId, stage, {
						status: "BLOCKED",
						error_code: "UPSTREAM_DEPENDENCY_INCOMPLETE",
						error_message: message,
						heartbeat_at: deps.now().toISOString()
					});
				} catch {}
				stageState.set(stage, {
					...current ?? {
						stage,
						status: "BLOCKED",
						attempts: 0,
						error_message: null,
						done_count: 0,
						total_count: 0
					},
					status: "BLOCKED",
					error_message: message
				});
				failures.push({
					stage,
					message
				});
				nextStage = stage;
				break;
			}
			const attempts = (stageState.get(stage)?.attempts ?? 0) + 1;
			try {
				if (deps.renewRunLease && !await deps.renewRunLease(run.id, owner, Math.max(6e5, budget * 3))) throw new Error("Audit execution lease was lost before starting this stage; it will be resumed safely.");
				await deps.setStage(run.id, matchId, stage, {
					status: "RUNNING",
					attempts,
					started_at: deps.now().toISOString(),
					heartbeat_at: deps.now().toISOString(),
					error_code: null,
					error_message: null
				});
				stageState.set(stage, {
					...current ?? {},
					stage,
					status: "RUNNING",
					attempts
				});
			} catch (e) {
				const message = e.message || String(e);
				failures.push({
					stage,
					message: `Could not start or persist ${stage}: ${message}`
				});
				nextStage = stage;
				break;
			}
			const progress = async (done, total) => {
				if (deps.renewRunLease && !await deps.renewRunLease(run.id, owner, Math.max(6e5, budget * 3))) throw new Error("Audit execution lease was lost while this stage was running; it will be resumed safely.");
				await deps.setStage(run.id, matchId, stage, {
					status: "RUNNING",
					done_count: Math.max(0, done),
					total_count: Math.max(0, total),
					heartbeat_at: deps.now().toISOString(),
					error_code: null,
					error_message: null
				});
			};
			try {
				const outcome = await executeStage(deps, stage, matchId, run.id, {
					deadline,
					progress
				});
				if (deps.renewRunLease && !await deps.renewRunLease(run.id, owner, Math.max(6e5, budget * 3))) throw new Error("Audit execution lease was lost before this stage could persist its result; the newer driver owns completion.");
				const partial = outcome.status === "PARTIAL";
				const guard = enforceStageDependencies(stage, {
					status: partial ? "RUNNING" : outcome.status,
					finished_at: partial ? null : deps.now().toISOString(),
					heartbeat_at: deps.now().toISOString(),
					done_count: Math.max(0, outcome.done),
					total_count: Math.max(0, outcome.total),
					detail: outcome.detail ?? {},
					error_code: outcome.status === "FAILED" || outcome.status === "BLOCKED" ? outcome.errorCode ?? null : null,
					error_message: outcome.status === "FAILED" || outcome.status === "BLOCKED" ? outcome.message ?? null : null
				}, Array.from(stageState.values()));
				await deps.setStage(run.id, matchId, stage, guard.patch);
				stageState.set(stage, {
					...current ?? {},
					stage,
					status: String(guard.patch["status"]),
					error_message: guard.patch["error_message"] ?? null
				});
				await deps.log({
					audit_run_id: run.id,
					match_id: matchId,
					stage,
					status: guard.patch["status"],
					output: {
						done: outcome.done,
						total: outcome.total,
						...outcome.detail ?? {},
						...guard.blocked ? { upstream_gap: guard.missing } : {}
					},
					matrix_visible: [
						"MATRIX REVEAL AND COMPARISON",
						"CURRENT CALIBRATION APPLICATION",
						"COVERAGE PERSISTENCE / EVIDENCE VALIDATION",
						"FINAL DECISION",
						"FINAL COMBINATION GATE"
					].includes(stage)
				});
				if (guard.blocked) {
					failures.push({
						stage,
						message: guard.patch["error_message"]
					});
					nextStage = stage;
					break;
				}
				if (partial) {
					nextStage = stage;
					break;
				}
				if (outcome.status !== "COMPLETE") {
					failures.push({
						stage,
						message: outcome.message ?? "stage did not complete"
					});
					nextStage = stage;
					break;
				}
			} catch (e) {
				const message = e.message || String(e);
				try {
					await deps.setStage(run.id, matchId, stage, {
						status: "FAILED",
						finished_at: deps.now().toISOString(),
						heartbeat_at: deps.now().toISOString(),
						error_code: classify(message),
						error_message: message.slice(0, 800)
					});
				} catch (writeError) {
					const writeMessage = writeError.message || String(writeError);
					failures.push({
						stage,
						message: `${message} (additionally, could not persist FAILED status: ${writeMessage})`
					});
					nextStage = stage;
					break;
				}
				try {
					await deps.log({
						audit_run_id: run.id,
						match_id: matchId,
						stage,
						status: "FAILED",
						output: { error: message.slice(0, 800) }
					});
				} catch {}
				failures.push({
					stage,
					message
				});
				nextStage = stage;
				break;
			}
		}
		const finalStages = await deps.getStages(run.id), complete = STAGES.every((st) => finalStages.find((f) => f.stage === st)?.status === "COMPLETE");
		try {
			if (deps.renewRunLease && !await deps.renewRunLease(run.id, owner, Math.max(6e5, budget * 3))) throw new Error("Audit execution lease was lost before final run status persistence.");
			await deps.updateRun(run.id, {
				status: complete ? "COMPLETE" : failures.length ? "BLOCKED" : "RUNNING",
				heartbeat_at: deps.now().toISOString()
			});
		} catch (e) {
			failures.push({
				stage: nextStage ?? "FINAL COMBINATION GATE",
				message: `Could not persist audit run status: ${e.message || String(e)}`
			});
		}
		const report = await buildReport(deps, matchId, run.id);
		return {
			runId: run.id,
			complete: complete && failures.length === 0,
			nextStage: complete && failures.length === 0 ? null : nextStage ?? STAGES.find((st) => finalStages.find((f) => f.stage === st)?.status !== "COMPLETE") ?? null,
			stages: stageDetails(finalStages),
			report,
			failures
		};
	} finally {
		if (leaseAcquired && deps.releaseRunLease) try {
			await deps.releaseRunLease(run.id, owner);
		} catch {}
	}
}
function stageDetails(rows) {
	return STAGES.map((stage) => {
		const row = rows.find((item) => item.stage === stage);
		return {
			stage,
			status: row?.status ?? "PENDING",
			detail: row ? row.error_message ? row.error_message : `${row.done_count}/${row.total_count}` : "not started"
		};
	});
}
function classify(message) {
	const m = message.toLowerCase();
	if (m.includes("rate limit") || m.includes("429")) return "PROVIDER_RATE_LIMIT";
	if (m.includes("credit") || m.includes("402")) return "PROVIDER_CREDITS";
	if (m.includes("api key") || m.includes("unauthorized") || m.includes("401")) return "AUTH_OR_CONFIG";
	if (m.includes("timeout") || m.includes("timed out")) return "TIMEOUT";
	if (m.includes("no active") || m.includes("definition")) return "MISSING_DEFINITIONS";
	if (m.includes("json") || m.includes("parse")) return "PROVIDER_RESPONSE_INVALID";
	return "ORCHESTRATION_EXCEPTION";
}
function unavailableReason(message) {
	const v = message.toLowerCase();
	if (v.includes("timeout") || v.includes("timed out")) return "PROVIDER_TIMEOUT";
	if (v.includes("rate limit") || v.includes("429")) return "API_RATE_LIMIT";
	if (v.includes("auth") || v.includes("api key") || v.includes("401") || v.includes("403")) return "PROVIDER_AUTH_FAILED";
	if (v.includes("player") && v.includes("not found")) return "PLAYER_NOT_FOUND";
	if (v.includes("match") && v.includes("not found")) return "MATCH_NOT_FOUND";
	if (v.includes("surface")) return "SURFACE_DATA_NOT_FOUND";
	if (v.includes("sample")) return "INSUFFICIENT_SAMPLE";
	if (v.includes("missing") || v.includes("required input")) return "MISSING_REQUIRED_INPUT";
	if (v.includes("conflict")) return "SOURCE_CONFLICT";
	if (/\bpars/.test(v) || v.includes("json")) return "PARSING_FAILED";
	if (v.includes("historical")) return "HISTORICAL_DATA_UNAVAILABLE";
	return "NO_SOURCE_FOUND";
}
function normalizedMetricCode(code) {
	const m = code.match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : code.padStart(3, "0");
}
function usableAgainstComparisonSpec(code, value) {
	const spec = COMPARISON_SPECS[normalizedMetricCode(code)];
	if (!spec) return true;
	const parsed = parseMetricValue(value);
	if ([spec.field, ...spec.fieldAliases ?? []].some((name) => name !== null && Number.isFinite(Number(parsed.fields.get(name))))) return true;
	return Boolean(spec.bareScalarFallback) && parsed.scalar !== null;
}
function metricPairPatch(f, providerError, retrievedAt) {
	const side = (key) => {
		let treatment = f?.[`${key}_treatment`] ?? "UNAVAILABLE";
		let value = f?.[`${key}_value`] ?? null;
		if (f?.metric_code && value !== null && (treatment === "DIRECT" || treatment === "RECONSTRUCTED" || treatment === "PARTIAL") && !usableAgainstComparisonSpec(f.metric_code, value)) {
			treatment = "UNAVAILABLE";
			value = null;
		}
		const usable = treatment === "DIRECT" || treatment === "RECONSTRUCTED";
		const statedDetail = value === null && f?.[`${key}_value`] !== null && f?.[`${key}_value`] !== void 0 ? `Producer returned a value for this metric, but it was missing the specific field this metric's comparison requires (only unrelated statistics were present).` : f?.[`${key}_unavailable_reason`] ?? f?.unavailable_reason ?? null;
		const detail = usable ? null : statedDetail ?? (providerError ? "Research provider did not return a result for this metric." : null);
		const reason = usable ? null : statedDetail ? unavailableReason(statedDetail) : providerError ? providerReason(providerError) : treatment === "PARTIAL" ? "MISSING_REQUIRED_INPUT" : "PRODUCER_FAILED_WITHOUT_REASON";
		return {
			treatment,
			value,
			detail,
			reason,
			status: treatmentToStatus(treatment)
		};
	};
	const p1 = side("p1"), p2 = side("p2");
	const patch = {
		p1_value: p1.value,
		p2_value: p2.value,
		p1_status: p1.status,
		p2_status: p2.status,
		p1_treatment: p1.treatment,
		p2_treatment: p2.treatment,
		status: p1.status === "COMPLETE" || p2.status === "COMPLETE" ? "COMPLETE" : "UNAVAILABLE",
		sources: f?.sources ?? [],
		reliability: f?.reliability ?? null,
		sample: f?.sample ?? null,
		unavailable_reason: p1.reason === p2.reason ? p1.reason : "MISSING_REQUIRED_INPUT",
		unavailable_detail: p1.detail === p2.detail ? p1.detail : `P1: ${p1.detail ?? "usable"} | P2: ${p2.detail ?? "usable"}`,
		provider_error: providerError,
		source_attempts: f?.sources ?? [],
		reconstruction_attempted: false,
		retrieved_at: retrievedAt,
		p1_unavailable_reason: p1.reason,
		p2_unavailable_reason: p2.reason,
		p1_provider_error: providerError,
		p2_provider_error: providerError,
		p1_retrieved_at: retrievedAt,
		p2_retrieved_at: retrievedAt,
		missing_inputs: f?.missing_inputs ?? [],
		reconstruction_reason: null,
		reconstruction_result: null
	};
	if (f?.evidence_family) patch["evidence_family"] = f.evidence_family;
	if (f?.differential) patch["differential"] = f.differential;
	return patch;
}
function preserveSettledOppositeSide(patch, row, side) {
	const opposite = side === "p1" ? "p2" : "p1";
	const oppositeStatus = String(row[`${opposite}_status`] ?? "");
	if (![
		"COMPLETE",
		"UNAVAILABLE",
		"EXCLUDED",
		"NO_SOURCE"
	].includes(oppositeStatus)) return patch;
	for (const key of Object.keys(patch)) if (key.startsWith(`${opposite}_`)) delete patch[key];
	const priorSources = Array.isArray(row["sources"]) ? row["sources"] : [];
	const nextSources = Array.isArray(patch["sources"]) ? patch["sources"] : [];
	patch["sources"] = [...priorSources, ...nextSources].filter((source, index, all) => {
		const candidate = source;
		return all.findIndex((other) => {
			const item = other;
			return item.source_name === candidate.source_name && item.url === candidate.url;
		}) === index;
	});
	patch["status"] = String(patch[`${side}_status`] ?? "UNAVAILABLE") === "COMPLETE" || oppositeStatus === "COMPLETE" ? "COMPLETE" : "UNAVAILABLE";
	return patch;
}
function preserveUsableCurrentSide(patch, row, side) {
	const usable = (treatment, value) => [
		"DIRECT",
		"RECONSTRUCTED",
		"PARTIAL"
	].includes(String(treatment)) && String(value ?? "").trim() !== "";
	if (!usable(row[`${side}_treatment`], row[`${side}_value`]) || usable(patch[`${side}_treatment`], patch[`${side}_value`])) return patch;
	const attemptedAt = patch[`${side}_retrieved_at`];
	for (const key of Object.keys(patch)) if (key.startsWith(`${side}_`)) delete patch[key];
	if (attemptedAt !== void 0) patch[`${side}_retrieved_at`] = attemptedAt;
	for (const key of [
		"unavailable_reason",
		"unavailable_detail",
		"provider_error",
		"missing_inputs"
	]) delete patch[key];
	patch["status"] = "COMPLETE";
	return patch;
}
function pass2WriteBackPatch(row, side, statsByFamily, context) {
	const code = normalizedMetricCode(String(row["metric_code"] ?? "").replace(/^M/, ""));
	const spec = COMPARISON_SPECS[code];
	if (!spec) return null;
	const declared = [spec.field, ...spec.fieldAliases ?? []].filter((name) => typeof name === "string" && name.length > 0);
	if (!declared.length) return null;
	if (["EXCLUDED", "NO_SOURCE"].includes(String(row[`${side}_status`] ?? "")) || ["EXCLUDED", "NO_SOURCE"].includes(String(row[`${side}_treatment`] ?? ""))) return null;
	const expectedSide = side === "p1" ? "P1" : "P2";
	const facts = {
		player1_name: context.p1Name,
		player2_name: context.p2Name
	};
	const stat = (statsByFamily.get(code) ?? []).find((candidate) => declared.includes(candidate.key) && Number.isFinite(candidate.value) && matchSideForName(candidate.player, facts) === expectedSide);
	if (!stat) return null;
	if ([
		"DIRECT",
		"RECONSTRUCTED",
		"PARTIAL"
	].includes(String(row[`${side}_treatment`] ?? "")) && String(row[`${side}_value`] ?? "").trim() !== "") return null;
	const value = `${stat.key}=${stat.value}`;
	if (!usableAgainstComparisonSpec(code, value)) return null;
	const priorSources = Array.isArray(row["sources"]) ? row["sources"] : [];
	const attributed = (stat.sources ?? []).map((source) => ({
		...source,
		player_side: expectedSide
	}));
	const sources = [...priorSources, ...attributed].filter((source, index, all) => all.findIndex((other) => {
		const a = other, b = source;
		return a.source_name === b.source_name && a.url === b.url && (a.player_side ?? null) === (b.player_side ?? null);
	}) === index);
	return {
		[`${side}_value`]: value,
		[`${side}_status`]: "COMPLETE",
		[`${side}_treatment`]: stat.origin,
		[`${side}_unavailable_reason`]: null,
		[`${side}_provider_error`]: null,
		[`${side}_retrieved_at`]: context.retrievedAt,
		status: "COMPLETE",
		sources,
		source_attempts: sources,
		reconstruction_attempted: true,
		reconstruction_reason: stat.calculation ?? null,
		reconstruction_result: value
	};
}
function researchedForOwnSide(row, side) {
	return String(row[`${side}_retrieved_at`] ?? "").trim() !== "";
}
/**
* Strips the OPPOSITE side's retrieval timestamp from a research patch.
*
* The researcher answers with one paired finding carrying both players' values, so a
* P1-oriented pass legitimately writes P2's value -- but it performed no retrieval with
* P2 as the subject, and stamping p2_retrieved_at as though it had is what destroyed
* the only per-row record the P2 stage could have resumed from. The value still lands;
* only the claim to have retrieved it for that side is withheld.
*/
function claimRetrievalForExecutingSideOnly(patch, side) {
	delete patch[`${side === "p1" ? "p2" : "p1"}_retrieved_at`];
	return patch;
}
function metricRowsForSideExecution(rows, side) {
	const stableRows = [...rows].sort((a, b) => String(a["metric_code"] ?? a["id"] ?? "").localeCompare(String(b["metric_code"] ?? b["id"] ?? "")));
	const pending = stableRows.filter((row) => !isNoSourceRuleCode(String(row["metric_code"] ?? ""))).filter((row) => !["EXCLUDED", "NO_SOURCE"].includes(String(row[`${side}_status`]))).filter((row) => !researchedForOwnSide(row, side));
	return {
		pending,
		completedBefore: stableRows.length - pending.length
	};
}
async function ensureRun(deps, match, forceNewRun = false) {
	const existing = await deps.getLatestRun(match.id);
	const now = deps.now();
	if (!forceNewRun && existing && isActiveRunStatus(existing.status)) {
		if (existing.status === "COMPLETE") return existing;
		const expired = existing.status === "RUNNING" && lockExpired(existing.research_lock_at, now);
		if (!existing.research_lock_at || expired) {
			const refreshed = now.toISOString();
			const patch = {
				status: "RUNNING",
				research_lock_at: refreshed,
				heartbeat_at: refreshed,
				stale_reason: null
			};
			await deps.updateRun(existing.id, patch);
			return {
				...existing,
				...patch
			};
		}
		if (existing.status !== "RUNNING") await deps.updateRun(existing.id, {
			status: "RUNNING",
			heartbeat_at: now.toISOString()
		});
		return {
			...existing,
			status: "RUNNING"
		};
	}
	const [metrics_version_id, verification_version_id, disagreement_version_id] = await Promise.all([
		deps.getActiveVersionId("METRICS"),
		deps.getActiveVersionId("VERIFICATION"),
		deps.getActiveVersionId("DISAGREEMENT")
	]);
	return deps.createRun({
		match_id: match.id,
		run_number: (existing?.run_number ?? 0) + 1,
		status: "RUNNING",
		research_lock_at: now.toISOString(),
		heartbeat_at: now.toISOString(),
		metrics_version_id,
		verification_version_id,
		disagreement_version_id
	});
}
async function preparePipelineRun(deps, matchId) {
	const match = await deps.getMatch(matchId);
	if (!match) throw new Error(`Match ${matchId} not found`);
	try {
		return await ensureRun(deps, match);
	} catch (error) {
		const concurrentlyCreated = await deps.getLatestRun(matchId);
		if (concurrentlyCreated) return concurrentlyCreated;
		throw error;
	}
}
async function executeStage(deps, stage, matchId, runId, ctx) {
	switch (stage) {
		case "MATCH INGESTION / PDF EXTRACTION": return confirmIngestion(deps, matchId);
		case "MATCH IDENTITY VERIFICATION":
		case "MATCH CONTEXT RESOLUTION": return identityAndContext(deps, matchId, runId, stage);
		case "DEFINITION INSTANTIATION": return instantiate(deps, matchId, runId);
		case "P1 METRIC EXECUTION":
		case "P2 METRIC EXECUTION": return executeMetrics(deps, matchId, runId, stage === "P1 METRIC EXECUTION" ? "p1" : "p2", ctx);
		case "VERIFICATION AUDIT": return executeRules(deps, matchId, runId, "VERIFICATION", ctx);
		case "DISAGREEMENT / TRAP AUDIT": return executeRules(deps, matchId, runId, "DISAGREEMENT", ctx);
		case "DANGEROUS UNDERDOG AUDIT": return executeUnderdog(deps, matchId, runId);
		case "STRESS / REMOVAL TESTS": return executeStress(deps, matchId, runId);
		case "INDEPENDENT CONCLUSION": return commitConclusion(deps, matchId, runId);
		case "MATRIX REVEAL AND COMPARISON": return revealMatrix(deps, matchId, runId);
		case "CURRENT CALIBRATION APPLICATION": return applyCalibration(deps, matchId, runId);
		case "COVERAGE PERSISTENCE / EVIDENCE VALIDATION": return persistCoverage(deps, matchId, runId);
		case "FINAL DECISION": return commitFinalDecision(deps, matchId, runId);
		case "FINAL COMBINATION GATE": return finalGate(deps, matchId, runId);
	}
}
async function confirmIngestion(deps, matchId) {
	const match = await deps.getMatch(matchId);
	if (!match) throw new Error("match disappeared");
	return {
		status: "COMPLETE",
		done: 1,
		total: 1,
		detail: {
			player1_name: match.player1_name,
			player2_name: match.player2_name
		}
	};
}
async function identityAndContext(deps, matchId, runId, stage) {
	const match = await deps.getMatch(matchId);
	if (!match) throw new Error("match disappeared");
	const isIdentity = stage === "MATCH IDENTITY VERIFICATION";
	if (isIdentity && match.identity_status === "VERIFIED") return {
		status: "COMPLETE",
		done: 2,
		total: 2
	};
	if (!isIdentity && match.surface_status === "VERIFIED" && match.scheduled_date && match.round) return {
		status: "COMPLETE",
		done: 6,
		total: 6
	};
	const parsed = await deps.getParsedFields(matchId);
	let finding;
	try {
		finding = await deps.research.identity({
			p1: match.player1_name,
			p2: match.player2_name,
			hints: {
				tournament: match.tournament_name ?? parsed["tournament"] ?? null,
				round: match.round ?? parsed["round"] ?? null,
				scheduled_date: match.scheduled_date ?? parsed["scheduled_date"] ?? null,
				surface: match.surface ?? parsed["surface"] ?? null,
				event_level: match.event_level ?? parsed["event_level"] ?? null
			}
		});
	} catch {
		if (isIdentity) {
			await deps.updateMatch(matchId, { identity_status: "UNAVAILABLE" });
			await deps.saveIdentityRecords(matchId, [{
				field: "player_1",
				claimed_value: match.player1_name,
				verified_value: null,
				status: "UNAVAILABLE",
				note: "Identity search unavailable; names retained from PDF."
			}, {
				field: "player_2",
				claimed_value: match.player2_name,
				verified_value: null,
				status: "UNAVAILABLE",
				note: "Identity search unavailable; names retained from PDF."
			}]);
			return {
				status: "COMPLETE",
				done: 0,
				total: 2,
				detail: { unavailable: "identity search" }
			};
		}
		await deps.updateMatch(matchId, { surface_status: "UNAVAILABLE" });
		return {
			status: "COMPLETE",
			done: 0,
			total: 6,
			detail: { unavailable: "context search" }
		};
	}
	const retrieved = deps.now().toISOString();
	await deps.saveSnapshots(runId, finding.sources.map((src) => ({
		source_name: src.source_name,
		data_key: isIdentity ? "match_identity" : "match_context",
		raw_value: src.url,
		normalized_value: src.url,
		retrieved_at: src.retrieved_at ?? retrieved,
		reliability: .9
	})));
	if (finding.conflicts.length) await deps.saveConflicts(runId, finding.conflicts.map((c) => ({
		data_key: c.field,
		critical: [
			"player_1",
			"player_2",
			"surface"
		].includes(c.field),
		values: c.values,
		resolution_status: "UNRESOLVED",
		resolution_reason: c.note
	})));
	if (isIdentity) {
		const rows = [{
			field: "player_1",
			claimed_value: match.player1_name,
			verified_value: finding.player1_canonical,
			status: finding.player1_status,
			note: finding.unresolved_reason
		}, {
			field: "player_2",
			claimed_value: match.player2_name,
			verified_value: finding.player2_canonical,
			status: finding.player2_status,
			note: finding.unresolved_reason
		}];
		await deps.saveIdentityRecords(matchId, rows);
		const verified = finding.player1_status === "VERIFIED" && finding.player2_status === "VERIFIED";
		await deps.updateMatch(matchId, { identity_status: verified ? "VERIFIED" : finding.player1_status === "CONFLICT" || finding.player2_status === "CONFLICT" ? "CONFLICT" : "UNVERIFIED" });
		return {
			status: "COMPLETE",
			done: [finding.player1_status, finding.player2_status].filter((x) => x === "VERIFIED").length,
			total: 2,
			detail: verified ? {} : { identity_unverified: finding.unresolved_reason ?? "Player identity could not be confirmed against an external tennis source." }
		};
	}
	const patch = {};
	if (finding.tournament) patch["tournament_name"] = finding.tournament;
	if (finding.event_level) patch["event_level"] = finding.event_level;
	if (finding.round) patch["round"] = finding.round;
	if (finding.scheduled_date) patch["scheduled_date"] = finding.scheduled_date;
	if (finding.surface) patch["surface"] = finding.surface;
	if (finding.indoor !== null && finding.indoor !== void 0) patch["indoor"] = finding.indoor;
	if (finding.best_of) patch["best_of"] = finding.best_of;
	patch["surface_status"] = finding.surface ? finding.surface_status : "UNVERIFIED";
	await deps.updateMatch(matchId, patch);
	await deps.saveIdentityRecords(matchId, [
		"tournament",
		"event_level",
		"round",
		"scheduled_date",
		"surface",
		"best_of"
	].map((field) => {
		const value = s(patch[field === "tournament" ? "tournament_name" : field]);
		return {
			field,
			claimed_value: parsed[field] ?? null,
			verified_value: value,
			status: value ? "VERIFIED" : "UNAVAILABLE",
			note: value ? null : finding.unresolved_reason ?? "Retrieval attempted; no authoritative source carried this field."
		};
	}));
	const fields = [
		"tournament_name",
		"event_level",
		"round",
		"scheduled_date",
		"surface",
		"best_of"
	];
	return {
		status: "COMPLETE",
		done: fields.filter((f) => patch[f] !== void 0 && patch[f] !== null).length,
		total: fields.length,
		detail: finding.surface ? { unresolved: fields.filter((f) => patch[f] === void 0) } : {
			unresolved: fields.filter((f) => patch[f] === void 0),
			surface_unverified: finding.unresolved_reason ?? "Surface could not be established from any approved source."
		}
	};
}
async function instantiate(deps, matchId, runId) {
	const match = await deps.getMatch(matchId);
	if (!match) throw new Error("match disappeared");
	const missing = [], versions = {
		METRICS: await deps.getActiveVersionId("METRICS"),
		VERIFICATION: await deps.getActiveVersionId("VERIFICATION"),
		DISAGREEMENT: await deps.getActiveVersionId("DISAGREEMENT")
	};
	for (const [k, v] of Object.entries(versions)) if (!v) missing.push(k);
	if (missing.length) return {
		status: "FAILED",
		done: 0,
		total: 3,
		errorCode: "MISSING_DEFINITIONS",
		message: `No active rule document version for: ${missing.join(", ")}. Upload/activate the definition documents in Rules before running the audit.`
	};
	await deps.updateRun(runId, {
		metrics_version_id: versions.METRICS,
		verification_version_id: versions.VERIFICATION,
		disagreement_version_id: versions.DISAGREEMENT
	});
	const [metricDefs, verDefs, disDefs] = await Promise.all([
		deps.getRules(versions.METRICS),
		deps.getRules(versions.VERIFICATION),
		deps.getRules(versions.DISAGREEMENT)
	]);
	if (!metricDefs.length || !verDefs.length || !disDefs.length) return {
		status: "FAILED",
		done: 0,
		total: 3,
		errorCode: "MISSING_DEFINITIONS",
		message: `Active versions contain no parsed rules (metrics ${metricDefs.length}, verification ${verDefs.length}, disagreement ${disDefs.length}).`
	};
	const activeMetricDefs = metricDefs.filter((d) => isActiveMetricCode(d.rule_code) || isProcessMetaRuleCode(d.rule_code) || normalizeMetricCode(d.rule_code) === "042");
	const existingMetrics = await deps.list("metric_results", runId), haveMetric = new Set(existingMetrics.map((r) => String(r["metric_code"]))), newMetrics = activeMetricDefs.filter((d) => !haveMetric.has(d.rule_code)).map((d) => {
		const excluded = isProcessMetaRuleCode(d.rule_code);
		const noSource = !excluded && isNoSourceRuleCode(d.rule_code);
		const quarantined = noSource && isMatrixSummaryQuarantinedRuleCode(d.rule_code);
		const initial = excluded ? "EXCLUDED" : noSource ? "NO_SOURCE" : "NOT STARTED";
		return {
			audit_run_id: runId,
			metric_code: d.rule_code,
			metric_name: d.rule_name,
			category: d.severity,
			evidence_family: d.rule_name,
			matrix_derived: false,
			status: initial,
			p1_status: initial,
			p2_status: initial,
			p1_treatment: excluded ? "EXCLUDED" : "UNAVAILABLE",
			p2_treatment: excluded ? "EXCLUDED" : "UNAVAILABLE",
			unavailable_reason: excluded ? "PROCESS_META_NOT_PLAYER_EVIDENCE" : quarantined ? "MATRIX_SUMMARY_EVIDENCE_REQUIRED" : noSource ? "NO_SOURCE_NO_LEGITIMATE_PATHWAY" : null,
			unavailable_detail: excluded ? "Canonical classification registry classifies this code as a process/model-governance section (see metric-classification.ts), not a player-level metric; excluded from player-evidence coverage rather than scored as unavailable." : quarantined ? "The Truth Engine does not currently possess the Tennis Matrix AI Summary evidence this code requires, so it is quarantined out of the ACTIVE audit pipeline (see MATRIX_SUMMARY_REQUIRED_RECORDS in metric-classification.ts). This is not a failure, a zero, a retirement, or a permanent determination: the definition, formula, schema and all historical results/evidence are preserved, the code contributes no active weight and cannot block this audit, and it is restored to the active denominator once real Matrix Summary evidence is uploaded, validated and the code has earned reactivation." : noSource ? "Canonical classification registry records a documented determination that no legitimate obtainable or reconstructable evidence pathway exists for this code (see PROTECTED_UNAVAILABLE_RECORDS in metric-classification.ts); excluded from player-evidence coverage rather than scored as unavailable." : null
		};
	});
	if (newMetrics.length) await deps.insert("metric_results", newMetrics);
	const existingVer = await deps.list("verification_results", runId), haveVer = new Set(existingVer.map((r) => String(r["rule_code"]))), newVer = verDefs.filter((d) => !haveVer.has(d.rule_code)).map((d) => ({
		audit_run_id: runId,
		rule_id: d.id,
		rule_code: d.rule_code,
		rule_name: d.rule_name,
		severity: d.severity,
		status: "NOT STARTED",
		outcome: "NOT STARTED"
	}));
	if (newVer.length) await deps.insert("verification_results", newVer);
	const existingDis = await deps.list("disagreement_results", runId), haveDis = new Set(existingDis.map((r) => String(r["rule_code"]))), newDis = disDefs.filter((d) => !haveDis.has(d.rule_code)).map((d) => ({
		audit_run_id: runId,
		rule_id: d.id,
		rule_code: d.rule_code,
		rule_name: d.rule_name,
		status: "NOT STARTED"
	}));
	if (newDis.length) await deps.insert("disagreement_results", newDis);
	const existingUnder = await deps.list("underdog_results", runId), haveUnder = new Set(existingUnder.map((r) => `${r["player_side"]}|${r["pathway_code"]}`)), newUnder = [match.player1_name, match.player2_name].flatMap((side) => UNDERDOG_PATHWAYS.filter(([code]) => !haveUnder.has(`${side}|${code}`)).map(([code, name]) => ({
		audit_run_id: runId,
		pathway_code: code,
		pathway_name: name,
		player_side: side,
		classification: "UNRESOLVED",
		status: "NOT STARTED"
	})));
	if (newUnder.length) await deps.insert("underdog_results", newUnder);
	const existingStress = await deps.list("stress_results", runId), haveStress = new Set(existingStress.map((r) => String(r["test_code"]))), newStress = STRESS_TESTS.filter(([code]) => !haveStress.has(code)).map(([code, name]) => ({
		audit_run_id: runId,
		test_code: code,
		test_name: name,
		status: "NOT STARTED",
		outcome: "NOT STARTED"
	}));
	if (newStress.length) await deps.insert("stress_results", newStress);
	const total = activeMetricDefs.length + verDefs.length + disDefs.length + UNDERDOG_PATHWAYS.length * 2 + STRESS_TESTS.length;
	return {
		status: "COMPLETE",
		done: total,
		total,
		detail: {
			metrics: activeMetricDefs.length,
			verification: verDefs.length,
			disagreement: disDefs.length,
			underdog: UNDERDOG_PATHWAYS.length * 2,
			stress: STRESS_TESTS.length
		}
	};
}
async function executeMetrics(deps, matchId, runId, side, ctx) {
	const match = await deps.getMatch(matchId);
	if (!match) throw new Error("match disappeared");
	const rows = await deps.list("metric_results", runId);
	if (!rows.length) return {
		status: "FAILED",
		done: 0,
		total: 0,
		errorCode: "MISSING_DEFINITIONS",
		message: "No metric rows instantiated."
	};
	const stageName = side === "p1" ? "P1 METRIC EXECUTION" : "P2 METRIC EXECUTION", { pending, completedBefore } = metricRowsForSideExecution(rows, side), versions = await deps.getActiveVersionId("METRICS"), defs = versions ? await deps.getRules(versions) : [], bodyByCode = new Map(defs.map((d) => [d.rule_code, d.body])), digestContext = digestFrom(match, rows).context;
	let dossier = "";
	if (pending.length && deps.research.dossier) {
		const run = await deps.getLatestRun(matchId), cached = run?.independent_inputs?.["dossiers"], need = [match.player1_name, match.player2_name].filter((p) => !cached?.[p]), fresh = { ...cached ?? {} };
		const retrieved = await Promise.all(need.map(async (player) => {
			const opponent = player === match.player1_name ? match.player2_name : match.player1_name;
			try {
				return [player, await deps.research.dossier({
					player,
					opponent,
					context: digestContext
				})];
			} catch {
				return [player, ""];
			}
		}));
		for (const [player, value] of retrieved) fresh[player] = value;
		if (need.length) await deps.updateRun(runId, { independent_inputs: {
			...run?.independent_inputs ?? {},
			dossiers: fresh
		} });
		dossier = fresh[side === "p1" ? match.player1_name : match.player2_name] ?? "";
	}
	const MAX_METRIC_RETRY_ATTEMPTS = 2;
	const RETRIABLE_REASONS = /* @__PURE__ */ new Set(["PROVIDER_TIMEOUT", "API_RATE_LIMIT"]);
	const runResearchBatch = async (rowsToRun) => {
		let findings = [], providerError = null;
		const batchStartedAt = Date.now();
		try {
			findings = await deps.research.metrics({
				p1: match.player1_name,
				p2: match.player2_name,
				context: digestContext,
				auditDate: match.scheduled_date,
				dossier,
				researchSide: side,
				researchPlayer: side === "p1" ? match.player1_name : match.player2_name,
				researchOpponent: side === "p1" ? match.player2_name : match.player1_name,
				metrics: rowsToRun.map((r) => ({
					code: String(r["metric_code"]),
					name: String(r["metric_name"]),
					body: bodyByCode.get(String(r["metric_code"])) ?? null
				}))
			});
		} catch (error) {
			providerError = errorDetail(error);
		}
		console.log(`[research-timing] ${side.toUpperCase()} batch of ${rowsToRun.length} ${providerError ? "ERROR" : "OK"} ${Date.now() - batchStartedAt}ms`);
		const byCode = new Map(findings.map((f) => [f.metric_code, f]));
		const retrievedAt = deps.now().toISOString();
		const stillRetriable = [];
		await Promise.all(rowsToRun.map(async (row) => {
			const finalPatch = preserveUsableCurrentSide(claimRetrievalForExecutingSideOnly(preserveSettledOppositeSide(metricPairPatch(byCode.get(String(row["metric_code"])), providerError, retrievedAt), row, side), side), row, side);
			await deps.update("metric_results", String(row["id"]), finalPatch);
			const reason = finalPatch[`${side}_unavailable_reason`];
			if (typeof reason === "string" && RETRIABLE_REASONS.has(reason)) stillRetriable.push(row);
		}));
		return stillRetriable;
	};
	let timedOut = false, treatedInPass = 0;
	for (let i = 0; i < pending.length; i += METRIC_BATCH) {
		if (Date.now() > ctx.deadline) {
			timedOut = true;
			break;
		}
		const batch = pending.slice(i, i + METRIC_BATCH);
		let retryQueue = await runResearchBatch(batch);
		for (let attempt = 1; attempt <= MAX_METRIC_RETRY_ATTEMPTS && retryQueue.length && Date.now() <= ctx.deadline; attempt++) {
			await deps.log({
				audit_run_id: runId,
				match_id: matchId,
				stage: stageName,
				status: "RETRYING",
				output: {
					side,
					attempt,
					retried_codes: retryQueue.map((r) => String(r["metric_code"]))
				}
			});
			retryQueue = await runResearchBatch(retryQueue);
		}
		treatedInPass += batch.length;
		await ctx.progress(completedBefore + treatedInPass, rows.length);
	}
	if (!timedOut && deps.research.extractStats) {
		const player = side === "p1" ? match.player1_name : match.player2_name, cached = (await deps.getLatestRun(matchId))?.independent_inputs?.["dossiers"];
		let raw = [], extractionError = null;
		try {
			raw = await deps.research.extractStats({
				player,
				dossier: cached?.[player] ?? dossier,
				context: digestContext
			});
		} catch (error) {
			extractionError = errorDetail(error);
		}
		const outcome = reconstruct(raw), reconstructionRows = [
			...outcome.derived.map((stat) => ({
				audit_run_id: runId,
				metric_code: stat.key,
				player_side: player,
				status: "COMPLETE",
				output: String(stat.value),
				formula: stat.formula ?? null,
				inputs: stat.inputs?.map((input) => ({
					key: input.key,
					value: input.value,
					origin: input.origin,
					sources: input.sources
				})) ?? [],
				calculation: stat.calculation ?? null,
				source_refs: stat.sources,
				assumptions: null,
				reliability: .8,
				unavailable_reason: null,
				provider_error: null,
				missing_inputs: [],
				source_attempts: stat.sources,
				reconstruction_attempted: true,
				reconstruction_reason: stat.calculation ?? null,
				reconstruction_result: String(stat.value),
				retrieved_at: deps.now().toISOString()
			})),
			...outcome.blocked.map((blocked) => ({
				audit_run_id: runId,
				metric_code: blocked.output,
				player_side: player,
				status: "UNAVAILABLE",
				output: null,
				formula: null,
				inputs: { missing: blocked.missing },
				calculation: blocked.reason,
				source_refs: [],
				assumptions: blocked.reason,
				reliability: null,
				unavailable_reason: "RECONSTRUCTION_FAILED",
				provider_error: null,
				missing_inputs: blocked.missing,
				source_attempts: [],
				reconstruction_attempted: true,
				reconstruction_reason: blocked.reason,
				reconstruction_result: null,
				retrieved_at: deps.now().toISOString()
			})),
			...raw.length || outcome.blocked.length ? [] : [{
				audit_run_id: runId,
				metric_code: "PASS2_EXTRACTION",
				player_side: player,
				status: "UNAVAILABLE",
				output: null,
				formula: null,
				inputs: { missing: ["dossier"] },
				calculation: extractionError ?? "No catalogued statistics were extracted from the player dossier.",
				source_refs: [],
				assumptions: null,
				reliability: null,
				unavailable_reason: extractionError ? unavailableReason(extractionError) : "NO_SOURCE_FOUND",
				provider_error: extractionError,
				missing_inputs: ["dossier"],
				source_attempts: [],
				reconstruction_attempted: true,
				reconstruction_reason: extractionError ?? "No catalogued statistics were extracted from the player dossier.",
				retrieved_at: deps.now().toISOString()
			}]
		];
		if (reconstructionRows.length) await deps.insert("reconstruction_results", reconstructionRows);
		const statsByFamily = /* @__PURE__ */ new Map();
		for (const stat of [...raw, ...outcome.derived]) {
			const family = familyOf(stat.key);
			if (!family) continue;
			statsByFamily.set(family, [...statsByFamily.get(family) ?? [], stat]);
		}
		const writeBackContext = {
			p1Name: match.player1_name,
			p2Name: match.player2_name,
			retrievedAt: deps.now().toISOString()
		};
		for (const row of rows) {
			const patch = pass2WriteBackPatch(row, side, statsByFamily, writeBackContext);
			if (!patch) continue;
			await deps.update("metric_results", String(row["id"]), patch);
		}
	}
	const done = completedBefore + treatedInPass;
	if (timedOut) return {
		status: "PARTIAL",
		done,
		total: rows.length,
		message: `${done}/${rows.length} metrics treated so far for ${side.toUpperCase()}.`
	};
	return {
		status: "COMPLETE",
		done: rows.length,
		total: rows.length
	};
}
async function executeRules(deps, matchId, runId, kind, ctx) {
	const table = kind === "VERIFICATION" ? "verification_results" : "disagreement_results";
	const match = await deps.getMatch(matchId);
	if (!match) throw new Error("match disappeared");
	const rows = await deps.list(table, runId);
	if (!rows.length) return {
		status: "FAILED",
		done: 0,
		total: 0,
		errorCode: "MISSING_DEFINITIONS",
		message: `No ${kind.toLowerCase()} rules instantiated.`
	};
	const metrics = await deps.list("metric_results", runId);
	const audit = runTruthEngineAudit(compareMetricRows(metrics.map((m) => ({
		metric_code: String(m["metric_code"] ?? ""),
		p1_value: m["p1_value"],
		p2_value: m["p2_value"],
		p1_treatment: m["p1_treatment"],
		p2_treatment: m["p2_treatment"]
	}))), match.player1_name, match.player2_name);
	const now = deps.now().toISOString();
	const pending = rows.filter((r) => ![
		"COMPLETE",
		"UNAVAILABLE",
		"EXCLUDED"
	].includes(String(r["status"])));
	let processed = 0, evaluated = 0;
	for (const row of pending) {
		if (Date.now() > ctx.deadline) break;
		const mapped = kind === "VERIFICATION" ? verificationRowPatch(row["rule_code"], audit, match.player1_name, match.player2_name, now) : disagreementRowPatch(row["rule_code"], audit, match.player1_name, match.player2_name, now);
		await deps.update(table, String(row["id"]), mapped.patch);
		if (mapped.evaluated) evaluated++;
		processed++;
		await ctx.progress(rows.length - pending.length + processed, rows.length);
	}
	const after = await deps.list(table, runId), done = after.filter((r) => [
		"COMPLETE",
		"UNAVAILABLE",
		"EXCLUDED"
	].includes(String(r["status"]))).length;
	if (processed < pending.length) return {
		status: "PARTIAL",
		done,
		total: after.length,
		message: `${done}/${after.length} ${kind.toLowerCase()} rules treated so far.`
	};
	return done === after.length ? {
		status: "COMPLETE",
		done,
		total: after.length,
		detail: {
			deterministically_evaluated: evaluated,
			unavailable: after.length - evaluated
		}
	} : {
		status: "BLOCKED",
		done,
		total: after.length,
		errorCode: "RULE_EXECUTION_INCOMPLETE",
		message: `${after.length - done} ${kind.toLowerCase()} rules unexecuted.`
	};
}
async function executeUnderdog(deps, matchId, runId) {
	const match = await deps.getMatch(matchId);
	if (!match) throw new Error("match disappeared");
	const rows = await deps.list("underdog_results", runId);
	if (!rows.length) return {
		status: "FAILED",
		done: 0,
		total: 0,
		errorCode: "MISSING_DEFINITIONS",
		message: "No underdog pathways instantiated."
	};
	const metrics = await deps.list("metric_results", runId);
	const audit = runTruthEngineAudit(compareMetricRows(metrics.map((m) => ({
		metric_code: String(m["metric_code"] ?? ""),
		p1_value: m["p1_value"],
		p2_value: m["p2_value"],
		p1_treatment: m["p1_treatment"],
		p2_treatment: m["p2_treatment"]
	}))), match.player1_name, match.player2_name);
	const now = deps.now().toISOString();
	let classified = 0;
	for (const row of rows.filter((r) => ![
		"COMPLETE",
		"UNAVAILABLE",
		"EXCLUDED"
	].includes(String(r["status"])))) {
		const mapped = underdogRowPatch(row["pathway_code"], String(row["player_side"] ?? ""), audit, match.player1_name, match.player2_name, now);
		await deps.update("underdog_results", String(row["id"]), mapped.patch);
		if (String(mapped.patch["status"]) === "COMPLETE") classified++;
	}
	const after = await deps.list("underdog_results", runId), done = after.filter((r) => [
		"COMPLETE",
		"UNAVAILABLE",
		"EXCLUDED"
	].includes(String(r["status"]))).length;
	return done === after.length ? {
		status: "COMPLETE",
		done,
		total: after.length,
		detail: {
			evidence_backed_pathways: audit.underdog.pathways.length,
			overall_viability: audit.underdog.overall_viability,
			rows_classified: classified,
			pathways_without_persisted_row: unmappedUnderdogPathways(audit)
		}
	} : {
		status: "BLOCKED",
		done,
		total: after.length,
		errorCode: "UNDERDOG_INCOMPLETE",
		message: `${after.length - done} pathways unexecuted.`
	};
}
async function executeStress(deps, matchId, runId) {
	const match = await deps.getMatch(matchId);
	if (!match) throw new Error("match disappeared");
	const rows = await deps.list("stress_results", runId);
	if (!rows.length) return {
		status: "FAILED",
		done: 0,
		total: 0,
		errorCode: "MISSING_DEFINITIONS",
		message: "No stress tests instantiated."
	};
	const metrics = await deps.list("metric_results", runId);
	const audit = runTruthEngineAudit(compareMetricRows(metrics.map((m) => ({
		metric_code: String(m["metric_code"] ?? ""),
		p1_value: m["p1_value"],
		p2_value: m["p2_value"],
		p1_treatment: m["p1_treatment"],
		p2_treatment: m["p2_treatment"]
	}))), match.player1_name, match.player2_name);
	const now = deps.now().toISOString();
	const matrixDerivedUsed = metrics.filter((m) => m["matrix_derived"] === true && m["status"] === "COMPLETE").length;
	const pending = rows.filter((r) => ![
		"COMPLETE",
		"UNAVAILABLE",
		"EXCLUDED"
	].includes(String(r["status"])));
	let recomputed = 0;
	for (const row of pending) {
		const code = String(row["test_code"] ?? "");
		if (code === "ST01" || code === "ST02") {
			await deps.update("stress_results", String(row["id"]), {
				winner_before: audit.stress.winner_before === "INSUFFICIENT_EVIDENCE" ? null : audit.stress.winner_before,
				winner_after: matrixDerivedUsed === 0 ? audit.stress.winner_before === "INSUFFICIENT_EVIDENCE" ? null : audit.stress.winner_before : null,
				range_before: null,
				range_after: null,
				outcome: matrixDerivedUsed === 0 ? "STABLE" : "UNSTABLE",
				status: "COMPLETE",
				unavailable_detail: `Matrix-derived metrics consumed by the independent audit: ${matrixDerivedUsed}.`,
				retrieved_at: now
			});
			recomputed++;
			continue;
		}
		const mapped = stressRowPatch(code, audit, now);
		await deps.update("stress_results", String(row["id"]), mapped.patch);
		if (mapped.evaluated) recomputed++;
	}
	const after = await deps.list("stress_results", runId), done = after.filter((r) => [
		"COMPLETE",
		"UNAVAILABLE",
		"EXCLUDED"
	].includes(String(r["status"]))).length;
	return done === after.length ? {
		status: "COMPLETE",
		done,
		total: after.length,
		detail: {
			winner_before: audit.stress.winner_before,
			winner_after: audit.stress.winner_after,
			changed: audit.stress.changed,
			stability: audit.stress.stability,
			recomputed_tests: recomputed
		}
	} : {
		status: "BLOCKED",
		done,
		total: after.length,
		errorCode: "STRESS_INCOMPLETE",
		message: `${after.length - done} stress tests unexecuted.`
	};
}
/**
* DETERMINISTIC INDEPENDENT CONCLUSION (docs/audit-truth-engine-decision-core.md).
*
* The Truth Engine's winner is derived from the persisted metric evidence -- reproducible,
* inspectable, identical on every re-run -- and then audited by the deterministic
* Verification, Disagreement, Underdog and Stress layers. A selection that does not survive
* its own adverse-case recomputation is refused rather than asserted. When the evidence does
* not support a side this returns no winner WITH the reason, rather than asking a provider
* to manufacture certainty.
*/
function deterministicIndependentConclusion(metrics, p1Name, p2Name) {
	const audit = runTruthEngineAudit(compareMetricRows(metrics.map((m) => ({
		metric_code: String(m["metric_code"] ?? ""),
		p1_value: m["p1_value"],
		p2_value: m["p2_value"],
		p1_treatment: m["p1_treatment"],
		p2_treatment: m["p2_treatment"]
	}))), p1Name, p2Name);
	return {
		winner: audit.audit_winner,
		low: null,
		high: null,
		rationale: audit.audit_winner ? `${audit.final_reason} Evidence chain: ${audit.evidence_chain.join(" | ")}` : null,
		insufficient_reason: audit.audit_winner ? null : audit.final_reason,
		audit
	};
}
async function provisionalConclusion(deps, matchId, runId, evidence) {
	const [ver, dis, und] = await Promise.all([
		deps.list("verification_results", runId),
		deps.list("disagreement_results", runId),
		deps.list("underdog_results", runId)
	]);
	try {
		return await deps.research.conclusion({
			evidence,
			verificationSummary: ver.filter((r) => r["outcome"] === "FAIL" || r["outcome"] === "WARN").map((r) => `${r["rule_code"]} ${r["outcome"]}: ${r["p1_finding"] ?? ""} | ${r["p2_finding"] ?? ""}`).join("\n").slice(0, 6e3),
			disagreementSummary: dis.filter((r) => r["contradiction_severity"] && r["contradiction_severity"] !== "NONE").map((r) => `${r["rule_code"]} ${r["contradiction_severity"]}: ${r["final_effect"] ?? ""}`).join("\n").slice(0, 6e3),
			underdogSummary: und.filter((r) => r["classification"] === "STRONG" || r["classification"] === "REALISTIC").map((r) => `${r["player_side"]} ${r["pathway_name"]} ${r["classification"]}: ${r["evidence"] ?? ""}`).join("\n").slice(0, 6e3)
		});
	} catch {
		return {
			winner: null,
			low: null,
			high: null,
			rationale: null,
			insufficient_reason: "Independent conclusion unavailable because the research provider did not return a result."
		};
	}
}
async function commitConclusion(deps, matchId, runId) {
	if ((await deps.getLatestRun(matchId))?.independent_decision_committed_at) return {
		status: "COMPLETE",
		done: 1,
		total: 1
	};
	const match = await deps.getMatch(matchId);
	if (!match) throw new Error("match disappeared");
	const metrics = await deps.list("metric_results", runId), evidence = digestFrom(match, metrics);
	const deterministic = deterministicIndependentConclusion(metrics, match.player1_name, match.player2_name);
	let conclusion = deterministic;
	if (deterministic.winner) try {
		const narrated = await provisionalConclusion(deps, matchId, runId, evidence);
		if (narrated?.rationale) conclusion = {
			...deterministic,
			rationale: `${deterministic.rationale} Provider narrative: ${narrated.rationale}`
		};
	} catch {}
	const families = new Set(deterministic.audit.decision.independent_support_families);
	if (!conclusion.winner) {
		await deps.updateRun(runId, {
			independent_decision_committed_at: deps.now().toISOString(),
			effective_evidence_count: families.size,
			raw_signal_count: metrics.filter((m) => m["status"] === "COMPLETE").length
		});
		return {
			status: "COMPLETE",
			done: 1,
			total: 1,
			detail: {
				winner: null,
				families: families.size,
				insufficient_reason: conclusion.insufficient_reason ?? "Independent evidence was insufficient to commit a conclusion."
			}
		};
	}
	const winnerId = resolveWinnerId(deterministic.audit.decision.outcome, match);
	if (winnerId !== null && winnerId !== match.player1_id && winnerId !== match.player2_id) throw new Error(`Winner identity integrity violation: resolved id ${winnerId} matches neither player1_id nor player2_id for match ${matchId}.`);
	await deps.updateRun(runId, {
		independent_winner: conclusion.winner,
		independent_winner_id: winnerId,
		independent_low: conclusion.low,
		independent_high: conclusion.high,
		independent_decision_committed_at: deps.now().toISOString(),
		effective_evidence_count: families.size,
		raw_signal_count: metrics.filter((m) => m["status"] === "COMPLETE").length
	});
	return {
		status: "COMPLETE",
		done: 1,
		total: 1,
		detail: {
			winner: conclusion.winner,
			winner_id: winnerId,
			families: families.size,
			rationale: conclusion.rationale?.slice(0, 500) ?? null
		}
	};
}
async function revealMatrix(deps, matchId, runId) {
	const run = await deps.getLatestRun(matchId);
	if (!run?.independent_decision_committed_at) return {
		status: "BLOCKED",
		done: 0,
		total: 1,
		errorCode: "FIREWALL",
		message: "Matrix stays sealed until the independent conclusion is committed."
	};
	const fields = await deps.getParsedFields(matchId), wpRaw = fields["matrix_wp"], wp = wpRaw ? Number(String(wpRaw).replace(/[^\d.]/g, "")) : null;
	await deps.updateRun(runId, { matrix_revealed_at: deps.now().toISOString() });
	return {
		status: "COMPLETE",
		done: 1,
		total: 1,
		detail: {
			matrix_predicted_winner: fields["matrix_predicted_winner"] ?? null,
			matrix_wp: wp,
			agrees_with_independent: fields["matrix_predicted_winner"] && run.independent_winner ? fields["matrix_predicted_winner"].toLowerCase().includes(run.independent_winner.split(" ").slice(-1)[0].toLowerCase()) : null
		}
	};
}
async function applyCalibration(deps, matchId, runId) {
	const { version, buckets } = await deps.getCalibration();
	if (!version || !buckets.length) return {
		status: "FAILED",
		done: 0,
		total: 1,
		errorCode: "NO_ACTIVE_CALIBRATION",
		message: "No active calibration version with buckets is stored."
	};
	const run = await deps.getLatestRun(matchId), wpRaw = (await deps.getParsedFields(matchId))["matrix_wp"], wp = wpRaw ? Number(String(wpRaw).replace(/[^\d.]/g, "")) : null, snapshot = buildCalibrationSnapshot({
		versionId: version.id,
		matrixWp: Number.isFinite(wp) ? wp : null,
		buckets,
		independentLow: run?.independent_low ?? null,
		independentHigh: run?.independent_high ?? null
	});
	await deps.updateRun(runId, {
		calibration_version_id: version.id,
		calibrated_low: snapshot.calibratedLow,
		calibrated_high: snapshot.calibratedHigh
	});
	return {
		status: "COMPLETE",
		done: 1,
		total: 1,
		detail: {
			calibration_version: version.label,
			version_number: version.version_number,
			bucket: snapshot.bucketCode,
			verified_win_rate: snapshot.verifiedWinRate,
			bucket_wins: snapshot.bucketWins,
			bucket_graded: snapshot.bucketGraded
		}
	};
}
async function requireUpstreamComplete(deps, runId, stage) {
	const stages = await deps.getStages(runId);
	return unmetDependencies(stage, stages);
}
async function persistCoverage(deps, matchId, runId) {
	const missingUpstream = await requireUpstreamComplete(deps, runId, "COVERAGE PERSISTENCE / EVIDENCE VALIDATION");
	if (missingUpstream.length) return {
		status: "BLOCKED",
		done: 0,
		total: 1,
		errorCode: "UPSTREAM_DEPENDENCY_INCOMPLETE",
		message: `Coverage Persistence / Evidence Validation blocked: upstream stage(s) not complete: ${missingUpstream.join(", ")}.`
	};
	const report = await buildReport(deps, matchId, runId);
	await deps.saveCoverage(runId, [{
		player_side: "P1",
		...report.coverage.p1,
		usablePercent: report.coverage.usablePercent
	}, {
		player_side: "P2",
		...report.coverage.p2,
		usablePercent: report.coverage.usablePercent
	}]);
	await deps.saveCoverageRates(runId, [{
		player_side: "P1",
		metric_family: "ALL",
		direct_count: report.coverage.p1.direct,
		reconstructed_count: report.coverage.p1.reconstructed,
		partial_count: report.coverage.p1.partial,
		unavailable_count: report.coverage.p1.unavailable,
		excluded_count: report.coverage.p1.excluded,
		total_count: report.coverage.p1.total,
		usable_percent: report.coverage.p1.usablePercent
	}, {
		player_side: "P2",
		metric_family: "ALL",
		direct_count: report.coverage.p2.direct,
		reconstructed_count: report.coverage.p2.reconstructed,
		partial_count: report.coverage.p2.partial,
		unavailable_count: report.coverage.p2.unavailable,
		excluded_count: report.coverage.p2.excluded,
		total_count: report.coverage.p2.total,
		usable_percent: report.coverage.p2.usablePercent
	}]);
	return {
		status: "COMPLETE",
		done: 1,
		total: 1,
		detail: {
			evidence_coverage: report.coverage.usablePercent,
			p1_total: report.coverage.p1.total,
			p2_total: report.coverage.p2.total
		}
	};
}
async function commitFinalDecision(deps, matchId, runId) {
	const missingUpstream = await requireUpstreamComplete(deps, runId, "FINAL DECISION");
	if (missingUpstream.length) return {
		status: "BLOCKED",
		done: 0,
		total: 1,
		errorCode: "UPSTREAM_DEPENDENCY_INCOMPLETE",
		message: `Final Decision blocked: upstream stage(s) not complete: ${missingUpstream.join(", ")}.`
	};
	const report = await buildReport(deps, matchId, runId);
	const run = await deps.getLatestRun(matchId), wpRaw = (await deps.getParsedFields(matchId))["matrix_wp"], wp = wpRaw ? Number(String(wpRaw).replace(/[^\d.]/g, "")) : null, { version, buckets } = await deps.getCalibration(run?.calibration_version_id ?? null), snapshot = buildCalibrationSnapshot({
		versionId: version?.id ?? run?.calibration_version_id ?? null,
		matrixWp: Number.isFinite(wp) ? wp : null,
		buckets,
		independentLow: run?.independent_low ?? null,
		independentHigh: run?.independent_high ?? null
	}), existing = await deps.getDecisionId(runId);
	const decisionMetrics = await deps.list("metric_results", runId);
	const decisionMatch = await deps.getMatch(matchId);
	const freshDeterministic = decisionMatch ? deterministicIndependentConclusion(decisionMetrics, decisionMatch.player1_name, decisionMatch.player2_name) : null;
	if (freshDeterministic && freshDeterministic.winner !== (run?.independent_winner ?? null)) return {
		status: "BLOCKED",
		done: 0,
		total: 1,
		errorCode: "WINNER_INTEGRITY_MISMATCH",
		message: `Final Decision blocked: the committed Independent Conclusion winner (${run?.independent_winner ?? "none"}) no longer matches what the current metric evidence deterministically supports (${freshDeterministic.winner ?? "none"}). Evidence changed after Independent Conclusion was committed; this run requires a fresh audit rather than a silently divergent Final Decision.`
	};
	const committedWinnerId = run?.independent_winner_id ?? null;
	if (decisionMatch && committedWinnerId !== null && committedWinnerId !== decisionMatch.player1_id && committedWinnerId !== decisionMatch.player2_id) return {
		status: "BLOCKED",
		done: 0,
		total: 1,
		errorCode: "WINNER_IDENTITY_INTEGRITY_VIOLATION",
		message: `Final Decision blocked: the committed independent_winner_id (${committedWinnerId}) does not match either player1_id or player2_id on match ${matchId}.`
	};
	const decisionRecord = decisionMatch ? buildDecisionRecord({
		audit: freshDeterministic.audit,
		metricRows: decisionMetrics.map((m) => ({
			metric_code: String(m["metric_code"] ?? ""),
			p1_treatment: m["p1_treatment"],
			p2_treatment: m["p2_treatment"],
			p1_value: m["p1_value"],
			p2_value: m["p2_value"],
			p1_unavailable_reason: m["p1_unavailable_reason"],
			p2_unavailable_reason: m["p2_unavailable_reason"]
		})),
		now: deps.now(),
		actualWinner: decisionMatch.actual_winner ?? null
	}) : null;
	await deps.saveDecision(runId, existing, {
		gate_report: decisionRecord ? { deterministic_decision: decisionRecord } : {},
		final_audit_color: report.color,
		final_recommendation: report.action,
		final_selection: run?.independent_winner ?? null,
		selected_player_id: committedWinnerId,
		completion_percent: report.completionPercent,
		audit_complete: report.auditComplete,
		independent_winner: run?.independent_winner ?? null,
		independent_range: run?.independent_low !== null && run?.independent_high !== null ? `${run?.independent_low}-${run?.independent_high}` : null,
		calibrated_range: snapshot.calibratedLow !== null && snapshot.calibratedHigh !== null ? `${snapshot.calibratedLow}-${snapshot.calibratedHigh}` : null,
		calibration_version_id: snapshot.calibrationVersionId,
		calibration_bucket: snapshot.bucketCode,
		verified_win_rate: snapshot.verifiedWinRate,
		calibration_wins: snapshot.bucketWins,
		calibration_graded: snapshot.bucketGraded,
		green_locked: report.greenLocked,
		green_lock_reasons: report.greenLockReasons,
		matrix_firewall_valid: report.matrixFirewallValid
	});
	if (!await deps.getDecisionId(runId)) throw new Error("Final decision persistence invariant failed: no decision row exists after save.");
	if (deps.verifyFinalPersistence) await deps.verifyFinalPersistence(runId, report.coverage.p1.total + report.coverage.p2.total, report.auditComplete);
	const detail = {
		color: report.color,
		action: report.action,
		completion_percent: report.completionPercent,
		evidence_coverage: report.coverage.usablePercent,
		calibration_version_id: snapshot.calibrationVersionId,
		calibration_bucket: snapshot.bucketCode,
		verified_win_rate: snapshot.verifiedWinRate
	};
	if (!report.auditComplete) return {
		status: "BLOCKED",
		done: 0,
		total: 1,
		errorCode: "COMPLETION_INVARIANT_FAILED",
		message: `Final decision persisted but the audit is incomplete (${report.completionPercent}% checks; ${report.coverage.usablePercent}% supported evidence coverage).`,
		detail
	};
	return {
		status: "COMPLETE",
		done: 1,
		total: 1,
		detail
	};
}
async function finalGate(deps, matchId, runId) {
	const missingUpstream = await requireUpstreamComplete(deps, runId, "FINAL COMBINATION GATE");
	if (missingUpstream.length) return {
		status: "BLOCKED",
		done: 0,
		total: 1,
		errorCode: "UPSTREAM_DEPENDENCY_INCOMPLETE",
		message: `Final Combination Gate blocked: upstream stage(s) not complete: ${missingUpstream.join(", ")}.`
	};
	const report = await buildReport(deps, matchId, runId);
	const detail = {
		color: report.color,
		action: report.action,
		completion_percent: report.completionPercent,
		evidence_coverage: report.coverage.usablePercent,
		stage_gaps: report.stageGaps
	};
	if (!report.auditComplete || !report.stagesComplete) return {
		status: "BLOCKED",
		done: 0,
		total: 1,
		errorCode: "COMPLETION_INVARIANT_FAILED",
		message: `Final Combination Gate blocked: audit ${report.auditComplete ? "substantively complete" : "not substantively complete"}, stages ${report.stagesComplete ? "all persisted COMPLETE" : `still pending: ${report.stageGaps.join(", ")}`}.`,
		detail
	};
	return {
		status: "COMPLETE",
		done: 1,
		total: 1,
		detail
	};
}
async function buildReport(deps, matchId, runId) {
	const match = await deps.getMatch(matchId), run = await deps.getLatestRun(matchId);
	if (!match || !run) throw new Error("match/run missing while building report");
	const [metrics, verification, disagreement, underdog, stress, conflicts, reconstructions, stages] = await Promise.all([
		deps.list("metric_results", runId),
		deps.list("verification_results", runId),
		deps.list("disagreement_results", runId),
		deps.list("underdog_results", runId),
		deps.list("stress_results", runId),
		deps.getConflicts(runId),
		deps.getReconstructions(runId),
		deps.getStages(runId)
	]);
	const wpRaw = (await deps.getParsedFields(matchId))["matrix_wp"], matrixWp = wpRaw ? Number(String(wpRaw).replace(/[^\d.]/g, "")) : null;
	return evaluate({
		match,
		run,
		metrics,
		verification,
		disagreement,
		underdog,
		stress,
		reconstructions,
		conflicts,
		matrixWp,
		stages: stages.map((row) => ({
			stage: row.stage,
			status: row.status
		}))
	});
}
async function pipelineResult(deps, matchId, runId, rows, failures, nextStage, leaseHeld = false) {
	const complete = STAGES.every((stage) => rows.find((row) => row.stage === stage)?.status === "COMPLETE");
	return {
		runId,
		complete,
		nextStage: complete ? null : nextStage ?? STAGES.find((stage) => rows.find((row) => row.stage === stage)?.status !== "COMPLETE") ?? null,
		stages: stageDetails(rows),
		report: await buildReport(deps, matchId, runId),
		failures,
		leaseHeld
	};
}
//#endregion
export { INVALIDATED_RUN_STATUS, STAGES, STAGE_DEPENDENCIES, TREATMENTS, claimRetrievalForExecutingSideOnly, deterministicIndependentConclusion, enforceStageDependencies, isActiveRunStatus, metricPairPatch, metricRowsForSideExecution, pass2WriteBackPatch, preparePipelineRun, preserveSettledOppositeSide, preserveUsableCurrentSide, resolveActiveRun, resolveWinnerId, runPipeline, unmetDependencies };
