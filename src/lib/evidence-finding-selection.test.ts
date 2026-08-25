import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8").replace(/\s+/g, " ");

describe("warehouse evidence finding selection", () => {
  it("prefers pair-complete live evidence first", () => {
    expect(source).toContain("fullyUsableFinding(live)?live");
  });

  it("falls back to pair-complete deterministic evidence before accepting one-sided live output", () => {
    expect(source).toContain("fullyUsableFinding(deterministic)?deterministic");
    const pairDeterministic = source.indexOf("fullyUsableFinding(deterministic)?deterministic");
    const oneSidedLive = source.indexOf("live&&(USABLE.has(live.p1_treatment)||USABLE.has(live.p2_treatment))?live");
    expect(pairDeterministic).toBeGreaterThan(-1);
    expect(oneSidedLive).toBeGreaterThan(pairDeterministic);
  });
});
