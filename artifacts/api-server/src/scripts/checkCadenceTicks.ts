import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

async function main() {
  const runs = await db.execute(sql`
    SELECT id, started_at, finished_at, status
    FROM job_runs WHERE job_name = 'historical-backfill-cycle'
    ORDER BY started_at DESC LIMIT 5
  `);
  for (const r of runs.rows as any[]) console.log(`  id=${r.id} started=${r.started_at} finished=${r.finished_at} status=${r.status}`);
  console.log("SERVER_NOW:", new Date().toISOString());
  process.exit(0);
}
main().catch((e) => { console.error(String(e).slice(0, 500)); process.exit(1); });