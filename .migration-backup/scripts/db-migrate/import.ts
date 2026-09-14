#!/usr/bin/env node
// Loads an export into the TARGET database.
//
//   DATABASE_URL=postgresql://... npm run db:import -- ./migration-export
//
// Expects the schema to exist already: run `npm run db:push` first. This moves DATA, not
// structure -- src/db/schema and src/db/sql own the structure.
//
// SAFETY. It refuses to run against a target that already holds application rows unless
// ALLOW_NON_EMPTY_TARGET=true is set. Loading into a populated database is how two slates
// get merged into one, and no amount of row-count checking afterwards untangles that.
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join, resolve } from "node:path";

import {
  SELF_REFERENCING_COLUMNS, columnTypesOf, connect, countOf, describeConnection, quote,
  requireEnv, toParameter, type Manifest,
} from "./shared";

const BATCH = 500;

async function main(): Promise<void> {
  const inDir = resolve(process.argv[2] ?? "./migration-export");
  const url = requireEnv("DATABASE_URL");
  const manifest = JSON.parse(await readFile(join(inDir, "manifest.json"), "utf8")) as Manifest;
  const pool = connect(url);

  try {
    console.log(`Importing ${manifest.rowCount} rows across ${manifest.tableCount} tables into ${describeConnection(url)}`);

    const populated: string[] = [];
    for (const { table } of manifest.tables) {
      if ((await countOf(pool, table)) > 0) populated.push(table);
    }
    if (populated.length && process.env["ALLOW_NON_EMPTY_TARGET"] !== "true") {
      throw new Error(
        `The target already holds rows in: ${populated.join(", ")}.\n` +
        "Importing on top of existing data merges two datasets irreversibly. If that is genuinely " +
        "what you want, re-run with ALLOW_NON_EMPTY_TARGET=true.",
      );
    }

    const deferred: Array<{ table: string; column: string; id: string; value: string }> = [];
    let loaded = 0;

    for (const { table, rows: expected, columns } of manifest.tables) {
      const selfRefs = SELF_REFERENCING_COLUMNS[table] ?? [];
      const columnList = columns.map(quote).join(", ");
      const typeByColumn = new Map((await columnTypesOf(pool, table)).map((c) => [c.name, c.udt]));
      const missing = columns.filter((c) => !typeByColumn.has(c));
      if (missing.length) throw new Error(`${table}: target is missing column(s) ${missing.join(", ")}. Run npm run db:push first.`);
      let batch: unknown[][] = [];
      let written = 0;

      const flush = async () => {
        if (!batch.length) return;
        const values = batch
          .map((_, r) => `(${columns.map((_c, c) => `$${r * columns.length + c + 1}`).join(", ")})`)
          .join(", ");
        await pool.query(`insert into public.${quote(table)} (${columnList}) values ${values}`, batch.flat());
        written += batch.length;
        batch = [];
      };

      const reader = createInterface({ input: createReadStream(join(inDir, `${table}.jsonl`), "utf8"), crlfDelay: Infinity });
      for await (const line of reader) {
        if (!line.trim()) continue;
        const row = JSON.parse(line) as Record<string, unknown>;
        for (const column of selfRefs) {
          // Deferred: the row this points at may not be inserted yet. Recorded and applied
          // in the second pass below, so the reference is restored rather than lost.
          if (row[column] != null) {
            deferred.push({ table, column, id: String(row["id"]), value: String(row[column]) });
            row[column] = null;
          }
        }
        batch.push(columns.map((c) => toParameter(row[c], typeByColumn.get(c)!)));
        if (batch.length >= BATCH) await flush();
      }
      await flush();

      if (written !== expected) throw new Error(`${table}: manifest says ${expected} rows, loaded ${written}.`);
      loaded += written;
      console.log(`  ${table.padEnd(42)} ${String(written).padStart(7)} rows`);
    }

    for (const { table, column, id, value } of deferred) {
      await pool.query(
        `update public.${quote(table)} set ${quote(column)} = $1 where id = $2`,
        [value, id],
      );
    }
    if (deferred.length) console.log(`  restored ${deferred.length} deferred self-reference(s)`);

    console.log(`\nLoaded ${loaded} rows. Now run: npm run db:verify -- ${inDir}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
