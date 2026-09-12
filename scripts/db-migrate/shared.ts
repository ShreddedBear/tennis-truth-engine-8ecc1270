// Shared helpers for the database migration scripts.
//
// These move APPLICATION data between two PostgreSQL servers. They never touch Supabase's
// platform schemas (auth, storage, realtime, vault, ...) -- only the tables this
// application defines, taken from the Drizzle schema itself so the list cannot drift.
import pg from "pg";

import { TABLE_NAMES } from "../../src/db/table-registry";

export { TABLE_NAMES };

/** Opens a pool with the same type parsers the app uses, so exported values match the app's view. */
export function connect(url: string): pg.Pool {
  return new pg.Pool({ connectionString: url, max: 4 });
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

/**
 * Application tables in an order safe to INSERT in: every table comes after the tables it
 * references.
 *
 * Computed from the live foreign keys rather than hardcoded, so adding a table or a
 * relationship cannot leave a stale order behind. Self-references (source_definitions'
 * fallback_source_id) are ignored for ordering -- a table cannot come after itself -- and
 * are handled by deferring that column, see `SELF_REFERENCING_COLUMNS`.
 */
export async function insertionOrder(pool: pg.Pool): Promise<string[]> {
  const { rows } = await pool.query<{ child: string; parent: string }>(`
    select c.relname as child, p.relname as parent
      from pg_constraint co
      join pg_class c on c.oid = co.conrelid
      join pg_class p on p.oid = co.confrelid
      join pg_namespace n on n.oid = c.relnamespace
     where co.contype = 'f' and n.nspname = 'public'
  `);

  const managed = new Set(TABLE_NAMES);
  const parents = new Map<string, Set<string>>(TABLE_NAMES.map((t) => [t, new Set<string>()]));
  for (const { child, parent } of rows) {
    if (child === parent) continue;
    if (!managed.has(child) || !managed.has(parent)) continue;
    parents.get(child)!.add(parent);
  }

  const ordered: string[] = [];
  const placed = new Set<string>();
  // Deterministic: alphabetical among equally-ready tables, so two runs produce the same
  // order and a diff of two manifests is meaningful.
  while (ordered.length < TABLE_NAMES.length) {
    const ready = TABLE_NAMES
      .filter((t) => !placed.has(t) && [...parents.get(t)!].every((p) => placed.has(p)))
      .sort();
    if (!ready.length) {
      const remaining = TABLE_NAMES.filter((t) => !placed.has(t));
      throw new Error(`Foreign keys form a cycle among: ${remaining.join(", ")}`);
    }
    for (const table of ready) {
      ordered.push(table);
      placed.add(table);
    }
  }
  return ordered;
}

/**
 * Columns whose foreign key points at their own table. They are nulled on insert and filled
 * in by a second pass, because the row they reference may not exist yet.
 */
export const SELF_REFERENCING_COLUMNS: Record<string, string[]> = {
  source_definitions: ["fallback_source_id"],
};

export async function columnsOf(pool: pg.Pool, table: string): Promise<string[]> {
  return (await columnTypesOf(pool, table)).map((c) => c.name);
}

export interface ColumnType {
  name: string;
  /** The Postgres udt name: jsonb, _text, uuid, timestamptz, ... */
  udt: string;
}

export async function columnTypesOf(pool: pg.Pool, table: string): Promise<ColumnType[]> {
  const { rows } = await pool.query<{ column_name: string; udt_name: string }>(
    `select column_name, udt_name from information_schema.columns
      where table_schema = 'public' and table_name = $1 order by ordinal_position`,
    [table],
  );
  return rows.map((r) => ({ name: r.column_name, udt: r.udt_name }));
}

/**
 * Prepares one value for use as a query parameter.
 *
 * jsonb/json values must be sent as TEXT. node-postgres serialises a JavaScript array
 * parameter using Postgres ARRAY syntax -- so a jsonb column holding `[]` is written as
 * `{}` and a populated one is mangled outright. Postgres array columns (_text, _uuid) DO
 * want that treatment, so the two cases are distinguished by column type rather than by
 * the shape of the value.
 *
 * This is not hypothetical: it is what a round-trip through export/import produced before
 * the fix, and what the content checksums in verify.ts caught.
 */
export function toParameter(value: unknown, udt: string): unknown {
  if (value === null || value === undefined) return null;
  if (udt === "jsonb" || udt === "json") return JSON.stringify(value);
  return value;
}

export async function countOf(pool: pg.Pool, table: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(`select count(*)::text as n from public.${quote(table)}`);
  return Number(rows[0]?.n ?? 0);
}

/**
 * A content checksum for one table that does not depend on row order.
 *
 * md5 of each row rendered as JSON, sorted, then md5'd together. Comparing these proves the
 * two databases hold the same VALUES, which row counts alone cannot: counts match perfectly
 * while a column silently arrives null.
 */
export async function checksumOf(pool: pg.Pool, table: string): Promise<string> {
  const { rows } = await pool.query<{ checksum: string | null }>(`
    select md5(string_agg(row_md5, '' order by row_md5)) as checksum
      from (select md5(t::text) as row_md5 from public.${quote(table)} t) hashed
  `);
  return rows[0]?.checksum ?? "empty";
}

export function quote(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/u.test(identifier)) throw new Error(`Refusing to use "${identifier}" as an identifier.`);
  return `"${identifier}"`;
}

export interface TableManifest {
  table: string;
  rows: number;
  checksum: string;
  columns: string[];
}

export interface Manifest {
  capturedAt: string;
  source: string;
  tableCount: number;
  rowCount: number;
  order: string[];
  tables: TableManifest[];
}

/** Host and database only. Never the password. */
export function describeConnection(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    return "unparseable connection string";
  }
}
