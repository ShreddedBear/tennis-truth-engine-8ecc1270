import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { metricAllowsObservation, observationFamily } from "./metric-source-family-policy";

describe("ranking ingestion and deterministic metric wiring", () => {
  const ranking = { source_id:"atp_rankings", observation_type:"RANKING", observation_key:"ranking_snapshot" };
  const schedule = { source_id:"atp", observation_type:"MATCH_RESULT_OR_SCHEDULE", observation_key:"match_record" };

  it("keeps ranking metrics isolated from results and schedules", () => {
    expect(observationFamily(ranking)).toBe("RANKING");
    expect(metricAllowsObservation("062", ranking)).toBe(true);
    expect(metricAllowsObservation("069", ranking)).toBe(true);
    expect(metricAllowsObservation("062", schedule)).toBe(false);
    expect(metricAllowsObservation("069", schedule)).toBe(false);
  });

  it("wires ranking pulls and deterministic ranking calculations", () => {
    const orchestrator = readFileSync("src/lib/ingestion/orchestrator.server.ts", "utf8");
    const warehouse = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");
    expect(orchestrator).toContain("ingestTourRankings");
    expect(orchestrator).toContain("RANKING_HISTORY_PULL");
    expect(warehouse).toContain("deterministicRankingMetric");
  });

  it("preserves available ranking evidence without fabricating the missing side or subjective motivation", () => {
    const calculator = readFileSync("src/lib/deterministic-ranking-metrics.server.ts", "utf8").replace(/\s+/g, " ");
    expect(calculator).toContain("p1Available");
    expect(calculator).toContain("p2Available");
    expect(calculator).toContain('?"PARTIAL":"UNAVAILABLE"');
    expect(calculator).toContain("Ranking evidence is one-sided; the missing side is not synthesized or credited.");
    expect(calculator).toContain("Subjective motivation/private pressure components are not inferred");
  });
});
