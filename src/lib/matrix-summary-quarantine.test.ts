import { describe, expect, it } from "vitest";
import {
  classifyMetric,
  classificationRecordFor,
  metricUniverseAccounting,
  playerEvidenceDenominatorCodes,
  playerMetricCodesIncludingQuarantined,
  MATRIX_SUMMARY_REQUIRED_CODES,
  MATRIX_SUMMARY_REQUIRED_RECORDS,
  META_OR_NON_PLAYER_CODES,
  PROTECTED_UNAVAILABLE_CODES,
} from "./metric-classification";
import { evaluate, DONE_STATES, type EngineInput } from "./audit-engine";
import { metricRowsForSideExecution } from "./audit-pipeline";
import { metricResultSeedRows } from "./audit-runs";
import { STAGES } from "./audit-stages";

// The full 16-code quarantine request. 017 is deliberately NOT in
// MATRIX_SUMMARY_REQUIRED_CODES -- it already carried a PROTECTED_UNAVAILABLE record,
// which already produces the identical required end state. Both buckets are asserted
// below so the distinction stays explicit rather than accidental.
const REQUESTED_SIXTEEN = ["015", "017", "019", "022", "024", "025", "026", "033", "035", "037", "039", "040", "042", "060", "070", "075"];
const QUARANTINED_FIFTEEN = REQUESTED_SIXTEEN.filter((code) => code !== "017");

describe("Matrix Summary quarantine — the 16 requested codes", () => {
  it("recognises every one of the 16 as unavailable and out of the ACTIVE denominator", () => {
    const active = new Set(playerEvidenceDenominatorCodes());
    for (const code of REQUESTED_SIXTEEN) {
      const classification = classifyMetric(code);
      expect(["MATRIX_SUMMARY_REQUIRED", "PROTECTED_UNAVAILABLE"], `code ${code}`).toContain(classification);
      expect(active.has(code), `code ${code} must not be in the active denominator`).toBe(false);
    }
  });

  it("quarantines exactly the 15 new codes — 017 stays on its pre-existing PROTECTED_UNAVAILABLE record", () => {
    expect([...MATRIX_SUMMARY_REQUIRED_CODES].sort()).toEqual([...QUARANTINED_FIFTEEN].sort());
    expect(MATRIX_SUMMARY_REQUIRED_CODES.has("017")).toBe(false);
    expect(PROTECTED_UNAVAILABLE_CODES.has("017")).toBe(true);
  });

  it("changes NO other metric: every remaining code 001-081 keeps its prior classification", () => {
    const quarantined = new Set(REQUESTED_SIXTEEN);
    for (let i = 1; i <= 81; i++) {
      const code = String(i).padStart(3, "0");
      if (quarantined.has(code)) continue;
      expect(classifyMetric(code), `code ${code} must be untouched`).not.toBe("MATRIX_SUMMARY_REQUIRED");
    }
    // The active denominator is exactly the prior 60 minus the 15 newly quarantined.
    expect(playerEvidenceDenominatorCodes()).toHaveLength(60 - QUARANTINED_FIFTEEN.length);
    // And the pre-existing buckets are numerically unchanged by this quarantine.
    expect(META_OR_NON_PLAYER_CODES.size).toBe(7);
    expect(PROTECTED_UNAVAILABLE_CODES.size).toBe(14);
  });

  it("preserves each quarantined metric's definition record (id, name, reversibility flag)", () => {
    for (const code of QUARANTINED_FIFTEEN) {
      const record = classificationRecordFor(code);
      expect(record, `code ${code} must keep a definition record`).not.toBeNull();
      expect(record!.metric_code).toBe(code);
      expect(record!.metric_name.trim().length).toBeGreaterThan(0);
      // Explicitly reversible: this is a quarantine, not a retirement.
      expect(record!.whether_future_ingestion_could_change_status).toBe(true);
      expect(record!.reconstruction_attempted).toBe(false);
    }
    expect(MATRIX_SUMMARY_REQUIRED_RECORDS).toHaveLength(QUARANTINED_FIFTEEN.length);
  });

  it("keeps the metric universe whole at 81 and reports the quarantine as its own auditable bucket", () => {
    const accounting = metricUniverseAccounting();
    expect(accounting.total_original_metric_universe).toBe(81);
    expect(accounting.matrix_summary_required_count).toBe(QUARANTINED_FIFTEEN.length);
    expect(
      accounting.legitimate_player_metric_count +
        accounting.matrix_summary_required_count +
        accounting.meta_or_non_player_count +
        accounting.protected_unavailable_count,
    ).toBe(81);
    // The quarantine is not a permanent shrink of the universe: reactivating all of them
    // restores the prior 60-code player denominator exactly.
    expect(accounting.legitimate_player_metric_count_including_quarantined).toBe(60);
    expect(playerMetricCodesIncludingQuarantined()).toHaveLength(60);
    for (const code of QUARANTINED_FIFTEEN) expect(playerMetricCodesIncludingQuarantined()).toContain(code);
  });
});

describe("Matrix Summary quarantine — audit behaviour", () => {
  it("seeds each quarantined code as NO_SOURCE / UNAVAILABLE with its own distinct reason (never zero, never EXCLUDED)", () => {
    const rows = metricResultSeedRows("run-1", QUARANTINED_FIFTEEN.map((code) => ({ rule_code: code, rule_name: `Metric ${code}` })));
    for (const row of rows) {
      expect(row.status).toBe("NO_SOURCE");
      expect(row.p1_status).toBe("NO_SOURCE");
      expect(row.p2_status).toBe("NO_SOURCE");
      // UNAVAILABLE as a treatment string -- explicitly not a numeric 0, not EXCLUDED,
      // and not conflated with the permanent no-pathway reason.
      expect(row.p1_treatment).toBe("UNAVAILABLE");
      expect(row.p2_treatment).toBe("UNAVAILABLE");
      expect(row.p1_treatment).not.toBe(0);
      expect(row.unavailable_reason).toBe("MATRIX_SUMMARY_EVIDENCE_REQUIRED");
      expect(row.unavailable_reason).not.toBe("NO_SOURCE_NO_LEGITIMATE_PATHWAY");
    }
  });

  it("never hands a quarantined code to a researcher on either side (no active calculation, no substitute evidence)", () => {
    const rows = metricResultSeedRows("run-1", [
      ...QUARANTINED_FIFTEEN.map((code) => ({ rule_code: code, rule_name: `Metric ${code}` })),
      { rule_code: "001", rule_name: "Surface Strength" }, // a normal, still-active metric
    ]).map((row, index) => ({ ...row, id: `row-${index}` })) as Array<Record<string, unknown>>;

    const p1 = metricRowsForSideExecution(rows, "p1");
    const p2 = metricRowsForSideExecution(rows, "p2");
    const pendingCodes = (pending: Array<Record<string, unknown>>) => pending.map((r) => String(r["metric_code"]));

    for (const code of QUARANTINED_FIFTEEN) {
      expect(pendingCodes(p1.pending), `p1 must not research ${code}`).not.toContain(code);
      expect(pendingCodes(p2.pending), `p2 must not research ${code}`).not.toContain(code);
    }
    // The still-active metric is unaffected and IS researched.
    expect(pendingCodes(p1.pending)).toContain("001");
    expect(pendingCodes(p2.pending)).toContain("001");
  });

  it("cannot block an audit: quarantined codes count as done and are subtracted from coverage", () => {
    const stages: EngineInput["stages"] = STAGES.map((stage) => ({ stage, status: "COMPLETE" }));
    const quarantinedRows: EngineInput["metrics"] = QUARANTINED_FIFTEEN.map((code) => ({
      status: "NO_SOURCE",
      p1_status: "NO_SOURCE",
      p2_status: "NO_SOURCE",
      p1_treatment: "UNAVAILABLE",
      p2_treatment: "UNAVAILABLE",
      matrix_derived: false,
      evidence_family: null,
      metric_code: code,
      metric_name: `Metric ${code}`,
      p1_value: null,
      p2_value: null,
      sources: [],
    }));
    const activeRow: EngineInput["metrics"][number] = {
      status: "COMPLETE",
      p1_status: "COMPLETE",
      p2_status: "COMPLETE",
      p1_treatment: "RECONSTRUCTED",
      p2_treatment: "RECONSTRUCTED",
      matrix_derived: false,
      evidence_family: "REAL_FAMILY",
      metric_code: "001",
      metric_name: "Surface Strength",
      p1_value: "elo=1800",
      p2_value: "elo=1750",
      sources: [{ source_name: "static index" }],
    };
    const report = evaluate({
      match: { identity_status: "VERIFIED", surface_status: "VERIFIED", player1_name: "Alpha", player2_name: "Beta" },
      run: { research_lock_at: null, independent_decision_committed_at: null, matrix_revealed_at: null, independent_winner: null, independent_low: null, independent_high: null, calibration_version_id: null, effective_evidence_count: 0 },
      metrics: [...quarantinedRows, activeRow],
      verification: [], disagreement: [], underdog: [], stress: [], reconstructions: [], conflicts: [],
      matrixWp: null, stages,
    });

    // NO_SOURCE is a done state -- a quarantined code never leaves the audit waiting on it.
    expect(DONE_STATES).toContain("NO_SOURCE");
    expect(report.counts.metrics.done).toBe(report.counts.metrics.total);
    expect(report.counts.p1.done).toBe(report.counts.p1.total);
    expect(report.counts.p2.done).toBe(report.counts.p2.total);
    // The one genuinely-covered metric is 100% of the ACTIVE denominator: the 15
    // quarantined codes are subtracted, not counted as misses that drag coverage down.
    expect(report.coverage.p1.noSource).toBe(QUARANTINED_FIFTEEN.length);
    expect(report.coverage.p1.usablePercent).toBe(100);
    expect(report.coverage.p2.usablePercent).toBe(100);
    expect(report.coverage.usablePercent).toBe(100);
    // ...and coverage is therefore NOT flagged low purely because 15 codes are quarantined.
    expect(report.greenLockReasons.join(" ")).not.toMatch(/coverage/i);
  });

  it("contributes zero independent evidence weight (calibration/effective-evidence never counts an unavailable code)", () => {
    const stages: EngineInput["stages"] = STAGES.map((stage) => ({ stage, status: "COMPLETE" }));
    // Give each quarantined row a distinct evidence_family: even so, an UNAVAILABLE
    // treatment must never enter the effective independent-evidence family count.
    const metrics: EngineInput["metrics"] = QUARANTINED_FIFTEEN.map((code) => ({
      status: "NO_SOURCE", p1_status: "NO_SOURCE", p2_status: "NO_SOURCE",
      p1_treatment: "UNAVAILABLE", p2_treatment: "UNAVAILABLE",
      matrix_derived: false, evidence_family: `FAMILY_${code}`,
      metric_code: code, metric_name: `Metric ${code}`, p1_value: null, p2_value: null, sources: [],
    }));
    const report = evaluate({
      match: { identity_status: "VERIFIED", surface_status: "VERIFIED", player1_name: "Alpha", player2_name: "Beta" },
      run: { research_lock_at: null, independent_decision_committed_at: null, matrix_revealed_at: null, independent_winner: null, independent_low: null, independent_high: null, calibration_version_id: null, effective_evidence_count: 0 },
      metrics, verification: [], disagreement: [], underdog: [], stress: [], reconstructions: [], conflicts: [],
      matrixWp: null, stages,
    });
    expect(report.effectiveEvidenceCount).toBe(0);
  });
});
