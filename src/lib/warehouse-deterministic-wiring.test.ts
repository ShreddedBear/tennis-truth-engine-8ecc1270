import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const researcher = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");
const compact = researcher.replace(/\s+/g, "");

describe("warehouse deterministic calculator wiring", () => {
  it("runs deterministic results/schedule calculations before live fallback", () => {
    expect(researcher).toContain('import { deterministicResultsScheduleMetric } from "./deterministic-results-schedule-metrics.server"');
    const deterministicIndex = compact.indexOf("deterministicResultsScheduleMetric({");
    const liveIndex = compact.indexOf("finalMetricWiringResearcher.metrics({...input,context,metrics:liveMissing})");
    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(liveIndex).toBeGreaterThan(deterministicIndex);
  });

  it("removes fully usable local findings from live fallback", () => {
    expect(compact).toContain("constliveMissing=missing.filter(metric=>!fullyUsableFinding(deterministicByCode.get(codeOf(metric.code))))");
    expect(compact).toContain("USABLE.has(row.p1_treatment)&&USABLE.has(row.p2_treatment)&&row.p1_value&&row.p2_value");
    expect(compact).toContain("metrics:liveMissing");
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

  it("deduplicates approved PBP observations by source and match identity", () => {
    expect(compact).toContain('if(row?.family==="POINT_BY_POINT"&&matchId)return`PBP|${row?.source??""}|${matchId}`');
    expect(compact).toContain("if(seen.has(key))returnfalse");
    expect(compact).toContain("seen.add(key)");
  });
});
