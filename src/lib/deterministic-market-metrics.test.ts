import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const calc = readFileSync("src/lib/deterministic-market-metrics.server.ts", "utf8").replace(/\s+/g, " ");
const researcher = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8").replace(/\s+/g, "");

describe("deterministic market metrics", () => {
  it("is scoped only to market metrics 015 019 043 044", () => {
    expect(calc).toContain('new Set(["015", "019", "043", "044"])');
    expect(calc).toContain('metricAllowsObservation(code, row)');
    expect(calc).toContain('.eq("source_id", "odds_api")');
    expect(calc).toContain('.eq("observation_type", "MARKET")');
  });

  it("uses the verified June 6 2020 historical floor and de-vig math", () => {
    expect(calc).toContain('const from = "2020-06-06"');
    expect(calc).toContain('p / (p + q)');
    expect(calc).toContain('probability_movement');
    expect(calc).toContain('favorite_share');
  });

  it("keeps 043 and 044 support-only while 015 and 019 can be reconstructed", () => {
    expect(calc).toContain('const isCoreMarket = code === "015" || code === "019"');
    expect(calc).toContain('isCoreMarket ? "RECONSTRUCTED" : "PARTIAL"');
  });

  it("runs market calculations before unresolved live fallback", () => {
    const deterministicIndex = researcher.indexOf("deterministicMarketMetric");
    const liveIndex = researcher.indexOf("finalMetricWiringResearcher.metrics");
    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(liveIndex).toBeGreaterThan(deterministicIndex);
  });
});
