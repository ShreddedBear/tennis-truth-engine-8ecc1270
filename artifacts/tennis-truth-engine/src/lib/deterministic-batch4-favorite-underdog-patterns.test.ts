import { describe, expect, it } from "vitest";
import { deterministicBatch4FavoriteUnderdogPatterns } from "./deterministic-batch4-favorite-underdog-patterns.server";

// Integration-style tests: these call the real wired tier
// (deterministic-batch4-favorite-underdog-patterns.server.ts), which itself
// calls the real 043/044 modules against the real generated static history
// index (data/generated/tennis-runtime-index.json) -- not a synthetic
// fixture. This is the same tier warehouse-first-researcher.server.ts now
// calls (ahead of deterministicMarketMetric) for these two codes, so a GO
// result here is proof the reconnection actually produces a real,
// non-fabricated MetricFinding on the live path.
//
// Fixture pair reused from deterministic-batch1/2's own tests: "zdenek
// kolar" has real favorite-role losses on ATP_CHALLENGER, "andrea
// collarini" has real underdog wins there (both verified directly against
// the generated index in this task's own exploration -- see this file's
// git history / the module headers).
const P1 = "zdenek kolar";
const P2 = "andrea collarini";
const LANE = "ATP_CHALLENGER" as const;
const AS_OF = "2026-08-29";

describe("deterministicBatch4FavoriteUnderdogPatterns (live pipeline wiring for 043/044)", () => {
  it("returns null for a code it does not own", async () => {
    const result = await deterministicBatch4FavoriteUnderdogPatterns({ metricCode: "005", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
  });

  it("returns null (falls through) when tourFamily is not resolved", async () => {
    const result = await deterministicBatch4FavoriteUnderdogPatterns({ metricCode: "043", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: null });
    expect(result).toBeNull();
  });

  it("043 Favorite Failure-Mode Score: produces a real, non-fabricated finding cross-referencing both players' real histories", async () => {
    const result = await deterministicBatch4FavoriteUnderdogPatterns({ metricCode: "043", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE, surface: "hard" });
    expect(result).not.toBeNull();
    expect(result!.p1_treatment).toBe("RECONSTRUCTED"); // kolar has real favorite-role losses vs collarini as reproducer
    expect(result!.p1_value).toMatch(/bad_loss_severity_index=/);
    expect(result!.p1_value).toMatch(/reproduction_compatibility_score_pct=/);
    expect(result!.evidence_family).toBe("STANDALONE_FAVORITE_FAILURE_MODE");
    expect(result!.sources.length).toBeGreaterThan(0);
  });

  it("044 Opponent Upset Compatibility: produces a real finding with today's-favorite Elo comparison", async () => {
    const result = await deterministicBatch4FavoriteUnderdogPatterns({ metricCode: "044", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE, surface: "clay" });
    expect(result).not.toBeNull();
    expect(result!.p2_treatment).toBe("RECONSTRUCTED"); // collarini has real underdog-win history vs kolar as today's favorite
    expect(result!.p2_value).toMatch(/todays_favorite_elo=/);
    expect(result!.p2_value).toMatch(/excluded_similarity_dimensions_n=6/);
    expect(result!.evidence_family).toBe("STANDALONE_OPPONENT_UPSET_COMPATIBILITY");
  });

  it("043/044: fall through to null for a code that resolves on neither side (nonexistent players)", async () => {
    const result = await deterministicBatch4FavoriteUnderdogPatterns({ metricCode: "043", p1: "totally fictional player one", p2: "totally fictional player two", asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
  });

  it("043: falls through to null on a lane with no ATP_CHALLENGER-style favorite-loss history for either player (ATP_MAIN, nonexistent names)", async () => {
    const result = await deterministicBatch4FavoriteUnderdogPatterns({ metricCode: "043", p1: "totally fictional player one", p2: "totally fictional player two", asOfDate: AS_OF, tourFamily: "ATP_MAIN" });
    expect(result).toBeNull();
  });
});
