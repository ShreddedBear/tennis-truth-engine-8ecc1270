import { describe, expect, it, vi } from "vitest";

// Real-shaped fixture matching the actual generated index's bucket schema
// (data/generated/tennis-runtime-index.json): {name, overall:{n,w,l,...,recent:
// [[date,won,surface,eloAfter,opponent,tournament],...]}, surface:{...}}.
const PLAYER_NAME = "Fictional Runtime Index Player";
function recentRow(date: string, won: 0 | 1, elo: number): [string, number, string, number, string, string] {
  return [date, won, "hard", elo, "Opponent", "test_event"];
}
const RECENT = [
  recentRow("2025-01-01", 1, 1500),
  recentRow("2025-02-01", 1, 1510),
  recentRow("2025-03-01", 0, 1495),
  recentRow("2025-04-01", 1, 1505),
  recentRow("2025-05-01", 1, 1520),
  recentRow("2025-06-01", 1, 1530), // current streak: 3 wins in a row
];
const LOSING_PLAYER = "Fictional Runtime Index Losing Player";
const LOSING_RECENT = [
  recentRow("2025-01-01", 1, 1500),
  recentRow("2025-02-01", 0, 1490),
  recentRow("2025-03-01", 0, 1480),
]; // current streak: 2 losses in a row

vi.mock("./runtime-tennis-index-data.server", () => ({
  loadRuntimeIndex: () => ({
    ATP: {},
    WTA: {
      [PLAYER_NAME.toLowerCase()]: {
        name: PLAYER_NAME,
        overall: { n: 6, w: 4, l: 2, sets: 12, setsWon: 8, straightWins: 3, deciding: 1, decidingWins: 1, elo: 1530, peak: 1530, lastDate: "2025-06-01", recent: RECENT },
        surface: {},
      },
      [LOSING_PLAYER.toLowerCase()]: {
        name: LOSING_PLAYER,
        overall: { n: 3, w: 1, l: 2, sets: 6, setsWon: 2, straightWins: 0, deciding: 0, decidingWins: 0, elo: 1480, peak: 1500, lastDate: "2025-03-01", recent: LOSING_RECENT },
        surface: {},
      },
    },
  }),
}));

// Live production finding: getRuntimeHistoricalStats never computed a win/loss streak
// even though its own `recent` array (chronologically ordered [date,won,...] per match)
// already has everything needed -- the exact same information
// predixsport-recent.server.ts's ATP-only CSV path already uses for this. This guards the
// fix, matching predixsport-recent.server.ts's own streak algorithm exactly.
describe("getRuntimeHistoricalStats current_streak_signed / longest_win_streak_observed (real bucket shape)", () => {
  it("computes a positive signed streak for a player currently on a win streak", async () => {
    const { getRuntimeHistoricalStats } = await import("./runtime-tennis-index.server");
    const stats = getRuntimeHistoricalStats(PLAYER_NAME, "date 2025-07-01");
    const byKey = Object.fromEntries(stats.map((s) => [s.key, s.value]));
    expect(byKey.current_streak_signed).toBe(3); // won last 3 in a row
    expect(byKey.longest_win_streak_observed).toBe(3);
  });

  it("computes a negative signed streak for a player currently on a losing run", async () => {
    const { getRuntimeHistoricalStats } = await import("./runtime-tennis-index.server");
    const stats = getRuntimeHistoricalStats(LOSING_PLAYER, "date 2025-04-01");
    const byKey = Object.fromEntries(stats.map((s) => [s.key, s.value]));
    expect(byKey.current_streak_signed).toBe(-2); // lost last 2 in a row
    expect(byKey.longest_win_streak_observed).toBe(1); // the single early win
  });
});
