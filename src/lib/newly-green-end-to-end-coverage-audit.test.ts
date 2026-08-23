import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { policyForMetric } from "./metric-source-family-policy";

const warehouse = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");

const EXPECTED_FAMILIES: Record<string, string[]> = {
  "012": ["RESULTS_SCHEDULE"],
  "015": ["MARKET"],
  "019": ["MARKET"],
  "021": ["ENVIRONMENT"],
  "024": ["POINT_BY_POINT"],
  "025": ["POINT_BY_POINT"],
  "028": ["RESULTS_SCHEDULE"],
  "030": ["RESULTS_SCHEDULE", "ENVIRONMENT"],
  "033": ["POINT_BY_POINT"],
  "036": ["POINT_BY_POINT"],
  "040": ["POINT_BY_POINT"],
  "042": ["POINT_BY_POINT"],
  "043": ["MARKET", "POINT_BY_POINT"],
  "044": ["MARKET", "POINT_BY_POINT"],
  "060": ["ENVIRONMENT", "POINT_BY_POINT"],
  "062": ["RANKING"],
  "064": ["RESULTS_SCHEDULE"],
  "069": ["RANKING"],
  "071": ["RESULTS_SCHEDULE", "ENVIRONMENT"],
  "075": ["RULES_CONTEXT"],
  "076": ["RESULTS_SCHEDULE"],
  "077": ["RESULTS_SCHEDULE"],
  "079": ["POINT_BY_POINT"],
  "081": ["RESULTS_SCHEDULE"],
};

const NON_PBP_DETERMINISTIC = [
  "012", "015", "019", "021", "028", "030", "062", "064", "069", "071", "075", "076", "077", "081",
];

const PBP_DEPENDENT = ["024", "025", "033", "036", "040", "042", "043", "044", "060", "079"];

describe("newly-green end-to-end coverage audit", () => {
  it("keeps every newly-green metric on the exact intended source families", () => {
    for (const [code, expected] of Object.entries(EXPECTED_FAMILIES)) {
      const actual = [...policyForMetric(code).allowed_families].sort();
      expect(actual, `metric ${code}`).toEqual([...expected].sort());
    }
  });

  it("wires every non-PBP deterministic calculator into warehouse execution", () => {
    const normalized = warehouse.replace(/\s+/g, " ");
    expect(normalized).toContain("deterministicRankingMetric({");
    expect(normalized).toContain("deterministicRulesContextMetric({");
    expect(normalized).toContain("deterministicEnvironmentMetric({");
    expect(normalized).toContain("deterministicMarketMetric({");
    expect(normalized).toContain("deterministicResultsScheduleMetric({");

    const liveIndex = normalized.indexOf("finalMetricWiringResearcher.metrics({ ...input, context, metrics: missing })");
    expect(liveIndex).toBeGreaterThan(-1);
    for (const calculator of [
      "deterministicRankingMetric({",
      "deterministicRulesContextMetric({",
      "deterministicEnvironmentMetric({",
      "deterministicMarketMetric({",
      "deterministicResultsScheduleMetric({",
    ]) {
      expect(normalized.indexOf(calculator)).toBeGreaterThan(-1);
      expect(normalized.indexOf(calculator)).toBeLessThan(liveIndex);
    }
  });

  it("has no non-PBP newly-green metric left without a deterministic implementation path", () => {
    const covered = new Set([
      "012", "028", "030", "064", "071", "076", "077", "081",
      "015", "019",
      "021",
      "062", "069",
      "075",
    ]);
    expect([...NON_PBP_DETERMINISTIC].filter((code) => !covered.has(code))).toEqual([]);
  });

  it("keeps the remaining unfinished group explicitly limited to PBP-dependent metrics", () => {
    expect(PBP_DEPENDENT).toEqual(["024", "025", "033", "036", "040", "042", "043", "044", "060", "079"]);
    for (const code of PBP_DEPENDENT) {
      expect(policyForMetric(code).allowed_families).toContain("POINT_BY_POINT");
    }
  });

  it("does not let ranking metrics accept results/schedule evidence", () => {
    expect(policyForMetric("062").allowed_families).toEqual(["RANKING"]);
    expect(policyForMetric("069").allowed_families).toEqual(["RANKING"]);
  });

  it("preserves intentional multi-family support only where designed", () => {
    expect([...policyForMetric("043").allowed_families].sort()).toEqual(["MARKET", "POINT_BY_POINT"]);
    expect([...policyForMetric("044").allowed_families].sort()).toEqual(["MARKET", "POINT_BY_POINT"]);
    expect([...policyForMetric("060").allowed_families].sort()).toEqual(["ENVIRONMENT", "POINT_BY_POINT"]);
    expect([...policyForMetric("071").allowed_families].sort()).toEqual(["ENVIRONMENT", "RESULTS_SCHEDULE"]);
  });
});
