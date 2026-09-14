import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRuleDocument, activationStatus } from "./rule-parser";

// Regression guard for the Task 19 defect: an embedded "120-Match Empirical
// Overlay" sub-section reused numbers 1-6 as its own local list, which the
// sequential-numbering parser silently swallowed into rule codes 004-006 in
// place of the real metrics "Combined Efficiency" / "Recent Form" /
// "Opponent Quality". This test fails loudly if the seed document ever
// reintroduces a colliding numbered heading anywhere in its 81-metric range.
describe("canonical metrics document has no numbering drift", () => {
  const text = readFileSync("public/seed/metrics.txt", "utf8");
  const report = parseRuleDocument(text);

  it("parses to exactly 81 sequential, unique rule codes 001-081", () => {
    expect(report.parsed_rules).toBe(81);
    expect(report.expected_rules).toBe(81);
    expect(activationStatus(report)).toBe("READY");
    const codes = report.rules.map((r) => r.rule_code);
    expect(new Set(codes).size).toBe(81);
    for (let i = 1; i <= 81; i++) expect(codes).toContain(String(i).padStart(3, "0"));
  });

  it("locks in the corrected 004/005/006 identities (previously shadowed by the overlay section)", () => {
    const byCode = new Map(report.rules.map((r) => [r.rule_code, r.rule_name]));
    expect(byCode.get("004")).toBe("Combined Efficiency");
    expect(byCode.get("005")).toBe("Recent Form");
    expect(byCode.get("006")).toBe("Opponent Quality");
  });

  it("never lets a non-canonical heading (e.g. a sub-section list) parse as a rule code", () => {
    for (const rule of report.rules) {
      // Every real rule name must be one of the 81 canonical section titles,
      // not overlay/appendix sub-list text like "Interpretation rules" or
      // "Recalibration rule" (the specific text that used to leak into 005/006).
      expect(rule.rule_name).not.toMatch(/^(Interpretation rules|Recalibration rule|Current empirical priority table|Priority tiers for the master metrics list|Anti-double-counting rule for metrics|Required derived metrics added to the metrics workflow)$/);
    }
  });
});
