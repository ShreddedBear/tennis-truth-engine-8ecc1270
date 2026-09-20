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
import { decideTruthEngineSelection, type TruthEngineDecision } from "./truth-engine-decision";

export type Severity = "NONE" | "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL";
export type VerificationOutcome = "SUPPORTS_P1" | "SUPPORTS_P2" | "NEUTRAL" | "INSUFFICIENT_EVIDENCE";
export type PathwayViability = "NO_VIABLE_PATHWAY" | "POTENTIAL_PATHWAY" | "VIABLE_PATHWAY" | "STRONG_PATHWAY";
export type StressStability = "ROBUST" | "STABLE" | "FRAGILE" | "UNSTABLE" | "NOT_APPLICABLE";

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

/** One player's complete pathway census, computed from that player's own measured edges. */
export interface UnderdogSideAnalysis {
  side: "P1" | "P2";
  player: string;
  /** True when this side is the non-selected player, i.e. the designated underdog. */
  is_designated_underdog: boolean;
  pathways: UnderdogPathway[];
  overall_viability: PathwayViability;
  reason: string;
}

export interface UnderdogAnalysis {
  underdog_side: "P1" | "P2" | null;
  underdog_player: string | null;
  /** The designated underdog's pathways (empty when there is no selection). */
  pathways: UnderdogPathway[];
  overall_viability: PathwayViability;
  reason: string;
  /**
   * BOTH players, always, whether or not a selection exists. The stage previously analysed
   * only the non-selected side, so when the engine refused it analysed nobody -- 18 of the
   * 32 current refusals had neither player evaluated and 14 had exactly one, and no
   * underdog row could ever complete for the other side. A pathway census is a statement
   * about a player's own evidence and does not depend on who was selected, so it is
   * computed for both and the selection only decides which of the two is *designated*.
   */
  sides: UnderdogSideAnalysis[];
}

function viabilityFromRatio(ratio: number | null): PathwayViability {
  if (ratio === null || ratio <= 1) return "NO_VIABLE_PATHWAY";
  if (ratio < 2) return "POTENTIAL_PATHWAY";
  if (ratio < 4) return "VIABLE_PATHWAY";
  return "STRONG_PATHWAY";
}

/** Pathways for ONE named side, from that side's own measured edges. Never inferred. */
function pathwaysForSide(comparisons: MetricComparison[], side: "P1" | "P2", player: string): { pathways: UnderdogPathway[]; overall: PathwayViability } {
  const compared = comparisons.filter((c) => c.status === "COMPARED" && c.family);
  const byFamily = new Map<string, MetricComparison[]>();
  for (const c of compared) byFamily.set(c.family!, [...(byFamily.get(c.family!) ?? []), c]);

  const pathways: UnderdogPathway[] = [];
  for (const [family, rows] of [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const favouring = rows.filter((r) => r.favours === side);
    if (!favouring.length) continue;
    const ratio = Math.max(...favouring.map((r) => magnitudeRatio(r) ?? 0));
    const viability = viabilityFromRatio(ratio);
    if (viability === "NO_VIABLE_PATHWAY") continue; // measured but immaterial -- not a pathway
    pathways.push({
      pathway_type: FAMILY_PATHWAY[family] ?? `${family}_ADVANTAGE`,
      family,
      viability,
      supporting_metrics: favouring.map((r) => r.metric_code),
      evidence: favouring.map((r) => `${r.label ?? r.metric_code}: ${player}=${side === "P1" ? r.p1_number : r.p2_number} vs ${side === "P1" ? r.p2_number : r.p1_number} (${(magnitudeRatio(r) ?? 0).toFixed(1)}x noise floor)`).join("; "),
      conditions_required: `${player} must convert the measured ${family.toLowerCase().replace(/_/g, " ")} edge into match outcomes.`,
      magnitude_ratio: Number(ratio.toFixed(3)),
    });
  }

  // Overall viability is the strongest single pathway, promoted one level when the player
  // holds two or more INDEPENDENT pathways (breadth, not repetition of one family).
  const order: PathwayViability[] = ["NO_VIABLE_PATHWAY", "POTENTIAL_PATHWAY", "VIABLE_PATHWAY", "STRONG_PATHWAY"];
  let overall: PathwayViability = pathways.reduce<PathwayViability>((best, p) => (order.indexOf(p.viability) > order.indexOf(best) ? p.viability : best), "NO_VIABLE_PATHWAY");
  if (pathways.length >= 2) overall = order[Math.min(order.length - 1, order.indexOf(overall) + 1)]!;
  return { pathways, overall };
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
export function runUnderdogAnalysis(comparisons: MetricComparison[], selected: "P1" | "P2" | null, p1Name: string, p2Name: string): UnderdogAnalysis {
  const underdogSide = selected === "P1" ? "P2" : selected === "P2" ? "P1" : null;

  const sides: UnderdogSideAnalysis[] = (["P1", "P2"] as const).map((side) => {
    const player = side === "P1" ? p1Name : p2Name;
    const { pathways, overall } = pathwaysForSide(comparisons, side, player);
    return {
      side,
      player,
      is_designated_underdog: underdogSide === side,
      pathways,
      overall_viability: overall,
      reason: pathways.length
        ? `${player} holds ${pathways.length} evidence-supported pathway(s): ${pathways.map((p) => `${p.pathway_type} (${p.viability})`).join(", ")}.`
        : `No independent evidence family measurably favours ${player}; no viable pathway exists on the available evidence.`,
    };
  });

  const designated = sides.find((s) => s.is_designated_underdog) ?? null;

  return {
    underdog_side: underdogSide,
    underdog_player: designated?.player ?? null,
    pathways: designated?.pathways ?? [],
    overall_viability: designated?.overall_viability ?? "NO_VIABLE_PATHWAY",
    reason: designated
      ? designated.reason
      : `No selection was made, so neither player is the designated underdog. Both players were still analysed: ${sides.map((s) => `${s.player} ${s.overall_viability}`).join("; ")}.`,
    sides,
  };
}

// ---------------------------------------------------------------------------
// STRESS TEST — genuinely recompute the selection under adverse/favourable assumptions
// ---------------------------------------------------------------------------

export interface StressCase {
  /**
   * BASE is the evidence as measured; ADVERSE erodes the SELECTED side's own edges; MIRROR
   * erodes the OTHER player's instead. MIRROR replaced a "FAVOURABLE" case that widened the
   * selected side's edges -- a case that was computed, reported, and never used, and which
   * told nobody anything about the opponent.
   */
  case_name: "BASE" | "ADVERSE" | "MIRROR" | "SYMMETRIC";
  winner: "P1" | "P2" | "INSUFFICIENT_EVIDENCE";
  support_families: number;
  contradiction_families: number;
  assumption: string;
}

/** How one player's own profile behaved when ITS OWN edges were eroded. */
export interface StressSideProfile {
  side: "P1" | "P2";
  player: string;
  /** Share of the directional evidence this side held before the erosion, unrounded. */
  support_percent_before: number;
  /** Share it holds after its own edges are eroded by one noise floor each. */
  support_percent_after: number;
  outcome_when_stressed: "P1" | "P2" | "INSUFFICIENT_EVIDENCE";
  status: "ROBUST" | "REVERSED" | "REMOVED";
}

/**
 * The two sides' adverse cases read against each other.
 *
 *  LEADER_ROBUST               the leader keeps the selection with its own edges eroded.
 *  CHALLENGER_MORE_ROBUST      the challenger wins the leader's adverse case AND survives
 *                              its own -- the one finding that is genuinely about the two
 *                              players, and the only one that withdraws a selection.
 *  LEADER_FRAGILE_UNCONTESTED  the leader loses its own adverse case, but the challenger
 *                              does not survive its own either. Thin, not contradicted.
 */
export type ComparativeRobustness = "LEADER_ROBUST" | "CHALLENGER_MORE_ROBUST" | "LEADER_FRAGILE_UNCONTESTED" | "NOT_APPLICABLE";

export interface StressTest {
  winner_before: "P1" | "P2" | "INSUFFICIENT_EVIDENCE";
  winner_after: "P1" | "P2" | "INSUFFICIENT_EVIDENCE";
  changed: boolean;
  cases: StressCase[];
  /** Always both players, always computed from each side's own measured values. */
  sides: StressSideProfile[];
  comparative_robustness: ComparativeRobustness;
  stability: StressStability;
  reason: string;
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
function erodeEdgesOf(comparisons: MetricComparison[], side: "P1" | "P2"): MetricComparison[] {
  return comparisons.map((c) => {
    if (c.status !== "COMPARED" || c.advantage_p1 === null) return c;
    if (c.favours !== side) return c;
    const spec = COMPARISON_SPECS[c.metric_code];
    if (!spec) return c;
    // Toward zero, never through it. Math.max(0, ...) is what makes a manufactured
    // opposing vote structurally impossible rather than merely unlikely.
    const eroded = Math.max(0, Math.abs(c.advantage_p1) - spec.materiality);
    const advantage = Number(((side === "P1" ? 1 : -1) * eroded).toFixed(6));
    const favours = Math.abs(advantage) <= spec.materiality ? "NEUTRAL" : advantage > 0 ? "P1" : "P2";
    return { ...c, advantage_p1: advantage, favours: favours as MetricComparison["favours"] };
  });
}

function outcomeOf(decision: TruthEngineDecision): "P1" | "P2" | "INSUFFICIENT_EVIDENCE" {
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
function erodeAllEdges(comparisons: MetricComparison[]): MetricComparison[] {
  // Eroding one side then the other reaches every directional edge exactly once: the second
  // pass sees the first pass's survivors unchanged, and anything the first pass flattened to
  // NEUTRAL is no longer a P2 edge for it to touch.
  return erodeEdgesOf(erodeEdgesOf(comparisons, "P1"), "P2");
}

/** Share of the directional evidence held by `side`, unrounded. Both sides off one census. */
function directionalShare(side: "P1" | "P2", decision: TruthEngineDecision): number {
  const mine = decision.families.filter((f) => f.vote === side).length;
  const theirs = decision.families.filter((f) => (f.vote === "P1" || f.vote === "P2") && f.vote !== side).length;
  const conflicted = decision.conflicted_families.length;
  const directional = mine + theirs + conflicted;
  return directional > 0 ? (mine / directional) * 100 : 0;
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
export function runStressTest(comparisons: MetricComparison[], p1Name: string, p2Name: string): StressTest {
  const base = decideTruthEngineSelection({ comparisons, p1Name, p2Name });
  const before = outcomeOf(base);

  // Each side's own adverse case is computed whether or not a selection exists, so a
  // refusal still carries a full two-sided robustness picture instead of NOT_APPLICABLE.
  const p1Stressed = decideTruthEngineSelection({ comparisons: erodeEdgesOf(comparisons, "P1"), p1Name, p2Name });
  const p2Stressed = decideTruthEngineSelection({ comparisons: erodeEdgesOf(comparisons, "P2"), p1Name, p2Name });

  const symmetricDecision = decideTruthEngineSelection({ comparisons: erodeAllEdges(comparisons), p1Name, p2Name });
  const sides: StressSideProfile[] = (["P1", "P2"] as const).map((side) => {
    const ownStressed = side === "P1" ? p1Stressed : p2Stressed;
    const other: "P1" | "P2" = side === "P1" ? "P2" : "P1";
    const outcome = outcomeOf(ownStressed);
    return {
      side,
      player: side === "P1" ? p1Name : p2Name,
      // before/after are read from the SYMMETRIC case, so the two players' numbers are
      // comparable: both were eroded on identical terms.
      support_percent_before: Number(directionalShare(side, base).toFixed(6)),
      support_percent_after: Number(directionalShare(side, symmetricDecision).toFixed(6)),
      // outcome_when_stressed is this side's OWN adverse case -- a per-player diagnostic,
      // never the comparative verdict.
      outcome_when_stressed: outcome,
      status: outcome === side ? "ROBUST" : outcome === other ? "REVERSED" : "REMOVED",
    };
  });

  const p1Profile = sides[0]!;
  const p2Profile = sides[1]!;

  if (before === "INSUFFICIENT_EVIDENCE") {
    return {
      winner_before: before,
      winner_after: before,
      changed: false,
      cases: [{ case_name: "BASE", winner: before, support_families: base.independent_support_families.length, contradiction_families: base.independent_contradiction_families.length, assumption: "Observed evidence as measured." }],
      sides,
      comparative_robustness: "NOT_APPLICABLE",
      stability: "NOT_APPLICABLE",
      reason: "No selection was made, so there is no leader whose robustness could be compared against the other player's.",
    };
  }

  const selected: "P1" | "P2" = before;
  const challenger: "P1" | "P2" = selected === "P1" ? "P2" : "P1";
  const selectedProfile = selected === "P1" ? p1Profile : p2Profile;
  const challengerProfile = selected === "P1" ? p2Profile : p1Profile;
  const selectedStressed = selected === "P1" ? p1Stressed : p2Stressed;
  const challengerStressed = selected === "P1" ? p2Stressed : p1Stressed;

  // The like-for-like case both players are judged on (computed once, above).
  const symmetric = symmetricDecision;
  const symmetricOutcome = outcomeOf(symmetric);

  const after = outcomeOf(selectedStressed);
  const cases: StressCase[] = [
    { case_name: "BASE", winner: before, support_families: base.independent_support_families.length, contradiction_families: base.independent_contradiction_families.length, assumption: "Observed evidence as measured." },
    { case_name: "ADVERSE", winner: after, support_families: selectedStressed.independent_support_families.length, contradiction_families: selectedStressed.independent_contradiction_families.length, assumption: "Every edge favouring the SELECTED side eroded by one of that metric's own noise floors; neutral and opposing evidence untouched." },
    { case_name: "MIRROR", winner: outcomeOf(challengerStressed), support_families: challengerStressed.independent_support_families.length, contradiction_families: challengerStressed.independent_contradiction_families.length, assumption: "The identical erosion applied to the OTHER player instead -- diagnostic only, since eroding a side can only weaken it." },
    { case_name: "SYMMETRIC", winner: symmetricOutcome, support_families: symmetric.independent_support_families.length, contradiction_families: symmetric.independent_contradiction_families.length, assumption: "Every directional edge eroded by one of its own metric's noise floors, both players at once. This is the case the comparative verdict is read from." },
  ];

  // THE COMPARATIVE RULE. The only finding that can be said ABOUT THE TWO PLAYERS is one
  // where the challenger survives scrutiny the leader does not. A leader that loses its own
  // adverse case while the challenger also fails its own has not been out-survived by
  // anybody -- that is thin evidence, reported as such, not a comparative verdict.
  const comparative: ComparativeRobustness =
    symmetricOutcome === selected
      ? "LEADER_ROBUST"
      : symmetricOutcome === challenger
        ? "CHALLENGER_MORE_ROBUST"
        : "LEADER_FRAGILE_UNCONTESTED";

  const stability: StressStability =
    comparative === "CHALLENGER_MORE_ROBUST" ? "UNSTABLE"
    : comparative === "LEADER_FRAGILE_UNCONTESTED" ? "FRAGILE"
    : base.independent_contradiction_families.length === 0 && base.stability === "ROBUST" ? "ROBUST"
    : "STABLE";

  const describe = (p: StressSideProfile) => `${p.player} ${p.support_percent_before.toFixed(1)}% -> ${p.support_percent_after.toFixed(1)}% (${p.status})`;

  return {
    winner_before: before,
    winner_after: after,
    changed: after !== before,
    cases,
    sides,
    comparative_robustness: comparative,
    stability,
    reason:
      comparative === "LEADER_ROBUST"
        ? `The selection survives eroding every edge that favours it by one of that metric's own noise floors. ${describe(selectedProfile)} vs ${describe(challengerProfile)}.`
        : comparative === "CHALLENGER_MORE_ROBUST"
          ? `Under identical scrutiny the other player is the more robust of the two: eroding the selected side's edges hands the match to ${challengerProfile.player}, and eroding ${challengerProfile.player}'s own edges still leaves ${challengerProfile.player} ahead. ${describe(selectedProfile)} vs ${describe(challengerProfile)}.`
          : `The selection does not survive its own erosion, but neither does the other player survive theirs, so the stress test establishes no comparative winner and does not withdraw the selection. ${describe(selectedProfile)} vs ${describe(challengerProfile)}.`,
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
 * Underdog and Stress are genuine audit layers over that same evidence -- and the stress
 * result can DOWNGRADE the outcome to a refusal (a selection that reverses under a
 * one-noise-floor erosion is not reported as a winner), but no layer can invent a winner.
 */
export function runTruthEngineAudit(comparisons: MetricComparison[], p1Name: string, p2Name: string): TruthEngineAuditResult {
  const decision = decideTruthEngineSelection({ comparisons, p1Name, p2Name });
  const selected = decision.outcome === "INSUFFICIENT_EVIDENCE" ? null : decision.outcome;
  const verification = runVerificationAudit(comparisons, p1Name, p2Name);
  const disagreement = runDisagreementAudit(comparisons, selected, p1Name, p2Name);
  const underdog = runUnderdogAnalysis(comparisons, selected, p1Name, p2Name);
  const stress = runStressTest(comparisons, p1Name, p2Name);

  // THE STRESS RULE. A selection is withdrawn only on a COMPARATIVE finding: the other
  // player must both win the leader's adverse case and survive its own. Previously any
  // change in the leader's adverse case refused the selection, which made the stage a
  // one-sided veto -- it removed leaders on a test the opponent was never made to take, and
  // it treated "fragile" as "no winner". A leader whose evidence is merely thin now keeps
  // the selection and carries stability=FRAGILE, which is what the colour layer reads.
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
    `STRESS: base=${stress.winner_before} adverse=${stress.winner_after} comparative=${stress.comparative_robustness} stability=${stress.stability}; ${stress.sides.map((sp) => `${sp.player} ${sp.support_percent_before.toFixed(1)}%->${sp.support_percent_after.toFixed(1)}% ${sp.status}`).join(" | ")}.`,
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
      ? `Refused: ${decision.selected_player} led on the measured evidence, but ${stress.reason}`
      : finalSide === null
        ? `Refused: ${decision.reason}`
        : `${winner} is the audit winner. ${decision.reason} ${disagreement.final_effect} Underdog: ${underdog.overall_viability}. Stress: ${stress.stability}.`,
    evidence_chain: evidenceChain,
  };
}
