import { describe, expect, it } from "vitest";
import { compareMetricRow, COMPARISON_SPECS, type MetricRowForComparison } from "./truth-engine-metric-comparison";
import { ACTIVE_METRIC_CODES, isActiveMetricCode } from "./truth-engine-active-metrics";

// Pure, no-DB, no-network coverage for the four COMPARISON_SPECS entries added by the
// insufficient-evidence recovery pass (020, 043, 044, 061 -- 038 was investigated and
// deliberately left out, see below) -- see the "Insufficient-evidence recovery pass" block in
// truth-engine-metric-comparison.ts for the full reasoning behind each field/direction/
// family/sample choice. Each of these codes already has its own live-pipeline integration
// coverage (deterministic-batch2/4/5-*.test.ts, against the real generated index); this file
// instead exercises compareMetricRow directly against literal p1_value/p2_value strings, so
// the comparison-layer behavior itself (direction, materiality, sample floor) is provable
// without depending on live index data.

describe("insufficient-evidence recovery pass: the four newly-active codes are genuinely wired into COMPARISON_SPECS", () => {
  it("020, 043, 044, 061 are all active", () => {
    for (const code of ["020", "043", "044", "061"]) {
      expect(isActiveMetricCode(code), code).toBe(true);
      expect(ACTIVE_METRIC_CODES).toContain(code);
    }
  });
});

describe("020: following_strong_tournament_win_pct (TOURNAMENT_TRANSITION_FORM)", () => {
  const row = (p1: string, p2: string): MetricRowForComparison => ({
    metric_code: "020", p1_value: p1, p2_value: p2, p1_treatment: "RECONSTRUCTED", p2_treatment: "RECONSTRUCTED",
  });

  it("favours the player with the materially higher post-strong-tournament win rate", () => {
    const c = compareMetricRow(row(
      "following_strong_tournament_win_pct=65; following_strong_tournament_n=10",
      "following_strong_tournament_win_pct=35; following_strong_tournament_n=10",
    ));
    expect(c.status).toBe("COMPARED");
    expect(c.family).toBe("TOURNAMENT_TRANSITION_FORM");
    expect(c.favours).toBe("P1");
  });

  it("reads NEUTRAL within the materiality floor", () => {
    const c = compareMetricRow(row(
      "following_strong_tournament_win_pct=55; following_strong_tournament_n=10",
      "following_strong_tournament_win_pct=45; following_strong_tournament_n=10",
    ));
    expect(c.status).toBe("COMPARED");
    expect(c.favours).toBe("NEUTRAL");
  });

  it("refuses a lean when either side's own bucket n is below the spec's minSample", () => {
    const c = compareMetricRow(row(
      "following_strong_tournament_win_pct=80; following_strong_tournament_n=5",
      "following_strong_tournament_win_pct=20; following_strong_tournament_n=10",
    ));
    expect(c.status).toBe("INSUFFICIENT_SAMPLE");
    expect(c.favours).toBe("UNAVAILABLE");
  });
});

describe("043: reproduction_compatibility_score_pct (MATCHUP_FAILURE_MODE, LOWER_IS_BETTER)", () => {
  const row = (p1: string, p2: string): MetricRowForComparison => ({
    metric_code: "043", p1_value: p1, p2_value: p2, p1_treatment: "RECONSTRUCTED", p2_treatment: "RECONSTRUCTED",
  });

  it("favours the player LESS exploitable by their own actual opponent (lower own score wins)", () => {
    // P1's own field is "how well P2 reproduces P1's favorite-loss failure modes" -- 20 means
    // P2 is a poor match for exploiting P1. P2's own field ("how well P1 reproduces P2's
    // failure modes") is 60 -- P1 is a strong match for exploiting P2. P1 should be favoured.
    const c = compareMetricRow(row(
      "reproduction_compatibility_score_pct=20; opponent_underdog_wins_n=10",
      "reproduction_compatibility_score_pct=60; opponent_underdog_wins_n=10",
    ));
    expect(c.status).toBe("COMPARED");
    expect(c.direction).toBe("LOWER_IS_BETTER");
    expect(c.family).toBe("MATCHUP_FAILURE_MODE");
    expect(c.favours).toBe("P1");
  });

  it("refuses a lean when the opponent's own reproduction-rate sample is too thin", () => {
    const c = compareMetricRow(row(
      "reproduction_compatibility_score_pct=20; opponent_underdog_wins_n=3",
      "reproduction_compatibility_score_pct=60; opponent_underdog_wins_n=10",
    ));
    expect(c.status).toBe("INSUFFICIENT_SAMPLE");
  });
});

describe("044: surface_match_rate_pct (UPSET_COMPATIBILITY)", () => {
  const row = (p1: string, p2: string): MetricRowForComparison => ({
    metric_code: "044", p1_value: p1, p2_value: p2, p1_treatment: "RECONSTRUCTED", p2_treatment: "RECONSTRUCTED",
  });

  it("favours the player whose own past upsets skew more toward today's match surface", () => {
    const c = compareMetricRow(row(
      "surface_match_rate_pct=70; trailing_underdog_wins_n=10",
      "surface_match_rate_pct=30; trailing_underdog_wins_n=10",
    ));
    expect(c.status).toBe("COMPARED");
    expect(c.family).toBe("UPSET_COMPATIBILITY");
    expect(c.favours).toBe("P1");
  });

  it("elo_gap_to_avg_upset_opponent is NOT a spec'd field (non-monotonic, deliberately left out)", () => {
    expect(COMPARISON_SPECS["044"]!.field).not.toBe("elo_gap_to_avg_upset_opponent");
  });
});

describe("061: own_analogous_twin_win_pct (TWIN_MATCH_PROBABILITY)", () => {
  const row = (p1: string, p2: string): MetricRowForComparison => ({
    metric_code: "061", p1_value: p1, p2_value: p2, p1_treatment: "RECONSTRUCTED", p2_treatment: "RECONSTRUCTED",
  });

  it("favours the player with the materially higher own analogous-favorite win rate", () => {
    const c = compareMetricRow(row(
      "favorite_win_pct_in_twins=70; current_analogous_favorite=P1; twin_matches_found=12; own_analogous_twin_win_pct=70",
      "favorite_win_pct_in_twins=70; current_analogous_favorite=P1; twin_matches_found=12; own_analogous_twin_win_pct=30",
    ));
    expect(c.status).toBe("COMPARED");
    expect(c.family).toBe("TWIN_MATCH_PROBABILITY");
    expect(c.favours).toBe("P1");
  });

  it("refuses a lean below the spec's minSample (set above the producer's own MIN_TWIN_MATCHES=5 floor)", () => {
    const c = compareMetricRow(row(
      "favorite_win_pct_in_twins=70; current_analogous_favorite=P1; twin_matches_found=6; own_analogous_twin_win_pct=70",
      "favorite_win_pct_in_twins=70; current_analogous_favorite=P1; twin_matches_found=6; own_analogous_twin_win_pct=30",
    ));
    expect(c.status).toBe("INSUFFICIENT_SAMPLE");
  });
});

describe("insufficient-evidence recovery pass: deliberately deferred codes stay inactive", () => {
  // 038 has a real, well-gated engine (audit-metric-038-opponent-adjusted-residual-
  // performance.ts) but is deliberately NOT reactivated here -- see the dedicated
  // "004, 023, 038 remain unactivated" regression test elsewhere in this file and the
  // matching note in truth-engine-metric-comparison.ts: a standing, dated exclusion on
  // live-database sample-thinness grounds that this pass has no live-DB access to verify or
  // overturn.
  it("037, 038, 039, 040, 047, 052, 062 have no COMPARISON_SPECS entry", () => {
    for (const code of ["037", "038", "039", "040", "047", "052", "062"]) {
      expect(COMPARISON_SPECS[code], code).toBeUndefined();
      expect(isActiveMetricCode(code), code).toBe(false);
    }
  });
});
