import { describe, expect, it } from "vitest";
import { replayElo, type HistoryLane } from "./task18c-rank-form-workload";
import { computeLossAutopsyFromPerspectives } from "./audit-metric-036-loss-autopsy";

// HistoryLane entries: [date, tournament, surface, opponent, won(0/1), round, source, detail]
function lane(entries: Record<string, unknown[][]>): HistoryLane {
  return entries as unknown as HistoryLane;
}

describe("metric #036 leakage safety", () => {
  it("never includes a loss dated on or after asOfDate", () => {
    const l = lane({
      "player a": [
        ["2024-01-01", "t1", "hard", "Player B", 0, "", "src"], // before cutoff -- must be included
        ["2024-06-01", "t2", "hard", "Player C", 0, "", "src"], // ON cutoff -- must be excluded
        ["2024-07-01", "t3", "hard", "Player D", 0, "", "src"], // after cutoff -- must be excluded
      ],
      "player b": [["2024-01-01", "t1", "hard", "Player A", 1, "", "src"]],
      "player c": [["2024-06-01", "t2", "hard", "Player A", 1, "", "src"]],
      "player d": [["2024-07-01", "t3", "hard", "Player A", 1, "", "src"]],
    });
    const replay = replayElo(l, "2024-06-01");
    const chronologicalLosses = replay.perspectives
      .filter(p => p.player === "player a" && !p.won)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(p => ({ date: p.date, opponent: p.opponent, pre_elo: p.pre_elo, opponent_pre_elo: p.opponent_pre_elo }));
    expect(chronologicalLosses).toHaveLength(1);
    expect(chronologicalLosses[0].date).toBe("2024-01-01");

    const result = computeLossAutopsyFromPerspectives(chronologicalLosses, null);
    expect(result.trailing_losses_used).toBe(1);
    expect(result.losses.map(l => l.date)).toEqual(["2024-01-01"]);
  });

  it("a later asOfDate reveals strictly more (never fewer, never different-shaped) prior losses -- monotonic history growth", () => {
    const l = lane({
      "player a": [
        ["2024-01-01", "t1", "hard", "Player B", 0, "", "src"],
        ["2024-03-01", "t2", "hard", "Player C", 0, "", "src"],
        ["2024-05-01", "t3", "hard", "Player D", 0, "", "src"],
      ],
      "player b": [["2024-01-01", "t1", "hard", "Player A", 1, "", "src"]],
      "player c": [["2024-03-01", "t2", "hard", "Player A", 1, "", "src"]],
      "player d": [["2024-05-01", "t3", "hard", "Player A", 1, "", "src"]],
    });
    const early = replayElo(l, "2024-02-01").perspectives.filter(p => p.player === "player a" && !p.won);
    const late = replayElo(l, "2024-06-01").perspectives.filter(p => p.player === "player a" && !p.won);
    expect(early).toHaveLength(1);
    expect(late).toHaveLength(3);
    // Every loss visible at the earlier date is still present, unchanged, at the later date.
    expect(late.find(p => p.date === early[0].date)?.pre_elo).toBe(early[0].pre_elo);
  });
});
