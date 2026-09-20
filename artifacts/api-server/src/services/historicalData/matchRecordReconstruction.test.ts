import test from "node:test";
import assert from "node:assert/strict";
import { buildMatchHistoryIndex, reconstructPlayerMatchHistory, type HistoricalMatchContextRow } from "./matchRecordReconstruction";

function row(id: number, scheduledStartAt: string, winnerId = "p1"): HistoricalMatchContextRow {
  return {
    id,
    provider: "synthetic",
    tour: "ATP",
    tournamentName: `Synthetic ${id}`,
    tournamentLevel: "ATP250",
    surface: "Hard",
    round: "R32",
    matchFormat: "BestOf3",
    player1Id: "p1",
    player1Name: "Player One",
    player2Id: `opponent-${id}`,
    player2Name: `Opponent ${id}`,
    winnerId,
    score: "6-4 6-4",
    retired: false,
    walkover: false,
    cancelled: false,
    gameMarginsPlayer1: null,
    indoor: false,
    player1Rank: null,
    player2Rank: null,
    scheduledStartAt: new Date(scheduledStartAt),
    cutoffAt: new Date(new Date(scheduledStartAt).getTime() - 30 * 60_000),
    rawSource: {},
  };
}

test("reconstruction uses deterministic ID ordering for same-time rows and keeps the cutoff exclusive", () => {
  const sameTime = "2024-01-10T12:00:00.000Z";
  const index = buildMatchHistoryIndex([
    row(2, sameTime),
    row(1, sameTime),
    row(3, "2024-01-11T12:00:00.000Z"),
  ]);

  const beforeSameTime = reconstructPlayerMatchHistory(index, "p1", new Date(sameTime));
  assert.deepEqual(beforeSameTime, []);

  const afterSameTime = reconstructPlayerMatchHistory(index, "p1", new Date("2024-01-12T00:00:00.000Z"));
  assert.deepEqual(afterSameTime.map((match) => match.id), ["3", "2", "1"]);
});