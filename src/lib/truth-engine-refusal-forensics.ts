// TRUTH ENGINE — REFUSAL FORENSICS (DIAGNOSTIC ONLY)
//
// PURPOSE. Given the SAME persisted metric evidence the production pipeline consumed, this
// module independently reconstructs both players' complete audit profiles and reports the
// exact stage at which a winner did or did not emerge. It exists to answer one question
// about a stored INSUFFICIENT_EVIDENCE decision:
//
//   "After identical scrutiny of BOTH players, does a deterministic comparative winner
//    exist that a later audit stage then vetoed?"
//
// WHAT THIS IS NOT. It is not a second prediction engine and it never selects a player.
// Every number below is READ from the production engines (truth-engine-decision.ts and
// truth-engine-audit.ts) or derived from their outputs by pure arithmetic. It changes no
// threshold, no metric, no family, and no winner-selection behaviour. Deleting this file
// would change no decision the product makes.
//
// SYMMETRY. Nothing here is computed "for P1 and assumed inverse for P2". Both players'
// support ratios, verification outcomes, disagreement exposure, underdog pathways and
// stress profiles are computed from each side's own measured values, and a swapped-input
// self-check (`mirrorCheck`) proves it per match.

import {
  decideTruthEngineSelection,
  EVIDENCE_SELECTION_THRESHOLD,
  type FamilyEvidence,
  type TruthEngineDecision,
} from "./truth-engine-decision";
import {
  runDisagreementAudit,
  runStressTest,
  runTruthEngineAudit,
  runUnderdogAnalysis,
  runVerificationAudit,
  magnitudeRatio,
  robustnessVerdict,
  type TruthEngineAuditResult,
  type SideStressResult,
  type SymmetricStressVerdict as ProductionSymmetricStressVerdict,
} from "./truth-engine-audit";
import { compareMetricRows, COMPARISON_SPECS, type MetricComparison, type MetricRowForComparison } from "./truth-engine-metric-comparison";

export type Side = "P1" | "P2";
export type StageComparison = "P1" | "P2" | "TIE" | "INSUFFICIENT";

/** One of the eight primary classifications (the original seven, plus one added when the
 *  Stress fix resolved a case but production has not been re-run to update the persisted
 *  row -- see FIXED_PENDING_REPROCESS below). Exactly one is assigned per refusal. */
export type RefusalClassification =
  | "TRUE_TIE"
  | "BELOW_THRESHOLD"
  | "CONFLICTED_EVIDENCE"
  | "ROBUSTNESS_UNRESOLVED"
  | "DOWNSTREAM_VETO_BUG"
  | "DATA_OR_PIPELINE_BUG"
  /**
   * The corrected reconstruction now finds a winner that clears the threshold, survives
   * leave-one-family-out, AND survives the corrected two-sided Stress evaluation
   * (comparative_robustness is never CHALLENGER_MORE_ROBUST) -- but the PERSISTED row still
   * shows INSUFFICIENT EVIDENCE because production has not re-run this match since the fix.
   * Per the read-only production-safety constraint, this reconstruction never writes to
   * production, so this state is expected and distinct from a live defect: it is the fix
   * working, awaiting the next real pipeline run to update the stored verdict.
   */
  | "FIXED_PENDING_REPROCESS"
  | "OTHER";

export interface PerSideSupport {
  /** Families voting for THIS player. */
  supporting_families: string[];
  /** Families voting for the OTHER player -- this player's independent contradictions. */
  contradicting_families: string[];
  conflicted_families: string[];
  neutral_families: string[];
  /** supporting + contradicting + conflicted. Identical for both sides, by construction. */
  directional_denominator: number;
  /** UNROUNDED share of the directional evidence held by this player, 0-100. */
  support_ratio_percent: number;
  /** The persisted engine's own rounded reading, for cross-checking. */
  support_ratio_percent_rounded: number;
  meets_threshold: boolean;
}

export interface MetricProfileRow {
  metric_code: string;
  metric_name: string | null;
  comparison_label: string | null;
  p1_value_raw: string | null;
  p2_value_raw: string | null;
  p1_number: number | null;
  p2_number: number | null;
  /** Direction is a property of the METRIC, so it is identical for both sides by design. */
  direction: string | null;
  /** Which side this metric's own measured gap favours, or why it favours nobody. */
  favours: string;
  status: string;
  reason: string;
  differential: number | null;
  materiality: number | null;
  magnitude_ratio: number | null;
  contributed_directional_evidence: boolean;
  evidence_family_spec: string | null;
  evidence_family_persisted: string | null;
  p1_treatment: string | null;
  p2_treatment: string | null;
  p1_status: string | null;
  p2_status: string | null;
  p1_unavailable_reason: string | null;
  p2_unavailable_reason: string | null;
  sample_context: string | null;
  reliability: number | null;
  source: string | null;
  matrix_derived: boolean | null;
}

export interface StressProfile {
  /** This side's directional share BEFORE any adverse shift. */
  initial_support_percent: number;
  /** This side's directional share after ITS OWN edges are eroded by one noise floor each. */
  stress_adjusted_support_percent: number;
  /** Leader of the full re-derived selection when THIS side is the one stressed. */
  outcome_when_this_side_stressed: StageComparison;
  status: "ROBUST" | "FRAGILE" | "REVERSED" | "REMOVED" | "NOT_APPLICABLE";
  /**
   * True when production's own `runStressTest` computed this side's profile as part of its
   * real two-sided evaluation (now always, post-fix -- both `p1` and `p2` are always
   * computed by `evaluateSideStress`). False only distinguishes the pre-fix era, where
   * production could only ever stress the pre-Stress leader and this reconstruction had to
   * run its own separate mirror computation to get the other side's profile at all.
   */
  evaluated_by_production: boolean;
  /**
   * Families that voted for NOBODY before the shift (the engine measured both players and
   * found no material difference) and vote for the OTHER player after it. These are not
   * eroded edges -- they are directional evidence the shift manufactured out of declared
   * parity, and they are the mechanism by which an adverse case reverses a leader.
   */
  families_manufactured_for_opponent: string[];
  /** Families that voted for this side before the shift and vote for nobody after it. */
  families_neutralised: string[];
  /** Families that voted for this side before the shift and for the OTHER side after it. */
  families_flipped_to_opponent: string[];
}

/**
 * The like-for-like comparison this used to be the only place production ever made: the
 * same adverse shift applied to EACH player in turn. Production now computes this itself
 * (`truth-engine-audit.ts`: `evaluateSideStress` / `robustnessVerdict`) and actually acts
 * on it, so this is a re-export of the production type, not a parallel one.
 */
export type SymmetricStressVerdict = ProductionSymmetricStressVerdict;

export interface StageTrace {
  /** Leader on family votes alone, before the 60% threshold is applied. */
  family_vote: StageComparison;
  /** After EVIDENCE_SELECTION_THRESHOLD is applied to the leader's directional share. */
  after_threshold: StageComparison;
  /** After leave-one-family-out (the decision core's own stability recomputation). */
  after_lofo_initial_decision: StageComparison;
  after_verification: StageComparison;
  after_disagreement: StageComparison;
  after_underdog: StageComparison;
  after_stress: StageComparison;
  final_stored: StageComparison;
  /** The single stage at which a live leader was lost, or null when none ever existed. */
  stage_that_removed_the_leader: string | null;
}

export interface RefusalForensics {
  match_id: string;
  audit_run_id: string;
  p1: string;
  p2: string;
  p1_player_id: string | null;
  p2_player_id: string | null;

  metric_profile: MetricProfileRow[];
  families: Array<Pick<FamilyEvidence, "family" | "vote" | "supporting_metrics" | "opposing_metrics" | "neutral_metrics">>;

  p1_support: PerSideSupport;
  p2_support: PerSideSupport;

  verification_p1: { supports: string[]; findings: number; rejected_metrics: number; own_supply_failure: number; rejected_on_evidential_grounds: number; supplied_but_unused: number };
  verification_p2: { supports: string[]; findings: number; rejected_metrics: number; own_supply_failure: number; rejected_on_evidential_grounds: number; supplied_but_unused: number };

  disagreement_p1: { challenged: boolean; contradiction_families: string[]; severity: string; risk: string };
  disagreement_p2: { challenged: boolean; contradiction_families: string[]; severity: string; risk: string };

  underdog_p1: { evaluated: boolean; pathways: string[]; viability: string; reason: string };
  underdog_p2: { evaluated: boolean; pathways: string[]; viability: string; reason: string };

  stress_p1: StressProfile;
  stress_p2: StressProfile;

  comparison_before_stress: StageComparison;
  comparison_after_stress: StageComparison;
  symmetric_stress_verdict: SymmetricStressVerdict;
  /** Verification's own family census names the same leader the decision core did. */
  verification_agrees_with_decision_core: boolean;
  trace: StageTrace;

  final_deterministic_state: string;
  refusal_reason: string;
  classification: RefusalClassification;
  exact_stage_that_caused_refusal: string;
  explanation: string;
  /** Findings that do not change the single primary classification but bear on it. */
  secondary_observations: string[];

  /** Swapping P1/P2 must swap every output. False here would itself be a defect. */
  mirror_check_symmetric: boolean;
  /** Raw engine outputs, preserved so any summary above can be re-derived from evidence. */
  raw: {
    decision: TruthEngineDecision;
    audit: TruthEngineAuditResult;
    comparisons: MetricComparison[];
  };
}

export interface ForensicMetricRow extends MetricRowForComparison {
  metric_name?: string | null;
  evidence_family?: string | null;
  p1_status?: string | null;
  p2_status?: string | null;
  p1_unavailable_reason?: string | null;
  p2_unavailable_reason?: string | null;
  reliability?: number | string | null;
  sample?: string | null;
  source?: string | null;
  matrix_derived?: boolean | null;
}

export interface ForensicMatchInput {
  match_id: string;
  audit_run_id: string;
  p1: string;
  p2: string;
  p1_player_id?: string | null;
  p2_player_id?: string | null;
  metric_rows: ForensicMetricRow[];
  stored_final_selection: string;
  stored_independent_winner: string | null;
}

const sideOf = (vote: string): Side | null => (vote === "P1" || vote === "P2" ? vote : null);

/**
 * Both sides' shares off ONE family census. Computing them from the same census is what
 * makes them comparable; computing each side's numerator from its OWN votes is what keeps
 * them independent. The denominator is shared because "share of the directional evidence"
 * is only meaningful against the same total.
 */
function supportFor(side: Side, families: FamilyEvidence[]): PerSideSupport {
  const mine = families.filter((f) => f.vote === side).map((f) => f.family);
  const theirs = families.filter((f) => sideOf(f.vote) !== null && f.vote !== side).map((f) => f.family);
  const conflicted = families.filter((f) => f.vote === "INTERNALLY_CONFLICTED").map((f) => f.family);
  const neutral = families.filter((f) => f.vote === "NEUTRAL").map((f) => f.family);
  const denominator = mine.length + theirs.length + conflicted.length;
  const unrounded = denominator > 0 ? (mine.length / denominator) * 100 : 0;
  return {
    supporting_families: mine,
    contradicting_families: theirs,
    conflicted_families: conflicted,
    neutral_families: neutral,
    directional_denominator: denominator,
    support_ratio_percent: unrounded,
    support_ratio_percent_rounded: Number(unrounded.toFixed(1)),
    meets_threshold: denominator > 0 && unrounded >= EVIDENCE_SELECTION_THRESHOLD,
  };
}

/**
 * A like-for-like stress profile for a NAMED side, wrapping production's own two-sided
 * computation (`evaluateSideStress`) rather than re-deriving it. Production used to be
 * unable to stress anything but the selected side; now that it genuinely evaluates both
 * players by the identical rule, this is a thin adapter onto production's `SideStressResult`
 * -- shaped as `StressProfile` for backward compatibility with the JSON/MD report this
 * module already produces, and unchanged in field names so existing consumers of that report
 * do not need to change.
 */
function stressProfileFor(side: Side, sideResult: SideStressResult, productionEvaluated: boolean): StressProfile {
  const outcome: StageComparison = sideResult.outcome_when_this_side_stressed === "INSUFFICIENT_EVIDENCE" ? "INSUFFICIENT" : sideResult.outcome_when_this_side_stressed;
  const other: Side = side === "P1" ? "P2" : "P1";
  const status: StressProfile["status"] =
    outcome === other ? "REVERSED"
    : outcome === side ? "ROBUST"
    : sideResult.stress_adjusted_support_percent < sideResult.initial_support_percent ? "FRAGILE"
    : "REMOVED";
  return {
    initial_support_percent: sideResult.initial_support_percent,
    stress_adjusted_support_percent: sideResult.stress_adjusted_support_percent,
    outcome_when_this_side_stressed: outcome,
    status,
    evaluated_by_production: productionEvaluated,
    families_manufactured_for_opponent: sideResult.families_manufactured_for_opponent,
    families_neutralised: sideResult.families_neutralised,
    families_flipped_to_opponent: sideResult.families_flipped_to_opponent,
  };
}

/**
 * Reads the two per-side stress profiles against each other. Delegates to production's own
 * `robustnessVerdict` -- there is exactly one implementation of this comparison in the
 * codebase now, and production actually acts on it (see `runTruthEngineAudit`).
 */
export function symmetricStressVerdict(leader: StageComparison, p1: StressProfile, p2: StressProfile): SymmetricStressVerdict {
  if (leader !== "P1" && leader !== "P2") return "NOT_APPLICABLE";
  const asSideResult = (side: Side, profile: StressProfile): SideStressResult => ({
    side,
    initial_support_percent: profile.initial_support_percent,
    stress_adjusted_support_percent: profile.stress_adjusted_support_percent,
    outcome_when_this_side_stressed: profile.outcome_when_this_side_stressed === "P1" || profile.outcome_when_this_side_stressed === "P2" ? profile.outcome_when_this_side_stressed : "INSUFFICIENT_EVIDENCE",
    support_families_before: 0,
    support_families_after: 0,
    families_neutralised: profile.families_neutralised,
    families_manufactured_for_opponent: profile.families_manufactured_for_opponent,
    families_flipped_to_opponent: profile.families_flipped_to_opponent,
  });
  return robustnessVerdict(leader, asSideResult("P1", p1), asSideResult("P2", p2));
}

/** Leader on family votes alone -- the decision core's first, pre-threshold comparison. */
function familyVoteLeader(families: FamilyEvidence[]): StageComparison {
  const p1 = families.filter((f) => f.vote === "P1").length;
  const p2 = families.filter((f) => f.vote === "P2").length;
  if (!families.length) return "INSUFFICIENT";
  if (p1 === p2) return "TIE";
  return p1 > p2 ? "P1" : "P2";
}

function verificationLeader(supportsP1: string[], supportsP2: string[]): StageComparison {
  if (!supportsP1.length && !supportsP2.length) return "INSUFFICIENT";
  if (supportsP1.length === supportsP2.length) return "TIE";
  return supportsP1.length > supportsP2.length ? "P1" : "P2";
}

/**
 * Classification is decided from the reconstructed profiles, never from the stored verdict.
 * The order below is the order of precedence: a defect claim outranks a "legitimate
 * refusal" reading, so DOWNSTREAM_VETO_BUG and DATA_OR_PIPELINE_BUG are tested first.
 */
function classify(input: {
  trace: StageTrace;
  p1: PerSideSupport;
  p2: PerSideSupport;
  symmetricVerdict: SymmetricStressVerdict;
  leaderStress: StressProfile;
  challengerStress: StressProfile;
  decision: TruthEngineDecision;
  comparedCount: number;
  oneSidedCount: number;
  activeCodes: number;
  supplyFailures: number;
  supplyBreakdown: string;
}): { classification: RefusalClassification; stage: string; explanation: string } {
  const { trace, p1, p2, symmetricVerdict, leaderStress, challengerStress, decision, comparedCount, oneSidedCount, activeCodes, supplyFailures, supplyBreakdown } = input;
  const leader: StageComparison = trace.family_vote;

  // DOWNSTREAM_VETO_BUG / ROBUSTNESS_UNRESOLVED: a winner genuinely existed at the end of
  // the decision core (it cleared the threshold AND survived leave-one-family-out) and
  // Stress removed it. Under the corrected, two-sided, non-manufacturing Stress evaluation
  // this requires symmetricVerdict === "CHALLENGER_MORE_ROBUST" -- the one state that is a
  // genuine comparative finding rather than a one-sided artifact.
  if (trace.after_lofo_initial_decision === "P1" || trace.after_lofo_initial_decision === "P2") {
    const selected = trace.after_lofo_initial_decision;
    const stressStillVetoes = trace.after_stress !== selected;
    if (stressStillVetoes) {
      const manufactured = leaderStress.families_manufactured_for_opponent;
      const mechanism =
        `Under the adverse case the leader's own families were ${leaderStress.families_neutralised.length ? `neutralised (${leaderStress.families_neutralised.join(", ")})` : "left intact"}` +
        (manufactured.length
          ? `, while ${manufactured.length} family/families that had voted for NOBODY (${manufactured.join(", ")}) were converted into votes for the opponent -- directional evidence the shift created out of measured parity, not an eroded edge.`
          : ", and no new opposing family was created.") +
        ` Mirror case: with the CHALLENGER's edges eroded instead, the outcome is ${challengerStress.outcome_when_this_side_stressed}.`;

      // Only a challenger that wins its OWN mirror case is evidence that the leader is the
      // less robust of the two. Anything else means the test did not rank the two players.
      if (symmetricVerdict === "CHALLENGER_MORE_ROBUST") {
        return {
          classification: "ROBUSTNESS_UNRESOLVED",
          stage: "STRESS (adverse one-noise-floor recomputation)",
          explanation: `${selected} led the decision core at ${(selected === "P1" ? p1 : p2).support_ratio_percent.toFixed(6)}%, but under equivalent scrutiny of both players the opponent leads in BOTH the adverse and the mirror case, so no stable winner is established. ${mechanism}`,
        };
      }
      return {
        classification: "DOWNSTREAM_VETO_BUG",
        stage: trace.stage_that_removed_the_leader ?? "POST_DECISION_AUDIT",
        explanation: `The decision core selected ${selected} at ${(selected === "P1" ? p1 : p2).support_ratio_percent.toFixed(6)}% of the directional evidence, cleared the ${EVIDENCE_SELECTION_THRESHOLD}% threshold and survived leave-one-family-out; the STRESS stage then converted that selection into a refusal. The conversion is not a comparative finding: the adverse case is applied ONLY to the selected side (symmetric verdict: ${symmetricVerdict}), so the opponent's profile is never subjected to the same erosion before the selection is withdrawn. ${mechanism}`,
      };
    }
    // The corrected reconstruction now survives Stress (comparative_robustness is never
    // CHALLENGER_MORE_ROBUST here), but the PERSISTED row still disagrees. Since this
    // reconstruction is read-only and never writes to production, that can only mean the
    // stored verdict predates the fix -- this match has not been re-run by the real
    // pipeline since. That is the fix working, not a live defect, so it gets its own label
    // rather than being reported as still vetoed.
    if (trace.final_stored === "INSUFFICIENT") {
      return {
        classification: "FIXED_PENDING_REPROCESS",
        stage: "PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)",
        explanation: `The decision core selected ${selected} at ${(selected === "P1" ? p1 : p2).support_ratio_percent.toFixed(6)}% of the directional evidence, cleared the ${EVIDENCE_SELECTION_THRESHOLD}% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=${symmetricVerdict}, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.`,
      };
    }
  }

  // DATA_OR_PIPELINE_BUG: the refusal is a consequence of evidence that never arrived in
  // comparable form, not of two players who genuinely cannot be told apart. One-sided
  // evidence is the signature: a value WAS produced for one player and not the other.
  // A refusal can only be a statement ABOUT the two players when at least one family
  // actually expressed a direction. With no directional family at all, the cause is
  // whichever dominates: evidence that never arrived in comparable form (a supply failure),
  // or evidence that arrived, was compared, and showed genuine parity.
  //
  // The split is made on the engine's own per-metric statuses, not on a judgement call:
  //   TREATMENT_NOT_USABLE / ONE_SIDED_EVIDENCE / VALUE_NOT_PARSEABLE -> the value never
  //     arrived, or arrived unreadable. Nothing was measured, so nothing was compared.
  //   INSUFFICIENT_SAMPLE -> the value DID arrive and the engine refused it on evidential
  //     grounds. That is the engine working, not a supply failure.
  //   COMPARED + NEUTRAL -> both players measured; the parity is real evidence.
  if (p1.directional_denominator === 0 && supplyFailures >= comparedCount) {
    return {
      classification: "DATA_OR_PIPELINE_BUG",
      stage: "P1/P2 METRIC EXECUTION",
      explanation: `Only ${comparedCount} of the ${activeCodes} active metrics produced a two-sided comparison and no family expressed a direction, while ${supplyFailures} metric(s) never yielded comparable evidence at all (${supplyBreakdown}). The refusal is an evidence-supply outcome, not a comparative finding: the engine had almost nothing to compare the two players on.`,
    };
  }
  if (comparedCount === 0) {
    return {
      classification: "DATA_OR_PIPELINE_BUG",
      stage: "P1/P2 METRIC EXECUTION",
      explanation: `Not one of the ${activeCodes} active metrics produced a two-sided comparison, so no family could vote. This is an evidence-supply failure, not a comparative tie: the engine had nothing to compare.`,
    };
  }

  if (leader === "TIE" || leader === "INSUFFICIENT") {
    if (decision.conflicted_families.length && !p1.supporting_families.length && !p2.supporting_families.length) {
      return {
        classification: "CONFLICTED_EVIDENCE",
        stage: "DECISION CORE (family consolidation)",
        explanation: `Every directional family is internally conflicted (${decision.conflicted_families.join(", ")}); no family votes for either player, so there is no comparative direction to select from.`,
      };
    }
    return {
      classification: "TRUE_TIE",
      stage: "DECISION CORE (family vote)",
      explanation: `Independent evidence families are level (${p1.supporting_families.length} for P1 vs ${p2.supporting_families.length} for P2${decision.conflicted_families.length ? `, ${decision.conflicted_families.length} internally conflicted` : ""}). Neither player holds a directional advantage, so neither reaches ${EVIDENCE_SELECTION_THRESHOLD}%.`,
    };
  }

  // A leader exists on family votes. Did it fail the threshold, or the stability test?
  const leaderSupport = leader === "P1" ? p1 : p2;
  if (!leaderSupport.meets_threshold) {
    const conflictedDrag = decision.conflicted_families.length > 0;
    return {
      classification: conflictedDrag && leaderSupport.contradicting_families.length === 0 ? "CONFLICTED_EVIDENCE" : "BELOW_THRESHOLD",
      stage: `DECISION CORE (${EVIDENCE_SELECTION_THRESHOLD}% directional threshold)`,
      explanation: `${leader} leads the family vote but holds only ${leaderSupport.support_ratio_percent.toFixed(6)}% of the directional evidence (${leaderSupport.supporting_families.length} supporting of ${leaderSupport.directional_denominator} directional families${conflictedDrag ? `, including ${decision.conflicted_families.length} internally conflicted family/families in the denominator` : ""}), below the ${EVIDENCE_SELECTION_THRESHOLD}% threshold.`,
    };
  }

  if (decision.flipping_families.length) {
    return {
      classification: "ROBUSTNESS_UNRESOLVED",
      stage: "DECISION CORE (leave-one-family-out)",
      explanation: `${leader} cleared the threshold at ${leaderSupport.support_ratio_percent.toFixed(6)}%, but removing ${decision.flipping_families.join(" or ")} REVERSES the leader, so the lead is contradicted rather than merely thin.`,
    };
  }

  return {
    classification: "OTHER",
    stage: "UNCLASSIFIED",
    explanation: `A leader (${leader}) cleared the threshold and survived leave-one-family-out, yet the reconstruction still reports a refusal. One-sided metrics: ${oneSidedCount}.`,
  };
}

/** Everything above, for one match. Pure: no DB, no network, no clock. */
export function forensicsForMatch(input: ForensicMatchInput): RefusalForensics {
  const comparisons = compareMetricRows(input.metric_rows);
  const byCode = new Map(input.metric_rows.map((r) => [String(r.metric_code ?? "").match(/(\d{1,3})$/)?.[1]?.padStart(3, "0") ?? String(r.metric_code), r]));

  const decision = decideTruthEngineSelection({ comparisons, p1Name: input.p1, p2Name: input.p2 });
  const audit = runTruthEngineAudit(comparisons, input.p1, input.p2);
  const selected = decision.outcome === "INSUFFICIENT_EVIDENCE" ? null : decision.outcome;
  const verification = runVerificationAudit(comparisons, input.p1, input.p2);
  const disagreement = runDisagreementAudit(comparisons, selected, input.p1, input.p2);
  const underdog = runUnderdogAnalysis(comparisons, selected, input.p1, input.p2);
  const stress = runStressTest(comparisons, input.p1, input.p2);

  const p1Support = supportFor("P1", decision.families);
  const p2Support = supportFor("P2", decision.families);

  const metricProfile: MetricProfileRow[] = comparisons
    .slice()
    .sort((a, b) => a.metric_code.localeCompare(b.metric_code))
    .map((c) => {
      const row = byCode.get(c.metric_code);
      const spec = COMPARISON_SPECS[c.metric_code];
      const reliability = row?.reliability === null || row?.reliability === undefined ? null : Number(row.reliability);
      return {
        metric_code: c.metric_code,
        metric_name: row?.metric_name ?? null,
        comparison_label: c.label,
        p1_value_raw: row?.p1_value ?? null,
        p2_value_raw: row?.p2_value ?? null,
        p1_number: c.p1_number,
        p2_number: c.p2_number,
        direction: c.direction,
        favours: c.favours,
        status: c.status,
        reason: c.reason,
        differential: c.differential,
        materiality: spec?.materiality ?? null,
        magnitude_ratio: magnitudeRatio(c),
        contributed_directional_evidence: c.status === "COMPARED" && (c.favours === "P1" || c.favours === "P2"),
        evidence_family_spec: c.family,
        evidence_family_persisted: row?.evidence_family ?? null,
        p1_treatment: row?.p1_treatment ?? null,
        p2_treatment: row?.p2_treatment ?? null,
        p1_status: row?.p1_status ?? null,
        p2_status: row?.p2_status ?? null,
        p1_unavailable_reason: row?.p1_unavailable_reason ?? null,
        p2_unavailable_reason: row?.p2_unavailable_reason ?? null,
        sample_context: row?.sample ?? null,
        reliability: Number.isFinite(reliability as number) ? (reliability as number) : null,
        source: row?.source ?? null,
        matrix_derived: row?.matrix_derived ?? null,
      };
    });

  // Why did a metric not become evidence FOR THIS PLAYER? Three genuinely different
  // answers, kept apart because the question asked for exactly that distinction:
  //
  //   own_supply_failure           -- this side never produced a usable value (the provider
  //                                   or the data pipeline failed, or no source exists).
  //   rejected_on_evidential_grounds -- BOTH sides produced a value and the engine refused
  //                                   the comparison anyway, on its own declared sample
  //                                   floor. That is the engine working, not a failure.
  //   supplied_but_unused          -- this side's value was fine; the comparison still could
  //                                   not be made, because the OTHER side had nothing. This
  //                                   is never held against either player.
  const USABLE = new Set(["DIRECT", "RECONSTRUCTED", "PARTIAL"]);
  const rejectionFor = (side: Side) => {
    const rows = metricProfile.filter((m) => m.status !== "COMPARED");
    const sideSuppliedOk = (m: MetricProfileRow) => {
      const status = side === "P1" ? m.p1_status : m.p2_status;
      const treatment = side === "P1" ? m.p1_treatment : m.p2_treatment;
      return status === "COMPLETE" && USABLE.has(String(treatment ?? ""));
    };
    const ownFailure = rows.filter((m) => !sideSuppliedOk(m));
    const evidential = rows.filter((m) => sideSuppliedOk(m) && m.status === "INSUFFICIENT_SAMPLE");
    return {
      rejected_metrics: rows.length,
      own_supply_failure: ownFailure.length,
      rejected_on_evidential_grounds: evidential.length,
      supplied_but_unused: rows.length - ownFailure.length - evidential.length,
    };
  };

  const pathwaysFor = (side: Side) => {
    // runUnderdogAnalysis only ever analyses the NON-selected side, and analyses nobody at
    // all when there is no selection. Re-running it with the other side nominated as
    // "selected" is how each player gets its own pathway census on identical terms.
    const other: Side = side === "P1" ? "P2" : "P1";
    const analysis = runUnderdogAnalysis(comparisons, other, input.p1, input.p2);
    return {
      evaluated: underdog.underdog_side === side,
      pathways: analysis.pathways.map((p) => `${p.pathway_type}(${p.viability}, ${p.magnitude_ratio}x)`),
      viability: analysis.overall_viability,
      reason: analysis.reason,
    };
  };

  const disagreementFor = (side: Side) => {
    // "What independent evidence argues AGAINST this player" = run the adversarial audit
    // with this player nominated as the selection.
    const asSelected = runDisagreementAudit(comparisons, side, input.p1, input.p2);
    return {
      challenged: disagreement.challenged_side === side,
      contradiction_families: asSelected.contradiction_families.map((f) => `${f.family}(${f.severity})`),
      severity: asSelected.overall_severity,
      risk: side === "P1" ? disagreement.p1_risk : disagreement.p2_risk,
    };
  };

  // Production now genuinely evaluates BOTH players' Stress profiles (truth-engine-audit.ts:
  // runStressTest), not just the selected side -- so both are "evaluated by production" in
  // the sense that matters (the recomputation is real, not a diagnostic-only mirror). The
  // BASE/ADVERSE/FAVOURABLE `cases` detail production persists still only names the leader.
  const stressP1 = stressProfileFor("P1", stress.p1, true);
  const stressP2 = stressProfileFor("P2", stress.p2, true);

  const familyVote = familyVoteLeader(decision.families);
  const leaderSupport = familyVote === "P1" ? p1Support : familyVote === "P2" ? p2Support : null;
  const afterThreshold: StageComparison = leaderSupport?.meets_threshold ? familyVote : familyVote === "TIE" || familyVote === "INSUFFICIENT" ? familyVote : "INSUFFICIENT";
  const afterLofo: StageComparison =
    afterThreshold === "P1" || afterThreshold === "P2" ? (decision.flipping_families.length ? "INSUFFICIENT" : afterThreshold) : afterThreshold;

  // Verification/Disagreement/Underdog are diagnostic layers: production reads them but
  // never lets them change the selected side. They are traced anyway, because "did they
  // change it?" is precisely the question under audit.
  // Verification cannot change the selected side in production -- it reports per-family
  // findings and nothing reads them back into the decision. The trace records that fact by
  // carrying the previous stage's comparison through, and cross-checks it: where the
  // decision core has a leader, verification's own family census must agree with it, and a
  // disagreement here would itself be a defect worth surfacing.
  const verificationOwnLeader = verificationLeader(verification.supports_p1_families, verification.supports_p2_families);
  const afterVerification: StageComparison = afterLofo;
  const verificationAgreesWithCore = afterLofo !== "P1" && afterLofo !== "P2" ? true : verificationOwnLeader === afterLofo;
  const afterDisagreement: StageComparison = afterVerification;
  const afterUnderdog: StageComparison = afterDisagreement;
  // A selection is genuinely removed at Stress only on the one comparative finding that can
  // legitimately withdraw it: the opponent surviving the identical scrutiny the leader does
  // not (production's `comparative_robustness === "CHALLENGER_MORE_ROBUST"`). This mirrors
  // `runTruthEngineAudit` exactly -- `stress.changed` (the LEADER's own margin narrowing) is
  // diagnostic only and no longer withdraws a selection in production, so it must not
  // withdraw one in this reconstruction either.
  const afterStress: StageComparison =
    afterUnderdog === "P1" || afterUnderdog === "P2"
      ? stress.comparative_robustness === "CHALLENGER_MORE_ROBUST"
        ? stress.winner_after === "INSUFFICIENT_EVIDENCE"
          ? "INSUFFICIENT"
          : (stress.winner_after as StageComparison)
        : afterUnderdog
      : afterUnderdog;

  const finalStored: StageComparison =
    input.stored_independent_winner === null
      ? "INSUFFICIENT"
      : input.stored_independent_winner === input.p1
        ? "P1"
        : input.stored_independent_winner === input.p2
          ? "P2"
          : "INSUFFICIENT";

  const stageThatRemovedTheLeader =
    familyVote !== "P1" && familyVote !== "P2"
      ? null
      : afterThreshold === "INSUFFICIENT"
        ? `DECISION CORE (${EVIDENCE_SELECTION_THRESHOLD}% directional threshold)`
        : afterLofo === "INSUFFICIENT"
          ? "DECISION CORE (leave-one-family-out reversal)"
          : afterStress === "INSUFFICIENT" || (afterStress !== afterUnderdog)
            ? "STRESS (adverse one-noise-floor recomputation)"
            : finalStored === "INSUFFICIENT"
              ? "PERSISTENCE (stored verdict disagrees with the reconstruction)"
              : null;

  const trace: StageTrace = {
    family_vote: familyVote,
    after_threshold: afterThreshold,
    after_lofo_initial_decision: afterLofo,
    after_verification: afterVerification,
    after_disagreement: afterDisagreement,
    after_underdog: afterUnderdog,
    after_stress: afterStress,
    final_stored: finalStored,
    stage_that_removed_the_leader: stageThatRemovedTheLeader,
  };

  const symmetricVerdict = symmetricStressVerdict(afterLofo, stressP1, stressP2);
  const comparedCount = comparisons.filter((c) => c.status === "COMPARED").length;
  const oneSidedCount = comparisons.filter((c) => c.status === "ONE_SIDED_EVIDENCE").length;
  const SUPPLY_FAILURE_STATUSES = new Set(["TREATMENT_NOT_USABLE", "ONE_SIDED_EVIDENCE", "VALUE_NOT_PARSEABLE"]);
  const supplyFailureRows = comparisons.filter((c) => SUPPLY_FAILURE_STATUSES.has(c.status));
  const supplyCounts = new Map<string, number>();
  for (const c of supplyFailureRows) supplyCounts.set(c.status, (supplyCounts.get(c.status) ?? 0) + 1);
  const supplyBreakdown = [...supplyCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k} x${n}`).join(", ") || "none";
  const leaderIsP1 = afterLofo === "P1";
  const { classification, stage, explanation } = classify({
    trace,
    p1: p1Support,
    p2: p2Support,
    symmetricVerdict,
    leaderStress: leaderIsP1 ? stressP1 : stressP2,
    challengerStress: leaderIsP1 ? stressP2 : stressP1,
    decision,
    comparedCount,
    oneSidedCount,
    activeCodes: comparisons.length,
    supplyFailures: supplyFailureRows.length,
    supplyBreakdown,
  });

  // SYMMETRY SELF-CHECK. Swap the two players' values and confirm every side-specific
  // output swaps with them. A false here would mean the engine treats "P1" as privileged.
  const swappedRows = input.metric_rows.map((r) => ({ ...r, p1_value: r.p2_value, p2_value: r.p1_value, p1_treatment: r.p2_treatment, p2_treatment: r.p1_treatment }));
  const swapped = decideTruthEngineSelection({ comparisons: compareMetricRows(swappedRows), p1Name: input.p2, p2Name: input.p1 });
  const swappedP1 = supportFor("P1", swapped.families);
  const mirrorSymmetric =
    swapped.families.length === decision.families.length &&
    Math.abs(swappedP1.support_ratio_percent - p2Support.support_ratio_percent) < 1e-9 &&
    (swapped.outcome === "INSUFFICIENT_EVIDENCE"
      ? decision.outcome === "INSUFFICIENT_EVIDENCE"
      : swapped.outcome === (decision.outcome === "P1" ? "P2" : "P1"));

  const disP1 = disagreementFor("P1");
  const disP2 = disagreementFor("P2");

  return {
    match_id: input.match_id,
    audit_run_id: input.audit_run_id,
    p1: input.p1,
    p2: input.p2,
    p1_player_id: input.p1_player_id ?? null,
    p2_player_id: input.p2_player_id ?? null,
    metric_profile: metricProfile,
    families: decision.families.map((f) => ({ family: f.family, vote: f.vote, supporting_metrics: f.supporting_metrics, opposing_metrics: f.opposing_metrics, neutral_metrics: f.neutral_metrics })),
    p1_support: p1Support,
    p2_support: p2Support,
    verification_p1: { supports: verification.supports_p1_families, findings: verification.findings.length, ...rejectionFor("P1") },
    verification_p2: { supports: verification.supports_p2_families, findings: verification.findings.length, ...rejectionFor("P2") },
    disagreement_p1: { challenged: disP1.challenged, contradiction_families: disP1.contradiction_families, severity: disP1.severity, risk: disP1.risk },
    disagreement_p2: { challenged: disP2.challenged, contradiction_families: disP2.contradiction_families, severity: disP2.severity, risk: disP2.risk },
    underdog_p1: pathwaysFor("P1"),
    underdog_p2: pathwaysFor("P2"),
    stress_p1: stressP1,
    stress_p2: stressP2,
    comparison_before_stress: afterUnderdog,
    comparison_after_stress: afterStress,
    symmetric_stress_verdict: symmetricVerdict,
    verification_agrees_with_decision_core: verificationAgreesWithCore,
    trace,
    final_deterministic_state: audit.audit_winner_side ?? "INSUFFICIENT_EVIDENCE",
    refusal_reason: audit.final_reason,
    classification,
    exact_stage_that_caused_refusal: stage,
    explanation,
    secondary_observations: [
      ...(classification !== "DATA_OR_PIPELINE_BUG" && supplyFailureRows.length >= comparedCount && comparedCount > 0
        ? [`Thin evidence supply: only ${comparedCount} of ${comparisons.length} active metrics were comparable; ${supplyFailureRows.length} never yielded comparable evidence (${supplyBreakdown}).`]
        : []),
      ...(underdog.underdog_side === null
        ? ["Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone."]
        : []),
      ...(input.p1_player_id === null || input.p2_player_id === null
        ? ["P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone."]
        : []),
      ...(stress.stability === "NOT_APPLICABLE" && (afterLofo === "P1" || afterLofo === "P2")
        ? ["Production recorded stress stability NOT_APPLICABLE despite a selection existing."]
        : []),
    ],
    mirror_check_symmetric: mirrorSymmetric,
    raw: { decision, audit, comparisons },
  };
}
