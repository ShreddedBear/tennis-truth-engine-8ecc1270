import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

async function main() {
  console.log("=== PE genuine paper_trade population ===");
  const pe = await db.execute(sql`
    SELECT status, COUNT(*) as cnt FROM evaluation_predictions
    WHERE run_kind = 'paper_trade' GROUP BY status
  `);
  for (const r of pe.rows as any[]) console.log(`  status=${r.status} count=${r.cnt}`);

  console.log("\n=== Builder genuine production population (parlay_paper_trades, both sides) ===");
  const builder = await db.execute(sql`
    SELECT status, COUNT(*) as cnt FROM parlay_paper_trades GROUP BY status ORDER BY cnt DESC
  `);
  for (const r of builder.rows as any[]) console.log(`  status=${r.status} count=${r.cnt}`);

  console.log("\n=== Exact overlap: PE external_fixture_id vs Builder external_fixture_id ===");
  const overlap = await db.execute(sql`
    SELECT DISTINCT ep.external_fixture_id, ep.provider as pe_provider, ppt.fixture_provider as builder_provider,
           ep.player1_id as pe_p1, ep.player2_id as pe_p2, ppt.player1_id as builder_p1, ppt.player2_id as builder_p2,
           ep.scheduled_start_at as pe_start, ppt.scheduled_start_at as builder_start,
           ep.status as pe_status, ppt.status as builder_status, ppt.evaluated_side
    FROM evaluation_predictions ep
    INNER JOIN parlay_paper_trades ppt ON ep.external_fixture_id = ppt.external_fixture_id
    WHERE ep.run_kind = 'paper_trade'
    ORDER BY ep.external_fixture_id
  `);
  console.log(`Overlap row count (includes both Builder sides): ${overlap.rows.length}`);
  for (const r of overlap.rows as any[]) console.log(`  ${JSON.stringify(r)}`);

  console.log("\n=== PE-only fixture count ===");
  const peOnly = await db.execute(sql`
    SELECT COUNT(DISTINCT ep.external_fixture_id) as cnt FROM evaluation_predictions ep
    WHERE ep.run_kind = 'paper_trade'
    AND NOT EXISTS (SELECT 1 FROM parlay_paper_trades ppt WHERE ppt.external_fixture_id = ep.external_fixture_id)
  `);
  console.log(`PE-only: ${JSON.stringify(peOnly.rows[0])}`);

  console.log("\n=== Builder-only fixture count ===");
  const builderOnly = await db.execute(sql`
    SELECT COUNT(DISTINCT ppt.external_fixture_id) as cnt FROM parlay_paper_trades ppt
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_predictions ep WHERE ep.external_fixture_id = ppt.external_fixture_id AND ep.run_kind = 'paper_trade')
  `);
  console.log(`Builder-only: ${JSON.stringify(builderOnly.rows[0])}`);

  console.log("\nSERVER_NOW:", new Date().toISOString());
  process.exit(0);
}
main().catch((e) => { console.error(String(e).slice(0, 1500)); process.exit(1); });