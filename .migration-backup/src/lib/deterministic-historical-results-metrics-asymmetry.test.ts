import { describe, expect, it, vi } from "vitest";
import { deterministicHistoricalResultsMetric } from "./deterministic-historical-results-metrics.server";

// Regression test for a real bug found while repairing the 25 active Truth Engine metrics:
// deterministicHistoricalResultsMetric used to require BOTH players to have a non-null,
// positive-sample derivation before returning anything -- one player with genuinely zero
// qualifying events for a metric's own definition (e.g. zero deciding-set matches ever)
// silently discarded the OTHER player's real, independently-computed evidence too, sinking
// the whole finding down to a worse source (or the live AI, which then had to guess). This
// fixture gives Alice a real 3-set (deciding-set) win and Bob only straight-set matches, so
// metric 008 (Deciding-set win %) has genuine, asymmetric, real-world-shaped evidence: one
// side computable, one side genuinely not.
vi.mock("./runtime-tennis-index-data.server", () => ({
  loadRuntimeIndex: () => ({
    generatedAt: "2026-01-01T00:00:00Z",
    ATP: {}, WTA: {},
    matchHistory: {
      ATP_MAIN: {
        "alice alpha": [
          // Won 2-1 in sets (best of 3, deciding set played) -- a real deciding-set win.
          ["2026-08-10", "Fixture Open", "Hard", "Carol Gamma", 1, "R32", "atp", { sets_for: 2, sets_against: 1, best_of: 3 }],
        ],
        "bob beta": [
          // Straight-set matches only -- Bob has genuinely zero deciding-set history.
          ["2026-08-12", "Fixture Open", "Hard", "Eve Epsilon", 0, "R32", "atp", { sets_for: 0, sets_against: 2, best_of: 3 }],
          ["2026-08-22", "Fixture Masters", "Hard", "Frank Foxtrot", 1, "R16", "atp", { sets_for: 2, sets_against: 0, best_of: 3 }],
        ],
      },
      WTA_MAIN: {}, ATP_CHALLENGER: {}, WTA_CHALLENGER: {},
    },
  }),
}));

describe("deterministicHistoricalResultsMetric: asymmetric side availability", () => {
  it("returns Alice's real deciding-set evidence even though Bob genuinely has none, instead of discarding both", async () => {
    const finding = await deterministicHistoricalResultsMetric({ metricCode: "008", p1: "Alice Alpha", p2: "Bob Beta", asOfDate: "2026-08-26", tourFamily: "ATP_MAIN" });
    expect(finding).not.toBeNull();
    expect(finding?.p1_treatment).toBe("RECONSTRUCTED");
    expect(finding?.p1_value).toBe("deciding_matches=1; deciding_wins=1; deciding_set_win_pct=100");
    expect(finding?.p2_treatment).toBe("UNAVAILABLE");
    expect(finding?.p2_value).toBeNull();
    expect(finding?.p2_unavailable_reason).toMatch(/no qualifying historical events/i);
  });

  it("inverted (Bob as P1, Alice as P2) still surfaces Alice's real evidence on whichever side she's placed", async () => {
    const finding = await deterministicHistoricalResultsMetric({ metricCode: "008", p1: "Bob Beta", p2: "Alice Alpha", asOfDate: "2026-08-26", tourFamily: "ATP_MAIN" });
    expect(finding).not.toBeNull();
    expect(finding?.p1_treatment).toBe("UNAVAILABLE");
    expect(finding?.p1_value).toBeNull();
    expect(finding?.p2_treatment).toBe("RECONSTRUCTED");
    expect(finding?.p2_value).toBe("deciding_matches=1; deciding_wins=1; deciding_set_win_pct=100");
  });

  // A DEEPER version of the same bug: repositoryHistoryAvailable used to gate on BOTH
  // players having ANY runtime-index coverage at all for the tour family, before even
  // trying to derive anything. A player entirely absent from the index (a name the
  // generated runtime index has never seen, not merely one lacking this metric's specific
  // qualifying events) used to discard Alice's real, self-history-only evidence (code 005
  // needs only Alice's OWN rows -- it never reads Nobody Nowhere's history at all).
  it("surfaces Alice's real evidence for a self-history code even when the opponent has ZERO runtime-index coverage at all", async () => {
    const finding = await deterministicHistoricalResultsMetric({ metricCode: "005", p1: "Alice Alpha", p2: "Nobody Nowhere", asOfDate: "2026-08-26", tourFamily: "ATP_MAIN" });
    expect(finding).not.toBeNull();
    expect(finding?.p1_value).toContain("last5_matches=1");
    expect(finding?.p2_treatment).toBe("UNAVAILABLE");
    expect(finding?.p2_value).toBeNull();
  });
});
