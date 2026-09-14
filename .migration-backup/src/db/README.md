# Database layer

Plain PostgreSQL, reached with [Drizzle ORM](https://orm.drizzle.team) over a `pg`
connection pool — the same shape as `ShreddedBear/Tennis-Stats-Engine`.

This replaces `@supabase/supabase-js`. The application no longer speaks to PostgREST over
HTTP with an API key; it holds a connection and sends SQL.

## Layout

| Path | What it is |
| --- | --- |
| `schema/` | One module per domain. Every table in the database has a `pgTable()` here. |
| `client.server.ts` | The pool and the `db` handle. **Server only.** |
| `sql/` | Raw SQL that a schema diff cannot express: functions, triggers, partial and expression indexes, CHECK constraints. |
| `apply-sql-extras.ts` | Applies `sql/` in filename order. Idempotent. |
| `__fixtures__/live-schema-inventory.json` | The `information_schema` of the live database, frozen. `schema.test.ts` holds the TypeScript schema to it. |
| `index.ts` | Re-exports the schema. Safe to import anywhere — it opens nothing. |

## Configuration

One variable:

```
DATABASE_URL=postgresql://user:password@host:5432/database
```

Optional: `DATABASE_POOL_MAX` (default 10).

Nothing else. There is no project ref, no anon key, no service-role key, and no separate
browser client — the browser has no database credentials at all and reaches data only
through server functions.

Because `DATABASE_URL` is the whole configuration, the host is interchangeable: a Supabase
project's connection string, Neon, RDS, Railway, or a local container all work unchanged.
`sql/04-portable-defaults.sql` is what makes that true — see its header.

## Commands

```bash
npm run db:push         # drizzle-kit push, then the SQL extras
npm run db:generate     # write a migration file instead of pushing
npm run db:sql-extras   # re-apply sql/ alone
npm run db:studio       # drizzle-kit studio
```

## Property naming

Table properties are **snake_case, identical to the column names** — `matchesTable.player1_name`,
not `matchesTable.player1Name`. Drizzle's usual convention is the opposite, and this is a
deliberate departure: the schema describes a database that predates it, and roughly 200
existing call sites already read `row.usable_coverage_percent`. Equal names make a Drizzle
row and the old PostgREST row the same object, so the migration changes how a query is
*built* without changing what any consumer of a result *sees*.
`schema.test.ts` enforces it.

## Security model

This is the part that changed most, and it is worth being explicit about.

Under PostgREST, the browser held a publishable key and queried the database directly.
Row Level Security and table grants were therefore load-bearing: they were the only thing
between a browser key and the evidence tables.

A direct connection authenticates as the role in `DATABASE_URL`, which owns the schema.
**RLS does not apply to it.** That is not a weakening, because the other half of the change
is that the browser no longer has any credential: it cannot reach the database except
through a server function that this codebase defines. The boundary moved from the database
to the server/client split, and it is enforced mechanically — no module that ships to the
browser may import `client.server.ts`.
