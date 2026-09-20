import test from "node:test";
import assert from "node:assert/strict";
import { BUILDER_CALIBRATION_MIN_SAMPLE, BUILDER_CALIBRATION_VERSION, fitBuilderCalibration } from "./builderCalibration";

function rows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    validationScore: index % 2 === 0 ? index : 100 - index,
    selectedPlayerId: `p-${index}`,
    actualWinnerId: index % 3 === 0 ? `p-${index}` : `other-${index}`,
  }));
}

test("Builder isotonic calibration is monotonic and carries explicit provenance", () => {
  const model = fitBuilderCalibration(rows(100));
  assert.equal(model.eligible, true);
  assert.equal(model.modelVersion, BUILDER_CALIBRATION_VERSION);
  assert.equal(model.method, "isotonic");
  assert.ok(model.mapping.length > 0);
  assert.match(model.provenance, /parlay_leg_outcomes\.resolved/);
  let previous = -Infinity;
  for (const score of [0, 10, 25, 50, 75, 100]) {
    const mapped = model.mapProbability(score);
    assert.ok(mapped >= previous, `${mapped} should not decrease after ${previous}`);
    previous = mapped;
  }
});

test("Builder calibration schema contract is additive and leaves existing outcome provenance nullable", async () => {
  const { readFile } = await import("node:fs/promises");
  const schema = await readFile(new URL("../../lib/ensureEvaluationSchema.ts", import.meta.url), "utf8");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS builder_calibration_models/);
  assert.match(schema, /ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS builder_calibrated_probability NUMERIC/);
  assert.match(schema, /ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS builder_calibration_model_id INTEGER/);
  assert.match(schema, /ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS builder_calibration_provenance TEXT/);
  assert.match(schema, /UNIQUE \(model_version, fingerprint\)/);
});

test("every Builder outcome writer persists the six provenance fields", async () => {
  const { readFile } = await import("node:fs/promises");
  const writers = await Promise.all([
    readFile(new URL("../../routes/adminParlay.ts", import.meta.url), "utf8"),
    readFile(new URL("../../scripts/backfillParlayLegOutcomes.ts", import.meta.url), "utf8"),
  ]);
  for (const writer of writers) {
    for (const column of [
      "builder_calibrated_probability",
      "builder_model_version",
      "builder_calibration_version",
      "builder_calibration_fingerprint",
      "builder_calibration_model_id",
      "builder_calibration_provenance",
    ]) {
      assert.match(writer, new RegExp(column), `${column} missing from Builder outcome writer`);
    }
  }
});

test("Builder calibration falls back to raw probability below its minimum sample threshold", () => {
  const model = fitBuilderCalibration(rows(BUILDER_CALIBRATION_MIN_SAMPLE - 1));
  assert.equal(model.eligible, false);
  assert.equal(model.mapProbability(63.4), 63.4);
  assert.match(model.provenance, /minimum sample/);
});

test("Builder calibration exposes a stable model version and data fingerprint", () => {
  const first = fitBuilderCalibration(rows(BUILDER_CALIBRATION_MIN_SAMPLE));
  const second = fitBuilderCalibration(rows(BUILDER_CALIBRATION_MIN_SAMPLE));
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.sampleSize, BUILDER_CALIBRATION_MIN_SAMPLE);
  assert.equal(first.modelVersion, second.modelVersion);
});