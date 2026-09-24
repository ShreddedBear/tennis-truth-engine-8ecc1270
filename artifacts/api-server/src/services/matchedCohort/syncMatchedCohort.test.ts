// Regression tests for the leak-proof matched-cohort sync (syncMatchedCohort.ts). Uses its own
// throwaway rows (externalFixtureId/player ids namespaced to this test run) inserted directly into
// evaluation_predictions / parlay_paper_trades / parlay_paper_trade_pairs, then asserts on the
// resulting matched_engine_cohort row(s) -- never asserting on exact counts against the shared
// production tables, only on rows this run itself created (same convention predictionStats.test.ts
// already follows).
//
// IMPORTANT: parlay_paper_trades and parlay_paper_trade_pairs are each protected by a real
// production DB trigger (parlay_paper_trades_immutable / parlay_paper_trade_pairs_immutable) that
// rejects ANY update or delete once a row exists -- the same append-only guarantee that protects
// real frozen Builder decisions. This means test rows inserted into those two tables can NEVER be
// deleted afterwards; they are left behind permanently, namespaced with a TEST- prefix (mirroring
// parlayPaperTrading/statisticsBoundary.test.ts's established "NOT LIKE 'TEST-%'" exclusion
// convention) so they're identifiable and harmless. Only evaluation_predictions and
// matched_engine_cohort (neither of which has such a trigger) are actually deleted in cleanup --
// and matched_engine_cohort must be deleted BEFORE evaluation_predictions, since its
// peEvaluationPredictionId column is a real foreign key.
//
// See syncMatchedCohort.boundary.test.ts for the separate static leakage-firewall proof (neither
// engine may ever import/reference this layer, and this layer may never touch live scoring).
import test from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  evaluationPredictionsTable,
  parlayPaperTradesTable,
  parlayPaperTradePairsTable,
  matchedEngineCohortTable,
  type InsertEvaluationPrediction,
  type InsertParlayPaperTrade,
  type InsertParlayPaperTradePair,
} from "@workspace/db";
import { syncMatchedCohort } from "./syncMatchedCohort";

const RUN_TAG = `TEST-matched-cohort-${Date.now()}`;
let fixtureCounter = 0;
function nextFixtureId(): string {
  fixtureCounter += 1;
  return `${RUN_TAG}-fixture-${fixtureCounter}`;
}

function peRow(fixtureId: string, overrides: Partial<InsertEvaluationPrediction> = {}): InsertEvaluationPrediction {
  return {
    runKind: "paper_trade",
    provider: "Live Tennis API+Live Tennis API (no secondary provider)",
    externalFixtureId: fixtureId,
    player1Id: `${RUN_TAG}-p1-${fixtureId}`,
    player1Name: "PE Player One",
    player2Id: `${RUN_TAG}-p2-${fixtureId}`,
    player2Name: "PE Player Two",
    scheduledStartAt: new Date("2026-02-01T12:00:00Z"),
    cutoffAt: new Date("2026-02-01T11:30:00Z"),
    lockedAt: new Date("2026-02-01T11:00:00Z"),
    modelVersion: "test-version",
    status: "pending",
    ...overrides,
  } satisfies InsertEvaluationPrediction;
}

function builderPair(fixtureId: string, overrides: Partial<InsertParlayPaperTradePair> = {}): InsertParlayPaperTradePair {
  return {
    pairId: `${RUN_TAG}-pair-${fixtureId}`,
    externalFixtureId: fixtureId,
    lineageKey: `${RUN_TAG}-lineage-${fixtureId}`,
    crossSideAgreement: true,
    crossSideCheckedAt: new Date("2026-02-01T11:00:00Z"),
    ...overrides,
  } satisfies InsertParlayPaperTradePair;
}

function builderTrade(
  fixtureId: string,
  side: "PLAYER_1" | "PLAYER_2",
  overrides: Partial<InsertParlayPaperTrade> = {},
): InsertParlayPaperTrade {
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const p2 = `${RUN_TAG}-p2-${fixtureId}`;
  const selected = side === "PLAYER_1" ? p1 : p2;
  const opposing = side === "PLAYER_1" ? p2 : p1;
  return {
    paperTradeId: `${RUN_TAG}-trade-${fixtureId}-${side}`,
    pairId: `${RUN_TAG}-pair-${fixtureId}`,
    externalFixtureId: fixtureId,
    fixtureProvider: "live-tennis-api",
    player1Id: p1,
    player1Name: "PE Player One",
    player2Id: p2,
    player2Name: "PE Player Two",
    scheduledStartAt: new Date("2026-02-01T12:00:00Z"),
    evaluatedSide: side,
    selectedPlayerId: selected,
    opposingPlayerId: opposing,
    status: "FROZEN",
    decisionCutoffAt: new Date("2026-02-01T11:30:00Z"),
    frozenAt: new Date("2026-02-01T11:00:00Z"),
    builderPickedPlayerId: p1,
    lineageKey: `${RUN_TAG}-lineage-${fixtureId}`,
    sourceCommit: "test-commit",
    ...overrides,
  } satisfies InsertParlayPaperTrade;
}

async function insertPe(rows: InsertEvaluationPrediction[]): Promise<number[]> {
  const inserted = await db.insert(evaluationPredictionsTable).values(rows).returning({ id: evaluationPredictionsTable.id });
  return inserted.map((r) => r.id);
}
async function insertPair(rows: InsertParlayPaperTradePair[]): Promise<number[]> {
  const inserted = await db.insert(parlayPaperTradePairsTable).values(rows).returning({ id: parlayPaperTradePairsTable.id });
  return inserted.map((r) => r.id);
}
async function insertTrades(rows: InsertParlayPaperTrade[]): Promise<number[]> {
  const inserted = await db.insert(parlayPaperTradesTable).values(rows).returning({ id: parlayPaperTradesTable.id });
  return inserted.map((r) => r.id);
}

async function cleanupAll(fixtureIds: string[], peIds: number[]) {
  // matched_engine_cohort MUST be deleted first -- peEvaluationPredictionId is a real foreign key
  // into evaluation_predictions, so deleting the PE row first would violate that constraint.
  if (fixtureIds.length) {
    await db.delete(matchedEngineCohortTable).where(inArray(matchedEngineCohortTable.externalFixtureId, fixtureIds));
  }
  if (peIds.length) await db.delete(evaluationPredictionsTable).where(inArray(evaluationPredictionsTable.id, peIds));
  // parlay_paper_trades / parlay_paper_trade_pairs rows are deliberately never deleted here --
  // both are protected by a real append-only immutability trigger (see file header comment).
}

async function cohortRow(fixtureId: string) {
  const [row] = await db.select().from(matchedEngineCohortTable).where(eq(matchedEngineCohortTable.externalFixtureId, fixtureId));
  return row ?? null;
}

test("1: both sides eligible pre-match -> exactly one matched_engine_cohort row is created", async (t) => {
  const fixtureId = nextFixtureId();
  const peIds = await insertPe([peRow(fixtureId, { predictedWinnerId: `${RUN_TAG}-p1-${fixtureId}`, predictedWinnerName: "PE Player One", calibratedProbability: 65 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([
    builderTrade(fixtureId, "PLAYER_1"),
    builderTrade(fixtureId, "PLAYER_2"),
  ]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.ok(row, "expected a matched_engine_cohort row for this fixture");
  assert.equal(row!.peEvaluationPredictionId, peIds[0]);
  assert.equal(row!.builderPairId, `${RUN_TAG}-pair-${fixtureId}`);
});

test("2: PE 'missed' status (no real prediction) never matches even if the Builder side is eligible", async (t) => {
  const fixtureId = nextFixtureId();
  const peIds = await insertPe([peRow(fixtureId, { status: "missed", predictedWinnerId: null, calibratedProbability: null })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([builderTrade(fixtureId, "PLAYER_1"), builderTrade(fixtureId, "PLAYER_2")]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row, null, "a missed PE cutoff must never produce a cohort row");
});

test("3: Builder-only fixture (no PE row exists) never matches", async (t) => {
  const fixtureId = nextFixtureId();
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([builderTrade(fixtureId, "PLAYER_1"), builderTrade(fixtureId, "PLAYER_2")]);
  t.after(() => cleanupAll([fixtureId], []));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row, null, "a fixture with no PE row must never produce a cohort row");
});

test("4: PE-only fixture (no Builder decision exists) never matches", async (t) => {
  const fixtureId = nextFixtureId();
  const peIds = await insertPe([peRow(fixtureId, { predictedWinnerId: `${RUN_TAG}-p1-${fixtureId}`, calibratedProbability: 60 })]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row, null, "a fixture with no Builder decision must never produce a cohort row");
});

test("5: Builder rows that never froze (frozenAt null, e.g. NO_DECISION) never match even though the fixture id exists", async (t) => {
  const fixtureId = nextFixtureId();
  const peIds = await insertPe([peRow(fixtureId, { predictedWinnerId: `${RUN_TAG}-p1-${fixtureId}`, calibratedProbability: 60 })]);
  const pairIds = await insertPair([builderPair(fixtureId, { crossSideAgreement: false, crossSideDisagreementReason: "TIE_BOUNDARY" })]);
  const tradeIds = await insertTrades([
    builderTrade(fixtureId, "PLAYER_1", { status: "NO_DECISION", noDecisionReason: "TIE_BOUNDARY", frozenAt: null, builderPickedPlayerId: null }),
    builderTrade(fixtureId, "PLAYER_2", { status: "NO_DECISION", noDecisionReason: "TIE_BOUNDARY", frozenAt: null, builderPickedPlayerId: null }),
  ]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row, null, "a Builder decision that never froze must never produce a cohort row");
});

test("6: membership does NOT depend on the match result -- both sides pre-match/pending (no outcome yet) still matches, with a null canonical outcome", async (t) => {
  const fixtureId = nextFixtureId();
  const peIds = await insertPe([peRow(fixtureId, { status: "pending", predictedWinnerId: `${RUN_TAG}-p1-${fixtureId}`, calibratedProbability: 55 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([
    builderTrade(fixtureId, "PLAYER_1", { status: "FROZEN" }),
    builderTrade(fixtureId, "PLAYER_2", { status: "FROZEN" }),
  ]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.ok(row, "a fixture with no result yet must still be matched -- membership never waits on an outcome");
  assert.equal(row!.canonicalActualWinnerId, null);
  assert.equal(row!.peCorrect, null, "correctness must stay null until a canonical result exists");
});

test("7: membership does NOT depend on whether the two engines agreed -- a disagreeing pick still matches, with enginesAgreedOnPick=false", async (t) => {
  const fixtureId = nextFixtureId();
  const p2 = `${RUN_TAG}-p2-${fixtureId}`;
  const peIds = await insertPe([peRow(fixtureId, { predictedWinnerId: `${RUN_TAG}-p1-${fixtureId}`, calibratedProbability: 55 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  // Builder picks PLAYER_2 (the opposite side from PE's pick).
  const tradeIds = await insertTrades([
    builderTrade(fixtureId, "PLAYER_1", { builderPickedPlayerId: p2 }),
    builderTrade(fixtureId, "PLAYER_2", { builderPickedPlayerId: p2, builderCalibratedProbability: 58 }),
  ]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.ok(row, "a disagreeing pick pair must still be matched -- agreement is never a membership gate");
  assert.equal(row!.enginesAgreedOnPick, false);
  assert.equal(row!.builderPickedPlayerId, p2);
});

test("8: PE calibratedProbability is reprojected to be pick-relative, not left player1-relative, in both directions", async (t) => {
  const fixtureA = nextFixtureId();
  const p1A = `${RUN_TAG}-p1-${fixtureA}`;
  const peIdsA = await insertPe([peRow(fixtureA, { predictedWinnerId: p1A, calibratedProbability: 72 })]);
  const pairIdsA = await insertPair([builderPair(fixtureA)]);
  const tradeIdsA = await insertTrades([builderTrade(fixtureA, "PLAYER_1"), builderTrade(fixtureA, "PLAYER_2")]);

  const fixtureB = nextFixtureId();
  const p2B = `${RUN_TAG}-p2-${fixtureB}`;
  const peIdsB = await insertPe([peRow(fixtureB, { predictedWinnerId: p2B, predictedWinnerName: "PE Player Two", calibratedProbability: 72 })]);
  const pairIdsB = await insertPair([builderPair(fixtureB)]);
  const tradeIdsB = await insertTrades([
    builderTrade(fixtureB, "PLAYER_1", { builderPickedPlayerId: p2B }),
    builderTrade(fixtureB, "PLAYER_2", { builderPickedPlayerId: p2B }),
  ]);

  t.after(() => {
    return Promise.all([
      cleanupAll([fixtureA], peIdsA),
      cleanupAll([fixtureB], peIdsB),
    ]);
  });

  await syncMatchedCohort();
  const rowA = await cohortRow(fixtureA);
  const rowB = await cohortRow(fixtureB);
  assert.equal(rowA!.peCalibratedProbabilityForPick, 72, "predictedWinnerId === player1Id: probability is used as-is");
  assert.equal(rowB!.peCalibratedProbabilityForPick, 28, "predictedWinnerId === player2Id: probability must be reprojected (100 - raw)");
});

test("9: Builder's picked-relative probability is read from the sibling row whose selectedPlayerId matches the pick, not the other sibling", async (t) => {
  const fixtureId = nextFixtureId();
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const peIds = await insertPe([peRow(fixtureId, { predictedWinnerId: p1, calibratedProbability: 50 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([
    builderTrade(fixtureId, "PLAYER_1", { builderPickedPlayerId: p1, builderCalibratedProbability: 81 }),
    builderTrade(fixtureId, "PLAYER_2", { builderPickedPlayerId: p1, builderCalibratedProbability: 19 }),
  ]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row!.builderCalibratedProbabilityForPick, 81, "must take the PLAYER_1 sibling's value (selectedPlayerId === builderPickedPlayerId), not PLAYER_2's");
});

test("10: idempotent re-sync -- running syncMatchedCohort twice never creates a duplicate row, and firstMatchedAt never changes while lastSyncedAt does", async (t) => {
  const fixtureId = nextFixtureId();
  const peIds = await insertPe([peRow(fixtureId, { predictedWinnerId: `${RUN_TAG}-p1-${fixtureId}`, calibratedProbability: 60 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([builderTrade(fixtureId, "PLAYER_1"), builderTrade(fixtureId, "PLAYER_2")]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const firstRow = await cohortRow(fixtureId);
  await new Promise((r) => setTimeout(r, 20));
  await syncMatchedCohort();
  const secondRow = await cohortRow(fixtureId);

  const allRows = await db.select().from(matchedEngineCohortTable).where(eq(matchedEngineCohortTable.externalFixtureId, fixtureId));
  assert.equal(allRows.length, 1, "re-running the sync must never create a second row for the same fixture");
  assert.equal(secondRow!.firstMatchedAt.getTime(), firstRow!.firstMatchedAt.getTime(), "firstMatchedAt must never change on re-sync");
  assert.ok(secondRow!.lastSyncedAt.getTime() >= firstRow!.lastSyncedAt.getTime(), "lastSyncedAt should advance (or stay equal) on re-sync");
});

test("11: canonical result -- both sides independently graded and agreeing produces a canonical outcome and correct derived booleans", async (t) => {
  const fixtureId = nextFixtureId();
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const p2 = `${RUN_TAG}-p2-${fixtureId}`;
  const peIds = await insertPe([
    peRow(fixtureId, {
      status: "graded", predictedWinnerId: p1, calibratedProbability: 70,
      actualWinnerId: p1, resultType: "normal", gradedAt: new Date("2026-02-01T15:00:00Z"),
    }),
  ]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([
    builderTrade(fixtureId, "PLAYER_1", { status: "GRADED", actualWinnerId: p1, resultType: "normal", gradedAt: new Date("2026-02-01T15:05:00Z") }),
    builderTrade(fixtureId, "PLAYER_2", { status: "GRADED", actualWinnerId: p1, resultType: "normal", gradedAt: new Date("2026-02-01T15:05:00Z"), builderPickedPlayerId: p1 }),
  ]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row!.nativeGradingAgrees, true);
  assert.equal(row!.canonicalActualWinnerId, p1);
  assert.equal(row!.peCorrect, true);
  assert.equal(row!.builderCorrect, true);
  assert.equal(row!.bothCorrect, true);
  assert.equal(row!.bothWrong, false);
});

test("12: CANONICAL_RESULT_MISMATCH -- both sides graded but disagree on the winner leaves canonicalActualWinnerId null and flags nativeGradingAgrees=false, never silently resolved", async (t) => {
  const fixtureId = nextFixtureId();
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const p2 = `${RUN_TAG}-p2-${fixtureId}`;
  const peIds = await insertPe([
    peRow(fixtureId, { status: "graded", predictedWinnerId: p1, calibratedProbability: 55, actualWinnerId: p1, resultType: "normal" }),
  ]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([
    // Builder's independent lookup disagrees on who actually won.
    builderTrade(fixtureId, "PLAYER_1", { status: "GRADED", actualWinnerId: p2, resultType: "normal" }),
    builderTrade(fixtureId, "PLAYER_2", { status: "GRADED", actualWinnerId: p2, resultType: "normal", builderPickedPlayerId: p1 }),
  ]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row!.nativeGradingAgrees, false, "disagreeing native results must be flagged, not hidden");
  assert.equal(row!.canonicalActualWinnerId, null, "a disagreement must never fabricate a canonical winner by preferring one side");
  assert.equal(row!.peCorrect, null, "correctness must stay unresolved when there is no agreed canonical result");
});

test("13: only one side graded so far -- canonical outcome stays null/unresolved rather than being inferred from partial information", async (t) => {
  const fixtureId = nextFixtureId();
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const peIds = await insertPe([
    peRow(fixtureId, { status: "graded", predictedWinnerId: p1, calibratedProbability: 55, actualWinnerId: p1, resultType: "normal" }),
  ]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([
    builderTrade(fixtureId, "PLAYER_1", { status: "STARTED" }),
    builderTrade(fixtureId, "PLAYER_2", { status: "STARTED" }),
  ]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row!.nativeGradingAgrees, null, "must not compute agreement until BOTH sides have graded");
  assert.equal(row!.canonicalActualWinnerId, null);
});

test("14: historical firewall -- a non-'paper_trade' PE row (e.g. historical_test) sharing the same externalFixtureId as a real Builder fixture is never matched", async (t) => {
  const fixtureId = nextFixtureId();
  const peIds = await insertPe([peRow(fixtureId, { runKind: "historical_test", predictedWinnerId: `${RUN_TAG}-p1-${fixtureId}`, calibratedProbability: 60 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([builderTrade(fixtureId, "PLAYER_1"), builderTrade(fixtureId, "PLAYER_2")]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row, null, "only run_kind='paper_trade' PE rows may ever feed the matched cohort -- never historical_test/shadow reconstruction");
});

test("15: ambiguous PE rows for the same fixture (should never happen given evaluation_predictions' own unique index, but defensively) are skipped rather than picking one arbitrarily", async (t) => {
  const fixtureId = nextFixtureId();
  const p1a = `${RUN_TAG}-p1a-${fixtureId}`;
  const p1b = `${RUN_TAG}-p1b-${fixtureId}`;
  const peIds = await insertPe([
    peRow(fixtureId, { provider: "provider-A", predictedWinnerId: p1a, player1Id: p1a, calibratedProbability: 60 }),
    peRow(fixtureId, { provider: "provider-B", predictedWinnerId: p1b, player1Id: p1b, calibratedProbability: 60 }),
  ]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([builderTrade(fixtureId, "PLAYER_1"), builderTrade(fixtureId, "PLAYER_2")]);
  t.after(() => cleanupAll([fixtureId], peIds));

  const summary = await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row, null, "an ambiguous fixture must never be silently resolved by picking one PE row");
  assert.ok(summary.skipped.some((s) => s.includes(fixtureId)), "the ambiguity must be surfaced in the sync summary");
});

test("16: PE and Builder eligible-population counts in the sync summary reflect this run's inserted rows", async (t) => {
  const fixtureId = nextFixtureId();
  const peIds = await insertPe([peRow(fixtureId, { predictedWinnerId: `${RUN_TAG}-p1-${fixtureId}`, calibratedProbability: 60 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([builderTrade(fixtureId, "PLAYER_1"), builderTrade(fixtureId, "PLAYER_2")]);
  t.after(() => cleanupAll([fixtureId], peIds));

  const summary = await syncMatchedCohort();
  assert.ok(summary.peEligibleCount >= 1, "eligible PE population must include this run's row");
  assert.ok(summary.builderEligibleCount >= 2, "eligible Builder population must include both sibling rows for this fixture");
});
