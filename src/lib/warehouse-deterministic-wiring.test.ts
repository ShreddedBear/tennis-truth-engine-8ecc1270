import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const researcher = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");
const compact = researcher.replace(/\s+/g, "");

describe("warehouse deterministic calculator wiring", () => {
  it("runs deterministic results/schedule calculations before live fallback", () => {
    expect(researcher).toContain('import { deterministicResultsScheduleMetric } from "./deterministic-results-schedule-metrics.server"');
    const deterministicIndex = compact.indexOf("deterministicResultsScheduleMetric({");
    const liveIndex = compact.indexOf("finalMetricWiringResearcher.metrics({...input,context,metrics:missing})");
    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(liveIndex).toBeGreaterThan(deterministicIndex);
  });

  it("does not let a live unavailable result erase deterministic warehouse evidence", () => {
    expect(compact).toContain("?live:deterministic??live");
    expect(compact).toContain("USABLE.has(live.p1_treatment)||USABLE.has(live.p2_treatment)");
  });

  it("passes deterministic components into the metric-scoped fallback context", () => {
    expect(compact).toContain("deterministic_components");
    expect(compact).toContain("evidence_family:row.evidence_family");
    expect(compact).toContain("treatment:row.p1_treatment");
  });
});
