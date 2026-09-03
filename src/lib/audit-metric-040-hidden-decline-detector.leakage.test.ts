import { describe, expect, it } from "vitest";
import { computeHiddenDecline, type IndexRow } from "./audit-metric-040-hidden-decline-detector";
import type { HistoryLane } from "./task18c-rank-form-workload";

type Pt = { winner: "player1" | "player2"; ace?: boolean };
function game(server: "player1" | "player2", winner: "player1" | "player2", points: Pt[]) {
  return { server, winner, points };
}
function makePayload(games: number, pointsPerGame: number, serverWinFrac: number, acesPerGame: number) {
  const gs = [];
  for (let g = 0; g < games; g++) {
    const points: Pt[] = [];
    const serverWins = Math.round(pointsPerGame * serverWinFrac);
    for (let p = 0; p < pointsPerGame; p++) {
      const winner: "player1" | "player2" = p < serverWins ? "player1" : "player2";
      points.push({ winner, ace: winner === "player1" && p < acesPerGame });
    }
    gs.push(game("player1", serverWins > pointsPerGame / 2 ? "player1" : "player2", points));
  }
  return { sets: [{ games: gs }] };
}
function lane(rows: unknown[][]): HistoryLane {
  return { "player a": rows } as unknown as HistoryLane;
}

describe("metric #040 leakage safety", () => {
  it("never uses a PBP-covered match dated on or after asOfDate, even if the index row and fetcher would supply one", async () => {
    const specs: Array<{ id: string; date: string }> = [];
    for (let i = 0; i < 10; i++) specs.push({ id: `early${i}`, date: `2024-01-${String(i + 1).padStart(2, "0")}` });
    for (let i = 0; i < 10; i++) specs.push({ id: `recent${i}`, date: `2024-03-${String(i + 1).padStart(2, "0")}` });
    const historyRows = specs.map(s => [s.date, "Test Open", "hard", `Opp ${s.id}`, 1, "R32", "src"]);
    const indexRows: IndexRow[] = specs.map(s => ({ match_id: s.id, date: s.date, players: ["Player A", `Opp ${s.id}`], tournament: "Test Open", circuit: "ATP", category: "ATP", structurally_present: true }));
    const payloadById = new Map(specs.map(s => [s.id, makePayload(6, 10, 0.6, 1)])); // uniform performance for all real matches

    // A future match dated exactly on asOfDate, with an extreme, easily-detectable payload that must never be counted.
    const asOfDate = "2024-06-01";
    const futureId = "future-leak";
    historyRows.push([asOfDate, "Test Open", "hard", "Future Opp", 1, "R32", "src"]);
    indexRows.push({ match_id: futureId, date: asOfDate, players: ["Player A", "Future Opp"], tournament: "Test Open", circuit: "ATP", category: "ATP", structurally_present: true });
    payloadById.set(futureId, makePayload(6, 10, 0.01, 0)); // wildly different from the uniform baseline -- would visibly skew the recent half if it leaked in

    const calls: string[] = [];
    const result = await computeHiddenDecline({
      player: "Player A", lane: "ATP_MAIN", asOfDate,
      historyLaneOverride: lane(historyRows),
      indexRowsOverride: indexRows,
      fetchPbp: async ({ matchId }) => { calls.push(String(matchId)); return payloadById.get(String(matchId)) ?? null; },
    });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") throw new Error("unreachable");
    expect(result.value.matches_examined).toBe(20); // not 21
    expect(calls).not.toContain(futureId);
    const byDim = Object.fromEntries(result.value.dimensions.map(d => [d.dimension, d]));
    // Uniform performance across all real matches (0.6 service-points-won rate throughout) means earlier and recent
    // halves should be statistically indistinguishable -- a leaked-in near-zero match would have pulled recent well below earlier.
    expect(byDim.service_points_won_pct.verdict).toBe("NOT_STATISTICALLY_DISTINGUISHABLE");
  });
});
