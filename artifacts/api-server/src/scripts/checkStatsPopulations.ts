import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

async function main() {
  console.log("=== STEP 1: evaluation_predictions populations by run_kind + status ===");
  const populations = await db.execute(sql`
    SELECT run_kind, status, COUNT(*) as cnt, MAX(locked_at) as latest_locked
    FROM evaluation_predictions
    GROUP BY run_kind, status
    ORDER BY run_kind, status
  `);
  for (const r of populations.rows as any[]) console.log(`  run_kind=${r.run_kind} status=${r.status} count=${r.cnt} latest_locked=${r.latest_locked}`);

  console.log("\n=== STEP 6a: evaluation_predictions -- does this table have a top-level data_quality column? ===");
  const columns = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'evaluation_predictions' AND column_name ILIKE '%data_quality%'
  `);
  console.log(`Matching columns: ${JSON.stringify(columns.rows)}`);

  console.log("\n=== STEP 6b: JSONB-derived dataQuality for the 4 real new paper_trade rows from the PE fix ===");
  const newRows = await db.execute(sql`
    SELECT id, external_fixture_id, status,
           (feature_snapshot->>'dataQuality')::real as json_data_quality
    FROM evaluation_predictions
    WHERE run_kind = 'paper_trade' AND id IN (518844, 518849, 518850, 518851)
  `);
  for (const r of newRows.rows as any[]) console.log(`  ${JSON.stringify(r)}`);

  console.log("\n=== STEP 6c: predictions table (the OTHER, user-facing table) -- top-level data_quality vs engine JSON ===");
  const predColumns = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name ILIKE '%data_quality%'
  `);
  console.log(`predictions table matching columns: ${JSON.stringify(predColumns.rows)}`);
  const predSample = await db.execute(sql`
    SELECT id, data_quality as top_level_data_quality, (engine->>'dataQuality')::real as json_data_quality
    FROM predictions ORDER BY id DESC LIMIT 5
  `);
  console.log("Latest 5 predictions rows (top-level vs JSON dataQuality):");
  for (const r of predSample.rows as any[]) console.log(`  ${JSON.stringify(r)}`);
  const mismatchCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM predictions
    WHERE data_quality = 0 AND (engine->>'dataQuality')::real > 0
  `);
  console.log(`predictions rows where top-level data_quality=0 but engine JSON shows a real value: ${mismatchCount.rows[0]?.cnt}`);

  console.log("\nSERVER_NOW:", new Date().toISOString());
  process.exit(0);
}
main().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1); });