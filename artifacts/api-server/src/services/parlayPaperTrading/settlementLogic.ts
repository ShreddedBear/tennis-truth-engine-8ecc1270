/**
 * Pure settlement/grading rules — DB-free by design, same reasoning as eligibility.ts.
 *
 * Void semantics (isVoidResult) match the ALREADY-established Research V1 convention exactly
 * (`attachParlayBuilderResearchV1Outcomes.ts`: `isVoid = cancelled || walkover`) -- retired
 * matches are fetched and reported but a retired-match win still counts toward accuracy. No new
 * vocabulary invented here; this is the same historical_matches.retired/walkover/cancelled
 * boolean triage the rest of the codebase already uses.
 *
 * THE central rule this file exists to enforce: grading compares
 *   actualWinnerId === builderPickedPlayerId
 * — never selectedPlayerId, never the KEEP/BORDERLINE/REMOVE decision. The old
 * "human selection was validated correctly" semantics from builder_decision_log/
 * parlay_leg_outcomes must never leak into this autonomous system's accuracy number.
 */

export type ResultType = "normal" | "walkover" | "retired" | "cancelled";

export interface MatchOutcomeFlags {
  cancelled: boolean;
  walkover: boolean;
  retired: boolean;
}

export function deriveResultType(flags: MatchOutcomeFlags): ResultType {
  if (flags.cancelled) return "cancelled";
  if (flags.walkover) return "walkover";
  if (flags.retired) return "retired";
  return "normal";
}

/** cancelled | walkover void the result entirely (no winner can be trusted). Retired does NOT. */
export function isVoidResult(resultType: ResultType): boolean {
  return resultType === "cancelled" || resultType === "walkover";
}

export interface GradingInput {
  /** THE prospective prediction. Never selectedPlayerId, never `decision`. */
  builderPickedPlayerId: string;
  actualWinnerId: string | null;
  resultType: ResultType;
}

export interface GradingResult {
  includedInAccuracy: boolean;
  /** null when not gradeable yet (no winner) or void (excluded from accuracy, not "wrong"). */
  gradedCorrect: boolean | null;
}

export function gradePaperTrade(input: GradingInput): GradingResult {
  if (input.actualWinnerId == null) {
    return { includedInAccuracy: false, gradedCorrect: null };
  }
  if (isVoidResult(input.resultType)) {
    return { includedInAccuracy: false, gradedCorrect: null };
  }
  return {
    includedInAccuracy: true,
    gradedCorrect: input.actualWinnerId === input.builderPickedPlayerId,
  };
}

/** True once the fixture's scheduled start has passed — the hard PIT boundary past which no NEW decision may ever be created. */
export function hasMatchStarted(scheduledStartAt: Date, now: Date): boolean {
  return now.getTime() >= scheduledStartAt.getTime();
}
