import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRuleDocument } from "./rule-parser";
import {
  AUTHORITATIVE_METRIC_CATALOG,
  PROCESS_META_CODES,
  PROCESS_META_RATIONALE,
  authoritativeMetricRow,
} from "./authoritative-metric-catalog";

// This is the Task 20 guardrail against a repeat of the Task 17 catalog-mismatch root
// cause: it re-parses public/seed/metrics.txt with the exact algorithm the live system
// uses to seed the `rules` table, and fails if the hand-maintained
// AUTHORITATIVE_METRIC_CATALOG in authoritative-metric-catalog.ts ever drifts from it.
describe("authoritative metric catalog", () => {
  const liveText = readFileSync("public/seed/metrics.txt", "utf8");
  const liveReport = parseRuleDocument(liveText);

  it("the live metrics.txt document parses to exactly 81 sequential rule codes", () => {
    expect(liveReport.expected_rules).toBe(81);
    expect(liveReport.parsed_rules).toBe(81);
    expect(liveReport.rules).toHaveLength(81);
  });

  it("has no duplicate or out-of-range codes in the live parse", () => {
    const codes = liveReport.rules.map((r) => r.rule_code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      const n = Number(code);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(81);
    }
  });

  it("AUTHORITATIVE_METRIC_CATALOG has exactly 81 rows with unique, well-formed codes", () => {
    expect(AUTHORITATIVE_METRIC_CATALOG).toHaveLength(81);
    const codes = AUTHORITATIVE_METRIC_CATALOG.map((r) => r.code);
    expect(new Set(codes).size).toBe(81);
    for (const code of codes) expect(code).toMatch(/^\d{3}$/);
  });

  it("matches the live parse's rule_code -> rule_name mapping exactly", () => {
    const liveByCode = new Map(liveReport.rules.map((r) => [r.rule_code, r.rule_name]));
    for (const row of AUTHORITATIVE_METRIC_CATALOG) {
      expect(liveByCode.get(row.code), `code ${row.code}`).toBe(row.name);
    }
    // Also fail if the live document ever grows/shrinks a code the catalog doesn't know about.
    for (const code of liveByCode.keys()) {
      expect(AUTHORITATIVE_METRIC_CATALOG.some((row) => row.code === code), `unknown live code ${code}`).toBe(true);
    }
  });

  it("every PROCESS_META code has a recorded rationale", () => {
    for (const code of PROCESS_META_CODES) {
      expect(PROCESS_META_RATIONALE[code], `missing rationale for ${code}`).toBeTruthy();
    }
    // And no rationale exists for a code that isn't actually classified PROCESS_META.
    for (const code of Object.keys(PROCESS_META_RATIONALE)) {
      expect(PROCESS_META_CODES).toContain(code);
    }
  });

  it("authoritativeMetricRow resolves both bare and prefixed codes, and rejects unknown ones", () => {
    expect(authoritativeMetricRow("016")?.name).toBe("Point-by-Point & Score-State Metrics");
    expect(authoritativeMetricRow("16")?.name).toBe("Point-by-Point & Score-State Metrics");
    expect(authoritativeMetricRow("metric-016")?.name).toBe("Point-by-Point & Score-State Metrics");
    expect(authoritativeMetricRow("082")).toBeUndefined();
    expect(authoritativeMetricRow("000")).toBeUndefined();
  });
});
