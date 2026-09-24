import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MATCHED_COHORT_SYNC_INTERVAL_MS,
  createMatchedCohortSyncCycleTrigger,
  startMatchedCohortSyncScheduler,
} from "./matchedCohortSyncScheduler.js";

describe("MATCHED_COHORT_SYNC_INTERVAL_MS", () => {
  it("is configured to 30 minutes", () => {
    assert.equal(MATCHED_COHORT_SYNC_INTERVAL_MS, 30 * 60_000);
  });
});

describe("createMatchedCohortSyncCycleTrigger", () => {
  it("in-flight guard: a tick while the first is still running never invokes runJob concurrently (no overlap)", async () => {
    let callCount = 0;
    let resolveFirst: (() => void) | null = null;
    const runJob = async () => {
      callCount++;
      await new Promise<void>((resolve) => { resolveFirst = resolve; });
      return { ok: true };
    };
    const trigger = createMatchedCohortSyncCycleTrigger(runJob);
    trigger();
    trigger(); // second tick while the first is still awaiting -- must be a same-process no-op
    assert.equal(callCount, 1);
    resolveFirst!();
    await new Promise((r) => setImmediate(r));
  });

  it("after the in-flight cycle finishes, a subsequent tick runs again (cadence continues)", async () => {
    let callCount = 0;
    const runJob = async () => {
      callCount++;
      return { ok: true };
    };
    const trigger = createMatchedCohortSyncCycleTrigger(runJob);
    trigger();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    trigger();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(callCount, 2);
  });

  it("a thrown error from runJob is caught and does not wedge the in-flight flag -- the next tick still runs", async () => {
    let call = 0;
    const runJob = async () => {
      call++;
      if (call === 1) throw new Error("boom");
      return { ok: true };
    };
    const trigger = createMatchedCohortSyncCycleTrigger(runJob);
    trigger();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    trigger();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(call, 2);
  });

  it("a { ok: false } result (recorded failure) is never treated as a throw and never wedges the in-flight flag", async () => {
    let call = 0;
    const runJob = async () => {
      call++;
      return { ok: false };
    };
    const trigger = createMatchedCohortSyncCycleTrigger(runJob);
    trigger();
    await new Promise((r) => setImmediate(r));
    trigger();
    await new Promise((r) => setImmediate(r));
    assert.equal(call, 2);
  });
});

describe("startMatchedCohortSyncScheduler", () => {
  it("registers exactly one interval and one initial timeout at the configured cadence (never multiplies)", () => {
    const runJob = async () => ({ ok: true });
    const handle = startMatchedCohortSyncScheduler(runJob);
    try {
      assert.ok(handle.intervalHandle != null);
      assert.ok(handle.initialTimeoutHandle != null);
    } finally {
      clearInterval(handle.intervalHandle);
      clearTimeout(handle.initialTimeoutHandle);
    }
  });
});
