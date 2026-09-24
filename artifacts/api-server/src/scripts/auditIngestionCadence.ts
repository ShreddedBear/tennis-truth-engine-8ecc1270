import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

async function main() {
  console.log("=== STEP 2: last 10 historical-backfill-cycle job_runs ===");
  const runs = await db.execute(sql`
    SELECT id, started_at, finished_at, status, summary, error_message,
           EXTRACT(EPOCH FROM (finished_at - started_at)) as duration_seconds
    FROM job_runs WHERE job_name = 'historical-backfill-cycle'
    ORDER BY started_at DESC LIMIT 10
  `);
  for (const r of runs.rows as any[]) {
    console.log(`  id=${r.id} started=${r.started_at} finished=${r.finished_at} duration_s=${r.duration_seconds} status=${r.status}`);
    console.log(`    summary=${JSON.stringify(r.summary)}`);
  }

  console.log("\n=== historical_matches: most recent rows by scheduled_start_at ===");
  const recent = await db.execute(sql`
    SELECT id, external_id, provider, scheduled_start_at, created_at, winner_id IS NOT NULL as has_winner
    FROM historical_matches ORDER BY scheduled_start_at DESC LIMIT 10
  `);
  for (const r of recent.rows as any[]) console.log(`  ${JSON.stringify(r)}`);

  console.log("\n=== Ingestion lag: scheduled_start_at vs created_at (row-write time) for the 20 most recently WRITTEN rows ===");
  const lag = await db.execute(sql`
    SELECT id, external_id, scheduled_start_at, created_at,
           EXTRACT(EPOCH FROM (created_at - scheduled_start_at))/3600 as lag_hours
    FROM historical_matches ORDER BY created_at DESC LIMIT 20
  `);
  for (const r of lag.rows as any[]) console.log(`  id=${r.id} ext=${r.external_id} scheduled=${r.scheduled_start_at} created=${r.created_at} lag_hours=${r.lag_hours}`);

  console.log("\n=== Current historical_matches coverage ===");
  const coverage = await db.execute(sql`SELECT MAX(scheduled_start_at) as latest, COUNT(*) as total FROM historical_matches`);
  console.log(`  ${JSON.stringify(coverage.rows[0])}`);

  console.log("\nSERVER_NOW:", new Date().toISOString());
  process.exit(0);
}
main().catch((e) => { console.error(String(e).slice(0, 1000)); process.exit(1); });