import { describe, expect, it } from "vitest";
import { deterministicBatch6ResidualStakes, deterministicBatch6HiddenDecline } from "./deterministic-batch6-residual-decline-stakes.server";

// Integration-style tests against the real generated static history index -- same fixture
// pair as deterministic-batch1/2-new-metrics.test.ts: ATP_CHALLENGER's two most-played
// players, near-universal set_scores coverage.
const P1 = "zdenek kolar";
const P2 = "andrea collarini";
const LANE = "ATP_CHALLENGER" as const;
const AS_OF = "2026-08-29";

describe("deterministicBatch6ResidualStakes (live pipeline wiring for 038/062)", () => {
  it("returns null for a code it does not own", async () => {
    const result = await deterministicBatch6ResidualStakes({ metricCode: "005", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
  });

  it("returns null when tourFamily is not resolved", async () => {
    const result = await deterministicBatch6ResidualStakes({ metricCode: "038", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: null });
    expect(result).toBeNull();
  });

  it("038 Opponent-Adjusted Residual Performance: produces a real, non-fabricated finding for a data-rich ATP_CHALLENGER pair", async () => {
    const result = await deterministicBatch6ResidualStakes({ metricCode: "038", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).not.toBeNull();
    expect(result!.evidence_family).toBe("STANDALONE_OPPONENT_ADJUSTED_RESIDUAL_PERFORMANCE");
    expect(result!.p1_value).toMatch(/games_won_residual_pct=/);
    expect(result!.p2_value).toMatch(/games_won_residual_pct=/);
  });

  it("038: falls through to null on a lane with no broad set_scores coverage (ATP_MAIN)", async () => {
    const result = await deterministicBatch6ResidualStakes({ metricCode: "038", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: "ATP_MAIN" });
    expect(result).toBeNull();
  });

  it("062 Motivation/Stakes: produces a real finding for a data-rich ATP_CHALLENGER pair", async () => {
    const result = await deterministicBatch6ResidualStakes({ metricCode: "062", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).not.toBeNull();
    expect(result!.evidence_family).toBe("STANDALONE_MOTIVATION_STAKES");
    expect(result!.p1_value).toMatch(/seeded_rate_pct=/);
  });

  it("062: falls through to null on a lane with no seed/draw_size source columns (WTA_MAIN)", async () => {
    const result = await deterministicBatch6ResidualStakes({ metricCode: "062", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: "WTA_MAIN" });
    expect(result).toBeNull();
  });
});

describe("deterministicBatch6HiddenDecline (live pipeline wiring for 040)", () => {
  it("returns null for a code it does not own", async () => {
    const result = await deterministicBatch6HiddenDecline({ metricCode: "005", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
  });

  it("returns null when tourFamily is not resolved", async () => {
    const result = await deterministicBatch6HiddenDecline({ metricCode: "040", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: null });
    expect(result).toBeNull();
  });

  it("falls through to null (never crashes) without a live BSD API key configured -- this dev/test environment has none set", async () => {
    const result = await deterministicBatch6HiddenDecline({ metricCode: "040", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
  });
});
