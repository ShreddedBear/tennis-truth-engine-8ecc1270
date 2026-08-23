import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const researcher = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");

describe("warehouse deterministic calculator wiring", () => {
  it("runs deterministic results/schedule calculations before live fallback", () => {
    expect(researcher).toContain('import { deterministicResultsScheduleMetric } from "./deterministic-results-schedule-metrics.server"');
    const deterministicIndex = researcher.indexOf("deterministicResultsScheduleMetric({");
    const liveIndex = researcher.indexOf("finalMetricWiringResearcher.metrics({ ...input, context, metrics: missing })");
    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(liveIndex).toBeGreaterThan(deterministicIndex);
  });

  it("does not let a live unavailable result erase deterministic warehouse evidence", () => {
    expect(researcher).toContain("deterministic ?? live");
    expect(researcher).toContain("USABLE.has(live.p1_treatment) || USABLE.has(live.p2_treatment)");
  });

  it("passes deterministic components into the metric-scoped fallback context", () => {
    expect(researcher).toContain("deterministic_components");
    expect(researcher).toContain("evidence_family: row.evidence_family");
    expect(researcher).toContain("treatment: row.p1_treatment");
  });
});
