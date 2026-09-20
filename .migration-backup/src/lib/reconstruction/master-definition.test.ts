import { describe, expect, it } from "vitest";
import { RECONSTRUCTION_SPECS } from "./specs";

describe("master metric definition guardrails", () => {
  it("does not reconstruct Dominance Ratio from one player's own serve-loss rate", () => {
    expect(RECONSTRUCTION_SPECS.some((spec) => spec.output === "dominance_ratio")).toBe(false);
  });
});
