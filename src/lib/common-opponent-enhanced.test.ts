import { describe, expect, it } from "vitest";
import { computeEnhancedCommonOpponentStatsFromRows } from "./common-opponent-enhanced.server";

const context = "event_level ATP 250 · date 2026-02-01 · surface Hard";

function value(stats: ReturnType<typeof computeEnhancedCommonOpponentStatsFromRows>["stats"], key: string) {
  return stats.find((s) => s.key === key)?.value;
}

describe("metric 007 — Common-Opponent Network", () => {
  const rows = [
    { player: "Player A", opponent: "Shared Opponent", date: "2026-01-10", surface: "Hard", level: "atp 250", won: "1", sets_for: "2", sets_against: "0", elo_pre: "1550", elo_post: "1560" },
    { player: "Player B", opponent: "Shared Opponent", date: "2026-01-12", surface: "Hard", level: "atp 250", won: "0", sets_for: "0", sets_against: "2", elo_pre: "1510", elo_post: "1500" },
    { player: "Shared Opponent", opponent: "Network One", date: "2025-12-01", surface: "Hard", level: "atp 250", won: "1", sets_for: "2", sets_against: "1", elo_pre: "1600", elo_post: "1610" },
    { player: "Shared Opponent", opponent: "Network Two", date: "2025-12-15", surface: "Hard", level: "atp 250", won: "0", sets_for: "1", sets_against: "2", elo_pre: "1610", elo_post: "1602" },
    // Same names on the wrong surface must not leak into the hard-court metric.
    { player: "Player A", opponent: "Clay Shared", date: "2026-01-20", surface: "Clay", level: "atp 250", won: "0", sets_for: "0", sets_against: "2" },
    { player: "Player B", opponent: "Clay Shared", date: "2026-01-20", surface: "Clay", level: "atp 250", won: "1", sets_for: "2", sets_against: "0" },
    // Same surface but wrong tournament level must not leak when level is available.
    { player: "Player A", opponent: "Challenger Shared", date: "2026-01-22", surface: "Hard", level: "challenger", won: "1", sets_for: "2", sets_against: "0" },
    { player: "Player B", opponent: "Challenger Shared", date: "2026-01-22", surface: "Hard", level: "challenger", won: "1", sets_for: "2", sets_against: "1" },
  ];

  it("keeps P1/P2 orientation and does not cross-wire the shared result", () => {
    const a = computeEnhancedCommonOpponentStatsFromRows(rows as any, "Player A", "Player B", context);
    const b = computeEnhancedCommonOpponentStatsFromRows(rows as any, "Player B", "Player A", context);

    expect(value(a.stats, "direct_common_opponents")).toBe(1);
    expect(value(b.stats, "direct_common_opponents")).toBe(1);
    expect(value(a.stats, "common_opponent_wins")).toBe(1);
    expect(value(a.stats, "common_opponent_losses")).toBe(0);
    expect(value(b.stats, "common_opponent_wins")).toBe(0);
    expect(value(b.stats, "common_opponent_losses")).toBe(1);
    expect(value(a.stats, "common_opponent_win_pct")).toBe(100);
    expect(value(b.stats, "common_opponent_win_pct")).toBe(0);
  });

  it("applies same-surface and tournament-level filters only from explicit fields", () => {
    const a = computeEnhancedCommonOpponentStatsFromRows(rows as any, "Player A", "Player B", context);
    expect(value(a.stats, "surface_matched_common_opponents")).toBe(1);
    expect(value(a.stats, "tournament_level_matched_common_opponents")).toBe(1);
    expect(a.coverage.surfaceMatching).toBe(true);
    expect(a.coverage.tournamentLevelMatching).toBe(true);
  });

  it("classifies scoreline evidence as set-only and reconstructs a real two-hop chain", () => {
    const a = computeEnhancedCommonOpponentStatsFromRows(rows as any, "Player A", "Player B", context);
    expect(a.coverage.scorelineComparison).toBe("SETS_ONLY");
    expect(a.coverage.transitiveChains).toBe(true);
    expect(value(a.stats, "common_opponent_weighted_set_margin")).toBe(2);
    expect(value(a.stats, "common_opponent_second_degree_strength_pct")).toBe(50);
  });

  it("does not pretend tournament-level matching exists when source rows lack a level field", () => {
    const noLevel = rows.map(({ level: _level, ...r }) => r);
    const a = computeEnhancedCommonOpponentStatsFromRows(noLevel as any, "Player A", "Player B", context);
    expect(a.coverage.tournamentLevelMatching).toBe(false);
    expect(value(a.stats, "tournament_level_matched_common_opponents")).toBeUndefined();
  });

  it("persists source/sample/treatment provenance on every reconstructed value", () => {
    const a = computeEnhancedCommonOpponentStatsFromRows(rows as any, "Player A", "Player B", context);
    expect(a.stats.length).toBeGreaterThan(0);
    for (const stat of a.stats) {
      expect(stat.player).toBe("Player A");
      expect(stat.origin).toBe("RECONSTRUCTED");
      expect(stat.sample).toBeGreaterThan(0);
      expect(stat.sources[0]?.source_name).toContain("PredixSport");
      expect(stat.sources[0]?.url).toContain("kaggle.com/datasets/predixsport");
    }
  });
});
