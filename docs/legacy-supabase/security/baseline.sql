select json_build_object(
  'public_rls_disabled', (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity
  ),
  'source_observations', (select count(*) from public.source_observations),
  'metric_evidence_store', (select count(*) from public.metric_evidence_store),
  'ingestion_targets', (select count(*) from public.ingestion_targets),
  'source_ingestion_runs', (select count(*) from public.source_ingestion_runs)
) as baseline;
