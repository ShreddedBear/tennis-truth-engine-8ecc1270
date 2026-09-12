#!/usr/bin/env bun
// Unattended audit driver, run on a schedule from
// .github/workflows/drive-audit.yml -- a separate, independent trigger path
// from /api/drive-audit-batch (that one is armed via AUDIT_CRON_SECRET +
// an external HTTP scheduler; this one runs the same pipeline code directly
// in a scheduler process, connecting to the database with DATABASE_URL
// instead of presenting a bearer secret).
//
// Deliberately imports driveAuditBatch -- the exact fair, heartbeat-ordered
// scheduling logic already used by the browser path and by
// /api/drive-audit-batch -- rather than reimplementing any of it here. This
// script's only job is discovering which matches are RUNNING and reporting
// the outcome in a form a scheduler renders clearly.
import { eq } from "drizzle-orm";

import { driveAuditBatch } from "../src/lib/audit-pipeline.functions";
import { db } from "../src/db/client.server";
import { auditRunsTable } from "../src/db/schema";

async function main() {
  const startedAt = Date.now();

  let runs: Array<{ match_id: string }>;
  try {
    runs = await db.select({ match_id: auditRunsTable.match_id }).from(auditRunsTable)
      .where(eq(auditRunsTable.status, "RUNNING")).limit(100);
  } catch (error) {
    console.error(`::error::audit_runs lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  const matchIds: string[] = [...new Set<string>(runs.map((row) => row.match_id))];
  if (!matchIds.length) {
    console.log("::notice::No RUNNING audits to drive. Nothing to do this run.");
    return;
  }

  console.log(`Driving ${matchIds.length} RUNNING audit(s)...`);
  const result = await driveAuditBatch({ matchIds });
  console.log(JSON.stringify(result, null, 2));

  const durationMs = Date.now() - startedAt;
  const summary = `total=${result.total} complete=${result.complete} active=${result.active} blocked=${result.blocked} durationMs=${durationMs}`;

  if (!result.ok) {
    console.error(`::error::${result.blocked} audit(s) blocked this run (${summary})`);
    process.exitCode = 1;
    return;
  }

  console.log(`::notice::Drove ${result.total} audit(s) with no blocked runs (${summary})`);
}

main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`::error::drive-audit-batch script crashed: ${message}`);
  process.exitCode = 1;
});
