import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("deterministic results/schedule calculators", () => {
  const source = readFileSync("src/lib/deterministic-results-schedule-metrics.server.ts", "utf8");

  it("only targets results/schedule metric codes", () => {
    for (const code of ["012", "028", "030", "064", "071", "076", "077", "081"]) {
      expect(source).toContain(`\"${code}\"`);
    }
    expect(source).not.toContain('SUPPORTED = new Set(["062"');
    expect(source).not.toContain('SUPPORTED = new Set(["069"');
  });

  it("keeps deterministic results/schedule output PARTIAL rather than inventing a complete score", () => {
    expect(source).toContain('p1_treatment: "PARTIAL"');
    expect(source).toContain('p2_treatment: "PARTIAL"');
    expect(source).toContain('evidence_family: "RESULTS_SCHEDULE"');
  });

  it("filters every warehouse row through the metric source-family gate", () => {
    expect(source).toContain("metricAllowsObservation(code, row)");
  });
});
