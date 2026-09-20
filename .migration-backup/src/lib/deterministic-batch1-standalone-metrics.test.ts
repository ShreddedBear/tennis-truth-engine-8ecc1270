import { describe, expect, it } from "vitest";
import { deterministicBatch1StandaloneMetric } from "./deterministic-batch1-standalone-metrics.server";

// Integration-style tests: these call the real wired tier
// (deterministic-batch1-standalone-metrics.server.ts), which itself calls
// the real standalone modules (027/031/041/046/051) against the real
// generated static history index (data/generated/tennis-runtime-index.json)
// -- not a synthetic fixture. This is the same tier
// warehouse-first-researcher.server.ts now calls for these five codes, so a
// GO result here is proof the reconnection in
// docs/audit-task-new-batch1-standalone-modules-wiring.md actually produces
// a real, non-fabricated MetricFinding on the live path, not just that the
// underlying modules work in isolation.
//
// Player pair chosen by inspecting the generated index directly (not
// guessed): "zdenek kolar" and "andrea collarini" are ATP_CHALLENGER's two
// most-played players (266/257 matches respectively) with 53 common
// opponents and near-universal set_scores coverage, so all five codes
// should reach GO for this pair/lane/date.
const P1 = "zdenek kolar";
const P2 = "andrea collarini";
const LANE = "ATP_CHALLENGER" as const;
const AS_OF = "2026-08-29"; // after all indexed history for this pair

describe("deterministicBatch1StandaloneMetric (live pipeline wiring for 027/029/031/041/046/051)", () => {
  it("returns null for a code it does not own", async () => {
    const result = await deterministicBatch1StandaloneMetric({ metricCode: "005", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
  });

  it("returns null (falls through) when tourFamily is not resolved", async () => {
    const result = await deterministicBatch1StandaloneMetric({ metricCode: "027", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: null });
    expect(result).toBeNull();
  });

  it("027 Opponent Finishing Ability: produces a real, non-fabricated finding for a data-rich ATP_CHALLENGER pair", async () => {
    const result = await deterministicBatch1StandaloneMetric({ metricCode: "027", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).not.toBeNull();
    expect(result!.p1_treatment).toBe("RECONSTRUCTED");
    expect(result!.p2_treatment).toBe("RECONSTRUCTED");
    expect(result!.p1_value).toMatch(/lead_protection_rate_pct=/);
    expect(result!.p2_value).toMatch(/closing_as_underdog_rate_pct=/);
    expect(result!.evidence_family).toBe("STANDALONE_OPPONENT_FINISHING_ABILITY");
    expect(result!.sources.length).toBeGreaterThan(0);
  });

  it("027: falls through to null on a lane with no set-sequence data (ATP_MAIN)", async () => {
    const result = await deterministicBatch1StandaloneMetric({ metricCode: "027", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: "ATP_MAIN" });
    expect(result).toBeNull();
  });

  it("029 Psychological Response Proxy: produces a real, non-fabricated close-set-loss response finding for a data-rich ATP_CHALLENGER pair", async () => {
    const result = await deterministicBatch1StandaloneMetric({ metricCode: "029", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).not.toBeNull();
    expect(result!.p1_treatment).toBe("RECONSTRUCTED");
    expect(result!.p2_treatment).toBe("RECONSTRUCTED");
    expect(result!.p1_value).toMatch(/after_close_set_loss_next_set_win_pct=/);
    expect(result!.p2_value).toMatch(/baseline_match_win_rate_pct=/);
    expect(result!.evidence_family).toBe("STANDALONE_PSYCHOLOGICAL_RESPONSE_PROXY");
    expect(result!.sources.length).toBeGreaterThan(0);
  });

  it("029: falls through to null on a lane with no set-sequence data (ATP_MAIN)", async () => {
    const result = await deterministicBatch1StandaloneMetric({ metricCode: "029", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: "ATP_MAIN" });
    expect(result).toBeNull();
  });

  it("031 Common-Opponent Point Differential: produces a real finding with matching common_opponents_n on both sides", async () => {
    const result = await deterministicBatch1StandaloneMetric({ metricCode: "031", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).not.toBeNull();
    const p1Match = result!.p1_value!.match(/common_opponents_n=(\d+)/);
    const p2Match = result!.p2_value!.match(/common_opponents_n=(\d+)/);
    expect(p1Match).not.toBeNull();
    expect(p1Match![1]).toBe(p2Match![1]);
    expect(Number(p1Match![1])).toBeGreaterThan(0);
  });

  it("041 Hidden Improvement Detector: produces a real per-player flag finding", async () => {
    const result = await deterministicBatch1StandaloneMetric({ metricCode: "041", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).not.toBeNull();
    expect(result!.p1_value).toMatch(/flag=(IMPROVEMENT_HIDDEN_BY_RECORD|NO_HIDDEN_IMPROVEMENT_DETECTED)/);
    expect(result!.p2_value).toMatch(/flag=(IMPROVEMENT_HIDDEN_BY_RECORD|NO_HIDDEN_IMPROVEMENT_DETECTED)/);
  });

  it("046 Match-State Elo: produces a real finding on the eligible ATP_CHALLENGER lane", async () => {
    const result = await deterministicBatch1StandaloneMetric({ metricCode: "046", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).not.toBeNull();
    expect(result!.p1_value).toMatch(/elo_after_(winning|losing)_set1=/);
  });

  it("051 Opponent-Specific Probability: produces a real shrunk-probability finding (GO even with 0 direct H2H meetings)", async () => {
    const result = await deterministicBatch1StandaloneMetric({ metricCode: "051", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).not.toBeNull();
    expect(result!.p1_value).toMatch(/shrunk_win_probability_pct=/);
    expect(result!.p2_value).toMatch(/shrunk_win_probability_pct=/);
  });

  it("returns null for an unknown/nonexistent player pair (honest NOT_ENOUGH_DATA fall-through, never a guessed value)", async () => {
    const result = await deterministicBatch1StandaloneMetric({ metricCode: "046", p1: "totally fictional player one", p2: "totally fictional player two", asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
  });
});
