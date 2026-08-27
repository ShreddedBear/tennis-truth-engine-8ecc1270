import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRuleDocument } from "./rule-parser";
import {
  AUTHORITATIVE_METRIC_CATALOG,
  NO_SOURCE_CODES,
  NO_SOURCE_DETERMINATIONS,
  ORPHANED_CATALOG_SECTIONS,
  PLAYER_METRIC_CODES,
  PROCESS_META_CODES,
  PROCESS_META_RATIONALE,
  authoritativeMetricRow,
  isNoSourceCode,
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

  it("locks the player-evidence denominator at 69 (81 total minus 12 process/meta)", () => {
    expect(PROCESS_META_CODES).toHaveLength(12);
    expect(PLAYER_METRIC_CODES).toHaveLength(69);
    expect(PROCESS_META_CODES.length + PLAYER_METRIC_CODES.length).toBe(81);
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

  // Task 20 Decision 4: documents (does not silently fix) the parser/authoring defect
  // that orphans "Combined Efficiency", "Recent Form", and "Opponent Quality". If this
  // ever starts failing, the underlying document or parser changed and
  // ORPHANED_CATALOG_SECTIONS (and whatever code depends on this fact staying true --
  // e.g. that no engine may claim an unrelated code for this content) needs revisiting.
  it("documents but does not silently fix the orphaned Combined Efficiency/Recent Form/Opponent Quality sections", () => {
    expect(ORPHANED_CATALOG_SECTIONS.map((s) => s.name)).toEqual(["Combined Efficiency", "Recent Form", "Opponent Quality"]);
    const liveCodes = new Set(liveReport.rules.map((r) => r.rule_code));
    for (const section of ORPHANED_CATALOG_SECTIONS) {
      // None of these section names ever became a live rule_code's name.
      expect(liveReport.rules.some((r) => r.rule_name === section.name), `${section.name} unexpectedly has its own rule_code`).toBe(false);
      // Each is genuinely swallowed inside the body of the code this file claims.
      expect(liveCodes.has(section.swallowedInsideCode)).toBe(true);
      const host = liveReport.rules.find((r) => r.rule_code === section.swallowedInsideCode);
      expect(host?.body ?? "", `${section.name} not found inside code ${section.swallowedInsideCode}'s body`).toContain(section.name);
      for (const bullet of section.bullets) {
        const label = bullet.split(":")[0];
        expect(host?.body ?? "", `bullet "${label}" not found inside code ${section.swallowedInsideCode}'s body`).toContain(label);
      }
    }
  });

  // Denominator-eligibility audit, requested directly: NO_SOURCE excludes a code from
  // the Evidence Coverage denominator, exactly like PROCESS_META, but only after a real,
  // documented investigation -- never merely because reconstruction hasn't been
  // attempted yet. These guardrails enforce that every entry (now or in the future)
  // actually carries that documentation, targets a real player-metric code, and never
  // overlaps with PROCESS_META (which already has its own, separate exclusion).
  it("NO_SOURCE_DETERMINATIONS is currently empty -- no code has cleared the documented-investigation bar yet", () => {
    // This is expected to fail the day a real determination is added; when it does,
    // the tests below take over enforcing that determination's completeness. This
    // assertion exists so an accidental/speculative entry can't slip in unnoticed.
    expect(Object.keys(NO_SOURCE_DETERMINATIONS)).toEqual([]);
    expect(NO_SOURCE_CODES.size).toBe(0);
  });

  it("every NO_SOURCE determination (present or future) must be fully documented, target a real player-metric code, and never overlap PROCESS_META", () => {
    for (const [code, entry] of Object.entries(NO_SOURCE_DETERMINATIONS)) {
      expect(entry.code, code).toBe(code);
      expect(entry.name, code).toBeTruthy();
      expect(entry.requiredRawInputs.length, `${code} must record what raw inputs its real bullets need`).toBeGreaterThan(0);
      expect(entry.sourcesInvestigated.length, `${code} must record every source actually investigated`).toBeGreaterThan(0);
      expect(entry.reconstructionMethodsConsidered.length, `${code} must record every reconstruction method considered`).toBeGreaterThan(0);
      expect(entry.whyEachPathwayFailed, `${code} must record why each pathway failed`).toBeTruthy();
      expect(entry.determinedAt, `${code} must record a determination date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const row = authoritativeMetricRow(code);
      expect(row, `${code} must be a real catalog code`).toBeDefined();
      expect(row?.type, `${code} is PROCESS_META -- that's a different, already-excluded bucket, never NO_SOURCE too`).toBe("PLAYER_METRIC");
      expect(isNoSourceCode(code)).toBe(true);
    }
    expect(isNoSourceCode(undefined)).toBe(false);
    expect(isNoSourceCode("999")).toBe(false);
  });
});
