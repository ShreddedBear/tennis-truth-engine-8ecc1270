/**
 * Generic cross-instance execution guard built on Postgres session-level advisory locks
 * (`pg_try_advisory_lock`/`pg_advisory_unlock`). Unlike a plain in-memory in-flight boolean
 * (which only guards a single process against itself), the lock lives in Postgres, so it works
 * across every Autoscale instance sharing the same database -- exactly the property a
 * multi-instance-safe job trigger needs and an in-process flag alone cannot provide.
 *
 * Crash safety requires no TTL/heartbeat logic: `pg_try_advisory_lock` is tied to the specific
 * DB session (connection) that acquired it, and Postgres releases a session's advisory locks
 * automatically the instant that connection closes -- including an ungraceful close from a
 * crashed/killed process. This is why the lock is acquired and held on ONE dedicated client for
 * the whole guarded operation, not via the shared pool's `query()` (which can route each call to
 * a different pooled connection).
 *
 * `pool`/`lockKey` are parameterized (not hardcoded to `@workspace/db`'s pool) so this logic is
 * directly unit-testable against a fake in-memory pool, without a real database.
 */

export interface LockClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  release(): void;
}

export interface LockPool {
  connect(): Promise<LockClient>;
}

export type AdvisoryLockOutcome<T> =
  | { kind: "lock_skipped" }
  | { kind: "ran"; result: T };

/**
 * Runs `fn` only if `lockKey` can be acquired immediately (never blocks waiting for it -- a
 * cadence tick that can't get the lock skips cleanly rather than queuing behind another
 * instance's in-progress cycle). The lock is always released via the same client before it's
 * returned to the pool, whether `fn` resolves or throws.
 */
export async function runWithAdvisoryLock<T>(
  pool: LockPool,
  lockKey: bigint,
  fn: () => Promise<T>,
): Promise<AdvisoryLockOutcome<T>> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [lockKey],
    );
    if (rows[0]?.locked !== true) {
      return { kind: "lock_skipped" };
    }
    try {
      const result = await fn();
      return { kind: "ran", result };
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [lockKey]);
    }
  } finally {
    client.release();
  }
}
