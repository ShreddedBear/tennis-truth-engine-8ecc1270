-- Durable ownership for audit execution.  A lease is deliberately on the run
-- rather than in browser memory so a second tab, a retry, or Active Slate
-- cannot execute the same provider work concurrently.
alter table public.audit_runs
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists heartbeat_at timestamptz;

alter table public.audit_stage_runs
  add column if not exists heartbeat_at timestamptz;

create index if not exists audit_runs_active_lease_idx
  on public.audit_runs(status, lease_expires_at)
  where status = 'RUNNING';

create unique index if not exists audit_runs_match_run_number_idx
  on public.audit_runs(match_id, run_number);

create or replace function public.claim_audit_run(
  p_run_id uuid,
  p_lease_owner text,
  p_lease_seconds integer default 60
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.audit_runs
     set lease_owner = p_lease_owner,
         lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 10)),
         heartbeat_at = now(),
         updated_at = now()
   where id = p_run_id
     and status in ('RUNNING', 'COMPLETE')
     and (
       lease_owner is null
       or lease_expires_at is null
       or lease_expires_at < now()
       or lease_owner = p_lease_owner
     );
  return found;
end;
$$;

revoke all on function public.claim_audit_run(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.claim_audit_run(uuid, text, integer) to service_role;

create or replace function public.renew_audit_run_lease(
  p_run_id uuid,
  p_lease_owner text,
  p_lease_seconds integer default 60
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.audit_runs
     set lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 10)),
         heartbeat_at = now(),
         updated_at = now()
   where id = p_run_id
     and status = 'RUNNING'
     and lease_owner = p_lease_owner;
  return found;
end;
$$;

revoke all on function public.renew_audit_run_lease(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.renew_audit_run_lease(uuid, text, integer) to service_role;

create or replace function public.release_audit_run_lease(
  p_run_id uuid,
  p_lease_owner text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.audit_runs
     set lease_owner = null,
         lease_expires_at = null,
         heartbeat_at = now(),
         updated_at = now()
   where id = p_run_id
     and lease_owner = p_lease_owner;
  return found;
end;
$$;

revoke all on function public.release_audit_run_lease(uuid, text) from public, anon, authenticated;
grant execute on function public.release_audit_run_lease(uuid, text) to service_role;