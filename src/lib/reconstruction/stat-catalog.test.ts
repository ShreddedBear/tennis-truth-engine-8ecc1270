import { describe, expect, it } from "vitest";
import { familyOf } from "./stat-catalog";

describe("canonical imported-stat family routing", () => {
  it("routes event history to the correct master metric families", () => {
    expect(familyOf("same_tournament_win_pct")).toBe("030");
    expect(familyOf("same_round_win_pct")).toBe("028");
    expect(familyOf("same_level_win_pct")).toBe("020");
  });

  it("routes surface and environment context to metric 021", () => {
    for (const key of ["match_surface_hard", "verified_court_speed_index", "match_temperature_c", "match_wind_kph"]) {
      expect(familyOf(key)).toBe("021");
    }
  });

  it("routes style proxies to matchup-adjusted metric 023", () => {
    for (const key of ["serve_aggression_proxy", "style_serve_vs_return_edge", "style_resilience_edge"]) {
      expect(familyOf(key)).toBe("023");
    }
  });

  it("prevents imported context/style data from populating 015-018", () => {
    for (const key of [
      "same_tournament_win_pct",
      "same_round_win_pct",
      "same_level_win_pct",
      "match_surface_hard",
      "match_temperature_c",
      "serve_aggression_proxy",
      "style_serve_vs_return_edge",
    ]) {
      expect(["015", "016", "017", "018"]).not.toContain(familyOf(key));
    }
  });
});
