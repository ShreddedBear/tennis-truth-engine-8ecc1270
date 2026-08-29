import { describe, expect, it } from "vitest";
import {
  evidenceNameMatches,
  evidencePairMatches,
  safeEvidenceAliases,
  uniqueCanonicalWarehouseIdentity,
} from "./evidence-player-alias";

describe("evidence player alias firewall", () => {
  it("recovers exact legacy surname-only evidence", () => {
    expect(safeEvidenceAliases("Coco Gauff", "Sara Bejlek")).toEqual(["Coco Gauff", "gauff"]);
    expect(evidencePairMatches("Gauff", "Bejlek", "Coco Gauff", "Sara Bejlek")).toBe(true);
  });

  it("resolves a surname-only upload only from one canonical warehouse identity", () => {
    expect(uniqueCanonicalWarehouseIdentity("Gauff", ["Coco Gauff", "Coco Gauff", "Gauff"])).toBe("Coco Gauff");
    expect(uniqueCanonicalWarehouseIdentity("Bejlek", ["Sara Bejlek"])).toBe("Sara Bejlek");
  });

  it("fails closed when the surname maps to multiple full identities", () => {
    expect(uniqueCanonicalWarehouseIdentity("Smith", ["John Smith", "Alex Smith"])).toBeNull();
  });

  it("collapses one matching initial alias into the unique full identity", () => {
    expect(uniqueCanonicalWarehouseIdentity("Nakashima", ["B. Nakashima", "Brandon Nakashima"]))
      .toBe("Brandon Nakashima");
    expect(uniqueCanonicalWarehouseIdentity("Tiafoe", ["F. Tiafoe", "Frances Tiafoe"]))
      .toBe("Frances Tiafoe");
  });

  it("does not collapse a conflicting initial alias", () => {
    expect(uniqueCanonicalWarehouseIdentity("Smith", ["J. Smith", "Alex Smith"])).toBeNull();
  });

  it("does not treat a surname-only warehouse row as canonical proof", () => {
    expect(uniqueCanonicalWarehouseIdentity("Gauff", ["Gauff"])).toBeNull();
  });

  it("preserves an already canonical uploaded identity", () => {
    expect(uniqueCanonicalWarehouseIdentity("Coco Gauff", ["Other Gauff"])).toBe("Coco Gauff");
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
