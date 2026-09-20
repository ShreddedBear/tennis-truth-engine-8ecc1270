# Legacy Supabase migrations — historical provenance only

**Nothing in this directory is executable, and nothing in it runs.**

The application no longer uses Supabase. It connects to PostgreSQL with `DATABASE_URL`
through Drizzle; the live schema is defined by `src/db/schema/` and the raw SQL in
`src/db/sql/`, applied with `npm run db:push`.

These files are kept because they are the record of how the production database reached the
shape `src/db/schema/` describes — including the P0 security work done immediately before
the migration, which is the reason several of these lockdowns exist at all.

## Why it was moved rather than deleted

Deleting it would lose the provenance. Leaving it at `supabase/` would leave a directory the
Supabase CLI still recognises: `supabase db push` finds `supabase/migrations/` by
convention, and running it against a database this application now owns would replay
migrations the Drizzle schema already accounts for. Moving it makes that impossible while
keeping the history.

## What is here

| Path | What it is |
| --- | --- |
| `migrations/` | The applied migration ledger, including the warehouse, decision-table, SECURITY DEFINER RPC and calibration control-plane lockdowns. |
| `security/` | `superseded-20260826103000_supabase_security_rls_repair.sql` — a whole-schema RLS overhaul that was **never applied**. It revokes anon SELECT across the schema, and production had zero `auth.users`, so applying it would have taken the live UI offline. |
| `config.toml` | The Supabase CLI project config, pointing at project `qyovnrkiknsiqjybxubf`. |

## What carried forward, and what did not

The database objects these migrations created are reproduced in `src/db/sql/`: eleven
functions, seven triggers, 24 indexes and 31 constraints. What did **not** carry forward is
everything that only made sense with PostgREST in front of the database —
`GRANT`/`REVOKE` on the `anon` and `authenticated` roles, and the RLS policies written
against them.

That is not an oversight. A `DATABASE_URL` connection authenticates as the schema owner, so
RLS does not apply to it, and the browser has no database credential at all any more. The
boundary those grants defended moved from the database to the server/client split, and it is
enforced by `src/db/server-only.test.ts` and `src/db/bundle-secrets.test.ts` — the latter
reading the actual shipped bundle.
