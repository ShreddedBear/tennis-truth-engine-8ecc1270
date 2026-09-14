alter table public.metric_results
  add column if not exists p1_treatment text not null default 'UNAVAILABLE'
    check (p1_treatment in ('DIRECT', 'RECONSTRUCTED', 'PARTIAL', 'UNAVAILABLE', 'EXCLUDED')),
  add column if not exists p2_treatment text not null default 'UNAVAILABLE'
    check (p2_treatment in ('DIRECT', 'RECONSTRUCTED', 'PARTIAL', 'UNAVAILABLE', 'EXCLUDED'));

update public.metric_results
set p1_treatment = case when p1_status = 'COMPLETE' then 'DIRECT' else 'UNAVAILABLE' end,
    p2_treatment = case when p2_status = 'COMPLETE' then 'DIRECT' else 'UNAVAILABLE' end;

alter table public.reconstruction_results
  add column if not exists calculation text,
  add column if not exists source_refs jsonb not null default '[]'::jsonb;

create table if not exists public.metric_registry (
  id uuid primary key default gen_random_uuid(),
  metric_code text not null unique,
  metric_name text not null,
  lifecycle_status text not null default 'ACTIVE'
    check (lifecycle_status in ('ACTIVE', 'REVIEW FOR RETIREMENT', 'RETIRED')),
  tour_eligibility text[] not null default '{}',
  evidence_family text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid
);

create table if not exists public.audit_coverage (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null references public.audit_runs(id) on delete cascade,
  player_side text not null check (player_side in ('P1', 'P2')),
  direct_count integer not null default 0,
  reconstructed_count integer not null default 0,
  partial_count integer not null default 0,
  unavailable_count integer not null default 0,
  excluded_count integer not null default 0,
  total_count integer not null default 0,
  usable_coverage_percent numeric(5,1) not null default 0,
  execution_completion_percent numeric(5,1) not null default 0,
  recorded_at timestamptz not null default now(),
  user_id uuid,
  unique (audit_run_id, player_side)
);

create table if not exists public.metric_coverage_rates (
  id uuid primary key default gen_random_uuid(),
  metric_code text not null references public.metric_registry(metric_code),
  player_side text not null check (player_side in ('P1', 'P2')),
  treatment text not null check (treatment in ('DIRECT', 'RECONSTRUCTED', 'PARTIAL', 'UNAVAILABLE', 'EXCLUDED')),
  audit_run_id uuid not null references public.audit_runs(id) on delete cascade,
  usable boolean not null default false,
  recorded_at timestamptz not null default now(),
  user_id uuid,
  unique (metric_code, player_side, audit_run_id)
);

create index if not exists metric_coverage_rates_metric_idx on public.metric_coverage_rates(metric_code, player_side);
create index if not exists audit_coverage_run_idx on public.audit_coverage(audit_run_id);

grant select, insert, update, delete on public.metric_registry to authenticated;
grant select, insert, update, delete on public.audit_coverage to authenticated;
grant select, insert, update, delete on public.metric_coverage_rates to authenticated;
grant all on public.metric_registry to service_role;
grant all on public.audit_coverage to service_role;
grant all on public.metric_coverage_rates to service_role;

alter table public.metric_registry enable row level security;
alter table public.audit_coverage enable row level security;
alter table public.metric_coverage_rates enable row level security;

create policy "single user open access" on public.metric_registry for all to anon, authenticated using (true) with check (true);
create policy "single user open access" on public.audit_coverage for all to anon, authenticated using (true) with check (true);
create policy "single user open access" on public.metric_coverage_rates for all to anon, authenticated using (true) with check (true);

do $$
declare
  t text;
begin
  foreach t in array array[
    'metric_results',
    'verification_results',
    'disagreement_results',
    'underdog_results',
    'stress_results'
  ] loop
    execute format($sql$
      alter table public.%I
        add column if not exists unavailable_reason text,
        add column if not exists unavailable_detail text,
        add column if not exists provider_error text,
        add column if not exists sources jsonb not null default '[]'::jsonb,
        add column if not exists missing_inputs jsonb not null default '[]'::jsonb,
        add column if not exists source_attempts jsonb not null default '[]'::jsonb,
        add column if not exists reconstruction_attempted boolean not null default false,
        add column if not exists reconstruction_reason text,
        add column if not exists reconstruction_result text,
        add column if not exists retrieved_at timestamptz;
    $sql$, t);
  end loop;
end $$;

alter table public.reconstruction_results
  add column if not exists unavailable_reason text,
  add column if not exists provider_error text,
  add column if not exists missing_inputs jsonb not null default '[]'::jsonb,
  add column if not exists source_attempts jsonb not null default '[]'::jsonb,
  add column if not exists reconstruction_attempted boolean not null default true,
  add column if not exists reconstruction_reason text,
  add column if not exists reconstruction_result text,
  add column if not exists retrieved_at timestamptz;

alter table public.metric_results
  add column if not exists p1_unavailable_reason text,
  add column if not exists p2_unavailable_reason text,
  add column if not exists p1_provider_error text,
  add column if not exists p2_provider_error text,
  add column if not exists p1_retrieved_at timestamptz,
  add column if not exists p2_retrieved_at timestamptz;