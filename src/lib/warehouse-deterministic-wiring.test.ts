import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const researcher = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");
const compact = researcher.replace(/\s+/g, "");
const pipeline = readFileSync("src/lib/audit-pipeline.ts", "utf8").replace(/\s+/g, "");
const atomicUpsert = readFileSync("supabase/migrations/20260830070000_atomic_metric_evidence_upsert.sql", "utf8");

describe("warehouse deterministic calculator wiring", () => {
  it("runs deterministic results/schedule calculations before live fallback", () => {
    expect(researcher).toContain('import { deterministicResultsScheduleMetric } from "./deterministic-results-schedule-metrics.server"');
    const deterministicIndex = compact.indexOf("deterministicResultsScheduleMetric({");
    const liveIndex = compact.indexOf("finalMetricWiringResearcher.metrics({...input,context,metrics:remainingLiveMissing})");
    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(liveIndex).toBeGreaterThan(deterministicIndex);
  });

  it("removes fully usable local findings from live fallback", () => {
    expect(compact).toContain("return!isAuditDbCompositeMetric(code)&&!fullyUsableFinding(deterministicByCode.get(code))");
    expect(compact).toContain("USABLE.has(row.p1_treatment)&&USABLE.has(row.p2_treatment)&&row.p1_value&&row.p2_value");
    expect(compact).toContain("constremainingLiveMissing=liveMissing.filter(metric=>!fullyUsableFinding(deterministicByCode.get(codeOf(metric.code))))");
    expect(compact).toContain("metrics:remainingLiveMissing");
  });

  it("does not let a live unavailable result erase deterministic warehouse evidence", () => {
    expect(compact).toContain("constcomputed=mergeMetricFindingSides(live,deterministic)");
    expect(compact).toContain("constchosen=mergeMetricFindingSides(cached,computed)");
  });

  it("persists each paired finding atomically at the pipeline boundary", () => {
    expect(pipeline).toContain("constpaired=metricPairPatch(byCode.get(String(row[\"metric_code\"])),providerError,retrievedAt)");
    expect(pipeline).toContain("constoriented=preserveSettledOppositeSide(paired,row,side)");
    expect(pipeline).toContain("p1_value:p1.value,p2_value:p2.value");
    expect(pipeline).toContain("p1_unavailable_reason:p1.reason,p2_unavailable_reason:p2.reason");
  });

  it("keys paired research independently by player orientation", () => {
    expect(compact).toContain("input.researchSide??");
    expect(compact).toContain("input.researchPlayer??");
    expect(compact).toContain("input.researchOpponent??");
    expect(pipeline).toContain('researchSide:side,researchPlayer:side==="p1"?match.player1_name:match.player2_name');
  });

  it("uses the normalized evidence uniqueness key for conflict-safe refreshes", () => {
    expect(compact).toContain('db.rpc("upsert_metric_evidence_side",{p_payload:payload})');
    expect(atomicUpsert).toContain("on conflict (");
    expect(atomicUpsert).toContain("(lower(player_name))");
    expect(atomicUpsert).toContain("(coalesce(lower(opponent_name), ''))");
    expect(atomicUpsert).toContain("returning * into persisted");
  });

  it("passes deterministic components into the metric-scoped fallback context", () => {
    expect(compact).toContain("deterministic_components");
    expect(compact).toContain("evidence_family:row.evidence_family");
    expect(compact).toContain("treatment:row.p1_treatment");
  });
});
