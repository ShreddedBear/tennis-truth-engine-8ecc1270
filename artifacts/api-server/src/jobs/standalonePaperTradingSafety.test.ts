import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LockPool } from "./advisoryLock.js";
import { PAPER_TRADING_ADVISORY_LOCK_KEY, runPaperTradingJobWithLock } from "./runPaperTradingJob.js";
import {
  PARLAY_PAPER_TRADING_ADVISORY_LOCK_KEY,
  runParlayPaperTradingCycleWithLock,
  runParlayPaperTradingJob,
  type ParlayPaperTradingCycleSummary,
} from "./runParlayPaperTradingJob.js";

function fakePool(): LockPool {
  const held = new Set<bigint>();
  return {
    async connect() {
      let acquired: bigint | null = null;
      return {
        async query<T>(sql: string, params?: unknown[]) {
          const key = params?.[0] as bigint;
          if (sql.includes("pg_try_advisory_lock")) {
            const locked = !held.has(key);
            if (locked) {
              held.add(key);
              acquired = key;
            }
            return { rows: [{ locked }] as T[] };
          }
          if (sql.includes("pg_advisory_unlock")) {
            if (acquired === key) held.delete(key);
            return { rows: [] as T[] };
          }
          throw new Error(`Unexpected fake pool query: ${sql}`);
        },
        release() {},
      };
    },
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => { resolve = finish; });
  return { promise, resolve };
}

function phaseResults(failed?: keyof ParlayPaperTradingCycleSummary): ParlayPaperTradingCycleSummary {
  const phase = (name: keyof ParlayPaperTradingCycleSummary) => ({
    ok: name !== failed,
    result: null,
    error: name === failed ? `${name} provider unavailable` : null,
  });
  return {
    discovery: phase("discovery"),
    markStarted: phase("markStarted"),
    settlement: phase("settlement"),
    grading: phase("grading"),
  };
}

describe("standalone paper-trading lock wiring", () => {
  it("PE standalone and in-process use one database key; simultaneous standalone runs cannot overlap", async () => {
    const pool = fakePool();
    const gate = deferred();
    let calls = 0;
    const runJob = async () => {
      calls++;
      await gate.promise;
      return { ok: true };
    };
    const standalone = runPaperTradingJobWithLock("external_schedule", pool, runJob);
    // Let the first caller acquire the lock while the cycle is awaiting.
    await new Promise((resolve) => setImmediate(resolve));
    const [second, inProcess] = await Promise.all([
      runPaperTradingJobWithLock("external_schedule", pool, runJob),
      runPaperTradingJobWithLock("interval", pool, runJob),
    ]);
    assert.deepEqual(second, { kind: "lock_skipped" });
    assert.deepEqual(inProcess, { kind: "lock_skipped" });
    assert.equal(calls, 1);
    gate.resolve();
    assert.deepEqual(await standalone, { kind: "ran", result: { ok: true } });
    assert.equal((await runPaperTradingJobWithLock("external_schedule", pool, async () => ({ ok: true }))).kind, "ran");
    assert.notEqual(PAPER_TRADING_ADVISORY_LOCK_KEY, PARLAY_PAPER_TRADING_ADVISORY_LOCK_KEY);
  });

  it("Builder standalone and in-process cannot overlap; both reuse the established Builder key", async () => {
    const pool = fakePool();
    const gate = deferred();
    let calls = 0;
    const runJob = async () => {
      calls++;
      await gate.promise;
      return { ok: true };
    };
    const standalone = runParlayPaperTradingCycleWithLock("sha", "external_schedule", pool, runJob);
    await new Promise((resolve) => setImmediate(resolve));
    const inProcess = await runParlayPaperTradingCycleWithLock("sha", "interval", pool, runJob);
    const secondStandalone = await runParlayPaperTradingCycleWithLock("sha", "external_schedule", pool, runJob);
    assert.deepEqual(inProcess, { kind: "lock_skipped" });
    assert.deepEqual(secondStandalone, { kind: "lock_skipped" });
    assert.equal(calls, 1);
    gate.resolve();
    assert.deepEqual(await standalone, { kind: "ran", result: { ok: true } });
    assert.equal((await runParlayPaperTradingCycleWithLock("sha", "interval", pool, async () => ({ ok: true }))).kind, "ran");
    assert.equal(PARLAY_PAPER_TRADING_ADVISORY_LOCK_KEY, 481516234n);
  });
});

describe("Builder job-run status", () => {
  it("records failed status and preserves the partial summary for each required phase failure", async () => {
    for (const failedPhase of ["discovery", "markStarted", "settlement", "grading"] as const) {
      const rows: Array<{ status: string; errorMessage?: string | null; summary?: unknown; triggerType?: string | null }> = [];
      const summary = phaseResults(failedPhase);
      const result = await runParlayPaperTradingJob(
        "sha", "external_schedule", async () => summary,
        async (row) => { rows.push(row); },
      );
      assert.deepEqual(result, { ok: false });
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.status, "failed");
      assert.match(rows[0]?.errorMessage ?? "", new RegExp(`${failedPhase}: ${failedPhase} provider unavailable`));
      assert.deepEqual(rows[0]?.summary, summary);
      assert.equal(rows[0]?.triggerType, "external_schedule");
    }
  });

  it("records success with no error when all required phases succeed", async () => {
    const rows: Array<{ status: string; errorMessage?: string | null }> = [];
    const result = await runParlayPaperTradingJob(
      "sha", "interval", async () => phaseResults(),
      async (row) => { rows.push(row); },
    );
    assert.deepEqual(result, { ok: true });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, "success");
    assert.equal(rows[0]?.errorMessage, null);
  });
});