/**
 * MIRROR OF builderScoringService.ts — MUST be kept in sync manually; do not edit without
 * checking the source file for drift; see productionFormulaMirror.test.ts for the pinning test.
 *
 * Pinned against: artifacts/api-server/src/services/parlayBuilder/builderScoringService.ts
 * as of commit db28f8371f2ec4bbfc2b2b3d0e341011cfd8f788 (line numbers below refer to that
 * version). If builderScoringService.ts changes any of the functions mirrored here, this file
 * goes stale silently unless productionFormulaMirror.test.ts is re-run and re-checked against
 * the source by hand — there is no automated drift detector. Every offline-experiment script
 * that reports a `formulaVersion` in its provenance record should cite this header's pinned
 * commit alongside the function name it used, e.g.:
 *   "toDecision via productionFormulaMirror.ts pinned against builderScoringService.ts@db28f83"
 *
 * WHY THIS FILE EXISTS AT ALL: builderScoringService.ts is a hard-rule production file that
 * must never be modified (not even to add an `export` keyword) — see AGENTS.md / the audit
 * task brief. Several pure helper functions needed for offline replay are not exported:
 * closenessRiskFloor, toReliabilityGrade, toParlayGrade, toDecision, the closeness-signal
 * averaging block, and the removalProbability formula. Rather than reimplementing them from
 * memory (drift risk) or exporting them from the production file (forbidden), they are copied
 * here byte-for-byte from the pinned commit, each function directly citing its source line
 * range. This is the ONLY file in offlineExperiments/ allowed to contain formula logic
 * resembling production code — every experiment script imports from here, never reimplements
 * a formula a third time.
 *
 * Everything that IS safely exported from builderScoringService.ts (thinDataRiskFloor,
 * THIN_DATA_RISK_FLOOR, MIN_SAMPLE_FOR_TIER_COMPARISON, computePlayerStats, and the
 * BuilderSnapshot/PlayerStats/FactorScore *types*) is re-exported from here instead of
 * copied, so there is exactly one source of truth for those and zero drift risk for them.
 */

import {
  thinDataRiskFloor,
  THIN_DATA_RISK_FLOOR,
  MIN_SAMPLE_FOR_TIER_COMPARISON,
  computePlayerStats,
  __TEST_computeScoring,
  type PlayerStats,
  type FactorScore,
  type __TEST_ScoringResult,
} from "../../services/parlayBuilder/builderScoringService.js";

export {
  thinDataRiskFloor,
  THIN_DATA_RISK_FLOOR,
  MIN_SAMPLE_FOR_TIER_COMPARISON,
  computePlayerStats,
  __TEST_computeScoring,
};
export type { PlayerStats, FactorScore, __TEST_ScoringResult };

/** Mirror of builderScoringService.ts clamp() (line ~285-287). */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// Mirror of builderScoringService.ts closenessRiskFloor() (line ~347-351).
// At cs ≤ 50 the floor is 0. Between 50 and 80 it ramps linearly from 0→40.
// Between 80 and 100 it continues at a shallower slope to a ceiling of 55.
// ---------------------------------------------------------------------------
export function closenessRiskFloor(cs: number): number {
  if (cs <= 50) return 0;
  if (cs <= 80) return Math.round(((cs - 50) / 30) * 40); // 50→0 … 80→40
  return Math.round(40 + ((cs - 80) / 20) * 15); // 80→40 … 100→55
}

// ---------------------------------------------------------------------------
// Mirror of builderScoringService.ts toReliabilityGrade() (line ~949-976).
// ---------------------------------------------------------------------------
export function toReliabilityGrade(validationScore: number, coverage: number): "A" | "B" | "C" | "D" | "F" {
  const coverageCap: "A" | "B" | "C" | "D" | "F" =
    coverage >= 80 ? "A" : coverage >= 65 ? "B" : coverage >= 50 ? "C" : coverage >= 35 ? "D" : "F";

  const scoreGrade: "A" | "B" | "C" | "D" | "F" =
    validationScore >= 76 ? "A" : validationScore >= 63 ? "B" : validationScore >= 50 ? "C" : validationScore >= 38 ? "D" : "F";

  const ORDER = ["F", "D", "C", "B", "A"] as const;
  return ORDER[Math.min(ORDER.indexOf(coverageCap), ORDER.indexOf(scoreGrade))];
}

// ---------------------------------------------------------------------------
// Mirror of builderScoringService.ts toParlayGrade() (line ~978-989).
// ---------------------------------------------------------------------------
export function toParlayGrade(validationScore: number, riskScore: number, grade: string): "Elite" | "Solid" | "Weak" | "Reject" {
  const adj = validationScore - riskScore * 0.35;
  if (adj >= 58 && grade <= "B") return "Elite";
  if (adj >= 34) return "Solid";
  if (adj >= 22) return "Weak";
  return "Reject";
}

// ---------------------------------------------------------------------------
// Mirror of builderScoringService.ts toDecision() (line ~991-1013).
// ---------------------------------------------------------------------------
export function toDecision(
  validationScore: number,
  riskScore: number,
  grade: string,
  coverage: number,
  criticalFlags: string[],
): "KEEP" | "BORDERLINE" | "REMOVE" {
  const hasCritical = criticalFlags.some(
    (f) =>
      f.includes("injury") ||
      f.includes("retirement") ||
      f.includes("market disagreement") ||
      f.includes("stale data") ||
      f.includes("No match history"),
  );

  if (grade === "F" || validationScore <= 33 || riskScore >= 70) return "REMOVE";
  if (hasCritical || coverage < 40) return "BORDERLINE";
  if (validationScore >= 62 && riskScore <= 44) return "KEEP";

  return "BORDERLINE";
}

// ---------------------------------------------------------------------------
// Mirror of builderScoringService.ts removalProbability formula (line ~1994):
//   const removalProbability = clamp(round((100-validationScore)*0.55 + riskScore*0.45), 0, 100);
// ---------------------------------------------------------------------------
export function computeRemovalProbability(validationScore: number, riskScore: number): number {
  return clamp(Math.round((100 - validationScore) * 0.55 + riskScore * 0.45), 0, 100);
}

// ---------------------------------------------------------------------------
// Mirror of the KEEP/REMOVE threshold constants embedded in toDecision() above, extracted so
// experiment scripts (Experiment #3 — borderline separation) can compute distance-to-boundary
// without re-parsing the function body. These are NOT independent constants — they are read
// directly off the toDecision() logic mirrored above and must be updated together with it.
//   KEEP line:    validationScore >= 62 AND riskScore <= 44
//   REMOVE line:  validationScore <= 33 OR  riskScore  >= 70
// ---------------------------------------------------------------------------
export const KEEP_VALIDATION_THRESHOLD = 62;
export const KEEP_RISK_THRESHOLD = 44;
export const REMOVE_VALIDATION_THRESHOLD = 33;
export const REMOVE_RISK_THRESHOLD = 70;

/**
 * Signed distance (in score points) from the KEEP boundary line (val>=62, risk<=44), in the
 * "toward KEEP" direction — positive means past the KEEP line on both axes combined via the
 * minimum of the two margins (the binding constraint), matching how toDecision() itself is an
 * AND of two independent thresholds. Used by Experiment #3 to see how far into "KEEP territory"
 * a BORDERLINE row sits.
 */
export function distanceToKeepLine(validationScore: number, riskScore: number): number {
  const valMargin = validationScore - KEEP_VALIDATION_THRESHOLD;
  const riskMargin = KEEP_RISK_THRESHOLD - riskScore;
  return Math.min(valMargin, riskMargin);
}

/**
 * Signed distance (in score points) from the REMOVE boundary (val<=33 OR risk>=70), in the
 * "toward REMOVE" direction — since REMOVE is an OR of two thresholds, distance is the MAX of
 * the two individual margins (whichever threshold is closer to being crossed).
 */
export function distanceToRemoveLine(validationScore: number, riskScore: number): number {
  const valMargin = REMOVE_VALIDATION_THRESHOLD - validationScore;
  const riskMargin = riskScore - REMOVE_RISK_THRESHOLD;
  return Math.max(valMargin, riskMargin);
}

// ---------------------------------------------------------------------------
// Mirror of the closeness-signal averaging block, builderScoringService.ts lines ~1830-1863
// (identically duplicated at lines ~2934-2949 inside __TEST_computeScoring — this mirror
// matches both, since they are the same logic). Given the four independent closeness signals
// (win-rate gap, surface gap, market-implied-probability gap, ranking gap), each computed only
// when its own data-sufficiency gate is met, returns both the per-signal breakdown (for
// Experiment #7's decomposition) and the final averaged closenessScore (0-100, used as the
// risk-floor input).
//
// NOTE: production computes this from PlayerStats + marketOdds + selRank/oppRank; this mirror
// takes the same primitives directly so it can be called without constructing a full
// PlayerStats object when only closeness inputs are available.
// ---------------------------------------------------------------------------
export interface ClosenessComponentInputs {
  selWinRate: number;
  oppWinRate: number;
  selWinRateConfidence: number;
  oppWinRateConfidence: number;
  surface: string | null;
  selSurfaceTotal: number;
  oppSurfaceTotal: number;
  selSurfaceWinRate: number;
  oppSurfaceWinRate: number;
  /** Decimal odds for the selected player, or null/undefined if no market data — per row admissibility. */
  marketOdds: number | null | undefined;
  selRank: number | null;
  oppRank: number | null;
}

export interface ClosenessComponents {
  winRateGapSignal: number | null;
  surfaceGapSignal: number | null;
  marketGapSignal: number | null;
  rankingGapSignal: number | null;
  /** Average of whichever signals were present; 50 (neutral) if none were. */
  closenessScore: number;
}

export function computeClosenessComponents(inputs: ClosenessComponentInputs): ClosenessComponents {
  const signals: number[] = [];
  let winRateGapSignal: number | null = null;
  let surfaceGapSignal: number | null = null;
  let marketGapSignal: number | null = null;
  let rankingGapSignal: number | null = null;

  const winRateSignalConf = Math.min(inputs.selWinRateConfidence, inputs.oppWinRateConfidence);
  if (winRateSignalConf > 0) {
    const winRateGap = Math.abs(inputs.selWinRate - inputs.oppWinRate);
    const rawSignal = clamp(Math.round((1 - winRateGap / 0.4) * 100), 0, 100);
    winRateGapSignal = Math.round(rawSignal * winRateSignalConf);
    signals.push(winRateGapSignal);
  }

  if (inputs.surface && inputs.selSurfaceTotal >= 5 && inputs.oppSurfaceTotal >= 5) {
    const surfaceGap = Math.abs(inputs.selSurfaceWinRate - inputs.oppSurfaceWinRate);
    surfaceGapSignal = clamp(Math.round((1 - surfaceGap / 0.4) * 100), 0, 100);
    signals.push(surfaceGapSignal);
  }

  if (inputs.marketOdds != null) {
    const impliedProb = 1 / inputs.marketOdds;
    marketGapSignal = clamp(Math.round((1 - Math.abs(impliedProb - 0.5) * 2) * 100), 0, 100);
    signals.push(marketGapSignal);
  }

  if (inputs.selRank != null && inputs.oppRank != null) {
    const relGap = Math.abs(inputs.selRank - inputs.oppRank) / Math.max(inputs.selRank, inputs.oppRank);
    rankingGapSignal = clamp(Math.round((1 - relGap) * 100), 0, 100);
    signals.push(rankingGapSignal);
  }

  const closenessScore = signals.length > 0 ? Math.round(signals.reduce((s, v) => s + v, 0) / signals.length) : 50;

  return { winRateGapSignal, surfaceGapSignal, marketGapSignal, rankingGapSignal, closenessScore };
}

// ---------------------------------------------------------------------------
// Mirror of the validation-score + dataCoverage aggregation, builderScoringService.ts lines
// ~2906-2911 (identical block also present inline in computeBuilderScore's non-test path):
//   const availF = factors.filter(f => f.status !== "unavailable");
//   const totalW = availF.reduce((s, f) => s + f.weight, 0);
//   const validationScore = Math.round(availF.reduce((s, f) => s + f.score * (f.weight / totalW), 0));
//   const unavailW = factors.filter(f => f.status === "unavailable").reduce((s, f) => s + f.weight, 0);
//   const dataCoverage = clamp(Math.round((1 - unavailW) * 100), 0, 100);
// Needed by Experiment #6 (market-weight sensitivity), which recomputes validationScore from a
// leg's STORED factor_scores under a hypothetical marketConsensus weight, without needing to
// re-fetch match history — the factor scores themselves don't change, only the weight blend.
// ---------------------------------------------------------------------------
export function computeValidationScoreAndCoverage(
  factors: ReadonlyArray<Pick<FactorScore, "score" | "weight" | "status">>,
): { validationScore: number; dataCoverage: number } {
  const availF = factors.filter((f) => f.status !== "unavailable");
  const totalW = availF.reduce((s, f) => s + f.weight, 0);
  const validationScore = totalW > 0 ? Math.round(availF.reduce((s, f) => s + (f.score * f.weight) / totalW, 0)) : 50;
  const unavailW = factors.filter((f) => f.status === "unavailable").reduce((s, f) => s + f.weight, 0);
  const dataCoverage = clamp(Math.round((1 - unavailW) * 100), 0, 100);
  return { validationScore, dataCoverage };
}

/**
 * NOT a mirror of any single production line — a sweep helper for Experiment #6. Substitutes a
 * hypothetical weight for the `marketConsensus` factor and proportionally redistributes the
 * delta across every OTHER factor's weight so the total stays 1.0, using the same proportional
 * redistribution methodology DEFAULT_WEIGHTS' own header comment documents production having
 * used historically when utr/holdBreak were removed ("redistributed by ×1/0.85 across the
 * remaining 17 factors"). This is an experimental variant, not a claim about what production
 * does today — every experiment script that uses it must label its output as a sweep, never as
 * a measured production value.
 */
export function reweightMarketConsensus<F extends Pick<FactorScore, "key" | "weight">>(
  factors: ReadonlyArray<F>,
  newMarketConsensusWeight: number,
): F[] {
  const original = factors.find((f) => f.key === "marketConsensus");
  if (!original) {
    throw new Error("reweightMarketConsensus: no factor with key 'marketConsensus' found in the given factor list.");
  }
  const oldWeight = original.weight;
  const restOldSum = factors.filter((f) => f.key !== "marketConsensus").reduce((s, f) => s + f.weight, 0);
  const restNewSum = 1 - newMarketConsensusWeight;
  const scale = restOldSum > 0 ? restNewSum / restOldSum : 0;
  void oldWeight;
  return factors.map((f) =>
    f.key === "marketConsensus" ? { ...f, weight: newMarketConsensusWeight } : { ...f, weight: f.weight * scale },
  );
}

/**
 * Production's DEFAULT_WEIGHTS.marketConsensus and AGREEMENT_EDGE_WEIGHTS.marketConsensus,
 * mirrored as plain data (builderScoringService.ts lines ~234, ~274) for Experiment #6's
 * weight-sensitivity sweep, which needs to know the CURRENT production value to sweep around.
 * These are the two figures the audit task brief names explicitly. If builderScoringService.ts
 * changes either value, this must be updated to match — it is data, not logic, but it is still
 * pinned to the same commit as the rest of this file.
 */
export const CURRENT_MARKET_CONSENSUS_VALIDATION_WEIGHT = 0.04;
export const CURRENT_MARKET_CONSENSUS_AGREEMENT_EDGE_WEIGHT = 5.0;
