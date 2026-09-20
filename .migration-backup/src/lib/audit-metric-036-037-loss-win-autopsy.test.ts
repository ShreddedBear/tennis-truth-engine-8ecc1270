import { describe, expect, it } from "vitest";
import {
  classifyWinOutcome, classifyLossOutcome, isCloseMatch, parseFinalScoreSets,
  isPredictionBeforeResult, summarizeAutopsyDistribution,
} from "./audit-metric-036-037-loss-win-autopsy";
import { MIN_SUPPORT_N } from "./audit-metrics-shared";

describe("metrics #036/#037 — Win/Loss Autopsy classification", () => {
  it("classifies a heavily-favored win as DOMINANT", () => {
    expect(classifyWinOutcome({ playerWinProbabilityPct: 85, playerWon: true, wasClose: false })).toBe("DOMINANT");
  });
  it("classifies a moderately-favored win as ROUTINE", () => {
    expect(classifyWinOutcome({ playerWinProbabilityPct: 60, playerWon: true, wasClose: false })).toBe("ROUTINE");
    expect(classifyWinOutcome({ playerWinProbabilityPct: 70, playerWon: true, wasClose: false })).toBe("ROUTINE"); // boundary: exactly 70 is ROUTINE, not DOMINANT (DOMINANT is >70)
  });
  it("splits underdog wins into ESCAPE (close) vs UPSET_WIN (not close)", () => {
    expect(classifyWinOutcome({ playerWinProbabilityPct: 30, playerWon: true, wasClose: true })).toBe("ESCAPE");
    expect(classifyWinOutcome({ playerWinProbabilityPct: 30, playerWon: true, wasClose: false })).toBe("UPSET_WIN");
  });
  it("leaves the 45-55% coin-flip win band deliberately unclassified rather than guessing a bucket", () => {
    expect(classifyWinOutcome({ playerWinProbabilityPct: 50, playerWon: true, wasClose: false })).toBeNull();
  });
  it("never classifies a loss as a win category or vice versa", () => {
    expect(classifyWinOutcome({ playerWinProbabilityPct: 85, playerWon: false, wasClose: false })).toBeNull();
    expect(classifyLossOutcome({ playerWinProbabilityPct: 85, playerWon: true, wasClose: false })).toBeNull();
  });

  it("classifies a heavily-favored loss as BAD_LOSS, a moderate-favorite loss as CLOSE_LOSS, and an underdog loss as EXPECTED_LOSS", () => {
    expect(classifyLossOutcome({ playerWinProbabilityPct: 85, playerWon: false, wasClose: false })).toBe("BAD_LOSS");
    expect(classifyLossOutcome({ playerWinProbabilityPct: 60, playerWon: false, wasClose: false })).toBe("CLOSE_LOSS");
    expect(classifyLossOutcome({ playerWinProbabilityPct: 20, playerWon: false, wasClose: false })).toBe("EXPECTED_LOSS");
  });

  it("parses the same raw-scoreline convention already used elsewhere in this codebase", () => {
    expect(parseFinalScoreSets("6-4 7-6(5)")).toEqual([[6, 4], [7, 6]]);
    expect(parseFinalScoreSets(null)).toEqual([]);
    expect(parseFinalScoreSets("garbage-format-xyz")).toEqual([]); // fails closed, never guesses
  });

  it("treats a match as close when it goes the full distance or has a tiebreak/narrow set", () => {
    expect(isCloseMatch("6-4 3-6 7-6(4)", 3)).toBe(true); // deciding 3rd set
    expect(isCloseMatch("6-4 6-3", 3)).toBe(false); // straight sets, no narrow margins
    expect(isCloseMatch("7-6(5) 6-4", 3)).toBe(true); // tiebreak set even though not deciding
    expect(isCloseMatch(null, 3)).toBe(false); // unparseable score fails closed to "not close", never guessed
  });

  it("leakage guard: a prediction recorded after the result was already known is rejected, not trusted", () => {
    expect(isPredictionBeforeResult("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(true);
    expect(isPredictionBeforeResult("2026-01-03T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(false);
    expect(isPredictionBeforeResult("2026-01-01T00:00:00Z", null)).toBe(false); // no result timestamp to compare -- fails closed
    expect(isPredictionBeforeResult("not-a-date", "2026-01-02T00:00:00Z")).toBe(false);
  });

  it("enforces MIN_SUPPORT_N and reports the real n, never silently including a below-threshold sample", () => {
    const few = Array.from({ length: MIN_SUPPORT_N - 1 }, () => ({ playerWinProbabilityPct: 80, playerWon: true, wasClose: false }));
    const out = summarizeAutopsyDistribution(few);
    expect(out.status).toBe("NOT_ENOUGH_DATA");
    expect(out.n).toBe(MIN_SUPPORT_N - 1);
  });

  it("aggregates a sufficient sample into a real category distribution", () => {
    const many = Array.from({ length: MIN_SUPPORT_N }, () => ({ playerWinProbabilityPct: 80, playerWon: true, wasClose: false }));
    const out = summarizeAutopsyDistribution(many);
    expect(out.status).toBe("GO");
    if (out.status === "GO") expect(out.value.DOMINANT).toBe(MIN_SUPPORT_N);
  });
});
