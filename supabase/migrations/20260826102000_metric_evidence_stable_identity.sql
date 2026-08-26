-- Persist canonical stable player identifiers alongside display names so
-- Evidence Coverage can retrieve reusable evidence before falling back to
-- legacy name/alias matching. Text is intentional: the canonical directory
-- is the authority for identifier semantics and older deployments may use
-- non-UUID source identifiers.

alter table if exists public.metric_evidence_store
  add column if not exists player_stable_id text null,
  add column if not exists opponent_stable_id text null;

create index if not exists metric_evidence_stable_pair_lookup_idx
  on public.metric_evidence_store (
    metric_code,
    player_stable_id,
    opponent_stable_id,
    as_of_date desc
  )
  where player_stable_id is not null;

comment on column public.metric_evidence_store.player_stable_id is
  'Canonical players.id captured when evidence is persisted; preferred over display-name lookup.';
comment on column public.metric_evidence_store.opponent_stable_id is
  'Canonical opponent players.id captured when evidence is persisted; preferred over display-name lookup.';
