import { describe, expect, it } from "vitest";
import { evaluate, type EngineInput } from "./audit-engine";

const baseRun: EngineInput["run"] = {
  research_lock_at: null,
  independent_decision_committed_at: null,
  matrix_revealed_at: null,
  independent_winner: null,
  independent_low: null,
  independent_high: null,
  calibration_version_id: null,
  effective_evidence_count: 0,
};
const baseMatch: EngineInput["match"] = {
  identity_status: "VERIFIED",
  surface_status: "VERIFIED",
  player1_name: "Alpha",
  player2_name: "Beta",
};

function input(metrics: EngineInput["metrics"]): EngineInput {
  return {
    match: baseMatch,
    run: baseRun,
    metrics,
    verification: [],
    disagreement: [],
    underdog: [],
    stress: [],
    reconstructions: [],
    conflicts: [],
    matrixWp: null,
  };
}

describe("audit-engine coverage: PROCESS_META silent-re-entry guard", () => {
  // Task 20 reconciliation, regression test: real code "057" ("Evidence Freshness &
  // Confirmation") is PROCESS_META and must never count toward the player-evidence
  // coverage denominator (Decision 1). meta-derived-evidence.server.ts legitimately
  // writes a descriptive meta-analysis value into this same row and, in doing so, also
  // overwrites p1_treatment/p2_treatment/status away from "EXCLUDED" (to PARTIAL/
  // COMPLETE) -- this is exactly the kind of silent re-entry Decision 1 asked to be
  // guarded against. coverageFor() must derive exclusion from the metric's own code
  // identity (authoritativeMetricRow), not from whatever treatment a downstream writer
  // happens to have set, so this can never slip back into the denominator.
  it("keeps a PROCESS_META code excluded even after a downstream writer overwrites its treatment away from EXCLUDED", () => {
    const metrics: EngineInput["metrics"] = [
      { status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE", p1_treatment: "DIRECT", p2_treatment: "DIRECT", matrix_derived: false, evidence_family: "RESULTS_SCHEDULE", metric_name: "Set Profile", metric_code: "008" },
      { status: "UNAVAILABLE", p1_status: "UNAVAILABLE", p2_status: "UNAVAILABLE", p1_treatment: "UNAVAILABLE", p2_treatment: "UNAVAILABLE", matrix_derived: false, evidence_family: null, metric_name: "Common-Opponent Network", metric_code: "007" },
      // Simulates meta-derived-evidence.server.ts's post-instantiate write: p1/p2
      // treatment flipped to PARTIAL and status flipped to COMPLETE for a PROCESS_META
      // code that was originally instantiated as EXCLUDED.
      { status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE", p1_treatment: "PARTIAL", p2_treatment: "PARTIAL", matrix_derived: false, evidence_family: null, metric_name: "Evidence Freshness & Confirmation", metric_code: "057" },
    ];
    const report = evaluate(input(metrics));
    expect(report.coverage.p1.excluded).toBe(1);
    expect(report.coverage.p1.total).toBe(3);
    // Denominator is 2 (008 + 007), not 3; only 008 is usable -> 50%, not the ~66.7%
    // a silently re-entered 057 (as PARTIAL) would produce.
    expect(report.coverage.p1.usablePercent).toBe(50);
    expect(report.coverage.p1.statuses).toEqual(["DIRECT", "UNAVAILABLE", "EXCLUDED"]);
    expect(report.coverage.p2.statuses).toEqual(["DIRECT", "UNAVAILABLE", "EXCLUDED"]);
  });

  it("still counts a real PLAYER_METRIC code as its actual treatment, never as EXCLUDED", () => {
    const metrics: EngineInput["metrics"] = [
      { status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE", p1_treatment: "RECONSTRUCTED", p2_treatment: "RECONSTRUCTED", matrix_derived: false, evidence_family: "POINT_BY_POINT", metric_name: "Momentum & Closing Metrics", metric_code: "018" },
    ];
    const report = evaluate(input(metrics));
    expect(report.coverage.p1.excluded).toBe(0);
    expect(report.coverage.p1.reconstructed).toBe(1);
    expect(report.coverage.p1.usablePercent).toBe(100);
  });

  it("treats a row with no metric_code exactly as before (backward compatible)", () => {
    const metrics: EngineInput["metrics"] = [
      { status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE", p1_treatment: "DIRECT", p2_treatment: "DIRECT", matrix_derived: false, evidence_family: "MARKET", metric_name: "legacy row" },
    ];
    const report = evaluate(input(metrics));
    expect(report.coverage.p1.excluded).toBe(0);
    expect(report.coverage.p1.direct).toBe(1);
  });
});
