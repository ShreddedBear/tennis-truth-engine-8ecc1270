/**
 * Experiment #5 — Market shuffle / placebo test.
 *
 * See EXPERIMENT_SPECS.md. Uses the SAME admissible corpus as Experiment #4 (imported directly,
 * never re-derived). Randomly permutes the (oddsPlayer1Decimal, oddsPlayer2Decimal,
 * oddsFetchedAt) triple across rows WITHIN THE SAME admissible time window — a triple is never
 * moved to a row where it would make that row temporally inadmissible (oddsFetchedAt after that
 * row's cutoffAt). If re-scoring under the shuffled (broken) market/outcome pairing produces
 * similar accuracy/Brier/log-loss to the real pairing, that is evidence the measured "market
 * lift" doesn't actually depend on the market being correctly time-aligned with the outcome —
 * i.e. it may not be a real lift at all.
 *
 * This script re-scores using the SAME de-vig + Arm-C-style scoring as Experiment #4's Arm C
 * (impliedProbability alone), applied to the shuffled odds — not the full engine re-run, which
 * (as documented in Experiment #4) is not offline-computable without a live DB + historical
 * corpus. A full Arm-B-style placebo (non-market engine blended with shuffled market) is out of
 * scope here for the same reason Experiment #4's Arm B/D are.
 *
 * PREPARATION-ONLY — see exp1RiskFloorOnOff.ts header for the standard disclaimer.
 */

import { accuracy, brierScore, logLoss, ExclusionTracker, assessMeaningfulness } from "./sharedValidation.js";
import { buildProvenance, type ExperimentProvenance } from "./experimentProvenance.js";
import { loadAndValidate as loadExp4Admissible, type RawEvaluationPredictionRow, type AdmissibleRow, SAMPLE_FLOOR } from "./exp4MarketArms.js";

export type { RawEvaluationPredictionRow, AdmissibleRow };

export interface MarketTriple {
  oddsPlayer1Decimal: number;
  oddsPlayer2Decimal: number;
}

/**
 * De-vig (remove the bookmaker's overround) to get a fair implied probability that player1
 * wins, 0-100 — mirrors the same de-vig convention documented on
 * evaluation_predictions.impliedProbability ("vig-adjusted implied probability of PLAYER1").
 */
export function devigImpliedProbabilityPlayer1(triple: MarketTriple): number {
  const raw1 = 1 / triple.oddsPlayer1Decimal;
  const raw2 = 1 / triple.oddsPlayer2Decimal;
  const overround = raw1 + raw2;
  return (raw1 / overround) * 100;
}

/**
 * Permutes each row's (oddsPlayer1Decimal, oddsPlayer2Decimal, oddsFetchedAt) triple among the
 * OTHER rows sharing the same window key (default: the row's cutoffAt truncated to the day, UTC
 * — a coarse-but-safe grouping so a triple is never moved across a boundary that would make it
 * inadmissible for its new row, since within a day-bucket every cutoffAt is >= that day's start
 * and every oddsFetchedAt observed in that bucket was already admissible for ITS original row,
 * hence <= that row's own cutoffAt which is within the same day).
 *
 * Windows where no admissible permutation is found within `maxAttempts` random tries are
 * excluded wholesale (never partially shuffled, never silently left un-permuted) and counted.
 */
export function shuffleMarketTriples(
  rows: ReadonlyArray<AdmissibleRow>,
  rng: () => number = Math.random,
  maxAttempts = 500,
  windowKey: (r: AdmissibleRow) => string = (r) => r.cutoffAt.toISOString().slice(0, 10),
): { shuffled: Array<AdmissibleRow & { shuffledFrom: number }>; excludedIds: number[]; excludeReason: string | null } {
  const groups = new Map<string, AdmissibleRow[]>();
  for (const r of rows) {
    const key = windowKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const shuffled: Array<AdmissibleRow & { shuffledFrom: number }> = [];
  const excludedIds: number[] = [];
  let anyGroupFailed = false;

  for (const group of groups.values()) {
    if (group.length < 2) {
      // A single-row window has no OTHER row to swap a triple with — cannot placebo-shuffle it.
      excludedIds.push(...group.map((r) => r.id));
      anyGroupFailed = true;
      continue;
    }

    let found: number[] | null = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const perm = fisherYates(group.map((_, i) => i), rng);
      const valid = group.every((r, i) => {
        const donorOddsFetchedAt = group[perm[i]].oddsFetchedAt;
        return donorOddsFetchedAt.getTime() <= r.cutoffAt.getTime();
      });
      // Reject the identity permutation too — it isn't a placebo shuffle at all.
      const isIdentity = perm.every((p, i) => p === i);
      if (valid && !isIdentity) {
        found = perm;
        break;
      }
    }

    if (found === null) {
      excludedIds.push(...group.map((r) => r.id));
      anyGroupFailed = true;
      continue;
    }

    group.forEach((r, i) => {
      const donor = group[found![i]];
      // Record only WHICH row's triple was swapped in (shuffledFrom); the caller re-reads that
      // donor's real oddsPlayer1Decimal/oddsPlayer2Decimal from the original admissible list so
      // there is exactly one place the actual triple values are read from.
      shuffled.push({ ...r, shuffledFrom: donor.id });
    });
  }

  return {
    shuffled,
    excludedIds,
    excludeReason: anyGroupFailed
      ? "window had <2 rows or no admissible non-identity permutation found within maxAttempts"
      : null,
  };
}

function fisherYates(arr: number[], rng: () => number): number[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface PlaceboComparisonRow {
  variant: "real_pairing" | "shuffled_pairing";
  n: number;
  accuracyPct: number | null;
  brier: number | null;
  logLoss: number | null;
  meaningfulness: ReturnType<typeof assessMeaningfulness>;
}

export interface Exp5Output {
  table: PlaceboComparisonRow[];
  nExcludedFromShuffle: number;
  provenance: ExperimentProvenance;
}

function armCMetrics(rows: ReadonlyArray<{ prob0to1: number; correct: boolean }>, floor: number, totalN: number) {
  return {
    n: rows.length,
    accuracyPct: accuracy(rows),
    brier: brierScore(rows),
    logLoss: logLoss(rows),
    meaningfulness: assessMeaningfulness(rows.length, totalN, floor, 0.5),
  };
}

export function runExperiment(
  raw: ReadonlyArray<RawEvaluationPredictionRow>,
  datasetIdentifier: string,
  rng: () => number = Math.random,
): Exp5Output {
  const { admissible, tracker } = loadExp4Admissible(raw);

  // Real pairing uses the stored (already vig-adjusted) impliedProbability directly — no need
  // to re-devig from oddsPlayer1Decimal/oddsPlayer2Decimal since that's what produced it.
  const realRows = admissible.map((r) => {
    const pickIsPlayer1 = r.impliedProbability >= 50;
    const pick = pickIsPlayer1 ? r.player1Id : r.player2Id;
    const prob0to1 = pickIsPlayer1 ? r.impliedProbability / 100 : 1 - r.impliedProbability / 100;
    return { prob0to1, correct: pick === r.actualWinnerId };
  });

  const { shuffled, excludedIds } = shuffleMarketTriples(admissible, rng);
  const shuffledById = new Map(shuffled.map((s) => [s.id, s]));
  const shuffledRows = admissible
    .filter((r) => shuffledById.has(r.id))
    .map((r) => {
      const donor = shuffledById.get(r.id)!;
      const donorOriginal = admissible.find((a) => a.id === donor.shuffledFrom)!;
      const impliedP1 = devigImpliedProbabilityPlayer1(donorOriginal);
      const pickIsPlayer1 = impliedP1 >= 50;
      const pick = pickIsPlayer1 ? r.player1Id : r.player2Id;
      const prob0to1 = pickIsPlayer1 ? impliedP1 / 100 : 1 - impliedP1 / 100;
      return { prob0to1, correct: pick === r.actualWinnerId };
    });

  const table: PlaceboComparisonRow[] = [
    { variant: "real_pairing", ...armCMetrics(realRows, SAMPLE_FLOOR, raw.length) },
    { variant: "shuffled_pairing", ...armCMetrics(shuffledRows, SAMPLE_FLOOR, raw.length) },
  ];

  const exclusionReasons = tracker.toReasonsRecord();
  if (excludedIds.length > 0) {
    exclusionReasons["excluded from shuffle: no admissible non-identity permutation within window"] =
      (exclusionReasons["excluded from shuffle: no admissible non-identity permutation within window"] ?? 0) + excludedIds.length;
  }

  const provenance = buildProvenance({
    experimentId: "market-shuffle-placebo@v1",
    formulaVersion:
      "Arm-C-style de-vig scoring (devigImpliedProbabilityPlayer1 in this file, mirroring the " +
      "documented vig-adjustment convention on evaluation_predictions.impliedProbability); no " +
      "builderScoringService.ts formula is used by this experiment.",
    datasetIdentifier,
    rows: raw as unknown as Record<string, unknown>[],
    getDate: (r) => r.cutoffAt,
    predictionCutoffRule:
      "Same as Experiment #4 (oddsFetchedAt <= cutoffAt) for initial admissibility, PLUS: a shuffled " +
      "triple is only assigned to a row when the donor's oddsFetchedAt remains <= that row's own " +
      "cutoffAt post-shuffle — a triple is never moved across a boundary that would make it " +
      "inadmissible for its new row.",
    nEligible: admissible.length - excludedIds.length,
    exclusionReasons,
    temporalValidationMethod:
      "Per-window (UTC day of cutoffAt) permutation search that verifies, for every candidate " +
      "assignment, donor.oddsFetchedAt <= recipient.cutoffAt before accepting it; windows with no " +
      "valid non-identity permutation are excluded wholesale rather than partially shuffled.",
  });

  return { table, nExcludedFromShuffle: excludedIds.length, provenance };
}
