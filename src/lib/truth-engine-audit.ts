// TRUTH ENGINE — DETERMINISTIC AUDIT LAYERS
//
// Verification, Disagreement, Underdog Pathways and Stress Testing, all computed from the
// SAME evidence the decision core already derives (truth-engine-metric-comparison.ts), with
// no AI call anywhere in this file.
//
// Why: the forensic audit (docs/audit-truth-engine-decision-core.md) found all four stages
// delegated wholly to the LLM researcher. Across 405 persisted runs they produced 0
// verification findings, 0 disagreement risks, 0 classified underdog pathways and 0
// stress winner_after values -- while still reporting COMPLETE, because a stage counts as
// complete once every row is *settled*, and a provider failure settles them all UNAVAILABLE.
//
// Design rules held throughout:
//  * One source of evidence truth. Every layer reads MetricComparison[]; none re-derives
//    numbers, so no layer can disagree with another about what the evidence says.
//  * Symmetry. Nothing is computed "for P1 then assumed inverse for P2". Swapping the two
//    players swaps every output (regression-tested).
//  * Evidence families vote once. Correlated metrics never inflate support OR contradiction.
//  * UNAVAILABLE is never 0 and never a lean for the side that does have data.
//  * Severity and viability are derived from measured magnitude against each metric's own
//    declared noise floor (its materiality), never from prose and never hardcoded.

import { COMPARISON_SPECS, type MetricComparison } from "./truth-engine-metric-comparison";
import { decideTruthEngineSelection, type TruthEngineDecision, type SelectionOutcome } from "./truth-engine-decision";

export type Severity = "NONE" | "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL";
export type VerificationOutcome = "SUPPORTS_P1" | "SUPPORTS_P2" | "NEUTRAL" | "INSUFFICIENT_EVIDENCE";
export type PathwayViability = "NO_VIABLE_PATHWAY" | "POTENTIAL_PATHWAY" | "VIABLE_PATHWAY" | "STRONG_PATHWAY";
export type StressStability = "ROBUST" | "STABLE" | "FRAGILE" | "UNSTABLE" | "NOT_APPLICABLE";
export type StressSide = "P1" | "P2";

/**
 * How the two players' Stress profiles compare, read WITHOUT privileging either side.
 * Computed the same way regardless of which side happened to lead the decision core --
 * there is no `if (leader === "P1") ... else ...` branch anywhere in this file.
 *
 *  NOT_APPLICABLE         -- no selection existed before Stress; nothing to compare.
 *  BOTH_SURVIVE           -- the leader keeps its own selection even with its OWN evidence
 *                            eroded. Nothing to adjudicate; the challenger's profile does
 *                            not matter here because the leader was never actually at risk.
 *  LEADER_MORE_ROBUST     -- eroding the leader's own evidence costs it the selection, but
 *                            eroding the challenger's own evidence leaves the leader still
 *                            ahead. Of the two, the leader is the more robust.
 *  CHALLENGER_MORE_ROBUST -- eroding the challenger's own evidence STILL leaves the
 *                            challenger ahead. The challenger genuinely survives scrutiny
 *                            the leader does not -- the one state that is a real comparative
 *                            finding about the two players, not an artifact of only ever
 *                            testing the leader.
 *  NON_DISCRIMINATING     -- stressing either player hands the match to the other. The
 *                            shift is larger than the evidence separation in both
 *                            directions, so it ranks nobody.
 */
export type SymmetricStressVerdict = "NON_DISCRIMINATING" | "LEADER_MORE_ROBUST" | "CHALLENGER_MORE_ROBUST" | "BOTH_SURVIVE" | "NOT_APPLICABLE";

/**
 * One player's own Stress profile: what happens to the evidence picture when THAT side's
 * own currently-favouring evidence -- and only that -- is eroded by one noise floor per
 * metric. Computed with the identical rule for P1 and P2; nothing here is "for P1, then
 * assumed inverse for P2".
 */
export interface SideStressResult {
  side: StressSide;
  /** This side's share of the directional evidence before any erosion. */
  initial_support_percent: number;
  /** This side's share of the directional evidence after ITS OWN favouring edges are eroded. */
  stress_adjusted_support_percent: number;
  /** The full re-derived selection once this side's own evidence is eroded. */
  outcome_when_this_side_stressed: SelectionOutcome;
  support_families_before: number;
  support_families_after: number;
  /** Families that favoured this side before erosion and favour nobody after it -- genuine edge erosion. */
  families_neutralised: string[];
  /**
   * Families that favoured NOBODY before erosion and favour the opponent after it. This
   * would be directional evidence manufactured out of declared parity, not an eroded edge.
   * Always empty: the erosion below only ever touches comparisons already favouring the
   * side being stressed, so a NEUTRAL or opponent-favouring comparison can never move.
   * Retained as an explicit field (and asserted empty in tests) so the guarantee is
   * auditable, not merely implied by the implementation.
   */
  families_manufactured_for_opponent: string[];
  /**
   * Families that favoured this side before erosion and the OPPONENT after it. Always
   * empty for the same structural reason: eroding a favouring comparison by one noise
   * floor can weaken it to NEUTRAL but can never cross zero into the opponent's favour
   * (the pre-erosion advantage exceeds the floor by construction, so subtracting exactly
   * one floor cannot make it exceed the floor in the other direction).
   */
  families_flipped_to_opponent: string[];
}

/**
 * Magnitude of an observed edge expressed in units of that metric's OWN declared noise
 * floor (its materiality). A ratio of 3 means "three times larger than the smallest
 * difference this metric treats as real". This is the single derivation every severity and
 * viability judgement in this file is built on, so those judgements are measured rather
 * than asserted.
 */
export function magnitudeRatio(comparison: MetricComparison): number | null {
  const spec = COMPARISON_SPECS[comparison.metric_code];
  if (!spec || comparison.differential === null) return null;
  if (spec.materiality <= 0) return null;
  return Math.abs(comparison.differential) / spec.materiality;
}

function severityFromRatio(ratio: number | null): Severity {
  if (ratio === null || ratio <= 1) return "NONE";
  if (ratio < 2) return "MINOR";
  if (ratio < 4) return "MODERATE";
  if (ratio < 8) return "MAJOR";
  return "CRITICAL";
}

const SEVERITY_ORDER: Severity[] = ["NONE", "MINOR", "MODERATE", "MAJOR", "CRITICAL"];
function maxSeverity(values: Severity[]): Severity {
  return values.reduce<Severity>((worst, v) => (SEVERITY_ORDER.indexOf(v) > SEVERITY_ORDER.indexOf(worst) ? v : worst), "NONE");
}
function escalate(severity: Severity, steps: number): Severity {
  const index = Math.min(SEVERITY_ORDER.length - 1, SEVERITY_ORDER.indexOf(severity) + Math.max(0, steps));
  return SEVERITY_ORDER[index]!;
}

// ---------------------------------------------------------------------------
// VERIFICATION AUDIT — what does each independent evidence family actually say?
// ---------------------------------------------------------------------------

export interface VerificationFinding {
  family: string;
  outcome: VerificationOutcome;
  severity: Severity;
  /** Every metric in the family, with its own measured magnitude -- the audit trail. */
  metrics: Array<{ metric_code: string; label: string | null; p1: number | null; p2: number | null; differential: number | null; magnitude_ratio: number | null; favours: string }>;
  p1_finding: string;
  p2_finding: string;
  decision_effect: string;
}

export interface VerificationAudit {
  findings: VerificationFinding[];
  supports_p1_families: string[];
  supports_p2_families: string[];
  neutral_families: string[];
  insufficient_families: string[];
  /** Families excluded entirely because no comparison could be made. */
  unavailable_metrics: Array<{ metric_code: string; status: string; reason: string }>;
}

/**
 * Computes, per independent evidence family, what the evidence says about EACH player.
 * Both findings are produced from the family's own measured values -- P2's finding is never
 * inferred as "the opposite of P1's".
 */
export function runVerificationAudit(comparisons: MetricComparison[], p1Name: string, p2Name: string): VerificationAudit {
  const compared = comparisons.filter((c) => c.status === "COMPARED" && c.family);
  const byFamily = new Map<string, MetricComparison[]>();
  for (const c of compared) byFamily.set(c.family!, [...(byFamily.get(c.family!) ?? []), c]);

  const findings: VerificationFinding[] = [...byFamily.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([family, rows]) => {
      const p1Wins = rows.filter((r) => r.favours === "P1");
      const p2Wins = rows.filter((r) => r.favours === "P2");
      const metrics = rows.map((r) => ({ metric_code: r.metric_code, label: r.label, p1: r.p1_number, p2: r.p2_number, differential: r.differential, magnitude_ratio: magnitudeRatio(r), favours: r.favours }));

      let outcome: VerificationOutcome;
      if (p1Wins.length && p2Wins.length) outcome = "INSUFFICIENT_EVIDENCE"; // family disagrees with itself
      else if (p1Wins.length) outcome = "SUPPORTS_P1";
      else if (p2Wins.length) outcome = "SUPPORTS_P2";
      else outcome = "NEUTRAL";

      const decisive = outcome === "SUPPORTS_P1" ? p1Wins : outcome === "SUPPORTS_P2" ? p2Wins : [];
      const severity = outcome === "INSUFFICIENT_EVIDENCE" ? "NONE" : maxSeverity(decisive.map((r) => severityFromRatio(magnitudeRatio(r))));

      // Each side's finding is stated from its own measured numbers, independently.
      const describe = (side: "p1" | "p2") =>
        rows
          .map((r) => `${r.label ?? r.metric_code}=${side === "p1" ? r.p1_number : r.p2_number}`)
          .join("; ");

      return {
        family,
        outcome,
        severity,
        metrics,
        p1_finding: `${p1Name}: ${describe("p1")}`,
        p2_finding: `${p2Name}: ${describe("p2")}`,
        decision_effect:
          outcome === "SUPPORTS_P1" ? `Supports ${p1Name} (${severity} magnitude on ${decisive.map((r) => r.metric_code).join(", ")}).`
          : outcome === "SUPPORTS_P2" ? `Supports ${p2Name} (${severity} magnitude on ${decisive.map((r) => r.metric_code).join(", ")}).`
          : outcome === "NEUTRAL" ? "No material difference; this family credits neither player."
          : `Family is internally inconsistent (${p1Wins.map((r) => r.metric_code).join(", ")} favour ${p1Name}; ${p2Wins.map((r) => r.metric_code).join(", ")} favour ${p2Name}); it credits neither player.`,
      };
    });

  return {
    findings,
    supports_p1_families: findings.filter((f) => f.outcome === "SUPPORTS_P1").map((f) => f.family),
    supports_p2_families: findings.filter((f) => f.outcome === "SUPPORTS_P2").map((f) => f.family),
    neutral_families: findings.filter((f) => f.outcome === "NEUTRAL").map((f) => f.family),
    insufficient_families: findings.filter((f) => f.outcome === "INSUFFICIENT_EVIDENCE").map((f) => f.family),
    unavailable_metrics: comparisons.filter((c) => c.status !== "COMPARED").map((c) => ({ metric_code: c.metric_code, status: c.status, reason: c.reason })),
  };
}

// ---------------------------------------------------------------------------
// DISAGREEMENT AUDIT — adversarial challenge to whichever side is selected
// ---------------------------------------------------------------------------

export interface ContradictionFamily {
  family: string;
  severity: Severity;
  metrics: string[];
  evidence: string;
}

export interface DisagreementAudit {
  challenged_side: "P1" | "P2" | null;
  /** Independent families whose evidence opposes the selected side. Counted once each. */
  contradiction_families: ContradictionFamily[];
  /** Same-family duplicates deliberately NOT counted as additional contradictions. */
  duplicated_contradiction_metrics: string[];
  overall_severity: Severity;
  p1_risk: string;
  p2_risk: string;
  supporting_evidence: string;
  opposing_evidence: string;
  final_effect: string;
}

/**
 * Adversarial: given the currently selected side, this asks only "what legitimate evidence
 * argues for the OTHER player?". It never re-predicts. Severity is derived from measured
 * magnitude, then escalated by the number of INDEPENDENT contradiction families -- so five
 * correlated dissents never outrank two genuinely independent ones.
 */
export function runDisagreementAudit(comparisons: MetricComparison[], selected: "P1" | "P2" | null, p1Name: string, p2Name: string): DisagreementAudit {
  const compared = comparisons.filter((c) => c.status === "COMPARED" && c.family);
  const opposingSide = selected === "P1" ? "P2" : selected === "P2" ? "P1" : null;

  const byFamily = new Map<string, MetricComparison[]>();
  for (const c of compared) byFamily.set(c.family!, [...(byFamily.get(c.family!) ?? []), c]);

  const contradictionFamilies: ContradictionFamily[] = [];
  const duplicated: string[] = [];
  if (opposingSide) {
    for (const [family, rows] of [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const opposing = rows.filter((r) => r.favours === opposingSide);
      const supporting = rows.filter((r) => r.favours === selected);
      // A family only counts as a contradiction if it opposes on balance -- a family that
      // also supports the selection is internally conflicted, not a clean contradiction.
      if (!opposing.length || supporting.length) continue;
      contradictionFamilies.push({
        family,
        severity: maxSeverity(opposing.map((r) => severityFromRatio(magnitudeRatio(r)))),
        metrics: opposing.map((r) => r.metric_code),
        evidence: opposing.map((r) => `${r.label ?? r.metric_code}: ${p1Name}=${r.p1_number} vs ${p2Name}=${r.p2_number} (${r.differential! > 0 ? "+" : ""}${r.differential}, ${magnitudeRatio(r)?.toFixed(1)}x noise floor)`).join("; "),
      });
      duplicated.push(...opposing.slice(1).map((r) => r.metric_code));
    }
  }

  const base = maxSeverity(contradictionFamilies.map((f) => f.severity));
  // Independent breadth matters as much as depth: 2+ independent contradiction families
  // escalate the overall severity beyond the worst single family.
  const overall = contradictionFamilies.length >= 2 ? escalate(base, contradictionFamilies.length - 1) : base;

  const riskFor = (side: "P1" | "P2") => {
    if (side !== opposingSide || !contradictionFamilies.length) {
      return side === selected ? `Selected side; challenged by ${contradictionFamilies.length} independent contradiction famil${contradictionFamilies.length === 1 ? "y" : "ies"}.` : "No independent contradiction evidence found for this side.";
    }
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
    final_effect: !selected
      ? "No selection to challenge."
      : contradictionFamilies.length === 0
        ? "No independent evidence family contradicts the selection."
        : `${contradictionFamilies.length} independent contradiction famil${contradictionFamilies.length === 1 ? "y" : "ies"} (${contradictionFamilies.map((f) => f.family).join(", ")}); overall severity ${overall}.`,
  };
}

// ---------------------------------------------------------------------------
// UNDERDOG PATHWAY ENGINE — what would actually have to happen for the other player to win
// ---------------------------------------------------------------------------

/** Evidence family -> the concrete match pathway that family's advantage would express itself through. */
const FAMILY_PATHWAY: Record<string, string> = {
  SURFACE_STRENGTH: "SURFACE_ADVANTAGE",
  RECENT_FORM: "RECENT_FORM_ADVANTAGE",
  H2H_PROBABILITY: "MATCHUP_TACTICAL_ADVANTAGE",
  CLOSING_ABILITY: "FAVORITE_COLLAPSE",
  COMMON_OPPONENT: "COMMON_OPPONENT_ADVANTAGE",
  SET_PROFILE: "DECIDING_SET_PATHWAY",
  RESULTS_HISTORY: "RESULTS_HISTORY_ADVANTAGE",
};

export interface UnderdogPathway {
  pathway_type: string;
  family: string;
  viability: PathwayViability;
  supporting_metrics: string[];
  /** The measured edge that makes this pathway real rather than theoretical. */
  evidence: string;
  conditions_required: string;
  magnitude_ratio: number | null;
}

export interface UnderdogAnalysis {
  underdog_side: "P1" | "P2" | null;
  underdog_player: string | null;
  pathways: UnderdogPathway[];
  overall_viability: PathwayViability;
  reason: string;
}

function viabilityFromRatio(ratio: number | null): PathwayViability {
  if (ratio === null || ratio <= 1) return "NO_VIABLE_PATHWAY";
  if (ratio < 2) return "POTENTIAL_PATHWAY";
  if (ratio < 4) return "VIABLE_PATHWAY";
  return "STRONG_PATHWAY";
}

/**
 * A pathway exists ONLY where the non-selected player measurably leads an independent
 * evidence family. Theoretical tennis possibilities are never enumerated: if no family
 * favours the underdog, the answer is NO_VIABLE_PATHWAY, not a narrative.
 */
export function runUnderdogAnalysis(comparisons: MetricComparison[], selected: "P1" | "P2" | null, p1Name: string, p2Name: string): UnderdogAnalysis {
  const underdogSide = selected === "P1" ? "P2" : selected === "P2" ? "P1" : null;
  if (!underdogSide) {
    return { underdog_side: null, underdog_player: null, pathways: [], overall_viability: "NO_VIABLE_PATHWAY", reason: "No selection was made, so there is no non-selected player to analyse." };
  }
  const underdogPlayer = underdogSide === "P1" ? p1Name : p2Name;
  const compared = comparisons.filter((c) => c.status === "COMPARED" && c.family);

  const byFamily = new Map<string, MetricComparison[]>();
  for (const c of compared) byFamily.set(c.family!, [...(byFamily.get(c.family!) ?? []), c]);

  const pathways: UnderdogPathway[] = [];
  for (const [family, rows] of [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const favouring = rows.filter((r) => r.favours === underdogSide);
    if (!favouring.length) continue;
    const ratio = Math.max(...favouring.map((r) => magnitudeRatio(r) ?? 0));
    const viability = viabilityFromRatio(ratio);
    if (viability === "NO_VIABLE_PATHWAY") continue; // measured but immaterial -- not a pathway
    pathways.push({
      pathway_type: FAMILY_PATHWAY[family] ?? `${family}_ADVANTAGE`,
      family,
      viability,
      supporting_metrics: favouring.map((r) => r.metric_code),
      evidence: favouring.map((r) => `${r.label ?? r.metric_code}: ${underdogPlayer}=${underdogSide === "P1" ? r.p1_number : r.p2_number} vs ${underdogSide === "P1" ? r.p2_number : r.p1_number} (${(magnitudeRatio(r) ?? 0).toFixed(1)}x noise floor)`).join("; "),
      conditions_required: `${underdogPlayer} must convert the measured ${family.toLowerCase().replace(/_/g, " ")} edge into match outcomes.`,
      magnitude_ratio: Number(ratio.toFixed(3)),
    });
  }

  // Overall viability is the strongest single pathway, promoted one level when the underdog
  // holds two or more INDEPENDENT pathways (breadth, not repetition of one family).
  const order: PathwayViability[] = ["NO_VIABLE_PATHWAY", "POTENTIAL_PATHWAY", "VIABLE_PATHWAY", "STRONG_PATHWAY"];
  let overall: PathwayViability = pathways.reduce<PathwayViability>((best, p) => (order.indexOf(p.viability) > order.indexOf(best) ? p.viability : best), "NO_VIABLE_PATHWAY");
  if (pathways.length >= 2) overall = order[Math.min(order.length - 1, order.indexOf(overall) + 1)]!;

  return {
    underdog_side: underdogSide,
    underdog_player: underdogPlayer,
    pathways,
    overall_viability: overall,
    reason: pathways.length
      ? `${underdogPlayer} holds ${pathways.length} evidence-supported pathway(s): ${pathways.map((p) => `${p.pathway_type} (${p.viability})`).join(", ")}.`
      : `No independent evidence family measurably favours ${underdogPlayer}; no viable pathway exists on the available evidence.`,
  };
}

// ---------------------------------------------------------------------------
// STRESS TEST — genuinely recompute the selection under adverse/favourable assumptions
// ---------------------------------------------------------------------------

export interface StressCase {
  case_name: "BASE" | "ADVERSE" | "FAVOURABLE";
  winner: "P1" | "P2" | "INSUFFICIENT_EVIDENCE";
  support_families: number;
  contradiction_families: number;
  assumption: string;
}

export interface StressTest {
  /** Kept for the persisted ST03/ST05-07 rows: the selection under test is the pre-Stress leader. */
  winner_before: "P1" | "P2" | "INSUFFICIENT_EVIDENCE";
  winner_after: "P1" | "P2" | "INSUFFICIENT_EVIDENCE";
  /** True when eroding the LEADER's own edges alone changes the outcome. Diagnostic only --
   *  it no longer drives the refusal decision; see `comparative_robustness`. */
  changed: boolean;
  cases: StressCase[];
  stability: StressStability;
  reason: string;
  /** Each player's own Stress profile, computed by the identical rule. */
  p1: SideStressResult;
  p2: SideStressResult;
  /** The one comparative reading that can legitimately withdraw a selection. */
  comparative_robustness: SymmetricStressVerdict;
}

/**
 * Shifts a comparison's edge by `steps` multiples of that metric's OWN materiality (its
 * declared noise floor), in the direction adverse (negative) or favourable (positive) to
 * `side`, then re-derives favours from the shifted number.
 *
 * This is the principled adverse assumption: "the observed edge overstates the true edge by
 * about the amount this metric already treats as noise". It is derived from each metric's
 * existing specification, never a number invented to force a flip.
 *
 * CRITICAL: the shift is applied ONLY to comparisons that already favour `side`. A
 * comparison the engine measured as NEUTRAL, or one favouring the opponent, is left
 * completely untouched. Without this guard, shifting every comparison (the previous
 * behaviour) could push a NEUTRAL comparison -- one the engine explicitly found "both
 * players measured, no material difference" -- across the noise floor into a vote for the
 * opponent. That is not erosion of an existing edge; it is directional evidence the shift
 * manufactures out of declared parity, and no formal spec defines such a transformation.
 * Restricting the shift to `side`'s own favouring comparisons also guarantees, by
 * construction, that erosion (steps=-1) can weaken a favouring edge to NEUTRAL but can
 * never cross zero into a vote for the opponent: the pre-shift advantage already exceeds
 * one materiality unit (that is what "favours `side`" means), so subtracting exactly one
 * materiality unit cannot make it exceed a materiality unit in the opposite direction.
 */
function shiftComparisons(comparisons: MetricComparison[], side: "P1" | "P2", steps: number): MetricComparison[] {
  return comparisons.map((c) => {
    if (c.status !== "COMPARED" || c.differential === null || c.advantage_p1 === null) return c;
    if (c.favours !== side) return c;
    const spec = COMPARISON_SPECS[c.metric_code];
    if (!spec) return c;
    // Move the P1-facing advantage toward/away from the chosen side.
    const delta = spec.materiality * steps * (side === "P1" ? 1 : -1);
    const advantage = Number((c.advantage_p1 + delta).toFixed(6));
    const favours = Math.abs(advantage) <= spec.materiality ? "NEUTRAL" : advantage > 0 ? "P1" : "P2";
    return { ...c, advantage_p1: advantage, favours: favours as MetricComparison["favours"] };
  });
}

function outcomeOf(decision: TruthEngineDecision): "P1" | "P2" | "INSUFFICIENT_EVIDENCE" {
  return decision.outcome;
}

/** Share of the directional evidence held by `side` in a given (re)derived decision. */
function directionalPercent(side: StressSide, decision: TruthEngineDecision): number {
  const support = decision.families.filter((f) => f.vote === side).length;
  const contra = decision.families.filter((f) => f.vote === "P1" || f.vote === "P2").length - support;
  const conflicted = decision.families.filter((f) => f.vote === "INTERNALLY_CONFLICTED").length;
  const denominator = support + contra + conflicted;
  return denominator > 0 ? Number(((support / denominator) * 100).toFixed(1)) : 0;
}

/**
 * One side's complete Stress profile: erode ONLY that side's own currently-favouring
 * evidence by one noise floor per metric, then genuinely re-derive the full selection.
 * Called identically for P1 and P2 -- there is no leader-dependent branching here or in
 * any caller of this function.
 */
export function evaluateSideStress(comparisons: MetricComparison[], side: StressSide, p1Name: string, p2Name: string): SideStressResult {
  const base = decideTruthEngineSelection({ comparisons, p1Name, p2Name });
  const stressedComparisons = shiftComparisons(comparisons, side, -1);
  const stressed = decideTruthEngineSelection({ comparisons: stressedComparisons, p1Name, p2Name });

  const voteBefore = new Map(base.families.map((f) => [f.family, f.vote]));
  const voteAfter = new Map(stressed.families.map((f) => [f.family, f.vote]));
  const opponent: StressSide = side === "P1" ? "P2" : "P1";
  const manufactured: string[] = [];
  const neutralised: string[] = [];
  const flipped: string[] = [];
  for (const [family, was] of voteBefore) {
    const now = voteAfter.get(family);
    if (was === "NEUTRAL" && now === opponent) manufactured.push(family);
    if (was === side && now === "NEUTRAL") neutralised.push(family);
    if (was === side && now === opponent) flipped.push(family);
  }

  return {
    side,
    initial_support_percent: directionalPercent(side, base),
    stress_adjusted_support_percent: directionalPercent(side, stressed),
    outcome_when_this_side_stressed: stressed.outcome,
    support_families_before: base.families.filter((f) => f.vote === side).length,
    support_families_after: stressed.families.filter((f) => f.vote === side).length,
    families_neutralised: neutralised.sort(),
    families_manufactured_for_opponent: manufactured.sort(),
    families_flipped_to_opponent: flipped.sort(),
  };
}

/**
 * Reads the two per-side Stress profiles against each other. Neither side is privileged:
 * the same four-way comparison is applied whichever side happens to be `leader`.
 */
export function robustnessVerdict(leader: "P1" | "P2" | null, p1Stress: SideStressResult, p2Stress: SideStressResult): SymmetricStressVerdict {
  if (leader !== "P1" && leader !== "P2") return "NOT_APPLICABLE";
  const challenger: StressSide = leader === "P1" ? "P2" : "P1";
  const leaderStress = leader === "P1" ? p1Stress : p2Stress;
  const challengerStress = leader === "P1" ? p2Stress : p1Stress;
  const underOwnStress = leaderStress.outcome_when_this_side_stressed;
  const underChallengerStress = challengerStress.outcome_when_this_side_stressed;
  // The leader kept its selection even with its own edges eroded: nothing to adjudicate.
  if (underOwnStress === leader) return "BOTH_SURVIVE";
  // The challenger wins its OWN mirror case too -- it genuinely survives scrutiny the
  // leader does not, and withdrawing the leader's selection is then a real comparative
  // finding rather than an artifact of only ever testing the leader.
  if (underChallengerStress === challenger) return "CHALLENGER_MORE_ROBUST";
  // Perfect mirror: stress either player and the OTHER one wins. The shift is bigger than
  // the evidence separation in both directions, so it ranks nobody.
  if (underOwnStress === challenger && underChallengerStress === leader) return "NON_DISCRIMINATING";
  // The leader's own stress merely removes the selection, while the challenger's stress
  // leaves the leader ahead: of the two, the leader is the more robust.
  if (underChallengerStress === leader) return "LEADER_MORE_ROBUST";
  return "NON_DISCRIMINATING";
}

/**
 * Recomputes the FULL selection (family voting, leave-one-family-out and all) under each
 * case for the LEADER (kept for the persisted ST03/ST05/ST06/ST07 stress-test rows and the
 * BASE/ADVERSE/FAVOURABLE detail they carry), plus a genuine two-sided evaluation -- `p1`
 * and `p2` -- computed by the identical rule for both players via `evaluateSideStress`, and
 * `comparative_robustness`, the one honest reading of which side actually survives
 * equivalent scrutiny. `winner_after` is a real recomputation result, not a relabelling of
 * `winner_before`.
 */
export function runStressTest(comparisons: MetricComparison[], p1Name: string, p2Name: string): StressTest {
  const base = decideTruthEngineSelection({ comparisons, p1Name, p2Name });
  const before = outcomeOf(base);
  const p1Stress = evaluateSideStress(comparisons, "P1", p1Name, p2Name);
  const p2Stress = evaluateSideStress(comparisons, "P2", p1Name, p2Name);

  if (before === "INSUFFICIENT_EVIDENCE") {
    return {
      winner_before: before,
      winner_after: before,
      changed: false,
      cases: [{ case_name: "BASE", winner: before, support_families: base.independent_support_families.length, contradiction_families: base.independent_contradiction_families.length, assumption: "Observed evidence as measured." }],
      stability: "NOT_APPLICABLE",
      reason: "No selection was made, so there is nothing to stress.",
      p1: p1Stress,
      p2: p2Stress,
      comparative_robustness: "NOT_APPLICABLE",
    };
  }

  const selected: "P1" | "P2" = before;
  // ADVERSE: erode the selected player's own favouring edges by one noise floor per metric.
  const adverseComparisons = shiftComparisons(comparisons, selected, -1);
  const adverse = decideTruthEngineSelection({ comparisons: adverseComparisons, p1Name, p2Name });
  // FAVOURABLE: the mirror, for a symmetric picture of the decision surface.
  const favourableComparisons = shiftComparisons(comparisons, selected, +1);
  const favourable = decideTruthEngineSelection({ comparisons: favourableComparisons, p1Name, p2Name });

  const after = outcomeOf(adverse);
  const cases: StressCase[] = [
    { case_name: "BASE", winner: before, support_families: base.independent_support_families.length, contradiction_families: base.independent_contradiction_families.length, assumption: "Observed evidence as measured." },
    { case_name: "ADVERSE", winner: after, support_families: adverse.independent_support_families.length, contradiction_families: adverse.independent_contradiction_families.length, assumption: `The selected side's own favouring edges reduced by one metric-specific noise floor each; evidence favouring nobody or the opponent is left untouched.` },
    { case_name: "FAVOURABLE", winner: outcomeOf(favourable), support_families: favourable.independent_support_families.length, contradiction_families: favourable.independent_contradiction_families.length, assumption: "The selected side's own favouring edges widened by one metric-specific noise floor each." },
  ];

  const comparativeRobustness = robustnessVerdict(selected, p1Stress, p2Stress);
  const reversed = after !== before && after !== "INSUFFICIENT_EVIDENCE";
  const lost = after === "INSUFFICIENT_EVIDENCE";
  const stability: StressStability = reversed ? "UNSTABLE" : lost ? "FRAGILE" : base.independent_contradiction_families.length === 0 && base.stability === "ROBUST" ? "ROBUST" : "STABLE";

  return {
    winner_before: before,
    winner_after: after,
    changed: after !== before,
    cases,
    stability,
    reason: reversed
      ? `Eroding the selected side's own edges by one noise floor per metric REVERSES the winner (${before} -> ${after}). The selection is unstable.`
      : lost
        ? `Eroding the selected side's own edges by one noise floor per metric removes the selection entirely (no side retains a supported lead). Comparative robustness: ${comparativeRobustness}.`
        : `The selection survives eroding every one of its own supporting edges by one noise floor per metric (${before} retained).`,
    p1: p1Stress,
    p2: p2Stress,
    comparative_robustness: comparativeRobustness,
  };
}

// ---------------------------------------------------------------------------
// FINAL AUDIT SYNTHESIS
// ---------------------------------------------------------------------------

export interface TruthEngineAuditResult {
  audit_winner: string | null;
  audit_winner_side: "P1" | "P2" | null;
  refused: boolean;
  evidence_strength: "HIGH" | "MODERATE" | "LOW" | "NONE";
  decision: TruthEngineDecision;
  verification: VerificationAudit;
  disagreement: DisagreementAudit;
  underdog: UnderdogAnalysis;
  stress: StressTest;
  independent_evidence_families: number;
  contradiction_families: number;
  leave_one_family_out_winner: string;
  final_reason: string;
  evidence_chain: string[];
}

/**
 * The single entry point: evidence in, auditable winner (or an explicit refusal) out.
 *
 * The winner comes from the deterministic decision core. Verification, Disagreement,
 * Underdog and Stress are genuine audit layers over that same evidence -- and Stress can
 * DOWNGRADE the outcome to a refusal, but only on a genuine comparative finding: the
 * opponent demonstrably surviving the identical scrutiny the leader does not
 * (`comparative_robustness === "CHALLENGER_MORE_ROBUST"`). Eroding only the leader's own
 * evidence and treating that erosion as a verdict -- without ever subjecting the opponent
 * to the same test -- is exactly the one-sided global veto this function used to commit
 * (every prior refusal from this stage always tested the leader alone and never the
 * opponent, so the opponent was never once shown to be the more robust of the two). A
 * leader whose margin merely narrows under its own erosion, or whose evidence collapses
 * while the opponent has nothing to show for its own erosion either
 * (`LEADER_MORE_ROBUST`), or where neither side's evidence discriminates
 * (`NON_DISCRIMINATING`), or where the leader's own selection survives its own erosion
 * outright (`BOTH_SURVIVE`), all remain the leader's win: Stress narrows a margin, it does
 * not, by itself, erase a valid comparative result. No layer can invent a winner.
 */
export function runTruthEngineAudit(comparisons: MetricComparison[], p1Name: string, p2Name: string): TruthEngineAuditResult {
  const decision = decideTruthEngineSelection({ comparisons, p1Name, p2Name });
  const selected = decision.outcome === "INSUFFICIENT_EVIDENCE" ? null : decision.outcome;
  const verification = runVerificationAudit(comparisons, p1Name, p2Name);
  const disagreement = runDisagreementAudit(comparisons, selected, p1Name, p2Name);
  const underdog = runUnderdogAnalysis(comparisons, selected, p1Name, p2Name);
  const stress = runStressTest(comparisons, p1Name, p2Name);

  // A selection is refused only when the opponent demonstrably survives the SAME scrutiny
  // the leader does not -- a genuine comparative finding, not a one-sided veto.
  const stressRefuses = selected !== null && stress.comparative_robustness === "CHALLENGER_MORE_ROBUST";
  const finalSide = stressRefuses ? null : selected;
  const winner = finalSide === "P1" ? p1Name : finalSide === "P2" ? p2Name : null;

  const supportCount = decision.independent_support_families.length;
  const contraCount = decision.independent_contradiction_families.length;
  const evidenceStrength: TruthEngineAuditResult["evidence_strength"] =
    finalSide === null ? "NONE"
    : supportCount >= 3 && contraCount === 0 && stress.stability === "ROBUST" ? "HIGH"
    : supportCount >= 3 || (supportCount >= 2 && contraCount === 0) ? "MODERATE"
    : "LOW";

  const evidenceChain = [
    `Metric comparisons: ${comparisons.filter((c) => c.status === "COMPARED").length} compared, ${comparisons.filter((c) => c.status !== "COMPARED").length} unavailable (never zeroed).`,
    `Independent evidence families: ${decision.families.length} (support ${supportCount}, contradiction ${contraCount}, neutral ${decision.neutral_families.length}, conflicted ${decision.conflicted_families.length}).`,
    ...verification.findings.map((f) => `VERIFICATION ${f.family}: ${f.outcome} (${f.severity}) -- ${f.decision_effect}`),
    `DISAGREEMENT: ${disagreement.final_effect}`,
    `UNDERDOG: ${underdog.reason} Overall ${underdog.overall_viability}.`,
    `STRESS: base=${stress.winner_before} adverse=${stress.winner_after} changed=${stress.changed} stability=${stress.stability} comparative_robustness=${stress.comparative_robustness} (P1 stressed->${stress.p1.outcome_when_this_side_stressed}, P2 stressed->${stress.p2.outcome_when_this_side_stressed}).`,
    `LEAVE-ONE-FAMILY-OUT: ${decision.flipping_families.length ? `reversed by ${decision.flipping_families.join(", ")}` : "no single family reverses the leader"}.`,
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
    final_reason: stressRefuses
      ? `Refused: ${decision.selected_player} led on the measured evidence, but under equivalent scrutiny of BOTH players (each side's own favouring edges eroded by one noise floor, in turn), the opponent survives that scrutiny and ${decision.selected_player} does not (comparative_robustness=CHALLENGER_MORE_ROBUST). This is a genuine comparative finding, not a one-sided veto.`
      : finalSide === null
        ? `Refused: ${decision.reason}`
        : `${winner} is the audit winner. ${decision.reason} ${disagreement.final_effect} Underdog: ${underdog.overall_viability}. Stress: ${stress.stability}.`,
    evidence_chain: evidenceChain,
  };
}
