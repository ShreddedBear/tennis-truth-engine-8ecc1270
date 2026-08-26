import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { metricAllowsObservation, observationFamily, policyForMetric } from "./metric-source-family-policy";

describe("ranking ingestion and deterministic metric wiring", () => {
  const ranking = { source_id:"atp_rankings", observation_type:"RANKING", observation_key:"ranking_snapshot" };
  const schedule = { source_id:"atp", observation_type:"MATCH_RESULT_OR_SCHEDULE", observation_key:"match_record" };

  it("keeps official ranking evidence isolated to the owned Ranking & Rating metric", () => {
    expect(observationFamily(ranking)).toBe("RANKING");
    expect(metricAllowsObservation("014", ranking)).toBe(true);
    expect(metricAllowsObservation("014", schedule)).toBe(false);
  });

  it("maps objective ranking history into Task 17 metric 014 as pair-complete DIRECT evidence", () => {
    expect(policyForMetric("014").allowed_families).toContain("RANKING");
    expect(policyForMetric("014").sufficient_families).toContain("RANKING");
    const calculator = readFileSync("src/lib/deterministic-ranking-metrics.server.ts", "utf8");
    expect(calculator).toContain('const OWNED = new Set(["001", "005", "007", "014", "021", "061"])');
    expect(calculator).toContain('if (code === "014") return directRankingFinding(args)');
    expect(calculator).toContain('p1_treatment: "DIRECT"');
    expect(calculator).toContain('p2_treatment: "DIRECT"');
    expect(calculator).toContain("if (!p1 || !p2) return null; // one-sided ranking evidence fails closed");
  });

  it("wires ranking pulls and deterministic ranking calculations", () => {
    const orchestrator = readFileSync("src/lib/ingestion/orchestrator.server.ts", "utf8");
    const warehouse = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");
    expect(orchestrator).toContain("ingestTourRankings");
    expect(orchestrator).toContain("RANKING_HISTORY_PULL");
    expect(warehouse).toContain("deterministicRankingMetric");
  });

  it("blocks future ranking leakage and does not route unrelated metric codes through the ranking calculator", () => {
    const calculator = readFileSync("src/lib/deterministic-ranking-metrics.server.ts", "utf8");
    expect(calculator).toContain('.lte("event_date", asOfDate)');
    expect(calculator).toContain("row.event_date <= args.asOfDate");
    expect(calculator).not.toContain('"062"');
    expect(calculator).not.toContain('"069"');
  });
});
