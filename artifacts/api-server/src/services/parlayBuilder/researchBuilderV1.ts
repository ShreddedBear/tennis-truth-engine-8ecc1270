/**
 * COUNTERFACTUAL_RESEARCH_V1 — an independent, point-in-time-safe Parlay Builder research scorer.
 *
 * This is explicitly NOT the production Parlay Builder and NOT a claim that any Builder existed
 * historically. Phase 0 (docs/historical-builder-integration/) established, with evidence, that
 * the production Builder's algorithm and calibration both postdate the 2026-04-22..2026-06-02
 * cohort by 3-4.5 months. This module answers a different, legitimate question: "what would an
 * independent, Builder-shaped scoring layer -- using ONLY information available before each
 * match's own cutoffAt, and NEVER fit on this same cohort -- have said?"
 *
 * Every design choice below exists to make that counterfactual honest rather than merely
 * plausible-looking:
 *
 *  - Factor STRUCTURE (which signals to look at: surface Elo, serve/return, recent form, surface
 *    record, overall record, head-to-head) is reused from the production Builder's documented
 *    architecture and from the Prediction Engine's own canonical, shared, already-audited modules
 *    (computeSurfaceEloModule / computeServeReturnModule from services/shared/predictionCalculations.js
 *    -- the one sanctioned place the Builder is allowed to depend on Prediction Engine code, per
 *    that barrel's own doc comment).
 *  - Factor WEIGHTS are EQUAL across available factors, not the production DEFAULT_WEIGHTS.
 *    Phase 0 found the production weights are attributed to a 2026-08-11 ablation whose source
 *    rows no longer exist, so overlap with THIS cohort can be neither confirmed nor ruled out --
 *    reusing those numbers here would risk exactly the "future weights selected using the cohort"
 *    violation this research run must avoid. Equal weighting requires no fitting of any kind: zero
 *    lookahead risk, by construction.
 *  - NO calibration curve is applied. `builderScore` is the raw, uncalibrated 0-100 weighted
 *    average. Fitting a calibration mapping would require either post-cutoff data (a PIT
 *    violation) or fitting on this exact cohort (circular). `calibrationSnapshotId`/
 *    `calibrationFittedAt` are always null for V1 and the schema documents why.
 *  - Decision thresholds (KEEP/BORDERLINE/REMOVE) are fixed, round, symmetric numbers around the
 *    neutral 50 (55 / 45) -- NOT the production thresholds, which are themselves described in
 *    builderScoringService.ts as "train/test validated" against a corpus whose date range is not
 *    verified clean of this cohort either.
 *  - Per-factor score CONVERSION formulas (rating differential -> 0-100 score) are copied
 *    verbatim from the production Builder's own mechanical transforms (e.g.
 *    `clamp(round(50 + (a-b)/2), 5, 95)` for serve/return) -- these are simple, transparent,
 *    non-fit arithmetic, not tuned parameters, so reusing them is architecture reuse, not
 *    lookahead.
 *  - Market consensus, travel fatigue, and injury risk are always UNAVAILABLE here (live-only
 *    signals with no historical reconstruction path, exactly as the production Builder's own
 *    backfill mode already treats them) -- never neutrally guessed at full weight.
 */

import type { MatchHistoryIndex } from "../historicalData/matchRecordReconstruction.js";
import { reconstructPlayerMatchHistory, reconstructHeadToHead } from "../historicalData/matchRecordReconstruction.js";
import { computeSurfaceEloModule, computeServeReturnModule, type SurfaceEloResult, type ServeReturnResult } from "../shared/predictionCalculations.js";
import type { MatchRecord, Surface } from "../tennisData/types.js";
import { computeConfigFingerprint } from "./builderVersioning.js";

export const RESEARCH_BUILDER_V1_VERSION = "COUNTERFACTUAL_RESEARCH_V1" as const;

/** The one, fixed, immutable Research V1 specification -- never tuned, never refit per run. */
export const RESEARCH_V1_FACTOR_KEYS = [
  "surfaceElo",
  "serveAdvantage",
  "returnAdvantage",
  "recentForm",
  "surfaceRecord",
  "overallAdvantage",
  "headToHead",
] as const;
export type ResearchV1FactorKey = (typeof RESEARCH_V1_FACTOR_KEYS)[number];

/**
 * Fixed, non-fit decision thresholds, expressed as CONFIDENCE in the independently-picked player
 * (i.e. max(builderScore, 100 - builderScore), which always ranges 50-100 -- 50 is a coin flip,
 * 100 is maximal confidence). Round numbers chosen for interpretability only, never fit to any
 * corpus: >=60 confidence -> KEEP, 52-59 -> BORDERLINE, <52 (near coin flip) -> REMOVE.
 */
export const RESEARCH_V1_DECISION_THRESHOLDS = { keepAtConfidence: 60, removeBelowConfidence: 52 } as const;

export const RESEARCH_V1_ALGORITHM_CONFIG = {
  version: RESEARCH_BUILDER_V1_VERSION,
  factorKeys: RESEARCH_V1_FACTOR_KEYS,
  weightingMethod: "equal_weight_among_available_factors",
  calibration: "none_uncalibrated_raw_score",
  decisionThresholds: RESEARCH_V1_DECISION_THRESHOLDS,
  recentFormWindow: 10,
  minMatchesForEligibility: 1,
  alwaysUnavailableFactors: ["marketConsensus", "travelFatigue", "injuryRisk"],
  notes:
    "Equal weights and fixed thresholds chosen specifically to guarantee zero lookahead: no parameter here was fit on, or selected using, the 2026-04-22..2026-06-02 cohort or any post-cutoff information.",
};

export const RESEARCH_V1_CONFIG_FINGERPRINT = computeConfigFingerprint(RESEARCH_V1_ALGORITHM_CONFIG);

export interface ResearchV1FactorScore {
  key: ResearchV1FactorKey;
  score: number | null; // 0-100, null when unavailable
  status: "available" | "unavailable";
  detail: string;
}

export interface ResearchV1ScoreResult {
  eligibility: "ELIGIBLE" | "INELIGIBLE";
  rejectionReason: string | null;
  pitStatus: "VALID_PIT" | "PIT_VIOLATION";
  builderScore: number | null;
  builderPickedPlayerId: string | null;
  builderDecision: "KEEP" | "BORDERLINE" | "REMOVE" | null;
  dataCoverage: number | null; // 0-100, % of factors with available data
  factorScores: ResearchV1FactorScore[];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function winRate(matches: MatchRecord[]): number | null {
  if (matches.length === 0) return null;
  const wins = matches.filter((m) => m.result === "W").length;
  return wins / matches.length;
}

/** Mirrors the production Builder's own mechanical rating-differential-to-score transform (non-fit arithmetic). */
function differentialScore(a: number, b: number, scale: number): number {
  return clamp(Math.round(50 + (a - b) * scale), 5, 95);
}

/**
 * PIT self-check: every match handed to this scorer must have a scheduledStartAt strictly before
 * `cutoffAt`. `reconstructPlayerMatchHistory`/`reconstructHeadToHead` already enforce this via
 * their own `beforeCutoff` boundary, but this is a defense-in-depth check on their OUTPUT, not an
 * assumption that the boundary was respected -- exactly the same posture as builderVersioning.ts's
 * PIT_VIOLATION self-check.
 */
function verifyNoLookahead(matches: MatchRecord[], cutoffAt: Date): boolean {
  const cutoffMs = cutoffAt.getTime();
  return matches.every((m) => new Date(m.date).getTime() < cutoffMs);
}

export interface ComputeResearchV1Input {
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  surface: Surface | null;
  cutoffAt: Date;
  matchHistoryIndex: MatchHistoryIndex;
}

export function computeResearchBuilderV1Score(input: ComputeResearchV1Input): ResearchV1ScoreResult {
  const { player1Id, player2Id, surface, cutoffAt, matchHistoryIndex } = input;

  const p1Matches = reconstructPlayerMatchHistory(matchHistoryIndex, player1Id, cutoffAt);
  const p2Matches = reconstructPlayerMatchHistory(matchHistoryIndex, player2Id, cutoffAt);

  const pitOk = verifyNoLookahead(p1Matches, cutoffAt) && verifyNoLookahead(p2Matches, cutoffAt);
  if (!pitOk) {
    return {
      eligibility: "INELIGIBLE",
      rejectionReason: "PIT self-check failed: reconstructed match history contained a row at or after cutoffAt.",
      pitStatus: "PIT_VIOLATION",
      builderScore: null,
      builderPickedPlayerId: null,
      builderDecision: null,
      dataCoverage: null,
      factorScores: [],
    };
  }

  if (p1Matches.length === 0 || p2Matches.length === 0) {
    return {
      eligibility: "INELIGIBLE",
      rejectionReason: `Insufficient prior match history before cutoff (player1: ${p1Matches.length}, player2: ${p2Matches.length} matches) -- no honest score can be produced.`,
      pitStatus: "VALID_PIT",
      builderScore: null,
      builderPickedPlayerId: null,
      builderDecision: null,
      dataCoverage: null,
      factorScores: [],
    };
  }

  const factors: ResearchV1FactorScore[] = [];

  // surfaceElo (shared canonical module, no opponent-quality weighting -- documented simplification)
  if (surface != null) {
    const elo: SurfaceEloResult = computeSurfaceEloModule(p1Matches, p2Matches, surface);
    factors.push({
      key: "surfaceElo",
      score: clamp(Math.round(elo.eloWinProbabilityPlayer1), 5, 95),
      status: "available",
      detail: `Surface Elo: p1=${Math.round(elo.player1SurfaceElo)} vs p2=${Math.round(elo.player2SurfaceElo)}`,
    });

    const sr: ServeReturnResult = computeServeReturnModule(p1Matches, p2Matches, surface);
    if (sr.defaulted) {
      factors.push({ key: "serveAdvantage", score: null, status: "unavailable", detail: "No set-score margin data for at least one player." });
      factors.push({ key: "returnAdvantage", score: null, status: "unavailable", detail: "No set-score margin data for at least one player." });
    } else {
      factors.push({
        key: "serveAdvantage",
        score: differentialScore(sr.player1ServeRating, sr.player2ServeRating, 0.5),
        status: "available",
        detail: `Serve rating: p1=${sr.player1ServeRating} vs p2=${sr.player2ServeRating}`,
      });
      factors.push({
        key: "returnAdvantage",
        score: differentialScore(sr.player1ReturnRating, sr.player2ReturnRating, 0.5),
        status: "available",
        detail: `Return rating: p1=${sr.player1ReturnRating} vs p2=${sr.player2ReturnRating}`,
      });
    }
  } else {
    factors.push({ key: "surfaceElo", score: null, status: "unavailable", detail: "No surface recorded for this match." });
    factors.push({ key: "serveAdvantage", score: null, status: "unavailable", detail: "No surface recorded for this match." });
    factors.push({ key: "returnAdvantage", score: null, status: "unavailable", detail: "No surface recorded for this match." });
  }

  // recentForm: win rate over the last N matches before cutoff (fixed window, no fitting)
  {
    const n = RESEARCH_V1_ALGORITHM_CONFIG.recentFormWindow;
    const p1Rate = winRate(p1Matches.slice(0, n));
    const p2Rate = winRate(p2Matches.slice(0, n));
    if (p1Rate == null || p2Rate == null) {
      factors.push({ key: "recentForm", score: null, status: "unavailable", detail: "No recent match data for at least one player." });
    } else {
      factors.push({
        key: "recentForm",
        score: differentialScore(p1Rate, p2Rate, 50),
        status: "available",
        detail: `Recent form (last ${n}): p1=${(p1Rate * 100).toFixed(0)}% vs p2=${(p2Rate * 100).toFixed(0)}%`,
      });
    }
  }

  // surfaceRecord: win rate on this specific surface before cutoff
  if (surface != null) {
    const p1Surf = p1Matches.filter((m) => m.surface === surface);
    const p2Surf = p2Matches.filter((m) => m.surface === surface);
    const p1Rate = winRate(p1Surf);
    const p2Rate = winRate(p2Surf);
    if (p1Rate == null || p2Rate == null) {
      factors.push({ key: "surfaceRecord", score: null, status: "unavailable", detail: "No matches on this surface for at least one player." });
    } else {
      factors.push({
        key: "surfaceRecord",
        score: differentialScore(p1Rate, p2Rate, 50),
        status: "available",
        detail: `Surface (${surface}) record: p1=${(p1Rate * 100).toFixed(0)}% (n=${p1Surf.length}) vs p2=${(p2Rate * 100).toFixed(0)}% (n=${p2Surf.length})`,
      });
    }
  } else {
    factors.push({ key: "surfaceRecord", score: null, status: "unavailable", detail: "No surface recorded for this match." });
  }

  // overallAdvantage: career win rate before cutoff (proxy for strength/ranking -- no rankings table dependency)
  {
    const p1Rate = winRate(p1Matches);
    const p2Rate = winRate(p2Matches);
    factors.push({
      key: "overallAdvantage",
      score: differentialScore(p1Rate!, p2Rate!, 50),
      status: "available",
      detail: `Overall record before cutoff: p1=${(p1Rate! * 100).toFixed(0)}% (n=${p1Matches.length}) vs p2=${(p2Rate! * 100).toFixed(0)}% (n=${p2Matches.length})`,
    });
  }

  // headToHead: real prior meetings before cutoff
  {
    const h2h = reconstructHeadToHead(matchHistoryIndex, player1Id, player2Id, cutoffAt);
    if (h2h.meetings.length === 0) {
      factors.push({ key: "headToHead", score: null, status: "unavailable", detail: "No prior head-to-head meetings before cutoff." });
    } else {
      const p1Wins = h2h.meetings.filter((m) => m.winnerId === player1Id).length;
      const rate = p1Wins / h2h.meetings.length;
      factors.push({
        key: "headToHead",
        score: differentialScore(rate, 1 - rate, 50),
        status: "available",
        detail: `Head-to-head before cutoff: p1 won ${p1Wins}/${h2h.meetings.length}`,
      });
    }
  }

  const available = factors.filter((f) => f.status === "available" && f.score != null);
  const dataCoverage = Math.round((available.length / RESEARCH_V1_FACTOR_KEYS.length) * 100);

  if (available.length === 0) {
    return {
      eligibility: "INELIGIBLE",
      rejectionReason: "No factor produced an available score -- no honest evidence exists for this match.",
      pitStatus: "VALID_PIT",
      builderScore: null,
      builderPickedPlayerId: null,
      builderDecision: null,
      dataCoverage: 0,
      factorScores: factors,
    };
  }

  const builderScore = Math.round(available.reduce((sum, f) => sum + (f.score as number), 0) / available.length);
  const builderPickedPlayerId = builderScore >= 50 ? player1Id : player2Id;

  // Confidence in the picked player, always 50 (coin flip) to 100 (maximal). Decision reflects
  // how well-supported the independent pick is, not a directional bias toward either player.
  const confidence = Math.max(builderScore, 100 - builderScore);
  const { keepAtConfidence, removeBelowConfidence } = RESEARCH_V1_DECISION_THRESHOLDS;
  const builderDecision: "KEEP" | "BORDERLINE" | "REMOVE" =
    confidence >= keepAtConfidence ? "KEEP" : confidence < removeBelowConfidence ? "REMOVE" : "BORDERLINE";

  return {
    eligibility: "ELIGIBLE",
    rejectionReason: null,
    pitStatus: "VALID_PIT",
    builderScore,
    builderPickedPlayerId,
    builderDecision,
    dataCoverage,
    factorScores: factors,
  };
}
