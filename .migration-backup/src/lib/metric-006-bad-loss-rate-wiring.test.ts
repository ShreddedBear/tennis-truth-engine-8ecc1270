import { describe, expect, it, vi } from "vitest";
import { localMetricRows } from "./hybrid-audit-research.server";
import { deterministicHistoricalResultsMetric } from "./deterministic-historical-results-metrics.server";

// Real quality-observed (ranked-opponent) match history within the trailing 90 days of
// asOfDate: deriveHistoricalResultMetric's own code-006 branch (tested directly in
// historical-results-recovery.test.ts) WOULD return a real, non-null "Opponent-Adjusted
// Strength of Schedule" finding for this fixture if this pipeline wrapper still tried it --
// proving the null below comes from the PIPELINE_EXCLUDED gate, not from a data gap.
vi.mock("./runtime-tennis-index-data.server", () => ({
  loadRuntimeIndex: () => ({
    generatedAt: "2026-01-01T00:00:00Z",
    ATP: {}, WTA: {},
    matchHistory: {
      ATP_MAIN: {
        "alice alpha": [
          ["2026-08-10", "Fixture Open", "Hard", "Carol Gamma", 1, "R32", "atp", { opponent_rank: 25 }],
        ],
      },
      WTA_MAIN: {}, ATP_CHALLENGER: {}, WTA_CHALLENGER: {},
    },
  }),
}));

// Resolves the metric-006 spec/producer disagreement found while repairing the 25 active
// Truth Engine metrics: the canonical registry (public/seed/metrics.txt, category "6.
// Opponent Quality") names FIVE separate bullets under code 006, including both
// "Opponent-Adjusted Strength of Schedule" and "Bad-Loss Rate" -- two different
// quantities. COMPARISON_SPECS declares 006's comparable field as "bad_loss_rate_pct" and
// its own comment names predixsport-recent.server.ts as the correct producer for that
// specific bullet. Before this fix, deterministicHistoricalResultsMetric (an early tier in
// the researcher waterfall) answered code 006 with the OTHER bullet (a 90-day
// quality-banded win rate) and stopped the pipeline from ever trying the tier that
// actually supplies bad_loss_rate_pct; separately, hybrid-audit-research.server.ts's
// selectedStats() never even routed getRecentReconstruction() (bad_loss_rate_pct's real
// producer) into code 006's evidence pool at all.
describe("metric 006: bad_loss_rate_pct wiring", () => {
  it("the early deterministic historical tier no longer answers code 006, even though real quality-observed history exists that it WOULD otherwise use", async () => {
    const finding = await deterministicHistoricalResultsMetric({
      metricCode: "006", p1: "Alice Alpha", p2: "Bob Beta", asOfDate: "2026-08-26", tourFamily: "ATP_MAIN",
    });
    expect(finding).toBeNull();
  });

  it("localMetricRows now surfaces the real bad_loss_rate_pct field for code 006 from real PredixSport CSV data", () => {
    const [row] = localMetricRows("Jan Hernych", "Some Unknown Player", "date 2026-09-01 · surface hard", [
      { code: "006", name: "Opponent Quality", body: null },
    ]);
    expect(row.p1_value).toMatch(/(?:^|[;\s])bad_loss_rate_pct=/);
    expect(row.p1_treatment).toBe("PARTIAL");
  });
});
