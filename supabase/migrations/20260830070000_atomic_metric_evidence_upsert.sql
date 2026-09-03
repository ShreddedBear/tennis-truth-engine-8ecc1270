create or replace function public.upsert_metric_evidence_side(p_payload jsonb)
returns public.metric_evidence_store
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.upsert_metric_evidence_side(jsonb) from public;
grant execute on function public.upsert_metric_evidence_side(jsonb) to service_role;