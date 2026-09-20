/**
 * Synthetic/test-only fixtures for exp5MarketShufflePlacebo.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { shuffleMarketTriples, devigImpliedProbabilityPlayer1, runExperiment } from "./exp5MarketShufflePlacebo.js";
import type { AdmissibleRow } from "./exp4MarketArms.js";
import type { RawEvaluationPredictionRow } from "./exp4MarketArms.js";

function admissibleRow(overrides: Partial<AdmissibleRow> = {}): AdmissibleRow {
  return {
    id: 1,
    cutoffAt: new Date("2026-01-01T12:00:00Z"),
    player1Id: "p1",
    player2Id: "p2",
    predictedWinnerId: "p1",
    actualWinnerId: "p1",
    calibratedProbability: 65,
    impliedProbability: 60,
    oddsPlayer1Decimal: 1.8,
    oddsPlayer2Decimal: 2.1,
    oddsFetchedAt: new Date("2026-01-01T10:00:00Z"),
    ...overrides,
  };
}

// Deterministic RNG for reproducible test assertions.
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

test("devigImpliedProbabilityPlayer1: removes the overround so both sides sum to 100", () => {
  const p1 = devigImpliedProbabilityPlayer1({ oddsPlayer1Decimal: 1.8, oddsPlayer2Decimal: 2.1 });
  const p2 = devigImpliedProbabilityPlayer1({ oddsPlayer1Decimal: 2.1, oddsPlayer2Decimal: 1.8 });
  assert.ok(Math.abs(p1 + p2 - 100) < 1e-9, `p1+p2 should be ~100, got ${p1 + p2}`);
});

test("shuffleMarketTriples: a single-row window cannot be shuffled and is excluded", () => {
  const rows = [admissibleRow({ id: 1, cutoffAt: new Date("2026-01-01T12:00:00Z") })];
  const { shuffled, excludedIds } = shuffleMarketTriples(rows, seededRng(1));
  assert.equal(shuffled.length, 0);
  assert.deepEqual(excludedIds, [1]);
});

test("shuffleMarketTriples: two rows in the same admissible window get swapped (never identity)", () => {
  const rows = [
    admissibleRow({ id: 1, cutoffAt: new Date("2026-01-01T20:00:00Z"), oddsFetchedAt: new Date("2026-01-01T08:00:00Z") }),
    admissibleRow({ id: 2, cutoffAt: new Date("2026-01-01T22:00:00Z"), oddsFetchedAt: new Date("2026-01-01T09:00:00Z") }),
  ];
  const { shuffled, excludedIds } = shuffleMarketTriples(rows, seededRng(7));
  assert.equal(excludedIds.length, 0);
  assert.equal(shuffled.length, 2);
  const forRow1 = shuffled.find((s) => s.id === 1)!;
  const forRow2 = shuffled.find((s) => s.id === 2)!;
  // With only 2 rows and identity rejected, the only valid non-identity permutation is a full swap.
  assert.equal(forRow1.shuffledFrom, 2);
  assert.equal(forRow2.shuffledFrom, 1);
});

test("shuffleMarketTriples: never assigns a triple whose oddsFetchedAt would be after the recipient's cutoffAt", () => {
  // row2's oddsFetchedAt is AFTER row1's cutoffAt, so swapping row2's triple onto row1 would be
  // inadmissible — the only safe assignment here is no swap at all within this pair, so with
  // maxAttempts exhausted this window should be excluded rather than violated.
  const rows = [
    admissibleRow({ id: 1, cutoffAt: new Date("2026-01-01T09:00:00Z"), oddsFetchedAt: new Date("2026-01-01T08:00:00Z") }),
    admissibleRow({ id: 2, cutoffAt: new Date("2026-01-01T23:00:00Z"), oddsFetchedAt: new Date("2026-01-01T22:00:00Z") }),
  ];
  const { shuffled, excludedIds } = shuffleMarketTriples(rows, seededRng(3), 50);
  assert.equal(shuffled.length, 0);
  assert.deepEqual(excludedIds.sort(), [1, 2]);
});

test("runExperiment: real_pairing and shuffled_pairing rows both present in output table on synthetic data", () => {
  const rows: RawEvaluationPredictionRow[] = [
    {
      id: 1,
      player1Id: "p1",
      player2Id: "p2",
      status: "graded",
      includedInAccuracy: true,
      cutoffAt: "2026-01-01T20:00:00Z",
      predictedWinnerId: "p1",
      actualWinnerId: "p1",
      calibratedProbability: 65,
      impliedProbability: 60,
      oddsPlayer1Decimal: 1.8,
      oddsPlayer2Decimal: 2.1,
      oddsFetchedAt: "2026-01-01T08:00:00Z",
    },
    {
      id: 2,
      player1Id: "p3",
      player2Id: "p4",
      status: "graded",
      includedInAccuracy: true,
      cutoffAt: "2026-01-01T22:00:00Z",
      predictedWinnerId: "p3",
      actualWinnerId: "p4",
      calibratedProbability: 55,
      impliedProbability: 52,
      oddsPlayer1Decimal: 1.9,
      oddsPlayer2Decimal: 2.0,
      oddsFetchedAt: "2026-01-01T09:00:00Z",
    },
  ];
  const { table, provenance } = runExperiment(rows, "synthetic fixture (exp5.test.ts)", seededRng(42));
  assert.equal(table.length, 2);
  assert.ok(table.find((t) => t.variant === "real_pairing"));
  assert.ok(table.find((t) => t.variant === "shuffled_pairing"));
  assert.equal(provenance.nTotal, 2);
});
