// Ad-hoc inspection scratch script. Prints the latest run for one match, its stage rows,
// and a metric-status histogram.
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client.server";
import { auditRunsTable, auditStageRunsTable, metricResultsTable } from "@/db/schema";

const matchId = process.argv[2] ?? "3a7d6305-ef2b-4e47-8f91-d9825413382a";

const [run] = await db.select({ id: auditRunsTable.id, run_number: auditRunsTable.run_number, status: auditRunsTable.status })
  .from(auditRunsTable).where(eq(auditRunsTable.match_id, matchId))
  .orderBy(desc(auditRunsTable.run_number)).limit(1);
console.log(run);
if (run) {
  const stages = await db.select({
    stage: auditStageRunsTable.stage, status: auditStageRunsTable.status,
    done_count: auditStageRunsTable.done_count, total_count: auditStageRunsTable.total_count,
    error_message: auditStageRunsTable.error_message,
  }).from(auditStageRunsTable).where(eq(auditStageRunsTable.audit_run_id, run.id));
  for (const x of stages) console.log(x.stage, x.status, `${x.done_count}/${x.total_count}`, x.error_message ?? "");

  const metrics = await db.select({
    status: metricResultsTable.status,
    p1_treatment: metricResultsTable.p1_treatment,
    p2_treatment: metricResultsTable.p2_treatment,
  }).from(metricResultsTable).where(eq(metricResultsTable.audit_run_id, run.id));
  const counts: Record<string, number> = {};
  for (const x of metrics) counts[x.status] = (counts[x.status] ?? 0) + 1;
  console.log("metric rows", metrics.length, counts);
}
