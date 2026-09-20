// TRUTH ENGINE — DETERMINISTIC FINAL SELECTION
//
// Turns per-metric P1/P2 comparisons (truth-engine-metric-comparison.ts) into a
// defensible selection, or an explicit refusal. Pure: no DB, no network, no AI.
//
// This is deliberately NOT "the player with the most metrics wins":
//
//  * ANTI-DOUBLE-COUNTING. Correlated metrics are grouped into evidence FAMILIES and a
//    family votes exactly ONCE. Five agreeing metrics drawn from the same shared-opponent
//    pool are one piece of independent evidence, not five. A family whose own members
//    disagree is INTERNALLY_CONFLICTED and votes for nobody.
//
//  * INDEPENDENT SUPPORT AND INDEPENDENT CONTRADICTION are counted separately, so "one
//    dissent" cannot silently cancel a broad, genuinely independent consensus, and a
//    narrow consensus cannot bury a strong contradiction.
//
//  * LEAVE-ONE-FAMILY-OUT (LOFO) STABILITY is a real recomputation: the selection is
//    re-derived with each family removed in turn. If removing any single family flips the
//    leader, the result is FRAGILE and cannot be reported as a strong selection. This is
//    the stress test actually recalculating a decision input, not relabelling one.
//
//  * REFUSAL IS A FIRST-CLASS OUTCOME. Insufficient independent families, a tie, or a
//    contradiction that outweighs support all yield INSUFFICIENT_EVIDENCE with the reason
//    stated. Certainty is never forced.
//
// UNAVAILABLE comparisons are simply absent from every count. They are never zero, never
// neutral-in-favour-of-anyone, and never evidence for the side that does have data.

import type { ComparisonFavours, MetricComparison } from "./truth-engine-metric-comparison";
import { isActiveMetricCode } from "./truth-engine-active-metrics";

export type FamilyVote = "P1" | "P2" | "NEUTRAL" | "INTERNALLY_CONFLICTED";
export type SelectionOutcome = "P1" | "P2" | "INSUFFICIENT_EVIDENCE";
export type SelectionStability = "ROBUST" | "STABLE" | "FRAGILE" | "NOT_APPLICABLE";

/** A family must contain at least this many usable comparisons to vote at all. */
export const MIN_COMPARISONS_PER_FAMILY = 1;
/**
 * Corroboration reference level, NOT a gate.
 *
 * This was previously a hard refusal: a leader supported by fewer than two independent
 * families could never be selected. The product rule is now a threshold on the evidence
 * share (EVIDENCE_SELECTION_THRESHOLD below), so a single-family lead is selectable when
 * the directional evidence clears it. The constant is retained because "how many
 * independent families corroborate this" is still worth reporting, and it now annotates
 * the decision (`corroborated`) instead of blocking it.
 */
export const MIN_INDEPENDENT_SUPPORT_FAMILIES = 2;

/**
 * The product's minimum selection threshold: 60% of the DIRECTIONAL evidence must favour
 * one player before that player is selected.
 *
 * "Directional" means families that actually expressed an opinion — those voting for a
 * player, plus INTERNALLY_CONFLICTED families (which contain genuine opposing evidence and
 * therefore count against the leader's share). NEUTRAL families are excluded from the
 * ratio: a family that measured both players and found no material difference is evidence
 * of parity, not evidence for or against either side, so it can neither raise nor lower
 * one player's share of the directional evidence. They are still reported.
 *
 * UNAVAILABLE never enters this calculation at any point. A metric with no usable evidence
 * forms no comparison, joins no family, and is absent from both numerator and denominator —
 * it is never treated as evidence against the player who lacks it.
 */
export const EVIDENCE_SELECTION_THRESHOLD = 60;

export interface FamilyEvidence {
  family: string;
  vote: FamilyVote;
  supporting_metrics: string[];
  opposing_metrics: string[];
  neutral_metrics: string[];
  /** Every compared metric in this family, for the evidence chain. */
  comparisons: MetricComparison[];
  /** Bounded directional mass. A family is normalized by its member count. */
  weighted_p1: number;
  weighted_p2: number;
  family_weight: number;
  weighted_balance: number;
  internally_contradictory: boolean;
}

export interface TruthEngineDecision {
  outcome: SelectionOutcome;
  /** Resolved player name for the selected side, when a side was selected. */
  selected_player: string | null;
  stability: SelectionStability;
  /**
   * Share of the DIRECTIONAL evidence favouring the leader, 0-100. Denominator is
   * supporting + contradicting + internally-conflicted families; NEUTRAL families and
   * UNAVAILABLE metrics are excluded. This is the quantity the 60% product threshold is
   * applied to, and it is reported for refusals too so a near-miss is visible.
   */
  evidence_percent: number;
  /** Families that expressed a direction -- the denominator of evidence_percent. */
  directional_families: number;
  /** True when at least MIN_INDEPENDENT_SUPPORT_FAMILIES independent families agree. */
  corroborated: boolean;
  /** Families voting for the winning side (each counted once). */
  independent_support_families: string[];
  /** Families voting for the losing side -- genuine independent contradictions. */
  independent_contradiction_families: string[];
  neutral_families: string[];
  conflicted_families: string[];
  /**
   * Families whose removal REVERSES the leader (the other player then leads). A true
   * reversal means the call is contradicted, not merely thin -> the selection is refused.
   */
  flipping_families: string[];
  /**
   * Families whose removal leaves no leader at all (a tie) without reversing it. This is
   * thin evidence, not contradicted evidence, and is reported rather than treated as a
   * reversal -- conflating the two would make any 2-1 family lead permanently unselectable.
   */
  tie_inducing_families: string[];
  /** Metrics that could not be compared at all, with the reason each was excluded. */
  unavailable: Array<{ metric_code: string; status: string; reason: string }>;
  /** Duplicated (same-family) support that was deliberately NOT counted again. */
  duplicated_support_metrics: string[];
  duplicated_contradiction_metrics: string[];
  families: FamilyEvidence[];
  reason: string;
  evidence_chain: string[];
  /** Completeness describes how much usable evidence was observed; it is not sufficiency. */
  evidence_completeness: number;
  evidence_completeness_percent: number;
  evidence_completeness_status: "NONE" | "PARTIAL" | "COMPLETE";
  sufficiency_status: "INSUFFICIENT" | "SUFFICIENT";
  sufficiency_tier: "NONE" | "RECOVERABLE" | "SUFFICIENT" | "ROBUST";
  weighted_score_p1: number;
  weighted_score_p2: number;
  weighted_balance: number;
  weighted_evidence_percent: number;
  usable_count_p1: number;
  usable_count_p2: number;
  quality_counts: { direct: number; reconstructed: number; partial: number; unknown_reliability: number; low_reliability: number };
  family_support_details: Array<{ family: string; support_p1: number; support_p2: number; weight: number; contradiction: boolean }>;
  contradiction: { independent_families: string[]; conflicted_families: string[]; weighted_mass: number };
  ablation_robustness: {
    weakest_metric: string | null;
    weakest_metric_outcome: SelectionOutcome;
    reconstructed_outcome: SelectionOutcome;
    correlated_outcome: SelectionOutcome;
    family_outcomes: Array<{ family: string; outcome: SelectionOutcome }>;
    fragile: boolean;
  };
}

function metricWeight(c: MetricComparison): number {
  // Forged/legacy comparisons did not carry the additive weight field. Keeping
  // their old unit weight is backwards compatible while real projections use
  // the bounded quality-aware weight.
  return c.evidence_weight === null || c.evidence_weight === undefined ? 1 : Math.max(0, Math.min(1, c.evidence_weight));
}

function voteFor(comparisons: MetricComparison[]): { vote: FamilyVote; supporting: string[]; opposing: string[]; neutral: string[]; p1: number; p2: number } {
  const p1 = comparisons.filter((c) => c.favours === "P1").map((c) => c.metric_code);
  const p2 = comparisons.filter((c) => c.favours === "P2").map((c) => c.metric_code);
  const neutral = comparisons.filter((c) => c.favours === "NEUTRAL").map((c) => c.metric_code);
  const denominator = Math.max(1, comparisons.length);
  const p1Mass = comparisons.filter((c) => c.favours === "P1").reduce((sum, c) => sum + metricWeight(c), 0) / denominator;
  const p2Mass = comparisons.filter((c) => c.favours === "P2").reduce((sum, c) => sum + metricWeight(c), 0) / denominator;
  const internallyContradictory = p1.length > 0 && p2.length > 0;
  // A family whose own metrics disagree votes for nobody, full stop -- this is the
  // anti-double-counting invariant this module exists to enforce (see the file header), and
  // it does not relax as the metrics' weighted masses drift apart. Gating it on an exact
  // p1Mass === p2Mass tie (as a prior revision did) made it fire only when two DIFFERENT
  // metrics' independently-derived quality weights happened to coincide to the sixth decimal
  // place -- effectively never -- so a family with two genuinely opposing metrics would
  // silently cast a directional vote for whichever one was fractionally heavier instead of
  // being reported as conflicted. Internal disagreement is a fact about direction, not
  // magnitude: it must always poison the family, exactly as `internally_contradictory` (the
  // reported field below) already says it does.
  const vote: FamilyVote = internallyContradictory
    ? "INTERNALLY_CONFLICTED"
    : p1Mass > p2Mass ? "P1" : p2Mass > p1Mass ? "P2" : "NEUTRAL";
  return { vote, supporting: p1, opposing: p2, neutral, p1: p1Mass, p2: p2Mass };
}

function buildFamilies(comparisons: MetricComparison[]): FamilyEvidence[] {
  const byFamily = new Map<string, MetricComparison[]>();
  for (const c of comparisons) {
    if (c.status !== "COMPARED" || !c.family) continue;
    byFamily.set(c.family, [...(byFamily.get(c.family) ?? []), c]);
  }
  return [...byFamily.entries()]
    .filter(([, rows]) => rows.length >= MIN_COMPARISONS_PER_FAMILY)
    .map(([family, rows]) => {
      const { vote, supporting, opposing, neutral, p1, p2 } = voteFor(rows);
      return {
        family, vote, supporting_metrics: supporting, opposing_metrics: opposing,
        neutral_metrics: neutral, comparisons: rows, weighted_p1: p1, weighted_p2: p2,
        family_weight: Math.min(1, p1 + p2), weighted_balance: Number((p1 - p2).toFixed(6)),
        internally_contradictory: supporting.length > 0 && opposing.length > 0,
      };
    })
    .sort((a, b) => a.family.localeCompare(b.family));
}

/** Leader from bounded family mass; correlated rows cannot accumulate by count. */
function leaderOf(families: FamilyEvidence[]): { leader: "P1" | "P2" | null; p1: number; p2: number } {
  const p1 = Number(families.reduce((sum, f) => sum + f.weighted_p1, 0).toFixed(6));
  const p2 = Number(families.reduce((sum, f) => sum + f.weighted_p2, 0).toFixed(6));
  if (Math.abs(p1 - p2) < 1e-9) return { leader: null, p1, p2 };
  return { leader: p1 > p2 ? "P1" : "P2", p1, p2 };
}

export interface DecisionInput {
  comparisons: MetricComparison[];
  p1Name: string;
  p2Name: string;
}

function outcomeFromFamilies(families: FamilyEvidence[]): SelectionOutcome {
  const leader = leaderOf(families).leader;
  return leader ?? "INSUFFICIENT_EVIDENCE";
}

export function decideTruthEngineSelection({ comparisons, p1Name, p2Name }: DecisionInput): TruthEngineDecision {
  // Defense in depth: in the real pipeline every MetricComparison[] passed here already
  // came from compareMetricRows, which can structurally never mark an inactive (no-spec)
  // code "COMPARED" (see truth-engine-metric-comparison.ts). This second, independent
  // filter on the FAMILIES input means that guarantee doesn't rest on every future caller
  // routing through compareMetricRows correctly -- an inactive code can never become voting
  // evidence here even if handed a forged/malformed comparison that claims to be
  // "COMPARED". `unavailable` deliberately still lists every excluded code, active or not
  // (with its real reason, NO_COMPARISON_SPEC for an inactive one) -- that diagnostic
  // transparency is what proves an inactive code was seen and correctly excluded, not
  // silently dropped.
  const families = buildFamilies(comparisons.filter((c) => isActiveMetricCode(c.metric_code)));
  const unavailable = comparisons
    .filter((c) => c.status !== "COMPARED")
    .map((c) => ({ metric_code: c.metric_code, status: c.status, reason: c.reason }));

  // Same-family agreement beyond the first metric is duplicated, not independent.
  const duplicatedSupport: string[] = [];
  const duplicatedContradiction: string[] = [];

  const base = leaderOf(families);
  const neutralFamilies = families.filter((f) => f.vote === "NEUTRAL").map((f) => f.family);
  const conflictedFamilies = families.filter((f) => f.vote === "INTERNALLY_CONFLICTED").map((f) => f.family);

  const usableP1 = comparisons.filter((c) => c.p1_number !== null).length;
  const usableP2 = comparisons.filter((c) => c.p2_number !== null).length;
  const qualityCounts = {
    direct: comparisons.filter((c) => c.treatment_quality_p1 === 1 && c.treatment_quality_p2 === 1).length,
    reconstructed: comparisons.filter((c) => c.treatment_quality_p1 === 0.8 || c.treatment_quality_p2 === 0.8).length,
    partial: comparisons.filter((c) => c.treatment_quality_p1 === 0.6 || c.treatment_quality_p2 === 0.6).length,
    unknown_reliability: comparisons.filter((c) => c.normalized_reliability === null).length,
    low_reliability: comparisons.filter((c) => c.normalized_reliability !== null && c.normalized_reliability < 0.5).length,
  };
  const comparedCount = comparisons.filter((c) => c.status === "COMPARED").length;
  const activeCount = comparisons.filter((c) => isActiveMetricCode(c.metric_code)).length;
  const completeness = activeCount > 0 ? (comparedCount / activeCount) * 100 : 0;

  // Share of directional evidence FAMILIES (a corroboration/breadth measure), not of their
  // combined quality mass. Per-family magnitude (weighted_p1/weighted_p2) already decided
  // each family's own vote and decides the LEADER itself (leaderOf, above) -- it must not
  // also decide how broad that leader's corroboration looks, or one exceptionally strong
  // single metric could manufacture a "broadly supported" reading that a genuinely wide,
  // independent family count would never produce; that is exactly the "no side can win on
  // magnitude what it lacks in independent corroboration" gate MIN_INDEPENDENT_SUPPORT_
  // FAMILIES/EVIDENCE_SELECTION_THRESHOLD document. NEUTRAL families are excluded (parity is
  // evidence for neither side); INTERNALLY_CONFLICTED families are counted in the
  // denominator only -- they contain genuine opposing evidence and so dilute the leader's
  // share, but (per independent_contradiction_families, which never lists them) are never
  // credited to either side's numerator.
  // `rawPercent` is the exact share and is what the 60% threshold below compares against.
  // `percent` (rounded to 1 decimal) is for display/persistence only. Rounding before
  // comparing would let a raw 59.95% round up to "60.0" and incorrectly clear the gate -- the
  // threshold check must see the real value, not its display form.
  const evidenceShare = (support: string[], contra: string[]) => {
    const directionalFamilies = families.filter((f) => f.weighted_p1 > 0 || f.weighted_p2 > 0);
    const p1Mass = directionalFamilies.reduce((sum, f) => sum + f.weighted_p1, 0);
    const p2Mass = directionalFamilies.reduce((sum, f) => sum + f.weighted_p2, 0);
    const rawPercent = directionalFamilies.length > 0 ? (support.length / directionalFamilies.length) * 100 : 0;
    return {
      directional: directionalFamilies.length,
      rawPercent,
      percent: directionalFamilies.length > 0 ? Number(rawPercent.toFixed(1)) : 0,
      p1Mass, p2Mass,
    };
  };

  const shell = (outcome: SelectionOutcome, reason: string, stability: SelectionStability, support: string[] = [], contra: string[] = [], flipping: string[] = [], tieInducing: string[] = []): TruthEngineDecision => {
    const share = evidenceShare(support, contra);
    const weightedScoreP1 = Number(share.p1Mass.toFixed(6));
    const weightedScoreP2 = Number(share.p2Mass.toFixed(6));
    const weightedBalance = Number((weightedScoreP1 - weightedScoreP2).toFixed(6));
    // The TRUE quality-weighted share, distinct from evidence_percent's family-count share
    // above: how the leaning side's combined mass compares to the total directional mass.
    // This is diagnostic only -- it never gates the outcome -- but it is what lets a caller
    // see that a selection backed by three strong families is a materially stronger read
    // than one backed by three barely-above-materiality ones, even when both cross the same
    // family-count threshold.
    const weightedEvidencePercent = weightedScoreP1 + weightedScoreP2 > 0
      ? Number(((Math.max(weightedScoreP1, weightedScoreP2) / (weightedScoreP1 + weightedScoreP2)) * 100).toFixed(1))
      : 0;
    const directional = families.filter((f) => f.weighted_p1 > 0 || f.weighted_p2 > 0).length;
    const weakest = comparisons.filter((c) => c.status === "COMPARED").sort((a, b) => metricWeight(a) - metricWeight(b))[0];
    const reconstructed = comparisons.filter((c) => c.status === "COMPARED" && (c.treatment_quality_p1 === 0.8 || c.treatment_quality_p2 === 0.8));
    const correlated = families.filter((f) => f.comparisons.length > 1).flatMap((f) => f.comparisons.slice(1));
    const ablationOutcome = (removed: MetricComparison[]) => outcomeFromFamilies(buildFamilies(comparisons.filter((c) => !removed.includes(c) && isActiveMetricCode(c.metric_code))));
    const ablationFamilies = families.map((f) => ({ family: f.family, outcome: outcomeFromFamilies(families.filter((other) => other.family !== f.family)) }));
    const fragile = [weakest ? ablationOutcome([weakest]) : outcome, ablationOutcome(reconstructed), ablationOutcome(correlated)].some((candidate) => candidate !== outcome);
    return {
      outcome, selected_player: outcome === "P1" ? p1Name : outcome === "P2" ? p2Name : null, stability,
      evidence_percent: share.percent, directional_families: directional,
      corroborated: support.length >= MIN_INDEPENDENT_SUPPORT_FAMILIES,
      independent_support_families: support, independent_contradiction_families: contra,
      neutral_families: neutralFamilies, conflicted_families: conflictedFamilies,
      flipping_families: flipping, tie_inducing_families: tieInducing, unavailable,
      duplicated_support_metrics: duplicatedSupport, duplicated_contradiction_metrics: duplicatedContradiction,
      families, reason,
      evidence_chain: families.map((f) => `${f.family}: ${f.vote}${f.supporting_metrics.length ? ` (from ${f.supporting_metrics.join(", ")})` : ""}${f.opposing_metrics.length ? ` vs ${f.opposing_metrics.join(", ")}` : ""}`),
      evidence_completeness: Number((completeness / 100).toFixed(4)),
      evidence_completeness_percent: Number(completeness.toFixed(1)),
      evidence_completeness_status: completeness === 0 ? "NONE" : completeness >= 100 ? "COMPLETE" : "PARTIAL",
      sufficiency_status: outcome === "INSUFFICIENT_EVIDENCE" ? "INSUFFICIENT" : "SUFFICIENT",
      sufficiency_tier: outcome === "INSUFFICIENT_EVIDENCE" ? (families.length ? "RECOVERABLE" : "NONE") : stability === "ROBUST" ? "ROBUST" : "SUFFICIENT",
      weighted_score_p1: weightedScoreP1, weighted_score_p2: weightedScoreP2,
      weighted_balance: weightedBalance, weighted_evidence_percent: weightedEvidencePercent,
      usable_count_p1: usableP1, usable_count_p2: usableP2, quality_counts: qualityCounts,
      family_support_details: families.map((f) => ({ family: f.family, support_p1: f.weighted_p1, support_p2: f.weighted_p2, weight: f.family_weight, contradiction: f.internally_contradictory })),
      contradiction: { independent_families: contra, conflicted_families: conflictedFamilies, weighted_mass: Number(families.filter((f) => contra.includes(f.family) || f.internally_contradictory).reduce((sum, f) => sum + Math.min(f.weighted_p1, f.weighted_p2), 0).toFixed(6)) },
      ablation_robustness: { weakest_metric: weakest?.metric_code ?? null, weakest_metric_outcome: weakest ? ablationOutcome([weakest]) : outcome, reconstructed_outcome: ablationOutcome(reconstructed), correlated_outcome: ablationOutcome(correlated), family_outcomes: ablationFamilies, fragile },
    };
  };

  if (!families.length) {
    return shell("INSUFFICIENT_EVIDENCE", `No metric produced a usable two-sided comparison (${unavailable.length} metric(s) unavailable). The Truth Engine cannot select a side and does not guess.`, "NOT_APPLICABLE");
  }
  if (!base.leader) {
    // A tie is genuinely 50/50 of the directional evidence, so report it as such rather
    // than as 0% -- passing the two sides' families through gives the share its real value
    // and makes a tied refusal legible next to a below-threshold one.
    const p1Families = families.filter((f) => f.vote === "P1").map((f) => f.family);
    const p2Families = families.filter((f) => f.vote === "P2").map((f) => f.family);
    return shell(
      "INSUFFICIENT_EVIDENCE",
      `Independent evidence families are tied (${base.p1} for ${p1Name} vs ${base.p2} for ${p2Name}). Neither side reaches the ${EVIDENCE_SELECTION_THRESHOLD}% selection threshold. No side is selected.`,
      "NOT_APPLICABLE",
      p1Families,
      p2Families,
    );
  }

  const leader = base.leader;
  const support = families.filter((f) => f.vote === leader);
  const contra = families.filter((f) => f.vote !== leader && f.vote !== "NEUTRAL" && f.vote !== "INTERNALLY_CONFLICTED");
  const supportNames = support.map((f) => f.family);
  const contraNames = contra.map((f) => f.family);

  for (const f of support) duplicatedSupport.push(...f.supporting_metrics.slice(1));
  for (const f of contra) duplicatedContradiction.push(...f.supporting_metrics.slice(1));

  // THE PRODUCT THRESHOLD. A leader is selected when it holds at least
  // EVIDENCE_SELECTION_THRESHOLD of the directional evidence. This replaces the previous
  // hard "at least two independent families" refusal, which blocked selections the product
  // wants made; corroboration is now reported (`corroborated`) rather than enforced.
  //
  // Every other protection is deliberately untouched and still runs AFTER this point:
  // metrics only reach a family after clearing their own sample and materiality floors in
  // COMPARISON_SPECS, correlated metrics are still collapsed to one vote per family, a
  // family whose own members disagree still poisons itself to INTERNALLY_CONFLICTED and
  // drags this percentage down, and leave-one-family-out below can still refuse a lead
  // that a single family reverses.
  const { percent: evidencePercent, rawPercent, directional } = evidenceShare(supportNames, contraNames);
  if (rawPercent < EVIDENCE_SELECTION_THRESHOLD) {
    return shell(
      "INSUFFICIENT_EVIDENCE",
      `${leader === "P1" ? p1Name : p2Name} holds ${evidencePercent}% of the directional evidence (${supportNames.length} supporting famil${supportNames.length === 1 ? "y" : "ies"} of ${directional} directional: ${supportNames.join(", ") || "none"}${contraNames.length ? ` against ${contraNames.join(", ")}` : ""}${conflictedFamilies.length ? `, with ${conflictedFamilies.join(", ")} internally conflicted` : ""}), below the ${EVIDENCE_SELECTION_THRESHOLD}% selection threshold. No side is selected.`,
      "NOT_APPLICABLE",
      supportNames,
      contraNames,
    );
  }

  // LEAVE-ONE-FAMILY-OUT: genuinely re-derive the leader with each family removed, and
  // distinguish a REVERSAL (the other player leads -> the call is contradicted) from a
  // TIE (no leader -> the call is merely thin). Treating both as "flip" would make any
  // 2-1 family lead permanently unselectable, which would misreport thin evidence as
  // contradicted evidence.
  const flipping: string[] = [];
  const tieInducing: string[] = [];
  for (const f of families) {
    const { leader: without } = leaderOf(families.filter((other) => other.family !== f.family));
    if (without && without !== leader) flipping.push(f.family);
    else if (!without) tieInducing.push(f.family);
  }

  const selectedName = leader === "P1" ? p1Name : p2Name;

  if (flipping.length) {
    return shell(
      "INSUFFICIENT_EVIDENCE",
      `${selectedName} leads ${supportNames.length}-${contraNames.length} on independent families, but the lead does not survive leave-one-family-out: removing ${flipping.join(" or ")} REVERSES the leader. A selection that a single family can invert is reported as insufficient rather than asserted.`,
      "FRAGILE",
      supportNames,
      contraNames,
      flipping,
      tieInducing,
    );
  }

  // No single removal can hand the match to the other player. ROBUST additionally
  // requires no independent contradiction and no removal that even ties it.
  const stability: SelectionStability = contraNames.length === 0 && tieInducing.length === 0 ? "ROBUST" : "STABLE";

  return shell(
    leader,
    `${selectedName} holds ${evidencePercent}% of the directional evidence, at or above the ${EVIDENCE_SELECTION_THRESHOLD}% selection threshold: supported by ${supportNames.length} independent evidence famil${supportNames.length === 1 ? "y" : "ies"} (${supportNames.join(", ")})${contraNames.length ? ` against ${contraNames.length} independent contradiction${contraNames.length === 1 ? "" : "s"} (${contraNames.join(", ")})` : " with no independent contradiction"}${conflictedFamilies.length ? `, with ${conflictedFamilies.join(", ")} internally conflicted` : ""}; no single family's removal reverses the leader${tieInducing.length ? `, though removing ${tieInducing.join(" or ")} would leave it tied` : ""}.${supportNames.length < MIN_INDEPENDENT_SUPPORT_FAMILIES ? ` NOTE: this selection rests on a single evidence family, so it is uncorroborated by an independent second family.` : ""}${duplicatedSupport.length ? ` ${duplicatedSupport.length} same-family agreeing metric(s) were deliberately not counted again.` : ""}`,
    stability,
    supportNames,
    contraNames,
    flipping,
    tieInducing,
  );
}
