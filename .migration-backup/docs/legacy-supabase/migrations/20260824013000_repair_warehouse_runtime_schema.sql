-- Runtime repair migration for warehouse-first evidence.
-- Re-declares the warehouse tables and indexes idempotently so environments
-- that missed the original 20260823115200/20260823120500 migrations can recover.

create table if not exists public.source_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  source_id text not null,
  source_name text not null,
  source_url text null,
  source_record_key text null,
  player_name text null,
  opponent_name text null,
  tournament text null,
  event_date date null,
  surface text null,
  observation_type text not null,
  observation_key text not null,
  numeric_value double precision null,
  text_value text null,
  unit text null,
  sample_label text null,
  window_start date null,
  window_end date null,
  retrieved_at timestamptz not null default now(),
  source_published_at timestamptz null,
  raw_payload jsonb null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.metric_evidence_store (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  metric_code text not null,
  metric_name text not null,
  player_name text not null,
  opponent_name text null,
  tournament text null,
  surface text null,
  as_of_date date not null,
  treatment text not null check (treatment in ('DIRECT','RECONSTRUCTED','PARTIAL','UNAVAILABLE','EXCLUDED')),
  value_text text null,
  reliability double precision null,
  sample_label text null,
  evidence_family text null,
  source_ids text[] not null default '{}',
  sources jsonb not null default '[]'::jsonb,
  input_observation_ids uuid[] not null default '{}',
  formula text null,
  unavailable_reason text null,
  valid_from date null,
  valid_until timestamptz null,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.source_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  job_type text not null,
  requested_window_start date null,
  requested_window_end date null,
  status text not null default 'QUEUED' check (status in ('QUEUED','RUNNING','COMPLETE','PARTIAL','FAILED')),
  records_seen integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

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

create index if not exists source_observations_player_idx on public.source_observations (lower(player_name), observation_key, event_date desc);
create index if not exists source_observations_source_idx on public.source_observations (source_id, retrieved_at desc);
create unique index if not exists source_observations_dedupe_idx on public.source_observations (
  source_id, coalesce(source_record_key,''), coalesce(lower(player_name),''), observation_key,
  coalesce(event_date,'1900-01-01'::date), coalesce(text_value,''), coalesce(numeric_value,-9.223372036854776e18)
);
create unique index if not exists source_observations_source_record_unique_idx on public.source_observations(source_id, source_record_key);
create index if not exists metric_evidence_lookup_idx on public.metric_evidence_store (metric_code, lower(player_name), as_of_date desc);
create index if not exists metric_evidence_expiry_idx on public.metric_evidence_store (valid_until);
create unique index if not exists metric_evidence_context_unique_idx on public.metric_evidence_store (
  metric_code, lower(player_name), coalesce(lower(opponent_name),''), coalesce(lower(tournament),''), coalesce(lower(surface),''), as_of_date
);
create index if not exists ingestion_targets_source_idx on public.ingestion_targets(source_id, enabled);

comment on table public.source_observations is 'Hard-pulled source observations used by the warehouse-first audit runtime.';
comment on table public.metric_evidence_store is 'Reusable metric evidence derived from admissible source observations.';
comment on table public.source_ingestion_runs is 'Tracks historical/current hard-pull ingestion jobs and coverage.';
comment on table public.ingestion_targets is 'Configured historical hard-pull jobs consumed by ingestion adapters.';
