/**
 * Synthetic/test-only fixtures for exp3BorderlineSeparation.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadAndValidate, runExperiment } from "./exp3BorderlineSeparation.js";
import type { RawParlayLegOutcomeRow } from "./exp2CurrentDecisionCalibration.js";

type Row = RawParlayLegOutcomeRow & { validation_score: number | null; risk_score: number | null };

function baseRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 1,
    selected_player_id: "p1",
    validation_score: 61, // val=61,risk=44 -> distanceToKeep = min(-1, 0) = -1 -> near_keep_boundary
    risk_score: 44,
    reliability_grade: "B",
    data_coverage: 80,
    decision: "BORDERLINE",
    actual_winner_id: "p1",
    resolved_at: "2026-01-02T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

test("loadAndValidate: throws naming the exact missing structural field (inherited from exp2)", () => {
  const row = baseRow({ data_coverage: null });
  assert.throws(() => loadAndValidate([row]), /missing required field\(s\) \[data_coverage\]/);
});

test("loadAndValidate: excludes verified rows whose decision is not BORDERLINE", () => {
  const keepRow = baseRow({ validation_score: 70, risk_score: 30, decision: "KEEP" });
  const { borderline, tracker } = loadAndValidate([keepRow]);
  assert.equal(borderline.length, 0);
  assert.equal(tracker.toReasonsRecord()["verified-current-code but decision is not BORDERLINE"], 1);
});

test("loadAndValidate: classifies a row right at the KEEP boundary as near_keep_boundary", () => {
  const { borderline } = loadAndValidate([baseRow()]);
  assert.equal(borderline.length, 1);
  assert.equal(borderline[0].bucket, "near_keep_boundary");
});

test("loadAndValidate: classifies a row deep in the middle as deep_middle", () => {
  // val=48,risk=57 -> distToKeep=min(48-62,44-57)=min(-14,-13)=-14; distToRemove=max(33-48,57-70)=max(-15,-13)=-13
  const row = baseRow({ validation_score: 48, risk_score: 57 });
  const { borderline } = loadAndValidate([row]);
  assert.equal(borderline[0].bucket, "deep_middle");
});

test("runExperiment: produces the four-bucket table and reconciled provenance on synthetic data", () => {
  const rows: Row[] = [
    baseRow({ id: 1, actual_winner_id: "p1" }), // near_keep_boundary, won
    baseRow({ id: 2, selected_player_id: "p2", actual_winner_id: "p1" }), // near_keep_boundary, lost
    baseRow({ id: 3, validation_score: 48, risk_score: 57, actual_winner_id: "p1" }), // deep_middle, won
  ];
  const { table, provenance } = runExperiment(rows, "synthetic fixture (exp3.test.ts)");
  const nearKeep = table.find((t) => t.bucket === "near_keep_boundary")!;
  const deepMiddle = table.find((t) => t.bucket === "deep_middle")!;
  assert.equal(nearKeep.n, 2);
  assert.equal(nearKeep.winRatePct, 50);
  assert.equal(deepMiddle.n, 1);
  assert.equal(deepMiddle.winRatePct, 100);
  assert.equal(provenance.nTotal, 3);
  assert.equal(provenance.nEligible, 3);
});
