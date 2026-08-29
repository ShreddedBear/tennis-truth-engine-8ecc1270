import { describe, expect, it } from "vitest";
import { replayElo, type HistoryLane } from "./task18c-rank-form-workload";

function lane(entries: Record<string, unknown[][]>): HistoryLane {
  return entries as unknown as HistoryLane;
}

// This module's leakage safety rests entirely on replayElo/laneMatchesBefore
// (task18c-rank-form-workload.ts), the same leakage-safe primitive
// #031/#036/#041/#045 already rely on and already have their own dedicated
// leakage tests for. This test re-confirms strictly-before-asOfDate
// filtering directly at that primitive, in the same tournament-labeled
// shape this module actually consumes (perspectives with a tournament
// field), rather than assuming the shared primitive's guarantee transfers
// without verification.
describe("metric #020 leakage safety (via replayElo's own strictly-before-asOfDate filtering)", () => {
  it("never includes a match dated on or after asOfDate", () => {
    const l = lane({
      "player a": [
        ["2024-01-01", "t1", "hard", "Player B", 1, "", "src"], // before cutoff
        ["2024-06-01", "t2", "hard", "Player C", 1, "", "src"], // ON cutoff -- excluded
      ],
      "player b": [["2024-01-01", "t1", "hard", "Player A", 0, "", "src"]],
      "player c": [["2024-06-01", "t2", "hard", "Player A", 0, "", "src"]],
    });
    const replay = replayElo(l, "2024-06-01");
    const perspectives = replay.perspectives.filter(p => p.player === "player a");
    expect(perspectives).toHaveLength(1);
    expect(perspectives[0].date).toBe("2024-01-01");
  });
});
