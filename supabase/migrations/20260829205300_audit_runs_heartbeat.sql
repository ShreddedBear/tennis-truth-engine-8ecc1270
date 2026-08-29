-- Audit Pipeline error log: repeated failures creating audit runs with
--   "Could not find the 'heartbeat_at' column of 'audit_runs' in the schema cache"
--
-- audit_runs has no liveness signal for a run sitting in status = 'RUNNING':
-- the only recovery path today is bootstrap.ts's rule-version invalidation
-- sweep, which never fires for a run that just silently stalled mid-stage
-- (the exact "stuck at RUNNING" failure mode fixed for the exception path in
-- the "Fix stale Lovable Cloud copy and stage-stuck-at-RUNNING pipeline bug"
-- commit). Add heartbeat_at so createAuditRun/runPipeline can stamp it on
-- every stage transition, giving a real signal for detecting a run that has
-- gone quiet versus one that is genuinely still working.

alter table public.audit_runs
  add column if not exists heartbeat_at timestamptz;

update public.audit_runs
  set heartbeat_at = coalesce(updated_at, created_at, now())
  where heartbeat_at is null;
