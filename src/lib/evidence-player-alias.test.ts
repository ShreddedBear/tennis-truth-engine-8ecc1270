import { describe, expect, it } from "vitest";
import { evidenceNameMatches, evidencePairMatches, safeEvidenceAliases } from "./evidence-player-alias";

describe("evidence player alias firewall", () => {
  it("recovers exact legacy surname-only evidence", () => {
    expect(safeEvidenceAliases("Coco Gauff", "Sara Bejlek")).toEqual(["Coco Gauff", "gauff"]);
    expect(evidencePairMatches("Gauff", "Bejlek", "Coco Gauff", "Sara Bejlek")).toBe(true);
  });

  it("preserves exact canonical names", () => {
    expect(evidencePairMatches("Arthur Fils", "Flavio Cobolli", "Arthur Fils", "Flavio Cobolli")).toBe(true);
  });

  it("does not use fuzzy, first-name, or partial-string matching", () => {
    expect(evidenceNameMatches("Coco", "Coco Gauff", "Sara Bejlek")).toBe(false);
    expect(evidenceNameMatches("Gauf", "Coco Gauff", "Sara Bejlek")).toBe(false);
    expect(evidenceNameMatches("C. Gauff", "Coco Gauff", "Sara Bejlek")).toBe(false);
  });

  it("disables surname aliases when both requested players share the surname", () => {
    expect(safeEvidenceAliases("John Smith", "Alex Smith")).toEqual(["John Smith"]);
    expect(evidencePairMatches("Smith", "Smith", "John Smith", "Alex Smith")).toBe(false);
  });
});
