import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const calc = readFileSync("src/lib/deterministic-pbp-metrics.server.ts", "utf8").replace(/\s+/g, " ");
const researcher = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8").replace(/\s+/g, " ");

describe("deterministic PBP evidence", () => {
  it("is restricted to metrics that explicitly allow point-by-point evidence", () => {
    for (const code of ["024", "025", "033", "036", "040", "042", "043", "044", "060", "079"]) {
      expect(calc).toContain(`\"${code}\"`);
    }
    expect(calc).toContain("metricAllowsObservation(code, row)");
    expect(calc).toContain('["POINT_BY_POINT", "PBP"]');
  });

  it("fails closed by player side and never synthesizes the missing opponent", () => {
    expect(calc).toContain('p1Available ? "PARTIAL" : "UNAVAILABLE"');
    expect(calc).toContain('p2Available ? "PARTIAL" : "UNAVAILABLE"');
    expect(calc).toContain("the missing side is not synthesized or credited");
  });

  it("recovers only already tour-guarded BSD PBP packets as conservative partial evidence", () => {
    expect(calc).toContain("deterministicPbpMetricFromPacket");
    expect(calc).toContain('row?.family === "POINT_BY_POINT"');
    expect(calc).toContain("deterministic tour-guarded BSD PBP");
    expect(researcher).toContain("deterministicPbpMetricFromPacket({metricCode:code,p1,p2,asOfDate:date,packet:observationPacket})");
    expect(researcher).toContain("buildBsdAtpMainPbpContext({metrics:liveMissing,p1,p2");
    expect(researcher).toContain("buildBsdWtaMainPbpContext({metrics:liveMissing,p1,p2");
    expect(researcher).toContain("buildBsdAtpChallengerPbpContext({metrics:liveMissing,p1,p2");
    expect(researcher).toContain("buildBsdWtaChallengerPbpContext({metrics:liveMissing,p1,p2");
  });

  it("uses pair-complete deterministic BSD recovery before the live researcher", () => {
    const deterministicIndex = researcher.indexOf("deterministicPbpMetricFromPacket({metricCode:code,p1,p2,asOfDate:date,packet:observationPacket})");
    const remainingIndex = researcher.indexOf("remainingLiveMissing=liveMissing.filter");
    const liveIndex = researcher.indexOf("finalMetricWiringResearcher.metrics({...input,context,metrics:remainingLiveMissing})");
    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(remainingIndex).toBeGreaterThan(deterministicIndex);
    expect(liveIndex).toBeGreaterThan(remainingIndex);
  });
});
