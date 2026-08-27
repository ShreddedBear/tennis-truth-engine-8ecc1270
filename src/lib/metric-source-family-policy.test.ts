import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { metricAllowsObservation, observationFamily, policyForMetric } from "./metric-source-family-policy";

const matchRow = { source_id: "atp", observation_type: "MATCH_RESULT_OR_SCHEDULE", observation_key: "match_record" };
const scheduleRow = { source_id: "wta", observation_type: "TOURNAMENT_SCHEDULE", observation_key: "event_schedule" };
const rankingRow = { source_id: "atp", observation_type: "RANKING", observation_key: "ranking_snapshot" };
const marketRow = { source_id: "odds_api", observation_type: "MARKET", observation_key: "h2h_decimal_odds" };
const weatherRow = { source_id: "open_meteo", observation_type: "ENVIRONMENT", observation_key: "temperature_2m" };

describe("metric source family policy", () => {
  it("never lets ATP/WTA results or schedules satisfy stakes metric 062", () => {
    expect(metricAllowsObservation("062", matchRow)).toBe(false);
    expect(metricAllowsObservation("062", scheduleRow)).toBe(false);
    expect(metricAllowsObservation("062", rankingRow)).toBe(true);
  });

  // Task 20 reconciliation: code 069's authoritative definition ("Stakes / Career
  // Context" -- retirement-tour/farewell-run effects, anti-doping testing disruption)
  // has no legitimate ranking, results/schedule, or PBP basis at all -- unlike 062
  // ("Motivation / Stakes"), which genuinely can be informed by ranking-points proximity
  // to a milestone. 069 is handled instead by protected-metric-wiring.server.ts, which
  // requires real public retirement/anti-doping reporting and forbids RECONSTRUCTED
  // entirely. See metric-certification-066-071.test.ts for that coverage.
  it("keeps metric 069 (Stakes / Career Context) family-less at the warehouse/observation layer", () => {
    expect(metricAllowsObservation("069", matchRow)).toBe(false);
    expect(metricAllowsObservation("069", scheduleRow)).toBe(false);
    expect(metricAllowsObservation("069", rankingRow)).toBe(false);
    expect(policyForMetric("069").allowed_families).toEqual([]);
  });

  it("keeps market evidence out of schedule and ranking metrics", () => {
    expect(metricAllowsObservation("028", marketRow)).toBe(false);
    expect(metricAllowsObservation("062", marketRow)).toBe(false);
    expect(metricAllowsObservation("015", marketRow)).toBe(true);
    expect(metricAllowsObservation("019", marketRow)).toBe(true);
  });

  it("keeps results/schedule as the only sufficient source for metric 021, with environment as support-only", () => {
    // Authoritative catalog code 021 is "Surface & Environmental Context" (see
    // authoritative-metric-catalog.ts), which genuinely names weather/altitude as
    // in-scope components alongside the chronological-results-derived Elo/surface
    // components. Environment evidence alone must never promote 021 past PARTIAL.
    expect(metricAllowsObservation("021", matchRow)).toBe(true);
    expect(metricAllowsObservation("021", weatherRow)).toBe(true);
    expect(policyForMetric("021").sufficient_families).toEqual(["RESULTS_SCHEDULE"]);
    expect(policyForMetric("021").support_only_families).toContain("ENVIRONMENT");
    expect(metricAllowsObservation("071", weatherRow)).toBe(true);
    expect(metricAllowsObservation("062", weatherRow)).toBe(false);
  });

  it("admits workload history as support-only evidence", () => {
    expect(metricAllowsObservation("061", matchRow)).toBe(true);
    expect(policyForMetric("061").sufficient_families).toEqual([]);
    expect(policyForMetric("061").support_only_families).toContain("RESULTS_SCHEDULE");
  });

  it("classifies current ATP/WTA/Challenger ingestion as results/schedule, not ranking", () => {
    expect(observationFamily(matchRow)).toBe("RESULTS_SCHEDULE");
    expect(observationFamily(scheduleRow)).toBe("RESULTS_SCHEDULE");
    expect(observationFamily(rankingRow)).toBe("RANKING");
  });

  it("marks support-only results/schedule families without silently promoting them", () => {
    for (const code of ["012", "028", "030", "061", "064", "071", "076", "077", "081"]) {
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
