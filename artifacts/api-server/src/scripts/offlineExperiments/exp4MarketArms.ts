/**
 * Experiment #4 — Market Full vs No-Market vs Market-Only vs Market+Independent.
 *
 * See EXPERIMENT_SPECS.md. Corpus: graded `evaluation_predictions` rows with non-null
 * oddsPlayer1Decimal/oddsPlayer2Decimal/oddsFetchedAt, temporally admissible
 * (oddsFetchedAt <= cutoffAt), status='graded', includedInAccuracy=true.
 *
 * Four arms, per the task brief:
 *   A) stored calibratedProbability as-is                         — COMPUTABLE offline (this script).
 *   B) engine-equivalent scoring excluding market input            — requires a live re-run of
 *      runPredictionEngine({ ...input, excludedModels: new Set(["marketOdds"]) }), the same
 *      mechanism auditMarketConsensusAblation.ts already uses. That needs the historical match
 *      corpus + DB pool wired up (buildMatchHistoryIndex, buildEloHistoryIndex, etc.) — NOT
 *      offline-computable from a flat row export, so this script emits a placeholder row (metrics
 *      null, `note` explains why) rather than guessing.
 *   C) impliedProbability alone as the prediction                  — COMPUTABLE offline (this script).
 *   D) B's non-market engine output blended with market            — the task brief is explicit:
 *      "do not invent a new production blending formula — if none exists, mark this arm's
 *      calculation as 'requires a documented blend spec before implementation'". No such spec
 *      exists in this codebase today (checked: no blend function separate from the ensemble
 *      itself is exported by predictionEngine). This script marks Arm D exactly that way.
 *
 * PREPARATION-ONLY — see exp1RiskFloorOnOff.ts header for the standard disclaimer.
 */

import { accuracy, brierScore, logLoss, calibrationError, auc, requireFields, ExclusionTracker, assessMeaningfulness } from "./sharedValidation.js";
import { buildProvenance, type ExperimentProvenance } from "./experimentProvenance.js";

// n>=200 floor, matching auditMarketConsensusAblation.ts's own precedent for its Section B
// (paper-trade engine re-run) market comparison — the most specific existing precedent for
// this exact "market vs no-market on evaluation_predictions" comparison.
export const SAMPLE_FLOOR = 200;

export interface RawEvaluationPredictionRow {
  id: number;
  player1Id: string | null;
  player2Id: string | null;
  status: string | null;
  includedInAccuracy: boolean | null;
  cutoffAt: string | Date | null;
  predictedWinnerId: string | null;
  actualWinnerId: string | null;
  calibratedProbability: number | null;
  impliedProbability: number | null;
  oddsPlayer1Decimal: number | null;
  oddsPlayer2Decimal: number | null;
  oddsFetchedAt: string | Date | null;
}

export interface AdmissibleRow {
  id: number;
  cutoffAt: Date;
  player1Id: string;
  player2Id: string;
  predictedWinnerId: string;
  actualWinnerId: string;
  calibratedProbability: number;
  impliedProbability: number;
  oddsPlayer1Decimal: number;
  oddsPlayer2Decimal: number;
  oddsFetchedAt: Date;
}

const STRUCTURAL_FIELDS = ["id", "player1Id", "player2Id", "cutoffAt", "status"] as const;

export function loadAndValidate(raw: ReadonlyArray<RawEvaluationPredictionRow>): {
  admissible: AdmissibleRow[];
  tracker: ExclusionTracker;
} {
  const tracker = new ExclusionTracker();
  const admissible: AdmissibleRow[] = [];

  raw.forEach((row, i) => {
    requireFields(row, STRUCTURAL_FIELDS, `evaluation_predictions row #${i} (id=${row.id ?? "unknown"})`);
    const cutoffAt = row.cutoffAt instanceof Date ? row.cutoffAt : new Date(row.cutoffAt as string);

    if (row.status !== "graded") {
      tracker.exclude(`status is not 'graded' (got "${row.status}")`);
      return;
    }
    if (row.includedInAccuracy !== true) {
      tracker.exclude("includedInAccuracy is not true (walkover/retirement/void/excluded)");
      return;
    }
    if (row.predictedWinnerId == null || row.actualWinnerId == null) {
      tracker.exclude("predictedWinnerId/actualWinnerId is null despite status='graded'");
      return;
    }
    if (row.calibratedProbability == null) {
      tracker.exclude("calibratedProbability is null");
      return;
    }
    if (row.oddsPlayer1Decimal == null || row.oddsPlayer2Decimal == null || row.oddsFetchedAt == null) {
      tracker.exclude("odds_player1_decimal/odds_player2_decimal/odds_fetched_at is null — no market evidence");
      return;
    }
    if (row.impliedProbability == null) {
      tracker.exclude("impliedProbability is null despite odds being present (vig-adjustment step never ran)");
      return;
    }
    const oddsFetchedAt = row.oddsFetchedAt instanceof Date ? row.oddsFetchedAt : new Date(row.oddsFetchedAt as string);
    if (oddsFetchedAt.getTime() > cutoffAt.getTime()) {
      tracker.exclude("oddsFetchedAt > cutoffAt — market evidence arrived after the prediction cutoff (temporal leakage)");
      return;
    }

    tracker.admit();
    admissible.push({
      id: row.id,
      cutoffAt,
      player1Id: row.player1Id as string,
      player2Id: row.player2Id as string,
      predictedWinnerId: row.predictedWinnerId,
      actualWinnerId: row.actualWinnerId,
      calibratedProbability: row.calibratedProbability,
      impliedProbability: row.impliedProbability,
      oddsPlayer1Decimal: row.oddsPlayer1Decimal as number,
      oddsPlayer2Decimal: row.oddsPlayer2Decimal as number,
      oddsFetchedAt,
    });
  });

  return { admissible, tracker };
}

export interface ArmMetrics {
  arm: "A_full_stored" | "B_no_market" | "C_market_only" | "D_market_plus_independent";
  n: number;
  computable: boolean;
  note: string | null;
  accuracyPct: number | null;
  brier: number | null;
  logLoss: number | null;
  calibrationError: number | null;
  auc: number | null;
  meaningfulness: ReturnType<typeof assessMeaningfulness>;
}

export interface Exp4Output {
  table: ArmMetrics[];
  provenance: ExperimentProvenance;
}

function metricsFor(
  arm: ArmMetrics["arm"],
  rows: ReadonlyArray<{ prob0to1: number; correct: boolean }>,
  totalN: number,
): ArmMetrics {
  return {
    arm,
    n: rows.length,
    computable: true,
    note: null,
    accuracyPct: accuracy(rows),
    brier: brierScore(rows),
    logLoss: logLoss(rows),
    calibrationError: calibrationError(rows),
    auc: auc(rows),
    meaningfulness: assessMeaningfulness(rows.length, totalN, SAMPLE_FLOOR, 0.5),
  };
}

export function runExperiment(raw: ReadonlyArray<RawEvaluationPredictionRow>, datasetIdentifier: string): Exp4Output {
  const { admissible, tracker } = loadAndValidate(raw);

  const armARows = admissible.map((r) => ({
    prob0to1: r.predictedWinnerId === r.player1Id ? r.calibratedProbability / 100 : 1 - r.calibratedProbability / 100,
    correct: r.predictedWinnerId === r.actualWinnerId,
  }));

  const armCRows = admissible.map((r) => {
    const impliedPickIsPlayer1 = r.impliedProbability >= 50;
    const pick = impliedPickIsPlayer1 ? r.player1Id : r.player2Id;
    const prob0to1 = impliedPickIsPlayer1 ? r.impliedProbability / 100 : 1 - r.impliedProbability / 100;
    return { prob0to1, correct: pick === r.actualWinnerId };
  });

  const table: ArmMetrics[] = [
    metricsFor("A_full_stored", armARows, raw.length),
    {
      arm: "B_no_market",
      n: 0,
      computable: false,
      note:
        "Requires a live re-run of runPredictionEngine({ ...historicalInput, excludedModels: new Set(['marketOdds']) }) " +
        "per row (same mechanism as auditMarketConsensusAblation.ts) — needs the historical match corpus, Elo history " +
        "index, and DB pool, which this offline flat-row script does not have. Not computable from stored columns alone.",
      accuracyPct: null,
      brier: null,
      logLoss: null,
      calibrationError: null,
      auc: null,
      meaningfulness: assessMeaningfulness(0, raw.length, SAMPLE_FLOOR, 0.5),
    },
    metricsFor("C_market_only", armCRows, raw.length),
    {
      arm: "D_market_plus_independent",
      n: 0,
      computable: false,
      note:
        "No documented production blend formula exists for combining a non-market engine output with " +
        "market-implied probability (checked predictionEngine/index.ts — the ensemble itself is the only " +
        "combination step, and it is not separable into a 'blend Arm B with market' primitive). Per the " +
        "task brief, this arm requires a documented blend spec before implementation and is not guessed here.",
      accuracyPct: null,
      brier: null,
      logLoss: null,
      calibrationError: null,
      auc: null,
      meaningfulness: assessMeaningfulness(0, raw.length, SAMPLE_FLOOR, 0.5),
    },
  ];

  const provenance = buildProvenance({
    experimentId: "market-arms-full-vs-no-market-vs-market-only-vs-blend@v1",
    formulaVersion:
      "Arm A/C computed directly from stored evaluation_predictions.calibratedProbability / " +
      "impliedProbability (no mirror needed — these are stored production outputs, not re-derived " +
      "formulas). Arm B/D would use predictionEngine's runPredictionEngine with excludedModels, the " +
      "same mechanism as auditMarketConsensusAblation.ts — not exercised here (see per-arm note).",
    datasetIdentifier,
    rows: raw as unknown as Record<string, unknown>[],
    getDate: (r) => r.cutoffAt,
    predictionCutoffRule: "oddsFetchedAt <= cutoffAt, enforced per row; violating rows are rejected and counted, never included.",
    nEligible: tracker.nEligible,
    exclusionReasons: tracker.toReasonsRecord(),
    temporalValidationMethod:
      "Direct per-row comparison of two stored timestamps (odds_fetched_at vs cutoff_at); a row is " +
      "admitted only when odds_fetched_at is at or before cutoff_at. No inference or estimation of a " +
      "missing timestamp is ever performed.",
  });

  return { table, provenance };
}
