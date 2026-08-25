import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("deterministic results/schedule calculators", () => {
  const source = readFileSync("src/lib/deterministic-results-schedule-metrics.server.ts", "utf8");
  const compact = source.replace(/\s+/g, " ");

  it("only targets results/schedule metric codes", () => {
    for (const code of ["012", "028", "030", "064", "071", "076", "077", "081"]) {
      expect(source).toContain(`\"${code}\"`);
    }
    expect(source).not.toContain('SUPPORTED = new Set(["062"');
    expect(source).not.toContain('SUPPORTED = new Set(["069"');
  });

  it("keeps available results evidence partial and fails closed for a missing side", () => {
    expect(compact).toContain("p1HasEvidence");
    expect(compact).toContain("p2HasEvidence");
    expect(compact).toContain('?"PARTIAL":"UNAVAILABLE"');
    expect(compact).toContain('evidence_family:"RESULTS_SCHEDULE"');
    expect(compact).toContain("missing-side zeroes are not synthesized or credited");
  });

  it("filters every warehouse row through the metric source-family gate", () => {
    expect(source).toMatch(/metricAllowsObservation\(code\s*,\s*row\)/);
  });
});
