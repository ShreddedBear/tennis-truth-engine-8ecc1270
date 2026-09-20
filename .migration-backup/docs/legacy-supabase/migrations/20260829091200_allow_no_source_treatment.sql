-- Definition Instantiation was failing every run with:
--   "null value in column "p1_treatment" of relation "metric_results"
--   violates not-null constraint"
--
-- Root cause: audit-pipeline.ts's instantiate() stage inserts a placeholder
-- metric_results row per rule code. For a code with a genuine PROTECTED_UNAVAILABLE
-- classification it settles the row immediately with treatment = 'NO_SOURCE'
-- (see metric-classification.ts / audit-pipeline.ts). But the check constraints
-- added in 202608210001_metric_treatments_registry_coverage.sql /
-- 20260821195118_d3fb29dd-ae89-4826-ae35-5fde0824966f.sql only ever allowed
-- ('DIRECT','RECONSTRUCTED','PARTIAL','UNAVAILABLE','EXCLUDED') -- 'NO_SOURCE' was
-- added to the application's Treatment type after those migrations shipped and no
-- migration ever widened the constraint to match, so every insert containing a
-- NO_SOURCE-classified code failed and the whole batch insert was rejected.
--
-- Drop and recreate the p1_treatment/p2_treatment/treatment check constraints (by
-- introspecting pg_constraint rather than assuming Postgres's default auto-generated
-- name, since that name was never pinned in the migrations that created them) to
-- also allow 'NO_SOURCE'.

do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass::text as table_name, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.metric_results'::regclass, 'public.metric_coverage_rates'::regclass)
      and pg_get_constraintdef(oid) ilike '%DIRECT%RECONSTRUCTED%PARTIAL%UNAVAILABLE%EXCLUDED%'
  loop
    execute format('alter table %s drop constraint %I', c.table_name, c.conname);
  end loop;
end $$;

alter table public.metric_results
  add constraint metric_results_p1_treatment_check
    check (p1_treatment in ('DIRECT', 'RECONSTRUCTED', 'PARTIAL', 'UNAVAILABLE', 'EXCLUDED', 'NO_SOURCE')),
  add constraint metric_results_p2_treatment_check
    check (p2_treatment in ('DIRECT', 'RECONSTRUCTED', 'PARTIAL', 'UNAVAILABLE', 'EXCLUDED', 'NO_SOURCE'));

alter table public.metric_coverage_rates
  add constraint metric_coverage_rates_treatment_check
    check (treatment in ('DIRECT', 'RECONSTRUCTED', 'PARTIAL', 'UNAVAILABLE', 'EXCLUDED', 'NO_SOURCE'));
