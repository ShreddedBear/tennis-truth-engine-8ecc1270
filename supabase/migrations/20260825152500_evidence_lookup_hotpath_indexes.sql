-- Evidence Coverage Repair: query hot-path indexes.
-- These indexes only accelerate existing evidence reads; they do not change ingestion or source selection.

create index if not exists source_observations_player_date_exact_idx
  on public.source_observations (player_name, event_date desc);

create index if not exists source_observations_pair_date_exact_idx
  on public.source_observations (player_name, opponent_name, event_date desc);

create index if not exists source_observations_shared_date_idx
  on public.source_observations (event_date desc)
  where player_name is null;

create index if not exists source_observations_market_pair_date_idx
  on public.source_observations (source_id, observation_type, player_name, opponent_name, event_date desc);

create index if not exists metric_evidence_pair_date_exact_idx
  on public.metric_evidence_store (as_of_date, metric_code, player_name, opponent_name);
