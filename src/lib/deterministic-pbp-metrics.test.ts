import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deterministicPbpMetricFromPacket } from "./deterministic-pbp-metrics.server";
import { TASK18B_METRIC_CODES } from "./pbp-score-state-recovery";

const researcher = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8").replace(/\s+/g, "");

// This file previously grepped deterministic-pbp-metrics.server.ts's literal source text
// for a hardcoded code list ("036","040",...) that predated the Task 20 catalog
// reconciliation and no longer exists in the real implementation -- that made these tests
// fail even though the underlying behavior they meant to guard was intact and unchanged.
// Rewritten to exercise the exported function's actual behavior instead of its source text,
// which is robust to future internal refactors the way a text-substring check is not.
describe("deterministic PBP evidence (deterministicPbpMetricFromPacket)", () => {
  const legacyOnlyCode = "024"; // in LEGACY_SUPPORTED, not a Task 18B code
  const unsupportedCode = "999"; // not in either supported set

  it("is restricted to metrics that explicitly allow point-by-point evidence", () => {
    const packet = { [legacyOnlyCode]: { observations: [{ family: "POINT_BY_POINT", player: "Alpha", opponent: "Beta", event_date: "2026-08-01", value: { total_points: 80, total_games: 20, task18b_raw_fields_available: false } }] } };
    expect(deterministicPbpMetricFromPacket({ metricCode: legacyOnlyCode, p1: "Alpha", p2: "Beta", asOfDate: "2026-08-02", packet })).not.toBeNull();
    const unsupportedPacket = { [unsupportedCode]: packet[legacyOnlyCode] };
    expect(deterministicPbpMetricFromPacket({ metricCode: unsupportedCode, p1: "Alpha", p2: "Beta", asOfDate: "2026-08-02", packet: unsupportedPacket })).toBeNull();
    // Every real Task 18B code (016/018/032/etc.) must also be explicitly supported.
    for (const code of TASK18B_METRIC_CODES) {
      const p = { [code]: { observations: [{ family: "POINT_BY_POINT", player: "Alpha", opponent: "Beta", event_date: "2026-08-01", value: { derived: { [code]: { treatment: "PARTIAL", value: {}, raw_fields: [], transformation: "t" } } } }] } };
      expect(deterministicPbpMetricFromPacket({ metricCode: code, p1: "Alpha", p2: "Beta", asOfDate: "2026-08-02", packet: p }), code).not.toBeNull();
    }
    // A non-POINT_BY_POINT observation family must never be treated as PBP evidence.
    const wrongFamily = { [legacyOnlyCode]: { observations: [{ family: "RESULTS_SCHEDULE", player: "Alpha", opponent: "Beta", event_date: "2026-08-01", value: { total_points: 80, total_games: 20, task18b_raw_fields_available: false } }] } };
    expect(deterministicPbpMetricFromPacket({ metricCode: legacyOnlyCode, p1: "Alpha", p2: "Beta", asOfDate: "2026-08-02", packet: wrongFamily })).toBeNull();
  });

  it("fails closed by player side and never synthesizes the missing opponent", () => {
    const oneSided = { [legacyOnlyCode]: { observations: [{ family: "POINT_BY_POINT", player: "Alpha", opponent: "Beta", event_date: "2026-08-01", value: { total_points: 80, total_games: 20, task18b_raw_fields_available: false } }] } };
    const finding = deterministicPbpMetricFromPacket({ metricCode: legacyOnlyCode, p1: "Alpha", p2: "Beta", asOfDate: "2026-08-02", packet: oneSided });
    expect(finding?.p1_treatment).toBe("PARTIAL");
    expect(finding?.p2_treatment).toBe("UNAVAILABLE");
    expect(finding?.p2_value).toBeNull();
    expect(finding?.unavailable_reason).toBe("Metric-specific PBP evidence is one-sided or lacks the required raw fields; missing evidence is not synthesized.");
  });

  it("recovers only already tour-guarded BSD PBP packets as conservative partial evidence", () => {
    const aggregateOnly = { [legacyOnlyCode]: { observations: [
      { family: "POINT_BY_POINT", player: "Alpha", opponent: "Beta", event_date: "2026-08-01", value: { total_points: 80, total_games: 20, task18b_raw_fields_available: false } },
      { family: "POINT_BY_POINT", player: "Beta", opponent: "Alpha", event_date: "2026-08-01", value: { total_points: 80, total_games: 20, task18b_raw_fields_available: false } },
    ] } };
    const finding = deterministicPbpMetricFromPacket({ metricCode: legacyOnlyCode, p1: "Alpha", p2: "Beta", asOfDate: "2026-08-02", packet: aggregateOnly });
    expect(finding?.p1_treatment).toBe("PARTIAL");
    expect(finding?.p2_treatment).toBe("PARTIAL");
    expect(finding?.p1_value).toContain("aggregate_only=true");
    expect(finding?.evidence_family).toBe("POINT_BY_POINT");
    // Aggregate-only credit must never be upgraded to RECONSTRUCTED/DIRECT.
    expect(finding?.p1_treatment).not.toBe("RECONSTRUCTED");
    expect(finding?.p1_treatment).not.toBe("DIRECT");
  });

  it("uses pair-complete deterministic BSD recovery before the live researcher", () => {
    const deterministicIndex = researcher.indexOf("deterministicPbpMetricFromPacket({metricCode:code,p1,p2,asOfDate:date,packet:observationPacket})");
    const remainingIndex = researcher.indexOf("remainingLiveMissing=liveMissing.filter");
    const liveIndex = researcher.indexOf("finalMetricWiringResearcher.metrics({...input,context,metrics:remainingLiveMissing})");
    expect(deterministicIndex).toBeGreaterThan(-1);
    expect(remainingIndex).toBeGreaterThan(deterministicIndex);
    expect(liveIndex).toBeGreaterThan(remainingIndex);
  });
});
