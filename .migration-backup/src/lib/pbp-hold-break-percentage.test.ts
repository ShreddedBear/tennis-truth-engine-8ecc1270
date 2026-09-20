import { describe, expect, it } from "vitest";
import { reconstructPbpScoreState } from "./pbp-score-state-recovery";

// Player1 serves and holds twice (4-love each); Player2 serves once and is
// broken (loses all 4 points to Player1). A minimal, hand-checkable fixture:
// Player1: 2/2 service games held (hold_pct=100), 1/1 return games broken
// (break_pct=100). Player2: 0/1 service games held (hold_pct=0), 0/2 return
// games broken (break_pct=0).
const payload = {
  available: true,
  sets: [{
    games: [
      { server: "player1", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
      { server: "player2", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
      { server: "player1", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
    ],
  }],
};

describe("metric 002/003 — Hold % and Break %", () => {
  it("reports Hold % (metric 002's own first bullet) from the same per-game replay, not omitted", () => {
    const r = reconstructPbpScoreState(payload);
    const p1 = r.derived.player1["002"]?.value as Record<string, unknown>;
    const p2 = r.derived.player2["002"]?.value as Record<string, unknown>;
    expect(p1.service_games).toBe(2);
    expect(p1.service_games_won).toBe(2);
    expect(p1.hold_pct).toBe(100);
    expect(p2.service_games).toBe(1);
    expect(p2.service_games_won).toBe(0);
    expect(p2.hold_pct).toBe(0);
  });

  it("reports Break % (metric 003's own first bullet) from the same per-game replay, not omitted", () => {
    const r = reconstructPbpScoreState(payload);
    const p1 = r.derived.player1["003"]?.value as Record<string, unknown>;
    const p2 = r.derived.player2["003"]?.value as Record<string, unknown>;
    expect(p1.return_games).toBe(1);
    expect(p1.return_games_won).toBe(1);
    expect(p1.break_pct).toBe(100);
    expect(p2.return_games).toBe(2);
    expect(p2.return_games_won).toBe(0);
    expect(p2.break_pct).toBe(0);
  });

  it("still keeps 002/003 treatment PARTIAL (serve-number splits remain unavailable)", () => {
    const r = reconstructPbpScoreState(payload);
    expect(r.derived.player1["002"]?.treatment).toBe("PARTIAL");
    expect(r.derived.player1["003"]?.treatment).toBe("PARTIAL");
  });
});
