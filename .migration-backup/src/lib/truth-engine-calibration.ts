// TRUTH ENGINE CALIBRATION -- observation building and walk-forward evaluation.
//
// CALIBRATION NEVER SELECTS THE WINNER. It answers a different question than the
// deterministic engine: not "who does the evidence pick" (audit-pipeline.ts's
// commitConclusion, already committed and immutable by the time anything here runs) but
// "historically, how often has this TYPE of deterministic decision been right". Nothing in
// this file writes to audit_runs.independent_winner or final_decisions.selected_player_id,
// and nothing here is consulted by the deterministic pipeline -- it is a read-only
// downstream layer over already-committed decisions.
//
// NO DATA LEAKAGE: every feature comes from the frozen decision record built at FINAL
// DECISION time (final_decisions.gate_report.deterministic_decision -- itself a pure
// function of metric_results as they stood at that moment, see audit-pipeline.ts's
// WINNER INTEGRITY CHECK) plus static pre-match match context (surface/tournament/
// scheduled_date). The actual result enters only as `actual_winner_id`/`prediction_outcome`,
// read from matches.actual_winner strictly to grade the already-frozen prediction -- never
// mixed into the feature side, never used to pick which side "should" have been selected.
//
// NO ARBITRARY WEIGHTS: the only feature this module's calibration method uses is
// evidence_support_percent (the deterministic engine's own raw support ratio, already
// computed with zero arbitrary weighting). Calibration converts that ratio into an
// empirically observed win rate; it never assigns a manual weight to a family or metric.

import { matchResultIsFinal, matchSideForName, resolvePredictionOutcome } from "./match-result-resolution";

export const CALIBRATION_FEATURE_VERSION = "1";
export const CALIBRATION_MODEL_VERSION = "v0-empirical-bins";

/** Minimum resolved, eligible observations before ANY calibrated probability is produced.
 *  Below this, the deterministic winner still stands -- only the calibrated probability is
 *  withheld (Part 17: never fabricate confidence from a tiny sample). */
export const MIN_TOTAL_CALIBRATION_SAMPLE = 40;
/** Minimum training-fold size for one walk-forward test fold to be evaluated at all. */
export const MIN_TRAIN_FOLD_SAMPLE = 30;
/** Minimum observations inside one reliability bucket to report it rather than back off. */
export const MIN_BUCKET_SAMPLE = 10;

export interface CalibrationCandidateMatch {
  id: string;
  player1_name: string;
  player2_name: string;
  player1_id: string | null;
  player2_id: string | null;
  actual_winner: string | null;
  result_status: string | null;
  final_score: string | null;
  scheduled_date: string | null;
  tournament_name: string | null;
  surface: string | null;
  event_level: string | null;
}

export interface CalibrationCandidateRun {
  id: string;
  match_id: string;
  run_number: number;
  independent_decision_committed_at: string | null;
  metrics_version_id: string | null;
  verification_version_id: string | null;
  disagreement_version_id: string | null;
}

/** Structurally matches TruthEngineDecisionRecord (truth-engine-decision-record.ts) --
 *  declared narrowly here so this module carries no compile-time dependency on that file. */
export interface FrozenDecisionRecord {
  selected_player: string | null;
  evidence_percent: number;
  directional_families: number;
  independent_support_families: string[];
  independent_contradiction_families: string[];
  neutral_families: string[];
  conflicted_families: string[];
  corroborated: boolean;
  stability: string;
  evidence_coverage_percent?: number | null;
  evidence_coverage_usable?: number | null;
  evidence_coverage_expected?: number | null;
}

export interface CalibrationCandidateDecision {
  audit_run_id: string;
  selected_player_id: string | null;
  frozen: FrozenDecisionRecord | null;
  verification_result?: string | null;
  disagreement_result?: string | null;
  underdog_result?: string | null;
  stress_result?: string | null;
}

export type CalibrationEligibility = { eligible: true } | { eligible: false; reason: string };

/**
 * ANDs the existing result-capture rules (a real, played, unambiguous result -- reused
 * verbatim from match-result-resolution.ts, never reimplemented) with the winner-identity
 * hardening rules (a valid, ID-backed selection). A missing/legacy selected_player_id makes
 * a match ineligible for calibration rather than falling back to guessing from the display
 * name -- the audit pipeline itself may legitimately keep an old name-only row as-is
 * (backward compatibility), but this consumer must not paper over that gap.
 */
export function calibrationEligibility(match: CalibrationCandidateMatch, decision: CalibrationCandidateDecision): CalibrationEligibility {
  if (!decision.frozen) return { eligible: false, reason: "No frozen deterministic decision record exists for this run." };
  if (decision.frozen.selected_player === null) return { eligible: false, reason: "Deterministic conclusion was INSUFFICIENT_EVIDENCE; no winner to calibrate." };
  if (!decision.selected_player_id) return { eligible: false, reason: "selected_player_id is missing (legacy row or unresolved match identity) -- never inferred from the name." };
  if (decision.selected_player_id !== match.player1_id && decision.selected_player_id !== match.player2_id) {
    return { eligible: false, reason: "selected_player_id matches neither player1_id nor player2_id -- integrity violation, not a calibratable observation." };
  }
  if (!matchResultIsFinal(match)) return { eligible: false, reason: "Match result is not FINAL/RETIRED, or the winner cannot be unambiguously identified." };
  const outcome = resolvePredictionOutcome(decision.frozen.selected_player, match);
  if (!outcome.resolved) return { eligible: false, reason: outcome.reason ?? "Prediction outcome could not be resolved." };
  return { eligible: true };
}

export interface BuiltCalibrationObservation {
  match_id: string;
  audit_run_id: string;
  run_number: number;
  predicted_at: string | null;
  scheduled_date: string | null;
  player1_name: string;
  player2_name: string;
  player1_id: string | null;
  player2_id: string | null;
  selected_player: string;
  selected_player_id: string;
  decision_outcome: string;
  evidence_support_percent: number;
  directional_families: number;
  supporting_families: string[];
  contradicting_families: string[];
  neutral_families: string[];
  conflicted_families: string[];
  supporting_family_count: number;
  contradicting_family_count: number;
  corroborated: boolean;
  stability: string;
  evidence_coverage_percent: number | null;
  evidence_coverage_usable: number | null;
  evidence_coverage_expected: number | null;
  verification_result: string | null;
  disagreement_result: string | null;
  underdog_result: string | null;
  stress_result: string | null;
  tournament_name: string | null;
  surface: string | null;
  event_level: string | null;
  metrics_version_id: string | null;
  verification_version_id: string | null;
  disagreement_version_id: string | null;
  calibration_model_version: string;
  feature_version: string;
  actual_winner: string;
  actual_winner_id: string;
  result_status: string | null;
  final_score: string | null;
  prediction_outcome: "WIN" | "LOSS";
  calibration_eligible: true;
  eligibility_reason: null;
  observed_at: string;
}

/**
 * Builds ONE frozen observation. Only ever call this once calibrationEligibility has
 * already returned eligible:true for the same (match, decision) pair -- this function
 * re-derives nothing about eligibility, it only assembles the row and grades it.
 * prediction_outcome (WIN/LOSS -- Part 11's y) is derived once, by comparing
 * selected_player_id against actual_winner_id -- ids only, never a second name comparison.
 */
export function buildCalibrationObservation(
  match: CalibrationCandidateMatch,
  run: CalibrationCandidateRun,
  decision: CalibrationCandidateDecision,
  now: Date,
): BuiltCalibrationObservation {
  const frozen = decision.frozen;
  if (!frozen || !frozen.selected_player) throw new Error("buildCalibrationObservation requires an eligible decision with a committed winner");
  if (!decision.selected_player_id) throw new Error("buildCalibrationObservation requires an eligible decision (selected_player_id missing)");
  const selectedSide = matchSideForName(frozen.selected_player, match);
  const actualSide = matchSideForName(match.actual_winner, match);
  const actualWinnerId = actualSide === "P1" ? match.player1_id : actualSide === "P2" ? match.player2_id : null;
  if (!actualWinnerId) throw new Error("buildCalibrationObservation requires an eligible, resolved match (actual_winner_id missing)");
  return {
    match_id: match.id,
    audit_run_id: run.id,
    run_number: run.run_number,
    predicted_at: run.independent_decision_committed_at,
    scheduled_date: match.scheduled_date,
    player1_name: match.player1_name,
    player2_name: match.player2_name,
    player1_id: match.player1_id,
    player2_id: match.player2_id,
    selected_player: frozen.selected_player,
    selected_player_id: decision.selected_player_id,
    decision_outcome: selectedSide ?? "UNKNOWN",
    evidence_support_percent: frozen.evidence_percent,
    directional_families: frozen.directional_families,
    supporting_families: frozen.independent_support_families,
    contradicting_families: frozen.independent_contradiction_families,
    neutral_families: frozen.neutral_families,
    conflicted_families: frozen.conflicted_families,
    supporting_family_count: frozen.independent_support_families.length,
    contradicting_family_count: frozen.independent_contradiction_families.length,
    corroborated: frozen.corroborated,
    stability: frozen.stability,
    evidence_coverage_percent: frozen.evidence_coverage_percent ?? null,
    evidence_coverage_usable: frozen.evidence_coverage_usable ?? null,
    evidence_coverage_expected: frozen.evidence_coverage_expected ?? null,
    verification_result: decision.verification_result ?? null,
    disagreement_result: decision.disagreement_result ?? null,
    underdog_result: decision.underdog_result ?? null,
    stress_result: decision.stress_result ?? null,
    tournament_name: match.tournament_name,
    surface: match.surface,
    event_level: match.event_level,
    metrics_version_id: run.metrics_version_id,
    verification_version_id: run.verification_version_id,
    disagreement_version_id: run.disagreement_version_id,
    calibration_model_version: CALIBRATION_MODEL_VERSION,
    feature_version: CALIBRATION_FEATURE_VERSION,
    actual_winner: match.actual_winner as string,
    actual_winner_id: actualWinnerId,
    result_status: match.result_status,
    final_score: match.final_score,
    prediction_outcome: decision.selected_player_id === actualWinnerId ? "WIN" : "LOSS",
    calibration_eligible: true,
    eligibility_reason: null,
    observed_at: now.toISOString(),
  };
}

// ============================================================================
// WALK-FORWARD EVALUATION
//
// Chronological only: a fold's calibration bins are fit on observations whose predicted_at
// precedes the fold's test window, and evaluated on observations whose predicted_at falls
// inside it. No observation ever calibrates a prediction that happened before that
// observation's own outcome existed.
// ============================================================================

export interface CalibrationObservationForEval {
  match_id: string;
  /** ISO timestamp; the chronological sort/fold key. Must be the FROZEN prediction time
   *  (predicted_at), never observed_at/updated_at. */
  predicted_at: string;
  /** The deterministic engine's own raw, unrounded support ratio (0-100), used as the
   *  single calibration feature. Not a probability. */
  evidence_support_percent: number;
  /** 1 if the selected player won, 0 otherwise -- Part 11's y. */
  y: 0 | 1;
}

interface Bin { loMax: number; wins: number; n: number }

/** Empirical bins fit on TRAIN only, with Laplace(+1/+2) smoothing so an empty or tiny bin
 *  never reports a fabricated 0% or 100%. Deciles of the train set's own support values. */
function fitBins(train: CalibrationObservationForEval[]): Bin[] {
  const sorted = [...train].sort((a, b) => a.evidence_support_percent - b.evidence_support_percent);
  const binCount = Math.max(1, Math.min(10, Math.floor(sorted.length / MIN_BUCKET_SAMPLE) || 1));
  const bins: Bin[] = [];
  for (let i = 0; i < binCount; i++) {
    const slice = sorted.slice(Math.floor((i * sorted.length) / binCount), Math.floor(((i + 1) * sorted.length) / binCount));
    const loMax = i === binCount - 1 ? Infinity : (slice[slice.length - 1]?.evidence_support_percent ?? 100);
    bins.push({ loMax, wins: slice.filter((o) => o.y === 1).length, n: slice.length });
  }
  return bins;
}

function calibratedProbability(bins: Bin[], supportPercent: number): number {
  const bin = bins.find((b) => supportPercent <= b.loMax) ?? bins[bins.length - 1]!;
  // Laplace smoothing: +1 win, +2 total -- pulls a thin bin toward 50%, never lets it read
  // as a fabricated 0% or 100% off a handful of observations.
  return (bin.wins + 1) / (bin.n + 2);
}

const clamp = (p: number) => Math.min(1 - 1e-9, Math.max(1e-9, p));
function brier(preds: number[], ys: number[]): number {
  return preds.reduce((sum, p, i) => sum + (p - ys[i]!) ** 2, 0) / preds.length;
}
function logLoss(preds: number[], ys: number[]): number {
  return -preds.reduce((sum, p, i) => { const c = clamp(p); return sum + (ys[i]! * Math.log(c) + (1 - ys[i]!) * Math.log(1 - c)); }, 0) / preds.length;
}
function accuracy(preds: number[], ys: number[]): number {
  return preds.filter((p, i) => (p >= 0.5 ? 1 : 0) === ys[i]).length / preds.length;
}

export interface WalkForwardFold {
  train_period: { from: string; to: string };
  test_period: { from: string; to: string };
  train_count: number;
  test_count: number;
  brier_score: number;
  log_loss: number;
  accuracy: number;
}

export interface ReliabilityBucket {
  bucket: string;
  count: number;
  predicted_avg: number;
  actual_rate: number;
}

export interface WalkForwardResult {
  available: boolean;
  reason: string | null;
  calibration_version: string;
  feature_version: string;
  model_version: string;
  total_observations: number;
  folds: WalkForwardFold[];
  overall: {
    brier_score: number;
    log_loss: number;
    ece: number;
    accuracy: number;
    reliability_buckets: ReliabilityBucket[];
  } | null;
  /** Raw support/100 read directly as a "probability" and scored the same way, for
   *  comparison only -- never used to decide whether calibration "improved" accuracy. */
  baseline: { brier_score: number; log_loss: number } | null;
}

/**
 * Walk-forward evaluation: sort chronologically by predicted_at, then repeatedly train bins
 * on every observation strictly before a rolling test window and evaluate on that window,
 * rolling forward until observations run out. Below MIN_TOTAL_CALIBRATION_SAMPLE this
 * returns available:false with the exact reason and the real observation count --
 * infrastructure and honesty, never a fabricated probability from a thin sample.
 */
export function computeWalkForwardCalibration(
  observationsIn: CalibrationObservationForEval[],
  opts?: { minTotalSample?: number; minTrainFold?: number; calibrationVersion?: string },
): WalkForwardResult {
  const minTotal = opts?.minTotalSample ?? MIN_TOTAL_CALIBRATION_SAMPLE;
  const minTrain = opts?.minTrainFold ?? MIN_TRAIN_FOLD_SAMPLE;
  const calibrationVersion = opts?.calibrationVersion ?? "unversioned";
  const observations = [...observationsIn].sort((a, b) => a.predicted_at.localeCompare(b.predicted_at));
  const shell = (reason: string): WalkForwardResult => ({
    available: false, reason, calibration_version: calibrationVersion, feature_version: CALIBRATION_FEATURE_VERSION,
    model_version: CALIBRATION_MODEL_VERSION, total_observations: observations.length, folds: [], overall: null, baseline: null,
  });
  if (observations.length < minTotal) {
    return shell(`Only ${observations.length} eligible resolved observation(s) exist; a reliable out-of-sample calibration needs at least ${minTotal}. Reporting observation-pipeline infrastructure only -- no probability model fabricated from an insufficient sample.`);
  }

  // Roll forward in fold-sized test windows once the minimum training window is met.
  const folds: WalkForwardFold[] = [];
  const outOfSamplePreds: number[] = [];
  const outOfSampleYs: number[] = [];
  const foldSize = Math.max(MIN_BUCKET_SAMPLE, Math.floor(minTrain / 2));
  let cursor = minTrain;
  while (cursor < observations.length) {
    const train = observations.slice(0, cursor);
    const testEnd = Math.min(observations.length, cursor + foldSize);
    const test = observations.slice(cursor, testEnd);
    if (!test.length) break;
    const bins = fitBins(train);
    const preds = test.map((o) => calibratedProbability(bins, o.evidence_support_percent));
    const ys = test.map((o) => o.y);
    folds.push({
      train_period: { from: train[0]!.predicted_at, to: train[train.length - 1]!.predicted_at },
      test_period: { from: test[0]!.predicted_at, to: test[test.length - 1]!.predicted_at },
      train_count: train.length,
      test_count: test.length,
      brier_score: brier(preds, ys),
      log_loss: logLoss(preds, ys),
      accuracy: accuracy(preds, ys),
    });
    outOfSamplePreds.push(...preds);
    outOfSampleYs.push(...ys);
    cursor = testEnd;
  }
  if (!folds.length) return shell(`${observations.length} observations exist, but none fell after a training window of at least ${minTrain} -- no out-of-sample fold could be formed.`);

  // Reliability buckets over the pooled out-of-sample predictions (deciles), each backed
  // off (count-only, no rate) below MIN_BUCKET_SAMPLE rather than reporting a noisy rate.
  const order = outOfSamplePreds.map((p, i) => i).sort((a, b) => outOfSamplePreds[a]! - outOfSamplePreds[b]!);
  const bucketCount = Math.max(1, Math.min(10, Math.floor(order.length / MIN_BUCKET_SAMPLE) || 1));
  const reliability_buckets: ReliabilityBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const idx = order.slice(Math.floor((i * order.length) / bucketCount), Math.floor(((i + 1) * order.length) / bucketCount));
    const n = idx.length;
    const predicted_avg = idx.reduce((s, j) => s + outOfSamplePreds[j]!, 0) / n;
    const actual_rate = n >= MIN_BUCKET_SAMPLE ? idx.reduce((s, j) => s + outOfSampleYs[j]!, 0) / n : NaN;
    reliability_buckets.push({ bucket: `${(predicted_avg * 100).toFixed(0)}%`, count: n, predicted_avg, actual_rate });
  }
  const ece = reliability_buckets.filter((b) => !Number.isNaN(b.actual_rate)).reduce((sum, b) => sum + (b.count / outOfSamplePreds.length) * Math.abs(b.predicted_avg - b.actual_rate), 0);

  const baselinePreds = observations.map((o) => clamp(o.evidence_support_percent / 100));
  const baselineYs = observations.map((o) => o.y);

  return {
    available: true,
    reason: null,
    calibration_version: calibrationVersion,
    feature_version: CALIBRATION_FEATURE_VERSION,
    model_version: CALIBRATION_MODEL_VERSION,
    total_observations: observations.length,
    folds,
    overall: {
      brier_score: brier(outOfSamplePreds, outOfSampleYs),
      log_loss: logLoss(outOfSamplePreds, outOfSampleYs),
      ece,
      accuracy: accuracy(outOfSamplePreds, outOfSampleYs),
      reliability_buckets,
    },
    baseline: { brier_score: brier(baselinePreds, baselineYs), log_loss: logLoss(baselinePreds, baselineYs) },
  };
}
