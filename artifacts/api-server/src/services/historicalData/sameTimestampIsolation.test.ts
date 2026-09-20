import test from "node:test";
import assert from "node:assert/strict";
import { db, historicalMatchesTable, matchFeatureSnapshotsTable, playerStatsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { runHistoricalBackfill } from "./backfill";
import type { HistoricalFixture, TennisDataProvider } from "../tennisData/types";

test("same-time fixtures share pre-group state and a later fixture sees every fold", async () => {
  const provider = "same-timestamp-isolation-test";
  const sharedPlayer = `${provider}-shared`;
  const seedOpponent = `${provider}-seed-opponent`;
  const players = [
    sharedPlayer,
    seedOpponent,
    `${provider}-opponent-a`,
    `${provider}-opponent-b`,
    `${provider}-later-opponent`,
  ];
  const fixture = (id: string, player2Id: string, date: string): HistoricalFixture => ({
    id,
    provider,
    date,
    time: "12:00",
    tour: "ATP",
    tournamentName: "Synthetic Same-Time Event",
    tournamentLevel: "ATP250",
    round: "R32",
    surface: "Hard",
    matchFormat: "BestOf3",
    player1Id: sharedPlayer,
    player1Name: "Shared Player",
    player2Id,
    player2Name: player2Id,
    winnerId: sharedPlayer,
    score: "6-4 6-4",
    retired: false,
    walkover: false,
    cancelled: false,
    setGameMargins: [{ player1Games: 6, player2Games: 4 }],
    indoor: false,
    player1Rank: null,
    player2Rank: null,
    raw: {},
  });
  const fixtures = [
    fixture("same-time-a", `${provider}-opponent-a`, "2026-08-01"),
    fixture("same-time-b", `${provider}-opponent-b`, "2026-08-01"),
    fixture("later", `${provider}-later-opponent`, "2026-08-02"),
  ];
  // Give the shared player real pre-group history so computeFeatures emits snapshots (debutants
  // intentionally have no fabricated baseline snapshot).
  await db.insert(historicalMatchesTable).values({
    externalId: "seed",
    provider,
    tour: "ATP",
    tournamentName: "Synthetic Seed Event",
    tournamentLevel: "ATP250",
    surface: "Hard",
    round: "F",
    matchFormat: "BestOf3",
    player1Id: sharedPlayer,
    player1Name: "Shared Player",
    player2Id: seedOpponent,
    player2Name: "Seed Opponent",
    winnerId: sharedPlayer,
    score: "6-4 6-4",
    retired: false,
    walkover: false,
    cancelled: false,
    scheduledStartAt: new Date("2026-07-01T00:00:00.000Z"),
    cutoffMinutes: 30,
    cutoffAt: new Date("2026-06-30T23:30:00.000Z"),
    gameMarginsPlayer1: [{ player1Games: 6, player2Games: 4 }],
    rawSource: {},
  });
  const fakeProvider: TennisDataProvider = {
    name: provider,
    async searchPlayers() { throw new Error("not used"); },
    async getPlayer() { throw new Error("not used"); },
    async getPlayerMatches() { throw new Error("not used"); },
    async getUpcomingFixtures() { throw new Error("not used"); },
    async getUpcomingFixturesRange() { throw new Error("not used"); },
    async getHeadToHead() { throw new Error("not used"); },
    async getCompletedMatchesByDateRange() { return fixtures; },
    async getLiveScores() { return new Map(); },
    getStatus() { return { provider, connected: true, lastSuccessfulCallAt: null, lastError: null }; },
  };

  try {
    await runHistoricalBackfill(fakeProvider, { dateStart: "2026-08-01", dateStop: "2026-08-02" });
    const matches = await db
      .select({ id: historicalMatchesTable.id, externalId: historicalMatchesTable.externalId })
      .from(historicalMatchesTable)
      .where(and(eq(historicalMatchesTable.provider, provider), inArray(historicalMatchesTable.externalId, fixtures.map(f => f.id))));
    const matchIds = new Map(matches.map(row => [row.externalId, row.id]));
    const snapshots = await db
      .select({ matchId: matchFeatureSnapshotsTable.matchId, playerId: matchFeatureSnapshotsTable.playerId, featureName: matchFeatureSnapshotsTable.featureName, featureValue: matchFeatureSnapshotsTable.featureValue })
      .from(matchFeatureSnapshotsTable)
      .where(inArray(matchFeatureSnapshotsTable.matchId, [...matchIds.values()]));
    const value = (externalId: string, playerId: string, name: string) => {
      const row = snapshots.find(s => s.matchId === matchIds.get(externalId) && s.playerId === playerId && s.featureName === name);
      assert.ok(row, `missing ${name} snapshot for ${externalId}/${playerId}`);
      return Number(row.featureValue);
    };
    assert.equal(value("same-time-a", sharedPlayer, "matchesPlayed"), 1);
    assert.equal(value("same-time-b", sharedPlayer, "matchesPlayed"), 1);
    assert.equal(value("later", sharedPlayer, "matchesPlayed"), 3);
  } finally {
    const rows = await db.select({ id: historicalMatchesTable.id })
      .from(historicalMatchesTable).where(eq(historicalMatchesTable.provider, provider));
    for (const row of rows) await db.delete(matchFeatureSnapshotsTable).where(eq(matchFeatureSnapshotsTable.matchId, row.id));
    await db.delete(historicalMatchesTable).where(eq(historicalMatchesTable.provider, provider));
    await db.delete(playerStatsTable).where(inArray(playerStatsTable.playerId, players));
  }
});