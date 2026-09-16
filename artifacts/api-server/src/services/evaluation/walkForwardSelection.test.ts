import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  contextRowsBeforeCutoff,
  latestTargetCutoff,
  selectWalkForwardTargets,
} from "./walkForwardSelection";
import type { HistoricalMatchContextRow } from "../historicalData/matchRecordReconstruction";

function row(id: number, start: string, cutoff: string): HistoricalMatchContextRow {
  return {
    id, provider: "test", tour: "ATP", tournamentName: "Synthetic",
    tournamentLevel: "ATP 250", surface: "Hard", round: "R32", matchFormat: "best_of_3",
    player1Id: `p${id}a`, player1Name: `P${id}A`, player2Id: `p${id}b`, player2Name: `P${id}B`,
    winnerId: `p${id}a`, score: "6-4 6-4", retired: false, walkover: false, cancelled: false,
    gameMarginsPlayer1: [], indoor: false, player1Rank: null, player2Rank: null,
    scheduledStartAt: new Date(start), cutoffAt: new Date(cutoff), rawSource: {},
  };
}

describe("walk-forward target/context selection", () => {
  it("selects scoped targets while retaining prior unlisted context", () => {
    const prior = row(1, "2024-01-01T10:00:00Z", "2024-01-01T09:30:00Z");
    const target = row(2, "2024-01-02T10:00:00Z", "2024-01-02T09:30:00Z");
    const targets = selectWalkForwardTargets([target, prior], { matchIds: [2] });
    assert.deepEqual(targets.map((match) => match.id), [2]);
    assert.deepEqual(contextRowsBeforeCutoff([prior, target], target.cutoffAt).map((match) => match.id), [1]);
  });

  it("excludes future context rows at the target cutoff", () => {
    const prior = row(1, "2024-01-01T10:00:00Z", "2024-01-01T09:30:00Z");
    const sameBoundary = row(2, "2024-01-02T09:30:00Z", "2024-01-02T09:30:00Z");
    const future = row(3, "2024-01-03T10:00:00Z", "2024-01-03T09:30:00Z");
    assert.deepEqual(
      contextRowsBeforeCutoff([prior, sameBoundary, future], sameBoundary.cutoffAt).map((match) => match.id),
      [1],
    );
  });

  it("keeps fold chronology independent of target-ID order", () => {
    const late = row(20, "2024-01-03T10:00:00Z", "2024-01-03T09:30:00Z");
    const early = row(10, "2024-01-02T10:00:00Z", "2024-01-02T09:30:00Z");
    const targets = selectWalkForwardTargets([late, early], { matchIds: [20, 10] });
    assert.deepEqual(targets.map((match) => match.id), [10, 20]);
    assert.equal(latestTargetCutoff(targets)?.toISOString(), "2024-01-03T09:30:00.000Z");
  });
});