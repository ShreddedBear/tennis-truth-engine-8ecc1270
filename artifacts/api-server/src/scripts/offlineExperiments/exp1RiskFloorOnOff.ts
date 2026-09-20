/**
 * Experiment #1 — Risk Floor ON vs OFF.
 *
 * See EXPERIMENT_SPECS.md for the full spec. Summary: for graded `parlay_leg_outcomes` rows,
 * infer whether the matchup-closeness risk floor (productionFormulaMirror.closenessRiskFloor)
 * was the binding constraint on the stored `risk_score`, and compare win-rate/calibration in
 * the "floor bound" bucket vs the "floor did not bind" bucket.
 *
 * PREPARATION-ONLY: this script is written and unit-tested against synthetic fixtures
 * (exp1RiskFloorOnOff.test.ts). It has not been run against a real database — there is no
 * DATABASE_URL in this environment, and per the task brief, `parlay_leg_outcomes` currently has
 * 0 graded rows in the authorized DB inventory (see docs/audits/... section 13), so running it
 * today against the real table would produce N_eligible=0 regardless.
 *
 * KNOWN LIMITATION (documented, not silently worked around): `parlay_leg_outcomes` does not
 * persist the raw match-history inputs (win rates, surface totals, etc.) that fed the risk
 * formula, only the FINAL `risk_score` and `matchup_closeness`. This script therefore cannot
 * reconstruct the true pre-floor risk score. Instead it infers floor engagement by comparing
 * the stored `risk_score` to `closenessRiskFloor(matchup_closeness)`:
 *   - risk_score === closenessRiskFloor(matchup_closeness)  -> "floor likely bound"
 *   - risk_score  >  closenessRiskFloor(matchup_closeness)  -> "floor did not bind"
 *   - risk_score  <  closenessRiskFloor(matchup_closeness)  -> IMPOSSIBLE under current-code
 *     scoring (postClosenessRisk = max(preClosenessRisk, floor) can never be below the floor);
 *     such rows are excluded and counted as "scored by a different formula version", the same
 *     protection Experiment #2 applies.
 * This also means the (separate, unreconstructable-from-stored-data) thin-data risk floor is
 * NOT isolated here — a row bucketed "floor did not bind" on the closeness floor could still
 * have had the thin-data floor engaged instead. That caveat must accompany any real result this
 * script ever produces.
 *
 * NOT A VALID ON/OFF CAUSAL COMPARISON TODAY (explicit, per review): the bucketing this script
 * performs is an INFERENCE about which floor a row's final risk_score is consistent with — it is
 * NOT evidence of what that row's risk_score and outcome calibration WOULD have been had the
 * closeness floor never fired. The "floor_did_not_bind" bucket is not a counterfactual "floor OFF"
 * arm; it is simply the set of rows where the floor happened not to be the binding constraint.
 * Comparing win rate between the two buckets, as this script's output table currently allows, is
 * NOT sufficient grounds to conclude the floor improves or harms calibration, even once
 * parlay_leg_outcomes has graded rows. This experiment must remain classified
 * BLOCKED — MISSING DATA (not merely "blocked on row count") until the historical dataset either:
 *   (a) persists BOTH pre-floor risk and final risk_score per row (the cleanest fix — a schema
 *       addition to parlay_leg_outcomes, out of scope for this task), or
 *   (b) persists enough component-level inputs (the raw PlayerStats/factor scores that fed the
 *       risk formula) to deterministically recompute preClosenessRisk via the pinned mirror.
 * Only with (a) or (b) can the same eligible historical matches be scored under floor-ON and
 * floor-OFF as two arms on a shared temporal holdout, which is the actual experiment design this
 * script's name promises. Until then, treat any output from this script as descriptive bucketing
 * only, never as an ON/OFF causal result.
 */

import {
  closenessRiskFloor,
  MIN_SAMPLE_FOR_TIER_COMPARISON,
} from "./productionFormulaMirror.js";
import { requireFields, accuracy, ExclusionTracker, assessMeaningfulness } from "./sharedValidation.js";
import { buildProvenance, type ExperimentProvenance } from "./experimentProvenance.js";

export interface RawParlayLegOutcomeRow {
  id: number;
  selected_player_id: string | null;
  validation_score: number | null;
  risk_score: number | null;
  source: string | null;
  created_at: string | Date | null;
  matchup_closeness: number | null;
  actual_winner_id: string | null;
  resolved_at: string | Date | null;
}

export interface AdmissibleLegRow {
  id: number;
  selectedPlayerId: string;
  validationScore: number;
  riskScore: number;
  source: string;
  createdAt: Date;
  matchupCloseness: number;
  actualWinnerId: string;
  won: boolean;
  floorFromCloseness: number;
  floorLikelyBound: boolean;
}

const STRUCTURAL_FIELDS = ["id", "selected_player_id", "validation_score", "risk_score", "source", "created_at"] as const;

/**
 * Loads + validates rows for Experiment #1. Throws for any row missing a field that should
 * NEVER be absent on a `parlay_leg_outcomes` row (data corruption). Excludes-and-counts (never
 * throws) for rows that are simply not graded yet, or not scored by the current formula
 * version — both expected, normal states for this table today.
 */
export function loadAndValidate(raw: ReadonlyArray<RawParlayLegOutcomeRow>): {
  admissible: AdmissibleLegRow[];
  tracker: ExclusionTracker;
} {
  const tracker = new ExclusionTracker();
  const admissible: AdmissibleLegRow[] = [];

  raw.forEach((row, i) => {
    requireFields(row, STRUCTURAL_FIELDS, `parlay_leg_outcomes row #${i} (id=${row.id ?? "unknown"})`);

    if (row.actual_winner_id == null || row.resolved_at == null) {
      tracker.exclude("not graded (actual_winner_id/resolved_at null)");
      return;
    }
    if (row.matchup_closeness == null) {
      tracker.exclude("matchup_closeness is null");
      return;
    }

    const floorFromCloseness = closenessRiskFloor(row.matchup_closeness);
    const riskScore = row.risk_score as number;
    if (riskScore < floorFromCloseness) {
      tracker.exclude("risk_score below closeness-implied floor — likely scored by an older formula version");
      return;
    }

    tracker.admit();
    admissible.push({
      id: row.id,
      selectedPlayerId: row.selected_player_id as string,
      validationScore: row.validation_score as number,
      riskScore,
      source: row.source as string,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at as string),
      matchupCloseness: row.matchup_closeness,
      actualWinnerId: row.actual_winner_id,
      won: row.actual_winner_id === row.selected_player_id,
      floorFromCloseness,
      floorLikelyBound: riskScore === floorFromCloseness,
    });
  });

  return { admissible, tracker };
}

export interface RiskFloorBucketResult {
  bucket: "floor_likely_bound" | "floor_did_not_bind";
  n: number;
  winRatePct: number | null;
  meaningfulness: ReturnType<typeof assessMeaningfulness>;
}

export interface Exp1Output {
  table: RiskFloorBucketResult[];
  provenance: ExperimentProvenance;
}

const SAMPLE_FLOOR = MIN_SAMPLE_FOR_TIER_COMPARISON; // 50, codebase's own minimum-n convention

export function runExperiment(raw: ReadonlyArray<RawParlayLegOutcomeRow>, datasetIdentifier: string): Exp1Output {
  const { admissible, tracker } = loadAndValidate(raw);

  const bound = admissible.filter((r) => r.floorLikelyBound);
  const notBound = admissible.filter((r) => !r.floorLikelyBound);

  const table: RiskFloorBucketResult[] = [
    {
      bucket: "floor_likely_bound",
      n: bound.length,
      winRatePct: accuracy(bound.map((r) => ({ correct: r.won }))),
      meaningfulness: assessMeaningfulness(bound.length, raw.length, SAMPLE_FLOOR, 0.5),
    },
    {
      bucket: "floor_did_not_bind",
      n: notBound.length,
      winRatePct: accuracy(notBound.map((r) => ({ correct: r.won }))),
      meaningfulness: assessMeaningfulness(notBound.length, raw.length, SAMPLE_FLOOR, 0.5),
    },
  ];

  const provenance = buildProvenance({
    experimentId: "risk-floor-on-off@v1",
    formulaVersion:
      "closenessRiskFloor via productionFormulaMirror.ts pinned against " +
      "builderScoringService.ts@db28f8371f2ec4bbfc2b2b3d0e341011cfd8f788",
    datasetIdentifier,
    rows: raw as unknown as Record<string, unknown>[],
    getDate: (r) => r.created_at,
    predictionCutoffRule:
      "row admitted only if graded (actual_winner_id & resolved_at non-null) and matchup_closeness " +
      "non-null; risk_score below closenessRiskFloor(matchup_closeness) is treated as an impossible " +
      "state under current-code scoring and excluded as a stale-formula-version row.",
    nEligible: tracker.nEligible,
    exclusionReasons: tracker.toReasonsRecord(),
    temporalValidationMethod:
      "parlay_leg_outcomes has no fetch/observation timestamp on market_odds and no per-row scoring " +
      "timestamp other than created_at/resolved_at; this experiment does not use market_odds at all, " +
      "so no market-side temporal check applies. Grading admissibility only requires actual_winner_id " +
      "and resolved_at to be populated.",
  });

  return { table, provenance };
}
