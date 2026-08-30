import { describe, expect, it } from "vitest";
import { computeSlowStartRecovery, type IndexRow } from "./audit-metric-026-early-warning-slow-start";
import type { HistoryLane } from "./task18c-rank-form-workload";

// Metric #026's cross-match aggregation makes real live BSD PBP fetches (unlike #051's
// pure static-index replay), so this leakage test cannot run against the real generated
// index the way #051's does -- it instead uses computeSlowStartRecovery's own
// historyLaneOverride/indexRowsOverride injection points (see the module's header comment
// on testability) with a synthetic fixture, proving the SAME strictly-before-asOfDate
// contract at both of the two places it must hold: the match-outcome ground truth
// (laneMatchesBefore, already leakage-safe by construction) AND this module's own PBP
// index-row date filter.
const SLOW_START_PAYLOAD = { sets: [{ games: [
  { server: "player1", points: [{ winner: "player2" }, { winner: "player2" }, { winner: "player2" }, { winner: "player2" }] },
  { server: "player2", points: [{ winner: "player2" }, { winner: "player2" }, { winner: "player2" }, { winner: "player2" }] },
  { server: "player1", points: [{ winner: "player2" }, { winner: "player2" }, { winner: "player2" }, { winner: "player2" }] },
  { server: "player2", points: [{ winner: "player2" }, { winner: "player2" }, { winner: "player2" }, { winner: "player2" }] },
] }] };

function lane(rows: unknown[][]): HistoryLane {
  return { "player a": rows } as unknown as HistoryLane;
}

// 6 slow-start matches strictly before the boundary date, plus one on the boundary date
// itself and one after it -- both of which must be excluded when asOfDate === boundary.
const BOUNDARY = "2024-03-01";
function scenario() {
  const before = Array.from({ length: 6 }, (_, i) => ({ id: `before${i}`, date: `2024-01-0${i + 1}`, opp: `Opp Before ${i}` }));
  const onBoundary = { id: "on-boundary", date: BOUNDARY, opp: "Opp Boundary" };
  const after = { id: "after", date: "2024-03-02", opp: "Opp After" };
  const all = [...before, onBoundary, after];
  const historyRows = all.map(m => [m.date, "Test Open", "hard", m.opp, 1, "R32", "src"]);
  const indexRows: IndexRow[] = all.map(m => ({ match_id: m.id, date: m.date, players: ["Player A", m.opp], tournament: "Test Open", circuit: "ATP", category: "ATP", structurally_present: true }));
  return { historyRows, indexRows, before, onBoundary, after };
}

describe("metric #026 cross-match aggregation — leakage test", () => {
  it("excludes both the on-the-day match and anything after it (strictBefore, not on-or-before)", async () => {
    const { historyRows, indexRows } = scenario();
    const calls: string[] = [];
    const result = await computeSlowStartRecovery({
      player: "Player A", lane: "ATP_MAIN", asOfDate: BOUNDARY,
      historyLaneOverride: lane(historyRows),
      indexRowsOverride: indexRows,
      fetchPbp: async ({ matchId }) => { calls.push(String(matchId)); return SLOW_START_PAYLOAD; },
    });
    expect(calls).not.toContain("on-boundary");
    expect(calls).not.toContain("after");
    expect(calls.sort()).toEqual(["before0", "before1", "before2", "before3", "before4", "before5"]);
    expect(result.status).toBe("GO");
    if (result.status !== "GO") throw new Error("unreachable");
    expect(result.value.pbp_covered_matches_examined).toBe(6);
  });

  it("includes the boundary match once asOfDate moves strictly after it", async () => {
    const { historyRows, indexRows } = scenario();
    const calls: string[] = [];
    const result = await computeSlowStartRecovery({
      player: "Player A", lane: "ATP_MAIN", asOfDate: "2024-03-02", // strictly after BOUNDARY, still before "after" (2024-03-02 itself excluded too since laneMatchesBefore/index filters are also strict)
      historyLaneOverride: lane(historyRows),
      indexRowsOverride: indexRows,
      fetchPbp: async ({ matchId }) => { calls.push(String(matchId)); return SLOW_START_PAYLOAD; },
    });
    expect(calls).toContain("on-boundary");
    expect(calls).not.toContain("after"); // "after" is dated the same as this asOfDate -- still excluded (strictBefore)
    if (result.status === "GO") expect(result.value.pbp_covered_matches_examined).toBe(7);
  });

  it("excludes everything when asOfDate is years before any recorded history (no future/contemporary leakage at all)", async () => {
    const { historyRows, indexRows } = scenario();
    const calls: string[] = [];
    const result = await computeSlowStartRecovery({
      player: "Player A", lane: "ATP_MAIN", asOfDate: "2024-01-01",
      historyLaneOverride: lane(historyRows),
      indexRowsOverride: indexRows,
      fetchPbp: async ({ matchId }) => { calls.push(String(matchId)); return SLOW_START_PAYLOAD; },
    });
    expect(calls).toEqual([]);
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });
});
