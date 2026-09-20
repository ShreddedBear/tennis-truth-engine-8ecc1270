import { describe, expect, it } from "vitest";
import { computeHistoricalScoreProfileStatsFromRows, parseDataHubSets } from "./datahub-atp-score-profile.server";

function value(stats: ReturnType<typeof computeHistoricalScoreProfileStatsFromRows>, key: string) {
  return stats.find((s) => s.key === key)?.value;
}

describe("metric 008 — Set Profile", () => {
  it("parses the compact score notation actually used by the imported DataHub files", () => {
    expect(parseDataHubSets("62 26 63")).toEqual([[6, 2], [2, 6], [6, 3]]);
    expect(parseDataHubSets("76(7) 62")).toEqual([[7, 6], [6, 2]]);
    expect(parseDataHubSets("6-4 3-6 7-5")).toEqual([[6, 4], [3, 6], [7, 5]]);
    expect(parseDataHubSets("W/O")).toEqual([]);
  });

  it("keeps score orientation from the requested player's perspective", () => {
    const rows = [
      { tourney_year_id: "2017-001", winner_name: "Player A", loser_name: "Opponent 1", match_score_tiebreaks: "46 63 64", winner_sets_won: "2", loser_sets_won: "1" },
      { tourney_year_id: "2017-002", winner_name: "Opponent 2", loser_name: "Player A", match_score_tiebreaks: "64 36 63", winner_sets_won: "2", loser_sets_won: "1" },
    ];
    const a = computeHistoricalScoreProfileStatsFromRows(rows as any, "Player A", "date 2026-01-01");
    // Player A lost set 1 in both matches and won set 2 in both matches.
    expect(value(a, "set1_win_pct")).toBe(0);
    expect(value(a, "set2_win_pct")).toBe(100);
    expect(value(a, "second_set_after_losing_set1_win_pct")).toBe(100);
    // One comeback match win and one loss after losing set 1.
    expect(value(a, "win_after_losing_set1_pct")).toBe(50);
  });

  it("does not misclassify a 3-0 or 3-1 best-of-five match as a deciding-set match", () => {
    const rows = [
      { tourney_year_id: "2017-010", winner_name: "Player A", loser_name: "Opponent 1", match_score_tiebreaks: "62 63 64", winner_sets_won: "3", loser_sets_won: "0" },
      { tourney_year_id: "2017-011", winner_name: "Player A", loser_name: "Opponent 2", match_score_tiebreaks: "62 36 64 63", winner_sets_won: "3", loser_sets_won: "1" },
      { tourney_year_id: "2017-012", winner_name: "Player A", loser_name: "Opponent 3", match_score_tiebreaks: "62 36 64 46 63", winner_sets_won: "3", loser_sets_won: "2" },
    ];
    const a = computeHistoricalScoreProfileStatsFromRows(rows as any, "Player A", "date 2026-01-01");
    expect(value(a, "historical_deciding_set_win_pct")).toBe(100);
    expect(value(a, "set3_deciding_set_win_pct")).toBe(100);
    expect(value(a, "deciding_matches_played")).toBe(1);
  });

  it("persists DataHub provenance, reconstructed treatment and real denominator samples", () => {
    const rows = [
      { tourney_year_id: "2017-020", winner_name: "Player A", loser_name: "Opponent 1", match_score_tiebreaks: "76(5) 64", winner_sets_won: "2", loser_sets_won: "0" },
    ];
    const a = computeHistoricalScoreProfileStatsFromRows(rows as any, "Player A", "date 2026-01-01");
    expect(a.length).toBeGreaterThan(0);
    for (const stat of a) {
      expect(stat.player).toBe("Player A");
      expect(stat.origin).toBe("RECONSTRUCTED");
      expect(stat.sample).toBeGreaterThan(0);
      expect(stat.sources[0]?.source_name).toContain("DataHub ATP");
    }
  });
});
