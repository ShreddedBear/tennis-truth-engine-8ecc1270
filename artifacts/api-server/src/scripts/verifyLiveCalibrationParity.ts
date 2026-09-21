/**
 * verifyLiveCalibrationParity.ts — one-shot regression check, run against the real live database,
 * proving (not just asserting by inspection) that resolveBuilderCalibrationForScoring(undefined)
 * (the new live-mode path computeBuilderScore now calls) returns EXACTLY what a bare
 * getActiveCalibration() call (the old path) returns, for the SAME live calibration_models state.
 *
 * Read-only: neither call writes anything. Exits non-zero (and prints a clear diff) if they
 * ever diverge, which is the only way live scoring behavior could have silently changed.
 *
 * Run:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/verifyLiveCalibrationParity.ts
 */

import { getActiveCalibration } from "../services/evaluation/calibrationCache.js";
import { resolveBuilderCalibrationForScoring } from "../services/parlayBuilder/builderVersioning.js";

async function main() {
  const oldPath = await getActiveCalibration();
  const newPath = await resolveBuilderCalibrationForScoring(undefined);

  const mappingMatches = JSON.stringify(oldPath.mapping) === JSON.stringify(newPath.mapping);
  const modelIdMatches = oldPath.modelId === newPath.calibrationModelId;

  console.log("OLD path (getActiveCalibration()):", JSON.stringify(oldPath));
  console.log("NEW path (resolveBuilderCalibrationForScoring(undefined)):", JSON.stringify({ mapping: newPath.mapping, calibrationModelId: newPath.calibrationModelId, lineageStatus: newPath.lineageStatus }));
  console.log(`mapping identical: ${mappingMatches}`);
  console.log(`modelId identical: ${modelIdMatches}`);
  console.log(`live-mode lineageStatus: ${newPath.lineageStatus} (expected VALID_HISTORICAL_LINEAGE — live mode is trivially PIT-correct)`);

  if (!mappingMatches || !modelIdMatches || newPath.lineageStatus !== "VALID_HISTORICAL_LINEAGE") {
    console.error("PARITY CHECK FAILED — live-mode calibration resolution has changed behavior.");
    process.exit(1);
  }

  console.log("PARITY CHECK PASSED — live-mode (asOfDate unset) calibration resolution is byte-for-byte identical to the pre-change code path.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
