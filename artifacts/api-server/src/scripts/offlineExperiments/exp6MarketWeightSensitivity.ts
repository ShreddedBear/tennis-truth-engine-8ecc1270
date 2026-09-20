/**
 * Experiment #6 — Market-weight sensitivity.
 *
 * See EXPERIMENT_SPECS.md. Sweeps hypothetical weights for the Parlay Builder's
 * `marketConsensus` Validation factor (currently 0.040 of the 0-1 weight scale, per
 * DEFAULT_WEIGHTS in builderScoringService.ts:234) and its AGREEMENT_EDGE_WEIGHTS entry (5.0,
 * :274) — the two figures the task brief names explicitly, mirrored as data in
 * productionFormulaMirror.ts's CURRENT_MARKET_CONSENSUS_* constants.
 *
 * DATA REALITY: `marketConsensus` is a Parlay Builder Validation factor, computed into
 * `parlay_leg_outcomes.factor_scores` — but only `source='backfill'` rows carry a
 * `backfill_match_id` that ties them to an `evaluation_predictions` row, which is the only
 * place a temporal odds-admissibility check (oddsFetchedAt <= cutoffAt) can be performed. This
 * script therefore consumes an ALREADY-JOINED export: one row per graded, backfill-sourced
 * `parlay_leg_outcomes` leg, carrying its own factor_scores plus its joined
 * evaluation_predictions row's oddsFetchedAt/cutoffAt/status/includedInAccuracy. Producing that
 * join is a separate data-export step this script does not perform — it fails loudly if any
 * expected joined field is absent from a row, exactly as it would for a directly-loaded field.
 *
 * Candidate weight is chosen ONLY on a chronologically-earlier TRAIN slice (by minimizing mean
 * Brier score across candidates) and then reported on a disjoint, chronologically-LATER holdout
 * slice — never picked against the same data it's evaluated on, per the task's explicit
 * instruction.
 *
 * PREPARATION-ONLY — see exp1RiskFloorOnOff.ts header for the standard disclaimer.
 */

import {
  reweightMarketConsensus,
  computeValidationScoreAndCoverage,
  CURRENT_MARKET_CONSENSUS_VALIDATION_WEIGHT,
  MIN_SAMPLE_FOR_TIER_COMPARISON,
  type FactorScore,
} from "./productionFormulaMirror.js";
import { requireFields, brierScore, accuracy, ExclusionTracker, assessMeaningfulness } from "./sharedValidation.js";
import { buildProvenance, type ExperimentProvenance } from "./experimentProvenance.js";

/** Candidate marketConsensus weights to sweep, 0% to 50% of the 0-1 scale in 10pp steps. */
export const CANDIDATE_WEIGHTS = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

export interface RawJoinedLegRow {
  id: number;
  selected_player_id: string | null;
  actual_winner_id: string | null;
  resolved_at: string | Date | null;
  source: string | null;
  created_at: string | Date | null;
  backfill_match_id: number | null;
  factor_scores: FactorScore[] | null;
  // Joined from evaluation_predictions via backfill_match_id:
  joined_odds_fetched_at: string | Date | null;
  joined_cutoff_at: string | Date | null;
  joined_status: string | null;
  joined_included_in_accuracy: boolean | null;
}

export interface AdmissibleWeightRow {
  id: number;
  createdAt: Date;
  factors: FactorScore[];
  won: boolean;
}

const STRUCTURAL_FIELDS = ["id", "selected_player_id", "source", "created_at", "factor_scores"] as const;

export function loadAndValidate(raw: ReadonlyArray<RawJoinedLegRow>): {
  admissible: AdmissibleWeightRow[];
  tracker: ExclusionTracker;
} {
  const tracker = new ExclusionTracker();
  const admissible: AdmissibleWeightRow[] = [];

  raw.forEach((row, i) => {
    requireFields(row, STRUCTURAL_FIELDS, `parlay_leg_outcomes (joined) row #${i} (id=${row.id ?? "unknown"})`);

    if (row.source !== "backfill" || row.backfill_match_id == null) {
      tracker.exclude("not a backfill row with backfill_match_id — cannot verify temporal odds admissibility");
      return;
    }
    if (row.actual_winner_id == null || row.resolved_at == null) {
      tracker.exclude("not graded (actual_winner_id/resolved_at null)");
      return;
    }
    requireFields(
      row,
      ["joined_odds_fetched_at", "joined_cutoff_at", "joined_status", "joined_included_in_accuracy"] as const,
      `parlay_leg_outcomes (joined) row #${i} (id=${row.id}) — joined evaluation_predictions fields`,
    );
    if (row.joined_status !== "graded" || row.joined_included_in_accuracy !== true) {
      tracker.exclude("joined evaluation_predictions row is not graded/includedInAccuracy");
      return;
    }
    const oddsFetchedAt = row.joined_odds_fetched_at instanceof Date ? row.joined_odds_fetched_at : new Date(row.joined_odds_fetched_at as string);
    const cutoffAt = row.joined_cutoff_at instanceof Date ? row.joined_cutoff_at : new Date(row.joined_cutoff_at as string);
    if (oddsFetchedAt.getTime() > cutoffAt.getTime()) {
      tracker.exclude("joined oddsFetchedAt > cutoffAt — temporal leakage");
      return;
    }
    const factors = row.factor_scores as FactorScore[];
    if (!factors.some((f) => f.key === "marketConsensus")) {
      throw new Error(
        `parlay_leg_outcomes (joined) row id=${row.id}: factor_scores has no entry with key ` +
          `"marketConsensus" — cannot run the weight sweep on this row. Refusing to substitute a ` +
          `synthetic marketConsensus factor.`,
      );
    }

    tracker.admit();
    admissible.push({
      id: row.id,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at as string),
      factors,
      won: row.actual_winner_id === row.selected_player_id,
    });
  });

  return { admissible, tracker };
}

export interface WeightSweepResult {
  weight: number;
  trainMeanBrier: number | null;
  isCandidateChosen: boolean;
}

export interface HoldoutResult {
  chosenWeight: number | null;
  holdoutN: number;
  holdoutAccuracyPct: number | null;
  holdoutBrier: number | null;
  meaningfulness: ReturnType<typeof assessMeaningfulness>;
}

export interface Exp6Output {
  trainSweep: WeightSweepResult[];
  holdout: HoldoutResult;
  provenance: ExperimentProvenance;
}

const SAMPLE_FLOOR = MIN_SAMPLE_FOR_TIER_COMPARISON;

function scoreRowsAtWeight(rows: ReadonlyArray<AdmissibleWeightRow>, weight: number) {
  return rows.map((r) => {
    const reweighted = reweightMarketConsensus(r.factors, weight);
    const { validationScore } = computeValidationScoreAndCoverage(reweighted);
    return { prob0to1: validationScore / 100, correct: r.won };
  });
}

export function runExperiment(raw: ReadonlyArray<RawJoinedLegRow>, datasetIdentifier: string): Exp6Output {
  const { admissible, tracker } = loadAndValidate(raw);

  // Chronological split: earlier half = train (weight selection only), later half = holdout.
  const sorted = [...admissible].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const splitIdx = Math.floor(sorted.length / 2);
  const train = sorted.slice(0, splitIdx);
  const holdout = sorted.slice(splitIdx);

  const trainSweep: WeightSweepResult[] = CANDIDATE_WEIGHTS.map((weight) => ({
    weight,
    trainMeanBrier: train.length > 0 ? brierScore(scoreRowsAtWeight(train, weight)) : null,
    isCandidateChosen: false,
  }));

  let chosenWeight: number | null = null;
  if (train.length >= SAMPLE_FLOOR) {
    const withScores = trainSweep.filter((s) => s.trainMeanBrier != null);
    if (withScores.length > 0) {
      const best = withScores.reduce((a, b) => ((b.trainMeanBrier as number) < (a.trainMeanBrier as number) ? b : a));
      chosenWeight = best.weight;
      best.isCandidateChosen = true;
    }
  }

  const holdoutRows = chosenWeight != null ? scoreRowsAtWeight(holdout, chosenWeight) : [];
  const holdoutResult: HoldoutResult = {
    chosenWeight,
    holdoutN: holdoutRows.length,
    holdoutAccuracyPct: chosenWeight != null ? accuracy(holdoutRows) : null,
    holdoutBrier: chosenWeight != null ? brierScore(holdoutRows) : null,
    meaningfulness: assessMeaningfulness(holdout.length, raw.length, SAMPLE_FLOOR, 0.5),
  };

  const provenance = buildProvenance({
    experimentId: "market-weight-sensitivity@v1",
    formulaVersion:
      "reweightMarketConsensus + computeValidationScoreAndCoverage via productionFormulaMirror.ts " +
      "pinned against builderScoringService.ts@db28f8371f2ec4bbfc2b2b3d0e341011cfd8f788; current " +
      `production marketConsensus weight is ${CURRENT_MARKET_CONSENSUS_VALIDATION_WEIGHT}.`,
    datasetIdentifier,
    rows: raw as unknown as Record<string, unknown>[],
    getDate: (r) => r.created_at,
    predictionCutoffRule:
      "row admitted only if source='backfill' with a joined evaluation_predictions row whose " +
      "joined_odds_fetched_at <= joined_cutoff_at, status='graded', includedInAccuracy=true.",
    nEligible: tracker.nEligible,
    exclusionReasons: tracker.toReasonsRecord(),
    temporalValidationMethod:
      "Odds temporal admissibility checked via the joined evaluation_predictions timestamps (as in " +
      "Experiment #4). Weight-selection leakage is prevented by choosing the candidate weight only " +
      "on the chronologically-earlier half (by created_at) and reporting metrics only on the " +
      "chronologically-later, disjoint half.",
  });

  return { trainSweep, holdout: holdoutResult, provenance };
}
