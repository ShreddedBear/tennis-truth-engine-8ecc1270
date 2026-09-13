#!/usr/bin/env node
// Proves the RUNNING APPLICATION'S OWN CODE reads the migrated data, not just that a raw
// SQL connection can.
//
//   npm run verify:app-data
//
// This is deliberately NOT another `pg` connection like verify-cutover.ts. It imports the
// exact modules the UI's server functions call -- src/db/client.server.ts's `db`, and
// src/lib/screen-queries.server.ts's loaders -- so it exercises the real Drizzle query
// builder, the real custom column type parsers (timestamp/date/numeric), and the real
// application code path, against DATABASE_URL. A page returning HTTP 200 proves the SPA
// shell loads; it does not prove the server function behind it can talk to the database.
// This does.
//
// Read-only. Prints ordinary business data (match/tournament names, decision colours,
// counts) -- never a secret.
import { loadBoardScreen, loadDashboardScreen, loadSlateBase } from "../src/lib/screen-queries.server";
import { closePool } from "../src/db/client.server";

interface Check { name: string; ok: boolean; detail: string }
const checks: Check[] = [];
const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

async function main(): Promise<void> {
  if (!process.env["DATABASE_URL"]) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  console.log("APPLICATION DATA-LAYER VERIFICATION (real Drizzle queries, real DATABASE_URL)\n");

  try {
    // ---- the Board screen's own loader, exactly as /app/board's server function calls it
    const board = await loadBoardScreen();
    add("loadBoardScreen returns rows", board.matches.length > 0, `matches=${board.matches.length} decisions=${board.decisions.length} runs=${board.runs.length}`);
    const sample = board.matches[0];
    add("a real match row has real fields", Boolean(sample?.player1_name && sample?.player2_name),
      sample ? `sample: "${sample.player1_name}" vs "${sample.player2_name}" (${sample.tournament_name ?? "no tournament"})` : "no sample row");
    // The custom timestamp column type must return an ISO string, not a JS Date and not
    // raw Postgres text -- this is the exact bug the migration found and fixed.
    const createdAt = sample?.created_at;
    add("timestamp columns are ISO strings (not Date, not raw Postgres text)",
      typeof createdAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(createdAt),
      `created_at = ${JSON.stringify(createdAt)}`);

    // ---- the Dashboard screen's own loader
    const dashboard = await loadDashboardScreen();
    add("loadDashboardScreen returns rows", dashboard.matches.length > 0,
      `matches=${dashboard.matches.length} runs=${dashboard.runs.length} decisions=${dashboard.decisions.length} calibrationBuckets=${dashboard.buckets.length}`);
    add("active calibration version present", Boolean(dashboard.version),
      dashboard.version ? `version_number=${dashboard.version.version_number} label="${dashboard.version.label}"` : "none active");

    // ---- the Slate screen's own loader
    const slate = await loadSlateBase();
    add("loadSlateBase returns rows", slate.matches.length > 0, `matches=${slate.matches.length} runs=${slate.runs.length}`);
  } catch (error) {
    add("application data layer executes without error", false, error instanceof Error ? error.message : String(error));
  } finally {
    await closePool().catch(() => {});
  }

  const width = Math.max(...checks.map((c) => c.name.length));
  console.log("");
  for (const c of checks) console.log(`  ${c.ok ? "ok  " : "FAIL"} ${c.name.padEnd(width)}  ${c.detail}`);

  const failed = checks.filter((c) => !c.ok);
  console.log("");
  if (failed.length) {
    console.error(`FAILED -- ${failed.length} of ${checks.length} checks did not pass.`);
    process.exit(1);
  }
  console.log(`ALL ${checks.length} CHECKS PASSED. The application's own code reads real migrated data.`);
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  await closePool().catch(() => {});
  process.exit(1);
});
