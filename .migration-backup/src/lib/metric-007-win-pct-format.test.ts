import { describe, expect, it } from "vitest";
import { localMetricRows } from "./hybrid-audit-research.server";
import { compareMetricRow } from "./truth-engine-metric-comparison";

// Regression test for a real bug found while repairing the 25 active Truth Engine metrics:
// localMetricRows' own code-007 common-opponent construction persisted its "win_pct" field
// (COMPARISON_SPECS's exact declared field for 007) with a trailing "%" and rounded to one
// decimal ("win_pct=85.9%"), while an unrelated duplicate field a few tokens later
// ("common_opponent_win_pct=85.87") carried the same quantity correctly. Number("85.9%") is
// NaN, so metricPairPatch's spec-field validation (and, before that fix existed,
// compareMetricRow itself) could never actually read a value that LOOKED present. The fix
// drops the "%" suffix so the declared field is genuinely numeric.
describe("metric 007: win_pct persists as a genuinely parseable number", () => {
  // Real common-opponent intersection across two of the CSV's most prolific players is
  // genuinely expensive (tens of thousands of row comparisons), not a hang.
  it("localMetricRows' win_pct field for code 007 has no trailing % (Novak Djokovic vs Rafael Nadal, real shared-opponent data)", { timeout: 45000 }, () => {
    const [row] = localMetricRows("Novak Djokovic", "Rafael Nadal", "date 2026-09-01 · surface hard", [
      { code: "007", name: "Common-Opponent Network", body: null },
    ]);
    expect(row.p1_value).toMatch(/(?:^|[;\s])win_pct=[0-9.]+(?:;|$)/);
    expect(row.p1_value).not.toMatch(/win_pct=[0-9.]+%/);

    const comparison = compareMetricRow({
      metric_code: "007", p1_value: row.p1_value, p2_value: row.p2_value,
      p1_treatment: row.p1_treatment, p2_treatment: row.p2_treatment,
    });
    expect(comparison.status).not.toBe("VALUE_NOT_PARSEABLE");
    expect(comparison.p1_number).not.toBeNull();
    expect(comparison.p2_number).not.toBeNull();
  });
});
