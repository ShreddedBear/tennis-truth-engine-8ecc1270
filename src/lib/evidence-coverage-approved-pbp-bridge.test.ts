import { describe, expect, it } from "vitest";
import { buildBsdWtaChallengerPbpContext } from "./bsd-wta-challenger-pbp.server";
import { deterministicPbpMetricFromPacket } from "./deterministic-pbp-metrics.server";
import { sampleVerifiedEvidenceIndexMatch } from "./evidence-index-match-sampler.server";

describe("approved repository PBP evidence bridge", () => {
  it("samples WTA Challenger from the approved PBP index rather than generic WTA 125 history", async () => {
    const sample = await sampleVerifiedEvidenceIndexMatch("WTA_CHALLENGER");
    expect(sample).not.toBeNull();
    expect(sample?.sampling_source).toBe("verified_pbp_index");
    expect(sample?.match_id).toMatch(/^approved-wta-challenger-pbp:/);
    expect(sample?.tournament.toLowerCase()).toMatch(/wta.*125|125k/);
  });

  it("exposes approved WTA Challenger PBP as two player-oriented observations and credits metric 016 conservatively", async () => {
    const result = await buildBsdWtaChallengerPbpContext({
      metrics: [{ code: "016", name: "Point-by-Point & Score-State Metrics" }],
      p1: "Lin Zhu",
      p2: "Lulu Sun",
      asOfDate: "2026-01-27",
      context: "Tournament: WTA 125K Manila, Philippines Women Singles | Level: WTA CHALLENGER | Tour: WTA CHALLENGER | Date: 2026-01-27",
    });
    expect(result.status.eligible).toBe(true);
    expect(result.status.matches_used).toBeGreaterThan(0);
    const entry = result.packet["016"] as any;
    expect(entry?.tour_guard).toBe("STRICT_WTA_CHALLENGER_WTA125_ONLY");
    expect(entry?.observed_families).toEqual(["POINT_BY_POINT"]);
    expect(entry?.observations.some((row: any) => row.player === "Lin Zhu" && row.opponent === "Lulu Sun")).toBe(true);
    expect(entry?.observations.some((row: any) => row.player === "Lulu Sun" && row.opponent === "Lin Zhu")).toBe(true);

    const finding = deterministicPbpMetricFromPacket({
      metricCode: "016",
      p1: "Lin Zhu",
      p2: "Lulu Sun",
      asOfDate: "2026-01-27",
      packet: result.packet,
    });
    expect(finding?.evidence_family).toBe("POINT_BY_POINT");
    expect(finding?.p1_treatment).toBe("PARTIAL");
    expect(finding?.p2_treatment).toBe("PARTIAL");
    expect(finding?.p1_value).toContain("point_rows=");
    expect(finding?.p2_value).toContain("point_rows=");
  });

  it("fails closed when WTA Challenger context is not explicit", async () => {
    const result = await buildBsdWtaChallengerPbpContext({
      metrics: [{ code: "016", name: "Point-by-Point & Score-State Metrics" }],
      p1: "Lin Zhu",
      p2: "Lulu Sun",
      asOfDate: "2026-01-27",
      context: "Tour: WTA MAIN | Tournament: Manila",
    });
    expect(result.status.eligible).toBe(false);
    expect(result.packet).toEqual({});
  });
});
