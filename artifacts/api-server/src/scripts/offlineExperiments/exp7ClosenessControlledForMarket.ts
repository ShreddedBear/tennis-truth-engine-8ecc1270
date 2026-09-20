/**
 * Experiment #7 — Closeness calibration controlling for market.
 *
 * See EXPERIMENT_SPECS.md. Decomposes the 4 closeness component signals (win-rate gap, surface
 * gap, market-implied-probability gap, ranking gap) via the mirror's
 * `computeClosenessComponents`, and buckets outcome by closeness WITH vs WITHOUT the
 * market-implied-prob-gap component included — to isolate how much of Closeness's apparent
 * signal is redundant with market.
 *
 * DATA REALITY: `parlay_leg_outcomes` does not persist the raw player win-rate/surface/ranking
 * inputs the closeness formula needs — only the final blended `matchup_closeness` integer. This
 * script therefore consumes an ALREADY-RECONSTRUCTED export: one row per graded, backfill-
 * sourced leg (joined to its evaluation_predictions row for market odds + temporal
 * admissibility, same join as Experiment #6), carrying the reconstructed PlayerStats-derived
 * closeness inputs (win rates, surface data, ranks) that `computePlayerStats` would produce
 * from `historical_matches` for the two players as of the match date. Producing that
 * reconstruction is a separate data-export step this script does not perform (it would use
 * `computePlayerStats`, exported from builderScoringService.ts, against `historical_matches` —
 * safe to do since it's already exported and pure). This script fails loudly if any expected
 * reconstructed field is absent from a row.
 *
 * PREPARATION-ONLY — see exp1RiskFloorOnOff.ts header for the standard disclaimer.
 */

import { computeClosenessComponents, MIN_SAMPLE_FOR_TIER_COMPARISON } from "./productionFormulaMirror.js";
import { requireFields, accuracy, ExclusionTracker, assessMeaningfulness } from "./sharedValidation.js";
import { buildProvenance, type ExperimentProvenance } from "./experimentProvenance.js";

export interface RawReconstructedLegRow {
  id: number;
  selected_player_id: string | null;
  actual_winner_id: string | null;
  resolved_at: string | Date | null;
  source: string | null;
  created_at: string | Date | null;
  backfill_match_id: number | null;
  // Reconstructed PlayerStats-derived closeness inputs (see file header):
  sel_win_rate: number | null;
  opp_win_rate: number | null;
  sel_win_rate_confidence: number | null;
  opp_win_rate_confidence: number | null;
  surface: string | null;
  sel_surface_total: number | null;
  opp_surface_total: number | null;
  sel_surface_win_rate: number | null;
  opp_surface_win_rate: number | null;
  sel_rank: number | null;
  opp_rank: number | null;
  // Joined from evaluation_predictions via backfill_match_id (market side + temporal check):
  joined_odds_player1_decimal: number | null;
  joined_odds_player2_decimal: number | null;
  joined_odds_fetched_at: string | Date | null;
  joined_cutoff_at: string | Date | null;
  joined_status: string | null;
  joined_included_in_accuracy: boolean | null;
  /** Whether selected_player_id corresponds to player1 in the joined evaluation_predictions row (for odds orientation). */
  selected_is_player1: boolean | null;
}

const STRUCTURAL_FIELDS = [
  "id",
  "selected_player_id",
  "source",
  "created_at",
  "sel_win_rate",
  "opp_win_rate",
  "sel_win_rate_confidence",
  "opp_win_rate_confidence",
] as const;

export interface AdmissibleClosenessRow {
  id: number;
  createdAt: Date;
  won: boolean;
  withMarket: ReturnType<typeof computeClosenessComponents>;
  withoutMarket: ReturnType<typeof computeClosenessComponents>;
}

export function loadAndValidate(raw: ReadonlyArray<RawReconstructedLegRow>): {
  admissible: AdmissibleClosenessRow[];
  tracker: ExclusionTracker;
} {
  const tracker = new ExclusionTracker();
  const admissible: AdmissibleClosenessRow[] = [];

  raw.forEach((row, i) => {
    requireFields(row, STRUCTURAL_FIELDS, `parlay_leg_outcomes (reconstructed) row #${i} (id=${row.id ?? "unknown"})`);

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
      ["joined_odds_player1_decimal", "joined_odds_player2_decimal", "joined_odds_fetched_at", "joined_cutoff_at", "joined_status", "joined_included_in_accuracy", "selected_is_player1"] as const,
      `parlay_leg_outcomes (reconstructed) row #${i} (id=${row.id}) — joined evaluation_predictions fields`,
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

    // Selected-player-relative decimal odds, for the closeness formula's marketOdds input
    // (decimal odds FOR the selected player, matching BuilderSnapshot.marketOdds semantics).
    const marketOddsForSelected = row.selected_is_player1
      ? (row.joined_odds_player1_decimal as number)
      : (row.joined_odds_player2_decimal as number);

    const commonInputs = {
      selWinRate: row.sel_win_rate as number,
      oppWinRate: row.opp_win_rate as number,
      selWinRateConfidence: row.sel_win_rate_confidence as number,
      oppWinRateConfidence: row.opp_win_rate_confidence as number,
      surface: row.surface,
      selSurfaceTotal: row.sel_surface_total ?? 0,
      oppSurfaceTotal: row.opp_surface_total ?? 0,
      selSurfaceWinRate: row.sel_surface_win_rate ?? 0.5,
      oppSurfaceWinRate: row.opp_surface_win_rate ?? 0.5,
      selRank: row.sel_rank,
      oppRank: row.opp_rank,
    };

    tracker.admit();
    admissible.push({
      id: row.id,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at as string),
      won: row.actual_winner_id === row.selected_player_id,
      withMarket: computeClosenessComponents({ ...commonInputs, marketOdds: marketOddsForSelected }),
      withoutMarket: computeClosenessComponents({ ...commonInputs, marketOdds: null }),
    });
  });

  return { admissible, tracker };
}

export type ClosenessBand = "low_lt50" | "moderate_50to79" | "high_ge80";

function bandFor(score: number): ClosenessBand {
  if (score >= 80) return "high_ge80";
  if (score >= 50) return "moderate_50to79";
  return "low_lt50";
}

export interface ClosenessBandResult {
  variant: "with_market_component" | "without_market_component";
  band: ClosenessBand;
  n: number;
  winRatePct: number | null;
  meaningfulness: ReturnType<typeof assessMeaningfulness>;
}

export interface Exp7Output {
  table: ClosenessBandResult[];
  provenance: ExperimentProvenance;
}

const SAMPLE_FLOOR = MIN_SAMPLE_FOR_TIER_COMPARISON;

export function runExperiment(raw: ReadonlyArray<RawReconstructedLegRow>, datasetIdentifier: string): Exp7Output {
  const { admissible, tracker } = loadAndValidate(raw);

  const bands: ClosenessBand[] = ["low_lt50", "moderate_50to79", "high_ge80"];
  const table: ClosenessBandResult[] = [];
  for (const variant of ["with_market_component", "without_market_component"] as const) {
    for (const band of bands) {
      const rows = admissible.filter((r) => bandFor((variant === "with_market_component" ? r.withMarket : r.withoutMarket).closenessScore) === band);
      table.push({
        variant,
        band,
        n: rows.length,
        winRatePct: accuracy(rows.map((r) => ({ correct: r.won }))),
        meaningfulness: assessMeaningfulness(rows.length, raw.length, SAMPLE_FLOOR, 0.5),
      });
    }
  }

  const provenance = buildProvenance({
    experimentId: "closeness-controlled-for-market@v1",
    formulaVersion:
      "computeClosenessComponents via productionFormulaMirror.ts pinned against " +
      "builderScoringService.ts@db28f8371f2ec4bbfc2b2b3d0e341011cfd8f788",
    datasetIdentifier,
    rows: raw as unknown as Record<string, unknown>[],
    getDate: (r) => r.created_at,
    predictionCutoffRule:
      "Same join-based admissibility as Experiment #6 (backfill row with a joined " +
      "evaluation_predictions row whose odds_fetched_at <= cutoff_at, status='graded', " +
      "includedInAccuracy=true); additionally requires the reconstructed PlayerStats-derived " +
      "closeness inputs to be present on the row.",
    nEligible: tracker.nEligible,
    exclusionReasons: tracker.toReasonsRecord(),
    temporalValidationMethod:
      "Odds temporal admissibility checked via the joined evaluation_predictions timestamps, " +
      "identical to Experiment #4/#6. The non-market closeness inputs (win rate, surface, ranking) " +
      "are assumed already point-in-time-correct by construction of the upstream reconstruction " +
      "export (computePlayerStats against historical_matches, filtered to matches before the leg's " +
      "own date) — this script does not re-verify that upstream step, which is out of its scope.",
  });

  return { table, provenance };
}
