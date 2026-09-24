import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

async function main() {
  console.log("=== STEP 3: grading lag for recently GRADED evaluation_predictions (paper_trade) rows ===");
  const graded = await db.execute(sql`
    SELECT ep.id, ep.scheduled_start_at, ep.graded_at, ep.status,
           hm.scheduled_start_at as hm_scheduled_start_at, hm.imported_at as hm_imported_at,
           EXTRACT(EPOCH FROM (ep.graded_at - ep.scheduled_start_at))/3600 as match_to_graded_hours
    FROM evaluation_predictions ep
    LEFT JOIN historical_matches hm ON hm.player1_id = ep.player1_id AND hm.player2_id = ep.player2_id
      AND hm.scheduled_start_at BETWEEN ep.scheduled_start_at - INTERVAL '6 hours' AND ep.scheduled_start_at + INTERVAL '6 hours'
    WHERE ep.run_kind = 'paper_trade' AND ep.status = 'graded'
    ORDER BY ep.graded_at DESC LIMIT 8
  `);
  for (const r of graded.rows as any[]) console.log(`  ${JSON.stringify(r)}`);

  console.log("\n=== Builder (parlay_paper_trades): recently graded/settled rows, similar lag check ===");
  const builderGraded = await db.execute(sql`
    SELECT id, scheduled_start_at, graded_at, status, outcome_attached_at,
           EXTRACT(EPOCH FROM (graded_at - scheduled_start_at))/3600 as match_to_graded_hours
    FROM parlay_paper_trades
    WHERE status = 'GRADED' AND graded_at IS NOT NULL
    ORDER BY graded_at DESC LIMIT 8
  `);
  for (const r of builderGraded.rows as any[]) console.log(`  ${JSON.stringify(r)}`);

  console.log("\n=== index.ts in-process trigger: confirm overlap guard + current interval constant ===");
  console.log("(printed for reference, not queried -- will confirm via code read)");

  console.log("\nSERVER_NOW:", new Date().toISOString());
  process.exit(0);
}
main().catch((e) => { console.error(String(e).slice(0, 1000)); process.exit(1); });