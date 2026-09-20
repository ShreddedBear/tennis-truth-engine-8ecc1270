import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeHistoricalScoreProfileStatsFromRows } from "./datahub-atp-score-profile.server";

const source = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("metric 011 — Volatility/Floor", () => {
  it("measures close-match dependency and deciding/tiebreak reliance over wins, not all matches", () => {
    const rows = [
      { tourney_year_id: "2017-301", winner_name: "Player A", loser_name: "Opp 1", match_score_tiebreaks: "62 63", winner_sets_won: "2", loser_sets_won: "0" },
      { tourney_year_id: "2017-302", winner_name: "Player A", loser_name: "Opp 2", match_score_tiebreaks: "75 64", winner_sets_won: "2", loser_sets_won: "0" },
      { tourney_year_id: "2017-303", winner_name: "Player A", loser_name: "Opp 3", match_score_tiebreaks: "76(5) 46 63", winner_sets_won: "2", loser_sets_won: "1" },
      { tourney_year_id: "2017-304", winner_name: "Opp 4", loser_name: "Player A", match_score_tiebreaks: "64 64", winner_sets_won: "2", loser_sets_won: "0" },
    ];
    const stats = computeHistoricalScoreProfileStatsFromRows(rows as any, "Player A", "date 2026-01-01");
    const get = (k: string) => stats.find((s) => s.key === k)?.value;
    // 2 of 3 wins were narrow/deciding; only 1 of 3 required a decider or tiebreak.
    expect(get("close_match_dependency_pct")).toBeCloseTo(66.6667, 3);
    expect(get("deciding_tiebreak_win_reliance_pct")).toBeCloseTo(33.3333, 3);
  });

  it("does not use Elo weakness as the master lower-ranked upset-resistance metric", () => {
    const hybrid = source("src/lib/hybrid-audit-research.server.ts");
    const row = hybrid.match(/"011":\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect(row).toContain("performance_variance");
    expect(row).toContain("performance_floor_ceiling_set_margin_range");
    expect(row).toContain("close_match_dependency_pct");
    expect(row).toContain("deciding_tiebreak_win_reliance_pct");
    for (const forbidden of ["upset_resistance_pct", "floor_ceiling_elo_range", "recent_elo_delta", "close_match_win_pct", "deciding_match_reliance_pct"]) {
      expect(row).not.toContain(forbidden);
    }
  });

  it("defines variance and floor/ceiling from match performance set margins, not rating movement", () => {
    const derived = source("src/lib/predixsport-derived.server.ts");
    expect(derived).toContain('performance_variance');
    expect(derived).toContain('performance_floor_ceiling_set_margin_range');
    expect(derived).toContain('Math.max(...margins)-Math.min(...margins)');
  });
});
