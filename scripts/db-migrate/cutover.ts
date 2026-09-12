#!/usr/bin/env node
// The whole cutover, with the checks that make it safe to run unattended.
//
//   npm run db:cutover              # do it
//   npm run db:cutover -- --dry-run # preflight only: check, report, change nothing
//
// Sequence: preflight -> schema -> SQL extras -> export source -> import -> verify.
// It stops at the first failure and says which step failed, because a half-applied data
// migration is worse than one that did not start.
//
// WHAT IT WILL NOT DO
//   - touch the source database: the export issues GETs only;
//   - load into a target that already holds application rows;
//   - continue past a failed verification;
//   - print any secret.
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { connect, countOf, describeConnection, TABLE_NAMES } from "./shared";

const EXPORT_DIR = resolve(process.argv.includes("--dir")
  ? process.argv[process.argv.indexOf("--dir") + 1]!
  : "./migration-export");
const DRY_RUN = process.argv.includes("--dry-run");

function step(n: number, title: string): void {
  console.log(`\n${"=".repeat(72)}\n  STEP ${n}: ${title}\n${"=".repeat(72)}`);
}

function run(script: string, args: string[] = []): void {
  execFileSync("npm", ["run", script, ...(args.length ? ["--", ...args] : [])], {
    stdio: "inherit",
    env: process.env,
  });
}

async function preflight(): Promise<void> {
  step(1, "Preflight");

  const missing = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    .filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `Missing: ${missing.join(", ")}.\n` +
      "DATABASE_URL is the Replit PostgreSQL target. SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY read the source over its Data API -- no source database " +
      "password is needed.",
    );
  }
  console.log("  ok   all three variables are set (values not shown)");

  const target = process.env["DATABASE_URL"]!;
  console.log(`  ok   target: ${describeConnection(target)}`);

  // The target must not be the source. Migrating a database into itself would be a very
  // expensive no-op at best.
  const supabaseHost = new URL(process.env["SUPABASE_URL"]!).hostname.split(".")[0]!;
  if (target.includes(supabaseHost)) {
    throw new Error(
      "DATABASE_URL appears to point at the Supabase source project, not the Replit " +
      "target. Refusing to migrate a database into itself.",
    );
  }
  console.log("  ok   target is not the Supabase source");

  const pool = connect(target);
  try {
    const { rows } = await pool.query<{ v: string }>("select version() as v");
    console.log(`  ok   connected: ${rows[0]!.v.split(",")[0]}`);

    const { rows: existing } = await pool.query<{ n: string }>(
      `select count(*)::text as n from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    const tableCount = Number(existing[0]!.n);
    console.log(`  ok   target has ${tableCount} table(s) in public`);

    if (tableCount > 0) {
      let populated = 0;
      for (const table of TABLE_NAMES) {
        try {
          if ((await countOf(pool, table)) > 0) populated++;
        } catch {
          // Table not present yet; db:push will create it.
        }
      }
      if (populated > 0 && process.env["ALLOW_NON_EMPTY_TARGET"] !== "true") {
        throw new Error(
          `The target already holds rows in ${populated} application table(s).\n` +
          "Importing on top of existing data merges two datasets irreversibly. If that is " +
          "genuinely intended, re-run with ALLOW_NON_EMPTY_TARGET=true.",
        );
      }
      console.log(`  ok   no application table holds rows`);
    }
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  console.log(DRY_RUN ? "CUTOVER PREFLIGHT (dry run -- nothing will be changed)" : "CUTOVER");

  await preflight();
  if (DRY_RUN) {
    console.log("\nPreflight passed. Re-run without --dry-run to perform the cutover.");
    return;
  }

  step(2, "Create the schema on the target");
  run("db:push");

  step(3, "Export the source over its Data API (read-only)");
  if (existsSync(EXPORT_DIR)) rmSync(EXPORT_DIR, { recursive: true, force: true });
  run("db:export:api", [EXPORT_DIR]);

  step(4, "Load the target");
  run("db:import", [EXPORT_DIR]);

  step(5, "Verify source against target");
  run("db:verify", [EXPORT_DIR]);

  console.log(`
${"=".repeat(72)}
  CUTOVER COMPLETE — verification passed.

  The Supabase source is untouched and still holds everything; nothing was
  deleted. Keep ${EXPORT_DIR} until you are satisfied the new database is
  behaving, then retire the source.

  Next: restart the app so it picks up the target, then check the slate and
  board render, and run one pass of the audit driver:

      npm run worker:drive-audit:once
${"=".repeat(72)}`);
}

main().catch((error: unknown) => {
  console.error(`\nCUTOVER STOPPED: ${error instanceof Error ? error.message : String(error)}`);
  console.error("\nThe source database has not been modified.");
  process.exit(1);
});
