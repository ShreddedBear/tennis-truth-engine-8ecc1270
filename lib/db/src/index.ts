import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = new URL(process.env.DATABASE_URL);
const databaseName = process.env.STATS_DATABASE_NAME;
if (databaseName) {
  if (!/^[a-z_][a-z0-9_]*$/u.test(databaseName)) {
    throw new Error("STATS_DATABASE_NAME must be a valid PostgreSQL database name");
  }
  databaseUrl.pathname = `/${databaseName}`;
}

export const pool = new Pool({ connectionString: databaseUrl.toString() });

// Without this listener, PostgreSQL forcibly terminating an idle connection
// (e.g. admin command, connection timeout, DB maintenance) causes pg-pool to
// emit an 'error' event on the idle client. With no listener, Node.js treats
// it as an uncaught exception and crashes the process with exit code 1.
// This handler absorbs those transient disconnects; pg-pool automatically
// removes the dead client and opens a fresh one on the next query.
pool.on("error", (err) => {
  console.error("[db] Idle client error — connection was terminated unexpectedly. pg-pool will replace it automatically.", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
export * from "./truthEngine";
export * from "./truthEngine/audit";
export * from "./truthEngine/calibration";
export * from "./truthEngine/evidenceSource";
export * from "./truthEngine/ingestion";
export * from "./truthEngine/matchSummary";
export * from "./truthEngine/metricsResults";
export * from "./truthEngine/rulesPublication";
