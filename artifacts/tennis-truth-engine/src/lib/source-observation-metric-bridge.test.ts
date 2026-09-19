import { describe, expect, it } from "vitest";
import { appendMetricObservationContext, isObservationBeforeCutoff } from "./source-observation-metric-bridge.server";
import { metricAllowsObservation } from "./metric-source-family-policy";

describe("source observation metric bridge", () => {
  it("preserves strict family separation before observations reach research", () => {
    const resultRow = { source_id: "atp", observation_type: "MATCH_RESULT_OR_SCHEDULE", observation_key: "match_record" };
    const rankingRow = { source_id: "atp", observation_type: "RANKING", observation_key: "ranking_snapshot" };
    const marketRow = { source_id: "odds_api", observation_type: "MARKET", observation_key: "h2h_decimal_odds" };

    expect(metricAllowsObservation("062", resultRow)).toBe(false);
    expect(metricAllowsObservation("069", resultRow)).toBe(false);
    expect(metricAllowsObservation("062", rankingRow)).toBe(true);
    expect(metricAllowsObservation("015", marketRow)).toBe(true);
    expect(metricAllowsObservation("028", marketRow)).toBe(false);
  });

  it("adds an explicit no-cross-family instruction to fallback context", () => {
    const context = appendMetricObservationContext("base", {
      "028": {
        metric_name: "Scheduling Context",
        allowed_families: ["RESULTS_SCHEDULE"],
        sufficient_families: [],
        support_only_families: ["RESULTS_SCHEDULE"],
        observations: [],
      },
    });

    expect(context).toContain("WAREHOUSE_OBSERVATION_CONTEXT");
    expect(context).toContain("never borrow an observation family from another metric");
    expect(context).toContain("support-only families");
  });

  it("refuses same-day and future observations at the historical cutoff", () => {
    expect(isObservationBeforeCutoff("2024-01-09", "2024-01-10")).toBe(true);
    expect(isObservationBeforeCutoff("2024-01-10", "2024-01-10")).toBe(false);
    expect(isObservationBeforeCutoff("2024-01-11", "2024-01-10")).toBe(false);
    expect(isObservationBeforeCutoff(null, "2024-01-10")).toBe(false);
    expect(isObservationBeforeCutoff("2024-01-09", "2024-01-10", "2024-01-09T23:59:59.000Z")).toBe(true);
    expect(isObservationBeforeCutoff("2024-01-09", "2024-01-10", "2024-01-10T00:00:00.000Z")).toBe(false);
  });
});
