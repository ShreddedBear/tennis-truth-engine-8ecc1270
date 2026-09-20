/**
 * Experiment #3 — Borderline separation analysis.
 *
 * See EXPERIMENT_SPECS.md. Uses the SAME "verified as scored by current code" corpus as
 * Experiment #2 (imported directly — never re-derived a second time), restricted to rows whose
 * recomputed decision is BORDERLINE. Buckets those rows by distance from the KEEP line
 * (val>=62, risk<=44) and the REMOVE line (val<=33 OR risk>=70), using the mirror's
 * distanceToKeepLine/distanceToRemoveLine, and reports actual win rate per bucket — to
 * distinguish "correctly uncertain" (win rate near 50% everywhere) from "thresholds too
 * conservative" (rows near the KEEP line win at a KEEP-like rate) from "no underlying
 * separation" (win rate doesn't vary meaningfully with distance at all).
 *
 * PREPARATION-ONLY — see exp1RiskFloorOnOff.ts header for the standard disclaimer.
 */

import { distanceToKeepLine, distanceToRemoveLine, MIN_SAMPLE_FOR_TIER_COMPARISON } from "./productionFormulaMirror.js";
import { accuracy, ExclusionTracker, assessMeaningfulness } from "./sharedValidation.js";
import { buildProvenance, type ExperimentProvenance } from "./experimentProvenance.js";
import { loadAndValidate as loadVerifiedDecisionRows, type RawParlayLegOutcomeRow } from "./exp2CurrentDecisionCalibration.js";

export type { RawParlayLegOutcomeRow };

/** Distance-boundary bucket. "near" means within 10 score-points of crossing that line. */
export type BoundaryBucket = "near_keep_boundary" | "near_remove_boundary" | "deep_middle" | "near_both_boundaries";

const NEAR_THRESHOLD = 10;

function bucketFor(distKeep: number, distRemove: number): BoundaryBucket {
  const nearKeep = distKeep > -NEAR_THRESHOLD;
  const nearRemove = distRemove > -NEAR_THRESHOLD;
  if (nearKeep && nearRemove) return "near_both_boundaries";
  if (nearKeep) return "near_keep_boundary";
  if (nearRemove) return "near_remove_boundary";
  return "deep_middle";
}

export interface BorderlineRow {
  id: number;
  won: boolean;
  distanceToKeep: number;
  distanceToRemove: number;
  bucket: BoundaryBucket;
}

/**
 * Needs raw validation_score/risk_score too (exp2's verified rows don't carry them through) —
 * this loader re-runs exp2's verification for correctness-of-formula-version, then separately
 * requires the two score fields to compute distances. Never recomputes toDecision() a second
 * way; reuses exactly the same recomputed-vs-stored check as exp2.
 */
export function loadAndValidate(raw: ReadonlyArray<RawParlayLegOutcomeRow & { validation_score: number | null; risk_score: number | null }>): {
  borderline: BorderlineRow[];
  tracker: ExclusionTracker;
} {
  const { verified, tracker: exp2Tracker } = loadVerifiedDecisionRows(raw);
  const tracker = new ExclusionTracker();
  // Re-play exp2's exclusions into this experiment's own tracker so provenance reflects the
  // full picture (exp2's structural throws already happened inside loadVerifiedDecisionRows).
  for (const [reason, count] of Object.entries(exp2Tracker.toReasonsRecord())) {
    for (let i = 0; i < count; i++) tracker.exclude(reason);
  }

  const raw2ById = new Map(raw.map((r) => [r.id, r]));
  const borderline: BorderlineRow[] = [];

  for (const v of verified) {
    if (v.decision !== "BORDERLINE") {
      tracker.exclude("verified-current-code but decision is not BORDERLINE");
      continue;
    }
    const raw2 = raw2ById.get(v.id)!;
    const valScore = raw2.validation_score as number;
    const riskScore = raw2.risk_score as number;
    tracker.admit();
    borderline.push({
      id: v.id,
      won: v.won,
      distanceToKeep: distanceToKeepLine(valScore, riskScore),
      distanceToRemove: distanceToRemoveLine(valScore, riskScore),
      bucket: bucketFor(distanceToKeepLine(valScore, riskScore), distanceToRemoveLine(valScore, riskScore)),
    });
  }

  return { borderline, tracker };
}

export interface BoundaryBucketResult {
  bucket: BoundaryBucket;
  n: number;
  winRatePct: number | null;
  meaningfulness: ReturnType<typeof assessMeaningfulness>;
}

export interface Exp3Output {
  table: BoundaryBucketResult[];
  provenance: ExperimentProvenance;
}

const SAMPLE_FLOOR = MIN_SAMPLE_FOR_TIER_COMPARISON;

export function runExperiment(
  raw: ReadonlyArray<RawParlayLegOutcomeRow & { validation_score: number | null; risk_score: number | null }>,
  datasetIdentifier: string,
): Exp3Output {
  const { borderline, tracker } = loadAndValidate(raw);

  const buckets: BoundaryBucket[] = ["near_keep_boundary", "near_remove_boundary", "near_both_boundaries", "deep_middle"];
  const table: BoundaryBucketResult[] = buckets.map((bucket) => {
    const rows = borderline.filter((r) => r.bucket === bucket);
    return {
      bucket,
      n: rows.length,
      winRatePct: accuracy(rows.map((r) => ({ correct: r.won }))),
      meaningfulness: assessMeaningfulness(rows.length, raw.length, SAMPLE_FLOOR, 0.5),
    };
  });

  const provenance = buildProvenance({
    experimentId: "borderline-separation@v1",
    formulaVersion:
      "toDecision + distanceToKeepLine/distanceToRemoveLine via productionFormulaMirror.ts pinned " +
      "against builderScoringService.ts@db28f8371f2ec4bbfc2b2b3d0e341011cfd8f788",
    datasetIdentifier,
    rows: raw as unknown as Record<string, unknown>[],
    getDate: (r) => r.created_at,
    predictionCutoffRule:
      "same corpus and admissibility as current-decision-calibration@v1 (graded + recomputed " +
      "decision matches stored decision via toDecision(criticalFlags=[])), further restricted to " +
      "rows whose recomputed decision is BORDERLINE.",
    nEligible: tracker.nEligible,
    exclusionReasons: tracker.toReasonsRecord(),
    temporalValidationMethod:
      "Inherits Experiment #2's admissibility checks; no market timestamp is used directly by " +
      "this experiment's own bucketing logic.",
  });

  return { table, provenance };
}
