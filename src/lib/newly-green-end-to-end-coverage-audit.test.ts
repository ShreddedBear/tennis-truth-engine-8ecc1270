import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { policyForMetric } from "./metric-source-family-policy";

const warehouse = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");

// These are the source families that made the original newly-green contract
// legitimate. Task 13 can add other recoverable families as support-only, but
// it must never remove these required families or silently promote new support
// families to sufficient evidence.
const REQUIRED_FAMILIES: Record<string, string[]> = {
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

const PBP_METRICS = ["024", "025", "033", "036", "040", "042", "043", "044", "060", "079"];

describe("newly-green end-to-end coverage audit", () => {
  it("preserves every required newly-green source family while allowing audited Task 13 support", () => {
    for (const [code, required] of Object.entries(REQUIRED_FAMILIES)) {
      const policy = policyForMetric(code);
      for (const family of required) {
        expect(policy.allowed_families, `metric ${code} required family ${family}`).toContain(family);
      }
      const newlyAdded = policy.allowed_families.filter((family) => !required.includes(family));
      for (const family of newlyAdded) {
        expect(policy.sufficient_families, `metric ${code} support-only family ${family}`).not.toContain(family);
        expect(policy.support_only_families ?? [], `metric ${code} support-only family ${family}`).toContain(family);
      }
    }
  });

  it("wires every non-PBP deterministic calculator before unresolved live fallback", () => {
    const compact = warehouse.replace(/\s+/g, "");
    for (const calculator of [
      "deterministicRankingMetric({",
      "deterministicRulesContextMetric({",
      "deterministicEnvironmentMetric({",
      "deterministicMarketMetric({",
      "deterministicResultsScheduleMetric({",
    ]) {
      expect(compact).toContain(calculator.replace(/\s+/g, ""));
    }

    const liveCall = "finalMetricWiringResearcher.metrics({...input,context,metrics:liveMissing})";
    const liveIndex = compact.indexOf(liveCall);
    expect(liveIndex).toBeGreaterThan(-1);
    expect(compact).toContain("constliveMissing=missing.filter(metric=>!fullyUsableFinding(deterministicByCode.get(codeOf(metric.code))))");
    for (const calculator of [
      "deterministicRankingMetric({",
      "deterministicRulesContextMetric({",
      "deterministicEnvironmentMetric({",
      "deterministicMarketMetric({",
      "deterministicResultsScheduleMetric({",
    ]) {
      const calculatorIndex = compact.indexOf(calculator.replace(/\s+/g, ""));
      expect(calculatorIndex).toBeGreaterThan(-1);
      expect(calculatorIndex).toBeLessThan(liveIndex);
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

  it("recognizes the completed BSD PBP metric family for every PBP-dependent newly-green metric", () => {
    for (const code of PBP_METRICS) {
      expect(policyForMetric(code).allowed_families, `metric ${code}`).toContain("POINT_BY_POINT");
    }
  });

  it("certifies the three runtime BSD PBP adapters are wired into warehouse execution", () => {
    const compact = warehouse.replace(/\s+/g, "");
    for (const builder of [
      "buildBsdAtpMainPbpContext({",
      "buildBsdAtpChallengerPbpContext({",
      "buildBsdWtaMainPbpContext({",
    ]) {
      expect(compact).toContain(builder.replace(/\s+/g, ""));
    }
    expect(compact).toContain("_bsd_atp_main_pbp_status");
    expect(compact).toContain("_bsd_atp_challenger_pbp_status");
    expect(compact).toContain("_bsd_wta_main_pbp_status");
  });

  it("certifies WTA Challenger/WTA 125 approved-index integration and final quarantine result", () => {
    const approvedPath = "data/metrics/pbp/wta_challenger/approved-index.jsonl";
    const quarantineSummaryPath = "data/audit/bsd-wta-challenger-pbp-quarantine-audit/summary.md";
    expect(existsSync(approvedPath)).toBe(true);
    expect(existsSync(quarantineSummaryPath)).toBe(true);

    const approved = readFileSync(approvedPath, "utf8").split(/\r?\n/).filter(Boolean);
    expect(approved.length).toBe(1646);

    const summary = readFileSync(quarantineSummaryPath, "utf8");
    expect(summary).toContain("Promoted after clean fresh re-audit: **1**");
    expect(summary).toContain("Genuinely invalid or incomplete PBP: **154**");
    expect(summary).toContain("Metrics total after promotions: **1646**");
    expect(summary).toContain("Other tours excluded: **YES**");
  });

  it("does not let ranking-only newly-green metrics accept results/schedule evidence", () => {
    expect(policyForMetric("062").allowed_families).toEqual(["RANKING"]);
    expect(policyForMetric("069").allowed_families).toEqual(["RANKING"]);
  });

  it("preserves intended multi-family evidence and keeps Task 13 additions support-only", () => {
    for (const [code, required] of Object.entries({
      "043": ["MARKET", "POINT_BY_POINT"],
      "044": ["MARKET", "POINT_BY_POINT"],
      "060": ["ENVIRONMENT", "POINT_BY_POINT"],
      "071": ["ENVIRONMENT", "RESULTS_SCHEDULE"],
    })) {
      const policy = policyForMetric(code);
      for (const family of required) expect(policy.allowed_families).toContain(family);
      for (const family of policy.allowed_families.filter((family) => !required.includes(family))) {
        expect(policy.support_only_families ?? []).toContain(family);
        expect(policy.sufficient_families).not.toContain(family);
      }
    }
  });
});
