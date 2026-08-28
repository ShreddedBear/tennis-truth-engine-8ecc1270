import { describe, expect, it } from "vitest";
import { computeBatchExecutionPercent, computeExecutionPercent } from "./audit-progress";
import { STAGES } from "./audit-pipeline";

describe("computeExecutionPercent", () => {
  it("stays in sync with the real pipeline's stage count", () => {
    // audit-progress.ts duplicates this count locally to avoid pulling
    // audit-pipeline.ts's dependency graph into the client bundle. If the
    // pipeline ever gains/loses a stage, this test must fail until the
    // duplicated constant is updated to match.
    expect(STAGES.length).toBe(13);
  });

  it("does not report near-100% when only the first two of thirteen stages have started", () => {
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
    expect(pct).toBe(Math.round((2 / 13) * 100));
  });

  it("gives partial credit within a stage that has a known total", () => {
    const rows = [
      { status: "COMPLETE", done_count: 2, total_count: 2 },
      { status: "RUNNING", done_count: 40, total_count: 80 },
    ];
    const pct = computeExecutionPercent(rows);
    expect(pct).toBe(Math.round((1.5 / 13) * 100));
  });

  it("reaches 100% only when every stage is COMPLETE", () => {
    const rows = Array.from({ length: 13 }, () => ({ status: "COMPLETE", done_count: 1, total_count: 1 }));
    expect(computeExecutionPercent(rows)).toBe(100);
  });

  it("caps a BLOCKED run at 99% even if stages otherwise look complete", () => {
    const rows = Array.from({ length: 13 }, () => ({ status: "COMPLETE", done_count: 1, total_count: 1 }));
    expect(computeExecutionPercent(rows, "BLOCKED")).toBe(99);
  });

  it("returns 0 for no rows at all", () => {
    expect(computeExecutionPercent([])).toBe(0);
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
});
