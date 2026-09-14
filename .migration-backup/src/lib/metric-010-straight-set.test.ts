import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeHistoricalScoreProfileStatsFromRows } from "./datahub-atp-score-profile.server";

const source = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("metric 010 — Straight-Set / 2–0 Metrics", () => {
  it("uses all matches, not only wins, as the straight-set win-rate denominator", () => {
    const rows = [
      { tourney_year_id: "2017-201", winner_name: "Player A", loser_name: "Opp 1", match_score_tiebreaks: "64 62", winner_sets_won: "2", loser_sets_won: "0" },
      { tourney_year_id: "2017-202", winner_name: "Player A", loser_name: "Opp 2", match_score_tiebreaks: "64 36 62", winner_sets_won: "2", loser_sets_won: "1" },
      { tourney_year_id: "2017-203", winner_name: "Opp 3", loser_name: "Player A", match_score_tiebreaks: "64 62", winner_sets_won: "2", loser_sets_won: "0" },
      { tourney_year_id: "2017-204", winner_name: "Opp 4", loser_name: "Player A", match_score_tiebreaks: "46 64 62", winner_sets_won: "2", loser_sets_won: "1" },
    ];
    const stats = computeHistoricalScoreProfileStatsFromRows(rows as any, "Player A", "date 2026-01-01");
    const get = (k: string) => stats.find((s) => s.key === k)?.value;
    expect(get("straight_set_match_win_pct")).toBe(25);
    expect(get("historical_straight_set_control_pct")).toBe(50);
  });

  it("wires only exact straight-set match-rate fields into metric 010", () => {
    const hybrid = source("src/lib/hybrid-audit-research.server.ts");
    const row = hybrid.match(/"010":\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect(row).toContain("straight_set_match_win_pct");
    expect(row).toContain("straight_set_match_win_pct_comparable");
    for (const forbidden of ["straight_set_win_pct", "straight_set_wins", "matches_won", "historical_straight_set_win_pct", "straight_set_rate_comparable_pct", "matrix", "monte_carlo"]) {
      expect(row).not.toContain(forbidden);
    }
  });

  it("uses all comparable matches for the comparable-opposition denominator", () => {
    const derived = source("src/lib/predixsport-derived.server.ts");
    expect(derived).toContain('straight_set_match_win_pct_comparable');
    expect(derived).toContain('100*comparableStraightWins/comparable.length');
    expect(derived).not.toContain('straight_set_rate_comparable_pct');
  });
});
