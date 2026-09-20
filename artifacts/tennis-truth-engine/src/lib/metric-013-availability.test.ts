import { describe, expect, it } from "vitest";
import { computeAvailabilityStatsFromRows } from "./availability-layoff.server";

const row = (date: string, won: "0" | "1") => ({ player: "Player A", date, won });

describe("metric 013 — Availability", () => {
  it("does not count the off-season break (Nov -> Feb, crossing a calendar year) as an observed layoff", () => {
    const rows = [
      // 2024 season, last match Oct 15.
      row("2024-10-15", "1"),
      // Off-season: 2024-10-15 -> 2025-02-01 is 109 days. Must not count.
      row("2025-02-01", "1"),
      row("2025-03-01", "1"),
    ];
    const stats = computeAvailabilityStatsFromRows(rows as never, "Player A", "2025-04-01");
    const get = (k: string) => stats.find((s) => s.key === k)?.value;
    expect(get("observed_layoffs_60d_plus")).toBe(0);
    expect(get("observed_layoffs_90d_plus")).toBe(0);
    // The only in-season gap is 2025-02-01 -> 2025-03-01 = 28 days.
    expect(get("longest_observed_layoff_days")).toBe(28);
  });

  it("still counts a genuine mid-season gap (same calendar year) as an observed layoff", () => {
    const rows = [
      row("2025-01-05", "1"),
      row("2025-01-20", "1"),
      // Mid-season gap, same year: 2025-01-20 -> 2025-05-01 is 101 days.
      row("2025-05-01", "0"),
      row("2025-05-10", "1"),
    ];
    const stats = computeAvailabilityStatsFromRows(rows as never, "Player A", "2025-06-01");
    const get = (k: string) => stats.find((s) => s.key === k)?.value;
    expect(get("observed_layoffs_90d_plus")).toBe(1);
    expect(get("longest_observed_layoff_days")).toBe(101);
    // return_after_layoff_win_pct looks at the up-to-3 matches right after the
    // 45+ day mid-season gap (2025-05-01 loss, 2025-05-10 win) -- not the
    // off-season gap -- so it should be 1 of 2, not the pre-fix 100%/0%
    // extremes a whole-history denominator would have produced.
    expect(get("return_after_layoff_win_pct")).toBe(50);
  });

  it("never counts an off-season-only history as any observed layoff at all", () => {
    const rows = [
      row("2023-10-20", "1"), row("2023-10-28", "1"),
      row("2024-10-22", "1"), row("2024-10-30", "1"),
      row("2025-02-03", "1"),
    ];
    const stats = computeAvailabilityStatsFromRows(rows as never, "Player A", "2025-03-01");
    const get = (k: string) => stats.find((s) => s.key === k)?.value;
    expect(get("observed_layoffs_30d_plus")).toBe(0);
    expect(get("observed_layoffs_60d_plus")).toBe(0);
    expect(get("observed_layoffs_90d_plus")).toBe(0);
  });
});
