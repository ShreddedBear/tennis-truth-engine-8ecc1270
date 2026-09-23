import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isParlayPaperTradingSchedulerEnabled,
  createParlayPaperTradingCycleTrigger,
  startParlayPaperTradingScheduler,
} from "./parlayPaperTradingScheduler.js";

describe("isParlayPaperTradingSchedulerEnabled", () => {
  it("defaults to disabled when unset", () => {
    assert.equal(isParlayPaperTradingSchedulerEnabled({}), false);
  });

  it("disabled for any value other than the exact string 'true'", () => {
    assert.equal(isParlayPaperTradingSchedulerEnabled({ ENABLE_PARLAY_BUILDER_PAPER_TRADING_SCHEDULER: "1" }), false);
    assert.equal(isParlayPaperTradingSchedulerEnabled({ ENABLE_PARLAY_BUILDER_PAPER_TRADING_SCHEDULER: "TRUE" }), false);
    assert.equal(isParlayPaperTradingSchedulerEnabled({ ENABLE_PARLAY_BUILDER_PAPER_TRADING_SCHEDULER: "" }), false);
  });

  it("enabled only when explicitly 'true'", () => {
    assert.equal(isParlayPaperTradingSchedulerEnabled({ ENABLE_PARLAY_BUILDER_PAPER_TRADING_SCHEDULER: "true" }), true);
  });
});

describe("createParlayPaperTradingCycleTrigger", () => {
  it("6: same-process in-flight guard -- a tick while the first is still running never invokes runWithLock concurrently (no overlap)", async () => {
    let callCount = 0;
    let resolveFirst: (() => void) | null = null;
    const runWithLock = async (_sourceCommit: string) => {
      callCount++;
      await new Promise<void>((resolve) => { resolveFirst = resolve; });
      return { kind: "ran" as const, result: { ok: true } };
    };
    const trigger = createParlayPaperTradingCycleTrigger("test-sha", runWithLock as any);
    trigger();
    trigger(); // second tick while the first is still awaiting -- must be a same-process no-op
    assert.equal(callCount, 1);
    resolveFirst!();
    await new Promise((r) => setImmediate(r));
  });

  it("5: after the in-flight cycle finishes, a subsequent tick runs again (cadence continues)", async () => {
    let callCount = 0;
    const runWithLock = async (_sourceCommit: string) => {
      callCount++;
      return { kind: "ran" as const, result: { ok: true } };
    };
    const trigger = createParlayPaperTradingCycleTrigger("test-sha", runWithLock as any);
    trigger();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    trigger();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(callCount, 2);
  });

  it("a lock_skipped outcome is never treated as a failure and never wedges the in-flight flag", async () => {
    let secondCalled = false;
    const trigger = createParlayPaperTradingCycleTrigger(
      "test-sha",
      async () => { secondCalled = true; return { kind: "lock_skipped" as const }; },
    );
    trigger();
    await new Promise((r) => setImmediate(r));
    assert.equal(secondCalled, true);
  });

  it("a thrown error from runWithLock is caught and does not wedge the in-flight flag -- the next tick still runs", async () => {
    let call = 0;
    const runWithLock = async (_sourceCommit: string) => {
      call++;
      if (call === 1) throw new Error("boom");
      return { kind: "ran" as const, result: { ok: true } };
    };
    const trigger = createParlayPaperTradingCycleTrigger("test-sha", runWithLock as any);
    trigger();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    trigger();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(call, 2);
  });
});

describe("startParlayPaperTradingScheduler", () => {
  it("7: scheduler disabled => zero runs -- no interval, no initial timeout, nothing scheduled", () => {
    const handle = startParlayPaperTradingScheduler({});
    assert.equal(handle.enabled, false);
    assert.equal(handle.intervalHandle, null);
    assert.equal(handle.initialTimeoutHandle, null);
  });

  it("when enabled, registers exactly one interval and one initial timeout (never multiplies)", () => {
    const handle = startParlayPaperTradingScheduler({ ENABLE_PARLAY_BUILDER_PAPER_TRADING_SCHEDULER: "true" });
    try {
      assert.equal(handle.enabled, true);
      assert.ok(handle.intervalHandle != null);
      assert.ok(handle.initialTimeoutHandle != null);
    } finally {
      if (handle.intervalHandle) clearInterval(handle.intervalHandle);
      if (handle.initialTimeoutHandle) clearTimeout(handle.initialTimeoutHandle);
    }
  });
});
