import { sql } from "drizzle-orm";
import { db, jobRunsTable } from "@workspace/db";

async function main() {
  const FIXTURE_IDS = ["35880", "35816", "36169", "36206"];
  for (const id of FIXTURE_IDS) {
    const rows = await db.execute(sql`
      SELECT external_fixture_id, evaluated_side, status, no_decision_reason
      FROM parlay_paper_trades WHERE external_fixture_id = ${id}
      ORDER BY created_at
    `);
    console.log(`FIXTURE ${id}: ${rows.rows.length} row(s)`);
    for (const r of rows.rows) console.log(`  ${JSON.stringify(r)}`);
  }

  const dupes = await db.execute(sql`
    SELECT external_fixture_id, evaluated_side, lineage_key, COUNT(*) as cnt
    FROM parlay_paper_trades
    GROUP BY external_fixture_id, evaluated_side, lineage_key
    HAVING COUNT(*) > 1
  `);
  console.log(`GLOBAL_DUPLICATE_VIOLATIONS: ${dupes.rows.length}`);
  for (const r of dupes.rows) console.log(`  ${JSON.stringify(r)}`);

  const totalBuilderRows = await db.execute(sql`SELECT COUNT(*) as cnt FROM parlay_paper_trades`);
  console.log(`TOTAL_BUILDER_ROWS: ${totalBuilderRows.rows[0]?.cnt}`);

  const peRuns = await db.execute(sql`SELECT COUNT(*) as cnt FROM predictions`);
  console.log(`PE_PREDICTIONS_ROW_COUNT: ${peRuns.rows[0]?.cnt}`);

  console.log(`SERVER_NOW: ${new Date().toISOString()}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });