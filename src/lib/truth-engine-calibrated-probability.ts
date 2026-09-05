// CALIBRATED WIN PROBABILITY — learned from resolved outcomes, never asserted from evidence.
//
// THE ONE RULE THIS FILE EXISTS TO ENFORCE: a probability may only come from counting what
// actually happened to comparable past decisions. It is never read off the evidence.
//
//   Evidence Support = 62.5%  does NOT mean  Win Probability = 62.5%.
//   Evidence Coverage = 42%   does NOT mean  Win Probability = 42%.
//
// 62.5% support is a FEATURE of the decision. What decisions that look like that are worth is
// an empirical question, and until enough of them have actually been played and graded the
// honest answer is NOT_YET_CALIBRATED -- returned as a first-class result, never papered over
// with the support number, a prior, a smoothed guess or the Matrix WP baseline.
//
// WHY COVERAGE CANNOT LEAK IN. The feature key is built by `featureKey` below from decision
// characteristics only. Coverage is not a parameter of this module's input type, so a 25/25
// match and a 10/25 match with the same decision characteristics land in the same bucket and
// are learned from identically. There is no code path by which coverage could raise or lower
// a probability, because there is no coverage value in scope.
//
// WHY THE ACTIVE METRIC COUNT CANNOT REWRITE HISTORY. Buckets are keyed on the decision's own
// shape (support band, corroboration, contradiction presence, stress state), not on how many
// metrics were active when it was made. Activating a 26th metric changes future coverage
// diagnostics; it cannot retroactively move a past observation into a different bucket.

export interface ResolvedObservation {
  /** Family-level directional support, 0-100. A FEATURE. Never a probability. */
  evidence_support_percent: number | null;
  supporting_family_count: number;
  contradicting_family_count: number;
  corroborated: boolean | null;
  stress_result: string | null;
  disagreement_result: string | null;
  underdog_result: string | null;
  /** THE TARGET: did the player the engine selected actually win? */
  prediction_outcome: "WIN" | "LOSS";
}

/**
 * Minimum resolved observations in a bucket before its win rate is reported as a calibrated
 * probability. Below it the bucket is reported as NOT_YET_CALIBRATED with its raw counts
 * visible -- "3 of 4 so far" is a fact worth showing and a terrible probability.
 */
export const MIN_OBSERVATIONS_FOR_CALIBRATION = 20;

/** Support bands. Deliberately coarse: the 60% threshold boundary, then wider evidence. */
export const SUPPORT_BANDS = [
  { code: "SUPPORT_60_70", min: 60, max: 70 },
  { code: "SUPPORT_70_85", min: 70, max: 85 },
  { code: "SUPPORT_85_100", min: 85, max: 100.0001 },
] as const;

export function supportBand(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) return "SUPPORT_UNKNOWN";
  const band = SUPPORT_BANDS.find((b) => percent >= b.min && percent < b.max);
  return band?.code ?? "SUPPORT_BELOW_THRESHOLD";
}

export interface DecisionFeatures {
  evidence_support_percent: number | null;
  supporting_family_count: number;
  contradicting_family_count: number;
  corroborated: boolean | null;
  stress_result: string | null;
}

/**
 * The bucket a decision belongs to. Note every component: all four are decision
 * characteristics. Coverage, metric counts and Matrix WP are absent by construction.
 */
export function featureKey(features: DecisionFeatures): string {
  return [
    supportBand(features.evidence_support_percent),
    features.corroborated ? "CORROBORATED" : "SINGLE_FAMILY",
    features.contradicting_family_count > 0 ? "CONTRADICTED" : "UNCONTRADICTED",
    `STRESS_${String(features.stress_result ?? "UNKNOWN").toUpperCase()}`,
  ].join("|");
}

export type CalibrationStatus = "CALIBRATED" | "NOT_YET_CALIBRATED";

export interface CalibratedBucket {
  feature_key: string;
  observations: number;
  wins: number;
  losses: number;
  status: CalibrationStatus;
  /** The learned probability, 0-100. NULL whenever status is NOT_YET_CALIBRATED. */
  calibrated_win_probability: number | null;
}

export interface CalibrationModel {
  total_observations: number;
  buckets: CalibratedBucket[];
  status: CalibrationStatus;
}

/** Count wins and losses per bucket. That is the entire learning step, and it is enough. */
export function buildCalibrationModel(
  observations: readonly ResolvedObservation[],
): CalibrationModel {
  const byKey = new Map<string, { wins: number; losses: number }>();
  for (const o of observations) {
    const key = featureKey(o);
    const cell = byKey.get(key) ?? { wins: 0, losses: 0 };
    if (o.prediction_outcome === "WIN") cell.wins += 1;
    else cell.losses += 1;
    byKey.set(key, cell);
  }

  const buckets: CalibratedBucket[] = [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([feature_key, cell]) => {
      const total = cell.wins + cell.losses;
      const calibrated = total >= MIN_OBSERVATIONS_FOR_CALIBRATION;
      return {
        feature_key,
        observations: total,
        wins: cell.wins,
        losses: cell.losses,
        status: calibrated ? "CALIBRATED" : "NOT_YET_CALIBRATED",
        calibrated_win_probability: calibrated
          ? Number(((cell.wins / total) * 100).toFixed(1))
          : null,
      };
    });

  return {
    total_observations: observations.length,
    buckets,
    status: buckets.some((b) => b.status === "CALIBRATED") ? "CALIBRATED" : "NOT_YET_CALIBRATED",
  };
}

export interface CalibrationLookup {
  status: CalibrationStatus;
  feature_key: string;
  /** 0-100, or null. NULL is the honest answer, not a placeholder to fill in downstream. */
  calibrated_win_probability: number | null;
  observations: number;
  reason: string;
}

/**
 * What a live decision's calibrated probability is, given the history.
 *
 * With no comparable resolved history it returns NOT_YET_CALIBRATED and a null probability.
 * It does NOT fall back to evidence_support_percent, to a 50% prior, to a global win rate, or
 * to the Matrix WP -- each of those would present an assumption as a measurement.
 */
export function calibratedProbabilityFor(
  features: DecisionFeatures,
  model: CalibrationModel,
): CalibrationLookup {
  const key = featureKey(features);
  const bucket = model.buckets.find((b) => b.feature_key === key);
  if (!bucket) {
    return {
      status: "NOT_YET_CALIBRATED",
      feature_key: key,
      calibrated_win_probability: null,
      observations: 0,
      reason: "No resolved Truth Engine decision with these characteristics has been observed yet.",
    };
  }
  if (bucket.status === "NOT_YET_CALIBRATED") {
    return {
      status: "NOT_YET_CALIBRATED",
      feature_key: key,
      calibrated_win_probability: null,
      observations: bucket.observations,
      reason: `Only ${bucket.observations} resolved observation(s) with these characteristics; ${MIN_OBSERVATIONS_FOR_CALIBRATION} are required before a win probability is reported.`,
    };
  }
  return {
    status: "CALIBRATED",
    feature_key: key,
    calibrated_win_probability: bucket.calibrated_win_probability,
    observations: bucket.observations,
    reason: `${bucket.wins} of ${bucket.observations} resolved decisions with these characteristics won.`,
  };
}
