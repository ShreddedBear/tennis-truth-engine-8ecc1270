import { describe, expect, it } from "vitest";
import { clearPhantomEvidenceMetadata } from "./trusted-internal-evidence";

describe("trusted internal evidence CI verification", () => {
  it("does not strip provenance from a legitimately usable side", () => {
    const finding = clearPhantomEvidenceMetadata({
      metric_code: "001",
      p1_value: "surface_elo=1800",
      p2_value: null,
      p1_treatment: "PARTIAL",
      p2_treatment: "UNAVAILABLE",
      differential: null,
      evidence_family: "PUBLIC_HISTORICAL_DATA_FAMILY_001",
      reliability: 85,
      sample: "P1:90 | P2:UNAVAILABLE",
      unavailable_reason: "MISSING_REQUIRED_INPUT",
      sources: [{ source_name: "PredixSport", url: "https://example.test", retrieved_at: "2026-08-23T00:00:00Z" }],
    });
    expect(finding.p1_value).toBe("surface_elo=1800");
    expect(finding.sample).toBe("P1:90 | P2:UNAVAILABLE");
    expect(finding.reliability).toBe(85);
    expect(finding.sources).toHaveLength(1);
  });
});
