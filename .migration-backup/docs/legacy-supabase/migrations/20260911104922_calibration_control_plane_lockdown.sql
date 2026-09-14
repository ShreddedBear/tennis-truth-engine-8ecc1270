-- CALIBRATION CONTROL PLANE — service_role writes only (security only).
--
-- 20260911090000_decision_table_write_lockdown.sql kept anon INSERT/UPDATE on
-- calibration_ledger, calibration_versions and calibration_buckets because a live browser
-- path wrote them (calibration.tsx -> gradeResult, and bootstrap.ts's first-run seeder).
-- That left a second browser-writable surface over the calibration record: the ledger the
-- engine learns from, the bucket win-rates it reads, and the flag that decides which
-- version is active. Forging any of them steers future calibrated ranges without touching
-- a decision row.
--
-- All three are now read-only to the browser. Writes are service_role, which is what the
-- calibration pipeline already uses: the scheduled capture-match-results workflow,
-- calibration-population.server.ts and truth-engine-calibration.ts all run under
-- supabaseAdmin.
--
-- KNOWN, INTENDED CONSEQUENCES:
--  * calibration.tsx's gradeResult() can no longer write from the browser. It fails on its
--    FIRST write (the calibration_versions insert), so it cannot leave a half-applied state
--    -- a new version with buckets but no ledger row. Grading belongs to the scheduled
--    server-side path; this removes the duplicate.
--  * bootstrap.ts's ensureCalibration() seeder is likewise server-side only now. It already
--    short-circuits when a calibration_versions row exists, and production holds one, so
--    this is a no-op there; a FRESH environment must seed calibration server-side.
--
-- Additive and non-destructive: no row is inserted, updated or deleted.

begin;

do $$
declare
  t text;
  calibration text[] := array['calibration_ledger','calibration_versions','calibration_buckets'];
begin
  foreach t in array calibration loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke insert, update, delete, truncate, references, trigger on table public.%I from anon, authenticated', t);
      execute format('grant select on table public.%I to anon, authenticated', t);
      execute format('grant all on table public.%I to service_role', t);
      execute format('drop policy if exists %I on public.%I', 'browser_write', t);
      execute format('drop policy if exists %I on public.%I', 'browser_modify', t);
      execute format('drop policy if exists %I on public.%I', 'browser_read', t);
      execute format('create policy %I on public.%I for select to anon, authenticated using (true)', 'browser_read', t);
    end if;
  end loop;
end $$;

commit;
