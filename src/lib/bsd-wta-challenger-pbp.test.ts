import { readFileSync } from "node:fs";
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

  it("resolves both players in the current firewall-valid WTA125 diagnostic representative against the real approved namespace", () => {
    const rows = readFileSync("data/metrics/pbp/wta_challenger/approved-index.jsonl", "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((row) => row.status === "APPROVED_WTA_CHALLENGER_PBP" && row.tour === "WTA_CHALLENGER");
    const names = rows.flatMap((row) => [row.player1, row.player2]).filter(Boolean);
    expect(resolveUniqueApprovedWtaIdentity("Pohankova M.", names)).toBeTruthy();
    expect(resolveUniqueApprovedWtaIdentity("Volynets K.", names)).toBeTruthy();
  });
});
