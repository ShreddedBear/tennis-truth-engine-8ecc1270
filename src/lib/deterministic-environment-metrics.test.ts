import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const calculator = readFileSync("src/lib/deterministic-environment-metrics.server.ts", "utf8").replace(/\s+/g, " ");
const researcher = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8").replace(/\s+/g, " ");

describe("deterministic environment metric layer", () => {
  it("is limited to environment-enabled metrics", () => {
    expect(calculator).toContain('new Set(["021", "030", "060", "071"])');
    expect(calculator).toContain('metricAllowsObservation(code, row)');
    expect(calculator).toContain('.eq("source_id", "open_meteo")');
    expect(calculator).toContain('.eq("observation_type", "ENVIRONMENT")');
  });

  it("keeps shared environment evidence partial", () => {
    expect(calculator).toContain('p1_treatment: "PARTIAL"');
    expect(calculator).toContain('p2_treatment: "PARTIAL"');
    expect(calculator).toContain('evidence_family: "ENVIRONMENT"');
    expect(calculator).toContain('shared match environment');
  });

  it("runs environment calculation before live fallback", () => {
    const deterministicIndex = researcher.indexOf("deterministicEnvironmentMetric({metricCode:metric.code,p1,p2,asOfDate:date,tournament})");
    const liveIndex = researcher.indexOf("finalMetricWiringResearcher.metrics({...input,context,metrics:missing})");
    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(liveIndex).toBeGreaterThan(deterministicIndex);
  });
});
