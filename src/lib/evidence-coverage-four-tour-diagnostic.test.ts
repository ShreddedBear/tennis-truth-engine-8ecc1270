import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUNDLED_VERIFIED_EVIDENCE_INDEX_SAMPLES, sampleVerifiedEvidenceIndexMatch } from "./evidence-index-match-sampler.server";

describe("Evidence Coverage four-tour representative diagnostic", () => {
  it("treats WTA 125 as a separate WTA Challenger family", () => {
    const diagnostic = readFileSync("src/lib/evidence-coverage-runtime-diagnostic.server.ts", "utf8");
    expect(diagnostic).toContain('"ATP_MAIN"|"WTA_MAIN"|"ATP_CHALLENGER"|"WTA_CHALLENGER"');
    expect(diagnostic).toContain('["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"]');
    expect(diagnostic).toContain('return "WTA_CHALLENGER"');
    expect(diagnostic).toContain('schema_version:11');
  });

  it("has an approved-PBP-backed, firewall-valid WTA 125 repository representative", async () => {
    const bundled = BUNDLED_VERIFIED_EVIDENCE_INDEX_SAMPLES.WTA_CHALLENGER;
    expect(bundled.id).toBe("WTA_CHALLENGER");
    expect(bundled.match_id).toMatch(/^approved-wta-challenger-pbp:/);
    expect(bundled.p1).toBeTruthy();
    expect(bundled.p2).toBeTruthy();
    expect(bundled.p1).not.toBe(bundled.p2);
    expect(bundled.tournament.toLowerCase()).toMatch(/wta.*125|125k/);
    expect(bundled.sampling_source).toBe("verified_pbp_index");

    const runtime = await sampleVerifiedEvidenceIndexMatch("WTA_CHALLENGER");
    expect(runtime?.match_id).toMatch(/^approved-wta-challenger-pbp:/);
    expect(runtime?.sampling_source).toBe("verified_pbp_index");
    expect(runtime?.tournament.toLowerCase()).toMatch(/wta.*125|125k/);
  });

  it("requires all four tours in production proof", () => {
    const proof = readFileSync(".github/workflows/evidence-coverage-production-proof.yml", "utf8");
    expect(proof).toContain('sampled("ATP_MAIN")');
    expect(proof).toContain('sampled("WTA_MAIN")');
    expect(proof).toContain('sampled("ATP_CHALLENGER")');
    expect(proof).toContain('sampled("WTA_CHALLENGER")');
  });
});
