-- truth_engine_calibration_observations exists live (user_id, match_id, audit_run_id,
-- slate_id, selected_player, actual_winner, evidence_support_percent, family/verification/
-- disagreement/underdog/stress fields, calibration_eligible) with zero rows, no foreign key
-- constraints, and no application code reading or writing it -- found only while
-- regenerating this migration's own TypeScript types, from work outside this repository's
-- history. Its column shape is unambiguously slate-scoped calibration data derived from
-- operational predictions (exactly item 1's "0 current-slate calibration observations
-- created from those operational runs"), so clear_operational_slate() must delete its rows
-- for the cleared user regardless of which effort populates it later. Scoped by user_id,
-- the same way summary_uploads is, since there is no FK to lean on.
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
  v_deleted_calibration_observations integer;
begin
  perform pg_advisory_xact_lock(hashtext('clear_operational_slate:' || p_user_id::text));

  select coalesce(array_agg(id), '{}') into v_match_ids from public.matches where user_id = p_user_id;
  select coalesce(array_agg(id), '{}') into v_run_ids from public.audit_runs where match_id = any(v_match_ids);

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
    'truth_engine_calibration_observations', (select count(*) from public.truth_engine_calibration_observations where user_id = p_user_id),
    'prediction_slates', (select count(*) from public.prediction_slates where user_id = p_user_id)
  ) into v_before;

  delete from public.matches where user_id = p_user_id;
  get diagnostics v_deleted_matches = row_count;

  delete from public.summary_uploads su
   where su.user_id = p_user_id
     and not exists (select 1 from public.summary_versions sv where sv.upload_id = su.id);
  get diagnostics v_deleted_uploads = row_count;

  delete from public.truth_engine_calibration_observations where user_id = p_user_id;
  get diagnostics v_deleted_calibration_observations = row_count;

  delete from public.prediction_slates where user_id = p_user_id;
  get diagnostics v_deleted_slates = row_count;

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
    'truth_engine_calibration_observations', (select count(*) from public.truth_engine_calibration_observations where user_id = p_user_id),
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
    'deleted_slates', v_deleted_slates,
    'deleted_calibration_observations', v_deleted_calibration_observations
  );
end;
$$;

revoke all on function public.clear_operational_slate(uuid) from public, anon, authenticated;
grant execute on function public.clear_operational_slate(uuid) to service_role;
