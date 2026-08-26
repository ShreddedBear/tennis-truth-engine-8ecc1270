import { describe, expect, it } from "vitest";
import { allMetricFamilyAudit, classifyEvidenceAvailability, enrichEvidenceCoverageAccounting, summarizeRecoverableCeiling } from "./evidence-availability-accounting";

function runtimeClass(metric: Record<string, unknown>) {
  const report = enrichEvidenceCoverageAccounting({
    matches: [{ id: "WTA_MAIN", sampling_source: "source_observations", metrics: [metric] }],
  });
  return {
    availabilityClass: report.matches[0].metrics[0].availability_class,
    accounting: report.availability_accounting,
  };
}

describe("evidence availability accounting", () => {
  it("audits every metric code 001 through 081 exactly once", () => {
    const rows = allMetricFamilyAudit();
    expect(rows).toHaveLength(81);
    expect(rows[0].metric_code).toBe("001");
    expect(rows[80].metric_code).toBe("081");
    expect(new Set(rows.map((row) => row.metric_code)).size).toBe(81);
  });

  it("distinguishes stranded evidence from genuine source absence", () => {
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,observedFamilies:["POINT_BY_POINT"]})).toBe("PBP_EXISTS_NOT_WIRED");
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,observedFamilies:["MARKET"]})).toBe("MARKET_EXISTS_NOT_WIRED");
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,repositoryEvidenceKnown:true,repositoryEvidenceExposed:false})).toBe("REPOSITORY_EVIDENCE_NOT_EXPOSED");
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,genuineUnavailable:true})).toBe("GENUINELY_UNAVAILABLE");
  });

  it("keeps identity, match join, tour classification and DB failures separate", () => {
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,identityBlocked:true})).toBe("CANONICAL_IDENTITY_FAILURE");
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,canonicalMatchFound:false})).toBe("MATCH_JOIN_FAILURE");
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,tourClassified:false})).toBe("TOUR_CLASSIFICATION_FAILURE");
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,dbLookupFailed:true})).toBe("DB_EVIDENCE_LOOKUP_FAILURE");
  });

  it("calculates the legitimate ceiling by excluding only genuine source absence", () => {
    const summary = summarizeRecoverableCeiling([
      "EVIDENCE_RETRIEVES_CORRECTLY",
      "PARTIALLY_POPULATED",
      "PBP_EXISTS_NOT_WIRED",
      "DB_EVIDENCE_LOOKUP_FAILURE",
      "GENUINELY_UNAVAILABLE",
    ]);
    expect(summary.retrieved_percent).toBe(40);
    expect(summary.software_loss_percent).toBe(40);
    expect(summary.genuine_source_unavailability_percent).toBe(20);
    expect(summary.maximum_recoverable_ceiling_percent).toBe(80);
  });

  it("enriches each representative independently and publishes the 81-code audit", () => {
    const enriched = enrichEvidenceCoverageAccounting({
      matches: [{
        id: "WTA_CHALLENGER",
        sampling_source: "source_observations",
        metrics: [
          { metric_code:"024", pair_credited:false, p1_credited:false, p2_credited:false, source_expected:["POINT_BY_POINT"], observed_families:["POINT_BY_POINT"], failure_bucket:"RECONSTRUCTION_FAILURE" },
          { metric_code:"062", pair_credited:true, p1_credited:true, p2_credited:true, p1_treatment:"RECONSTRUCTED", p2_treatment:"RECONSTRUCTED", source_expected:["RANKING"], observed_families:["RANKING"], failure_bucket:null },
        ],
      }],
    });
    expect(enriched.metric_family_audit).toHaveLength(81);
    expect(enriched.matches[0].metrics[0].availability_class).toBe("PBP_EXISTS_NOT_WIRED");
    expect(enriched.matches[0].metrics[1].availability_class).toBe("EVIDENCE_RETRIEVES_CORRECTLY");
    expect(enriched.matches[0].availability_accounting.maximum_recoverable_ceiling_percent).toBe(100);
  });

  it("does not infer PBP existence from source_expected alone", () => {
    const result = runtimeClass({
      pair_credited:false,p1_credited:false,p2_credited:false,
      p1_treatment:"UNAVAILABLE",p2_treatment:"UNAVAILABLE",
      failure_bucket:"RECONSTRUCTION_FAILURE",
      source_expected:["RESULTS_SCHEDULE","POINT_BY_POINT"],
      observed_families:["RESULTS_SCHEDULE"],
    });
    expect(result.availabilityClass).toBe("GENUINELY_UNAVAILABLE");
    expect(result.accounting.software_loss).toBe(0);
  });

  it("does not infer market existence from source_expected alone", () => {
    const result = runtimeClass({
      pair_credited:false,p1_credited:false,p2_credited:false,
      failure_bucket:"RECONSTRUCTION_FAILURE",
      source_expected:["RANKING","MARKET"],
      observed_families:["RANKING"],
    });
    expect(result.availabilityClass).toBe("GENUINELY_UNAVAILABLE");
    expect(result.accounting.software_loss).toBe(0);
  });

  it("classifies PBP software loss only when PBP was actually observed", () => {
    const result = runtimeClass({
      pair_credited:false,p1_credited:false,p2_credited:false,
      failure_bucket:"RECONSTRUCTION_FAILURE",
      source_expected:["RESULTS_SCHEDULE","POINT_BY_POINT"],
      observed_families:["RESULTS_SCHEDULE","POINT_BY_POINT"],
    });
    expect(result.availabilityClass).toBe("PBP_EXISTS_NOT_WIRED");
    expect(result.accounting.software_loss).toBe(1);
  });

  it("classifies market software loss only when market evidence was actually observed", () => {
    const result = runtimeClass({
      pair_credited:false,p1_credited:false,p2_credited:false,
      failure_bucket:"EVIDENCE_WIRING_FAILURE",
      source_expected:["MARKET"],
      observed_families:["MARKET"],
    });
    expect(result.availabilityClass).toBe("MARKET_EXISTS_NOT_WIRED");
    expect(result.accounting.software_loss).toBe(1);
  });
});
