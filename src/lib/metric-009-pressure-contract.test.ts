import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeHistoricalScoreProfileStatsFromRows } from "./datahub-atp-score-profile.server";
import { reconstructPbpScoreState } from "./pbp-score-state-recovery";

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

  it("keeps approved-PBP pressure-point evidence (§11 re-audit) separate from code 018's breakback/closeout fields", () => {
    const payload = {
      available: true,
      sets: [{ games: [
        { server: "player1", points: [{ winner: "player1", ace: true }, { winner: "player2", double_fault: true }, { winner: "player1" }, { winner: "player2" }, { winner: "player1" }, { winner: "player2" }, { winner: "player1" }, { winner: "player1" }] },
        { server: "player2", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
        { server: "player1", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
        { server: "player2", points: [{ winner: "player2" }, { winner: "player2" }, { winner: "player2" }, { winner: "player2" }] },
        { server: "player1", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
        { server: "player2", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
        { server: "player1", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
        { server: "player2", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
        { server: "player1", points: [{ winner: "player1" }, { winner: "player1" }, { winner: "player1" }, { winner: "player1" }] },
      ] }],
    };
    const recovery = reconstructPbpScoreState(payload);
    const nine = recovery.derived.player1["009"];
    expect(nine?.treatment).toBe("PARTIAL");
    expect(Object.keys(nine?.value ?? {}).sort()).toEqual(["pressure_points", "pressure_points_won", "pressure_win_pct", "set_boundaries"].sort());
    for (const forbidden of ["breakback_opportunities", "breakbacks", "breakback_rate_pct", "closeout_opportunities", "closeouts", "closeout_rate_pct"]) {
      expect(nine?.value ?? {}).not.toHaveProperty(forbidden);
    }
    const eighteen = recovery.derived.player1["018"];
    expect(eighteen?.value).toHaveProperty("breakback_rate_pct");
    expect(eighteen?.value).toHaveProperty("closeout_rate_pct");
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
