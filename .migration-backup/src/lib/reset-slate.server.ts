// The Clear Slate database call. SERVER ONLY.
//
// clear_operational_slate is unchanged plpgsql (src/db/sql/01-functions.sql) and remains
// the single authoritative deletion path: it takes the advisory lock, deletes, and
// re-queries the exact rows it deleted inside the same transaction to produce the AFTER
// snapshot the wrapper refuses to ignore. Only the transport changed, from POST /rpc/ to
// SELECT.
import { sql } from "drizzle-orm";

import { db } from "@/db/client.server";

export async function clearSlateViaDatabase(userId: string): Promise<unknown> {
  const result = await db.execute(
    sql`select public.clear_operational_slate(${userId}::uuid) as result`,
  );
  return (result.rows[0] as { result?: unknown } | undefined)?.result ?? null;
}
