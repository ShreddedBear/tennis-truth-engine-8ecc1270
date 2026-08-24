import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { metricAllowsObservation, observationFamily, policyForMetric } from "./metric-source-family-policy";

const matchRow = { source_id: "atp", observation_type: "MATCH_RESULT_OR_SCHEDULE", observation_key: "match_record" };
const scheduleRow = { source_id: "wta", observation_type: "TOURNAMENT_SCHEDULE", observation_key: "event_schedule" };
const rankingRow = { source_id: "atp", observation_type: "RANKING", observation_key: "ranking_snapshot" };
const marketRow = { source_id: "odds_api", observation_type: "MARKET", observation_key: "h2h_decimal_odds" };
const weatherRow = { source_id: "open_meteo", observation_type: "ENVIRONMENT", observation_key: "temperature_2m" };

describe("metric source family policy", () => {
  it("never lets ATP/WTA results or schedules satisfy ranking/stakes metrics", () => {
    expect(metricAllowsObservation("062", matchRow)).toBe(false);
    expect(metricAllowsObservation("062", scheduleRow)).toBe(false);
    expect(metricAllowsObservation("069", matchRow)).toBe(false);
    expect(metricAllowsObservation("069", scheduleRow)).toBe(false);
    expect(metricAllowsObservation("062", rankingRow)).toBe(true);
    expect(metricAllowsObservation("069", rankingRow)).toBe(true);
  });

  it("keeps market evidence out of schedule and ranking metrics", () => {
    expect(metricAllowsObservation("028", marketRow)).toBe(false);
    expect(metricAllowsObservation("062", marketRow)).toBe(false);
    expect(metricAllowsObservation("015", marketRow)).toBe(true);
    expect(metricAllowsObservation("019", marketRow)).toBe(true);
  });

  it("keeps environmental evidence in environmental/context metrics only", () => {
    expect(metricAllowsObservation("021", weatherRow)).toBe(true);
    expect(metricAllowsObservation("071", weatherRow)).toBe(true);
    expect(metricAllowsObservation("062", weatherRow)).toBe(false);
    expect(metricAllowsObservation("015", weatherRow)).toBe(false);
  });

  it("classifies current ATP/WTA/Challenger ingestion as results/schedule, not ranking", () => {
    expect(observationFamily(matchRow)).toBe("RESULTS_SCHEDULE");
    expect(observationFamily(scheduleRow)).toBe("RESULTS_SCHEDULE");
    expect(observationFamily(rankingRow)).toBe("RANKING");
  });

  it("marks results/schedule as support-only rather than a complete metric answer", () => {
    for (const code of ["012", "028", "030", "064", "071", "076", "077", "081"]) {
      const policy = policyForMetric(code);
      expect(policy.allowed_families).toContain("RESULTS_SCHEDULE");
      expect(policy.support_only_families).toContain("RESULTS_SCHEDULE");
      expect(policy.sufficient_families).not.toContain("RESULTS_SCHEDULE");
    }
  });

  it("is enforced by the production ATP/WTA/Challenger ingestion adapter", () => {
    const adapter = readFileSync("src/lib/ingestion/tour-results-schedule.server.ts", "utf8");
    expect(adapter).toContain('import { assertObservationFamily } from "../metric-source-family-policy"');
    expect(adapter).toMatch(/assertObservationFamily\(row,\s*["']RESULTS_SCHEDULE["']\)/);
  });
});
