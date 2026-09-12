-- SECURITY DEFINER functions in `public` are reachable from the browser as
-- /rest/v1/rpc/<name>. consolidate_duplicate_matches() and
-- retire_active_prediction_slate() are destructive maintenance routines, and every one of
-- these runs with the definer's rights, so they bypass the table-level lockdown in
-- 20260911090000_decision_table_write_lockdown.sql entirely: an outsider holding the
-- browser publishable key could retire the active slate or consolidate matches without
-- ever touching a table directly.
--
-- Reserve them for service_role and pin a safe search_path (object-shadowing guard).
--
-- Trigger functions (matches_assign_slate) are unaffected: a trigger executes regardless of
-- whether the statement's caller holds EXECUTE on it. Every application call site for these
-- routines uses the service-role client -- claim_audit_run, release_audit_run_lease,
-- renew_audit_run_lease, clear_operational_slate and upsert_metric_evidence_side are all
-- invoked from *.server.ts through supabaseAdmin.

begin;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as proc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.proc);
    execute format('grant execute on function %s to service_role', f.proc);
    execute format('alter function %s set search_path = pg_catalog, public', f.proc);
  end loop;
end $$;

commit;
