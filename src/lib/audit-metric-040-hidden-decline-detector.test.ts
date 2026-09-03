import { describe, expect, it } from "vitest";
import { computeHiddenDecline, MIN_MATCHES_EXAMINED, type IndexRow } from "./audit-metric-040-hidden-decline-detector";
import type { HistoryLane } from "./task18c-rank-form-workload";

type Pt = { winner: "player1" | "player2"; ace?: boolean; doubleFault?: boolean };
function game(server: "player1" | "player2", winner: "player1" | "player2", points: Pt[]) {
  return { server, winner, points };
}
/** Player1 always serves. `serverWinFrac` of points go to the server, `acesPerGame` of those are explicit aces, over `games` service games of `pointsPerGame` points each. */
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

// 20 matches: 10 "earlier" (strong: 80% service points won, 2 aces/game) + 10 "recent" (weak: 40% service points won, 0 aces/game).
// 6 games x 10 points/game per match => 60 service points per match, well above MIN_N_PER_HALF=30 pooled per half.
function buildScenario() {
  const specs: Array<{ id: string; date: string; strong: boolean }> = [];
  for (let i = 0; i < 10; i++) specs.push({ id: `early${i}`, date: `2024-01-${String(i + 1).padStart(2, "0")}`, strong: true });
  for (let i = 0; i < 10; i++) specs.push({ id: `recent${i}`, date: `2024-03-${String(i + 1).padStart(2, "0")}`, strong: false });
  const historyRows = specs.map(s => [s.date, "Test Open", "hard", `Opp ${s.id}`, 1, "R32", "src"]);
  const indexRows: IndexRow[] = specs.map(s => ({ match_id: s.id, date: s.date, players: ["Player A", `Opp ${s.id}`], tournament: "Test Open", circuit: "ATP", category: "ATP", structurally_present: true }));
  const payloadById = new Map(specs.map(s => [s.id, s.strong ? makePayload(6, 10, 0.8, 2) : makePayload(6, 10, 0.4, 0)]));
  return { historyRows, indexRows, payloadById, specs };
}

describe("metric #040 — Hidden Decline Detector", () => {
  it("flags a real DECLINE on ace rate, service-points-won, and hold% when the recent half is genuinely weaker", async () => {
    const { historyRows, indexRows, payloadById } = buildScenario();
    const result = await computeHiddenDecline({
      player: "Player A", lane: "ATP_MAIN", asOfDate: "2024-06-01",
      historyLaneOverride: lane(historyRows),
      indexRowsOverride: indexRows,
      fetchPbp: async ({ matchId }) => payloadById.get(String(matchId)) ?? null,
    });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") throw new Error("unreachable");
    expect(result.value.matches_examined).toBe(20);
    const byDim = Object.fromEntries(result.value.dimensions.map(d => [d.dimension, d]));
    expect(byDim.ace_rate_pct.verdict).toBe("DECLINE");
    expect(byDim.service_points_won_pct.verdict).toBe("DECLINE");
    expect(byDim.hold_pct.verdict).toBe("DECLINE");
    expect(byDim.ace_rate_pct.earlier_rate_pct).toBeGreaterThan(byDim.ace_rate_pct.recent_rate_pct!);
    // Player1 never returns in this fixture (always server), so return/break dimensions have no sample -- must fail closed, not crash or fabricate.
    expect(byDim.return_points_won_pct.verdict).toBe("INSUFFICIENT_SAMPLE");
    expect(byDim.break_points_converted_pct.verdict).toBe("INSUFFICIENT_SAMPLE");
  });

  it("reports NOT_ENOUGH_DATA when fewer than the minimum number of PBP-covered matches are found", async () => {
    const { historyRows, indexRows, payloadById, specs } = buildScenario();
    const fewSpecs = specs.slice(0, MIN_MATCHES_EXAMINED - 1);
    const result = await computeHiddenDecline({
      player: "Player A", lane: "ATP_MAIN", asOfDate: "2024-06-01",
      historyLaneOverride: lane(historyRows),
      indexRowsOverride: indexRows.filter(r => fewSpecs.some(s => s.id === r.match_id)),
      fetchPbp: async ({ matchId }) => payloadById.get(String(matchId)) ?? null,
    });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });

  it("WTA_CHALLENGER is not an eligible lane (no per-game chronology in that lane's approved index)", async () => {
    const result = await computeHiddenDecline({ player: "Anyone", lane: "WTA_CHALLENGER", asOfDate: "2024-06-01" });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });

  it("rejects a date before the lane's confirmed BSD PBP coverage start", async () => {
    const result = await computeHiddenDecline({ player: "Anyone", lane: "ATP_MAIN", asOfDate: "2020-01-01" });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });
});
