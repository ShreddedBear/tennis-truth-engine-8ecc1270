// Integration test for the Phase 4 live paper-trading cycle. A fake TennisDataProvider stands
// in for the real API so the test controls exactly what "now" looks like relative to a fixture's
// cutoff -- the property under test is the cutoff/lock-grace boundary: a fixture must be locked
// once its cutoff arrives, must be marked 'missed' once the lock grace window after cutoff
// elapses (even though the match hasn't started yet), and must never be locked late.
// Run with: pnpm --filter @workspace/api-server run test:evaluation -- (or add to that script)
import test from "node:test";
import assert from "node:assert/strict";
import {
  db,
  canonicalPlayersTable,
  evaluationPredictionsTable,
  liveCompletedResultsTable,
  type InsertEvaluationPrediction,
  type InsertLiveCompletedResult,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { runPaperTradingCycle } from "./paperTrading";
import type {
  TennisDataProvider,
  PlayerSummary,
  PlayerProfile,
  MatchRecord,
  Fixture,
  HeadToHeadRecord,
  ProviderStatusInfo,
} from "../tennisData";

const PROVIDER_NAME = "fake-paper-trade-test-provider";

class FakeProvider implements TennisDataProvider {
  readonly name: string;
  constructor(
    private fixtures: Fixture[],
    private matchesByPlayerId: Map<string, MatchRecord[]> = new Map(),
    name = PROVIDER_NAME,
    private readonly onGetPlayer: () => void = () => {},
    private readonly matchHistoryErrorsByPlayerId: Map<string, Error> = new Map(),
  ) {
    this.name = name;
  }

  async searchPlayers(): Promise<PlayerSummary[]> {
    return [];
  }
  async getPlayer(playerId: string): Promise<PlayerProfile | null> {
    this.onGetPlayer();
    return { id: playerId, name: playerId, fullName: null, countryCode: null, currentRank: null, tour: "ATP", age: null, plays: null };
  }
  async getPlayerMatches(playerId: string): Promise<MatchRecord[]> {
    const error = this.matchHistoryErrorsByPlayerId.get(playerId);
    if (error) throw error;
    return this.matchesByPlayerId.get(playerId) ?? [];
  }
  async getUpcomingFixtures(date: string): Promise<Fixture[]> {
    return this.fixtures.filter((f) => f.date.slice(0, 10) === date);
  }
  async getUpcomingFixturesRange(dateStart: string, dateStop: string): Promise<Fixture[]> {
    return this.fixtures.filter((f) => f.date.slice(0, 10) >= dateStart && f.date.slice(0, 10) <= dateStop);
  }
  // Fixture discovery now goes through the separate PredictionEngineFixtureDiscoveryProvider
  // parameter (see paperTrading.ts) rather than this class's own getUpcomingFixtures above --
  // this test double implements it identically so the existing PIT-boundary assertions below stay
  // exercised exactly as before.
  async getUpcomingFixturesForPredictionEngine(date: string): Promise<Fixture[]> {
    return this.fixtures.filter((f) => f.date.slice(0, 10) === date);
  }
  async getHeadToHead(player1Id: string, player2Id: string): Promise<HeadToHeadRecord> {
    return { player1Id, player2Id, meetings: [] };
  }
  async getCompletedMatchesByDateRange(): Promise<never[]> {
    return [];
  }
  async getLiveScores(): Promise<Map<string, never>> {
    return new Map<string, never>();
  }
  getStatus(): ProviderStatusInfo {
    return { provider: this.name, connected: true, lastSuccessfulCallAt: null, lastError: null };
  }
}

function isoDaysFromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

function makeFixture(id: string, startOffsetMs: number): Fixture {
  const scheduledStart = isoDaysFromNow(startOffsetMs);
  return {
    id,
    date: scheduledStart.slice(0, 10),
    scheduledStart,
    timeConfirmed: true,
    isLive: false,
    tournamentName: "Paper Trade Test Series",
    tournamentLevel: "ATP250",
    round: null,
    surface: "Hard",
    indoor: false,
    matchFormat: "BestOf3",
    player1Id: `${id}-p1`,
    player1Name: `${id}-p1`,
    player2Id: `${id}-p2`,
    player2Name: `${id}-p2`,
  };
}

test("paper trading cycle: locks at cutoff, misses once the lock-grace window elapses, never locks late", async (t) => {
  const MINUTE = 60_000;
  const LEAD_MINUTES = 30; // matches predictionSettingsTable default paperTradeLeadMinutes
  const GRACE_MINUTES = 25; // matches LOCK_GRACE_MINUTES in paperTrading.ts

  // A: starts far in the future -- cutoff hasn't arrived yet, must be untouched this cycle.
  const notYetDue = makeFixture("ptt-not-due", (LEAD_MINUTES + 60) * MINUTE);
  // B: cutoff arrived a few minutes ago, well within the lock grace window -- must be locked.
  //    (cutoff was 20 min ago; grace=25 min, so 20 < 25 → still within grace)
  const withinGrace = makeFixture("ptt-within-grace", (LEAD_MINUTES - 20) * MINUTE);
  // C: cutoff passed more than the grace window ago, but match hasn't started yet -- must be
  //    missed, not locked (guards against locking a prediction too close to or after the deadline).
  //    (cutoff was 27 min ago; grace=25 min, so 27 > 25 → past grace; match still 3 min away)
  const pastGrace = makeFixture("ptt-past-grace", (LEAD_MINUTES - GRACE_MINUTES - 2) * MINUTE);
  // D: match has already started with nothing ever locked -- must be missed.
  const alreadyStarted = makeFixture("ptt-already-started", -5 * MINUTE);

  const provider = new FakeProvider([notYetDue, withinGrace, pastGrace, alreadyStarted]);

  t.after(async () => {
    await db.delete(evaluationPredictionsTable).where(eq(evaluationPredictionsTable.provider, PROVIDER_NAME));
  });

  const summary = await runPaperTradingCycle(provider, provider);

  const rows = await db
    .select()
    .from(evaluationPredictionsTable)
    .where(
      inArray(evaluationPredictionsTable.externalFixtureId, [notYetDue.id, withinGrace.id, pastGrace.id, alreadyStarted.id]),
    );
  const byId = Object.fromEntries(rows.map((r) => [r.externalFixtureId, r]));

  assert.equal(byId[notYetDue.id], undefined, "a fixture whose cutoff hasn't arrived must not get any row yet");

  assert.ok(byId[withinGrace.id], "a fixture inside its lock-grace window must be locked");
  assert.equal(byId[withinGrace.id].status, "pending");
  assert.ok(byId[withinGrace.id].predictedWinnerId, "a locked prediction must carry a real predicted winner");

  assert.ok(byId[pastGrace.id], "a fixture whose lock-grace window elapsed must get a terminal row");
  assert.equal(byId[pastGrace.id].status, "missed", "must be marked missed, not locked late, once the grace window elapses");
  assert.equal(byId[pastGrace.id].predictedWinnerId, null, "a missed fixture must never carry a fabricated prediction");

  assert.ok(byId[alreadyStarted.id]);
  assert.equal(byId[alreadyStarted.id].status, "missed");

  assert.equal(summary.locked, 1);
  assert.equal(summary.missed, 2);
});

test("paper trading cycle blocks duplicate fixture ids with conflicting player pairs", async (t) => {
  const MINUTE = 60_000;
  const LEAD_MINUTES = 30;

  const base = makeFixture("ptt-dup-fixture", (LEAD_MINUTES - 5) * MINUTE);
  const conflicting: Fixture = {
    ...base,
    player1Id: "ptt-dup-fixture-p1-alt",
    player1Name: "ptt-dup-fixture-p1-alt",
    player2Id: "ptt-dup-fixture-p2-alt",
    player2Name: "ptt-dup-fixture-p2-alt",
  };

  const provider = new FakeProvider([base, conflicting]);

  t.after(async () => {
    await db.delete(evaluationPredictionsTable).where(eq(evaluationPredictionsTable.provider, PROVIDER_NAME));
  });

  const summary = await runPaperTradingCycle(provider, provider);

  const rows = await db
    .select()
    .from(evaluationPredictionsTable)
    .where(eq(evaluationPredictionsTable.externalFixtureId, base.id));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].player1Id, base.player1Id);
  assert.equal(rows[0].player2Id, base.player2Id);
  assert.ok(summary.errors.some((e) => e.includes("duplicate fixture id with conflicting players")));
});

test("paper trading discards a scored prediction if scoring crosses match start", async (t) => {
  const MINUTE = 60_000;
  const fixture = makeFixture(`ptt-scoring-crosses-start-${Date.now()}`, 10 * MINUTE);
  let simulatedNow = Date.now();
  const provider = new FakeProvider(
    [fixture],
    new Map(),
    "fake-paper-trade-crossed-start-provider",
    () => {
      simulatedNow = new Date(fixture.scheduledStart!).getTime() + 1;
    },
  );

  t.after(async () => {
    await db.delete(evaluationPredictionsTable).where(eq(evaluationPredictionsTable.provider, provider.name));
  });

  const summary = await runPaperTradingCycle(provider, provider, () => simulatedNow);
  const [row] = await db
    .select()
    .from(evaluationPredictionsTable)
    .where(eq(evaluationPredictionsTable.externalFixtureId, fixture.id));

  assert.ok(row, "the missed fixture should remain visible in the live ledger");
  assert.equal(row.status, "missed");
  assert.equal(row.predictedWinnerId, null, "a prediction scored across match start must not be persisted");
  assert.equal(row.predictedWinnerName, null);
  assert.equal(row.featureSnapshot, null, "post-boundary model evidence must not be frozen");
  assert.equal(summary.locked, 0);
  assert.equal(summary.missed, 1);
});

function pendingPredictionValues(
  provider: string,
  fixtureId: string,
  scheduledStartAt: Date,
  player1Id: string,
  player2Id: string,
  predictedWinnerId: string,
): InsertEvaluationPrediction {
  const predictedWinnerName = predictedWinnerId === player1Id ? "Player One" : "Player Two";
  return {
    runKind: "paper_trade",
    provider,
    externalFixtureId: fixtureId,
    player1Id,
    player1Name: "Player One",
    player2Id,
    player2Name: "Player Two",
    surface: "Hard",
    matchFormat: "BestOf3",
    tournamentName: "Paper Trade Result Safety Test",
    scheduledStartAt,
    cutoffAt: new Date(scheduledStartAt.getTime() - 30 * 60_000),
    lockedAt: new Date(scheduledStartAt.getTime() - 20 * 60_000),
    modelVersion: "paper-trade-result-safety-test",
    rawProbability: 60,
    calibratedProbability: 60,
    predictedWinnerId,
    predictedWinnerName,
    status: "pending",
  };
}

function resultRecord(id: string, date: string, opponentId: string, result: "W" | "L"): MatchRecord {
  return {
    id,
    date,
    tournamentName: "Paper Trade Result Safety Test",
    tournamentLevel: "ATP250",
    round: null,
    matchFormat: "BestOf3",
    surface: "Hard",
    indoor: false,
    opponentId,
    opponentName: "Player Two",
    opponentRank: null,
    result,
    score: "6-4 6-4",
    retired: false,
    walkover: false,
    stats: null,
    opponentStats: null,
    setGameMargins: [],
  };
}

test("paper trading grades exact wins and losses, but ambiguous or absent results remain pending", async (t) => {
  const providerName = "fake-paper-trade-result-safety-provider";
  const baseId = `ptt-result-safety-${Date.now()}`;
  const scheduledStartAt = new Date(Date.now() - 2 * 60 * 60_000);
  const fixtureIds = ["win", "loss", "ambiguous", "unresolved"].map((suffix) => `${baseId}-${suffix}`);
  const [winFixture, lossFixture, ambiguousFixture, unresolvedFixture] = fixtureIds;
  const p1Ids = fixtureIds.map((fixtureId) => `${fixtureId}-p1`);
  const p2Ids = fixtureIds.map((fixtureId) => `${fixtureId}-p2`);
  const rows: InsertEvaluationPrediction[] = [
    pendingPredictionValues(providerName, winFixture, scheduledStartAt, p1Ids[0], p2Ids[0], p1Ids[0]),
    pendingPredictionValues(providerName, lossFixture, scheduledStartAt, p1Ids[1], p2Ids[1], p1Ids[1]),
    pendingPredictionValues(providerName, ambiguousFixture, scheduledStartAt, p1Ids[2], p2Ids[2], p1Ids[2]),
    pendingPredictionValues(providerName, unresolvedFixture, scheduledStartAt, p1Ids[3], p2Ids[3], p1Ids[3]),
  ];
  const matchDate = scheduledStartAt.toISOString();
  const matchHistory = new Map<string, MatchRecord[]>([
    [p1Ids[0], [resultRecord(winFixture, matchDate, p2Ids[0], "W")]],
    [p1Ids[1], [resultRecord(lossFixture, matchDate, p2Ids[1], "L")]],
    [
      p1Ids[2],
      [
        resultRecord(ambiguousFixture, matchDate, p2Ids[2], "W"),
        resultRecord(ambiguousFixture, matchDate, p2Ids[2], "L"),
      ],
    ],
  ]);
  const provider = new FakeProvider([], matchHistory, providerName);

  t.after(async () => {
    await db.delete(evaluationPredictionsTable).where(eq(evaluationPredictionsTable.provider, providerName));
  });

  await db.insert(evaluationPredictionsTable).values(rows);
  const summary = await runPaperTradingCycle(provider, provider);
  const persisted = await db
    .select()
    .from(evaluationPredictionsTable)
    .where(inArray(evaluationPredictionsTable.externalFixtureId, fixtureIds));
  const byFixture = new Map(persisted.map((row) => [row.externalFixtureId, row]));

  assert.equal(byFixture.get(winFixture)?.status, "graded");
  assert.equal(byFixture.get(winFixture)?.predictedWinnerId, byFixture.get(winFixture)?.actualWinnerId);
  assert.equal(byFixture.get(lossFixture)?.status, "graded");
  assert.notEqual(byFixture.get(lossFixture)?.predictedWinnerId, byFixture.get(lossFixture)?.actualWinnerId);
  assert.equal(byFixture.get(ambiguousFixture)?.status, "pending", "ambiguous exact-fixture outcomes must fail closed");
  assert.equal(byFixture.get(unresolvedFixture)?.status, "pending", "missing results must remain pending");
  assert.equal(summary.graded, 2);
  assert.ok(summary.errors.some((error) => error.includes("ambiguous matches")));
});

test("paper trading resolves shared live results by exact unordered provider IDs and fails closed", async (t) => {
  const baseId = `ptt-live-results-${Date.now()}`;
  const liveProvider = "Live Tennis API";
  const peCompositeProvider = "Live Tennis API+Live Tennis API (no secondary provider)";
  const now = Date.now();
  const peStart = new Date(now - 3 * 60 * 60_000);
  const fixtureIds = [
    "win", "loss", "ambiguous", "missing", "future-result", "future-prediction",
    "direct", "direct-metadata-mismatch", "direct-time-mismatch", "direct-conflict", "direct-id-mismatch",
  ].map((suffix) => `${baseId}-${suffix}`);
  const [winId, lossId, ambiguousId, missingId, futureResultId, futurePredictionId, directId, directMetadataMismatchId, directTimeMismatchId, directConflictId, directIdMismatchId] = fixtureIds;
  const playerPairs = fixtureIds.map((fixtureId) => [`${fixtureId}-p1`, `${fixtureId}-p2`] as const);
  const directTimeMismatchStart = new Date(now - 24 * 60 * 60_000);
  const canonicalId = (providerPlayerId: string) => `${baseId}-canonical-${providerPlayerId}`;
  const canonicalPlayerIds = [...new Set(playerPairs.flatMap(([p1, p2]) => [canonicalId(p1), canonicalId(p2)]))];
  const canonicalRows = canonicalPlayerIds.map((id) => ({
    id,
    displayName: id,
    normalizedName: id.toLowerCase(),
  }));

  function sharedResult(
    externalId: string,
    providerPlayer1Id: string,
    providerPlayer2Id: string,
    winnerProviderPlayerId: string,
    scheduledStartAt: Date,
  ): InsertLiveCompletedResult {
    return {
      provider: liveProvider,
      externalId,
      providerPlayer1Id,
      providerPlayer2Id,
      canonicalPlayer1Id: canonicalId(providerPlayer1Id),
      canonicalPlayer2Id: canonicalId(providerPlayer2Id),
      canonicalWinnerId: canonicalId(winnerProviderPlayerId),
      terminalResultType: "finished",
      scheduledStartAt,
      tournamentName: "Paper Trade Shared Results Test",
      surface: "Hard",
    };
  }

  const resultRows: InsertLiveCompletedResult[] = [
    sharedResult(`${winId}-official`, playerPairs[0][0], playerPairs[0][1], playerPairs[0][0], peStart),
    // Deliberately reverse provider participant order: winner must still map to the
    // PE's frozen player IDs, rather than assuming both systems use player-one order.
    sharedResult(`${lossId}-official`, playerPairs[1][1], playerPairs[1][0], playerPairs[1][1], peStart),
    sharedResult(`${ambiguousId}-official-a`, playerPairs[2][0], playerPairs[2][1], playerPairs[2][0], new Date(peStart.getTime() - 30 * 60_000)),
    sharedResult(`${ambiguousId}-official-b`, playerPairs[2][1], playerPairs[2][0], playerPairs[2][1], new Date(peStart.getTime() + 30 * 60_000)),
    // The provider can expose a terminal fixture with a future scheduled start.
    sharedResult(`${futureResultId}-official`, playerPairs[4][0], playerPairs[4][1], playerPairs[4][0], new Date(now + 2 * 60 * 60_000)),
    sharedResult(`${futurePredictionId}-official`, playerPairs[5][0], playerPairs[5][1], playerPairs[5][0], new Date(now - 60 * 60_000)),
    // An existing direct-history match must retain precedence over this shared row.
    sharedResult(`${directId}-official`, playerPairs[6][0], playerPairs[6][1], playerPairs[6][0], peStart),
    sharedResult(`${directMetadataMismatchId}-official`, playerPairs[7][0], playerPairs[7][1], playerPairs[7][0], peStart),
    sharedResult(`${directTimeMismatchId}-official`, playerPairs[8][0], playerPairs[8][1], playerPairs[8][0], directTimeMismatchStart),
    sharedResult(`${directConflictId}-official`, playerPairs[9][0], playerPairs[9][1], playerPairs[9][1], peStart),
    sharedResult(`${directIdMismatchId}-official`, playerPairs[10][0], playerPairs[10][1], playerPairs[10][0], peStart),
  ];
  const predictions: InsertEvaluationPrediction[] = fixtureIds.map((fixtureId, index) => ({
    ...pendingPredictionValues(
      peCompositeProvider,
      fixtureId,
      fixtureId === futurePredictionId
        ? new Date(now + 2 * 60 * 60_000)
        : fixtureId === directTimeMismatchId
          ? directTimeMismatchStart
          : peStart,
      playerPairs[index][0],
      playerPairs[index][1],
      playerPairs[index][0],
    ),
    tournamentName: "Paper Trade Shared Results Test",
  }));
  const directResult = (id: string, date: string, opponentId: string, result: "W" | "L", overrides: Partial<MatchRecord> = {}): MatchRecord => ({
    ...resultRecord(id, date, opponentId, result),
    tournamentName: "Paper Trade Shared Results Test",
    surface: "Hard",
    ...overrides,
  });
  const directProvider = new FakeProvider(
    [],
    new Map([
      [playerPairs[6][0], [directResult(directId, peStart.toISOString(), playerPairs[6][1], "W")]],
      [playerPairs[7][0], [directResult(directMetadataMismatchId, peStart.toISOString(), playerPairs[7][1], "W", { tournamentName: "Different Event", surface: "Clay" })]],
      [playerPairs[8][0], [directResult(directTimeMismatchId, new Date(directTimeMismatchStart.getTime() + 7 * 60 * 60_000).toISOString(), playerPairs[8][1], "L")]],
      [playerPairs[9][0], [directResult(directConflictId, peStart.toISOString(), playerPairs[9][1], "W")]],
      [playerPairs[10][0], [directResult(`${directIdMismatchId}-different-id`, peStart.toISOString(), playerPairs[10][1], "W")]],
    ]),
    "fake-paper-trade-shared-result-provider",
    () => {},
    new Map(playerPairs.slice(0, 6).map(([player1Id]) => [player1Id, new Error("HTTP 400: player match history unavailable")])),
  );
  const sharedResultExternalIds = resultRows.map((result) => result.externalId);

  t.after(async () => {
    await db.delete(evaluationPredictionsTable).where(inArray(evaluationPredictionsTable.externalFixtureId, fixtureIds));
    await db.delete(liveCompletedResultsTable).where(inArray(liveCompletedResultsTable.externalId, sharedResultExternalIds));
    await db.delete(canonicalPlayersTable).where(inArray(canonicalPlayersTable.id, canonicalPlayerIds));
  });

  await db.insert(canonicalPlayersTable).values(canonicalRows).onConflictDoNothing();
  await db.insert(liveCompletedResultsTable).values(resultRows);
  await db.insert(evaluationPredictionsTable).values(predictions);

  const summary = await runPaperTradingCycle(directProvider, directProvider);
  const persisted = await db
    .select()
    .from(evaluationPredictionsTable)
    .where(inArray(evaluationPredictionsTable.externalFixtureId, fixtureIds));
  const byFixture = new Map(persisted.map((row) => [row.externalFixtureId, row]));

  assert.equal(byFixture.get(winId)?.status, "graded");
  assert.equal(byFixture.get(winId)?.actualWinnerId, playerPairs[0][0]);
  assert.equal(byFixture.get(winId)?.actualWinnerId, byFixture.get(winId)?.predictedWinnerId);
  assert.equal(byFixture.get(lossId)?.status, "graded");
  assert.equal(byFixture.get(lossId)?.actualWinnerId, playerPairs[1][1]);
  assert.notEqual(byFixture.get(lossId)?.actualWinnerId, byFixture.get(lossId)?.predictedWinnerId);
  assert.equal(byFixture.get(ambiguousId)?.status, "pending", "multiple valid fixture candidates must not select the first result");
  assert.equal(byFixture.get(missingId)?.status, "pending", "no matching shared result remains pending");
  assert.equal(byFixture.get(futureResultId)?.status, "pending", "a terminal row with future scheduled start cannot be graded");
  assert.equal(byFixture.get(futurePredictionId)?.status, "pending", "a result cannot grade before the frozen prediction's start");
  assert.equal(byFixture.get(directId)?.status, "graded");
  assert.equal(byFixture.get(directId)?.actualWinnerId, playerPairs[6][0], "the existing direct-history winner remains authoritative");
  assert.equal(byFixture.get(directMetadataMismatchId)?.status, "graded", "direct rows with mismatched tournament/surface must defer to the neutral exact result");
  assert.equal(byFixture.get(directMetadataMismatchId)?.actualWinnerId, playerPairs[7][0]);
  assert.equal(byFixture.get(directTimeMismatchId)?.status, "graded", "direct rows outside the scheduled window must defer to the neutral exact result");
  assert.equal(byFixture.get(directTimeMismatchId)?.actualWinnerId, playerPairs[8][0]);
  assert.equal(byFixture.get(directConflictId)?.status, "pending", "contradictory direct and neutral winners must fail closed");
  assert.equal(byFixture.get(directIdMismatchId)?.status, "graded", "a same-pair history record with another fixture ID must not override the neutral result");
  assert.equal(byFixture.get(directIdMismatchId)?.actualWinnerId, playerPairs[10][0]);
  assert.equal(summary.graded, 6);
  assert.ok(summary.errors.some((error) => error.includes("ambiguous shared live results")));
  assert.ok(summary.errors.some((error) => error.includes("winner conflicts with shared live result")));
  assert.ok(summary.errors.some((error) => error.includes("HTTP 400")), "a legacy provider failure must not block shared-result resolution");
});
