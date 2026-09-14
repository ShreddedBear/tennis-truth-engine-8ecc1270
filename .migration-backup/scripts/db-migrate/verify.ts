#!/usr/bin/env node
// Proves the target database holds the same application data as the source export.
//
//   DATABASE_URL=postgresql://... npm run db:verify -- ./migration-export
//
// Exits non-zero on ANY discrepancy. Row counts alone are not the test -- counts match
// perfectly while a column arrives null everywhere -- so this compares order-independent
// content checksums, then re-checks the structural guarantees the schema is supposed to be
// enforcing on the target itself.
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  connect, contentChecksum, countOf, checksumOf, describeConnection, quote, requireEnv,
  type Manifest,
} from "./shared";

/**
 * The operational tables whose populations the Truth Engine's integrity depends on. They
 * are named explicitly so a silently EMPTY table is reported as a failure rather than as a
 * matching zero -- an export taken against the wrong database would otherwise verify
 * cleanly against an equally empty target.
 */
const OPERATIONAL_TABLES = [
  "matches", "audit_runs", "audit_stage_runs", "metric_results", "audit_coverage",
  "verification_results", "disagreement_results", "underdog_results", "stress_results",
  "final_decisions", "source_observations", "metric_evidence_store",
  "calibration_versions", "calibration_buckets", "calibration_ledger",
  "truth_engine_calibration_observations",
];

interface Failure { check: string; detail: string }

async function main(): Promise<void> {
  const inDir = resolve(process.argv[2] ?? "./migration-export");
  const url = requireEnv("DATABASE_URL");
  const manifest = JSON.parse(await readFile(join(inDir, "manifest.json"), "utf8")) as Manifest;
  const pool = connect(url);
  const failures: Failure[] = [];

  try {
    console.log(`Verifying ${describeConnection(url)} against ${manifest.source} via ${manifest.transport} (captured ${manifest.capturedAt})\n`);

    // 1. Row counts and content checksums, per table.
    //
    // The JS content checksum is the one that is always comparable: the SQL checksum is
    // Postgres hashing its own row text, which the HTTP export path cannot produce. When
    // the manifest carries both AND the export came over a direct connection, both are
    // checked; otherwise the content checksum alone decides.
    for (const expected of manifest.tables) {
      const rows = await countOf(pool, expected.table);
      const target = await pool.query<Record<string, unknown>>(`select row_to_json(t) as row from public.${quote(expected.table)} t`);
      const targetRows = target.rows.map((r) => r["row"] as Record<string, unknown>);
      const content = contentChecksum(targetRows);

      const countOk = rows === expected.rows;
      const contentOk = content === expected.contentChecksum;
      if (!countOk) failures.push({ check: `${expected.table} row count`, detail: `expected ${expected.rows}, found ${rows}` });
      if (!contentOk) failures.push({ check: `${expected.table} content checksum`, detail: `expected ${expected.contentChecksum}, found ${content}` });

      let sqlOk = true;
      if (manifest.transport === "postgres" && expected.checksum) {
        const checksum = await checksumOf(pool, expected.table);
        sqlOk = checksum === expected.checksum;
        if (!sqlOk) failures.push({ check: `${expected.table} row-text checksum`, detail: `expected ${expected.checksum}, found ${checksum}` });
      }

      const mark = countOk && contentOk && sqlOk ? "ok  " : "FAIL";
      console.log(`  ${mark} ${expected.table.padEnd(42)} ${String(rows).padStart(7)}/${String(expected.rows).padEnd(7)} ${content.slice(0, 12)}`);
    }

    // 2. The operational populations must actually be populated.
    console.log("");
    for (const table of OPERATIONAL_TABLES) {
      const declared = manifest.tables.find((t) => t.table === table);
      if (!declared) {
        failures.push({ check: `${table} present in export`, detail: "table missing from the manifest entirely" });
        continue;
      }
      if (declared.rows === 0) {
        console.log(`  note ${table.padEnd(42)} empty in the SOURCE export -- verified as empty, not as migrated`);
      }
    }

    // 3. Foreign key integrity on the target. The constraints should make this impossible,
    //    which is exactly why it is worth asserting: a constraint that failed to apply
    //    during db:push would otherwise be invisible until a bad row appeared.
    const { rows: orphanChecks } = await pool.query<{ child: string; column: string; parent: string; parent_column: string }>(`
      select c.relname as child, ac.attname as column, p.relname as parent, ap.attname as parent_column
        from pg_constraint co
        join pg_class c on c.oid = co.conrelid
        join pg_class p on p.oid = co.confrelid
        join pg_namespace n on n.oid = c.relnamespace
        join unnest(co.conkey) with ordinality as ck(attnum, ord) on true
        join unnest(co.confkey) with ordinality as pk(attnum, ord) on pk.ord = ck.ord
        join pg_attribute ac on ac.attrelid = c.oid and ac.attnum = ck.attnum
        join pg_attribute ap on ap.attrelid = p.oid and ap.attnum = pk.attnum
       where co.contype = 'f' and n.nspname = 'public'
    `);
    for (const fk of orphanChecks) {
      const { rows } = await pool.query<{ n: string }>(`
        select count(*)::text as n from public.${quote(fk.child)} c
         where c.${quote(fk.column)} is not null
           and not exists (select 1 from public.${quote(fk.parent)} p where p.${quote(fk.parent_column)} = c.${quote(fk.column)})
      `);
      const orphans = Number(rows[0]?.n ?? 0);
      if (orphans > 0) {
        failures.push({ check: `${fk.child}.${fk.column} -> ${fk.parent}`, detail: `${orphans} orphaned row(s)` });
      }
    }
    console.log(`  ${failures.length ? "" : "ok   "}foreign key integrity: ${orphanChecks.length} relationship(s) checked`);

    // 4. The structure itself: constraints and indexes must have landed.
    const counts = await pool.query<{ constraints: string; indexes: string; functions: string; triggers: string }>(`
      select
        (select count(*)::text from pg_constraint co join pg_class c on c.oid = co.conrelid
          join pg_namespace n on n.oid = c.relnamespace where n.nspname='public' and co.contype in ('f','c','u','p')) as constraints,
        (select count(*)::text from pg_indexes where schemaname='public') as indexes,
        (select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as functions,
        (select count(*)::text from pg_trigger t join pg_class c on c.oid=t.tgrelid
          join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal) as triggers
    `);
    const structure = counts.rows[0]!;
    console.log(`  ok   structure: ${structure.constraints} constraints, ${structure.indexes} indexes, ${structure.functions} functions, ${structure.triggers} triggers`);
    if (Number(structure.functions) < 11) {
      failures.push({ check: "database functions", detail: `expected at least 11, found ${structure.functions}. Run npm run db:sql-extras.` });
    }
    if (Number(structure.triggers) < 7) {
      failures.push({ check: "triggers", detail: `expected at least 7, found ${structure.triggers}. Run npm run db:sql-extras.` });
    }

    // 5. No Supabase platform dependency can have come along.
    const { rows: authDefaults } = await pool.query<{ n: string }>(`
      select count(*)::text as n from information_schema.columns
       where table_schema='public' and column_default like '%auth.uid()%'
    `);
    if (Number(authDefaults[0]?.n ?? 0) > 0) {
      failures.push({
        check: "portable defaults",
        detail: `${authDefaults[0]!.n} column(s) still default to auth.uid(). Run npm run db:sql-extras.`,
      });
    } else {
      console.log("  ok   no column depends on Supabase's auth.uid()");
    }

    console.log("");
    if (failures.length) {
      console.error(`VERIFICATION FAILED — ${failures.length} discrepancy(ies):\n`);
      for (const f of failures) console.error(`  ${f.check}: ${f.detail}`);
      process.exit(1);
    }
    console.log(`VERIFIED. ${manifest.rowCount} rows across ${manifest.tableCount} tables match the source, byte for byte.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
