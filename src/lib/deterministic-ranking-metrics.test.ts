import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { metricAllowsObservation, observationFamily, policyForMetric } from "./metric-source-family-policy";

describe("ranking ingestion and deterministic Task 18C wiring", () => {
  const ranking = { source_id:"atp_rankings", observation_type:"RANKING", observation_key:"ranking_snapshot" };
  const schedule = { source_id:"atp", observation_type:"MATCH_RESULT_OR_SCHEDULE", observation_key:"match_record" };

  it("keeps official ranking evidence on metric 014 while preserving source-family isolation", () => {
    expect(observationFamily(ranking)).toBe("RANKING");
    expect(metricAllowsObservation("014", ranking)).toBe(true);
    expect(metricAllowsObservation("014", schedule)).toBe(false);
  });

  it("maps ranking history into pair-complete PARTIAL metric 014 (see docs/metric-audit-014-ranking-context.md)", () => {
    expect(policyForMetric("014").allowed_families).toContain("RANKING");
    expect(policyForMetric("014").sufficient_families).toContain("RANKING");
    const calculator = readFileSync("src/lib/deterministic-ranking-metrics.server.ts", "utf8");
    // Task 20 reconciliation: "005"/"007"/"021"/"061" removed from this file's
    // history-code ownership -- see the header comment on OWNED in
    // deterministic-ranking-metrics.server.ts for the full rationale.
    expect(calculator).toContain('const OWNED = new Set(["001", "014"])');
    expect(calculator).toContain('if (code === "014") return directRankingFinding(args)');
    // Downgraded from DIRECT to PARTIAL this pass: only "Current Ranking" (one of
    // four named bullets) is a raw published value; Ranking-Performance Disconnect
    // is not computed. See docs/metric-audit-014-ranking-context.md.
    expect(calculator).toContain('p1_treatment: "PARTIAL"');
    expect(calculator).toContain('p2_treatment: "PARTIAL"');
    expect(calculator).toContain("if (!p1 || !p2) return null");
  });

  it("wires ranking pulls and deterministic calculations through the canonical warehouse path", () => {
    const orchestrator = readFileSync("src/lib/ingestion/orchestrator.server.ts", "utf8");
    const warehouse = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");
    expect(orchestrator).toContain("ingestTourRankings");
    expect(orchestrator).toContain("RANKING_HISTORY_PULL");
    expect(warehouse).toContain("deterministicRankingMetric");
    expect(warehouse.indexOf("resolveCanonicalEvidencePair(input.p1, input.p2)")).toBeLessThan(warehouse.indexOf("deterministicRankingMetric({"));
  });

  it("blocks future ranking leakage and does not route unrelated 062/069 through this calculator", () => {
    const calculator = readFileSync("src/lib/deterministic-ranking-metrics.server.ts", "utf8");
    expect(calculator).toContain('.lte("event_date", asOfDate)');
    expect(calculator).toContain("row.event_date <= args.asOfDate");
    expect(calculator).not.toContain('OWNED = new Set(["014", "062", "069"])');
  });
});
