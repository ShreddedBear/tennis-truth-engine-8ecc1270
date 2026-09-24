import { sql, desc, eq } from "drizzle-orm";
import { db, jobRunsTable } from "@workspace/db";

async function main() {
  const runs = await db.execute(sql`
    SELECT id, started_at, finished_at, summary
    FROM job_runs
    WHERE job_name = 'parlay-paper-trading-cycle'
    ORDER BY started_at DESC
    LIMIT 5
  `);
  console.log(`TOTAL_RUNS: ${runs.rows.length}`);
  for (const r of runs.rows as any[]) {
    const s = r.summary;
    console.log(`id=${r.id} started=${r.started_at} finished=${r.finished_at} considered=${s?.discovery?.result?.fixturesConsidered} frozen=${s?.discovery?.result?.frozen} noDecision=${s?.discovery?.result?.noDecision} dataError=${s?.discovery?.result?.dataError} ineligible=${JSON.stringify(s?.discovery?.result?.ineligible)} errors=${JSON.stringify(s?.discovery?.result?.errors)}`);
  }

  const tableList = await db.execute(sql`
    SELECT table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::int AS row_count
    FROM (
      SELECT table_name,
        query_to_xml(format('SELECT COUNT(*) as cnt FROM %I.%I', table_schema, table_name), false, true, '') AS xml_count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('predictions', 'evaluation_predictions')
    ) t
  `);
  console.log('PE_TABLE_ROW_COUNTS:');
  for (const r of tableList.rows as any[]) console.log(`  ${r.table_name}: ${r.row_count}`);

  console.log(`SERVER_NOW: ${new Date().toISOString()}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });