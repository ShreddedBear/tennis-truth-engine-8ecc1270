import { describe, expect, it } from "vitest";
import { evidenceNameCouldMatch, uniqueEvidenceIdentity } from "./evidence-player-identity";

describe("evidence player identity", () => {
  it("matches exact normalized identities", () => {
    expect(evidenceNameCouldMatch("Iga Świątek", "Iga Swiatek")).toBe(true);
  });

  it("recovers a unique surname-only stored identity", () => {
    expect(uniqueEvidenceIdentity("Coco Gauff", ["Gauff", "Bejlek"])).toBe("Gauff");
    expect(uniqueEvidenceIdentity("Sara Bejlek", ["Gauff", "Bejlek"])).toBe("Bejlek");
  });

  it("fails closed when a shortened identity is ambiguous", () => {
    expect(uniqueEvidenceIdentity("Alex Smith", ["Smith", "Alex Smith"])).toBe(null);
  });

  it("does not use substring or edit-distance guessing", () => {
    expect(evidenceNameCouldMatch("Coco Gauff", "Gauf")).toBe(false);
    expect(evidenceNameCouldMatch("Arthur Fils", "Art Filsman")).toBe(false);
  });
});
