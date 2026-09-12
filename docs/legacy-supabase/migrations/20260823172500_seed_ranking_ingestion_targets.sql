-- Official ATP/WTA ranking targets. Current snapshots are dated with pullback_end;
-- additional historical/archive targets can be added without changing adapter code.
insert into public.ingestion_targets (source_id, target_key, enabled, pullback_start, pullback_end, config)
values
  (
    'atp_rankings',
    'atp_singles_rankings',
    true,
    (current_date - interval '2 years')::date,
    current_date,
    jsonb_build_object(
      'url', 'https://www.atptour.com/en/rankings/singles',
      'kind', 'ranking_history',
      'tour', 'ATP'
    )
  ),
  (
    'wta_rankings',
    'wta_singles_rankings',
    true,
    (current_date - interval '2 years')::date,
    current_date,
    jsonb_build_object(
      'url', 'https://www.wtatennis.com/rankings/singles',
      'kind', 'ranking_history',
      'tour', 'WTA'
    )
  )
on conflict (source_id, target_key) do update set
  enabled = excluded.enabled,
  pullback_start = excluded.pullback_start,
  pullback_end = excluded.pullback_end,
  config = excluded.config,
  updated_at = now();
