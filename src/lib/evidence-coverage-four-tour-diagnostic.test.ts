import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUNDLED_VERIFIED_EVIDENCE_INDEX_SAMPLES, sampleVerifiedEvidenceIndexMatch } from "./evidence-index-match-sampler.server";

describe("Evidence Coverage four-tour representative diagnostic", () => {
  it("treats WTA 125 as a separate WTA Challenger family", () => {
    const diagnostic = readFileSync("src/lib/evidence-coverage-runtime-diagnostic.server.ts", "utf8");
    const identity = readFileSync("src/lib/evidence-match-identity.ts", "utf8");
    expect(diagnostic).toContain("type RepresentativeId = EvidenceTourFamily");
    expect(diagnostic).toContain('["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"]');
    expect(diagnostic).toContain("classifyEvidenceTourFamily");
    expect(identity).toContain('return "WTA_CHALLENGER"');
  });

  it("has a firewall-validated WTA 125 repository representative", async () => {
    const sample = BUNDLED_VERIFIED_EVIDENCE_INDEX_SAMPLES.WTA_CHALLENGER;
    expect(sample.id).toBe("WTA_CHALLENGER");
    expect(sample.match_id).toContain("wta125-history:");
    expect(sample.p1).toBeTruthy();
    expect(sample.p2).toBeTruthy();
    expect(sample.p1).not.toBe(sample.p2);
    expect(sample.sampling_source).toBe("wta125_production_history");
    expect((await sampleVerifiedEvidenceIndexMatch("WTA_CHALLENGER"))?.sampling_source).toBe("wta125_production_history");
  });

  it("requires all four tours in production proof", () => {
    const proof = readFileSync(".github/workflows/evidence-coverage-production-proof.yml", "utf8");
    expect(proof).toContain('requested=\'["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"]\'');
    expect(proof).toContain('expected_ids=\'["ATP_CHALLENGER","ATP_MAIN","WTA_CHALLENGER","WTA_MAIN"]\'');
    expect(proof).toContain("(.report.matches | length) == 4");
  });
});
