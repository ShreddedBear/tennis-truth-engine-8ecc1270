import { F as esm_default, t as drizzle } from "../_libs/drizzle-orm.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/client.server-B14ewPcb.js
var { Pool } = esm_default;
function connectionString() {
	const url = process.env["DATABASE_URL"];
	if (!url) {
		const message = "DATABASE_URL is not set. The app needs a PostgreSQL connection string (postgresql://user:password@host:port/database). Add it to Secrets and restart.";
		console.error(`[db] ${message}`);
		throw new Error(message);
	}
	return url;
}
function createPool() {
	const pool = new Pool({
		connectionString: connectionString(),
		max: Number(process.env["DATABASE_POOL_MAX"] ?? 10),
		idleTimeoutMillis: 3e4,
		connectionTimeoutMillis: 1e4
	});
	pool.on("error", (error) => {
		console.error("[db] idle client terminated unexpectedly; pool will replace it.", error.message);
	});
	return pool;
}
var _pool;
var _db;
/** The connection pool. Lazily created so importing this module never opens a socket. */
function getPool() {
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
var db = new Proxy({}, { get(_target, prop, receiver) {
	if (!_db) _db = drizzle(getPool());
	return Reflect.get(_db, prop, receiver);
} });
//#endregion
export { db as t };
