import { describe, expect, it } from "vitest";
import {
  classifyMetric,
  classificationRecordFor,
  playerEvidenceDenominatorCodes,
} from "./metric-classification";
import { policyForMetric } from "./metric-source-family-policy";

describe("metric 022 — Serve/Return Shot-Level Efficiency (reclassified PROTECTED_UNAVAILABLE)", () => {
  it("is classified PROTECTED_UNAVAILABLE with a complete audit trail", () => {
    expect(classifyMetric("022")).toBe("PROTECTED_UNAVAILABLE");
    const record = classificationRecordFor("022");
    expect(record).not.toBeNull();
    expect(record!.reason.length).toBeGreaterThan(20);
    expect(record!.sources_checked.length).toBeGreaterThan(0);
    expect(record!.required_raw_fields.length).toBeGreaterThan(0);
    expect(record!.review_status).toBe("REVIEWED");
  });

  it("is excluded from the player evidence denominator", () => {
    const denominator = new Set(playerEvidenceDenominatorCodes());
    expect(denominator.has("022")).toBe(false);
  });

  it("receives no evidence-family eligibility at all (per the PROTECTED_UNAVAILABLE rule)", () => {
    const policy = policyForMetric("022");
    expect(policy.allowed_families).toHaveLength(0);
    expect(policy.sufficient_families).toHaveLength(0);
  });
});
