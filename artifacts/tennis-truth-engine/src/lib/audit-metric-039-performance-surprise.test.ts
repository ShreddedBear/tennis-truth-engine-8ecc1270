import { describe, expect, it } from "vitest";
import { computeSignedSurprise, computeRollingSurprise, summarizeSurpriseDistribution } from "./audit-metric-039-performance-surprise";
import { MIN_SUPPORT_N } from "./audit-metrics-shared";

describe("metric #039 — Performance Surprise Rating", () => {
  it("scores a maximal positive surprise: won a match given 0% chance", () => {
    expect(computeSignedSurprise({ playerWinProbabilityPct: 0, playerWon: true })).toBe(1);
  });
  it("scores a maximal negative surprise: lost a match given 100% chance", () => {
    expect(computeSignedSurprise({ playerWinProbabilityPct: 100, playerWon: false })).toBe(-1);
  });
  it("scores zero surprise for a coin-flip result that lands either way at 50%", () => {
    expect(computeSignedSurprise({ playerWinProbabilityPct: 50, playerWon: true })).toBe(0.5);
    expect(computeSignedSurprise({ playerWinProbabilityPct: 50, playerWon: false })).toBe(-0.5);
  });

  it("rolling window uses only the trailing N matches, oldest-to-newest as passed in", () => {
    const history = [
      { playerWinProbabilityPct: 90, playerWon: false }, // -0.9, should be excluded by a window of 2
      { playerWinProbabilityPct: 50, playerWon: true },  // +0.5
      { playerWinProbabilityPct: 50, playerWon: false }, // -0.5
    ];
    const out = computeRollingSurprise(history, 2);
    expect(out.n).toBe(2);
    expect(out.mean_signed_surprise).toBe(0); // (+0.5 + -0.5)/2
    expect(out.mean_absolute_surprise).toBe(0.5); // (0.5 + 0.5)/2
  });

  it("gracefully handles fewer matches than the requested window rather than padding or fabricating history", () => {
    const out = computeRollingSurprise([{ playerWinProbabilityPct: 50, playerWon: true }], 20);
    expect(out.n).toBe(1);
  });

  it("returns zeroed output, not NaN, for an empty history", () => {
    const out = computeRollingSurprise([], 20);
    expect(out).toEqual({ n: 0, mean_absolute_surprise: 0, mean_signed_surprise: 0 });
  });

  it("enforces MIN_SUPPORT_N on the audit-DB-wide distribution and reports the real n", () => {
    const few = Array.from({ length: MIN_SUPPORT_N - 1 }, () => ({ playerWinProbabilityPct: 60, playerWon: true }));
    const out = summarizeSurpriseDistribution(few);
    expect(out.status).toBe("NOT_ENOUGH_DATA");
    expect(out.n).toBe(MIN_SUPPORT_N - 1);
  });

  it("aggregates a sufficient audit-DB-wide sample into real mean surprise figures", () => {
    const many = Array.from({ length: MIN_SUPPORT_N }, () => ({ playerWinProbabilityPct: 60, playerWon: true }));
    const out = summarizeSurpriseDistribution(many);
    expect(out.status).toBe("GO");
    if (out.status === "GO") {
      expect(out.value.mean_signed_surprise).toBe(0.4);
      expect(out.value.mean_absolute_surprise).toBe(0.4);
    }
  });
});
