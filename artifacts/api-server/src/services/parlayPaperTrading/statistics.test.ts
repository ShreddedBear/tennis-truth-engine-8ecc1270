import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeTotals, computePredictionPerformance, computeDirectionalValidationDecisions,
  computeAutonomousPredictionMetrics, computeCrossSideIntegrity, computeDataQuality,
  computeLineageBreakdown, computeObservedTimeWindow, computeParlayPaperTradingStatistics,
  type StatsTradeRow, type StatsPairRow,
} from "./statistics.js";

const SCHED = new Date("2026-10-01T12:00:00Z");

function trade(overrides: Partial<StatsTradeRow> = {}): StatsTradeRow {
  return {
    pairId: "pair-1",
    evaluatedSide: "PLAYER_1",
    player1Id: "p1", player1Name: "Player One",
    player2Id: "p2", player2Name: "Player Two",
    status: "GRADED",
    noDecisionReason: null,
    decision: "KEEP",
    builderPickedPlayerId: "p1",
    builderCalibratedProbability: 62,
    dataCoverage: 100,
    resultType: "normal",
    includedInAccuracy: true,
    gradedCorrect: true,
    scheduledStartAt: SCHED,
    builderVersion: "1.0.0",
    builderConfigFingerprint: "fp-a",
    calibrationModelId: 1,
    ...overrides,
  };
}

/** Builds a matched PLAYER_1/PLAYER_2 pair sharing pair-level fields, as the real write path always produces. */
function pairOf(overrides: Partial<StatsTradeRow> = {}): [StatsTradeRow, StatsTradeRow] {
  const p1 = trade({ evaluatedSide: "PLAYER_1", ...overrides });
  const p2 = trade({ ...p1, evaluatedSide: "PLAYER_2", ...overrides });
  return [p1, p2];
}

function pairRow(overrides: Partial<StatsPairRow> = {}): StatsPairRow {
  return { pairId: "pair-1", crossSideAgreement: true, crossSideDisagreementReason: null, ...overrides };
}

describe("computeTotals", () => {
  it("counts each pair once via the PLAYER_1 canonical row, not twice", () => {
    const [p1, p2] = pairOf({ status: "FROZEN" });
    const totals = computeTotals([p1, p2], []);
    assert.strictEqual(totals.discovered, 1);
    assert.strictEqual(totals.frozen, 1);
  });

  it("eligible/snapshotted come from the pairs table, not the trades table", () => {
    const [p1, p2] = pairOf({ status: "INELIGIBLE", decision: null, builderPickedPlayerId: null });
    // Ineligible pairs never get a parlay_paper_trade_pairs row (persistPaperTrade.ts's ineligible branch).
    const totals = computeTotals([p1, p2], []);
    assert.strictEqual(totals.discovered, 1);
    assert.strictEqual(totals.eligible, 0);
    assert.strictEqual(totals.snapshotted, 0);
    assert.strictEqual(totals.ineligible, 1);
  });

  it("pending sums FROZEN + STARTED + COMPLETED, not GRADED", () => {
    const pairs = [
      pairOf({ pairId: "a", status: "FROZEN" }),
      pairOf({ pairId: "b", status: "STARTED" }),
      pairOf({ pairId: "c", status: "COMPLETED" }),
      pairOf({ pairId: "d", status: "GRADED" }),
    ].flat();
    const totals = computeTotals(pairs, []);
    assert.strictEqual(totals.pending, 3);
    assert.strictEqual(totals.graded, 1);
  });

  it("void is a superset of cancelled (includes walkover too)", () => {
    const pairs = [
      pairOf({ pairId: "a", status: "GRADED", resultType: "cancelled" }),
      pairOf({ pairId: "b", status: "GRADED", resultType: "walkover" }),
      pairOf({ pairId: "c", status: "GRADED", resultType: "normal" }),
    ].flat();
    const totals = computeTotals(pairs, []);
    assert.strictEqual(totals.cancelled, 1);
    assert.strictEqual(totals.void, 2);
  });
});

describe("computePredictionPerformance", () => {
  it("zero graded sample -> accuracy is null, never 0", () => {
    const perf = computePredictionPerformance([]);
    assert.strictEqual(perf.accuracy, null);
    assert.strictEqual(perf.gradedCount, 0);
  });

  it("pending records are excluded from accuracy entirely", () => {
    const [p1, p2] = pairOf({ status: "FROZEN", includedInAccuracy: null, gradedCorrect: null });
    const perf = computePredictionPerformance([p1, p2]);
    assert.strictEqual(perf.gradedCount, 0);
    assert.strictEqual(perf.accuracy, null);
  });

  it("no_decision/ineligible/data_error records are excluded from accuracy", () => {
    const rows = [
      pairOf({ pairId: "a", status: "NO_DECISION", decision: null, builderPickedPlayerId: null, includedInAccuracy: null, gradedCorrect: null }),
      pairOf({ pairId: "b", status: "INELIGIBLE", decision: null, builderPickedPlayerId: null, includedInAccuracy: null, gradedCorrect: null }),
      pairOf({ pairId: "c", status: "DATA_ERROR", includedInAccuracy: null, gradedCorrect: null }),
    ].flat();
    const perf = computePredictionPerformance(rows);
    assert.strictEqual(perf.gradedCount, 0);
    assert.strictEqual(perf.correctCount, 0);
    assert.strictEqual(perf.accuracy, null);
  });

  it("void (cancelled/walkover) records are excluded from the accuracy denominator but counted in gradedCount", () => {
    const rows = [
      pairOf({ pairId: "a", status: "GRADED", resultType: "cancelled", includedInAccuracy: false, gradedCorrect: null }),
      pairOf({ pairId: "b", status: "GRADED", resultType: "normal", includedInAccuracy: true, gradedCorrect: true }),
    ].flat();
    const perf = computePredictionPerformance(rows);
    assert.strictEqual(perf.gradedCount, 2);
    assert.strictEqual(perf.voidCount, 1);
    assert.strictEqual(perf.correctCount, 1);
    // denominator is correct+incorrect (1), not gradedCount (2) -- accuracy must be 100%, not 50%.
    assert.strictEqual(perf.accuracy, 100);
  });

  it("correct accuracy denominator: correct / (correct + incorrect)", () => {
    const rows = [
      pairOf({ pairId: "a", status: "GRADED", gradedCorrect: true, includedInAccuracy: true }),
      pairOf({ pairId: "b", status: "GRADED", gradedCorrect: true, includedInAccuracy: true }),
      pairOf({ pairId: "c", status: "GRADED", gradedCorrect: false, includedInAccuracy: true }),
      pairOf({ pairId: "d", status: "GRADED", gradedCorrect: false, includedInAccuracy: true }),
    ].flat();
    const perf = computePredictionPerformance(rows);
    assert.strictEqual(perf.correctCount, 2);
    assert.strictEqual(perf.incorrectCount, 2);
    assert.strictEqual(perf.accuracy, 50);
  });

  it("retired matches ARE graded (not void) -- consistent with settlementLogic.ts", () => {
    const [p1, p2] = pairOf({ status: "GRADED", resultType: "retired", includedInAccuracy: true, gradedCorrect: true });
    const perf = computePredictionPerformance([p1, p2]);
    assert.strictEqual(perf.voidCount, 0);
    assert.strictEqual(perf.gradedCount, 1);
    assert.strictEqual(perf.accuracy, 100);
  });
});

describe("computeDirectionalValidationDecisions", () => {
  it("counts are per-side (both rows contribute), decision-category accuracy grades the pair's autonomous prediction", () => {
    // Pair where PLAYER_1's own decision was REMOVE but the pair's autonomous pick was still graded correct.
    const p1 = trade({ evaluatedSide: "PLAYER_1", decision: "REMOVE", gradedCorrect: true, includedInAccuracy: true });
    const p2 = trade({ evaluatedSide: "PLAYER_2", decision: "KEEP", gradedCorrect: true, includedInAccuracy: true });
    const result = computeDirectionalValidationDecisions([p1, p2]);
    assert.strictEqual(result.counts.REMOVE, 1);
    assert.strictEqual(result.counts.KEEP, 1);
    assert.strictEqual(result.label, "DIRECTIONAL_VALIDATION_DECISIONS_NOT_PREDICTIONS");
    assert.strictEqual(result.accuracyByDecision.REMOVE.accuracy, 100);
    assert.strictEqual(result.accuracyByDecision.KEEP.accuracy, 100);
  });

  it("DATA_UNAVAILABLE is counted but has no accuracy bucket (never a real prediction)", () => {
    const p1 = trade({ evaluatedSide: "PLAYER_1", decision: "DATA_UNAVAILABLE", builderPickedPlayerId: null, includedInAccuracy: null, gradedCorrect: null });
    const result = computeDirectionalValidationDecisions([p1]);
    assert.strictEqual(result.counts.DATA_UNAVAILABLE, 1);
    assert.ok(!("DATA_UNAVAILABLE" in result.accuracyByDecision));
  });

  it("zero-sample decision category -> accuracy null", () => {
    const result = computeDirectionalValidationDecisions([]);
    assert.strictEqual(result.accuracyByDecision.BORDERLINE.accuracy, null);
  });
});

describe("computeAutonomousPredictionMetrics", () => {
  it("pick count by player identity resolves the correct name for either side", () => {
    const rows = [
      ...pairOf({ pairId: "a", builderPickedPlayerId: "p1" }),
      ...pairOf({ pairId: "b", builderPickedPlayerId: "p2" }),
      ...pairOf({ pairId: "c", builderPickedPlayerId: "p1" }),
    ];
    const result = computeAutonomousPredictionMetrics(rows);
    const p1Count = result.pickCountByPlayer.find((p) => p.playerId === "p1");
    assert.strictEqual(p1Count?.count, 2);
    assert.strictEqual(p1Count?.playerName, "Player One");
  });

  it("excludes rows with no real frozen prediction (builderPickedPlayerId null)", () => {
    const rows = pairOf({ status: "NO_DECISION", builderPickedPlayerId: null, decision: null });
    const result = computeAutonomousPredictionMetrics(rows);
    assert.strictEqual(result.pickCountByPlayer.length, 0);
  });

  it("probability bucket boundaries are correct and non-overlapping", () => {
    const rows = [49, 50, 54.9, 55, 59.9, 60, 64.9, 65, 69.9, 70, 99].map((prob, i) =>
      trade({ pairId: `p${i}`, builderCalibratedProbability: prob }));
    const result = computeAutonomousPredictionMetrics(rows);
    const counts = Object.fromEntries(result.probabilityBuckets.map((b) => [b.bucket, b.count]));
    assert.strictEqual(counts["<50%"], 1); // 49
    assert.strictEqual(counts["50-54.9%"], 2); // 50, 54.9
    assert.strictEqual(counts["55-59.9%"], 2); // 55, 59.9
    assert.strictEqual(counts["60-64.9%"], 2); // 60, 64.9
    assert.strictEqual(counts["65-69.9%"], 2); // 65, 69.9
    assert.strictEqual(counts["70%+"], 2); // 70, 99
  });

  it("bucket accuracy is null when its graded sample is zero, never 0%, and never labeled superior/inferior", () => {
    const rows = [trade({ builderCalibratedProbability: 30, status: "FROZEN", includedInAccuracy: null, gradedCorrect: null })];
    const result = computeAutonomousPredictionMetrics(rows);
    const bucket = result.probabilityBuckets.find((b) => b.bucket === "<50%")!;
    assert.strictEqual(bucket.count, 1);
    assert.strictEqual(bucket.gradedCount, 0);
    assert.strictEqual(bucket.accuracy, null);
    // Shape-level proof there is no ranking/label field on the bucket type.
    assert.ok(!("rank" in bucket) && !("best" in bucket));
  });
});

describe("computeCrossSideIntegrity", () => {
  it("agreement/disagreement counts and rate", () => {
    const pairs = [pairRow({ pairId: "a", crossSideAgreement: true }), pairRow({ pairId: "b", crossSideAgreement: true }), pairRow({ pairId: "c", crossSideAgreement: false })];
    const result = computeCrossSideIntegrity(pairs);
    assert.strictEqual(result.agreementCount, 2);
    assert.strictEqual(result.disagreementCount, 1);
    assert.strictEqual(result.agreementRate, 66.7);
    assert.strictEqual(result.disagreementsExcludedFromGrading, true);
  });

  it("zero checked pairs -> agreementRate null", () => {
    const result = computeCrossSideIntegrity([]);
    assert.strictEqual(result.agreementRate, null);
  });
});

describe("computeDataQuality", () => {
  it("data coverage buckets and DATA_UNAVAILABLE / provider-failure counts", () => {
    const rows = [
      trade({ pairId: "a", dataCoverage: 10 }),
      trade({ pairId: "b", dataCoverage: 60 }),
      trade({ pairId: "c", dataCoverage: 100 }),
      trade({ pairId: "d", decision: "DATA_UNAVAILABLE" }),
      trade({ pairId: "e", evaluatedSide: "PLAYER_1", status: "INELIGIBLE", noDecisionReason: "PROVIDER_UNAVAILABLE", decision: null, dataCoverage: null }),
    ];
    const result = computeDataQuality(rows);
    const buckets = Object.fromEntries(result.dataCoverageBuckets.map((b) => [b.bucket, b.count]));
    assert.strictEqual(buckets["0-24%"], 1);
    assert.strictEqual(buckets["50-74%"], 1);
    assert.strictEqual(buckets["100%"], 2); // c and d (default 100 in the trade() fixture)
    assert.strictEqual(result.dataUnavailableCount, 1);
    assert.strictEqual(result.providerFailureCount, 1);
  });
});

describe("computeLineageBreakdown", () => {
  it("keeps distinct lineages separate, never merged", () => {
    const rows = [
      ...pairOf({ pairId: "a", builderConfigFingerprint: "fp-a", calibrationModelId: 1 }),
      ...pairOf({ pairId: "b", builderConfigFingerprint: "fp-b", calibrationModelId: 2 }),
      ...pairOf({ pairId: "c", builderConfigFingerprint: "fp-a", calibrationModelId: 1 }),
    ];
    const result = computeLineageBreakdown(rows);
    assert.strictEqual(result.length, 2);
    const fpA = result.find((l) => l.builderConfigFingerprint === "fp-a");
    assert.strictEqual(fpA?.pairCount, 2);
  });

  it("distinguishes null calibrationModelId from a real one (no accidental merge)", () => {
    const rows = [
      ...pairOf({ pairId: "a", calibrationModelId: null }),
      ...pairOf({ pairId: "b", calibrationModelId: 1 }),
    ];
    const result = computeLineageBreakdown(rows);
    assert.strictEqual(result.length, 2);
  });
});

describe("computeObservedTimeWindow", () => {
  it("uses the frozen fixture's own scheduledStartAt, min/max across the set", () => {
    const rows = [
      ...pairOf({ pairId: "a", scheduledStartAt: new Date("2026-09-01T00:00:00Z") }),
      ...pairOf({ pairId: "b", scheduledStartAt: new Date("2026-09-15T00:00:00Z") }),
    ];
    const result = computeObservedTimeWindow(rows);
    assert.strictEqual(result.earliestScheduledStartAt, "2026-09-01T00:00:00.000Z");
    assert.strictEqual(result.latestScheduledStartAt, "2026-09-15T00:00:00.000Z");
  });

  it("empty input -> nulls, not a crash", () => {
    const result = computeObservedTimeWindow([]);
    assert.strictEqual(result.earliestScheduledStartAt, null);
    assert.strictEqual(result.latestScheduledStartAt, null);
  });
});

describe("computeParlayPaperTradingStatistics (top-level aggregate)", () => {
  it("is deterministic: same input twice yields deepStrictEqual output", () => {
    const rows = [...pairOf({ pairId: "a" }), ...pairOf({ pairId: "b", decision: "BORDERLINE" })];
    const pairs = [pairRow({ pairId: "a" }), pairRow({ pairId: "b" })];
    const r1 = computeParlayPaperTradingStatistics(rows, pairs);
    const r2 = computeParlayPaperTradingStatistics(rows, pairs);
    assert.deepStrictEqual(r1, r2);
  });

  it("only ever reads fields present on StatsTradeRow/StatsPairRow -- no hidden dependency on any other table's shape", () => {
    // Adversarial: rows carrying extra, Research-V1/builder_decision_log-shaped fields must not
    // affect the result -- the compute functions only ever destructure the documented fields.
    const contaminated = { ...trade({ pairId: "a" }), historicalMatchId: 999, researchRunId: "should-be-ignored", decisionLogId: 12345 } as StatsTradeRow;
    const clean = trade({ pairId: "a" });
    const r1 = computeParlayPaperTradingStatistics([contaminated], []);
    const r2 = computeParlayPaperTradingStatistics([clean], []);
    assert.deepStrictEqual(r1, r2);
  });
});
