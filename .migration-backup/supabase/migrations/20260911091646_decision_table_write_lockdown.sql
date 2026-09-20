-- TRUTH ENGINE — DECISION-TABLE WRITE LOCKDOWN (security only).
--
-- WHAT THIS CLOSES. Every public table carried a permissive policy named
-- "single user open access" (FOR ALL TO anon, authenticated USING true WITH CHECK true)
-- together with full DML grants to `anon`. The publishable key is shipped in the browser
-- bundle, so anyone holding it could INSERT/UPDATE/DELETE/TRUNCATE the Truth Engine's own
-- output -- audit_runs.independent_winner, final_decisions, metric_results, stress_results
-- -- i.e. fabricate a winner directly, bypassing the deterministic engine entirely.
--
-- The 2026-09-10 warehouse lockdown fixed source_observations / metric_evidence_store /
-- ingestion_targets / source_ingestion_runs. It did not touch the decision tables, which
-- are equally authoritative: a forged final_decisions row is indistinguishable downstream
-- from a computed one.
--
-- WHAT THIS DELIBERATELY PRESERVES. Production currently has ZERO auth.users, so the app
-- reaches the database as `anon`; revoking anon outright would take the live UI offline.
-- This migration therefore keeps anon SELECT (the existing confidentiality posture, which
-- it does not change) and keeps anon INSERT/UPDATE on exactly the tables the browser
-- genuinely writes today -- the PDF ingestion flow, the manual match-field correction, the
-- bootstrap seeders and the calibration page. Every other table becomes read-only to the
-- browser, and the server pipeline is unaffected because it writes as service_role, which
-- bypasses RLS.
--
-- The only browser writer to the decision tables was createAuditRun() in
-- src/lib/audit-runs.ts, which has no call sites -- audit runs are instantiated server-side
-- by audit-pipeline.ts under the service-role client. Nothing live loses a write path.
--
-- Additive and non-destructive: no row is inserted, updated or deleted.

begin;

-- ---------------------------------------------------------------------------
-- 1. Remove the blanket permissive policy wherever it still exists.
--    Named policies only -- unrelated owner/admin policies are preserved.
-- ---------------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and lower(policyname) in ('single user open access', 'single-user open access')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Baseline: the browser roles get SELECT only, on every public table except
--    the four warehouse tables already locked down (which stay fully revoked).
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  warehouse text[] := array['ingestion_targets','metric_evidence_store','source_ingestion_runs','source_observations'];
begin
  for r in
    select c.relname as t
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')
  loop
    execute format('alter table public.%I enable row level security', r.t);
    execute format('revoke all on table public.%I from anon, authenticated', r.t);
    execute format('grant all on table public.%I to service_role', r.t);

    if not (r.t = any(warehouse)) then
      execute format('grant select on table public.%I to anon, authenticated', r.t);
      execute format('drop policy if exists %I on public.%I', 'browser_read', r.t);
      execute format(
        'create policy %I on public.%I for select to anon, authenticated using (true)',
        'browser_read', r.t
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Restore write access ONLY where a live browser code path needs it.
--
--    matches                 upload.tsx (insert/update), match.$matchId.tsx (update)
--    summary_uploads         upload.tsx
--    summary_versions        upload.tsx (insert/update)
--    parsed_summary_fields   upload.tsx
--    execution_logs          audit-runs.ts log()
--    rules / rule_documents / rule_document_versions / source_definitions
--                            bootstrap.ts seeders
--    calibration_buckets / calibration_versions / calibration_ledger
--                            bootstrap.ts + calibration.tsx gradeResult()
--
--    DELETE is granted nowhere: no browser path deletes, and the operational
--    Clear Slate runs server-side through clear_operational_slate().
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  writable text[] := array[
    'matches','summary_uploads','summary_versions','parsed_summary_fields','execution_logs',
    'rules','rule_documents','rule_document_versions','source_definitions',
    'calibration_buckets','calibration_versions','calibration_ledger'
  ];
begin
  foreach t in array writable loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('grant insert, update on table public.%I to anon, authenticated', t);
      execute format('drop policy if exists %I on public.%I', 'browser_write', t);
      execute format(
        'create policy %I on public.%I for insert to anon, authenticated with check (true)',
        'browser_write', t
      );
      execute format('drop policy if exists %I on public.%I', 'browser_modify', t);
      execute format(
        'create policy %I on public.%I for update to anon, authenticated using (true) with check (true)',
        'browser_modify', t
      );
    end if;
  end loop;
end $$;

commit;
