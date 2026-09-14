# Running the Tennis Truth Engine on Replit

The application is self-contained. It needs a PostgreSQL database and, optionally, a
research provider. There is no Supabase project, no Lovable key, and no GitHub Actions
dependency for normal operation.

## 1. Environment

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. Replit's `postgresql-16` module (already declared in `.replit`) provides one. |
| `DATABASE_POOL_MAX` | no | Pooled connections per instance. Default 10. |
| `RESEARCH_API_KEY` / `RESEARCH_URL` | no | Any OpenAI-compatible chat-completions endpoint. |
| `RESEARCH_GROUNDED_SEARCH` | no | `true` only if that endpoint understands the Gemini-style `google_search` tool. |
| `AUDIT_CRON_SECRET` | no | Shared secret for `POST /api/drive-audit-batch`. |

`.env.example` is the full list with the reasoning. **No `VITE_*` variable carries a
credential**, and none should: anything prefixed `VITE_` is compiled into the browser
bundle.

With no research provider configured, metrics that no deterministic producer can resolve
come out `UNAVAILABLE`. That is the engine behaving correctly — it is required to refuse
rather than guess — not a degraded mode.

## 2. First run

```bash
npm install
npm run db:push        # creates the schema, then applies src/db/sql
npm run dev            # or: npm run build && npm run start
```

`db:push` runs `drizzle-kit push` and then `src/db/apply-sql-extras.ts`, which applies the
eleven database functions, seven triggers, 24 indexes and 31 constraints that a schema diff
cannot express. Both halves are needed; `db:push` runs them together.

The app seeds itself on first load: the calibration baseline, the nine source definitions,
and the three rule documents (211 rules) are inserted by `ensureBootstrapped` if their
tables are empty.

## 3. Deployment

`.replit` targets `autoscale`, builds with `npm run build` and runs `npm run start` — a
plain Node server (`node .output/server/index.mjs`).

It used to run `npx wrangler dev` against a Cloudflare Workers bundle. That is no longer
viable and the reason is not preference: the data layer holds a PostgreSQL connection pool,
which is a long-lived TCP socket, and a Workers runtime cannot keep one.

## 4. Driving audits without a browser tab

Every path that advances the pipeline from the UI — Upload's commit flow, Active Slate's
poll loop — is triggered from a browser tab. When that tab closes or backgrounds, RUNNING
audits freeze exactly where they are. Something has to keep them moving.

That used to be a GitHub Actions cron. It is now `scripts/drive-audit-worker.ts`:

```bash
npm run worker:drive-audit:once   # one pass  — for a Replit Scheduled Deployment
npm run worker:drive-audit        # a loop    — for a Reserved VM / background worker
```

Either is safe to run alongside the UI and alongside itself. It claims work through the
same `claim_audit_run` / `renew_audit_run_lease` / `release_audit_run_lease` leases every
other path uses, so a second claimant simply finds nothing to claim. **Running more copies
does not process more matches**, and nothing here widens the batch size or concurrency.

`.github/workflows/drive-audit.yml` still exists but its cron is removed; it is
`workflow_dispatch` only, for driving a batch by hand.

## 5. Moving the production data

Three commands, and the third is the one that matters.

### The short version

```bash
npm run db:cutover -- --dry-run   # check everything, change nothing
npm run db:cutover                # schema, export, import, verify
```

`db:cutover` runs the whole sequence with the checks that make it safe unattended. It
refuses to start if `DATABASE_URL`, `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is
missing, if the target already holds application rows, or if `DATABASE_URL` points at the
Supabase source itself. It stops at the first failing step, because a half-applied data
migration is worse than one that never started, and it never writes to the source.

### The same thing, step by step

There are two ways to read the source, and **the second is usually the right one on
Replit** because it needs no new secret:

```bash
# 1a. Over the Supabase Data API, using credentials the deployment already has.
#     Read-only; safe while the app is live.
npm run db:export:api -- ./migration-export        # uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

# 1b. Or over a direct PostgreSQL connection, if you have the source database password.
SOURCE_DATABASE_URL='postgresql://...supabase...' npm run db:export -- ./migration-export

# 2. Build the schema on the Replit database, then load.
DATABASE_URL="$REPLIT_DATABASE_URL" npm run db:push
DATABASE_URL="$REPLIT_DATABASE_URL" npm run db:import -- ./migration-export

# 3. Prove it.
DATABASE_URL="$REPLIT_DATABASE_URL" npm run db:verify -- ./migration-export
```

`db:verify` exits non-zero on any discrepancy. It checks per-table row counts **and**
order-independent content checksums (counts match perfectly while a column arrives null —
that is the failure mode checksums exist for), walks all 57 foreign keys for orphaned rows,
counts constraints, indexes, functions and triggers, and fails if any column still depends
on Supabase's `auth.uid()`.

The content checksum is computed in JavaScript from the rows themselves, so it means the
same thing whichever export path produced them. When the export came over a direct
connection the manifest also carries Postgres' own row-text hash, and both are checked.
Proven to have teeth: changing one jsonb value in one row out of 589 fails verification on
both checksums and exits 1.

Only application tables move. The list comes from the Drizzle schema itself, so Supabase's
`auth`, `storage` and `realtime` schemas are not read and cannot be migrated by accident.

`db:import` refuses a target that already holds application rows unless
`ALLOW_NON_EMPTY_TARGET=true`. Loading on top of existing data merges two datasets
irreversibly, and no amount of checking afterwards untangles it.

### Do not retire the old database on the same day

The order that protects the work is: migrate → verify → run the app against the new
database → observe → *then* retire. Keep the export. `db:export` is repeatable, so a second
export taken later can be diffed against the first to show exactly what changed in between.

## 6. Verifying the APPLICATION after a cutover

A passing database checksum says two databases hold the same bytes. It does not say the
running application is on the new one. This does:

```bash
npm run verify:cutover
```

Sixteen checks in one pass, read-mostly, printing no secret: the target's host and database
name, that it is not Supabase, that it is reachable, row counts across the operational
tables, that the legacy 60-match slate is intact, the constraint/index/function/trigger
counts, that no column still defaults to `auth.uid()`, foreign-key integrity across every
relationship, both route secrets configured **and not still the leaked values**, no
Supabase or Lovable package, the Supabase client gone, no committed data export, and the
scheduler being Replit's rather than a GitHub cron.

The lease check is the one worth calling out: it does not check that
`claim_audit_run` / `renew_audit_run_lease` / `release_audit_run_lease` exist, it **uses**
them — claims a lease, proves a second owner is refused, renews, releases, and leaves
nothing held. That is the worker's entire concurrency safety, so it is exercised rather
than assumed.

Exits non-zero if anything fails, and reports what it found even when the database is
unreachable.

## 7. Verifying a migration end to end

The whole sequence is tested, not just described. Against a stock PostgreSQL 16:

```bash
TEST_DATABASE_URL='postgresql://...' npx vitest run src/db/persistence-parity
```

This writes the real frozen evidence for 32 production matches through the new layer, reads
it back, and asserts the Truth Engine reaches a byte-identical decision — outcome, winner,
evidence percentage, family sets, stability, stress robustness, underdog viability,
verification, disagreement and final reason. It is the test that answers the only question
that matters about a persistence migration.

## 8. Module boundaries

The platform/engine split the long-term architecture wants is:

```
platform/   database, access, players, matches, research, providers, jobs, logging
engines/    truth/, stats/, engine3/
```

**The Truth Engine has not been physically relocated into that layout, and that is a
deliberate choice rather than an oversight.** Moving ~200 files would be a large,
untestable diff on top of a migration whose entire value rests on behaviour being
unchanged, and it would gain nothing until a second engine actually lands in this
repository.

What does exist is the seam that makes the move cheap later:

- `src/db/` is the platform data layer. Nothing in it knows about tennis.
- `src/lib/truth-engine-*.ts` is the engine: pure, deterministic, no database import.
  `git diff` across the entire migration shows **zero** changes to those files.
- Everything between them is a repository or a server function, all of which are already
  named and separated.

When a second engine arrives, `src/lib/truth-engine-*` moves to `engines/truth/` and
`src/db/` moves to `platform/database/` as a rename, because nothing crosses that line
today except through the interfaces above.
