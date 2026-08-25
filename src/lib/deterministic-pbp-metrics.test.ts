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

  it("runs deterministic PBP before live fallback", () => {
    const deterministicIndex = researcher.indexOf("deterministicPbpMetric({metricCode:metric.code,p1,p2,asOfDate:date})");
    const liveIndex = researcher.indexOf("finalMetricWiringResearcher.metrics({...input,context,metrics:liveMissing})");
    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(liveIndex).toBeGreaterThan(deterministicIndex);
  });
});
