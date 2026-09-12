-- Database functions. Applied on every push; every statement is CREATE OR REPLACE, so
-- re-running is a no-op.
--
-- These are plain PostgreSQL (plpgsql / sql) functions. Nothing here is Supabase-specific,
-- which is why the move off the Supabase client changes none of them: they were always just
-- functions in the `public` schema, reached over PostgREST's /rpc/ endpoint before and
-- called directly with SELECT now.
--
-- SECURITY DEFINER is retained verbatim. Under PostgREST it was what let a low-privilege
-- browser role run a privileged body; over a direct connection the calling role already
-- owns these objects, so it is inert rather than wrong. Removing it would be a schema
-- change, and this file's job is to reproduce the schema, not to redesign it.

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

-- ---------------------------------------------------------------------------
-- Role check. Retained because `user_roles` and the app_role enum are part of the
-- schema; with no PostgREST in front of the database it no longer gates anything at
-- the row level.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$function$;

-- ---------------------------------------------------------------------------
-- Prediction slates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.active_prediction_slate()
 RETURNS prediction_slates
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select * from public.prediction_slates where retired_at is null limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_active_prediction_slate()
 RETURNS prediction_slates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare s public.prediction_slates%rowtype;
begin
  select * into s from public.prediction_slates where retired_at is null limit 1;
  if found then return s; end if;
  insert into public.prediction_slates(slate_number, label)
  values ((select coalesce(max(slate_number),0)+1 from public.prediction_slates),
          'SLATE ' || (select coalesce(max(slate_number),0)+1 from public.prediction_slates))
  returning * into s;
  return s;
end $function$;

CREATE OR REPLACE FUNCTION public.retire_active_prediction_slate(reason text DEFAULT 'CLEAR_SLATE'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare retired uuid;
begin
  update public.prediction_slates
     set retired_at = now(), retired_reason = coalesce(reason, 'CLEAR_SLATE')
   where retired_at is null
  returning id into retired;
  return retired;
end $function$;

CREATE OR REPLACE FUNCTION public.matches_assign_slate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if new.slate_id is null then
    new.slate_id := (public.ensure_active_prediction_slate()).id;
  end if;
  return new;
end $function$;

-- ---------------------------------------------------------------------------
-- Audit run leases. drive-audit-batch claims a run, heartbeats it, then releases it,
-- so two concurrent batch workers cannot process the same run.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_audit_run(p_run_id uuid, p_lease_owner text, p_lease_seconds integer DEFAULT 60)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.audit_runs
     set lease_owner = p_lease_owner,
         lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 10)),
         heartbeat_at = now(),
         updated_at = now()
   where id = p_run_id
     and status in ('RUNNING', 'COMPLETE')
     and (
       lease_owner is null
       or lease_expires_at is null
       or lease_expires_at < now()
       or lease_owner = p_lease_owner
     );
  return found;
end;
$function$;

CREATE OR REPLACE FUNCTION public.renew_audit_run_lease(p_run_id uuid, p_lease_owner text, p_lease_seconds integer DEFAULT 60)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.audit_runs
     set lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 10)),
         heartbeat_at = now(),
         updated_at = now()
   where id = p_run_id
     and status = 'RUNNING'
     and lease_owner = p_lease_owner;
  return found;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_audit_run_lease(p_run_id uuid, p_lease_owner text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.audit_runs
     set lease_owner = null,
         lease_expires_at = null,
         heartbeat_at = now(),
         updated_at = now()
   where id = p_run_id
     and lease_owner = p_lease_owner;
  return found;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Clear Slate. The single authoritative deletion path -- see reset-slate.functions.ts:
-- there must never be a second scattered DELETE reimplementing this.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_operational_slate(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$;

-- ---------------------------------------------------------------------------
-- Evidence warehouse upsert. The ON CONFLICT target is the expression index
-- metric_evidence_context_unique_idx, created in 02-constraints-indexes.sql. A plpgsql body
-- is not resolved at CREATE time, so this function creates without it -- but every CALL
-- fails until that index exists. Treat the two files as one unit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_metric_evidence_side(p_payload jsonb)
 RETURNS metric_evidence_store
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  persisted public.metric_evidence_store;
begin
  insert into public.metric_evidence_store (
    metric_code, metric_name, player_name, opponent_name, tournament, surface,
    as_of_date, treatment, value_text, reliability, sample_label,
    evidence_family, source_ids, sources, unavailable_reason, valid_until,
    updated_at
  )
  values (
    p_payload->>'metric_code', p_payload->>'metric_name',
    p_payload->>'player_name', nullif(p_payload->>'opponent_name', ''),
    nullif(p_payload->>'tournament', ''), nullif(p_payload->>'surface', ''),
    (p_payload->>'as_of_date')::date, p_payload->>'treatment',
    p_payload->>'value_text', (p_payload->>'reliability')::double precision,
    nullif(p_payload->>'sample_label', ''), nullif(p_payload->>'evidence_family', ''),
    coalesce(array(select jsonb_array_elements_text(p_payload->'source_ids')), '{}'),
    coalesce(p_payload->'sources', '[]'::jsonb),
    nullif(p_payload->>'unavailable_reason', ''),
    (p_payload->>'valid_until')::timestamptz,
    coalesce((p_payload->>'updated_at')::timestamptz, now())
  )
  on conflict (
    metric_code,
    (lower(player_name)),
    (coalesce(lower(opponent_name), '')),
    (coalesce(lower(tournament), '')),
    (coalesce(lower(surface), '')),
    as_of_date
  ) do update set
    metric_name = excluded.metric_name,
    treatment = excluded.treatment,
    value_text = excluded.value_text,
    reliability = excluded.reliability,
    sample_label = excluded.sample_label,
    evidence_family = excluded.evidence_family,
    source_ids = excluded.source_ids,
    sources = excluded.sources,
    unavailable_reason = excluded.unavailable_reason,
    valid_until = excluded.valid_until,
    updated_at = excluded.updated_at
  returning * into persisted;

  return persisted;
end;
$function$;

-- ---------------------------------------------------------------------------
-- DEAD CODE, CARRIED FORWARD DELIBERATELY.
--
-- public.consolidate_duplicate_matches() exists in the live database but references three
-- objects that no longer do: public.match_pair_key(), public.norm_match_text() and the
-- table public.match_merge_log. Calling it raises `function ... does not exist`. Nothing
-- in this application calls it -- the only RPCs the app invokes are clear_operational_slate,
-- claim_audit_run, release_audit_run_lease, renew_audit_run_lease and
-- upsert_metric_evidence_side.
--
-- It is NOT reproduced here, because a fresh database built from this file would otherwise
-- carry a function that cannot run. It is recorded here instead so the omission is a
-- decision on the record rather than something quietly lost in the migration. If it is ever
-- needed again, the three missing objects have to be restored with it.
