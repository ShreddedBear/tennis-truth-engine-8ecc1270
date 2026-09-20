/**
 * Shared fail-loud validation + standard evaluation metrics for the offlineExperiments/ scripts.
 *
 * Nothing here talks to a database or a file. It operates on plain row objects so it can be
 * unit-tested against synthetic fixtures with no DATABASE_URL and no network.
 */

/**
 * Throws with a specific message naming the exact missing field(s) when any of `fields` is
 * null/undefined on `row`. Never substitutes a default, never skips a field, never falls back
 * to a different field as a stand-in. This is the single fail-loud gate every experiment
 * script's row loader must run each raw row through before treating it as usable.
 */
export function requireFields<T extends Record<string, unknown>>(
  row: T,
  fields: ReadonlyArray<keyof T & string>,
  rowContext: string,
): void {
  const missing = fields.filter((f) => row[f] === null || row[f] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `${rowContext}: missing required field(s) [${missing.join(", ")}]. ` +
        `Refusing to substitute a default or skip validation — this row cannot be scored.`,
    );
  }
}

/** Overall proportion correct, or null when there are no rows (never divide by zero silently). */
export function accuracy(rows: ReadonlyArray<{ correct: boolean }>): number | null {
  if (rows.length === 0) return null;
  return Math.round((rows.filter((r) => r.correct).length / rows.length) * 1000) / 10; // percent, 1dp
}

/** Brier score (mean squared error between probability-of-actual-winner and 1). Lower is better. 0-1 scale. */
export function brierScore(rows: ReadonlyArray<{ prob0to1: number; correct: boolean }>): number | null {
  if (rows.length === 0) return null;
  const sum = rows.reduce((s, r) => {
    const target = r.correct ? 1 : 0;
    return s + (r.prob0to1 - target) ** 2;
  }, 0);
  return Math.round((sum / rows.length) * 10000) / 10000;
}

/** Mean binary log-loss. `prob0to1` is the model's stated probability that the actual winner won. */
export function logLoss(rows: ReadonlyArray<{ prob0to1: number; correct: boolean }>): number | null {
  if (rows.length === 0) return null;
  const EPS = 1e-6;
  const sum = rows.reduce((s, r) => {
    const p = Math.min(Math.max(r.prob0to1, EPS), 1 - EPS);
    return s + (r.correct ? -Math.log(p) : -Math.log(1 - p));
  }, 0);
  return Math.round((sum / rows.length) * 10000) / 10000;
}

/**
 * Expected Calibration Error over `bins` equal-width probability buckets [0,1]. Returns null
 * when there are no rows. `prob0to1` should be the model's stated probability of the outcome
 * actually observed (`correct`).
 */
export function calibrationError(rows: ReadonlyArray<{ prob0to1: number; correct: boolean }>, bins = 10): number | null {
  if (rows.length === 0) return null;
  const buckets: { sumProb: number; sumCorrect: number; n: number }[] = Array.from({ length: bins }, () => ({
    sumProb: 0,
    sumCorrect: 0,
    n: 0,
  }));
  for (const r of rows) {
    const idx = Math.min(bins - 1, Math.floor(r.prob0to1 * bins));
    buckets[idx].sumProb += r.prob0to1;
    buckets[idx].sumCorrect += r.correct ? 1 : 0;
    buckets[idx].n += 1;
  }
  let ece = 0;
  for (const b of buckets) {
    if (b.n === 0) continue;
    const avgProb = b.sumProb / b.n;
    const avgCorrect = b.sumCorrect / b.n;
    ece += (b.n / rows.length) * Math.abs(avgProb - avgCorrect);
  }
  return Math.round(ece * 10000) / 10000;
}

/**
 * AUC via the Mann-Whitney U statistic (rank-based, ties handled by average rank). `prob0to1`
 * is the score being evaluated as a discriminator of `correct`. Returns null when there are no
 * rows, or when every row shares the same `correct` value (AUC undefined with a single class).
 */
export function auc(rows: ReadonlyArray<{ prob0to1: number; correct: boolean }>): number | null {
  const positives = rows.filter((r) => r.correct);
  const negatives = rows.filter((r) => !r.correct);
  if (positives.length === 0 || negatives.length === 0) return null;

  const sorted = [...rows].sort((a, b) => a.prob0to1 - b.prob0to1);
  const ranks = new Array<number>(sorted.length);
  let i = 0;
  let rank = 1;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].prob0to1 === sorted[i].prob0to1) j++;
    const avgRank = (rank + (rank + (j - i))) / 2;
    for (let k = i; k <= j; k++) ranks[k] = avgRank;
    rank += j - i + 1;
    i = j + 1;
  }
  let sumPosRanks = 0;
  for (let k = 0; k < sorted.length; k++) {
    if (sorted[k].correct) sumPosRanks += ranks[k];
  }
  const u = sumPosRanks - (positives.length * (positives.length + 1)) / 2;
  const result = u / (positives.length * negatives.length);
  return Math.round(result * 10000) / 10000;
}

/**
 * Standard exclusion-reason accumulator: experiment loaders push a reason string per excluded
 * row, and this can be turned directly into `experimentProvenance.ts`'s exclusionReasons map.
 */
export class ExclusionTracker {
  private reasons = new Map<string, number>();
  private eligibleCount = 0;
  private totalCount = 0;

  admit(): void {
    this.totalCount += 1;
    this.eligibleCount += 1;
  }

  exclude(reason: string): void {
    this.totalCount += 1;
    this.reasons.set(reason, (this.reasons.get(reason) ?? 0) + 1);
  }

  get nTotal(): number {
    return this.totalCount;
  }

  get nEligible(): number {
    return this.eligibleCount;
  }

  toReasonsRecord(): Record<string, number> {
    return Object.fromEntries(this.reasons.entries());
  }
}

/**
 * Minimum sample-size floor and minimum admissible-fraction floor an experiment must clear
 * before its result is reported as meaningful, rather than just "computed". Default n-floor
 * follows the codebase's own MIN_SAMPLE_FOR_TIER_COMPARISON convention (50) unless a more
 * specific precedent exists for that experiment (see each script's own constant + citation).
 */
export const DEFAULT_MIN_SAMPLE_FLOOR = 50;
/** At least this fraction of loaded rows must pass the temporal-cutoff admissibility check. */
export const DEFAULT_MIN_ADMISSIBLE_FRACTION = 0.5;

export interface MeaningfulnessVerdict {
  meetsSampleFloor: boolean;
  meetsAdmissibleFraction: boolean;
  isMeaningful: boolean;
  reason: string;
}

export function assessMeaningfulness(
  nEligible: number,
  nTotal: number,
  sampleFloor: number,
  minAdmissibleFraction: number,
): MeaningfulnessVerdict {
  const meetsSampleFloor = nEligible >= sampleFloor;
  const admissibleFraction = nTotal > 0 ? nEligible / nTotal : 0;
  const meetsAdmissibleFraction = admissibleFraction >= minAdmissibleFraction;
  const isMeaningful = meetsSampleFloor && meetsAdmissibleFraction;
  const reason = isMeaningful
    ? `n=${nEligible} >= floor ${sampleFloor} and admissible fraction ${(admissibleFraction * 100).toFixed(1)}% >= ${(minAdmissibleFraction * 100).toFixed(0)}%`
    : !meetsSampleFloor
      ? `n=${nEligible} < required floor ${sampleFloor}`
      : `admissible fraction ${(admissibleFraction * 100).toFixed(1)}% < required ${(minAdmissibleFraction * 100).toFixed(0)}% (${nEligible}/${nTotal})`;
  return { meetsSampleFloor, meetsAdmissibleFraction, isMeaningful, reason };
}
