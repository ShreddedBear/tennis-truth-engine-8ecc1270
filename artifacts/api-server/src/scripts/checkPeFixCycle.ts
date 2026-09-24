import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

async function main() {
  const jobRuns = await db.execute(sql`
    SELECT id, started_at, finished_at, status, summary, error_message
    FROM job_runs WHERE job_name = 'paper-trading-cycle'
    ORDER BY started_at DESC LIMIT 5
  `);
  console.log("PE_JOB_RUNS:");
  for (const r of jobRuns.rows as any[]) {
    console.log(`  id=${r.id} started=${r.started_at} finished=${r.finished_at} status=${r.status} error_message=${r.error_message}`);
    console.log(`    summary=${JSON.stringify(r.summary)}`);
  }

  const newRows = await db.execute(sql`
    SELECT id, external_fixture_id, status, surface, match_format, calibrated_probability, calibration_version,
           predicted_winner_id, scheduled_start_at, locked_at, cutoff_at, tournament_name
    FROM evaluation_predictions
    WHERE run_kind = 'paper_trade' AND locked_at > NOW() - INTERVAL '30 minutes'
    ORDER BY locked_at DESC
  `);
  console.log("NEW_PAPER_TRADE_ROWS_LAST_30MIN:", newRows.rows.length);
  for (const r of newRows.rows as any[]) console.log(`  ${JSON.stringify(r)}`);

  const dupeCheck = await db.execute(sql`
    SELECT run_kind, provider, external_fixture_id, COUNT(*) as cnt
    FROM evaluation_predictions WHERE run_kind = 'paper_trade'
    GROUP BY run_kind, provider, external_fixture_id HAVING COUNT(*) > 1
  `);
  console.log("DUPLICATE_MATCH_IDENTITY_VIOLATIONS:", dupeCheck.rows.length);

  const builderCheck = await db.execute(sql`
    SELECT id, started_at, finished_at, status FROM job_runs
    WHERE job_name = 'parlay-paper-trading-cycle' ORDER BY started_at DESC LIMIT 3
  `);
  console.log("BUILDER_RECENT_RUNS:");
  for (const r of builderCheck.rows as any[]) console.log(`  id=${r.id} started=${r.started_at} finished=${r.finished_at} status=${r.status}`);

  const builderRowCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM parlay_paper_trades`);
  console.log("BUILDER_TOTAL_ROWS:", builderRowCount.rows[0]?.cnt);

  console.log("SERVER_NOW:", new Date().toISOString());
  process.exit(0);
}
main().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1); });