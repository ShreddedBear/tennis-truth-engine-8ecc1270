/**
 * The value a `jsonb` column can hold.
 *
 * Drizzle types jsonb as `unknown` by default, which is honest but unusable at the
 * server-function boundary: TanStack Start requires a server function's return type to be
 * JSON-serializable, and `unknown` cannot satisfy that. Since a jsonb column is JSON by
 * definition, saying so in the schema is both more accurate and what lets these rows cross
 * the boundary to the browser.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
