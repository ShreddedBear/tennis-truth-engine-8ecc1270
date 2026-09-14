import { describe, expect, it } from "vitest";
import { deterministicBatch5NewMetrics } from "./deterministic-batch5-new-metrics.server";

// Integration-style tests: these call the real wired tier
// (deterministic-batch5-new-metrics.server.ts), which itself calls the real 047/061
// modules against the real generated static history index
// (data/generated/tennis-runtime-index.json) -- not a synthetic fixture. This is the same
// tier warehouse-first-researcher.server.ts now calls (alongside batch4, ahead of
// deterministicMarketMetric) for these two codes.
const LANE = "ATP_CHALLENGER" as const;
const AS_OF = "2026-08-29";

describe("deterministicBatch5NewMetrics (live pipeline wiring for 047/061)", () => {
  it("returns null for a code it does not own", async () => {
    const result = await deterministicBatch5NewMetrics({ metricCode: "005", p1: "alejandro tabilo", p2: "carlo alberto caniato", asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
  });

  it("returns null (falls through) when tourFamily is not resolved", async () => {
    const result = await deterministicBatch5NewMetrics({ metricCode: "047", p1: "alejandro tabilo", p2: "carlo alberto caniato", asOfDate: AS_OF, tourFamily: null });
    expect(result).toBeNull();
  });

  it("047 Uncertainty-Adjusted Advantage: produces a real, non-fabricated, symmetric CI-adjusted finding", async () => {
    const result = await deterministicBatch5NewMetrics({ metricCode: "047", p1: "alejandro tabilo", p2: "carlo alberto caniato", asOfDate: AS_OF, tourFamily: LANE });
    expect(result).not.toBeNull();
    expect(result!.p1_treatment).toBe("RECONSTRUCTED");
    expect(result!.p2_treatment).toBe("RECONSTRUCTED");
    expect(result!.p1_value).toBe(result!.p2_value); // joint comparison, symmetric by construction
    expect(result!.p1_value).toMatch(/dimension=lead_protection/);
    expect(result!.p1_value).toMatch(/verdict=/);
    expect(result!.evidence_family).toBe("STANDALONE_UNCERTAINTY_ADJUSTED_ADVANTAGE");
    expect(result!.sources.length).toBeGreaterThan(0);
  });

  it("047: falls through to null for a nonexistent player pair", async () => {
    const result = await deterministicBatch5NewMetrics({ metricCode: "047", p1: "totally fictional player one", p2: "totally fictional player two", asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
  });

  it("061 Historical Twin Match Search: produces a real twin-match finding, joint text shared but each side's own_analogous_twin_win_pct genuinely per-player", async () => {
    const result = await deterministicBatch5NewMetrics({ metricCode: "061", p1: "andrea collarini", p2: "zdenek kolar", asOfDate: AS_OF, tourFamily: LANE, surface: "hard" });
    expect(result).not.toBeNull();
    expect(result!.p1_treatment).toBe("RECONSTRUCTED");
    expect(result!.p2_treatment).toBe("RECONSTRUCTED");
    expect(result!.p1_value).toMatch(/twin_matches_found=/);
    // The insufficient-evidence recovery pass (truth-engine-metric-comparison.ts's "061"
    // spec) appends a genuinely per-player own_analogous_twin_win_pct field so this code can
    // be compared at all -- the rest of the joint text (found by historical-twin-match-
    // search.server.ts) stays identical on both sides, same as before that pass.
    expect(result!.p1_value).toMatch(/own_analogous_twin_win_pct=[\d.-]+$/);
    expect(result!.p2_value).toMatch(/own_analogous_twin_win_pct=[\d.-]+$/);
    const stripOwnPct = (v: string) => v.replace(/; own_analogous_twin_win_pct=[\d.-]+$/, "");
    expect(stripOwnPct(result!.p1_value)).toBe(stripOwnPct(result!.p2_value));
    // The two own-shares are a zero-sum probability by construction (whichever player is
    // today's analogous favorite keeps the joint favorite_win_pct_in_twins as their own; the
    // other gets its complement).
    const ownPct = (v: string) => Number(v.match(/own_analogous_twin_win_pct=([\d.-]+)$/)?.[1]);
    expect(ownPct(result!.p1_value) + ownPct(result!.p2_value)).toBeCloseTo(100, 1);
    expect(result!.evidence_family).toBe("STANDALONE_HISTORICAL_TWIN_MATCH_SEARCH");
    expect(result!.sources.length).toBeGreaterThan(0);
  });

  it("061: falls through to null for a nonexistent player pair", async () => {
    const result = await deterministicBatch5NewMetrics({ metricCode: "061", p1: "totally fictional player one", p2: "totally fictional player two", asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
  });
});
