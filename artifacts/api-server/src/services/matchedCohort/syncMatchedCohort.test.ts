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
// convention) so they're identifiable and harmless. evaluation_predictions, historical_matches, and
// matched_engine_cohort (none of which have such a trigger) are actually deleted in cleanup -- and
// matched_engine_cohort must be deleted BEFORE evaluation_predictions/historical_matches, since its
// peEvaluationPredictionId and canonicalSourceHistoricalMatchId columns are real foreign keys.
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
  historicalMatchesTable,
  matchedEngineCohortTable,
  type InsertEvaluationPrediction,
  type InsertParlayPaperTrade,
  type InsertParlayPaperTradePair,
  type InsertHistoricalMatch,
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

/**
 * A terminal (winner known, or cancelled/walkover) historical_matches row, independent of the
 * PE/Builder rows for the same real fixture -- this is the canonical-result source under test.
 * scheduledStartAt defaults inside the sync job's ±24h matching window of the standard
 * 2026-02-01T12:00:00Z fixture time used throughout this file's other helpers.
 */
function historicalMatchRow(
  overrides: Partial<InsertHistoricalMatch> & { player1Id: string; player2Id: string },
): InsertHistoricalMatch {
  const scheduledStartAt = overrides.scheduledStartAt ?? new Date("2026-02-01T12:00:00Z");
  return {
    externalId: `${RUN_TAG}-hm-${Math.random().toString(36).slice(2)}`,
    provider: "Live Tennis API",
    player1Name: "HM Player One",
    player2Name: "HM Player Two",
    scheduledStartAt,
    cutoffMinutes: 30,
    cutoffAt: new Date(scheduledStartAt.getTime() - 30 * 60_000),
    rawSource: {},
    ...overrides,
  } satisfies InsertHistoricalMatch;
}
async function insertHistoricalMatches(rows: InsertHistoricalMatch[]): Promise<number[]> {
  const inserted = await db.insert(historicalMatchesTable).values(rows).returning({ id: historicalMatchesTable.id });
  return inserted.map((r) => r.id);
}

async function cleanupAll(fixtureIds: string[], peIds: number[], historicalMatchIds: number[] = []) {
  // matched_engine_cohort MUST be deleted first -- peEvaluationPredictionId and
  // canonicalSourceHistoricalMatchId are both real foreign keys, so deleting either referenced
  // row first would violate a constraint.
  if (fixtureIds.length) {
    await db.delete(matchedEngineCohortTable).where(inArray(matchedEngineCohortTable.externalFixtureId, fixtureIds));
  }
  if (peIds.length) await db.delete(evaluationPredictionsTable).where(inArray(evaluationPredictionsTable.id, peIds));
  if (historicalMatchIds.length) await db.delete(historicalMatchesTable).where(inArray(historicalMatchesTable.id, historicalMatchIds));
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

test("11: canonical result comes from historical_matches directly, even when NEITHER engine has graded natively yet", async (t) => {
  const fixtureId = nextFixtureId();
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const p2 = `${RUN_TAG}-p2-${fixtureId}`;
  const peIds = await insertPe([peRow(fixtureId, { status: "pending", predictedWinnerId: p1, calibratedProbability: 70 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([
    builderTrade(fixtureId, "PLAYER_1", { status: "STARTED" }),
    builderTrade(fixtureId, "PLAYER_2", { status: "STARTED" }),
  ]);
  const hmIds = await insertHistoricalMatches([historicalMatchRow({ player1Id: p1, player2Id: p2, winnerId: p1 })]);
  t.after(() => cleanupAll([fixtureId], peIds, hmIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row!.canonicalActualWinnerId, p1, "canonical winner must come from historical_matches, not from either engine's own (absent) native grade");
  assert.equal(row!.canonicalSourceHistoricalMatchId, hmIds[0]);
  assert.equal(row!.canonicalResultType, "normal");
  assert.equal(row!.peCorrect, true);
  assert.equal(row!.builderCorrect, true);
  assert.equal(row!.peNativeGradeMatchesCanonical, null, "PE hasn't graded natively yet -- the cross-check must stay unresolved, not false");
  assert.equal(row!.builderNativeGradeMatchesCanonical, null, "Builder hasn't graded natively yet -- the cross-check must stay unresolved, not false");
});

test("12: PE's own native grade is NOT used to establish the canonical winner -- historical_matches wins when they disagree", async (t) => {
  const fixtureId = nextFixtureId();
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const p2 = `${RUN_TAG}-p2-${fixtureId}`;
  // PE natively graded this as a win for p1 -- but the independent result source says p2 won.
  const peIds = await insertPe([
    peRow(fixtureId, { status: "graded", predictedWinnerId: p1, calibratedProbability: 70, actualWinnerId: p1, resultType: "normal" }),
  ]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([
    builderTrade(fixtureId, "PLAYER_1", { status: "STARTED" }),
    builderTrade(fixtureId, "PLAYER_2", { status: "STARTED" }),
  ]);
  const hmIds = await insertHistoricalMatches([historicalMatchRow({ player1Id: p1, player2Id: p2, winnerId: p2 })]);
  t.after(() => cleanupAll([fixtureId], peIds, hmIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row!.canonicalActualWinnerId, p2, "the independent historical_matches result must win, not PE's own already-written actualWinnerId");
  assert.equal(row!.peCorrect, false, "PE's canonical correctness is now false, since it predicted p1 but the real canonical winner is p2");
  assert.equal(row!.peNativeGradeMatchesCanonical, false, "PE's own native grade (p1) disagrees with the canonical result (p2) -- must be surfaced, not hidden");
});

test("13: Builder's own native grade is NOT used to establish the canonical winner -- historical_matches wins when they disagree", async (t) => {
  const fixtureId = nextFixtureId();
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const p2 = `${RUN_TAG}-p2-${fixtureId}`;
  const peIds = await insertPe([peRow(fixtureId, { status: "pending", predictedWinnerId: p2, calibratedProbability: 60 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  // Builder natively graded this as a win for p1 -- but the independent result source says p2 won.
  const tradeIds = await insertTrades([
    builderTrade(fixtureId, "PLAYER_1", { status: "GRADED", actualWinnerId: p1, resultType: "normal" }),
    builderTrade(fixtureId, "PLAYER_2", { status: "GRADED", actualWinnerId: p1, resultType: "normal", builderPickedPlayerId: p1 }),
  ]);
  const hmIds = await insertHistoricalMatches([historicalMatchRow({ player1Id: p1, player2Id: p2, winnerId: p2 })]);
  t.after(() => cleanupAll([fixtureId], peIds, hmIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row!.canonicalActualWinnerId, p2, "the independent historical_matches result must win, not Builder's own already-written actualWinnerId");
  assert.equal(row!.builderCorrect, false, "Builder's canonical correctness is now false, since it picked p1 but the real canonical winner is p2");
  assert.equal(row!.builderNativeGradeMatchesCanonical, false, "Builder's own native grade (p1) disagrees with the canonical result (p2) -- must be surfaced, not hidden");
});

test("14: the canonical winner grades both engines independently -- both-correct case", async (t) => {
  const fixtureId = nextFixtureId();
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const p2 = `${RUN_TAG}-p2-${fixtureId}`;
  const peIds = await insertPe([peRow(fixtureId, { predictedWinnerId: p1, calibratedProbability: 70 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([builderTrade(fixtureId, "PLAYER_1"), builderTrade(fixtureId, "PLAYER_2")]);
  const hmIds = await insertHistoricalMatches([historicalMatchRow({ player1Id: p1, player2Id: p2, winnerId: p1 })]);
  t.after(() => cleanupAll([fixtureId], peIds, hmIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row!.bothCorrect, true);
  assert.equal(row!.bothWrong, false);
  assert.equal(row!.onlyPeCorrect, false);
  assert.equal(row!.onlyBuilderCorrect, false);
});

test("15: a native-grade mismatch is detectable on both sides simultaneously, independent of each other", async (t) => {
  const fixtureId = nextFixtureId();
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const p2 = `${RUN_TAG}-p2-${fixtureId}`;
  const peIds = await insertPe([
    peRow(fixtureId, { status: "graded", predictedWinnerId: p1, calibratedProbability: 55, actualWinnerId: p1, resultType: "normal" }),
  ]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([
    builderTrade(fixtureId, "PLAYER_1", { status: "GRADED", actualWinnerId: p1, resultType: "normal" }),
    builderTrade(fixtureId, "PLAYER_2", { status: "GRADED", actualWinnerId: p1, resultType: "normal", builderPickedPlayerId: p1 }),
  ]);
  // Both engines' native grading agrees with EACH OTHER (both say p1) -- but the independent
  // canonical source says p2 actually won. Under the old (corrected) design this would have been
  // silently accepted as "agreement"; it must now be caught by BOTH cross-check flags.
  const hmIds = await insertHistoricalMatches([historicalMatchRow({ player1Id: p1, player2Id: p2, winnerId: p2 })]);
  t.after(() => cleanupAll([fixtureId], peIds, hmIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row!.canonicalActualWinnerId, p2);
  assert.equal(row!.peNativeGradeMatchesCanonical, false);
  assert.equal(row!.builderNativeGradeMatchesCanonical, false);
  assert.equal(row!.bothWrong, true, "both engines predicted p1 pre-match, and the real canonical winner is p2");
});

test("16: cohort can still grade when one native grading pipeline lags -- PE graded, Builder still in-progress", async (t) => {
  const fixtureId = nextFixtureId();
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const p2 = `${RUN_TAG}-p2-${fixtureId}`;
  const peIds = await insertPe([
    peRow(fixtureId, { status: "graded", predictedWinnerId: p1, calibratedProbability: 65, actualWinnerId: p1, resultType: "normal" }),
  ]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([
    builderTrade(fixtureId, "PLAYER_1", { status: "STARTED" }),
    builderTrade(fixtureId, "PLAYER_2", { status: "STARTED" }),
  ]);
  const hmIds = await insertHistoricalMatches([historicalMatchRow({ player1Id: p1, player2Id: p2, winnerId: p1 })]);
  t.after(() => cleanupAll([fixtureId], peIds, hmIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row!.canonicalActualWinnerId, p1, "the canonical result must resolve from historical_matches regardless of Builder's own grading lag");
  assert.equal(row!.peCorrect, true);
  assert.equal(row!.builderCorrect, true, "builderCorrect is graded from the canonical result even though Builder itself has not natively graded yet");
  assert.equal(row!.peNativeGradeMatchesCanonical, true);
  assert.equal(row!.builderNativeGradeMatchesCanonical, null, "Builder hasn't graded natively (still STARTED) -- its cross-check must stay unresolved, not false");
});

test("17: a non-terminal historical_matches row (no winner, not cancelled/walkover) cannot grade the cohort", async (t) => {
  const fixtureId = nextFixtureId();
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const p2 = `${RUN_TAG}-p2-${fixtureId}`;
  const peIds = await insertPe([peRow(fixtureId, { predictedWinnerId: p1, calibratedProbability: 60 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([builderTrade(fixtureId, "PLAYER_1"), builderTrade(fixtureId, "PLAYER_2")]);
  const hmIds = await insertHistoricalMatches([
    historicalMatchRow({ player1Id: p1, player2Id: p2, winnerId: null, cancelled: false, walkover: false }),
  ]);
  t.after(() => cleanupAll([fixtureId], peIds, hmIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row!.canonicalActualWinnerId, null, "a non-terminal historical_matches row must never grade the cohort");
  assert.equal(row!.canonicalSourceHistoricalMatchId, null);
  assert.equal(row!.peCorrect, null);
});

test("18: result identity must match the exact fixture -- a same-player-pair historical_matches row OUTSIDE the scheduled-time window is not picked as canonical", async (t) => {
  const fixtureId = nextFixtureId();
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const p2 = `${RUN_TAG}-p2-${fixtureId}`;
  const peIds = await insertPe([peRow(fixtureId, { predictedWinnerId: p1, calibratedProbability: 60 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([builderTrade(fixtureId, "PLAYER_1"), builderTrade(fixtureId, "PLAYER_2")]);
  // Same two players met once before, 90 days earlier -- well outside the +/-24h matching window
  // around this fixture's own 2026-02-01T12:00:00Z scheduled start.
  const hmIds = await insertHistoricalMatches([
    historicalMatchRow({ player1Id: p1, player2Id: p2, winnerId: p2, scheduledStartAt: new Date("2025-11-03T12:00:00Z") }),
  ]);
  t.after(() => cleanupAll([fixtureId], peIds, hmIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row!.canonicalActualWinnerId, null, "a prior meeting between the same two players outside the time window must never be mistaken for this fixture's result");
});

test("19: historical firewall -- a non-'paper_trade' PE row (e.g. historical_test) sharing the same externalFixtureId as a real Builder fixture is never matched", async (t) => {
  const fixtureId = nextFixtureId();
  const peIds = await insertPe([peRow(fixtureId, { runKind: "historical_test", predictedWinnerId: `${RUN_TAG}-p1-${fixtureId}`, calibratedProbability: 60 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([builderTrade(fixtureId, "PLAYER_1"), builderTrade(fixtureId, "PLAYER_2")]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row, null, "only run_kind='paper_trade' PE rows may ever feed the matched cohort -- never historical_test/shadow reconstruction");
});

test("20: ambiguous PE rows for the same fixture (should never happen given evaluation_predictions' own unique index, but defensively) are skipped rather than picking one arbitrarily", async (t) => {
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

test("21: a Builder DATA_ERROR row (real sibling-disagreement, e.g. fixture 35909's shape) is excluded by the eligibility status whitelist even though frozenAt/builderPickedPlayerId are both non-null", async (t) => {
  const fixtureId = nextFixtureId();
  const p1 = `${RUN_TAG}-p1-${fixtureId}`;
  const p2 = `${RUN_TAG}-p2-${fixtureId}`;
  const peIds = await insertPe([peRow(fixtureId, { predictedWinnerId: p1, calibratedProbability: 60 })]);
  // Mirrors real production fixture 35909: both sibling rows are DATA_ERROR/MODEL_DISAGREEMENT,
  // each with frozenAt set and its OWN builderPickedPlayerId (each side picked itself) as a
  // forensic record -- the pair's crossSideAgreement is false.
  const pairIds = await insertPair([builderPair(fixtureId, { crossSideAgreement: false, crossSideDisagreementReason: "MODEL_DISAGREEMENT" })]);
  const tradeIds = await insertTrades([
    builderTrade(fixtureId, "PLAYER_1", { status: "DATA_ERROR", noDecisionReason: "MODEL_DISAGREEMENT", decision: "BORDERLINE", builderPickedPlayerId: p1 }),
    builderTrade(fixtureId, "PLAYER_2", { status: "DATA_ERROR", noDecisionReason: "MODEL_DISAGREEMENT", decision: "BORDERLINE", builderPickedPlayerId: p2 }),
  ]);
  t.after(() => cleanupAll([fixtureId], peIds));

  await syncMatchedCohort();
  const row = await cohortRow(fixtureId);
  assert.equal(row, null, "a DATA_ERROR pair must never enter the cohort even though frozenAt and builderPickedPlayerId are both populated");
});

test("22: PE and Builder eligible-population counts in the sync summary reflect this run's inserted rows", async (t) => {
  const fixtureId = nextFixtureId();
  const peIds = await insertPe([peRow(fixtureId, { predictedWinnerId: `${RUN_TAG}-p1-${fixtureId}`, calibratedProbability: 60 })]);
  const pairIds = await insertPair([builderPair(fixtureId)]);
  const tradeIds = await insertTrades([builderTrade(fixtureId, "PLAYER_1"), builderTrade(fixtureId, "PLAYER_2")]);
  t.after(() => cleanupAll([fixtureId], peIds));

  const summary = await syncMatchedCohort();
  assert.ok(summary.peEligibleCount >= 1, "eligible PE population must include this run's row");
  assert.ok(summary.builderEligibleCount >= 2, "eligible Builder population must include both sibling rows for this fixture");
});
