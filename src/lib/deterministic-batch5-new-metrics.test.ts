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

  it("061 Historical Twin Match Search: produces a real, symmetric twin-match finding", async () => {
    const result = await deterministicBatch5NewMetrics({ metricCode: "061", p1: "andrea collarini", p2: "zdenek kolar", asOfDate: AS_OF, tourFamily: LANE, surface: "hard" });
    expect(result).not.toBeNull();
    expect(result!.p1_treatment).toBe("RECONSTRUCTED");
    expect(result!.p2_treatment).toBe("RECONSTRUCTED");
    expect(result!.p1_value).toBe(result!.p2_value);
    expect(result!.p1_value).toMatch(/twin_matches_found=/);
    expect(result!.evidence_family).toBe("STANDALONE_HISTORICAL_TWIN_MATCH_SEARCH");
    expect(result!.sources.length).toBeGreaterThan(0);
  });

  it("061: falls through to null for a nonexistent player pair", async () => {
    const result = await deterministicBatch5NewMetrics({ metricCode: "061", p1: "totally fictional player one", p2: "totally fictional player two", asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
  });
});
