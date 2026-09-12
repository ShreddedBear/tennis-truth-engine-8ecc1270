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
// DRIVER TYPE PARSERS -- these keep row shapes identical to what PostgREST returned.
//
// This is not tuning. node-postgres and PostgREST disagree about three column types, and
// every disagreement is a silent behaviour change across ~200 call sites that read these
// values as strings:
//
//   timestamptz / timestamp  node-postgres returns a JS Date; PostgREST returned an ISO
//                            string. Left alone, `row.created_at` stops being a string and
//                            every comparison, sort and render against it changes.
//   date                     node-postgres returns a JS Date at UTC midnight; PostgREST
//                            returned "YYYY-MM-DD". Left alone, a date shifts by a day for
//                            any reader west of UTC, which for scheduled_date and
//                            as_of_date would move evidence across the pre-match boundary.
//   int8 / numeric           returned as strings by default to avoid precision loss. That
//                            matches PostgREST and is left as-is.
//
// So timestamps are normalised to ISO-8601 UTC and dates are handed back verbatim. The
// Drizzle schema declares these columns `mode: "string"` to match.
//
// Milliseconds, not microseconds: Postgres stores microsecond precision and PostgREST
// rendered it, while toISOString() truncates to milliseconds. Every value in the app is
// both written and read through this parser, so it stays self-consistent, and the writers
// already produce millisecond ISO strings via new Date().toISOString().
const TIMESTAMPTZ_OID = 1184;
const TIMESTAMP_OID = 1114;
const DATE_OID = 1082;

function toIsoString(value: string): string {
  // Postgres emits "2026-09-11 10:49:22.123+00": a space separator, and a two-digit
  // offset. Neither is valid ISO-8601, and V8's Date parser rejects the bare "+00"
  // outright -- so both are normalised before parsing. A timestamp (not timestamptz)
  // arrives with no offset at all and is read as UTC, which is what it was written as.
  const isoish = value.replace(" ", "T").replace(/([+-]\d{2})$/u, "$1:00");
  const parsed = new Date(isoish);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

pg.types.setTypeParser(TIMESTAMPTZ_OID, toIsoString);
pg.types.setTypeParser(TIMESTAMP_OID, toIsoString);
pg.types.setTypeParser(DATE_OID, (value: string) => value);

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
