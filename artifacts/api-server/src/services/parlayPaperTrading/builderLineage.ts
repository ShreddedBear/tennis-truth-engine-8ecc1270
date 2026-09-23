/**
 * Resolves the CURRENT production Builder's lineage for a live (not backfill) paper-trade
 * decision: the exact live weight-table fingerprint, plus whichever calibration model
 * `resolveBuilderCalibrationForScoring` (builderVersioning.ts, already fully PIT-safe and
 * already wired into computeBuilderScore) says is genuinely active right now.
 *
 * Closes a gap identified during discovery: nothing in the codebase previously fingerprinted
 * builderScoringService.ts's actual live DEFAULT_WEIGHTS/AGREEMENT_EDGE_WEIGHTS into a
 * `parlay_builder_version_manifests` row or otherwise -- BUILDER_VERSION alone ("1.0.0",
 * unchanged since introduction) doesn't distinguish a weight re-tune from no change at all.
 * This module doesn't write a manifest row (that's a separate, deliberate authoring step --
 * see Phase 11 follow-up); it just computes a real, reproducible fingerprint of the weights
 * that were actually live at decision time, so every paper-trade row can be tied to it.
 */
import {
  BUILDER_VERSION,
  DEFAULT_WEIGHTS,
  AGREEMENT_EDGE_WEIGHTS,
} from "../parlayBuilder/builderScoringService.js";
import {
  computeConfigFingerprint,
  resolveBuilderCalibrationForScoring,
  type BuilderLineageStatus,
} from "../parlayBuilder/builderVersioning.js";

export interface ResolvedBuilderLineage {
  builderVersion: string;
  builderConfigFingerprint: string;
  builderLineageStatus: BuilderLineageStatus;
  builderLineageReason: string;
  calibrationModelId: number | null;
  /** Always non-null, used as the duplicate-side-evaluation unique-index key (see schema). */
  lineageKey: string;
}

export async function resolveLiveBuilderLineage(): Promise<ResolvedBuilderLineage> {
  const builderConfigFingerprint = computeConfigFingerprint({
    defaultWeights: DEFAULT_WEIGHTS,
    agreementEdgeWeights: AGREEMENT_EDGE_WEIGHTS,
  });

  // Live mode (asOfDate omitted): resolveBuilderCalibrationForScoring delegates straight to
  // getActiveCalibration() -- identical to how computeBuilderScore itself resolves calibration
  // for a live call. Never re-implemented here; reused exactly.
  const { calibrationModelId, lineageStatus, lineageReason } = await resolveBuilderCalibrationForScoring(undefined);

  const lineageKey = `${builderConfigFingerprint}:${calibrationModelId ?? "no-calibration"}:${lineageStatus}`;

  return {
    builderVersion: BUILDER_VERSION,
    builderConfigFingerprint,
    builderLineageStatus: lineageStatus,
    builderLineageReason: lineageReason,
    calibrationModelId,
    lineageKey,
  };
}
