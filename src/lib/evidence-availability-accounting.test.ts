import { describe, expect, it } from "vitest";
import { allMetricFamilyAudit, classifyEvidenceAvailability, summarizeRecoverableCeiling } from "./evidence-availability-accounting";

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
});
