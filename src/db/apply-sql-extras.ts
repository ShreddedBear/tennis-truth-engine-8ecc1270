/**
 * Applies the raw SQL that drizzle-kit's schema diff cannot express: functions, triggers,
 * partial/expression indexes and CHECK constraints.
 *
 * Every file under ./sql is idempotent by construction, so this is safe to re-run on every
 * push. Files are applied in filename order, and that order matters:
 *
 *   01-functions.sql            functions (triggers in 03 reference them)
 *   02-constraints-indexes.sql  constraints + indexes (upsert_metric_evidence_side's
 *                               ON CONFLICT target lives here)
 *   03-triggers.sql             triggers
 *   04-portable-defaults.sql    replaces Supabase's auth.uid() column defaults
 *
 * Run it with:  npm run db:push       (drizzle-kit push, then this)
 *           or: npm run db:sql-extras (this alone)
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

async function main(): Promise<void> {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
  }

  const sqlDir = join(dirname(fileURLToPath(import.meta.url)), "sql");
  const files = readdirSync(sqlDir).filter((f) => f.endsWith(".sql")).sort();
  if (files.length === 0) throw new Error(`No .sql files found in ${sqlDir}`);

  const pool = new pg.Pool({ connectionString: url });
  try {
    for (const file of files) {
      process.stdout.write(`Applying ${file} ... `);
      await pool.query(readFileSync(join(sqlDir, file), "utf8"));
      process.stdout.write("ok\n");
    }
    console.log(`SQL extras applied (${files.length} files).`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
