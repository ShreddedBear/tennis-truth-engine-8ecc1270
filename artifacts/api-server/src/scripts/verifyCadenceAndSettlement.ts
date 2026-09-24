import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

async function main() {
  console.log("=== STEP 9: recent historical-backfill-cycle runs (confirm 30-min automatic cadence, no overlap) ===");
  const runs = await db.execute(sql`
    SELECT id, started_at, finished_at, status, summary, error_message
    FROM job_runs WHERE job_name = 'historical-backfill-cycle'
    ORDER BY started_at DESC LIMIT 6
  `);
  for (const r of runs.rows as any[]) console.log(`  id=${r.id} started=${r.started_at} finished=${r.finished_at} status=${r.status} summary=${JSON.stringify(r.summary)}`);

  console.log("\n=== STEP 10: most recent Builder + PE job_runs, to confirm they still run normally after the cadence change ===");
  const builderRuns = await db.execute(sql`
    SELECT id, started_at, finished_at, status FROM job_runs WHERE job_name = 'parlay-paper-trading-cycle' ORDER BY started_at DESC LIMIT 3
  `);
  console.log("Builder:");
  for (const r of builderRuns.rows as any[]) console.log(`  id=${r.id} started=${r.started_at} finished=${r.finished_at} status=${r.status}`);

  const peRuns = await db.execute(sql`
    SELECT id, started_at, finished_at, status FROM job_runs WHERE job_name = 'paper-trading-cycle' ORDER BY started_at DESC LIMIT 3
  `);
  console.log("PE:");
  for (const r of peRuns.rows as any[]) console.log(`  id=${r.id} started=${r.started_at} finished=${r.finished_at} status=${r.status}`);

  console.log("\nSERVER_NOW:", new Date().toISOString());
  process.exit(0);
}
main().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1); });