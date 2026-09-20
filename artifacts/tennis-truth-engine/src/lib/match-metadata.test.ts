import { describe, expect, it } from "vitest";
import { parseBestOf, resolveDeterministicMetadata } from "./match-metadata";

describe("deterministic match metadata", () => {
  it.each([
    ["ATP Wimbledon Final", "Wimbledon", "Grass", "Grand Slam", "5"],
    ["WTA Roland Garros QF", "Roland Garros", "Clay", "Grand Slam", "3"],
    ["ATP Cincinnati Masters R16", "Cincinnati Open", "Hard", "Masters 1000", "3"],
    ["WTA Doha", "Qatar Open", "Hard", "WTA 1000", "3"],
    ["WTA Sao Pau1o", null, null, null, null],
    ["WTA São Paulo", "São Paulo Open", "Hard", "WTA 250", "3"],
    ["ATP Buenos Aires", "Argentina Open", "Clay", "ATP 250", "3"],
  ])("%s resolves without generic defaults", (input, tournament, surface, level, bestOf) => {
    const result = resolveDeterministicMetadata({ tournament: input });
    expect(result.fields).toMatchObject({ tournament, surface, event_level: level, best_of: bestOf });
  });

  it("preserves ambiguous shared events as unknown without tour evidence", () => {
    const result = resolveDeterministicMetadata({ tournament: "Cincinnati Open" });
    expect(result.fields.event_level).toBeNull();
    expect(result.fields.best_of).toBeNull();
  });

  it("normalizes textual best-of formats", () => {
    expect(parseBestOf("Best of 5")).toBe("5");
    expect(parseBestOf("BO3")).toBe("3");
    expect(parseBestOf("unknown")).toBeNull();
  });
});