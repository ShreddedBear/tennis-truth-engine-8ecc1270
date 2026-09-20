/**
 * Experiment #2 — Current KEEP/BORDERLINE/REMOVE calibration.
 *
 * See EXPERIMENT_SPECS.md. For graded `parlay_leg_outcomes` rows, re-derives `decision` via the
 * mirror's `toDecision()` from the row's stored validation_score/risk_score/reliability_grade/
 * data_coverage, and compares it to the stored `decision` column. Only rows where the
 * re-derived decision matches the stored one are treated as "scored by current code" and
 * included in the calibration table — a mismatch means the row was scored by an older formula
 * version, and mixing it in would defeat the whole "current code" premise (per the task brief).
 *
 * PREPARATION-ONLY — see exp1RiskFloorOnOff.ts header for the standard disclaimer; this script
 * has not been run against a real database.
 *
 * KNOWN LIMITATION: `toDecision()` also takes `criticalFlags: string[]`, which is NOT persisted
 * on `parlay_leg_outcomes` (only the final `decision` string is). This script always recomputes
 * with `criticalFlags = []`. That means a stored BORDERLINE row whose recomputed decision (with
 * no critical flags) comes out KEEP or REMOVE is NOT necessarily a stale-formula-version row —
 * it may simply be a row where a critical flag (thin data, injury, stale cache, etc.) correctly
 * forced BORDERLINE at scoring time. Such rows are bucketed separately as
 * "unverifiable (criticalFlags not stored)" rather than folded into the stale-formula-version
 * exclusion, so the two very different failure modes are never conflated.
 */

import { toDecision, MIN_SAMPLE_FOR_TIER_COMPARISON } from "./productionFormulaMirror.js";
import { requireFields, accuracy, ExclusionTracker, assessMeaningfulness } from "./sharedValidation.js";
import { buildProvenance, type ExperimentProvenance } from "./experimentProvenance.js";

export interface RawParlayLegOutcomeRow {
  id: number;
  selected_player_id: string | null;
  validation_score: number | null;
  risk_score: number | null;
  reliability_grade: string | null;
  data_coverage: number | null;
  decision: string | null;
  actual_winner_id: string | null;
  resolved_at: string | Date | null;
  created_at: string | Date | null;
}

export interface VerifiedLegRow {
  id: number;
  decision: "KEEP" | "BORDERLINE" | "REMOVE";
  won: boolean;
  createdAt: Date;
}

const STRUCTURAL_FIELDS = [
  "id",
  "selected_player_id",
  "validation_score",
  "risk_score",
  "reliability_grade",
  "data_coverage",
  "decision",
  "created_at",
] as const;

export function loadAndValidate(raw: ReadonlyArray<RawParlayLegOutcomeRow>): {
  verified: VerifiedLegRow[];
  tracker: ExclusionTracker;
} {
  const tracker = new ExclusionTracker();
  const verified: VerifiedLegRow[] = [];

  raw.forEach((row, i) => {
    requireFields(row, STRUCTURAL_FIELDS, `parlay_leg_outcomes row #${i} (id=${row.id ?? "unknown"})`);

    if (row.actual_winner_id == null || row.resolved_at == null) {
      tracker.exclude("not graded (actual_winner_id/resolved_at null)");
      return;
    }
    const storedDecision = row.decision as string;
    if (storedDecision !== "KEEP" && storedDecision !== "BORDERLINE" && storedDecision !== "REMOVE") {
      tracker.exclude(`stored decision is not one of KEEP/BORDERLINE/REMOVE (got "${storedDecision}")`);
      return;
    }

    const recomputed = toDecision(
      row.validation_score as number,
      row.risk_score as number,
      row.reliability_grade as string,
      row.data_coverage as number,
      [], // criticalFlags not persisted — see file header limitation
    );

    if (recomputed !== storedDecision) {
      if (storedDecision === "BORDERLINE" && (recomputed === "KEEP" || recomputed === "REMOVE")) {
        tracker.exclude("unverifiable (criticalFlags not stored) — stored BORDERLINE may have been flag-forced");
      } else {
        tracker.exclude("stale formula version — recomputed decision does not match stored decision");
      }
      return;
    }

    tracker.admit();
    verified.push({
      id: row.id,
      decision: storedDecision,
      won: row.actual_winner_id === row.selected_player_id,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at as string),
    });
  });

  return { verified, tracker };
}

export interface DecisionCalibrationRow {
  decision: "KEEP" | "BORDERLINE" | "REMOVE";
  n: number;
  winRatePct: number | null;
  meaningfulness: ReturnType<typeof assessMeaningfulness>;
}

export interface Exp2Output {
  table: DecisionCalibrationRow[];
  keepVsBorderlineGapPp: number | null;
  provenance: ExperimentProvenance;
}

const SAMPLE_FLOOR = MIN_SAMPLE_FOR_TIER_COMPARISON; // 50 — matches the codebase's own
// keepVsBorderlineGap convention at builderScoringService.ts:2217-2266, which gates on the
// same MIN_SAMPLE_FOR_TIER_COMPARISON constant for exactly this KEEP-vs-BORDERLINE comparison.

export function runExperiment(raw: ReadonlyArray<RawParlayLegOutcomeRow>, datasetIdentifier: string): Exp2Output {
  const { verified, tracker } = loadAndValidate(raw);

  const table: DecisionCalibrationRow[] = (["KEEP", "BORDERLINE", "REMOVE"] as const).map((decision) => {
    const rows = verified.filter((r) => r.decision === decision);
    return {
      decision,
      n: rows.length,
      winRatePct: accuracy(rows.map((r) => ({ correct: r.won }))),
      meaningfulness: assessMeaningfulness(rows.length, raw.length, SAMPLE_FLOOR, 0.5),
    };
  });

  const keepRow = table.find((t) => t.decision === "KEEP")!;
  const borderlineRow = table.find((t) => t.decision === "BORDERLINE")!;
  const keepVsBorderlineGapPp =
    keepRow.meaningfulness.meetsSampleFloor && borderlineRow.meaningfulness.meetsSampleFloor &&
    keepRow.winRatePct != null && borderlineRow.winRatePct != null
      ? Math.round((keepRow.winRatePct - borderlineRow.winRatePct) * 10) / 10
      : null;

  const provenance = buildProvenance({
    experimentId: "current-decision-calibration@v1",
    formulaVersion:
      "toDecision via productionFormulaMirror.ts pinned against " +
      "builderScoringService.ts@db28f8371f2ec4bbfc2b2b3d0e341011cfd8f788",
    datasetIdentifier,
    rows: raw as unknown as Record<string, unknown>[],
    getDate: (r) => r.created_at,
    predictionCutoffRule:
      "row admitted only if graded, stored decision is one of KEEP/BORDERLINE/REMOVE, AND toDecision() " +
      "recomputed with criticalFlags=[] matches the stored decision exactly (mismatches are excluded, " +
      "never silently included, to avoid mixing rows scored by a different formula version).",
    nEligible: tracker.nEligible,
    exclusionReasons: tracker.toReasonsRecord(),
    temporalValidationMethod:
      "No market timestamp is used by this experiment; grading admissibility only requires " +
      "actual_winner_id/resolved_at populated. Formula-version drift is checked per-row by the " +
      "toDecision() recompute-and-compare described in predictionCutoffRule.",
  });

  return { table, keepVsBorderlineGapPp, provenance };
}
