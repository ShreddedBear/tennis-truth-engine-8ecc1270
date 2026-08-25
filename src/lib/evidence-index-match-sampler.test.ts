import { describe, expect, it } from "vitest";
import { sampleVerifiedEvidenceIndexMatch } from "./evidence-index-match-sampler.server";

describe("verified evidence index representative sampling", () => {
  for (const id of ["ATP_MAIN", "WTA_MAIN", "ATP_CHALLENGER"] as const) {
    it(`finds a fail-closed real ${id} matchup`, async () => {
      const sample = await sampleVerifiedEvidenceIndexMatch(id);
      expect(sample, `${id} verified index sample`).not.toBeNull();
      expect(sample?.id).toBe(id);
      expect(sample?.match_id).toContain(`verified-index:${id}:`);
      expect(sample?.p1).toBeTruthy();
      expect(sample?.p2).toBeTruthy();
      expect(sample?.p1).not.toBe(sample?.p2);
      expect(sample?.date).toMatch(/^20\d{2}-\d{2}-\d{2}$/);
    });
  }
});
