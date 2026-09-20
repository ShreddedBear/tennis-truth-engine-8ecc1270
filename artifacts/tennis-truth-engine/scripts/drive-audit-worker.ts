#!/usr/bin/env node
// Replit-owned audit driver.
//
// Production scheduling used to be .github/workflows/drive-audit.yml on a */5 cron. This
// replaces it, so normal operation needs no GitHub Actions: run this as a Replit Scheduled
// Deployment (one pass, RUN_ONCE=true) or as a Reserved VM / background worker (a loop).
//
// Why it exists at all: every other path that drives the pipeline is triggered from a
// browser tab -- Upload's commit flow, Active Slate's poll loop -- so the moment that tab
// closes or backgrounds, every RUNNING audit freezes where it was. This keeps them moving.
//
// CONCURRENCY IS UNCHANGED, DELIBERATELY. It claims work through the same
// claim_audit_run / renew_audit_run_lease / release_audit_run_lease leases the browser and
// API paths use, so running this alongside them -- or running two of these -- cannot
// double-process a run; the second claimant simply finds nothing to claim. Nothing here
// widens the batch or the concurrency to go faster.
import { eq } from "drizzle-orm";

import { db, closePool } from "../src/db/client.server";
import { auditRunsTable } from "../src/db/schema";
import { driveAuditBatch } from "../src/lib/audit-pipeline.functions";

const INTERVAL_MS = Math.max(60_000, Number(process.env["AUDIT_DRIVER_INTERVAL_MS"] ?? 300_000));
const RUN_ONCE = process.env["RUN_ONCE"] === "true";
const MAX_RUNS_PER_PASS = 100;

let stopping = false;

async function drivePass(): Promise<void> {
  const startedAt = Date.now();
  const runs = await db.select({ match_id: auditRunsTable.match_id }).from(auditRunsTable)
    .where(eq(auditRunsTable.status, "RUNNING")).limit(MAX_RUNS_PER_PASS);

  const matchIds = [...new Set(runs.map((row) => row.match_id))];
  if (!matchIds.length) {
    console.log(`[audit-driver] no RUNNING audits (${Date.now() - startedAt}ms)`);
    return;
  }

  console.log(`[audit-driver] driving ${matchIds.length} RUNNING audit(s)`);
  const result = await driveAuditBatch({ matchIds });
  console.log(`[audit-driver] total=${result.total} complete=${result.complete} active=${result.active} blocked=${result.blocked} durationMs=${Date.now() - startedAt}`);
}

async function main(): Promise<void> {
  if (!process.env["DATABASE_URL"]) {
    console.error("[audit-driver] DATABASE_URL is not set.");
    process.exitCode = 1;
    return;
  }

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      console.log(`[audit-driver] ${signal} received; finishing the current pass and stopping.`);
      stopping = true;
    });
  }

  do {
    try {
      await drivePass();
    } catch (error) {
      // A failed pass must never kill the loop: the next one re-reads state from the
      // database, and any lease this process held expires on its own.
      console.error(`[audit-driver] pass failed: ${error instanceof Error ? error.message : String(error)}`);
      if (RUN_ONCE) process.exitCode = 1;
    }
    if (RUN_ONCE || stopping) break;
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  } while (!stopping);

  await closePool();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await closePool().catch(() => {});
  process.exit(1);
});
