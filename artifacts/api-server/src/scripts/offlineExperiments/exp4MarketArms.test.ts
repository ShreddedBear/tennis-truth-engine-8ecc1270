/**
 * Synthetic/test-only fixtures for exp4MarketArms.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadAndValidate, runExperiment, type RawEvaluationPredictionRow } from "./exp4MarketArms.js";

function baseRow(overrides: Partial<RawEvaluationPredictionRow> = {}): RawEvaluationPredictionRow {
  return {
    id: 1,
    player1Id: "p1",
    player2Id: "p2",
    status: "graded",
    includedInAccuracy: true,
    cutoffAt: "2026-01-01T12:00:00Z",
    predictedWinnerId: "p1",
    actualWinnerId: "p1",
    calibratedProbability: 65,
    impliedProbability: 60,
    oddsPlayer1Decimal: 1.8,
    oddsPlayer2Decimal: 2.1,
    oddsFetchedAt: "2026-01-01T10:00:00Z", // before cutoffAt -> admissible
    ...overrides,
  };
}

test("loadAndValidate: throws naming the exact missing structural field", () => {
  const row = baseRow({ player1Id: null });
  assert.throws(() => loadAndValidate([row]), /missing required field\(s\) \[player1Id\]/);
});

test("loadAndValidate: excludes a row where oddsFetchedAt is after cutoffAt (temporal leakage)", () => {
  const row = baseRow({ oddsFetchedAt: "2026-01-02T00:00:00Z" }); // after cutoffAt
  const { admissible, tracker } = loadAndValidate([row]);
  assert.equal(admissible.length, 0);
  assert.equal(
    tracker.toReasonsRecord()["oddsFetchedAt > cutoffAt — market evidence arrived after the prediction cutoff (temporal leakage)"],
    1,
  );
});

test("loadAndValidate: excludes a row with no market odds at all", () => {
  const row = baseRow({ oddsPlayer1Decimal: null, oddsPlayer2Decimal: null, oddsFetchedAt: null });
  const { admissible, tracker } = loadAndValidate([row]);
  assert.equal(admissible.length, 0);
  assert.ok(tracker.toReasonsRecord()["odds_player1_decimal/odds_player2_decimal/odds_fetched_at is null — no market evidence"] === 1);
});

test("loadAndValidate: excludes a non-graded or accuracy-excluded row", () => {
  const notGraded = baseRow({ status: "pending" });
  const notIncluded = baseRow({ includedInAccuracy: false });
  const { admissible, tracker } = loadAndValidate([notGraded, notIncluded]);
  assert.equal(admissible.length, 0);
  assert.equal(tracker.nExcluded, 2);
});

test("loadAndValidate: admits a fully-populated, temporally-admissible row", () => {
  const { admissible, tracker } = loadAndValidate([baseRow()]);
  assert.equal(admissible.length, 1);
  assert.equal(tracker.nEligible, 1);
});

test("runExperiment: Arm A and Arm C are computable, Arm B and D are honestly marked not-computable", () => {
  const rows: RawEvaluationPredictionRow[] = [
    baseRow({ id: 1, actualWinnerId: "p1" }), // predicted p1, correct
    baseRow({ id: 2, predictedWinnerId: "p2", actualWinnerId: "p1", calibratedProbability: 40 }), // predicted p2, wrong
  ];
  const { table, provenance } = runExperiment(rows, "synthetic fixture (exp4.test.ts)");
  const armA = table.find((t) => t.arm === "A_full_stored")!;
  const armB = table.find((t) => t.arm === "B_no_market")!;
  const armC = table.find((t) => t.arm === "C_market_only")!;
  const armD = table.find((t) => t.arm === "D_market_plus_independent")!;

  assert.equal(armA.computable, true);
  assert.equal(armA.n, 2);
  assert.equal(armA.accuracyPct, 50);

  assert.equal(armB.computable, false);
  assert.match(armB.note ?? "", /runPredictionEngine/);

  assert.equal(armC.computable, true);
  assert.equal(armC.n, 2);

  assert.equal(armD.computable, false);
  assert.match(armD.note ?? "", /documented blend spec/);

  assert.equal(provenance.nTotal, 2);
  assert.equal(provenance.nEligible, 2);
  assert.match(provenance.predictionCutoffRule, /oddsFetchedAt <= cutoffAt/);
});
