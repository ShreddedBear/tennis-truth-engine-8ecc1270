import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { certifyMetricFinding } from "./metric-certification";
import type { MetricFinding } from "./audit-pipeline";

const calc = readFileSync("src/lib/deterministic-results-schedule-metrics.server.ts", "utf8").replace(/\s+/g, " ");

// The exact text shape valueFor(code) produces for code "012" in
// deterministic-results-schedule-metrics.server.ts: bare match counts and a
// last-match date, with none of the exact-component wording (matches-in-7-
// days, minutes, sets/games, three-setters, late finish, rest-hours,
// qualifying, travel/timezone) the registered 012 policy requires.
function bareMatchCountFinding(): MetricFinding {
  const text = "matches_14d=2; matches_30d=4; matches_52w=30; days_since_last_match=3";
  return { metric_code: "012", p1_value: text, p2_value: text, p1_treatment: "PARTIAL", p2_treatment: "PARTIAL", differential: null, evidence_family: "RESULTS_SCHEDULE", reliability: 80, sample: "x", unavailable_reason: null, sources: [{ source_name: "warehouse", url: null, retrieved_at: null }] };
}

describe("deterministic-results-schedule-metrics.server.ts wraps its return in certifyMetricFinding", () => {
  it("calls certifyMetricFinding on the returned finding", () => {
    expect(calc).toContain('import { certifyMetricFinding } from "./metric-certification"');
    expect(calc).toContain("return certifyMetricFinding({");
  });

  it("downgrades the exact bare-match-count text it produces for code 012 to UNAVAILABLE, not PARTIAL", () => {
    // Mirrors metric-certification.test.ts's "rejects a 28-day/date-only
    // proxy as evidence for the exact family" case, using the real text
    // shape this file's own valueFor(code) produces for 012/077, proving the
    // wrap actually catches it rather than a hand-picked example.
    const out = certifyMetricFinding(bareMatchCountFinding());
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });

  it("leaves code 028 (Scheduling Context, no registered policy) unaffected", () => {
    const text = "matches_30d=4; distinct_tournaments_30d=2; days_since_last_match=3";
    const finding: MetricFinding = { metric_code: "028", p1_value: text, p2_value: text, p1_treatment: "PARTIAL", p2_treatment: "PARTIAL", differential: null, evidence_family: "RESULTS_SCHEDULE", reliability: 80, sample: "x", unavailable_reason: null, sources: [{ source_name: "warehouse", url: null, retrieved_at: null }] };
    const out = certifyMetricFinding(finding);
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("PARTIAL");
  });
});
