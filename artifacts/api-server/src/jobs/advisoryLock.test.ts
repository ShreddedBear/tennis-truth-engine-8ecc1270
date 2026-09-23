import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runWithAdvisoryLock, type LockClient, type LockPool } from "./advisoryLock.js";

/**
 * Fakes real Postgres session-level advisory lock semantics closely enough to exercise the
 * guard logic without a database: a single shared `held` set (locks are database-wide, not
 * per-connection) where only the client that acquired a key may release it -- exactly like
 * `pg_advisory_unlock` returning false (a no-op, never releasing someone else's lock) when
 * called by a session that never held that key.
 */
function makeFakePool() {
  const held = new Map<bigint, symbol>();
  let clientCounter = 0;
  const releasedClients: symbol[] = [];

  const pool: LockPool = {
    async connect(): Promise<LockClient> {
      const clientId = Symbol(`client-${clientCounter++}`);
      let released = false;
      return {
        async query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }> {
          if (text.includes("pg_try_advisory_lock")) {
            const key = params![0] as bigint;
            if (held.has(key)) return { rows: [{ locked: false }] as unknown as T[] };
            held.set(key, clientId);
            return { rows: [{ locked: true }] as unknown as T[] };
          }
          if (text.includes("pg_advisory_unlock")) {
            const key = params![0] as bigint;
            if (held.get(key) === clientId) held.delete(key);
            return { rows: [] as unknown as T[] };
          }
          throw new Error(`unexpected query in fake pool: ${text}`);
        },
        release(): void {
          released = true;
          releasedClients.push(clientId);
        },
      };
    },
  };

  return { pool, held, releasedClients };
}

describe("runWithAdvisoryLock", () => {
  it("1: first caller acquires the lock and runs", async () => {
    const { pool } = makeFakePool();
    const outcome = await runWithAdvisoryLock(pool, 1n, async () => "done");
    assert.deepEqual(outcome, { kind: "ran", result: "done" });
  });

  it("2: a concurrent caller (lock already held) skips cleanly, never runs fn", async () => {
    const { pool, held } = makeFakePool();
    held.set(2n, Symbol("someone-else"));
    let fnCalled = false;
    const outcome = await runWithAdvisoryLock(pool, 2n, async () => { fnCalled = true; return "x"; });
    assert.deepEqual(outcome, { kind: "lock_skipped" });
    assert.equal(fnCalled, false);
  });

  it("3: lock is released after success", async () => {
    const { pool, held } = makeFakePool();
    await runWithAdvisoryLock(pool, 3n, async () => "ok");
    assert.equal(held.has(3n), false);
  });

  it("4: lock is released after fn throws", async () => {
    const { pool, held } = makeFakePool();
    await assert.rejects(() =>
      runWithAdvisoryLock(pool, 4n, async () => { throw new Error("boom"); }),
    );
    assert.equal(held.has(4n), false);
  });

  it("5: after release, a subsequent call can acquire the same key again", async () => {
    const { pool } = makeFakePool();
    const first = await runWithAdvisoryLock(pool, 5n, async () => "first");
    const second = await runWithAdvisoryLock(pool, 5n, async () => "second");
    assert.deepEqual(first, { kind: "ran", result: "first" });
    assert.deepEqual(second, { kind: "ran", result: "second" });
  });

  it("6: two truly concurrent callers on the same key never both run (no overlap)", async () => {
    const { pool } = makeFakePool();
    let concurrentRunners = 0;
    let maxConcurrent = 0;
    const runOnce = () => runWithAdvisoryLock(pool, 6n, async () => {
      concurrentRunners++;
      maxConcurrent = Math.max(maxConcurrent, concurrentRunners);
      await new Promise((r) => setTimeout(r, 5));
      concurrentRunners--;
      return "work";
    });
    const [a, b] = await Promise.all([runOnce(), runOnce()]);
    const outcomes = [a.kind, b.kind].sort();
    assert.deepEqual(outcomes, ["lock_skipped", "ran"]);
    assert.equal(maxConcurrent, 1);
  });

  it("the client is always released back to the pool, success or failure", async () => {
    const { pool, releasedClients } = makeFakePool();
    await runWithAdvisoryLock(pool, 7n, async () => "ok");
    await assert.rejects(() => runWithAdvisoryLock(pool, 8n, async () => { throw new Error("boom"); }));
    assert.equal(releasedClients.length, 2);
  });
});
