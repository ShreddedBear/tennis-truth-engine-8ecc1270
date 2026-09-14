import { describe, expect, it } from "vitest";
import {
  EXPECTED_ACTIVE_SLATE_COUNT,
  createInMemoryManifestStore,
  runControlledReaudit,
  selectReauditMatchIds,
  type ReauditPipelineResult,
} from "./reaudit-active-slate";
import type { RunRow } from "../src/lib/audit-pipeline";
import { INVALIDATED_RUN_STATUS } from "../src/lib/audit-stages";

function match(id: string) { return { id }; }
function run(id: string, matchId: string, status: string, runNumber = 1) { return { id, match_id: matchId, status, run_number: runNumber }; }
function version(matchId: string, isActive: boolean) { return { match_id: matchId, is_active: isActive }; }

describe("selectReauditMatchIds", () => {
  it("selects only matches that are BOTH on the active slate AND have a resolved active run", () => {
    const matches = [match("m1"), match("m2"), match("m3"), match("m4")];
    const runs = [
      run("r1", "m1", "COMPLETE"),
      run("r2", "m2", "COMPLETE"),
      // m3 is on the active slate but has no run at all -- nothing to re-audit.
      run("r4", "m4", INVALIDATED_RUN_STATUS), // m4's only run is invalidated -- resolves to no active run
    ];
    const versions = [version("m1", true), version("m2", true), version("m3", true), version("m4", true)];
    expect(selectReauditMatchIds(matches, runs, versions)).toEqual(["m1", "m2"]);
  });

  it("never includes a match that is not on the active slate, even if it has a COMPLETE run", () => {
    const matches = [match("on-slate"), match("cleared")];
    const runs = [run("r1", "on-slate", "COMPLETE"), run("r2", "cleared", "COMPLETE")];
    const versions = [version("on-slate", true), version("cleared", false)];
    expect(selectReauditMatchIds(matches, runs, versions)).toEqual(["on-slate"]);
  });

  it("EXPECTED_ACTIVE_SLATE_COUNT is the confirmed production slate size this script is scoped to", () => {
    expect(EXPECTED_ACTIVE_SLATE_COUNT).toBe(105);
  });
});

function makeFakeReaudit(overrides?: {
  runsByMatch?: Map<string, RunRow>;
  onRunPipeline?: (matchId: string) => Promise<ReauditPipelineResult> | ReauditPipelineResult;
  concurrentCallTracker?: { current: number; max: number };
}) {
  const runsByMatch = overrides?.runsByMatch ?? new Map<string, RunRow>();
  const tracker = overrides?.concurrentCallTracker;
  let runSeq = 1000;
  const defaultRunPipeline = async (matchId: string): Promise<ReauditPipelineResult> => {
    const newRunId = `forced-run-${runSeq++}`;
    const existing = runsByMatch.get(matchId);
    runsByMatch.set(matchId, { ...(existing as RunRow), id: newRunId, run_number: (existing?.run_number ?? 1) + 1, status: "COMPLETE" });
    return { runId: newRunId, complete: true, failures: [] };
  };
  return {
    runsByMatch,
    getLatestRun: async (matchId: string) => runsByMatch.get(matchId) ?? null,
    runPipeline: async (matchId: string) => {
      if (tracker) {
        tracker.current++;
        tracker.max = Math.max(tracker.max, tracker.current);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      try {
        return await (overrides?.onRunPipeline ? overrides.onRunPipeline(matchId) : defaultRunPipeline(matchId));
      } finally {
        if (tracker) tracker.current--;
      }
    },
  };
}

describe("runControlledReaudit", () => {
  it("forces exactly one new run per match and records it in the manifest", async () => {
    const runsByMatch = new Map<string, RunRow>([
      ["m1", { id: "old-1", match_id: "m1", run_number: 1, status: "COMPLETE" } as RunRow],
      ["m2", { id: "old-2", match_id: "m2", run_number: 1, status: "COMPLETE" } as RunRow],
    ]);
    const fake = makeFakeReaudit({ runsByMatch });
    const manifest = createInMemoryManifestStore();

    const summary = await runControlledReaudit({
      matchIds: ["m1", "m2"],
      getLatestRun: fake.getLatestRun,
      runPipeline: fake.runPipeline,
      manifest,
    });

    expect(summary.ok).toBe(2);
    expect(summary.failed).toBe(0);
    expect(runsByMatch.get("m1")!.id).not.toBe("old-1");
    expect(runsByMatch.get("m2")!.id).not.toBe("old-2");
    expect(manifest.has("m1")).toBe(true);
    expect(manifest.has("m2")).toBe(true);
  });

  it("skips a match already present in the manifest -- never calls runPipeline for it again", async () => {
    const runsByMatch = new Map<string, RunRow>([["m1", { id: "old-1", match_id: "m1", run_number: 1, status: "COMPLETE" } as RunRow]]);
    let calls = 0;
    const fake = makeFakeReaudit({ runsByMatch, onRunPipeline: async (matchId) => { calls++; return { runId: `forced-${matchId}`, complete: true, failures: [] }; } });
    const manifest = createInMemoryManifestStore();
    manifest.record("m1", { matchId: "m1", newRunId: "already-done-run", runNumber: 2, status: "COMPLETE", completedAt: new Date().toISOString() });

    const summary = await runControlledReaudit({ matchIds: ["m1"], getLatestRun: fake.getLatestRun, runPipeline: fake.runPipeline, manifest });

    expect(calls).toBe(0);
    expect(summary.ok).toBe(0);
    expect(summary.skipped).toBe(1);
  });

  it("skips a match whose current run is not COMPLETE, never forcing a new run over a live/blocked one", async () => {
    const runsByMatch = new Map<string, RunRow>([["m1", { id: "run-1", match_id: "m1", run_number: 1, status: "BLOCKED" } as RunRow]]);
    let calls = 0;
    const fake = makeFakeReaudit({ runsByMatch, onRunPipeline: async () => { calls++; return { runId: "x", complete: true, failures: [] }; } });
    const manifest = createInMemoryManifestStore();

    const summary = await runControlledReaudit({ matchIds: ["m1"], getLatestRun: fake.getLatestRun, runPipeline: fake.runPipeline, manifest });

    expect(calls).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(manifest.has("m1")).toBe(false);
  });

  it("a failure on one match is recorded, never retried, and never blocks other matches from processing", async () => {
    const runsByMatch = new Map<string, RunRow>([
      ["good", { id: "old-good", match_id: "good", run_number: 1, status: "COMPLETE" } as RunRow],
      ["bad", { id: "old-bad", match_id: "bad", run_number: 1, status: "COMPLETE" } as RunRow],
    ]);
    let badCallCount = 0;
    const fake = makeFakeReaudit({
      runsByMatch,
      onRunPipeline: async (matchId) => {
        if (matchId === "bad") { badCallCount++; throw new Error("provider timeout"); }
        runsByMatch.set(matchId, { ...runsByMatch.get(matchId)!, id: "new-good", run_number: 2 });
        return { runId: "new-good", complete: true, failures: [] };
      },
    });
    const manifest = createInMemoryManifestStore();

    const summary = await runControlledReaudit({ matchIds: ["good", "bad"], getLatestRun: fake.getLatestRun, runPipeline: fake.runPipeline, manifest });

    expect(summary.ok).toBe(1);
    expect(summary.failed).toBe(1);
    expect(badCallCount).toBe(1); // never retried within this invocation
    expect(manifest.has("bad")).toBe(false); // a failure must never be recorded as done
    expect(manifest.has("good")).toBe(true);
  });

  it("never issues more than the configured concurrency's worth of simultaneous runPipeline calls", async () => {
    const runsByMatch = new Map<string, RunRow>(
      ["m1", "m2", "m3", "m4", "m5"].map((id) => [id, { id: `old-${id}`, match_id: id, run_number: 1, status: "COMPLETE" } as RunRow]),
    );
    const tracker = { current: 0, max: 0 };
    const fake = makeFakeReaudit({ runsByMatch, concurrentCallTracker: tracker });
    const manifest = createInMemoryManifestStore();

    await runControlledReaudit({ matchIds: ["m1", "m2", "m3", "m4", "m5"], getLatestRun: fake.getLatestRun, runPipeline: fake.runPipeline, manifest, concurrency: 2 });

    expect(tracker.max).toBeLessThanOrEqual(2);
  });

  it("clamps a requested concurrency above 3 down to 3 -- can never overwhelm research providers", async () => {
    const runsByMatch = new Map<string, RunRow>(
      Array.from({ length: 8 }, (_, i) => `m${i}`).map((id) => [id, { id: `old-${id}`, match_id: id, run_number: 1, status: "COMPLETE" } as RunRow]),
    );
    const tracker = { current: 0, max: 0 };
    const fake = makeFakeReaudit({ runsByMatch, concurrentCallTracker: tracker });
    const manifest = createInMemoryManifestStore();

    await runControlledReaudit({
      matchIds: Array.from({ length: 8 }, (_, i) => `m${i}`),
      getLatestRun: fake.getLatestRun,
      runPipeline: fake.runPipeline,
      manifest,
      concurrency: 50,
    });

    expect(tracker.max).toBeLessThanOrEqual(3);
  });

  it("deduplicates a matchId that appears twice in the input list -- never forces two runs for the same match in one invocation", async () => {
    const runsByMatch = new Map<string, RunRow>([["m1", { id: "old-1", match_id: "m1", run_number: 1, status: "COMPLETE" } as RunRow]]);
    let calls = 0;
    const fake = makeFakeReaudit({ runsByMatch, onRunPipeline: async () => { calls++; return { runId: "new-1", complete: true, failures: [] }; } });
    const manifest = createInMemoryManifestStore();

    await runControlledReaudit({ matchIds: ["m1", "m1", "m1"], getLatestRun: fake.getLatestRun, runPipeline: fake.runPipeline, manifest });

    expect(calls).toBe(1);
  });

  it("refuses to record a manifest entry if the pipeline call somehow returns the SAME run id (no new run actually created)", async () => {
    const runsByMatch = new Map<string, RunRow>([["m1", { id: "same-run", match_id: "m1", run_number: 1, status: "COMPLETE" } as RunRow]]);
    const fake = makeFakeReaudit({ runsByMatch, onRunPipeline: async () => ({ runId: "same-run", complete: true, failures: [] }) });
    const manifest = createInMemoryManifestStore();

    const summary = await runControlledReaudit({ matchIds: ["m1"], getLatestRun: fake.getLatestRun, runPipeline: fake.runPipeline, manifest });

    expect(summary.failed).toBe(1);
    expect(manifest.has("m1")).toBe(false);
  });
});
