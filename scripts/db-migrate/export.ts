#!/usr/bin/env node
// Exports the application's data from the SOURCE database.
//
//   SOURCE_DATABASE_URL=postgresql://... npm run db:export -- ./migration-export
//
// Writes one JSONL file per table plus manifest.json (row counts, order-independent
// content checksums, and the column list per table). Read-only: it never writes to the
// source, so it is safe to run against production while the app is live.
//
// PLATFORM SCHEMAS ARE NEVER TOUCHED. The table list comes from the Drizzle schema, so
// Supabase's auth/storage/realtime schemas are not read and cannot be migrated.
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import QueryStream from "pg-query-stream";

import {
  TABLE_NAMES, checksumOf, columnsOf, connect, countOf, describeConnection,
  insertionOrder, quote, requireEnv, type Manifest, type TableManifest,
} from "./shared";

const BATCH = 2_000;

async function main(): Promise<void> {
  const outDir = resolve(process.argv[2] ?? "./migration-export");
  const url = requireEnv("SOURCE_DATABASE_URL");
  const pool = connect(url);

  try {
    await mkdir(outDir, { recursive: true });
    const order = await insertionOrder(pool);
    console.log(`Exporting ${order.length} tables from ${describeConnection(url)} -> ${outDir}`);

    const tables: TableManifest[] = [];
    let total = 0;

    for (const table of order) {
      const columns = await columnsOf(pool, table);
      const rows = await countOf(pool, table);
      const checksum = await checksumOf(pool, table);

      // Streamed, and ordered by primary key so a re-export is byte-identical and two
      // exports can be diffed directly.
      const client = await pool.connect();
      const file = createWriteStream(join(outDir, `${table}.jsonl`), { encoding: "utf8" });
      let written = 0;
      try {
        const stream = client.query(new QueryStream(
          `select row_to_json(t) as row from public.${quote(table)} t order by t.id`,
          [],
          { batchSize: BATCH },
        ));
        for await (const record of stream as AsyncIterable<{ row: unknown }>) {
          if (!file.write(`${JSON.stringify(record.row)}\n`)) {
            await new Promise((r) => file.once("drain", r));
          }
          written++;
        }
      } finally {
        await new Promise<void>((r) => file.end(r));
        client.release();
      }

      if (written !== rows) {
        throw new Error(`${table}: counted ${rows} rows but exported ${written}. The source changed mid-export; re-run it.`);
      }
      tables.push({ table, rows, checksum, columns });
      total += rows;
      console.log(`  ${table.padEnd(42)} ${String(rows).padStart(7)} rows  ${checksum.slice(0, 12)}`);
    }

    const manifest: Manifest = {
      capturedAt: new Date().toISOString(),
      source: describeConnection(url),
      tableCount: tables.length,
      rowCount: total,
      order,
      tables,
    };
    await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    console.log(`\nExported ${total} rows across ${tables.length} tables.`);
    console.log(`Manifest: ${join(outDir, "manifest.json")}`);
    const missing = TABLE_NAMES.filter((t) => !order.includes(t));
    if (missing.length) console.warn(`WARNING: not exported: ${missing.join(", ")}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
