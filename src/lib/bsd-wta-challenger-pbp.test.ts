import { describe, expect, it } from "vitest";
import { resolveUniqueApprovedWtaIdentity } from "./bsd-wta-challenger-pbp.server";

describe("WTA Challenger approved PBP identity bridge", () => {
  const approved = [
    "Mia Pohankova",
    "Katie Volynets",
    "Laura Samson",
    "Laura Pigossi",
    "Maria Sanchez",
    "Marta Sanchez",
  ];

  it("resolves repository surname-initial identities only when one approved identity matches", () => {
    expect(resolveUniqueApprovedWtaIdentity("Pohankova M.", approved)).toBe("Mia Pohankova");
    expect(resolveUniqueApprovedWtaIdentity("Volynets K.", approved)).toBe("Katie Volynets");
    expect(resolveUniqueApprovedWtaIdentity("L. Samson", approved)).toBe("Laura Samson");
  });

  it("preserves exact approved full names", () => {
    expect(resolveUniqueApprovedWtaIdentity("Katie Volynets", approved)).toBe("Katie Volynets");
  });

  it("fails closed when an abbreviated identity is ambiguous or absent", () => {
    expect(resolveUniqueApprovedWtaIdentity("Sanchez M.", approved)).toBeNull();
    expect(resolveUniqueApprovedWtaIdentity("Unknown X.", approved)).toBeNull();
  });
});
