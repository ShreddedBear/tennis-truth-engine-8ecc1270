-- Configuration for source-specific historical hard pulls.
create table if not exists public.ingestion_targets (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  target_key text not null,
  enabled boolean not null default true,
  pullback_start date null,
  pullback_end date null,
  latitude double precision null,
  longitude double precision null,
  timezone text null,
  tournament text null,
  sport_key text null,
  config jsonb not null default '{}'::jsonb,
  last_ingested_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id,target_key)
);

create index if not exists ingestion_targets_source_idx
  on public.ingestion_targets(source_id,enabled);

-- Adapters assign deterministic source_record_key values, so retries are idempotent.
create unique index if not exists source_observations_source_record_unique_idx
  on public.source_observations(source_id, source_record_key);

comment on table public.ingestion_targets is 'Configured historical hard-pull jobs/venues/sports. Adapters consume these rows and write source_observations.';
