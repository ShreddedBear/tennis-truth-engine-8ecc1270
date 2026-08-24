-- Ensure the exact ON CONFLICT target used by tour ingestion exists in production.
-- Safe to run repeatedly.
create unique index if not exists source_observations_source_record_unique_idx
  on public.source_observations(source_id, source_record_key);
