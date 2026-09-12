// The database connection. SERVER ONLY.
//
// This replaces the Supabase JS client. The app no longer speaks to PostgREST over HTTP
// with an anon or service-role API key; it holds a normal PostgreSQL connection pool and
// talks SQL, exactly like ShreddedBear/Tennis-Stats-Engine.
//
// SECURITY NOTE -- READ BEFORE ADDING A CALL SITE.
// A direct connection authenticates as the database role in DATABASE_URL, which is a
// superuser-equivalent owner. Row Level Security does not apply to it. Every table
// privilege and RLS policy this project hardened while it was on PostgREST protected the
// *browser's* anon key, and the browser no longer has a key at all: it cannot reach the
// database except through a server function. That is the new boundary, and it is why no
// module under src/routes (outside server functions) and no *.functions.ts client half may
// import this file. `src/db/server-only.test.ts` enforces that mechanically.
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const { Pool } = pg;

// ---------------------------------------------------------------------------
// ROW SHAPES
//
// node-postgres and PostgREST disagree about how several column types come back, and every
// disagreement is a silent behaviour change across ~200 call sites. The conversions live in
// the COLUMNS (src/db/columns.ts), not here, and that placement is deliberate:
// drizzle-orm's node-postgres session overrides the driver's type parsers for TIMESTAMPTZ,
// TIMESTAMP, DATE and INTERVAL to the identity function, so a pg.types.setTypeParser call
// applies to a raw pool.query() and is bypassed by every query Drizzle issues.
//
// See src/db/driver-parity.test.ts, which asserts against the columns' own
// mapFromDriverValue for exactly that reason.
// ---------------------------------------------------------------------------

function connectionString(): string {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    const message =
      "DATABASE_URL is not set. The app needs a PostgreSQL connection string " +
      "(postgresql://user:password@host:port/database). Add it to Secrets and restart.";
    console.error(`[db] ${message}`);
    throw new Error(message);
  }
  return url;
}

function createPool(): pg.Pool {
  const pool = new Pool({
    connectionString: connectionString(),
    // Serverless/edge-style deployments open a pool per instance; keep each one small so a
    // fan-out of concurrent requests cannot exhaust the server's max_connections.
    max: Number(process.env["DATABASE_POOL_MAX"] ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // Without this listener, PostgreSQL forcibly terminating an idle connection (admin
  // command, connection timeout, maintenance) makes pg-pool emit 'error' on the idle
  // client; with no listener Node treats it as an uncaught exception and kills the process.
  // pg-pool discards the dead client and opens a fresh one on the next query.
  pool.on("error", (error) => {
    console.error("[db] idle client terminated unexpectedly; pool will replace it.", error.message);
  });

  return pool;
}

let _pool: pg.Pool | undefined;
let _db: ReturnType<typeof drizzle> | undefined;

/** The connection pool. Lazily created so importing this module never opens a socket. */
export function getPool(): pg.Pool {
  if (!_pool) _pool = createPool();
  return _pool;
}

/**
 * The Drizzle query interface.
 *
 * Import it like this:
 *   import { db } from "@/db/client.server";
 *   const rows = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
 */
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, receiver) {
    if (!_db) _db = drizzle(getPool());
    return Reflect.get(_db, prop, receiver);
  },
});

/** Closes the pool. For test teardown and graceful shutdown only. */
export async function closePool(): Promise<void> {
  if (!_pool) return;
  const pool = _pool;
  _pool = undefined;
  _db = undefined;
  await pool.end();
}
