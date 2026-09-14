import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "./schema";
import inventory from "./__fixtures__/live-schema-inventory.json";

// The Drizzle schema is not a fresh design -- it describes a database that already holds
// 60 matches, 1,980 metric_results and 6,945 evidence rows. If it drifts from that database
// by one column, one nullability flag or one type, queries compile and then fail (or worse,
// silently coerce) at runtime against production.
//
// live-schema-inventory.json is the information_schema of the live database, captured at
// migration time. These tests hold the TypeScript schema to it.

const repoRoot = resolve(process.cwd());

/** Every pgTable exported from ./schema, keyed by its real Postgres table name. */
const tables = new Map<string, PgTable>(
  // `schema` also exports zod schemas and the app_role pgEnum; is(PgTable) is the filter,
  // and the cast is only so the predicate has something wide enough to narrow from.
  Object.values(schema as Record<string, unknown>)
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => [getTableName(table), table]),
);

/**
 * Drizzle's column classes, mapped to the Postgres type name information_schema reports.
 * An unmapped columnType is a hard failure, not a skip: a silent skip is how a wrong type
 * slips through.
 */
const COLUMN_TYPE_TO_UDT: Record<string, string> = {
  PgUUID: "uuid",
  PgText: "text",
  PgBoolean: "bool",
  PgInteger: "int4",
  PgDoublePrecision: "float8",
  // Number mode, deliberately -- PostgREST serialised numeric to a JSON number, and all 28
  // numeric columns here are bounded rates. PgNumeric (Drizzle's string-mode class) must NOT
  // appear in this map: a column regressing to string mode then fails loudly here rather
  // than silently changing comparisons against the Truth Engine's thresholds.
  PgNumericNumber: "numeric",
  PgJsonb: "jsonb",
  // Dates and timestamps are CUSTOM columns (src/db/columns.ts), not Drizzle's built-ins,
  // because Drizzle overrides the driver's type parsers for exactly these types to
  // identity -- so the conversion has to happen in the column. Both report the same
  // columnType, so they are distinguished by the SQL type the column declares (see
  // udtOf). Drizzle's own PgTimestamp/PgTimestampString/PgDateString classes are
  // deliberately absent: a column regressing to one of them fails loudly here.
  PgEnumColumn: "app_role",
};

function udtOf(column: { columnType: string; name: string }, table: string): string {
  if (column.columnType === "PgCustomColumn") {
    // getSQLType() is what the column will actually declare in DDL.
    const sqlType = (column as unknown as { getSQLType(): string }).getSQLType();
    if (sqlType === "timestamp with time zone") return "timestamptz";
    if (sqlType === "date") return "date";
    throw new Error(`unmapped custom column SQL type ${sqlType} on ${table}.${column.name}`);
  }
  if (column.columnType === "PgArray") {
    // Element type is what distinguishes _text from _uuid.
    const element = (column as unknown as { baseColumn: { columnType: string } }).baseColumn;
    const base = COLUMN_TYPE_TO_UDT[element.columnType];
    if (!base) throw new Error(`unmapped array element type ${element.columnType} on ${table}.${column.name}`);
    return `_${base}`;
  }
  const udt = COLUMN_TYPE_TO_UDT[column.columnType];
  if (!udt) throw new Error(`unmapped Drizzle columnType ${column.columnType} on ${table}.${column.name}`);
  return udt;
}

describe("the Drizzle schema describes the live database", () => {
  it("covers every table, and invents none", () => {
    expect([...tables.keys()].sort()).toEqual(Object.keys(inventory.tables).sort());
  });

  it("declares the recorded number of tables and columns", () => {
    const columnCount = [...tables.values()].reduce((n, t) => n + Object.keys(getTableColumns(t)).length, 0);
    expect(tables.size).toBe(inventory.tableCount);
    expect(columnCount).toBe(inventory.columnCount);
  });

  it.each(Object.keys(inventory.tables).sort())("%s matches column-for-column", (tableName) => {
    const table = tables.get(tableName);
    expect(table, `${tableName} has no pgTable definition`).toBeDefined();

    const live = inventory.tables[tableName as keyof typeof inventory.tables] as Record<
      string,
      { udt: string; notNull: boolean; hasDefault: boolean }
    >;
    const declared = getTableColumns(table as PgTable);

    expect(Object.values(declared).map((c) => c.name).sort()).toEqual(Object.keys(live).sort());

    for (const column of Object.values(declared)) {
      const expected = live[column.name];
      expect(udtOf(column, tableName), `${tableName}.${column.name} type`).toBe(expected.udt);
      expect(column.notNull, `${tableName}.${column.name} nullability`).toBe(expected.notNull);
      expect(column.hasDefault, `${tableName}.${column.name} default presence`).toBe(expected.hasDefault);
    }
  });

  it("names every TypeScript property exactly as its column", () => {
    // The schema header promises this: it is what makes a Drizzle row and the old PostgREST
    // row the same object, so ~200 existing call sites keep reading `row.snake_case`.
    const mismatches: string[] = [];
    for (const [name, table] of tables) {
      for (const [property, column] of Object.entries(getTableColumns(table))) {
        if (property !== column.name) mismatches.push(`${name}: ${property} -> ${column.name}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("drizzle.config.ts", () => {
  const config = readFileSync(resolve(repoRoot, "drizzle.config.ts"), "utf8");
  const whitelistBlock = /DRIZZLE_MANAGED_TABLES\s*=\s*\[([\s\S]*?)\];/u.exec(config)?.[1] ?? "";
  const whitelisted = [...whitelistBlock.matchAll(/"([a-z_]+)"/gu)].map((m) => m[1]);

  it("whitelists exactly the tables the schema defines", () => {
    // tablesFilter is what stops drizzle-kit proposing a DROP for a table it cannot see a
    // definition for. A table missing from this list is invisible to push; a table listed
    // without a definition is a table push would offer to delete.
    expect([...new Set(whitelisted)].sort()).toEqual([...tables.keys()].sort());
  });

  it("points drizzle-kit at the schema barrel, not at one module", () => {
    expect(config).toContain("./src/db/schema/index.ts");
  });
});

describe("the raw SQL extras are idempotent", () => {
  const sqlDir = resolve(repoRoot, "src/db/sql");
  const files = readdirSync(sqlDir).filter((f) => f.endsWith(".sql")).sort();
  const read = (f: string) => readFileSync(resolve(sqlDir, f), "utf8");
  const executable = (f: string) =>
    read(f).split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");

  it("applies the four files in a defined order", () => {
    expect(files).toEqual([
      "01-functions.sql",
      "02-constraints-indexes.sql",
      "03-triggers.sql",
      "04-portable-defaults.sql",
    ]);
  });

  it("creates every function with OR REPLACE", () => {
    const sql = executable("01-functions.sql");
    const creates = [...sql.matchAll(/create\s+(or\s+replace\s+)?function/giu)];
    expect(creates.length).toBeGreaterThan(0);
    expect(creates.filter((m) => !m[1])).toEqual([]);
  });

  it("creates every index with IF NOT EXISTS", () => {
    const sql = executable("02-constraints-indexes.sql");
    const creates = [...sql.matchAll(/create\s+(?:unique\s+)?index\s+(if\s+not\s+exists\s+)?/giu)];
    expect(creates.length).toBeGreaterThan(0);
    expect(creates.filter((m) => !m[1])).toEqual([]);
  });

  it("adds every constraint inside the duplicate-swallowing DO block", () => {
    // ALTER TABLE ... ADD CONSTRAINT has no IF NOT EXISTS, so re-running would abort the
    // whole file on the first already-present constraint if any statement escaped the block.
    const sql = executable("02-constraints-indexes.sql");
    for (const line of sql.split("\n")) {
      if (!/add\s+constraint/iu.test(line)) continue;
      expect(line.trimStart(), "constraint statements must be quoted array entries inside the DO block").toMatch(/^'alter table/u);
    }
    expect(sql).toContain("exception when duplicate_object or duplicate_table then null;");
  });

  it("drops each trigger before creating it", () => {
    const sql = executable("03-triggers.sql");
    const created = [...sql.matchAll(/create\s+trigger\s+(\w+)/giu)].map((m) => m[1]);
    const dropped = [...sql.matchAll(/drop\s+trigger\s+if\s+exists\s+(\w+)/giu)].map((m) => m[1]);
    expect(created.length).toBeGreaterThan(0);
    expect(created.sort()).toEqual(dropped.sort());
  });

  it("leaves no Supabase auth.uid() default behind", () => {
    // 04 rewrites them; it is the only file allowed to name auth.uid(), and only to find them.
    for (const file of files) {
      if (file === "04-portable-defaults.sql") continue;
      expect(executable(file), `${file} must not depend on Supabase's auth schema`).not.toContain("auth.uid()");
    }
    expect(executable("04-portable-defaults.sql")).toContain("'%auth.uid()%'");
  });

  it("substitutes the same workspace id the application uses", () => {
    const constants = readFileSync(resolve(repoRoot, "src/lib/constants.ts"), "utf8");
    const localWorkspaceId = /LOCAL_WORKSPACE_ID\s*=\s*"([0-9a-f-]+)"/u.exec(constants)?.[1];
    expect(localWorkspaceId).toBeDefined();
    expect(executable("04-portable-defaults.sql")).toContain(localWorkspaceId as string);
  });

  it("changes no row data", () => {
    for (const file of files) {
      expect(
        executable(file).replace(/\$function\$[\s\S]*?\$function\$/gu, "<body>"),
        `${file} is schema DDL only`,
      ).not.toMatch(/^\s*(insert\s+into|update\s+public\.|delete\s+from|truncate)/imu);
    }
  });
});
