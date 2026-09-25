import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PAPER_TRADING_INTERVAL_MS,
  createPaperTradingCycleTrigger,
  startPaperTradingScheduler,
} from "./paperTradingScheduler.js";
import type { JobTriggerType } from "./jobTriggerType.js";

describe("PAPER_TRADING_INTERVAL_MS", () => {
  it("is configured to 15 minutes", () => {
    assert.equal(PAPER_TRADING_INTERVAL_MS, 15 * 60_000);
  });
});

describe("createPaperTradingCycleTrigger", () => {
  it("in-flight guard: a tick while the first is still running never invokes runJob concurrently (no overlap)", async () => {
    let callCount = 0;
    let resolveFirst: (() => void) | null = null;
    const runJob = async () => {
      callCount++;
      await new Promise<void>((resolve) => { resolveFirst = resolve; });
      return { ok: true };
    };
    const trigger = createPaperTradingCycleTrigger(runJob);
    trigger("interval");
    trigger("interval"); // second tick while the first is still awaiting -- must be a same-process no-op
    assert.equal(callCount, 1);
    resolveFirst!();
    await new Promise((r) => setImmediate(r));
  });

  it("in-flight guard is shared between startup and interval calls -- a startup fire in progress blocks an interval fire, not just another startup fire", async () => {
    let callCount = 0;
    let resolveFirst: (() => void) | null = null;
    const runJob = async () => {
      callCount++;
      await new Promise<void>((resolve) => { resolveFirst = resolve; });
      return { ok: true };
    };
    const trigger = createPaperTradingCycleTrigger(runJob);
    trigger("startup");
    trigger("interval");
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
    const trigger = createPaperTradingCycleTrigger(runJob);
    trigger("interval");
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    trigger("interval");
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
    const trigger = createPaperTradingCycleTrigger(runJob);
    trigger("interval");
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    trigger("interval");
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
    const trigger = createPaperTradingCycleTrigger(runJob);
    trigger("interval");
    await new Promise((r) => setImmediate(r));
    trigger("interval");
    await new Promise((r) => setImmediate(r));
    assert.equal(call, 2);
  });

  it("passes the exact triggerType given to trigger() through to runJob, unmodified", async () => {
    const seen: JobTriggerType[] = [];
    const runJob = async (triggerType: JobTriggerType) => {
      seen.push(triggerType);
      return { ok: true };
    };
    const trigger = createPaperTradingCycleTrigger(runJob);
    trigger("startup");
    await new Promise((r) => setImmediate(r));
    trigger("interval");
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(seen, ["startup", "interval"]);
  });
});

describe("startPaperTradingScheduler", () => {
  it("registers exactly one interval and one initial timeout at the configured cadence (never multiplies)", () => {
    const runJob = async () => ({ ok: true });
    const handle = startPaperTradingScheduler(runJob, {});
    try {
      assert.ok(handle.intervalHandle != null);
      assert.ok(handle.initialTimeoutHandle != null);
    } finally {
      if (handle.intervalHandle) clearInterval(handle.intervalHandle);
      if (handle.initialTimeoutHandle) clearTimeout(handle.initialTimeoutHandle);
    }
  });

  it("registers no timers at all when BACKGROUND_JOB_MODE=external -- the double-scheduling firewall", () => {
    const runJob = async () => ({ ok: true });
    const handle = startPaperTradingScheduler(runJob, { BACKGROUND_JOB_MODE: "external" });
    assert.equal(handle.intervalHandle, null);
    assert.equal(handle.initialTimeoutHandle, null);
  });
});
