import { describe, expect, it } from "vitest";
import { computeHiddenImprovementFromPerspectives } from "./audit-metric-041-hidden-improvement-detector";

function m(won: boolean, pre_elo: number, opponent_pre_elo: number) {
  return { won, pre_elo, opponent_pre_elo };
}

describe("metric #041 — Hidden Improvement Detector", () => {
  it("flags hidden improvement: record stays flat (still winning) while the surplus over Elo-expectation rises against tougher opponents", () => {
    const chronological = [
      // earlier half: easy opponents (elo 1400), player (1500) wins both -- ~64% Elo-expected, so only a modest surplus
      m(true, 1500, 1400), m(true, 1500, 1400),
      // recent half: tough opponents (elo 1700), player still 1500, wins both anyway -- only ~24% Elo-expected, so a much larger surplus
      m(true, 1500, 1700), m(true, 1500, 1700),
    ];
    const out = computeHiddenImprovementFromPerspectives(chronological, 4);
    expect(out.recent_half.raw_win_rate).toBeLessThanOrEqual(out.earlier_half.raw_win_rate!); // 100% flat, "record" alone shows no improvement
    expect(out.recent_half.mean_elo_adjusted_surplus!).toBeGreaterThan(out.earlier_half.mean_elo_adjusted_surplus!); // but beating far tougher opponents is a real quality-adjusted gain
    expect(out.flag).toBe("IMPROVEMENT_HIDDEN_BY_RECORD");
  });

  it("does not flag hidden improvement when the record and the quality-adjusted surplus both improve together (visible improvement, not hidden)", () => {
    const chronological = [
      m(false, 1500, 1500), m(false, 1500, 1500),
      m(true, 1500, 1500), m(true, 1500, 1500),
    ];
    const out = computeHiddenImprovementFromPerspectives(chronological, 4);
    expect(out.flag).toBe("NO_HIDDEN_IMPROVEMENT_DETECTED");
  });

  it("does not flag hidden improvement when the record is flat but the quality-adjusted surplus is also flat or worse", () => {
    const chronological = [
      m(true, 1500, 1500), m(false, 1500, 1500),
      m(true, 1500, 1500), m(false, 1500, 1500),
    ];
    const out = computeHiddenImprovementFromPerspectives(chronological, 4);
    expect(out.flag).toBe("NO_HIDDEN_IMPROVEMENT_DETECTED");
  });

  it("reports null (not zero/NaN) half-stats when a half has no matches", () => {
    const out = computeHiddenImprovementFromPerspectives([m(true, 1500, 1500)], 4);
    expect(out.earlier_half.n).toBe(0);
    expect(out.earlier_half.raw_win_rate).toBeNull();
    expect(out.recent_half.n).toBe(1);
  });

  it("only uses the trailing window's most recent matches, not the whole history", () => {
    const chronological = [
      m(false, 1500, 1500), // outside the window of 2
      m(true, 1500, 1500), m(true, 1500, 1500),
    ];
    const out = computeHiddenImprovementFromPerspectives(chronological, 2);
    expect(out.earlier_half.n + out.recent_half.n).toBe(2);
  });
});
