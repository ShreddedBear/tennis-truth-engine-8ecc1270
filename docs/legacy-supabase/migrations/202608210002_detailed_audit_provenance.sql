-- Preserve row-level evidence and failure provenance for every audit result.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
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
    $sql$, table_name);
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
