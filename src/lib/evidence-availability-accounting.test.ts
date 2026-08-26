import { describe, expect, it } from "vitest";
import { allMetricFamilyAudit, classifyEvidenceAvailability, enrichEvidenceCoverageAccounting, summarizeRecoverableCeiling } from "./evidence-availability-accounting";

describe("evidence availability accounting", () => {
  it("audits all 81 metric source-family policies", () => {
    const audit = allMetricFamilyAudit();
    expect(audit).toHaveLength(81);
    expect(audit[0]?.metric_code).toBe("001");
    expect(audit[80]?.metric_code).toBe("081");
  });

  it("separates recoverable software loss from genuine source unavailability", () => {
    const summary = summarizeRecoverableCeiling([
      "EVIDENCE_RETRIEVES_CORRECTLY",
      "PARTIALLY_POPULATED",
      "PBP_EXISTS_NOT_WIRED",
      "GENUINELY_UNAVAILABLE",
    ]);
    expect(summary.retrieved).toBe(2);
    expect(summary.software_loss).toBe(1);
    expect(summary.genuinely_unavailable).toBe(1);
    expect(summary.maximum_recoverable_ceiling_percent).toBe(75);
  });

  it("does not call one-sided evidence pair-complete", () => {
    expect(classifyEvidenceAvailability({ pairCredited:false, p1Credited:true, p2Credited:false })).toBe("PARTIALLY_POPULATED");
  });

  it("enriches every runtime metric and exposes a global ceiling", () => {
    const report = enrichEvidenceCoverageAccounting({
      matches:[{
        id:"WTA_CHALLENGER",
        sampling_source:"wta125_production_history",
        metrics:[
          { metric_code:"001", pair_credited:true, p1_credited:true, p2_credited:true, p1_treatment:"DIRECT", p2_treatment:"DIRECT", source_expected:["RANKING"] },
          { metric_code:"016", pair_credited:false, p1_credited:false, p2_credited:false, failure_bucket:"EVIDENCE_WIRING_FAILURE", source_expected:["POINT_BY_POINT"] },
        ],
      }],
    });
    expect(report.metric_family_audit).toHaveLength(81);
    expect(report.matches[0].metrics[0].availability_class).toBe("EVIDENCE_RETRIEVES_CORRECTLY");
    expect(report.matches[0].metrics[1].availability_class).toBe("PBP_EXISTS_NOT_WIRED");
    expect(report.availability_accounting.maximum_recoverable_ceiling_percent).toBe(100);
  });
});
