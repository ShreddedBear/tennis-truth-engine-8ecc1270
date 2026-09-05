-- HARD DELETE CLEAR SLATE.
--
-- Root cause of the leakage this fixes: resetOperationalSlate (reset-slate.functions.ts)
-- only ever flipped summary_versions.is_active to false, nulled
-- matches.active_summary_version_id, and invalidated the latest audit_runs row -- every
-- matches row, every metric/verification/disagreement/underdog/stress/decision row, and
-- every summary_versions/summary_uploads row was left physically in the database. Because
-- upload.tsx's findReusable() searches `matches` globally by canonical_key with no filter
-- for "cleared", re-uploading the same PDF after a "Clear Slate" found and reused the old,
-- supposedly-cleared match row -- reviving its old audit history under a "new" upload.
--
-- Clear Slate must mean physical deletion of the operational prediction slate, not
-- retirement, soft-deletion, or archival. This migration adds the one authoritative,
-- transactional delete path; the application code path is repointed at it in the same
-- change (reset-slate.functions.ts).
--
-- prediction_slates first: this table (user_id, slate_number, label, created_at,
-- retired_at, retired_reason) and matches.slate_id already exist live -- created directly
-- against the database, with no migration in this repo. It is NOT dead scaffolding: a
-- live BEFORE INSERT trigger (matches_assign_slate -> ensure_active_prediction_slate,
-- both pre-existing, also with no migration in this repo) stamps every new match with the
-- current non-retired slate, creating one (slate_number = max+1) if none exists. No
-- TypeScript application code is aware of any of this -- it works purely at the database
-- layer. `create table if not exists` below brings the repo's migration history back in
-- sync with what is actually live, without altering the already-populated table.
--
-- This is exactly why clear_operational_slate() deletes prediction_slates rows outright
-- rather than leaving them for the trigger to "retire": with zero non-retired slate rows
-- left after a clear, the very next match insert -- a real re-upload -- causes
-- ensure_active_prediction_slate() to create a fresh slate_number starting from 1, with
-- no reference to the cleared one anywhere.
create table if not exists public.prediction_slates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  slate_number integer not null,
  label text,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  retired_reason text
);

alter table public.prediction_slates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'prediction_slates' and policyname = 'prediction_slates_service_role_all'
  ) then
    create policy prediction_slates_service_role_all on public.prediction_slates
      for all to service_role using (true) with check (true);
  end if;
end
$$;

-- GLOBAL REFERENCE DATA vs OPERATIONAL DATA -- what this function must never touch:
-- players, tournaments, metric_registry, rules/rule_documents/rule_document_versions,
-- calibration_versions/calibration_buckets, source_definitions, ingestion_targets,
-- source_observations, metric_evidence_store, the runtime tennis index, user_roles. None of
-- those are reachable from `matches` by any FK, and this function never references them.
--
-- audit_color_ledger, autopsies, calibration_ledger and override_records reference matches
-- with ON DELETE SET NULL (confirmed live), not CASCADE. Deliberately left that way: none of
-- the three is written by the automated Truth Engine pipeline (only the manual grading UI
-- in calibration.tsx writes calibration_ledger/audit_color_ledger/autopsies via
-- gradeResult/override flows) -- they are a pre-existing, independent grading ledger, not
-- operational prediction-slate data, and nothing reads them to reuse or rediscover a match
-- (findReusable and every dedup path query `matches` directly). Once their match_id is
-- NULL, they hold no reference an uploaded match could be recognised by, which is what
-- actually matters here -- not which table happens to own the row.
create or replace function public.clear_operational_slate(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_ids uuid[];
  v_run_ids uuid[];
  v_before jsonb;
  v_after jsonb;
  v_deleted_matches integer;
  v_deleted_uploads integer;
  v_deleted_slates integer;
begin
  -- Serializes concurrent Clear Slate invocations for the same user (double-click, two
  -- tabs): the second call blocks here until the first's delete transaction commits, then
  -- finds nothing left to delete -- safe and idempotent (test O), not a duplicate delete.
  perform pg_advisory_xact_lock(hashtext('clear_operational_slate:' || p_user_id::text));

  select coalesce(array_agg(id), '{}') into v_match_ids from public.matches where user_id = p_user_id;
  select coalesce(array_agg(id), '{}') into v_run_ids from public.audit_runs where match_id = any(v_match_ids);

  -- BEFORE snapshot, scoped to exactly the rows this call is about to delete. Required by
  -- the live-verification report: every count here must independently corroborate what the
  -- application already believed was on the slate.
  select jsonb_build_object(
    'matches', coalesce(array_length(v_match_ids, 1), 0),
    'audit_runs', coalesce(array_length(v_run_ids, 1), 0),
    'metric_results', (select count(*) from public.metric_results where audit_run_id = any(v_run_ids)),
    'verification_results', (select count(*) from public.verification_results where audit_run_id = any(v_run_ids)),
    'disagreement_results', (select count(*) from public.disagreement_results where audit_run_id = any(v_run_ids)),
    'underdog_results', (select count(*) from public.underdog_results where audit_run_id = any(v_run_ids)),
    'stress_results', (select count(*) from public.stress_results where audit_run_id = any(v_run_ids)),
    'final_decisions', (select count(*) from public.final_decisions where audit_run_id = any(v_run_ids)),
    'audit_coverage', (select count(*) from public.audit_coverage where audit_run_id = any(v_run_ids)),
    'audit_stage_runs', (select count(*) from public.audit_stage_runs where audit_run_id = any(v_run_ids)),
    'execution_logs', (select count(*) from public.execution_logs where match_id = any(v_match_ids)),
    'result_grades', (select count(*) from public.result_grades where match_id = any(v_match_ids)),
    'match_identity_records', (select count(*) from public.match_identity_records where match_id = any(v_match_ids)),
    'summary_versions', (select count(*) from public.summary_versions where match_id = any(v_match_ids)),
    'summary_uploads', (
      select count(*) from public.summary_uploads su
      where su.user_id = p_user_id
        and exists (select 1 from public.summary_versions sv where sv.upload_id = su.id and sv.match_id = any(v_match_ids))
    ),
    'prediction_slates', (select count(*) from public.prediction_slates where user_id = p_user_id)
  ) into v_before;

  -- THE DELETE. Every operational child listed above is reachable from `matches` via
  -- ON DELETE CASCADE (confirmed live, no FK change required) -- deleting matches deletes
  -- all of it in the same transaction. This is the physical removal the previous
  -- soft-clear never performed: the old match ids stop existing, so findReusable() and
  -- every other dedup/lookup path that queries `matches` directly finds nothing.
  delete from public.matches where user_id = p_user_id;
  get diagnostics v_deleted_matches = row_count;

  -- summary_uploads is not directly FK'd to matches (only indirectly, through
  -- summary_versions.upload_id) so it does not cascade from the delete above. An upload
  -- with no summary_versions left pointing at it belonged exclusively to the cleared
  -- slate; delete it too so no orphaned uploaded-summary record survives (item 1: "0
  -- current-slate uploaded summary records").
  delete from public.summary_uploads su
   where su.user_id = p_user_id
     and not exists (select 1 from public.summary_versions sv where sv.upload_id = su.id);
  get diagnostics v_deleted_uploads = row_count;

  -- prediction_slates is the parent of matches.slate_id (ON DELETE SET NULL in that
  -- direction), so it survives the matches delete above by construction. With its matches
  -- gone it represents only the cleared operational slate, so it is deleted outright --
  -- never left behind as a "retired slate" row for the application to rediscover.
  delete from public.prediction_slates where user_id = p_user_id;
  get diagnostics v_deleted_slates = row_count;

  -- AFTER verification, against the SAME captured id arrays -- proves within this one
  -- transaction that nothing survived, rather than trusting the DELETE row counts alone.
  select jsonb_build_object(
    'matches', (select count(*) from public.matches where id = any(v_match_ids)),
    'audit_runs', (select count(*) from public.audit_runs where id = any(v_run_ids)),
    'metric_results', (select count(*) from public.metric_results where audit_run_id = any(v_run_ids)),
    'verification_results', (select count(*) from public.verification_results where audit_run_id = any(v_run_ids)),
    'disagreement_results', (select count(*) from public.disagreement_results where audit_run_id = any(v_run_ids)),
    'underdog_results', (select count(*) from public.underdog_results where audit_run_id = any(v_run_ids)),
    'stress_results', (select count(*) from public.stress_results where audit_run_id = any(v_run_ids)),
    'final_decisions', (select count(*) from public.final_decisions where audit_run_id = any(v_run_ids)),
    'audit_coverage', (select count(*) from public.audit_coverage where audit_run_id = any(v_run_ids)),
    'audit_stage_runs', (select count(*) from public.audit_stage_runs where audit_run_id = any(v_run_ids)),
    'execution_logs', (select count(*) from public.execution_logs where match_id = any(v_match_ids)),
    'result_grades', (select count(*) from public.result_grades where match_id = any(v_match_ids)),
    'match_identity_records', (select count(*) from public.match_identity_records where match_id = any(v_match_ids)),
    'summary_versions', (select count(*) from public.summary_versions where match_id = any(v_match_ids)),
    'prediction_slates', (select count(*) from public.prediction_slates where user_id = p_user_id)
  ) into v_after;

  return jsonb_build_object(
    'user_id', p_user_id,
    'match_ids', to_jsonb(v_match_ids),
    'run_ids', to_jsonb(v_run_ids),
    'before', v_before,
    'after', v_after,
    'deleted_matches', v_deleted_matches,
    'deleted_uploads', v_deleted_uploads,
    'deleted_slates', v_deleted_slates
  );
end;
$$;

revoke all on function public.clear_operational_slate(uuid) from public, anon, authenticated;
grant execute on function public.clear_operational_slate(uuid) to service_role;
