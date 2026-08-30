import { describe, expect, it } from "vitest";
import { computeSlowStartRecovery, MIN_MATCHES_EXAMINED, MIN_SLOW_START_INSTANCES, type IndexRow } from "./audit-metric-026-early-warning-slow-start";
import { deriveOpeningWindowProfile } from "./pbp-score-state-recovery";
import type { HistoryLane } from "./task18c-rank-form-workload";

// Player A is always "player1" in every synthetic PBP payload below, and always
// row.players[0] in the matching index row, so side resolution is trivial to reason about.
const SLOW_START_PAYLOAD = { sets: [{ games: [
  { server: "player1", points: [{ winner: "player2" }, { winner: "player2" }, { winner: "player2" }, { winner: "player2" }] },
  { server: "player2", points: [{ winner: "player2" }, { winner: "player2" }, { winner: "player2" }, { winner: "player2" }] },
  { server: "player1", points: [{ winner: "player2" }, { winner: "player2" }, { winner: "player2" }, { winner: "player2" }] },
  { server: "player2", points: [{ winner: "player2" }, { winner: "player2" }, { winner: "player2" }, { winner: "player2" }] },
] }] };
const NON_SLOW_START_PAYLOAD = { sets: [{ games: [
  { server: "player1", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
  { server: "player2", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
  { server: "player1", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
  { server: "player2", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
] }] };

// Sanity-check the two fixtures actually produce the slow_start_flag this test suite
// assumes, independent of computeSlowStartRecovery's own logic.
describe("fixture sanity", () => {
  it("SLOW_START_PAYLOAD flags player1 as a slow start (down 0-4 after 4 games)", () => {
    const r = deriveOpeningWindowProfile(SLOW_START_PAYLOAD);
    expect(r.valid).toBe(true);
    expect(r.derived.player1!.slow_start_flag).toBe(true);
  });
  it("NON_SLOW_START_PAYLOAD does not flag player1 as a slow start", () => {
    const r = deriveOpeningWindowProfile(NON_SLOW_START_PAYLOAD);
    expect(r.valid).toBe(true);
    expect(r.derived.player1!.slow_start_flag).toBe(false);
  });
});

function lane(rows: unknown[][]): HistoryLane {
  return { "player a": rows } as unknown as HistoryLane;
}

// 8 PBP-covered matches before asOfDate: 6 slow starts (4 won, 2 lost) + 2 non-slow-starts
// (1 won, 1 lost) -- see this file's own comments below for the exact expected numbers.
function buildScenario() {
  const specs = [
    { id: "m1", date: "2024-01-05", opp: "Player B1", won: 1, slow: true },
    { id: "m2", date: "2024-01-12", opp: "Player B2", won: 1, slow: true },
    { id: "m3", date: "2024-01-19", opp: "Player B3", won: 1, slow: true },
    { id: "m4", date: "2024-01-26", opp: "Player B4", won: 1, slow: true },
    { id: "m5", date: "2024-02-02", opp: "Player B5", won: 0, slow: true },
    { id: "m6", date: "2024-02-09", opp: "Player B6", won: 0, slow: true },
    { id: "m7", date: "2024-02-16", opp: "Player B7", won: 1, slow: false },
    { id: "m8", date: "2024-02-23", opp: "Player B8", won: 0, slow: false },
  ];
  const historyRows = specs.map(s => [s.date, "Test Open", "hard", s.opp, s.won, "R32", "src"]);
  const indexRows: IndexRow[] = specs.map(s => ({ match_id: s.id, date: s.date, players: ["Player A", s.opp], tournament: "Test Open", circuit: "ATP", category: "ATP", structurally_present: true }));
  const payloadById = new Map(specs.map(s => [s.id, s.slow ? SLOW_START_PAYLOAD : NON_SLOW_START_PAYLOAD]));
  return { historyRows, indexRows, payloadById, specs };
}

describe("metric #026 cross-match slow-start-recovery aggregation", () => {
  it("computes the recovery rate only from real, cross-referenced PBP-covered matches with a known outcome", async () => {
    const { historyRows, indexRows, payloadById } = buildScenario();
    const calls: string[] = [];
    const result = await computeSlowStartRecovery({
      player: "Player A", lane: "ATP_MAIN", asOfDate: "2024-06-01",
      historyLaneOverride: lane(historyRows),
      indexRowsOverride: indexRows,
      fetchPbp: async ({ matchId }) => { calls.push(String(matchId)); return payloadById.get(String(matchId)) ?? null; },
    });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") throw new Error("unreachable");
    expect(result.value.pbp_covered_matches_examined).toBe(8);
    expect(result.value.slow_start_matches).toBe(6);
    expect(result.value.slow_start_matches_won).toBe(4);
    expect(result.value.slow_start_recovery_rate_pct).toBeCloseTo(66.7, 1);
    expect(result.value.non_slow_start_win_rate_pct).toBeCloseTo(50, 1);
    expect(calls.sort()).toEqual(["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]);
  });

  it("reports NOT_ENOUGH_DATA with the real counts when slow-start instances fall below the documented minimum", async () => {
    const { indexRows, payloadById, specs } = buildScenario();
    // Drop 3 of the 6 slow-start matches (m1,m2,m5) so only 3 remain -- below
    // MIN_SLOW_START_INSTANCES.
    const keepIds = new Set(["m3", "m4", "m6", "m7", "m8"]);
    const filteredRows = specs.filter(s => keepIds.has(s.id)).map(s => [s.date, "Test Open", "hard", s.opp, s.won, "R32", "src"]);
    const filteredIndex = indexRows.filter(r => keepIds.has(String(r.match_id)));
    const result = await computeSlowStartRecovery({
      player: "Player A", lane: "ATP_MAIN", asOfDate: "2024-06-01",
      historyLaneOverride: lane(filteredRows),
      indexRowsOverride: filteredIndex,
      fetchPbp: async ({ matchId }) => payloadById.get(String(matchId)) ?? null,
    });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
    if (result.status !== "NOT_ENOUGH_DATA") throw new Error("unreachable");
    expect(result.n).toBe(5);
    expect(result.reason).toContain(String(MIN_SLOW_START_INSTANCES));
    expect(result.reason).toContain(String(MIN_MATCHES_EXAMINED));
  });

  it("never fabricates a match outcome when a PBP-covered candidate has no cross-referenced ground-truth result", async () => {
    const { historyRows, indexRows, payloadById } = buildScenario();
    // Drop m8's history row (so its winner is unknown) but keep its index row -- it must
    // be silently skipped, not guessed, and must not be counted toward examined matches.
    const historyWithoutM8 = historyRows.filter((_, i) => i !== 7);
    const result = await computeSlowStartRecovery({
      player: "Player A", lane: "ATP_MAIN", asOfDate: "2024-06-01",
      historyLaneOverride: lane(historyWithoutM8),
      indexRowsOverride: indexRows,
      fetchPbp: async ({ matchId }) => payloadById.get(String(matchId)) ?? null,
    });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") throw new Error("unreachable");
    expect(result.value.pbp_covered_matches_examined).toBe(7); // m8 excluded, not guessed
  });

  it("LEAKAGE: a match dated on/after asOfDate is never fetched or counted", async () => {
    const { historyRows, indexRows, payloadById } = buildScenario();
    const futureRow = ["2024-06-01", "Test Open", "hard", "Player Future", 1, "R32", "src"]; // same day as asOfDate -- excluded
    const futureIndex: IndexRow = { match_id: "future", date: "2024-06-01", players: ["Player A", "Player Future"], tournament: "Test Open", circuit: "ATP", category: "ATP", structurally_present: true };
    const calls: string[] = [];
    const result = await computeSlowStartRecovery({
      player: "Player A", lane: "ATP_MAIN", asOfDate: "2024-06-01",
      historyLaneOverride: lane([...historyRows, futureRow]),
      indexRowsOverride: [...indexRows, futureIndex],
      fetchPbp: async ({ matchId }) => { calls.push(String(matchId)); return payloadById.get(String(matchId)) ?? SLOW_START_PAYLOAD; },
    });
    expect(calls).not.toContain("future");
    expect(result.status).toBe("GO");
    if (result.status !== "GO") throw new Error("unreachable");
    expect(result.value.pbp_covered_matches_examined).toBe(8);
  });

  it("reports the WTA Challenger lane as structurally NOT_ENOUGH_DATA (no per-game chronology exists), never a fabricated aggregate", async () => {
    const result = await computeSlowStartRecovery({ player: "Player A", lane: "WTA_CHALLENGER", asOfDate: "2025-06-01" });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
    if (result.status !== "NOT_ENOUGH_DATA") throw new Error("unreachable");
    expect(result.reason).toMatch(/aggregate|chronology/i);
  });

  it("reports NOT_ENOUGH_DATA when asOfDate precedes the lane's confirmed PBP coverage start", async () => {
    const result = await computeSlowStartRecovery({ player: "Player A", lane: "ATP_CHALLENGER", asOfDate: "2024-01-01" });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
    if (result.status !== "NOT_ENOUGH_DATA") throw new Error("unreachable");
    expect(result.reason).toMatch(/coverage/i);
  });
});
