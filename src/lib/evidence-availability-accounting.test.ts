import { describe, expect, it } from "vitest";
import { enrichEvidenceCoverageAccounting } from "./evidence-availability-accounting";

function classify(metric: Record<string, unknown>) {
  const report = enrichEvidenceCoverageAccounting({
    matches: [{ id: "WTA_MAIN", sampling_source: "source_observations", metrics: [metric] }],
  });
  return { availabilityClass: report.matches[0].metrics[0].availability_class, accounting: report.availability_accounting };
}

describe("evidence availability accounting", () => {
  it("does not infer PBP existence from source_expected alone", () => {
    const result = classify({ pair_credited: false, p1_credited: false, p2_credited: false, p1_treatment: "UNAVAILABLE", p2_treatment: "UNAVAILABLE", failure_bucket: "RECONSTRUCTION_FAILURE", source_expected: ["RESULTS_SCHEDULE", "POINT_BY_POINT"], observed_families: ["RESULTS_SCHEDULE"] });
    expect(result.availabilityClass).toBe("GENUINELY_UNAVAILABLE");
    expect(result.accounting.software_loss).toBe(0);
  });
  it("classifies PBP software loss only when PBP was actually observed", () => {
    const result = classify({ pair_credited: false, p1_credited: false, p2_credited: false, failure_bucket: "RECONSTRUCTION_FAILURE", source_expected: ["RESULTS_SCHEDULE", "POINT_BY_POINT"], observed_families: ["RESULTS_SCHEDULE", "POINT_BY_POINT"] });
    expect(result.availabilityClass).toBe("PBP_EXISTS_NOT_WIRED");
    expect(result.accounting.software_loss).toBe(1);
  });
  it("does not infer market existence from source_expected alone", () => {
    const result = classify({ pair_credited: false, p1_credited: false, p2_credited: false, failure_bucket: "RECONSTRUCTION_FAILURE", source_expected: ["RANKING", "MARKET"], observed_families: ["RANKING"] });
    expect(result.availabilityClass).toBe("GENUINELY_UNAVAILABLE");
    expect(result.accounting.software_loss).toBe(0);
  });
  it("classifies market software loss only when market evidence was actually observed", () => {
    const result = classify({ pair_credited: false, p1_credited: false, p2_credited: false, failure_bucket: "EVIDENCE_WIRING_FAILURE", source_expected: ["MARKET"], observed_families: ["MARKET"] });
    expect(result.availabilityClass).toBe("MARKET_EXISTS_NOT_WIRED");
    expect(result.accounting.software_loss).toBe(1);
  });
  it("preserves partial credited evidence accounting", () => {
    const result = classify({ pair_credited: true, p1_credited: true, p2_credited: true, p1_treatment: "PARTIAL", p2_treatment: "PARTIAL", observed_families: ["RESULTS_SCHEDULE"] });
    expect(result.availabilityClass).toBe("PARTIALLY_POPULATED");
    expect(result.accounting.retrieved).toBe(1);
  });
});
