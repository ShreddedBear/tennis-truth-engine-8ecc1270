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

export type FamilyVote = "P1" | "P2" | "NEUTRAL" | "INTERNALLY_CONFLICTED";
export type SelectionOutcome = "P1" | "P2" | "INSUFFICIENT_EVIDENCE";
export type SelectionStability = "ROBUST" | "STABLE" | "FRAGILE" | "NOT_APPLICABLE";

/** A family must contain at least this many usable comparisons to vote at all. */
export const MIN_COMPARISONS_PER_FAMILY = 1;
/** The leader needs at least this many independent supporting families to be selected. */
export const MIN_INDEPENDENT_SUPPORT_FAMILIES = 2;

export interface FamilyEvidence {
  family: string;
  vote: FamilyVote;
  supporting_metrics: string[];
  opposing_metrics: string[];
  neutral_metrics: string[];
  /** Every compared metric in this family, for the evidence chain. */
  comparisons: MetricComparison[];
}

export interface TruthEngineDecision {
  outcome: SelectionOutcome;
  /** Resolved player name for the selected side, when a side was selected. */
  selected_player: string | null;
  stability: SelectionStability;
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
}

function voteFor(comparisons: MetricComparison[]): { vote: FamilyVote; supporting: string[]; opposing: string[]; neutral: string[] } {
  const p1 = comparisons.filter((c) => c.favours === "P1").map((c) => c.metric_code);
  const p2 = comparisons.filter((c) => c.favours === "P2").map((c) => c.metric_code);
  const neutral = comparisons.filter((c) => c.favours === "NEUTRAL").map((c) => c.metric_code);
  if (p1.length && p2.length) return { vote: "INTERNALLY_CONFLICTED", supporting: p1, opposing: p2, neutral };
  if (p1.length) return { vote: "P1", supporting: p1, opposing: [], neutral };
  if (p2.length) return { vote: "P2", supporting: p2, opposing: [], neutral };
  return { vote: "NEUTRAL", supporting: [], opposing: [], neutral };
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
      const { vote, supporting, opposing, neutral } = voteFor(rows);
      return { family, vote, supporting_metrics: supporting, opposing_metrics: opposing, neutral_metrics: neutral, comparisons: rows };
    })
    .sort((a, b) => a.family.localeCompare(b.family));
}

/** Leader from family votes alone. Each family counts once, regardless of how many metrics it holds. */
function leaderOf(families: FamilyEvidence[]): { leader: "P1" | "P2" | null; p1: number; p2: number } {
  const p1 = families.filter((f) => f.vote === "P1").length;
  const p2 = families.filter((f) => f.vote === "P2").length;
  if (p1 === p2) return { leader: null, p1, p2 };
  return { leader: p1 > p2 ? "P1" : "P2", p1, p2 };
}

export interface DecisionInput {
  comparisons: MetricComparison[];
  p1Name: string;
  p2Name: string;
}

export function decideTruthEngineSelection({ comparisons, p1Name, p2Name }: DecisionInput): TruthEngineDecision {
  const families = buildFamilies(comparisons);
  const unavailable = comparisons
    .filter((c) => c.status !== "COMPARED")
    .map((c) => ({ metric_code: c.metric_code, status: c.status, reason: c.reason }));

  // Same-family agreement beyond the first metric is duplicated, not independent.
  const duplicatedSupport: string[] = [];
  const duplicatedContradiction: string[] = [];

  const base = leaderOf(families);
  const neutralFamilies = families.filter((f) => f.vote === "NEUTRAL").map((f) => f.family);
  const conflictedFamilies = families.filter((f) => f.vote === "INTERNALLY_CONFLICTED").map((f) => f.family);

  const shell = (outcome: SelectionOutcome, reason: string, stability: SelectionStability, support: string[] = [], contra: string[] = [], flipping: string[] = [], tieInducing: string[] = []): TruthEngineDecision => ({
    outcome,
    selected_player: outcome === "P1" ? p1Name : outcome === "P2" ? p2Name : null,
    stability,
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
    evidence_chain: families.map((f) => `${f.family}: ${f.vote}${f.supporting_metrics.length ? ` (from ${f.supporting_metrics.join(", ")})` : ""}${f.opposing_metrics.length ? ` vs ${f.opposing_metrics.join(", ")}` : ""}`),
  });

  if (!families.length) {
    return shell("INSUFFICIENT_EVIDENCE", `No metric produced a usable two-sided comparison (${unavailable.length} metric(s) unavailable). The Truth Engine cannot select a side and does not guess.`, "NOT_APPLICABLE");
  }
  if (!base.leader) {
    return shell("INSUFFICIENT_EVIDENCE", `Independent evidence families are tied (${base.p1} for ${p1Name} vs ${base.p2} for ${p2Name}). No side is selected.`, "NOT_APPLICABLE");
  }

  const leader = base.leader;
  const support = families.filter((f) => f.vote === leader);
  const contra = families.filter((f) => f.vote !== leader && f.vote !== "NEUTRAL" && f.vote !== "INTERNALLY_CONFLICTED");
  const supportNames = support.map((f) => f.family);
  const contraNames = contra.map((f) => f.family);

  for (const f of support) duplicatedSupport.push(...f.supporting_metrics.slice(1));
  for (const f of contra) duplicatedContradiction.push(...f.supporting_metrics.slice(1));

  if (supportNames.length < MIN_INDEPENDENT_SUPPORT_FAMILIES) {
    return shell(
      "INSUFFICIENT_EVIDENCE",
      `${leader === "P1" ? p1Name : p2Name} leads on only ${supportNames.length} independent evidence family (${supportNames.join(", ") || "none"}); at least ${MIN_INDEPENDENT_SUPPORT_FAMILIES} are required before a side is selected. A single family is not independent corroboration.`,
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
    `${selectedName} is supported by ${supportNames.length} independent evidence famil${supportNames.length === 1 ? "y" : "ies"} (${supportNames.join(", ")})${contraNames.length ? ` against ${contraNames.length} independent contradiction${contraNames.length === 1 ? "" : "s"} (${contraNames.join(", ")})` : " with no independent contradiction"}; no single family's removal reverses the leader${tieInducing.length ? `, though removing ${tieInducing.join(" or ")} would leave it tied` : ""}.${duplicatedSupport.length ? ` ${duplicatedSupport.length} same-family agreeing metric(s) were deliberately not counted again.` : ""}`,
    stability,
    supportNames,
    contraNames,
    flipping,
    tieInducing,
  );
}
