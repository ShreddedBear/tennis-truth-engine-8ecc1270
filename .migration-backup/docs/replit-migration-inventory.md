# Replit migration — dependency inventory (Phase 0)

Captured at `30d3a82`, before any Lovable or Supabase removal. This is the map the rest of
the migration works from; it is the record of what existed, not a plan.

## 1. Supabase

### 1a. Runtime database access — the bulk of the work

| Group | Files | Call sites |
| --- | --- | --- |
| Server modules (`*.server.ts`, `routes/api/*`) | 23 | ~105 |
| Shared lib reachable from the browser | 6 | ~35 |
| Browser routes (`routes/app/*.tsx`) | 10 | ~35 |

Every one of these queries is **single-table**. Not one call site in the repository uses a
PostgREST embedded select (`select("*, other(...)")`), so there is no join semantics to
reproduce and the port is mechanical rather than interpretive.

Already migrated at this commit: `audit-repo.server.ts` (29 call sites).

### 1b. RPC (PostgREST `/rpc/`)

Five functions are called by the app. All are ordinary plpgsql/sql and survive as database
functions; only the transport changes.

| Function | Status |
| --- | --- |
| `claim_audit_run` | migrated to `SELECT` in `audit-repo.server.ts` |
| `renew_audit_run_lease` | migrated |
| `release_audit_run_lease` | migrated |
| `clear_operational_slate` | pending (`reset-slate.functions.ts`) |
| `upsert_metric_evidence_side` | pending (evidence writeback) |

A sixth, `consolidate_duplicate_matches`, exists in the database but references three
objects that were dropped (`match_pair_key`, `norm_match_text`, `match_merge_log`). It is
dead and is not carried into `src/db/sql/`.

### 1c. Auth

`src/integrations/supabase/auth-attacher.ts`, `auth-middleware.ts`, `previewAuthStorage.ts`,
and `startInstance`'s `functionMiddleware: [attachSupabaseAuth]`.

Production holds **zero `auth.users`**. Every request is anonymous, and the app's ownership
model is the single constant `LOCAL_WORKSPACE_ID`, not a session. So this is machinery with
nothing behind it.

### 1d. Platform-specific database objects

`auth.uid()` appears in the column default of 40 columns. It exists only because the
Supabase platform creates an `auth` schema; already neutralised by
`src/db/sql/04-portable-defaults.sql`.

Storage bucket `database_export_26_08_26` is referenced only by the superseded security
migration. No application code calls `.storage`. No edge functions are invoked.

### 1e. Build / CI / deployment

| File | Reference |
| --- | --- |
| `.github/workflows/drive-audit.yml` | production scheduler, Supabase + Lovable secrets |
| `.github/workflows/capture-match-results.yml` | Supabase secrets |
| `.github/workflows/deploy-supabase-migrations.yml` | entirely Supabase |
| `.github/workflows/supabase-security-repair.yml` | entirely Supabase |
| `supabase/config.toml`, `supabase/migrations/`, `supabase/security/` | CLI + ledger |

### 1f. Environment variables

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`.

## 2. Lovable

Lovable is **not only build tooling here**, which is the single most important finding in
this inventory. It appears in three distinct roles, and they carry very different risk.

### 2a. Build configuration — mechanical

`vite.config.ts` imports `defineConfig` from `@lovable.dev/vite-tanstack-config`. That
package wraps the standard TanStack Start + React + Tailwind Vite setup. Replacing it means
writing the plugin list out longhand.

### 2b. Preview/error plumbing — inert outside Lovable's preview

- `src/lib/lovable-error-reporting.ts` calls `window.__lovableEvents?.captureException`,
  which only exists inside Lovable's preview iframe. Outside it, a no-op.
- `src/integrations/supabase/previewAuthStorage.ts` (`brokeredPreviewStorage`) brokers auth
  storage across that same iframe. With Supabase Auth gone it has nothing to broker.

### 2c. **A runtime LLM provider — a real functional dependency**

`https://ai.gateway.lovable.dev/v1/chat/completions`, authenticated with `LOVABLE_API_KEY`:

| Caller | Use |
| --- | --- |
| `src/lib/audit-research.server.ts` | web-grounded research for metric evidence |
| `src/lib/pdf-extract.functions.ts` | PDF text extraction fallback |

`audit-research.server.ts` already supports a second, non-Lovable provider
(`RESEARCH_FALLBACK_API_KEY` + `RESEARCH_FALLBACK_URL`, or `OPENAI_API_KEY`), so the
*architecture* for dropping Lovable already exists.

**One capability does not survive the swap.** Only Lovable's gateway advertises the
`google_search` tool (`supportsGoogleSearchTool: true`); the generic OpenAI-compatible path
sets it `false`. Removing Lovable therefore removes **web-grounded** research, leaving
ungrounded model output. This is recorded here rather than silently accepted — see the
Phase 9 notes for how it is handled.

## 3. Replit — what is already present

`.replit` already declares `postgresql-16` among its modules, so Replit-managed PostgreSQL
is available in the Replit environment and needs no new provisioning mechanism.

Two things there are not yet Replit-owned:

- `[deployment].run` launches **Cloudflare Wrangler** against `.output/server/wrangler.json`,
  not a Node server.
- Production scheduled execution is `.github/workflows/drive-audit.yml` (cron `*/5`), not a
  Replit job.

## 4. What this container cannot do

This migration is being carried out from a Claude Code container, not from inside Replit.
Replit's PostgreSQL `DATABASE_URL` is issued to the Replit workspace and is not reachable
or provisionable from here, and the Replit MCP tools available in this session expose apps
and files but neither database provisioning nor secrets.

Everything that is code — the remaining query migration, the browser/server boundary,
Lovable and Supabase removal, the Replit runtime and scheduler configuration, and the
export/import/verification tooling — is done here. The steps that require the Replit
database itself to exist (provision, load, row-level integrity comparison, fresh-slate
validation, cutover) are prepared as runnable scripts and executed by the owner in Replit.
