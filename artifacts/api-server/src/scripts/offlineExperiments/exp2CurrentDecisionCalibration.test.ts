/**
 * Synthetic/test-only fixtures for exp2CurrentDecisionCalibration.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadAndValidate, runExperiment, type RawParlayLegOutcomeRow } from "./exp2CurrentDecisionCalibration.js";

function baseRow(overrides: Partial<RawParlayLegOutcomeRow> = {}): RawParlayLegOutcomeRow {
  return {
    id: 1,
    selected_player_id: "p1",
    validation_score: 70,
    risk_score: 30,
    reliability_grade: "B",
    data_coverage: 80,
    decision: "KEEP", // val>=62 && risk<=44 -> recomputes to KEEP, matches
    actual_winner_id: "p1",
    resolved_at: "2026-01-02T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

test("loadAndValidate: throws naming the exact missing structural field", () => {
  const row = baseRow({ reliability_grade: null });
  assert.throws(() => loadAndValidate([row]), /missing required field\(s\) \[reliability_grade\]/);
});

test("loadAndValidate: admits a row whose recomputed decision matches the stored decision", () => {
  const { verified, tracker } = loadAndValidate([baseRow()]);
  assert.equal(verified.length, 1);
  assert.equal(verified[0].decision, "KEEP");
  assert.equal(tracker.nEligible, 1);
});

test("loadAndValidate: excludes as stale-formula when recompute disagrees and stored wasn't BORDERLINE", () => {
  // val=55,risk=50 recomputes to BORDERLINE, but stored is REMOVE — not the criticalFlags case.
  const row = baseRow({ validation_score: 55, risk_score: 50, decision: "REMOVE" });
  const { verified, tracker } = loadAndValidate([row]);
  assert.equal(verified.length, 0);
  assert.equal(
    tracker.toReasonsRecord()["stale formula version — recomputed decision does not match stored decision"],
    1,
  );
});

test("loadAndValidate: excludes as unverifiable when stored BORDERLINE but recompute (no flags) gives KEEP", () => {
  // val=70,risk=30 recomputes to KEEP; stored BORDERLINE could be legitimately flag-forced.
  const row = baseRow({ decision: "BORDERLINE" });
  const { verified, tracker } = loadAndValidate([row]);
  assert.equal(verified.length, 0);
  assert.equal(
    tracker.toReasonsRecord()["unverifiable (criticalFlags not stored) — stored BORDERLINE may have been flag-forced"],
    1,
  );
});

test("runExperiment: produces a KEEP/BORDERLINE/REMOVE table and reconciled provenance on synthetic data", () => {
  const rows: RawParlayLegOutcomeRow[] = [
    baseRow({ id: 1, actual_winner_id: "p1" }), // KEEP, won
    baseRow({ id: 2, selected_player_id: "p2", actual_winner_id: "p1" }), // KEEP, lost
    baseRow({ id: 3, validation_score: 50, risk_score: 50, decision: "BORDERLINE", actual_winner_id: "p1" }), // BORDERLINE, won
    baseRow({ id: 4, actual_winner_id: null, resolved_at: null }), // excluded: ungraded
  ];
  const { table, provenance } = runExperiment(rows, "synthetic fixture (exp2.test.ts)");
  const keep = table.find((t) => t.decision === "KEEP")!;
  const borderline = table.find((t) => t.decision === "BORDERLINE")!;
  assert.equal(keep.n, 2);
  assert.equal(keep.winRatePct, 50);
  assert.equal(borderline.n, 1);
  assert.equal(borderline.winRatePct, 100);
  assert.equal(provenance.nTotal, 4);
  assert.equal(provenance.nEligible, 3);
  assert.deepEqual(provenance.exclusionReasons, { "not graded (actual_winner_id/resolved_at null)": 1 });
});
