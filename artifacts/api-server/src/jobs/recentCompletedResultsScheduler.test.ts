import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createRecentCompletedResultsCycleTrigger,
  RECENT_COMPLETED_RESULTS_INTERVAL_MS,
  startRecentCompletedResultsScheduler,
} from "./recentCompletedResultsScheduler.js";
import type { JobTriggerType } from "./jobTriggerType.js";

describe("recent completed-results scheduler", () => {
  it("uses a five-minute in-process cadence", () => {
    assert.equal(RECENT_COMPLETED_RESULTS_INTERVAL_MS, 5 * 60_000);
  });

  it("shares one in-flight guard across trigger types", async () => {
    let finish!: () => void;
    const calls: JobTriggerType[] = [];
    const trigger = createRecentCompletedResultsCycleTrigger((type) => {
      calls.push(type);
      return new Promise((resolve) => {
        finish = () => resolve({ ok: true });
      });
    });

    trigger("startup");
    trigger("interval");
    assert.deepEqual(calls, ["startup"]);
    finish();
    await new Promise((resolve) => setImmediate(resolve));
    trigger("interval");
    assert.deepEqual(calls, ["startup", "interval"]);
  });

  it("does not register timers when external scheduling is selected", () => {
    const handle = startRecentCompletedResultsScheduler({ BACKGROUND_JOB_MODE: "external" });
    assert.deepEqual(handle, {
      enabled: false,
      intervalHandle: null,
      initialTimeoutHandle: null,
    });
  });
});