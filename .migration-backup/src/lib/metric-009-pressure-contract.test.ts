import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeHistoricalScoreProfileStatsFromRows } from "./datahub-atp-score-profile.server";

function hybridSource() {
  return readFileSync(join(process.cwd(), "src/lib/hybrid-audit-research.server.ts"), "utf8");
}

describe("metric 009 — Comeback/Pressure Behavior", () => {
  it("does not cross-wire generic BP, close-match, deciding-set, or set-front-runner fields into 009", () => {
    const source = hybridSource();
    const row = source.match(/"009":\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect(row).toContain("win_after_losing_set1_pct");
    expect(row).toContain("tiebreak_win_pct");
    expect(row).toContain("tiebreaks_played");
    for (const forbidden of [
      "break_points_saved_pct",
      "break_point_conversion_pct",
      "close_match_win_pct",
      "historical_deciding_set_win_pct",
      "deciding_matches_played",
      "win_after_winning_set1_pct",
    ]) expect(row).not.toContain(forbidden);
  });

  it("orients comeback and tiebreak evidence to the requested player", () => {
    const rows = [
      { tourney_year_id: "2017-101", winner_name: "Player A", loser_name: "Opponent 1", match_score_tiebreaks: "46 76(5) 64", winner_sets_won: "2", loser_sets_won: "1" },
      { tourney_year_id: "2017-102", winner_name: "Opponent 2", loser_name: "Player A", match_score_tiebreaks: "76(4) 64", winner_sets_won: "2", loser_sets_won: "0" },
    ];
    const stats = computeHistoricalScoreProfileStatsFromRows(rows as any, "Player A", "date 2026-01-01");
    const get = (key: string) => stats.find((s) => s.key === key)?.value;
    expect(get("win_after_losing_set1_pct")).toBe(50);
    expect(get("tiebreaks_played")).toBe(2);
    expect(get("tiebreak_win_pct")).toBe(50);
  });
});
