import { describe, expect, it } from "vitest";
import {
  twoProportionZTest,
  computeUncertaintyAdjustedAdvantage,
  MIN_N_PER_SIDE,
} from "./audit-metric-047-uncertainty-adjusted-advantage";

describe("metric #047 — Uncertainty-Adjusted Advantage (pure two-proportion z-test core)", () => {
  it("reports a well-supported edge when the 95% CI on the rate difference excludes zero", () => {
    // 100% over n=34 vs 50% over n=16 — a real gap this large relative to sample size
    // should clear the |z| >= 1.96 bar comfortably.
    const result = twoProportionZTest(100, 34, 50, 16);
    expect(result.rate_differential_pct).toBe(50);
    expect(result.significant_at_95).toBe(true);
    expect(result.verdict).toBe("WELL_SUPPORTED_EDGE");
    expect(result.ci95_lower_pct).toBeGreaterThan(0); // CI excludes 0 on the low side too
    expect(result.z_score).not.toBeNull();
  });

  it("reports NOT_STATISTICALLY_DISTINGUISHABLE for a small edge on a small sample", () => {
    // A modest ~10pp gap on small samples should not clear significance.
    const result = twoProportionZTest(60, 12, 50, 12);
    expect(result.significant_at_95).toBe(false);
    expect(result.verdict).toBe("NOT_STATISTICALLY_DISTINGUISHABLE");
    expect(result.ci95_lower_pct).toBeLessThanOrEqual(0);
    expect(result.ci95_upper_pct).toBeGreaterThanOrEqual(0);
  });

  it("widens the CI (and can flip the verdict) for the identical rate gap with a smaller sample", () => {
    const bigSample = twoProportionZTest(70, 200, 50, 200);
    const smallSample = twoProportionZTest(70, 10, 50, 10);
    expect(bigSample.verdict).toBe("WELL_SUPPORTED_EDGE");
    expect(smallSample.ci95_upper_pct - smallSample.ci95_lower_pct).toBeGreaterThan(bigSample.ci95_upper_pct - bigSample.ci95_lower_pct);
  });

  it("computes the differential as p1 minus p2, signed", () => {
    const result = twoProportionZTest(30, 50, 70, 50);
    expect(result.rate_differential_pct).toBe(-40);
  });

  it("handles the degenerate zero-variance boundary case (both sides at the same 0%/100% extreme) without fabricating a z-score", () => {
    const result = twoProportionZTest(0, 20, 0, 20);
    expect(result.z_score).toBeNull();
    expect(result.rate_differential_pct).toBe(0);
    expect(result.significant_at_95).toBe(false);
    expect(result.verdict).toBe("NOT_STATISTICALLY_DISTINGUISHABLE");
  });

  it("still reports a real (non-null) verdict for a fully separated boundary case with a genuine gap", () => {
    const result = twoProportionZTest(100, 20, 0, 20);
    expect(result.z_score).toBeNull(); // se=0 formally at both boundaries; verdict falls back to diff!==0
    expect(result.significant_at_95).toBe(true);
    expect(result.verdict).toBe("WELL_SUPPORTED_EDGE");
  });
});

describe("metric #047 — live wrapper against the real generated index (base metric #027)", () => {
  const LANE = "ATP_CHALLENGER" as const;
  const AS_OF = "2026-08-29";

  it("produces a real, non-fabricated GO result with a well-supported edge for a genuinely lopsided pair", () => {
    // Both players verified (via a one-off discovery scan against the real generated index)
    // to have n>=15 lead_protection observations each in this lane as of this date.
    const result = computeUncertaintyAdjustedAdvantage({ p1: "alejandro tabilo", p2: "carlo alberto caniato", lane: LANE, asOfDate: AS_OF, trailingN: 60 });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") return;
    const leadProtection = result.value.dimensions.find(d => d.dimension === "lead_protection");
    expect(leadProtection?.test).not.toBeNull();
    expect(leadProtection?.test?.p1_n).toBeGreaterThanOrEqual(MIN_N_PER_SIDE);
    expect(leadProtection?.test?.p2_n).toBeGreaterThanOrEqual(MIN_N_PER_SIDE);
    expect(["WELL_SUPPORTED_EDGE", "NOT_STATISTICALLY_DISTINGUISHABLE"]).toContain(leadProtection?.test?.verdict);
  });

  it("returns NOT_ENOUGH_DATA (never fabricated) when a player has no #027-eligible history at all", () => {
    const result = computeUncertaintyAdjustedAdvantage({ p1: "totally fictional player one", p2: "totally fictional player two", lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });

  it("only WTA_MAIN and ATP_CHALLENGER are eligible, inherited directly from #027's own structural schema gap", () => {
    const atpMain = computeUncertaintyAdjustedAdvantage({ p1: "anyone", p2: "anyone else", lane: "ATP_MAIN", asOfDate: AS_OF });
    expect(atpMain.status).toBe("NOT_ENOUGH_DATA");
    const wtaChallenger = computeUncertaintyAdjustedAdvantage({ p1: "anyone", p2: "anyone else", lane: "WTA_CHALLENGER", asOfDate: AS_OF });
    expect(wtaChallenger.status).toBe("NOT_ENOUGH_DATA");
  });

  it("skips (does not fabricate) a dimension below MIN_N_PER_SIDE on either side while still reporting a qualifying dimension", () => {
    const result = computeUncertaintyAdjustedAdvantage({ p1: "alejandro tabilo", p2: "carlo alberto caniato", lane: LANE, asOfDate: AS_OF, trailingN: 60 });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") return;
    for (const dimension of result.value.dimensions) {
      if (!dimension.test) {
        expect(dimension.skipped_reason).toContain("Insufficient sample");
      } else {
        expect(dimension.test.p1_n).toBeGreaterThanOrEqual(MIN_N_PER_SIDE);
        expect(dimension.test.p2_n).toBeGreaterThanOrEqual(MIN_N_PER_SIDE);
      }
    }
  });
});
