import test from "node:test";
import assert from "node:assert/strict";
import { runWithConcurrency } from "./concurrency";

test("runWithConcurrency never runs more than `limit` workers at once", async () => {
  const items = Array.from({ length: 150 }, (_, i) => i);
  let inFlight = 0;
  let maxInFlight = 0;

  await runWithConcurrency(items, 6, async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inFlight--;
  });

  assert.ok(maxInFlight <= 6, `expected at most 6 concurrent workers, saw ${maxInFlight}`);
});

test("runWithConcurrency completes an item exactly once per index, regardless of completion order", async () => {
  const items = Array.from({ length: 149 }, (_, i) => i);
  const results = new Array<number>(items.length);

  await runWithConcurrency(items, 8, async (item, index) => {
    // Simulate work that finishes out of order (later items sometimes resolve first).
    await new Promise((resolve) => setTimeout(resolve, (index % 3) * 2));
    results[index] = item * 10;
  });

  assert.equal(results.length, 149, "must produce exactly one result per input item");
  assert.ok(results.every((r) => r !== undefined), "no slot may be left unfilled");
  results.forEach((r, i) => assert.equal(r, items[i] * 10, `result[${i}] must correspond to items[${i}]`));
});

test("a per-item failure does not lose or corrupt any other item's result", async () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const results = new Array<string>(items.length);

  await runWithConcurrency(items, 4, async (item, index) => {
    try {
      if (item === 7) throw new Error("simulated provider failure");
      results[index] = "ok";
    } catch {
      results[index] = "fallback";
    }
  });

  assert.equal(results.length, 20);
  assert.equal(results[7], "fallback");
  assert.equal(results.filter((r) => r === "ok").length, 19);
});

test("an empty item list resolves immediately without invoking the worker", async () => {
  let called = false;
  await runWithConcurrency([], 6, async () => { called = true; });
  assert.equal(called, false);
});
