// Name -> pgTable lookup, for the few call sites that address a table dynamically.
//
// The audit pipeline writes to one of six sibling result tables chosen at runtime
// (`ChildTable` in audit-pipeline.ts), and the old code passed that string straight to
// `supabase.from(name)`. Drizzle needs the table object, so this is the bridge. Keeping
// it in one place means a dynamic table name is still checked against the schema instead
// of being an unvalidated string.
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

import * as schema from "./schema";

const registry = new Map<string, PgTable>(
  // `schema` also exports zod schemas and the app_role pgEnum; is(PgTable) is the filter,
  // and the cast is only so the predicate has something wide enough to narrow from.
  Object.values(schema as Record<string, unknown>)
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => [getTableName(table), table]),
);

/** Every table name the schema defines. */
export const TABLE_NAMES: readonly string[] = [...registry.keys()].sort();

/** Throws rather than returning undefined: an unknown table name is a bug, not a miss. */
export function tableByName(name: string): PgTable {
  const table = registry.get(name);
  if (!table) throw new Error(`Unknown table "${name}". Known tables: ${TABLE_NAMES.join(", ")}`);
  return table;
}
