import { describe, expect, it } from "vitest";
import {
  BASELINE_COVERAGE_PERCENT,
  BASELINE_USABLE_CELLS,
  COVERAGE_PP_PER_FULL_FOUR_TOUR_METRIC,
  FOUR_TOURS,
  FULL_FOUR_TOUR_METRIC_EQUIVALENTS_NEEDED,
  METRIC_RECOVERABILITY_MAP,
  RECOVERABILITY_COUNTS,
  RECOVERABLE_METRIC_CODES,
  RECOVERY_PRIORITY_CODES,
  REQUIRED_ADDITIONAL_USABLE_CELLS,
  TARGET_USABLE_CELLS,
  TOTAL_COVERAGE_CELLS,
  TRULY_UNAVAILABLE_METRIC_CODES,
} from "./metric-recoverability-map";

describe("81-metric recoverability audit", () => {
  it("contains every metric exactly once", () => {
    expect(METRIC_RECOVERABILITY_MAP).toHaveLength(81);
    expect(new Set(METRIC_RECOVERABILITY_MAP.map(row => row.code)).size).toBe(81);
    expect(METRIC_RECOVERABILITY_MAP.map(row => row.code)).toEqual(
      Array.from({ length: 81 }, (_, i) => String(i + 1).padStart(3, "0")),
    );
  });

  it("classifies every metric without weakening unavailable evidence", () => {
    expect(RECOVERABILITY_COUNTS).toEqual({
      RECONSTRUCTABLE: 41,
      PARTIAL: 13,
      TRULY_UNAVAILABLE: 26,
      DIRECTLY_AVAILABLE: 1,
    });
    expect(RECOVERABLE_METRIC_CODES).toHaveLength(55);
    expect(TRULY_UNAVAILABLE_METRIC_CODES).toHaveLength(26);
    for (const row of METRIC_RECOVERABILITY_MAP) {
      expect(row.required_raw_fields.length).toBeGreaterThan(8);
      expect(row.existing_evidence.length).toBeGreaterThan(8);
      if (row.classification === "TRULY_UNAVAILABLE") expect(row.potential_treatment).toBe("UNAVAILABLE");
    }
  });

  it("derives the exact 12.04 to 70 percent cell requirement", () => {
    expect(FOUR_TOURS).toHaveLength(4);
    expect(TOTAL_COVERAGE_CELLS).toBe(324);
    expect(Number((100 * BASELINE_USABLE_CELLS / TOTAL_COVERAGE_CELLS).toFixed(2))).toBe(BASELINE_COVERAGE_PERCENT);
    expect(BASELINE_USABLE_CELLS).toBe(39);
    expect(TARGET_USABLE_CELLS).toBe(227);
    expect(REQUIRED_ADDITIONAL_USABLE_CELLS).toBe(188);
    expect(FULL_FOUR_TOUR_METRIC_EQUIVALENTS_NEEDED).toBe(47);
    expect(Number((100 * TARGET_USABLE_CELLS / TOTAL_COVERAGE_CELLS).toFixed(4))).toBe(70.0617);
    expect(Number((COVERAGE_PP_PER_FULL_FOUR_TOUR_METRIC * 47).toFixed(6))).toBe(Number((100 * 188 / 324).toFixed(6)));
  });

  it("keeps the recovery queue inside legitimately recoverable metrics", () => {
    expect(new Set(RECOVERY_PRIORITY_CODES).size).toBe(RECOVERY_PRIORITY_CODES.length);
    const recoverable = new Set(RECOVERABLE_METRIC_CODES);
    for (const code of RECOVERY_PRIORITY_CODES) expect(recoverable.has(code)).toBe(true);
    expect(RECOVERY_PRIORITY_CODES.length).toBe(55);
  });

  it("preserves the false-green firewall in the recovery definition", () => {
    for (const row of METRIC_RECOVERABILITY_MAP) {
      if (row.classification === "PARTIAL") expect(row.potential_treatment).toBe("PARTIAL");
      if (row.classification === "RECONSTRUCTABLE") expect(row.potential_treatment).toBe("RECONSTRUCTED");
      if (row.classification === "DIRECTLY_AVAILABLE") expect(row.potential_treatment).toBe("DIRECT");
    }
  });
});
