import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  acquireHeavyJobLease,
  getActiveHeavyJob,
  spawnEvaluationWorker,
} from "./evaluationWorkerControl";

describe("evaluation worker boundary", () => {
  it("prevents Walk-Forward and Optimizer overlap in one API process", () => {
    const first = acquireHeavyJobLease("walk-forward");
    assert.equal(first.acquired, true);
    assert.equal(getActiveHeavyJob(), "walk-forward");

    const second = acquireHeavyJobLease("optimizer");
    assert.equal(second.acquired, false);
    if (!second.acquired) assert.match(second.reason, /walk-forward/);

    if (first.acquired) first.release();
    assert.equal(getActiveHeavyJob(), null);
  });

  it("propagates a worker failure without touching the database", async () => {
    const worker = spawnEvaluationWorker<never>(
      new URL("data:text/javascript,throw%20new%20Error(%22synthetic%20worker%20failure%22)"),
      null,
      { timeoutMs: 2_000, maxOldGenerationMb: 32 },
    );
    await assert.rejects(worker.promise, /synthetic worker failure|Worker exited|Cannot find/);
  });

  it("supports explicit cancellation at the worker boundary", async () => {
    const worker = spawnEvaluationWorker<never>(
      new URL("data:text/javascript,await%20new%20Promise(()%3D%3E%7B%7D)"),
      null,
      { timeoutMs: 2_000, maxOldGenerationMb: 32 },
    );
    worker.cancel("synthetic explicit cancellation");
    await assert.rejects(worker.promise, /synthetic explicit cancellation/);
  });
});