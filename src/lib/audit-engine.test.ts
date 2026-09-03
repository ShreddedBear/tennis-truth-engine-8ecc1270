import { describe, expect, it, vi } from "vitest";
import { evaluate, type EngineInput } from "./audit-engine";
import { STAGES } from "./audit-stages";

// To test the NO_SOURCE mechanism itself (distinct bucket, excluded from the
// denominator, immune to the same silent-re-entry pattern as META_OR_NON_PLAYER)
// without depending on which real codes are PROTECTED_UNAVAILABLE, mock classifyMetric
// to treat one specific code ("999", not a real catalog code) as PROTECTED_UNAVAILABLE
// for this test file only.
vi.mock("./metric-classification", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./metric-classification")>();
  return { ...actual, classifyMetric: (code: string | null | undefined) => (code === "999" ? "PROTECTED_UNAVAILABLE" : actual.classifyMetric(String(code ?? ""))) };
});

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

// All 13 pipeline stages persisted COMPLETE -- the default fixture for tests
// that are exercising coverage/treatment math, not the stage-dependency gate
// itself (that gate has its own dedicated describe block below).
const ALL_STAGES_COMPLETE: EngineInput["stages"] = STAGES.map((stage) => ({ stage, status: "COMPLETE" }));

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
    stages: ALL_STAGES_COMPLETE,
  };
}

describe("audit-engine coverage: META_OR_NON_PLAYER silent-re-entry guard", () => {
  // Task 20/21 reconciliation, regression test: real code "057" ("Evidence Freshness &
  // Confirmation") is META_OR_NON_PLAYER and must never count toward the player-evidence
  // coverage denominator (Decision 1). meta-derived-evidence.server.ts legitimately
  // writes a descriptive meta-analysis value into this same row and, in doing so, also
  // overwrites p1_treatment/p2_treatment/status away from "EXCLUDED" (to PARTIAL/
  // COMPLETE) -- this is exactly the kind of silent re-entry Decision 1 asked to be
  // guarded against. coverageFor() must derive exclusion from the metric's own code
  // identity (classifyMetric), not from whatever treatment a downstream writer
  // happens to have set, so this can never slip back into the denominator.
  it("keeps a META_OR_NON_PLAYER code excluded even after a downstream writer overwrites its treatment away from EXCLUDED", () => {
    const metrics: EngineInput["metrics"] = [
      { status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE", p1_treatment: "DIRECT", p2_treatment: "DIRECT", matrix_derived: false, evidence_family: "RESULTS_SCHEDULE", metric_name: "Set Profile", metric_code: "008" },
      { status: "UNAVAILABLE", p1_status: "UNAVAILABLE", p2_status: "UNAVAILABLE", p1_treatment: "UNAVAILABLE", p2_treatment: "UNAVAILABLE", matrix_derived: false, evidence_family: null, metric_name: "Common-Opponent Network", metric_code: "007" },
      // Simulates meta-derived-evidence.server.ts's post-instantiate write: p1/p2
      // treatment flipped to PARTIAL and status flipped to COMPLETE for a META_OR_NON_PLAYER
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

  it("still counts a real LEGITIMATE_PLAYER_METRIC code as its actual treatment, never as EXCLUDED", () => {
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

describe("audit-engine coverage: NO_SOURCE denominator-eligibility bucket", () => {
  // Denominator-eligibility audit, requested directly: a code with a documented
  // determination that no legitimate evidence pathway exists is excluded from the
  // coverage denominator like META_OR_NON_PLAYER, but tracked as its own distinct bucket --
  // never merged into "excluded" -- so the two stay separately auditable. classifyMetric
  // is mocked above to treat code "999" as PROTECTED_UNAVAILABLE for this test file only.
  it("excludes a NO_SOURCE code from the denominator as its own bucket, distinct from EXCLUDED", () => {
    const metrics: EngineInput["metrics"] = [
      { status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE", p1_treatment: "DIRECT", p2_treatment: "DIRECT", matrix_derived: false, evidence_family: "RESULTS_SCHEDULE", metric_name: "Set Profile", metric_code: "008" },
      { status: "UNAVAILABLE", p1_status: "UNAVAILABLE", p2_status: "UNAVAILABLE", p1_treatment: "UNAVAILABLE", p2_treatment: "UNAVAILABLE", matrix_derived: false, evidence_family: null, metric_name: "Common-Opponent Network", metric_code: "007" },
      { status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE", p1_treatment: "PARTIAL", p2_treatment: "PARTIAL", matrix_derived: false, evidence_family: null, metric_name: "mocked no-source code", metric_code: "999" },
    ];
    const report = evaluate(input(metrics));
    expect(report.coverage.p1.excluded).toBe(0);
    expect(report.coverage.p1.noSource).toBe(1);
    expect(report.coverage.p1.total).toBe(3);
    // Denominator is 2 (008 + 007), not 3; only 008 is usable -> 50%.
    expect(report.coverage.p1.usablePercent).toBe(50);
    expect(report.coverage.p1.statuses).toEqual(["DIRECT", "UNAVAILABLE", "NO_SOURCE"]);
  });

  it("keeps a NO_SOURCE code out of the denominator even after a downstream writer overwrites its treatment (same silent-re-entry guard as META_OR_NON_PLAYER)", () => {
    const metrics: EngineInput["metrics"] = [
      { status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE", p1_treatment: "RECONSTRUCTED", p2_treatment: "RECONSTRUCTED", matrix_derived: false, evidence_family: "POINT_BY_POINT", metric_name: "real code", metric_code: "018" },
      { status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE", p1_treatment: "DIRECT", p2_treatment: "DIRECT", matrix_derived: false, evidence_family: null, metric_name: "mocked no-source code, overwritten downstream", metric_code: "999" },
    ];
    const report = evaluate(input(metrics));
    expect(report.coverage.p1.noSource).toBe(1);
    expect(report.coverage.p1.excluded).toBe(0);
    // Denominator is 1 (018 only) -> 100%, not the 100% two-usable-of-two would also
    // give, so also check total/reconstructed directly to prove 999 didn't just get counted.
    expect(report.coverage.p1.total).toBe(2);
    expect(report.coverage.p1.reconstructed).toBe(1);
  });

  it("both META_OR_NON_PLAYER and NO_SOURCE can coexist and are both excluded, distinctly counted", () => {
    const metrics: EngineInput["metrics"] = [
      { status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE", p1_treatment: "DIRECT", p2_treatment: "DIRECT", matrix_derived: false, evidence_family: "RESULTS_SCHEDULE", metric_name: "Set Profile", metric_code: "008" },
      { status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE", p1_treatment: "PARTIAL", p2_treatment: "PARTIAL", matrix_derived: false, evidence_family: null, metric_name: "Evidence Freshness & Confirmation", metric_code: "057" },
      { status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE", p1_treatment: "PARTIAL", p2_treatment: "PARTIAL", matrix_derived: false, evidence_family: null, metric_name: "mocked no-source code", metric_code: "999" },
    ];
    const report = evaluate(input(metrics));
    expect(report.coverage.p1.excluded).toBe(1);
    expect(report.coverage.p1.noSource).toBe(1);
    expect(report.coverage.p1.total).toBe(3);
    expect(report.coverage.p1.usablePercent).toBe(100);
  });
});

describe("audit-engine terminal identity outcomes", () => {
  it("completes an UNVERIFIED identity audit as insufficient evidence instead of blocking the final gate", () => {
    const report = evaluate({
      match: { ...baseMatch, identity_status: "UNVERIFIED" },
      run: {
        ...baseRun,
        research_lock_at: "2026-08-30T03:30:00.000Z",
        independent_decision_committed_at: "2026-08-30T03:31:00.000Z",
        matrix_revealed_at: "2026-08-30T03:32:00.000Z",
        calibration_version_id: "calibration-v1",
      },
      metrics: [
        {
          status: "UNAVAILABLE",
          p1_status: "UNAVAILABLE",
          p2_status: "UNAVAILABLE",
          p1_treatment: "UNAVAILABLE",
          p2_treatment: "UNAVAILABLE",
          matrix_derived: false,
          evidence_family: null,
          metric_name: "Unavailable metric",
          metric_code: "007",
          p1_value: null,
          p2_value: null,
          sources: [],
        },
      ],
      verification: [{ status: "COMPLETE", outcome: "UNAVAILABLE", severity: "STANDARD" }],
      disagreement: [{ status: "COMPLETE", contradiction_severity: "NONE" }],
      underdog: [{ status: "COMPLETE", classification: "UNRESOLVED", player_side: "Alpha" }],
      stress: [{ status: "COMPLETE", test_code: "ST01", outcome: "STABLE" }],
      reconstructions: [],
      conflicts: [],
      matrixWp: null,
      stages: ALL_STAGES_COMPLETE,
    });

    expect(report.auditComplete).toBe(true);
    expect(report.completionPercent).toBe(100);
    expect(report.color).toBe("INSUFFICIENT EVIDENCE");
    expect(report.checks.find((check) => check.key === "identity")).toMatchObject({
      pass: true,
      detail: "UNVERIFIED",
    });
  });
});

describe("audit-engine: Final Combination Gate stage-dependency gate", () => {
  // Regression coverage for the audit pipeline's dependency-ordered state
  // machine: auditComplete (and therefore the Final Combination Gate) must
  // require the REAL, persisted audit_stage_runs statuses to show every
  // upstream stage COMPLETE -- not just that the child-row counts happen to
  // look done. This is what closes the double-bookkeeping gap that let the
  // gate appear complete while audit_stage_runs still showed an upstream
  // stage unexecuted.
  const fullRows = (): EngineInput["metrics"] => [
    { status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE", p1_treatment: "DIRECT", p2_treatment: "DIRECT", matrix_derived: false, evidence_family: "FAM", metric_name: "m", metric_code: "008" },
  ];
  const fullCommitted = (metrics: EngineInput["metrics"], stages: EngineInput["stages"]): EngineInput => ({
    match: baseMatch,
    run: { ...baseRun, research_lock_at: "2026-08-30T03:30:00.000Z", independent_decision_committed_at: "2026-08-30T03:31:00.000Z", matrix_revealed_at: "2026-08-30T03:32:00.000Z", calibration_version_id: "cal-1" },
    metrics,
    verification: [{ status: "COMPLETE", outcome: "PASS", severity: "STANDARD" }],
    disagreement: [{ status: "COMPLETE", contradiction_severity: "NONE" }],
    underdog: [{ status: "COMPLETE", classification: "WEAK", player_side: "Beta" }],
    stress: [{ status: "COMPLETE", test_code: "ST01", outcome: "STABLE" }],
    reconstructions: [],
    conflicts: [],
    matrixWp: null,
    stages,
  });

  it("keeps auditComplete false when every child-row check passes but a required stage is not persisted COMPLETE", () => {
    // All row-level data looks fully done, but P1/P2 METRIC EXECUTION never
    // actually persisted COMPLETE in audit_stage_runs (e.g. the row-level
    // writes landed but the process died before the stage's own terminal
    // write) -- this must not let the gate read as complete.
    const staleStages = ALL_STAGES_COMPLETE.filter((s) => s.stage !== "P1 METRIC EXECUTION" && s.stage !== "P2 METRIC EXECUTION").concat([
      { stage: "P1 METRIC EXECUTION", status: "RUNNING" },
      { stage: "P2 METRIC EXECUTION", status: "RUNNING" },
    ]);
    const report = evaluate(fullCommitted(fullRows(), staleStages));
    expect(report.auditComplete).toBe(false);
    expect(report.stageGaps).toEqual(expect.arrayContaining(["P1 METRIC EXECUTION", "P2 METRIC EXECUTION"]));
    const stageCheck = report.checks.find((c) => c.key === "stage_execution");
    expect(stageCheck?.pass).toBe(false);
  });

  it("reports auditComplete true only once every stage is persisted COMPLETE", () => {
    const report = evaluate(fullCommitted(fullRows(), ALL_STAGES_COMPLETE));
    expect(report.auditComplete).toBe(true);
    expect(report.stageGaps).toEqual([]);
    expect(report.checks.find((c) => c.key === "stage_execution")).toMatchObject({ pass: true, detail: "COMPLETE" });
  });

  it("blocks completion when a single early stage (identity) never persisted COMPLETE, even though everything else is COMPLETE", () => {
    const stages = ALL_STAGES_COMPLETE.map((s) => (s.stage === "MATCH IDENTITY VERIFICATION" ? { ...s, status: "NOT STARTED" } : s));
    const report = evaluate(fullCommitted(fullRows(), stages));
    expect(report.auditComplete).toBe(false);
    expect(report.stageGaps).toContain("MATCH IDENTITY VERIFICATION");
  });

  it("treats a missing stage row the same as an incomplete one", () => {
    const stages = ALL_STAGES_COMPLETE.filter((s) => s.stage !== "STRESS / REMOVAL TESTS");
    const report = evaluate(fullCommitted(fullRows(), stages));
    expect(report.auditComplete).toBe(false);
    expect(report.stageGaps).toContain("STRESS / REMOVAL TESTS");
  });
});
