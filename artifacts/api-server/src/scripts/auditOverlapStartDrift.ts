import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

async function main() {
  const summary = await db.execute(sql`
    WITH overlap AS (
      SELECT ABS(EXTRACT(EPOCH FROM (
        ep.scheduled_start_at::timestamp - ppt.scheduled_start_at::timestamp
      ))) / 60 AS drift_minutes
      FROM evaluation_predictions ep
      JOIN parlay_paper_trades ppt
        ON ep.external_fixture_id::text = ppt.external_fixture_id::text
      WHERE ep.run_kind = 'paper_trade'
    )
    SELECT COUNT(*) AS overlap_rows,
           MAX(drift_minutes) AS max_drift_minutes,
           AVG(drift_minutes) AS avg_drift_minutes,
           COUNT(*) FILTER (WHERE drift_minutes > 360) AS drift_over_360_minutes
    FROM overlap
  `);
  console.log("=== Matched-overlap start-time drift ===");
  console.log(JSON.stringify(summary.rows[0]));

  const largeDrifts = await db.execute(sql`
    WITH overlap AS (
      SELECT ep.external_fixture_id,
             ep.scheduled_start_at AS pe_start,
             ppt.scheduled_start_at AS builder_start,
             ep.player1_id AS pe_p1, ep.player2_id AS pe_p2,
             ppt.player1_id AS builder_p1, ppt.player2_id AS builder_p2,
             ppt.evaluated_side,
             ABS(EXTRACT(EPOCH FROM (
               ep.scheduled_start_at::timestamp - ppt.scheduled_start_at::timestamp
             ))) / 60 AS drift_minutes
      FROM evaluation_predictions ep
      JOIN parlay_paper_trades ppt
        ON ep.external_fixture_id::text = ppt.external_fixture_id::text
      WHERE ep.run_kind = 'paper_trade'
    )
    SELECT * FROM overlap
    WHERE drift_minutes > 360
    ORDER BY drift_minutes DESC, external_fixture_id::text, evaluated_side
  `);
  console.log("\n=== All overlap rows with drift > 360 minutes ===");
  for (const row of largeDrifts.rows) console.log(`  ${JSON.stringify(row)}`);
}

main().catch((error) => { console.error(String(error).slice(0, 1500)); process.exitCode = 1; });