import { describe, expect, it, vi } from "vitest";
import type { RepositoryResultsObservation } from "./repository-results-history.server";

// Live production finding: metrics 010/011 gate on a narrow strict field set
// (straight_set_match_win_pct, performance_variance, close_match_dependency_pct,
// deciding_tiebreak_win_reliance_pct -- see completion-sweep-research.server.ts's
// STRICT_FIELDS) that only datahub-atp-score-profile.server.ts computes, and that
// producer is ATP-only. This guards the fix: repository rows (which cover WTA_MAIN and
// ATP_CHALLENGER with real per-set scores) get converted into the exact synthetic row
// shape that producer's own (unchanged, already-tested) formula function consumes.
function row(player: string, opponent: string, event_date: string, winner: string, set_scores: Array<[number, number]>): RepositoryResultsObservation {
  return {
    source_id: "wta", source_name: "Repository WTA_MAIN history", source_url: null,
    player_name: player, opponent_name: opponent, tournament: "Test Open", event_date, surface: "hard",
    observation_type: "MATCH_RESULT_OR_SCHEDULE", observation_key: "match_record",
    text_value: "", sample_label: null,
    raw_payload: { winner, round: "R32", tour_family: "WTA_MAIN", repository_history: true, history_detail: { set_scores } },
    provenance: {},
  };
}

const PLAYER = "Fictional Wta Main Player";
const OPP1 = "Fictional Opponent One";
const OPP2 = "Fictional Opponent Two";
const OPP3 = "Fictional Opponent Three";

// Note: computeHistoricalScoreProfileStatsFromRows (the reused, already-tested ATP
// formula function) filters by YEAR strictly before the cutoff year, not exact date --
// this is existing behavior in the producer being reused, not something this bridge
// introduces. Test match dates are therefore in the year before the query cutoff.
vi.mock("./repository-results-history.server", () => ({
  repositoryResultsRows: vi.fn((player: string) => {
    if (player !== PLAYER) return [];
    return [
      // Straight-set win: player wins 6-4, 6-3 (won both sets, no deciding set).
      row(PLAYER, OPP1, "2025-01-05", PLAYER, [[6, 4], [6, 3]]),
      // Three-set win (deciding set, no tiebreak): player loses set 1, wins sets 2/3.
      row(PLAYER, OPP2, "2025-01-12", PLAYER, [[4, 6], [6, 3], [7, 5]]),
      // Straight-set loss.
      row(PLAYER, OPP3, "2025-01-19", OPP3, [[3, 6], [4, 6]]),
    ];
  }),
}));

describe("getRepositoryScoreProfileStats (real formula, WTA_MAIN via repository fallback)", () => {
  it("computes straight_set_match_win_pct over ALL matches, matching the ATP producer's own denominator convention", async () => {
    const { getRepositoryScoreProfileStats } = await import("./historical-score-profile-repository-bridge.server");
    const stats = getRepositoryScoreProfileStats(PLAYER, "date 2026-02-01 women");
    const byKey = Object.fromEntries(stats.map((s) => [s.key, s.value]));
    // 1 straight-set win out of 3 parsed matches (the deciding-set win and the loss are not straight-set wins).
    expect(byKey.straight_set_match_win_pct).toBeCloseTo(100 / 3, 3);
  });

  it("computes deciding_tiebreak_win_reliance_pct over WINS only", async () => {
    const { getRepositoryScoreProfileStats } = await import("./historical-score-profile-repository-bridge.server");
    const stats = getRepositoryScoreProfileStats(PLAYER, "date 2026-02-01 women");
    const byKey = Object.fromEntries(stats.map((s) => [s.key, s.value]));
    // 2 wins total; 1 of them (the deciding-set win) required a decider -> 50%.
    expect(byKey.deciding_tiebreak_win_reliance_pct).toBe(50);
  });

  it("attributes stats to the repository source, distinct from the ATP DataHub source", async () => {
    const { getRepositoryScoreProfileStats } = await import("./historical-score-profile-repository-bridge.server");
    const stats = getRepositoryScoreProfileStats(PLAYER, "date 2026-02-01 women");
    expect(stats.length).toBeGreaterThan(0);
    for (const s of stats) expect(s.sources[0].source_name).toContain("Repository WTA_MAIN");
  });

  it("returns nothing for ATP_MAIN/WTA_CHALLENGER context (those lanes genuinely lack per-set scores at the source)", async () => {
    const { getRepositoryScoreProfileStats } = await import("./historical-score-profile-repository-bridge.server");
    expect(getRepositoryScoreProfileStats(PLAYER, "date 2026-02-01 atp")).toEqual([]);
  });

  it("returns nothing when the tour family can't be classified (fails closed)", async () => {
    const { getRepositoryScoreProfileStats } = await import("./historical-score-profile-repository-bridge.server");
    expect(getRepositoryScoreProfileStats(PLAYER, "date 2026-02-01")).toEqual([]);
  });

  it("returns nothing for a player with no repository rows (genuine absence, not fabricated)", async () => {
    const { getRepositoryScoreProfileStats } = await import("./historical-score-profile-repository-bridge.server");
    expect(getRepositoryScoreProfileStats("Nobody At All", "date 2026-02-01 women")).toEqual([]);
  });
});
