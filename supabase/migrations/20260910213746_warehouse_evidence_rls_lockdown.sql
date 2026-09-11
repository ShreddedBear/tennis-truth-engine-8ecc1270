-- ---------------------------------------------------------------------------
-- P0 SECURITY: close public write access to the evidence warehouse.
--
-- Security-only. Touches no row data, no metric definition, no coverage or
-- decision logic, and no table outside the four named below.
--
-- WHAT WAS WRONG (production, verified read-only before this migration):
--   source_observations    RLS disabled, 887 rows
--   metric_evidence_store  RLS disabled, 6,945 rows
--   ingestion_targets      RLS disabled, 5 rows
--   source_ingestion_runs  RLS disabled, 42 rows
-- and on all four, `anon` and `authenticated` held
-- SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER.
--
-- These are not incidental tables. The deterministic metric producers
-- (deterministic-pbp-metrics.server.ts, deterministic-ranking-metrics.server.ts,
-- deterministic-results-schedule-metrics.server.ts, deterministic-market-metrics
-- .server.ts, deterministic-environment-metrics.server.ts,
-- deterministic-rules-context-metric.server.ts, evidence-canonical-identity
-- .server.ts, warehouse-first-researcher.server.ts) read them to build the metric
-- values the Truth Engine grades on. The publishable key is shipped in the browser
-- bundle, so anyone holding it could insert a fabricated observation for a named
-- player and change which player the engine selects -- with correct-looking
-- provenance attached, because the fabricated row IS the provenance.
--
-- WHY THIS FILE RATHER THAN 20260826103000_supabase_security_rls_repair.sql:
-- that migration is a whole-schema security overhaul. Its section 2 does
-- `revoke all on all tables in schema public from anon` and its sections 5-6 add
-- admin-only policies to every table. The application's browser client reads
-- matches / audit_runs / audit_stage_runs / metric_results / final_decisions
-- directly with the publishable (anon) key, so applying it whole would take the
-- entire UI offline. This migration is exactly its section 4 -- the four
-- backend-owned warehouse tables -- and nothing else. The wider repair remains
-- open as its own decision.
--
-- WHY THE SERVER PATH KEEPS WORKING:
--   * Every reader and writer of these four tables is a `.server.ts` module or a
--     `scripts/` entry point using `supabaseAdmin` (SUPABASE_SERVICE_ROLE_KEY).
--     No `.server.ts` file imports the browser client, and no file under
--     src/routes, src/components or src/hooks references these tables at all.
--   * `service_role` has rolbypassrls = true, so enabling RLS cannot affect it,
--     and it already holds full table privileges (re-granted below to be explicit).
--   * RLS is enabled with NO policies on purpose. For anon/authenticated that is
--     deny-all, which is the intent; for service_role it is bypassed entirely.
--     There is no legitimate browser access to add a policy for.
--   * These four tables carry no user triggers and back no views, so nothing
--     inherits their privileges indirectly.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'ingestion_targets',
    'metric_evidence_store',
    'source_ingestion_runs',
    'source_observations'
  ] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('grant all on table public.%I to service_role', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- The write door table privileges alone do not close.
--
-- public.upsert_metric_evidence_side(jsonb) is SECURITY DEFINER, owned by
-- `postgres` (which has BYPASSRLS), and inserts/updates metric_evidence_store.
-- In production `anon` and `authenticated` both held EXECUTE on it, so revoking
-- table privileges above would have left an anonymous caller able to write
-- arbitrary evidence rows straight through the RPC -- defeating the lockdown.
--
-- 20260830070000_atomic_metric_evidence_upsert.sql already carries exactly this
-- revoke, but that migration is absent from production's applied-migration
-- ledger: the function body reached production by some other route while its
-- hardening did not. Re-stating it here makes the lockdown self-contained rather
-- than dependent on reconciling that ledger first.
--
-- The only caller is warehouse-first-researcher.server.ts, through the
-- service-role client, which keeps EXECUTE.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.upsert_metric_evidence_side(jsonb)') is not null then
    revoke all on function public.upsert_metric_evidence_side(jsonb) from public, anon, authenticated;
    grant execute on function public.upsert_metric_evidence_side(jsonb) to service_role;
  end if;
end $$;
