/**
 * Synthetic/test-only fixtures for exp1RiskFloorOnOff.ts. None of the numbers below are real
 * data — they exist only to prove the loader's fail-fast and admissibility mechanics.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadAndValidate, runExperiment, type RawParlayLegOutcomeRow } from "./exp1RiskFloorOnOff.js";

function baseRow(overrides: Partial<RawParlayLegOutcomeRow> = {}): RawParlayLegOutcomeRow {
  return {
    id: 1,
    selected_player_id: "p1",
    validation_score: 70,
    risk_score: 20,
    source: "backfill",
    created_at: "2026-01-01T00:00:00Z",
    matchup_closeness: 30, // closenessRiskFloor(30) = 0
    actual_winner_id: "p1",
    resolved_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

test("loadAndValidate: throws naming the exact missing structural field", () => {
  const row = baseRow({ validation_score: null });
  assert.throws(() => loadAndValidate([row]), /missing required field\(s\) \[validation_score\]/);
});

test("loadAndValidate: throws naming multiple missing structural fields at once", () => {
  const row = baseRow({ risk_score: null, source: null });
  assert.throws(() => loadAndValidate([row]), /missing required field\(s\) \[risk_score, source\]/);
});

test("loadAndValidate: excludes (does not throw) an ungraded row", () => {
  const row = baseRow({ actual_winner_id: null, resolved_at: null });
  const { admissible, tracker } = loadAndValidate([row]);
  assert.equal(admissible.length, 0);
  assert.equal(tracker.nTotal, 1);
  assert.equal(tracker.toReasonsRecord()["not graded (actual_winner_id/resolved_at null)"], 1);
});

test("loadAndValidate: excludes a row whose risk_score is below the closeness-implied floor as stale-formula", () => {
  // matchup_closeness=90 -> closenessRiskFloor(90) = 48; risk_score=10 is impossible under current code.
  const row = baseRow({ matchup_closeness: 90, risk_score: 10 });
  const { admissible, tracker } = loadAndValidate([row]);
  assert.equal(admissible.length, 0);
  assert.equal(
    tracker.toReasonsRecord()["risk_score below closeness-implied floor — likely scored by an older formula version"],
    1,
  );
});

test("loadAndValidate: admits a well-formed graded row and classifies floor-bound correctly", () => {
  // matchup_closeness=90 -> floor=48; risk_score=48 -> floor_likely_bound
  const bound = baseRow({ id: 1, matchup_closeness: 90, risk_score: 48 });
  // matchup_closeness=30 -> floor=0; risk_score=20 -> floor_did_not_bind
  const notBound = baseRow({ id: 2, matchup_closeness: 30, risk_score: 20 });
  const { admissible, tracker } = loadAndValidate([bound, notBound]);
  assert.equal(admissible.length, 2);
  assert.equal(tracker.nEligible, 2);
  assert.equal(admissible[0].floorLikelyBound, true);
  assert.equal(admissible[1].floorLikelyBound, false);
});

test("runExperiment: produces the two-bucket table shape and a reconciled provenance record on synthetic data", () => {
  const rows: RawParlayLegOutcomeRow[] = [
    baseRow({ id: 1, matchup_closeness: 90, risk_score: 48, actual_winner_id: "p1" }), // bound, won
    baseRow({ id: 2, matchup_closeness: 90, risk_score: 48, selected_player_id: "p2", actual_winner_id: "p1" }), // bound, lost
    baseRow({ id: 3, matchup_closeness: 30, risk_score: 20, actual_winner_id: "p1" }), // not bound, won
    baseRow({ id: 4, actual_winner_id: null, resolved_at: null }), // excluded: ungraded
  ];
  const { table, provenance } = runExperiment(rows, "synthetic fixture (exp1RiskFloorOnOff.test.ts)");

  assert.equal(table.length, 2);
  const bound = table.find((t) => t.bucket === "floor_likely_bound")!;
  const notBound = table.find((t) => t.bucket === "floor_did_not_bind")!;
  assert.equal(bound.n, 2);
  assert.equal(bound.winRatePct, 50);
  assert.equal(notBound.n, 1);
  assert.equal(notBound.winRatePct, 100);
  // Neither bucket clears the n>=50 sample floor on this tiny synthetic fixture — expected.
  assert.equal(bound.meaningfulness.isMeaningful, false);

  assert.equal(provenance.nTotal, 4);
  assert.equal(provenance.nEligible, 3);
  assert.equal(provenance.nExcluded, 1);
  assert.deepEqual(provenance.exclusionReasons, { "not graded (actual_winner_id/resolved_at null)": 1 });
  assert.match(provenance.codeCommit, /^[0-9a-f]{40}$/);
});
