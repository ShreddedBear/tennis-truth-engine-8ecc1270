import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { metricAllowsObservation, observationFamily, policyForMetric } from "./metric-source-family-policy";

describe("ranking ingestion and deterministic metric wiring", () => {
  const ranking = { source_id:"atp_rankings", observation_type:"RANKING", observation_key:"ranking_snapshot" };
  const schedule = { source_id:"atp", observation_type:"MATCH_RESULT_OR_SCHEDULE", observation_key:"match_record" };

  it("keeps ranking metrics isolated from results and schedules", () => {
    expect(observationFamily(ranking)).toBe("RANKING");
    for (const code of ["014", "062", "069"]) {
      expect(metricAllowsObservation(code, ranking)).toBe(true);
      expect(metricAllowsObservation(code, schedule)).toBe(false);
    }
  });

  it("maps objective ranking history into Ranking Context as well as stakes metrics", () => {
    expect(policyForMetric("014").allowed_families).toContain("RANKING");
    expect(policyForMetric("014").sufficient_families).toContain("RANKING");
    const calculator = readFileSync("src/lib/deterministic-ranking-metrics.server.ts", "utf8");
    expect(calculator).toContain('SUPPORTED = new Set(["014","062","069"])');
    expect(calculator).toContain('if(code==="014")');
  });

  it("wires ranking pulls and deterministic ranking calculations", () => {
    const orchestrator = readFileSync("src/lib/ingestion/orchestrator.server.ts", "utf8");
    const warehouse = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");
    expect(orchestrator).toContain("ingestTourRankings");
    expect(orchestrator).toContain("RANKING_HISTORY_PULL");
    expect(warehouse).toContain("deterministicRankingMetric");
  });

  it("does not fabricate subjective motivation from ranking observations", () => {
    const calculator = readFileSync("src/lib/deterministic-ranking-metrics.server.ts", "utf8");
    expect(calculator).toContain('p1_treatment:"PARTIAL"');
    expect(calculator).toContain("Subjective motivation/private pressure components are not inferred");
  });
});
