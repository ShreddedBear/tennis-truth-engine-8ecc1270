-- Initial official tour targets for results/scheduling ingestion.
-- These targets persist provenance from the official tour pages and can later
-- be expanded with year-specific/archive URLs without changing adapter code.

insert into public.ingestion_targets (source_id, target_key, enabled, pullback_start, config)
values
  (
    'atp',
    'atp_current_scores',
    true,
    (current_date - interval '12 months')::date,
    jsonb_build_object(
      'url', 'https://www.atptour.com/en/scores/current',
      'kind', 'results_schedule',
      'tour', 'ATP'
    )
  ),
  (
    'wta',
    'wta_tournaments',
    true,
    (current_date - interval '12 months')::date,
    jsonb_build_object(
      'url', 'https://www.wtatennis.com/tournaments',
      'kind', 'results_schedule',
      'tour', 'WTA'
    )
  ),
  (
    'atp_challenger',
    'atp_challenger_current_scores',
    true,
    (current_date - interval '12 months')::date,
    jsonb_build_object(
      'url', 'https://www.atptour.com/en/scores/current',
      'kind', 'results_schedule',
      'tour', 'ATP Challenger',
      'filter_level', 'Challenger'
    )
  )
on conflict (source_id, target_key) do update set
  enabled = excluded.enabled,
  pullback_start = excluded.pullback_start,
  config = excluded.config,
  updated_at = now();
