import { describe, expect, it } from "vitest";
import { computeOffseasonRestLengthDays } from "./tennis-data-extended.server";

describe("computeOffseasonRestLengthDays (metric 077: Off-Season Rest Length)", () => {
  it("measures the gap from last match of the prior year to first match of this season, not the longest gap ever", () => {
    // A mid-season injury layoff (2025-02-01 -> 2025-08-01, ~181 days) is far longer than
    // the actual off-season gap (2025-11-01 -> 2026-01-05, 65 days). The honest metric must
    // report the off-season gap, not the longest gap in the player's history.
    const dates = ["2025-02-01", "2025-08-01", "2025-11-01", "2026-01-05", "2026-01-20"];
    const result = computeOffseasonRestLengthDays(dates, "2026-01-25");
    expect(result?.days).toBe(65);
    expect(result?.priorYearMatches).toBe(3);
  });

  it("uses the cutoff match itself as the season boundary when no season match has occurred yet before it", () => {
    const dates = ["2025-11-01"];
    const result = computeOffseasonRestLengthDays(dates, "2026-01-10");
    expect(result?.days).toBe(70);
  });

  it("returns null when there is no prior-year match to measure from", () => {
    expect(computeOffseasonRestLengthDays(["2026-01-05"], "2026-01-10")).toBeNull();
  });

  it("never returns a negative value", () => {
    const dates = ["2025-12-30", "2026-01-02"];
    const result = computeOffseasonRestLengthDays(dates, "2026-01-05");
    expect(result?.days).toBe(3);
    expect(result!.days).toBeGreaterThanOrEqual(0);
  });
});
