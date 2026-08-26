-- Evidence Coverage Repair: query hot-path indexes.
--
-- The evidence readers intentionally use exact/canonical + fail-closed legacy
-- aliases via PostgREST `.in(...)`. The original warehouse indexes are on
-- lower(player_name), which PostgreSQL cannot use for exact player_name IN
-- predicates. On a large source_observations warehouse this turns every audit
-- evidence lookup into a broad scan and can make the runtime diagnostic/audit
-- time out before otherwise-available evidence is credited.
--
-- These indexes do not change ingestion, source selection, OIDC, or any data.
-- They only make existing read paths indexable.

create index if not exists source_observations_player_date_exact_idx
  on public.source_observations (player_name, event_date desc);

create index if not exists source_observations_pair_date_exact_idx
  on public.source_observations (player_name, opponent_name, event_date desc);

create index if not exists source_observations_shared_date_idx
  on public.source_observations (event_date desc)
  where player_name is null;

create index if not exists source_observations_market_pair_date_idx
  on public.source_observations (
    source_id,
    observation_type,
    player_name,
    opponent_name,
    event_date desc
  );

create index if not exists metric_evidence_pair_date_exact_idx
  on public.metric_evidence_store (
    as_of_date,
    metric_code,
    player_name,
    opponent_name
  );
