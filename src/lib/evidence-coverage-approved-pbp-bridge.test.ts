import { describe, expect, it } from "vitest";
import { buildBsdWtaChallengerPbpContext } from "./bsd-wta-challenger-pbp.server";
import { deterministicPbpMetricFromPacket } from "./deterministic-pbp-metrics.server";
import { sampleVerifiedEvidenceIndexMatch } from "./evidence-index-match-sampler.server";

describe("approved repository PBP evidence bridge", () => {
  it("samples WTA Challenger from the approved PBP index rather than generic WTA 125 history", async () => {
    const sample = await sampleVerifiedEvidenceIndexMatch("WTA_CHALLENGER");
    expect(sample).not.toBeNull();
    expect(sample?.sampling_source).toBe("verified_pbp_index");
    expect(sample?.match_id).toMatch(/^approved-wta-challenger-pbp:/);
    expect(sample?.tournament.toLowerCase()).toMatch(/wta.*125|125k/);
  });

  // Historical note: this test previously asserted that code 016 receives conservative
  // aggregate-only PARTIAL credit through this bridge's LEGACY_PBP_CODES fallback. The
  // NO_SOURCE denominator-eligibility audit gave 016 real Task 18B ownership (see
  // TASK18B_METRIC_CODES in pbp-score-state-recovery.ts) once its score-state bullets were
  // found recoverable from full server-oriented point chronology -- exactly like 002, 003,
  // 009, 018, and 032 already had. This bridge's own packet-building logic deliberately
  // skips any code already claimed by TASK18B_METRIC_CODES for its aggregate-only
  // fallback (`if(TASK18B_METRIC_CODES.has(code))continue`), because Task 18B's real
  // score-state contract cannot be proven from WTA Challenger/125's aggregate-only data
  // (no server-oriented point chronology). 016 now correctly follows the same rule its
  // Task 18B siblings already did: UNAVAILABLE here, not degraded-PARTIAL.
  it("credits metrics still on the legacy list (not owned by Task 18B) via the aggregate-only fallback, and confirms 016 -- now a Task 18B code -- is excluded from it", async () => {
    const result = await buildBsdWtaChallengerPbpContext({
      metrics: [
        { code: "016", name: "Point-by-Point & Score-State Metrics" },
        { code: "024", name: "Hidden Performance Quality" },
      ],
      p1: "Lin Zhu",
      p2: "Lulu Sun",
      asOfDate: "2026-01-27",
      context: "Tournament: WTA 125K Manila, Philippines Women Singles | Level: WTA CHALLENGER | Tour: WTA CHALLENGER | Date: 2026-01-27",
    });
    expect(result.status.eligible).toBe(true);
    expect(result.status.matches_used).toBeGreaterThan(0);
    expect(result.packet["016"]).toBeUndefined();
    const entry = result.packet["024"] as any;
    expect(entry?.tour_guard).toBe("STRICT_WTA_CHALLENGER_WTA125_ONLY");
    expect(entry?.observed_families).toEqual(["POINT_BY_POINT"]);
    // PHASE 14 — this assertion previously read the OPPOSITE way, and that is exactly the
    // leak it now guards. `Lin Zhu vs Lulu Sun, WTA 125K Manila, 2026-01-27` is itself a
    // row in the real approved index (data/metrics/pbp/wta_challenger/approved-index.jsonl),
    // and it IS the match this call audits. The old boundary excluded only `d > asOfDate`,
    // so the audited match's own point-by-point record was admitted as prior evidence for
    // predicting that same match. This is production index data, not a synthetic fixture,
    // so the leak was reachable for any match whose PBP the index carries.
    //
    // Correct post-fix state at asOfDate 2026-01-27: Lin Zhu's only index rows are the
    // audited match itself plus 2026-01-28 and 2026-01-29 (both after it), so she has NO
    // admissible prior evidence. Lulu Sun has a real 2025 history and does.
    const pairRows = (entry?.observations ?? []).filter(
      (row: any) => (row.player === "Lin Zhu" && row.opponent === "Lulu Sun") || (row.player === "Lulu Sun" && row.opponent === "Lin Zhu"),
    );
    expect(pairRows, "the audited match's own PBP must never be admitted as its own evidence").toHaveLength(0);
    expect((entry?.observations ?? []).every((row: any) => String(row.event_date) < "2026-01-27")).toBe(true);
    expect((entry?.observations ?? []).some((row: any) => row.player === "Lulu Sun")).toBe(true);

    const finding016 = deterministicPbpMetricFromPacket({ metricCode: "016", p1: "Lin Zhu", p2: "Lulu Sun", asOfDate: "2026-01-27", packet: result.packet });
    expect(finding016).toBeNull();

    const finding = deterministicPbpMetricFromPacket({
      metricCode: "024",
      p1: "Lin Zhu",
      p2: "Lulu Sun",
      asOfDate: "2026-01-27",
      packet: result.packet,
    });
    expect(finding?.evidence_family).toBe("POINT_BY_POINT");
    // One-sided by construction now, and honestly reported as such rather than credited to
    // both players off the audited match's own row.
    expect(finding?.p1_treatment).toBe("UNAVAILABLE");
    expect(finding?.p2_treatment).toBe("PARTIAL");
    expect(finding?.p2_value).toContain("point_rows=");
  });

  it("fails closed when WTA Challenger context is not explicit", async () => {
    const result = await buildBsdWtaChallengerPbpContext({
      metrics: [{ code: "016", name: "Point-by-Point & Score-State Metrics" }],
      p1: "Lin Zhu",
      p2: "Lulu Sun",
      asOfDate: "2026-01-27",
      context: "Tour: WTA MAIN | Tournament: Manila",
    });
    expect(result.status.eligible).toBe(false);
    expect(result.packet).toEqual({});
  });
});
