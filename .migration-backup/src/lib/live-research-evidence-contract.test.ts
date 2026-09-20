import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("live research side-specific evidence contract", () => {
  const source = readFileSync(join(process.cwd(), "src/lib/audit-research.server.ts"), "utf8");
  it("requires explicit player/source/sample lineage for each usable side", () => {
    expect(source).toContain("SIDE-SPECIFIC EVIDENCE CONTRACT — REQUIRED");
    expect(source).toContain("p1_value MUST begin exactly with PLAYER=${p1}");
    expect(source).toContain("p2_value MUST begin exactly with PLAYER=${p2}");
    expect(source).toContain("SOURCE=<exact source_name>");
    expect(source).toContain("SAMPLE=<actual side-specific denominator/window>");
  });
  it("requires complete reconstruction inputs and formula without weakening proxy rejection", () => {
    expect(source).toContain("INPUTS=<pipe-separated exact raw input names>");
    expect(source).toContain("FORMULA=<explicit calculation>");
    expect(source).toContain("Every listed input must be sourced, permitted by the metric definition, and actually referenced by the formula");
    expect(source).toContain("Neighboring/proxy fields remain inadmissible");
  });
  it("keeps row sources subordinate to side-specific provenance", () => {
    expect(source).toContain("row-level sources array MUST contain every source named by either side");
    expect(source).toContain("row-level sample field is only a display summary");
  });
});
