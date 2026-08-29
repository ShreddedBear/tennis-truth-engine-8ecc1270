import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getHistoricalServeReturnStats } from "./datahub-atp-serve-return.server";
import { getMatchupEfficiencyStats } from "./matchup-efficiency.server";

function hybridSource() {
  return readFileSync(join(process.cwd(), "src/lib/hybrid-audit-research.server.ts"), "utf8");
}

describe("metric 004 — Combined Efficiency", () => {
  it("SUMMARY_KEYS[\"004\"] covers the five sourced named submetrics and no other code's exact-named vocabulary", () => {
    const source = hybridSource();
    const row = source.match(/"004":\s*\[([^\]]*)\]/)?.[1] ?? "";
    for (const covered of [
      "dominance_ratio",
      "total_points_won_pct",
      "matchup_expected_hold_pct",
      "matchup_expected_break_pct",
      "expected_hold_break_differential",
    ]) expect(row).toContain(covered);
    // Reserved for other codes' own exact named bullets -- must never be
    // credited to 004 (which has no such bullet in its real definition).
    for (const forbidden of [
      "ace_rate_pct",
      "first_serve_in_pct",
      "break_points_saved_pct",
      "break_point_conversion_pct",
      "win_after_losing_set1_pct",
      "tiebreak_win_pct",
    ]) expect(row).not.toContain(forbidden);
  });

  it("documents the Opponent-Adjusted Dominance Ratio gap in the live partialReason for family 004", () => {
    const source = hybridSource();
    expect(source).toMatch(/f==="004"&&\(xs\|\|ys\)\?"PARTIAL:[^"]*Opponent-Adjusted Dominance Ratio/);
  });

  it("computes dominance_ratio as player return-points-won% over opponent return-points-won%, correctly oriented", () => {
    const context = "date 2016-01-01";
    const p1 = getHistoricalServeReturnStats("Roger Federer", context);
    const p2 = getHistoricalServeReturnStats("Rafael Nadal", context);
    const rpw1 = p1.find((s) => s.key === "return_points_won_pct")?.value;
    const rpw2 = p2.find((s) => s.key === "return_points_won_pct")?.value;
    expect(typeof rpw1).toBe("number");
    expect(typeof rpw2).toBe("number");

    const forward = getMatchupEfficiencyStats("Roger Federer", "Rafael Nadal", context);
    const reverse = getMatchupEfficiencyStats("Rafael Nadal", "Roger Federer", context);
    const forwardRatio = forward.find((s) => s.key === "dominance_ratio")?.value;
    const reverseRatio = reverse.find((s) => s.key === "dominance_ratio")?.value;

    expect(forwardRatio).toBeCloseTo((rpw1 as number) / (rpw2 as number), 6);
    expect(reverseRatio).toBeCloseTo((rpw2 as number) / (rpw1 as number), 6);
    // Not a mirrored/negated shortcut -- the two orientations are genuinely
    // independent reciprocal computations, not the same value relabeled.
    expect(forwardRatio).not.toBeCloseTo(reverseRatio as number, 2);
  }, 20000);
});
