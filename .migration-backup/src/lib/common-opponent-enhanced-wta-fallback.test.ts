import { describe, expect, it, vi } from "vitest";
import type { RepositoryResultsObservation } from "./repository-results-history.server";

// Live production finding: getEnhancedCommonOpponentStats (feeding metrics 007 and 080)
// only ever read data/public/predixsport/atp/atp_elo_matches.csv, so every WTA match got
// zero common-opponent evidence here -- not because common opponents don't exist, but
// because this producer never looked anywhere else. repository-results-history.server.ts
// already covers all four tour families uniformly (027/029/031/045 already rely on it).
// This guards the fallback: when the ATP-only CSV has nothing for either player, real
// repository rows must be used, converted into the same flat shape the existing (already
// tested) pure computation already understands -- no changes to that computation itself.
function row(player: string, opponent: string, event_date: string, surface: string, winner: string, sets_for: number, sets_against: number): RepositoryResultsObservation {
  return {
    source_id: "wta", source_name: "Repository WTA_MAIN history", source_url: null,
    player_name: player, opponent_name: opponent, tournament: "Test Open", event_date, surface,
    observation_type: "MATCH_RESULT_OR_SCHEDULE", observation_key: "match_record",
    text_value: "", sample_label: null,
    raw_payload: { winner, round: "R32", tour_family: "WTA_MAIN", repository_history: true, history_detail: { sets_for, sets_against } },
    provenance: {},
  };
}

const P1 = "Fictional Wta Player Alpha";
const P2 = "Fictional Wta Player Beta";
const SHARED_OPPONENT = "Fictional Wta Shared Opponent";

vi.mock("./repository-results-history.server", () => ({
  repositoryResultsRows: vi.fn((player: string) => {
    if (player === P1) return [row(P1, SHARED_OPPONENT, "2026-01-10", "hard", P1, 2, 0)];
    if (player === P2) return [row(P2, SHARED_OPPONENT, "2026-02-05", "hard", SHARED_OPPONENT, 0, 2)];
    return [];
  }),
}));

describe("getEnhancedCommonOpponentStats WTA repository fallback (real production gap, mocked repository data)", () => {
  it("recovers real common-opponent stats for WTA players the ATP-only CSV has never heard of", async () => {
    const { getEnhancedCommonOpponentStats } = await import("./common-opponent-enhanced.server");
    const stats = getEnhancedCommonOpponentStats(P1, P2, "date 2026-03-01 women");
    const byKey = Object.fromEntries(stats.map((s) => [s.key, s]));
    expect(byKey.direct_common_opponents).toBeDefined();
    expect(byKey.direct_common_opponents!.value).toBe(1);
    expect(byKey.common_opponent_wins!.value).toBe(1);
    expect(byKey.common_opponent_losses!.value).toBe(0);
    expect(byKey.common_opponent_win_pct!.value).toBe(100);
  });

  it("attributes repository-fallback stats to the repository source, never mislabeled as PredixSport", async () => {
    const { getEnhancedCommonOpponentStats } = await import("./common-opponent-enhanced.server");
    const stats = getEnhancedCommonOpponentStats(P1, P2, "date 2026-03-01 women");
    for (const s of stats) {
      expect(s.sources[0].source_name).not.toContain("PredixSport");
      expect(s.sources[0].source_name).toContain("Repository");
    }
  });

  it("never fabricates opponent-strength-weighting or transitive-chain stats from repository data (that source lacks elo_pre/elo_post)", async () => {
    const { getEnhancedCommonOpponentStats } = await import("./common-opponent-enhanced.server");
    const stats = getEnhancedCommonOpponentStats(P1, P2, "date 2026-03-01 women");
    expect(stats.find((s) => s.key === "common_opponent_strength_weighted_win_pct")).toBeUndefined();
    expect(stats.find((s) => s.key === "common_opponent_second_degree_strength_pct")).toBeUndefined();
  });

  it("returns nothing when the tour family can't be classified from context (fails closed, never guesses)", async () => {
    const { getEnhancedCommonOpponentStats } = await import("./common-opponent-enhanced.server");
    expect(getEnhancedCommonOpponentStats(P1, P2, "date 2026-03-01")).toEqual([]);
  });

  it("returns nothing for players with no repository rows either (a genuine absence, not fabricated)", async () => {
    const { getEnhancedCommonOpponentStats } = await import("./common-opponent-enhanced.server");
    expect(getEnhancedCommonOpponentStats("Nobody One", "Nobody Two", "date 2026-03-01 women")).toEqual([]);
  });
});
