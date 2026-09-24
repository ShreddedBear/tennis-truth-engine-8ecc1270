// Regression tests for the Prediction Engine stats/provenance separation: getEvaluationPredictionStats
// must never let one population's rows leak into another's counts, must never treat pending/missed
// rows as losses, and must compute accuracy only over graded rows. Uses its own throwaway rows
// (player ids namespaced to this test run) and asserts on the DELTA between a before/after call
// rather than exact counts against the shared evaluation_predictions table, which already carries
// real production and other tests' rows -- see .agents/memory/test-isolation-against-live-tables.md.
// Run with: pnpm --filter @workspace/api-server run test:evaluation
import test from "node:test";
import assert from "node:assert/strict";
import { db, evaluationPredictionsTable, type InsertEvaluationPrediction } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { getEvaluationPredictionStats, type EvaluationPredictionStatsRunKind } from "./predictionStats";

const RUN_TAG = `stats-provenance-test-${Date.now()}`;

function row(overrides: Partial<InsertEvaluationPrediction> & { runKind: EvaluationPredictionStatsRunKind }): InsertEvaluationPrediction {
  return {
    player1Id: `${RUN_TAG}-p1-${Math.random().toString(36).slice(2)}`,
    player1Name: "Test Player One",
    player2Id: `${RUN_TAG}-p2-${Math.random().toString(36).slice(2)}`,
    player2Name: "Test Player Two",
    scheduledStartAt: new Date("2026-01-01T12:00:00Z"),
    cutoffAt: new Date("2026-01-01T11:30:00Z"),
    modelVersion: "test-version",
    status: "pending",
    ...overrides,
  } satisfies InsertEvaluationPrediction;
}

async function insertRows(rows: InsertEvaluationPrediction[]): Promise<number[]> {
  const inserted = await db.insert(evaluationPredictionsTable).values(rows).returning({ id: evaluationPredictionsTable.id });
  return inserted.map((r) => r.id);
}

async function cleanup(ids: number[]) {
  if (ids.length === 0) return;
  await db.delete(evaluationPredictionsTable).where(inArray(evaluationPredictionsTable.id, ids));
}

test("1: paper_trade stats contain only paper_trade rows -- a historical_test row inserted alongside never leaks in", async (t) => {
  const before = await getEvaluationPredictionStats("paper_trade");
  const ids = await insertRows([
    row({ runKind: "paper_trade", status: "pending" }),
    row({ runKind: "historical_test", status: "pending" }),
  ]);
  t.after(() => cleanup(ids));

  const after = await getEvaluationPredictionStats("paper_trade");
  assert.equal(after.totalPredictions - before.totalPredictions, 1, "only the paper_trade row should be counted");
  assert.equal(after.provenance, "paper_trade");
});

test("2: historical_test stats contain only historical_test rows -- a paper_trade row inserted alongside never leaks in", async (t) => {
  const before = await getEvaluationPredictionStats("historical_test");
  const ids = await insertRows([
    row({ runKind: "historical_test", status: "pending" }),
    row({ runKind: "paper_trade", status: "pending" }),
  ]);
  t.after(() => cleanup(ids));

  const after = await getEvaluationPredictionStats("historical_test");
  assert.equal(after.totalPredictions - before.totalPredictions, 1, "only the historical_test row should be counted");
  assert.equal(after.provenance, "historical_test");
});

test("3: paper_trade_shadow stats contain only paper_trade_shadow rows", async (t) => {
  const before = await getEvaluationPredictionStats("paper_trade_shadow");
  const ids = await insertRows([
    row({ runKind: "paper_trade_shadow", status: "pending" }),
    row({ runKind: "paper_trade", status: "pending" }),
    row({ runKind: "historical_test", status: "pending" }),
  ]);
  t.after(() => cleanup(ids));

  const after = await getEvaluationPredictionStats("paper_trade_shadow");
  assert.equal(after.totalPredictions - before.totalPredictions, 1, "only the paper_trade_shadow row should be counted");
  assert.equal(after.provenance, "paper_trade_shadow");
});

test("4: omitting runKind stays explicitly mixed -- every population is aggregated together, never silently narrowed", async (t) => {
  const before = await getEvaluationPredictionStats();
  const ids = await insertRows([
    row({ runKind: "paper_trade", status: "pending" }),
    row({ runKind: "historical_test", status: "pending" }),
    row({ runKind: "paper_trade_shadow", status: "pending" }),
  ]);
  t.after(() => cleanup(ids));

  const after = await getEvaluationPredictionStats();
  assert.equal(after.provenance, "mixed");
  assert.equal(after.totalPredictions - before.totalPredictions, 3, "all three populations must be counted together when unscoped");
});

test("5: a pending row is never counted as a loss (resolvedPredictions/correctPredictions unaffected)", async (t) => {
  const before = await getEvaluationPredictionStats("paper_trade");
  const ids = await insertRows([
    row({ runKind: "paper_trade", status: "pending", predictedWinnerId: `${RUN_TAG}-p1-pending`, calibratedProbability: 70 }),
  ]);
  t.after(() => cleanup(ids));

  const after = await getEvaluationPredictionStats("paper_trade");
  assert.equal(after.totalPredictions - before.totalPredictions, 1, "the row itself is still counted in the total");
  assert.equal(after.resolvedPredictions - before.resolvedPredictions, 0, "a pending row must never count as resolved");
  assert.equal(after.correctPredictions - before.correctPredictions, 0, "a pending row must never count as correct");
  assert.equal(after.pending - before.pending, 1);
});

test("6: a missed row is never counted as a loss (resolvedPredictions/correctPredictions unaffected)", async (t) => {
  const before = await getEvaluationPredictionStats("paper_trade");
  const ids = await insertRows([row({ runKind: "paper_trade", status: "missed" })]);
  t.after(() => cleanup(ids));

  const after = await getEvaluationPredictionStats("paper_trade");
  assert.equal(after.totalPredictions - before.totalPredictions, 1);
  assert.equal(after.resolvedPredictions - before.resolvedPredictions, 0, "a missed row must never count as resolved");
  assert.equal(after.correctPredictions - before.correctPredictions, 0, "a missed row must never count as correct");
  assert.equal(after.missed - before.missed, 1);
});

test("7: accuracy's denominator uses graded rows only -- a pending and a missed row inserted alongside a graded win/loss pair must not shift accuracy beyond what the graded pair alone would produce", async (t) => {
  const before = await getEvaluationPredictionStats("paper_trade");
  const winnerId = `${RUN_TAG}-p1-graded-correct`;
  const loserId = `${RUN_TAG}-p1-graded-incorrect`;
  const ids = await insertRows([
    // Correct: predicted and actual winner match.
    row({
      runKind: "paper_trade", status: "graded",
      player1Id: winnerId, predictedWinnerId: winnerId, actualWinnerId: winnerId, includedInAccuracy: true,
    }),
    // Incorrect: predicted winner did not win.
    row({
      runKind: "paper_trade", status: "graded",
      player1Id: loserId, predictedWinnerId: loserId, actualWinnerId: `${RUN_TAG}-p2-graded-incorrect`, includedInAccuracy: true,
    }),
    // Must contribute 0 to both numerator and denominator.
    row({ runKind: "paper_trade", status: "pending" }),
    row({ runKind: "paper_trade", status: "missed" }),
  ]);
  t.after(() => cleanup(ids));

  const after = await getEvaluationPredictionStats("paper_trade");
  const expectedResolved = before.resolvedPredictions + 2; // only the two graded rows
  const expectedCorrect = before.correctPredictions + 1; // only the correct one
  assert.equal(after.resolvedPredictions, expectedResolved);
  assert.equal(after.correctPredictions, expectedCorrect);
  const expectedAccuracy = Math.round((expectedCorrect / expectedResolved) * 1000) / 10;
  assert.equal(after.accuracy, expectedAccuracy);
});

test("logLoss/brier are populated for a bounded runKind (paper_trade) but omitted for historical_test and mixed", async () => {
  const paperTrade = await getEvaluationPredictionStats("paper_trade");
  assert.notEqual(paperTrade.logLoss, undefined, "paper_trade is a bounded population -- logLoss should be computed, not skipped");

  const historicalTest = await getEvaluationPredictionStats("historical_test");
  assert.equal(historicalTest.logLoss, undefined, "historical_test spans 500k+ rows -- logLoss must be skipped, never force a full-table fetch");

  const mixed = await getEvaluationPredictionStats();
  assert.equal(mixed.logLoss, undefined, "unscoped/mixed spans every population -- logLoss must be skipped, never force a full-table fetch");
});
