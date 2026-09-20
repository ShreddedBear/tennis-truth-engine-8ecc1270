import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

type Action = "select" | "insert" | "update" | "upsert" | "delete";
type Table = "matches" | "source_observations" | "metric_evidence_store" | "parsed_summary_fields" | "summary_versions" | "players";

export const DETERMINISTIC_OPERATION_MAP: ReadonlyMap<string, { table: Table; action: Action }> = new Map(
  (["matches", "source_observations", "metric_evidence_store", "parsed_summary_fields", "summary_versions", "players"] as const)
    .flatMap((table) => (["select", "insert", "update", "upsert", "delete"] as const)
      .map((action) => [`deterministic-${action}-${table}`, { table, action }] as const)),
);

const columns: Record<Table, ReadonlySet<string>> = {
  matches: new Set(["id", "user_id", "player1_name", "player2_name", "tournament_name", "event_level", "scheduled_date", "surface", "round", "created_at", "active_summary_version_id", "actual_winner", "final_score", "best_of", "result_recorded_at"]),
  source_observations: new Set(["id", "source_id", "source_name", "source_url", "player_name", "opponent_name", "player", "opponent", "event_date", "observation_type", "observation_key", "numeric_value", "text_value", "sample_label", "tournament", "surface"]),
  metric_evidence_store: new Set(["id", "metric_code", "metric_name", "player_name", "opponent_name", "as_of_date", "value_text", "treatment", "evidence_family", "sources", "reliability", "sample_label", "updated_at"]),
  parsed_summary_fields: new Set(["id", "user_id", "summary_version_id", "field_key", "normalized_value", "raw_value", "created_at"]),
  summary_versions: new Set(["id", "user_id", "match_id", "upload_id", "is_active", "version_number", "created_at"]),
  players: new Set(["id", "name", "normalized_name", "created_at"]),
};

function identifier(table: Table, column: string): ReturnType<typeof sql.raw> {
  if (!columns[table].has(column)) throw new Error(`Unsupported ${table} column: ${column}`);
  return sql.raw(`"${column}"`);
}

function valuesObject(table: Table, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Operation values must be an object");
  const result = value as Record<string, unknown>;
  for (const key of Object.keys(result)) identifier(table, key);
  return result;
}

function condition(table: Table, filter: unknown): ReturnType<typeof sql> {
  if (!Array.isArray(filter) || typeof filter[0] !== "string") throw new Error("Invalid deterministic filter");
  const [operator, ...args] = filter as [string, ...unknown[]];
  const column = identifier(table, String(args[0]));
  const value = args[1];
  if (operator === "eq") return sql`${column} = ${value}`;
  if (operator === "neq") return sql`${column} <> ${value}`;
  if (operator === "gt") return sql`${column} > ${value}`;
  if (operator === "gte") return sql`${column} >= ${value}`;
  if (operator === "lt") return sql`${column} < ${value}`;
  if (operator === "lte") return sql`${column} <= ${value}`;
  if (operator === "ilike") return sql`${column} ilike ${value}`;
  if (operator === "is") return sql`${column} is ${value === null ? sql`null` : sql.raw(String(value))}`;
  if (operator === "in") {
    if (!Array.isArray(value)) throw new Error("in requires an array");
    return sql`${column} in (${sql.join(value.map((item) => sql`${item}`), sql`, `)})`;
  }
  if (operator === "not") {
    if (args.length < 3) throw new Error("not requires column, operator, and value");
    const nested = condition(table, [String(args[1]), args[0], args[2]]);
    return sql`not (${nested})`;
  }
  throw new Error(`Unsupported deterministic filter operator: ${operator}`);
}

function whereClause(table: Table, filters: unknown, ownerId: string) {
  const clauses = [sql`true`];
  if (table === "matches" || table === "parsed_summary_fields" || table === "summary_versions") {
    clauses.push(sql`"user_id" = ${ownerId}::uuid`);
  }
  if (Array.isArray(filters)) {
    for (const filter of filters) {
      if (!filter || typeof filter !== "object") throw new Error("Invalid deterministic filter");
      const item = filter as { name?: string; args?: unknown[] };
      if (item.name === "order" || item.name === "range" || item.name === "limit") continue;
      clauses.push(condition(table, [item.name, ...(item.args ?? [])]));
    }
  }
  return sql.join(clauses, sql` and `);
}

export async function executeDeterministicOperation(
  operation: string,
  body: Record<string, unknown>,
  ownerId: string,
): Promise<{ data: unknown; error: { message: string } | null }> {
  const definition = DETERMINISTIC_OPERATION_MAP.get(operation);
  if (!definition) throw new Error(`Unknown deterministic operation: ${operation}`);
  const { table, action } = definition;
  const tableSql = sql.raw(`"${table}"`);
  const values = body.values;
  if (action === "select") {
    const requested = typeof body.columns === "string" && body.columns !== "*" ? body.columns.split(",").map((item) => item.trim()) : [...columns[table]];
    requested.forEach((column) => identifier(table, column));
    const order = Array.isArray(body.filters) ? (body.filters as Array<{ name: string; args: unknown[] }>).find((item) => item.name === "order") : undefined;
    const orderColumn = order ? identifier(table, String(order.args[0])) : sql.raw("id");
    const descending = order?.args[1] && typeof order.args[1] === "object" && (order.args[1] as { ascending?: boolean }).ascending === false;
    const limit = Array.isArray(body.filters) ? (body.filters as Array<{ name: string; args: unknown[] }>).find((item) => item.name === "limit")?.args[0] : undefined;
    const range = Array.isArray(body.filters) ? (body.filters as Array<{ name: string; args: unknown[] }>).find((item) => item.name === "range")?.args : undefined;
    const query = sql`select ${sql.join(requested.map((column) => identifier(table, column)), sql`, `)} from ${tableSql} where ${whereClause(table, body.filters, ownerId)} order by ${orderColumn} ${sql.raw(descending ? "desc" : "asc")} ${range ? sql`offset ${Number(range[0])} limit ${Number(range[1]) - Number(range[0]) + 1}` : limit != null ? sql`limit ${Number(limit)}` : sql``}`;
    const result = await db.execute(query);
    const rows = result.rows as unknown[];
    const cardinality = body.cardinality;
    if (cardinality === "single" && rows.length !== 1) return { data: null, error: { message: `Expected one ${table} row, found ${rows.length}` } };
    if (cardinality === "maybeSingle" && rows.length > 1) return { data: null, error: { message: `Expected at most one ${table} row` } };
    return { data: cardinality ? (rows[0] ?? null) : rows, error: null };
  }
  const rowValues = valuesObject(table, values);
  const names = Object.keys(rowValues);
  if (!names.length) throw new Error("Operation values cannot be empty");
  if (action === "insert") {
    const result = await db.execute(sql`insert into ${tableSql} (${sql.join(names.map((name) => identifier(table, name)), sql`, `)}) values (${sql.join(names.map((name) => sql`${rowValues[name]}`), sql`, `)}) returning *`);
    return { data: result.rows as unknown[], error: null };
  }
  const updates = sql.join(names.map((name) => sql`${identifier(table, name)} = ${rowValues[name]}`), sql`, `);
  if (action === "update") {
    const result = await db.execute(sql`update ${tableSql} set ${updates} where ${whereClause(table, body.filters, ownerId)} returning *`);
    return { data: result.rows as unknown[], error: null };
  }
  if (action === "delete") {
    const result = await db.execute(sql`delete from ${tableSql} where ${whereClause(table, body.filters, ownerId)} returning *`);
    return { data: result.rows as unknown[], error: null };
  }
  const conflict = body.options && typeof body.options === "object" ? String((body.options as { onConflict?: string }).onConflict ?? "") : "";
  if (!conflict || conflict.split(",").some((name) => !columns[table].has(name.trim()))) throw new Error(`Unsupported ${table} upsert conflict target`);
  const conflictSql = sql.join(conflict.split(",").map((name) => identifier(table, name.trim())), sql`, `);
  const result = await db.execute(sql`insert into ${tableSql} (${sql.join(names.map((name) => identifier(table, name)), sql`, `)}) values (${sql.join(names.map((name) => sql`${rowValues[name]}`), sql`, `)}) on conflict (${conflictSql}) do update set ${updates} returning *`);
  return { data: result.rows as unknown[], error: null };
}