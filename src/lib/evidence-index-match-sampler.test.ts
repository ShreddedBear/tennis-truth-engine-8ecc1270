import { describe, expect, it } from "vitest";
import { BUNDLED_VERIFIED_EVIDENCE_INDEX_SAMPLES, sampleVerifiedEvidenceIndexMatch } from "./evidence-index-match-sampler.server";

describe("deployment-safe verified evidence index sampler", () => {
  it("bundles one strictly typed real representative for every required class", () => {
    expect(Object.keys(BUNDLED_VERIFIED_EVIDENCE_INDEX_SAMPLES).sort()).toEqual(["ATP_CHALLENGER", "ATP_MAIN", "WTA_CHALLENGER", "WTA_MAIN"]);
    for (const [id,row] of Object.entries(BUNDLED_VERIFIED_EVIDENCE_INDEX_SAMPLES)) {
      expect(row.id).toBe(id);
      expect(row.match_id).toMatch(id === "WTA_CHALLENGER" ? /^wta125-history:/ : /^verified-index:/);
      expect(row.p1).not.toBe(row.p2);
      expect(row.date).toMatch(/^2026-/);
      expect(row.tournament.length).toBeGreaterThan(2);
    }
  });
  it("still resolves all required samples from checked-in validated repository evidence", async () => {
    for (const id of ["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"] as const) {
      const row=await sampleVerifiedEvidenceIndexMatch(id);
      expect(row).not.toBeNull();
      expect(row?.id).toBe(id);
    }
  });
});
