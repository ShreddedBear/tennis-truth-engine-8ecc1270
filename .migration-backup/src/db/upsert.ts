// INSERT ... ON CONFLICT DO UPDATE, built from the rows being written.
//
// PostgREST's `.upsert(rows, { onConflict: "a,b" })` updated every column present in the
// payload. Drizzle's onConflictDoUpdate wants that SET clause spelled out. Writing it by
// hand at each call site is where an upsert silently stops maintaining a column, so it is
// derived from the payload here instead -- the same rule the old client applied.
import { sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getTableColumns } from "drizzle-orm";

/**
 * Builds the `set` for onConflictDoUpdate: every column appearing in `rows`, taken from
 * the proposed row, minus the conflict-target columns (updating a key to itself is
 * pointless and Postgres rejects it in some shapes).
 */
export function excludedSet<T extends PgTable>(
  table: T,
  rows: ReadonlyArray<Record<string, unknown>>,
  conflictColumns: readonly string[],
): Record<string, SQL> {
  const columns = getTableColumns(table);
  const targeted = new Set(conflictColumns);
  const touched = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) touched.add(key);

  const set: Record<string, SQL> = {};
  for (const key of touched) {
    if (targeted.has(key)) continue;
    const column = columns[key as keyof typeof columns];
    if (!column) throw new Error(`Column "${key}" is not defined on this table.`);
    set[key] = sql.raw(`excluded.${escapeIdentifier(column.name)}`);
  }
  if (Object.keys(set).length === 0) {
    throw new Error("An upsert whose payload is only its conflict key updates nothing; use insert ... on conflict do nothing.");
  }
  return set;
}

function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/gu, '""')}"`;
}
