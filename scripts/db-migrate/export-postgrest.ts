#!/usr/bin/env node
// Exports the application's data from the Supabase-hosted source over its HTTP Data API.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:export:api -- ./migration-export
//
// WHY THIS EXISTS ALONGSIDE db:export.
//
// db:export needs a PostgreSQL connection string for the source. Migrating off Supabase
// does not require one -- the service-role key already grants full read access over
// PostgREST, and that is the credential the deployment actually holds. Requiring a database
// password just to read data you can already read is a needless extra secret to move
// around.
//
// The output is byte-compatible with db:export: the same JSONL files and the same manifest,
// so db:import and db:verify work against it unchanged. The manifest records
// transport: "postgrest", which tells db:verify to compare the JavaScript content checksum
// rather than Postgres' own row-text hash -- the latter cannot be computed without a
// connection.
//
// READ-ONLY. Only GETs are issued, so this is safe to run against a live production
// database.
//
// PLATFORM SCHEMAS ARE NEVER TOUCHED. The table list comes from the Drizzle schema, and
// PostgREST only exposes the exposed schema anyway.
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { TABLE_NAMES, contentChecksum, requireEnv, type Manifest, type TableManifest } from "./shared";

const PAGE = 1_000;

/**
 * Foreign-key-safe insertion order.
 *
 * db:export computes this from the live constraints. Over HTTP there is no catalog to
 * query, so it is derived from the Drizzle schema's own relationships, which are the same
 * relationships -- src/db/sql/02-constraints-indexes.sql creates exactly these.
 */
const PARENTS: Record<string, string[]> = {
  matches: ["players", "tournaments", "prediction_slates"],
  match_identity_records: ["matches"],
  summary_versions: ["matches", "summary_uploads"],
  summary_pages: ["summary_uploads"],
  parsed_summary_fields: ["summary_versions"],
  audit_runs: ["matches", "players", "probability_methods"],
  audit_stage_runs: ["audit_runs", "matches"],
  audit_coverage: ["audit_runs"],
  audit_color_ledger: ["matches", "result_grades"],
  execution_logs: ["audit_runs", "matches"],
  metric_results: ["audit_runs"],
  metric_coverage_rates: ["audit_runs", "metric_registry"],
  evidence_family_coverage: ["audit_runs"],
  verification_results: ["audit_runs", "rules"],
  disagreement_results: ["audit_runs", "rules"],
  underdog_results: ["audit_runs"],
  stress_results: ["audit_runs"],
  reconstruction_results: ["audit_runs", "formula_versions"],
  autopsies: ["matches", "result_grades"],
  autopsy_findings: ["autopsies"],
  block_reasons: ["audit_runs", "matches"],
  final_decisions: ["audit_runs", "players"],
  probability_provenance: ["audit_runs"],
  override_records: ["audit_runs", "matches"],
  result_grades: ["audit_runs", "matches"],
  calibration_buckets: ["calibration_versions"],
  calibration_ledger: ["matches"],
  truth_engine_calibration_observations: ["players"],
  source_observations: [],
  source_conflicts: ["audit_runs"],
  source_snapshots: ["audit_runs", "source_definitions"],
  source_health_events: ["source_definitions", "audit_runs"],
  rules: ["rule_document_versions"],
  rule_document_versions: ["rule_documents"],
};

function insertionOrder(): string[] {
  const ordered: string[] = [];
  const placed = new Set<string>();
  while (ordered.length < TABLE_NAMES.length) {
    const ready = TABLE_NAMES
      .filter((t) => !placed.has(t) && (PARENTS[t] ?? []).every((p) => placed.has(p) || !TABLE_NAMES.includes(p)))
      .sort();
    if (!ready.length) {
      throw new Error(`Cannot order: ${TABLE_NAMES.filter((t) => !placed.has(t)).join(", ")}`);
    }
    for (const table of ready) {
      ordered.push(table);
      placed.add(table);
    }
  }
  return ordered;
}

async function fetchPage(base: string, key: string, table: string, offset: number): Promise<Record<string, unknown>[]> {
  // Ordered by id so paging is stable: without an order, PostgREST's offset can repeat or
  // skip rows between pages.
  const url = `${base}/rest/v1/${table}?select=*&order=id.asc&limit=${PAGE}&offset=${offset}`;
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${table}: HTTP ${response.status} ${body.slice(0, 300)}`);
  }
  return (await response.json()) as Record<string, unknown>[];
}

async function main(): Promise<void> {
  const outDir = resolve(process.argv[2] ?? "./migration-export");
  const base = requireEnv("SUPABASE_URL").replace(/\/$/u, "");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  await mkdir(outDir, { recursive: true });
  const order = insertionOrder();
  console.log(`Exporting ${order.length} tables over the Data API -> ${outDir}`);

  const tables: TableManifest[] = [];
  let total = 0;

  for (const table of order) {
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = await fetchPage(base, key, table, offset);
      rows.push(...page);
      if (page.length < PAGE) break;
    }

    await writeFile(join(outDir, `${table}.jsonl`), rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""), "utf8");
    const columns = rows.length ? Object.keys(rows[0]!) : [];
    tables.push({ table, rows: rows.length, contentChecksum: contentChecksum(rows), columns });
    total += rows.length;
    console.log(`  ${table.padEnd(42)} ${String(rows.length).padStart(7)} rows  ${contentChecksum(rows).slice(0, 12)}`);
  }

  // A table with no rows yields no column list over HTTP. db:import needs one, so it is
  // borrowed from the target's own schema at import time -- recorded here so that is
  // explicit rather than a surprise.
  const emptyTables = tables.filter((t) => t.rows === 0).map((t) => t.table);

  const manifest: Manifest = {
    capturedAt: new Date().toISOString(),
    source: new URL(base).hostname,
    transport: "postgrest",
    tableCount: tables.length,
    rowCount: total,
    order,
    tables,
  };
  await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`\nExported ${total} rows across ${tables.length} tables.`);
  if (emptyTables.length) console.log(`Empty (no columns recorded): ${emptyTables.length} table(s).`);
  console.log(`Manifest: ${join(outDir, "manifest.json")}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
