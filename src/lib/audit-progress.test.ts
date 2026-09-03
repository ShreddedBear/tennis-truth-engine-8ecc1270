import { describe, expect, it } from "vitest";
import { computeBatchExecutionPercent, computeExecutionPercent } from "./audit-progress";
import { STAGES } from "./audit-pipeline";

describe("computeExecutionPercent", () => {
  it("stays in sync with the real pipeline's stage count", () => {
    // audit-progress.ts duplicates this count locally to avoid pulling
    // audit-pipeline.ts's dependency graph into the client bundle. If the
    // pipeline ever gains/loses a stage, this test must fail until the
    // duplicated constant is updated to match.
    expect(STAGES.length).toBe(16);
  });

  it("does not report near-100% when only the first two of sixteen stages have started", () => {
    // Reproduces the reported bug: MATCH IDENTITY VERIFICATION (0/2, but
    // COMPLETE -- identity search was unavailable, a settled terminal
    // outcome) and MATCH CONTEXT RESOLUTION (5/6, COMPLETE) are done, and
    // DEFINITION INSTANTIATION has just started (0/0, RUNNING, its own item
    // count not yet known). The other 10 stages haven't started at all.
    const rows = [
      { status: "COMPLETE", done_count: 0, total_count: 2 },
      { status: "COMPLETE", done_count: 5, total_count: 6 },
      { status: "RUNNING", done_count: 0, total_count: 0 },
    ];
    const pct = computeExecutionPercent(rows);
    expect(pct).toBeLessThan(20);
    expect(pct).toBe(Math.round((2 / 16) * 100));
  });

  it("gives partial credit within a stage that has a known total", () => {
    const rows = [
      { status: "COMPLETE", done_count: 2, total_count: 2 },
      { status: "RUNNING", done_count: 40, total_count: 80 },
    ];
    const pct = computeExecutionPercent(rows);
    expect(pct).toBe(Math.round((1.5 / 16) * 100));
  });

  it("reaches 100% only when every stage is COMPLETE", () => {
    const rows = Array.from({ length: 16 }, () => ({ status: "COMPLETE", done_count: 1, total_count: 1 }));
    expect(computeExecutionPercent(rows)).toBe(100);
  });

  it("caps a BLOCKED run at 99% even if stages otherwise look complete", () => {
    const rows = Array.from({ length: 16 }, () => ({ status: "COMPLETE", done_count: 1, total_count: 1 }));
    expect(computeExecutionPercent(rows, "BLOCKED")).toBe(99);
  });

  it("returns 0 for no rows at all", () => {
    expect(computeExecutionPercent([])).toBe(0);
  });

  it("is never 0% when the current run has persisted completed stages: 4 of 16 stages complete is 25%, not 0%", () => {
    const rows = Array.from({ length: 4 }, () => ({ status: "COMPLETE", done_count: 1, total_count: 1 }));
    expect(computeExecutionPercent(rows)).toBe(25);
  });

  it("does not count a stage twice because it has multiple retry/attempt records for the same stage name", () => {
    // Same stage, three "records" (as if a caller accidentally handed in
    // retry history instead of the one canonical row) -- must score as ONE
    // COMPLETE stage, not three.
    const rows = [
      { stage: "P1 METRIC EXECUTION", status: "RUNNING", done_count: 21, total_count: 81 },
      { stage: "P1 METRIC EXECUTION", status: "COMPLETE", done_count: 81, total_count: 81 },
      { stage: "P1 METRIC EXECUTION", status: "COMPLETE", done_count: 81, total_count: 81 },
    ];
    expect(computeExecutionPercent(rows)).toBe(Math.round((1 / 16) * 100));
  });

  it("P1 with 3 attempts that ultimately completes counts once, alongside 3 other genuinely complete stages", () => {
    const rows = [
      { stage: "MATCH INGESTION / PDF EXTRACTION", status: "COMPLETE", done_count: 1, total_count: 1 },
      { stage: "MATCH IDENTITY VERIFICATION", status: "COMPLETE", done_count: 2, total_count: 2 },
      { stage: "MATCH CONTEXT RESOLUTION", status: "COMPLETE", done_count: 6, total_count: 6 },
      { stage: "P1 METRIC EXECUTION", status: "RUNNING", done_count: 21, total_count: 81, attempts: 1 },
      { stage: "P1 METRIC EXECUTION", status: "COMPLETE", done_count: 81, total_count: 81, attempts: 3 },
    ];
    expect(computeExecutionPercent(rows)).toBe(25);
  });
});

describe("computeBatchExecutionPercent", () => {
  it("weights every run's pipeline equally, not just its already-known stages", () => {
    const stuck = [
      { status: "COMPLETE", done_count: 0, total_count: 2 },
      { status: "COMPLETE", done_count: 5, total_count: 6 },
      { status: "RUNNING", done_count: 0, total_count: 0 },
    ];
    const byRun = new Map([
      ["run-a", stuck],
      ["run-b", stuck],
    ]);
    const pct = computeBatchExecutionPercent(byRun);
    expect(pct).toBeLessThan(20);
  });

  it("returns 0 for an empty batch", () => {
    expect(computeBatchExecutionPercent(new Map())).toBe(0);
  });

  it("does not double-count a stage that appears more than once for the same run", () => {
    const byRun = new Map([
      [
        "run-a",
        [
          { stage: "P1 METRIC EXECUTION", status: "RUNNING", done_count: 21, total_count: 81 },
          { stage: "P1 METRIC EXECUTION", status: "COMPLETE", done_count: 81, total_count: 81 },
        ],
      ],
    ]);
    expect(computeBatchExecutionPercent(byRun)).toBe(Math.round((1 / 16) * 100));
  });
});
