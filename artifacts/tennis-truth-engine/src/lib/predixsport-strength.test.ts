import { describe, expect, it } from "vitest";
import { getStrengthTrajectoryStats } from "./predixsport-strength.server";

// Live production finding: this module read only data/public/predixsport/atp/atp_elo_matches.csv,
// so every WTA player got zero elo-trajectory stats (current_overall_elo, elo_change_last10,
// current_surface_elo, etc.) here even though data/public/predixsport/wta/wta_elo_ratings.csv
// already exists on disk and already carries a dated elo value per tournament -- everything
// an elo TREND needs. The WTA file has a thinner schema than the ATP one (no opponent, won,
// sets_for/against, or elo_pre/elo_post split), so this only recovers the elo-derived stats,
// never overall_recent20_win_pct (which genuinely needs `won`, absent from this file).
describe("getStrengthTrajectoryStats WTA elo-only fallback (real captured data)", () => {
  it("produces real elo-trajectory stats for a real WTA player using the WTA elo file, once ATP has nothing", () => {
    // Full real row history for Elitsa Kostova (data/public/predixsport/wta/wta_elo_ratings.csv),
    // 2017-01-01 through 2020-03-02 -- all rows strictly before 2019-12-01 are in scope here.
    // Career peak overall elo in that window is 1597.74 (2017-01-30, st_petersburg). The
    // last row before the cutoff is 2019-10-14 moscow, elo 1472.32.
    const stats = getStrengthTrajectoryStats("Elitsa Kostova", "date 2019-12-01");
    const byKey = Object.fromEntries(stats.map((s) => [s.key, s]));
    expect(stats.length).toBeGreaterThan(0);
    expect(byKey.current_overall_elo).toBeDefined();
    expect(byKey.current_overall_elo!.value).toBeCloseTo(1472.32, 2);
    expect(byKey.career_observed_peak_elo!.value).toBeCloseTo(1597.74, 2);
    expect(byKey.elo_change_last10).toBeDefined();
    // Every stat must be attributed to the WTA-specific source, not silently mislabeled ATP.
    for (const s of stats) expect(s.sources[0].source_name).toContain("WTA");
  });

  it("never fabricates overall_recent20_win_pct for a WTA-only player (the WTA file has no win/loss column)", () => {
    const stats = getStrengthTrajectoryStats("Elitsa Kostova", "date 2019-12-01");
    expect(stats.find((s) => s.key === "overall_recent20_win_pct")).toBeUndefined();
  });

  it("respects the temporal cutoff: no elo rows dated on/after asOfDate are used", () => {
    const stats = getStrengthTrajectoryStats("Elitsa Kostova", "date 2018-05-01");
    const current = stats.find((s) => s.key === "current_overall_elo");
    expect(current!.value).toBeCloseTo(1530.83, 2); // last row strictly before 2018-05-01
  });

  it("computes a real surface-specific elo trend on a real surface-filtered slice", () => {
    // Clay rows before the cutoff, in order, end at 2019-05-19 n_rnberg, elo 1492.33 --
    // the 2019-04-08 bogota clay rows (1544.29/1527.97/1507.71) all come strictly earlier.
    const stats = getStrengthTrajectoryStats("Elitsa Kostova", "date 2019-12-01 surface clay");
    const surfaceElo = stats.find((s) => s.key === "current_surface_elo");
    expect(surfaceElo).toBeDefined();
    expect(surfaceElo!.value).toBeCloseTo(1492.33, 2); // last clay row before the cutoff
  });

  it("returns nothing for a genuinely unknown player (never guesses a fuzzy match)", () => {
    expect(getStrengthTrajectoryStats("Totally Fictional Nonexistent Player", "date 2020-01-01")).toEqual([]);
  });

  it("returns nothing when the context carries no resolvable cutoff date, for either tour", () => {
    expect(getStrengthTrajectoryStats("Elitsa Kostova", "no date here")).toEqual([]);
  });
});
