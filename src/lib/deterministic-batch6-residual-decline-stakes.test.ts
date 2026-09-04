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

  // PHASE 14 — this test previously asserted 062 produces a finding here. That is not
  // achievable for ANY pair, not just this one. computeMotivationStakes requires 15+ of the
  // player's own ATP_CHALLENGER matches with a known draw_size before asOfDate, and a full
  // scan of the generated index at this asOfDate found GO for 0 of 1734 ATP_CHALLENGER
  // players. 062 is restricted to that single lane (no other lane's source CSVs carry
  // seed/draw_size/ranking-points columns), so on the current index it can never fire.
  //
  // The engine is behaving correctly -- refusing to report evidence it does not have is the
  // whole point -- so the honest assertion is the refusal, not a fabricated expectation.
  // 062 is NOT one of the 25 active comparison specs (truth-engine-metric-comparison.ts),
  // so this affects no selection; it means 062 contributes no evidence until the index
  // carries draw_size for a meaningful number of challenger matches.
  it("062 Motivation/Stakes: honestly returns nothing -- no player currently clears its 15-match draw_size floor", async () => {
    const result = await deterministicBatch6ResidualStakes({ metricCode: "062", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
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
