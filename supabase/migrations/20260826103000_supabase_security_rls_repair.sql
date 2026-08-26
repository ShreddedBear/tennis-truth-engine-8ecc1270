-- Supabase security/RLS repair.
-- Security-only migration: does not alter Evidence Coverage metrics, evidence classifications,
-- identity logic, PBP logic, market logic, or coverage calculations.

begin;

-- ---------------------------------------------------------------------------
-- 1. Preserve the intended single-workspace administrator without restoring
--    anonymous access. Only auto-bootstrap when the project has exactly one
--    real auth user and no admin assignment already exists.
-- ---------------------------------------------------------------------------
do $$
declare
  only_user uuid;
  user_count bigint;
begin
  if to_regclass('public.user_roles') is not null then
    select count(*) into user_count from auth.users;
    if user_count = 1 then
      select id into only_user from auth.users limit 1;
    end if;
    if user_count = 1
       and not exists (select 1 from public.user_roles where role = 'admin'::public.app_role) then
      insert into public.user_roles(user_id, role)
      values (only_user, 'admin'::public.app_role)
      on conflict do nothing;
    end if;
  end if;
end $$;

-- SECURITY INVOKER role check. The caller can only see their own user_roles row
-- through RLS, so this helper cannot be used to bypass row security.
create or replace function public.has_role(_role public.app_role, _user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = _role
  );
$$;

revoke all on function public.has_role(public.app_role, uuid) from public, anon;
grant execute on function public.has_role(public.app_role, uuid) to authenticated, service_role;

-- user_roles is authorization state, not user-editable profile data.
alter table public.user_roles enable row level security;
revoke all on table public.user_roles from anon;
revoke insert, update, delete, truncate, references, trigger on table public.user_roles from authenticated;
grant select on table public.user_roles to authenticated;
grant all on table public.user_roles to service_role;
drop policy if exists "single user open access" on public.user_roles;
drop policy if exists "single-user open access" on public.user_roles;
drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own"
on public.user_roles for select to authenticated
using (
  (select auth.uid()) is not null
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false)
  and user_id = (select auth.uid())
);

-- ---------------------------------------------------------------------------
-- 2. Enable RLS on every ordinary public table exposed by the Data API.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.oid::regclass as rel
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')
  loop
    execute format('alter table %s enable row level security', r.rel);
  end loop;
end $$;

-- Anonymous callers get no direct public-schema table access. Authenticated
-- callers still require RLS and are never trusted by role membership alone.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Retain Data API privileges for authenticated sessions; RLS below is the
-- authorization boundary. Sensitive backend-only tables are revoked again.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- 3. Remove globally permissive policies that defeat owner/admin restrictions.
--    Preserve unrelated restrictive/owner policies.
-- ---------------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and permissive = 'PERMISSIVE'
      and (
        lower(policyname) like '%single user open access%'
        or lower(policyname) like '%single-user open access%'
        or (
          (coalesce(qual,'') in ('true','(true)') or coalesce(with_check,'') in ('true','(true)'))
          and roles && array['anon'::name,'authenticated'::name,'public'::name]
          and cmd in ('ALL','INSERT','UPDATE','DELETE')
        )
      )
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Warehouse/ingestion/evidence tables are backend-owned.
--    service_role bypasses RLS; browser roles receive no direct privileges.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'ingestion_targets',
    'metric_evidence_store',
    'source_ingestion_runs',
    'source_observations'
  ] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('grant all on table public.%I to service_role', t);
    end if;
  end loop;
end $$;

-- Internal source configuration/health and execution logs are also backend/admin
-- operational data. Authenticated admins may read them; only service_role writes.
do $$
declare t text;
begin
  foreach t in array array['source_definitions','source_health_events','execution_logs'] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('revoke all on table public.%I from anon', t);
      execute format('revoke insert, update, delete, truncate, references, trigger on table public.%I from authenticated', t);
      execute format('grant select on table public.%I to authenticated', t);
      execute format('grant all on table public.%I to service_role', t);
      execute format('drop policy if exists %I on public.%I', 'security_admin_read', t);
      execute format(
        'create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null and not coalesce(((select auth.jwt())->>''is_anonymous'')::boolean,false) and public.has_role(''admin''::public.app_role,(select auth.uid())))',
        'security_admin_read', t
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Apply owner/admin read and admin write policy to user-owned application
--    tables. Existing owner policies remain; these policies never grant anon.
--    The user_id default preserves existing authenticated inserts that omit it.
-- ---------------------------------------------------------------------------
do $$
declare r record;
declare real_user text := '(select auth.uid()) is not null and not coalesce(((select auth.jwt())->>''is_anonymous'')::boolean,false)';
declare admin_expr text := 'public.has_role(''admin''::public.app_role,(select auth.uid()))';
begin
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
    where n.nspname = 'public'
      and c.relkind in ('r','p')
      and c.relname not in ('user_roles','source_observations','metric_evidence_store')
  loop
    -- Preserve direct authenticated inserts by binding omitted user_id to the caller.
    if exists (
      select 1 from pg_attribute a2
      where a2.attrelid = format('public.%I', r.table_name)::regclass
        and a2.attname='user_id'
        and a2.atttypid='uuid'::regtype
    ) then
      execute format('alter table public.%I alter column user_id set default auth.uid()', r.table_name);
    end if;

    execute format('drop policy if exists %I on public.%I', 'security_owner_admin_select', r.table_name);
    execute format('drop policy if exists %I on public.%I', 'security_admin_insert', r.table_name);
    execute format('drop policy if exists %I on public.%I', 'security_admin_update', r.table_name);
    execute format('drop policy if exists %I on public.%I', 'security_admin_delete', r.table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using (%s and (user_id=(select auth.uid()) or %s))',
      'security_owner_admin_select', r.table_name, real_user, admin_expr
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (%s and %s)',
      'security_admin_insert', r.table_name, real_user, admin_expr
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (%s and %s) with check (%s and %s)',
      'security_admin_update', r.table_name, real_user, admin_expr, real_user, admin_expr
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (%s and %s)',
      'security_admin_delete', r.table_name, real_user, admin_expr
    );
  end loop;
end $$;

-- Tables without user ownership semantics: authenticated admin read only;
-- service_role remains the mutation path. Sensitive backend-only tables excluded.
do $$
declare r record;
begin
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public'
      and c.relkind in ('r','p')
      and not exists (
        select 1 from pg_attribute a
        where a.attrelid=c.oid and a.attname='user_id' and not a.attisdropped
      )
      and c.relname not in ('ingestion_targets','source_ingestion_runs')
  loop
    execute format('revoke all on table public.%I from anon', r.table_name);
    execute format('revoke insert, update, delete, truncate, references, trigger on table public.%I from authenticated', r.table_name);
    execute format('grant select on table public.%I to authenticated', r.table_name);
    execute format('grant all on table public.%I to service_role', r.table_name);
    execute format('drop policy if exists %I on public.%I', 'security_admin_read', r.table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null and not coalesce(((select auth.jwt())->>''is_anonymous'')::boolean,false) and public.has_role(''admin''::public.app_role,(select auth.uid())))',
      'security_admin_read', r.table_name
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. override_records: owner may manage only non-admin overrides; admin may
--    manage all overrides. This prevents requires_admin bypass.
-- ---------------------------------------------------------------------------
alter table public.override_records enable row level security;
revoke all on table public.override_records from anon;
grant select, insert, update, delete on table public.override_records to authenticated;
grant all on table public.override_records to service_role;

drop policy if exists "security_owner_admin_select" on public.override_records;
drop policy if exists "security_admin_insert" on public.override_records;
drop policy if exists "security_admin_update" on public.override_records;
drop policy if exists "security_admin_delete" on public.override_records;
drop policy if exists "override_owner_or_admin_select" on public.override_records;
drop policy if exists "override_owner_or_admin_insert" on public.override_records;
drop policy if exists "override_owner_or_admin_update" on public.override_records;
drop policy if exists "override_owner_or_admin_delete" on public.override_records;

create policy "override_owner_or_admin_select"
on public.override_records for select to authenticated
using (
  (select auth.uid()) is not null
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and (user_id=(select auth.uid()) or public.has_role('admin'::public.app_role,(select auth.uid())))
);
create policy "override_owner_or_admin_insert"
on public.override_records for insert to authenticated
with check (
  (select auth.uid()) is not null
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and (
    (user_id=(select auth.uid()) and requires_admin=false)
    or public.has_role('admin'::public.app_role,(select auth.uid()))
  )
);
create policy "override_owner_or_admin_update"
on public.override_records for update to authenticated
using (
  (select auth.uid()) is not null
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and (
    (user_id=(select auth.uid()) and requires_admin=false)
    or public.has_role('admin'::public.app_role,(select auth.uid()))
  )
)
with check (
  (select auth.uid()) is not null
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and (
    (user_id=(select auth.uid()) and requires_admin=false)
    or public.has_role('admin'::public.app_role,(select auth.uid()))
  )
);
create policy "override_owner_or_admin_delete"
on public.override_records for delete to authenticated
using (
  (select auth.uid()) is not null
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and (
    (user_id=(select auth.uid()) and requires_admin=false)
    or public.has_role('admin'::public.app_role,(select auth.uid()))
  )
);

-- ---------------------------------------------------------------------------
-- 7. Private database backup bucket. No public/ordinary-user access.
--    Authenticated administrators may explicitly manage objects; service_role
--    retains its normal bypass for backup automation.
-- ---------------------------------------------------------------------------
update storage.buckets
set public = false
where id = 'database_export_26_08_26';

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and (
        lower(policyname) like '%database_export_26_08_26%'
        or coalesce(qual,'') ilike '%database_export_26_08_26%'
        or coalesce(with_check,'') ilike '%database_export_26_08_26%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
  end loop;
end $$;

drop policy if exists "db_backup_admin_select" on storage.objects;
drop policy if exists "db_backup_admin_insert" on storage.objects;
drop policy if exists "db_backup_admin_update" on storage.objects;
drop policy if exists "db_backup_admin_delete" on storage.objects;

create policy "db_backup_admin_select"
on storage.objects for select to authenticated
using (
  bucket_id='database_export_26_08_26'
  and (select auth.uid()) is not null
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and public.has_role('admin'::public.app_role,(select auth.uid()))
);
create policy "db_backup_admin_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id='database_export_26_08_26'
  and (select auth.uid()) is not null
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and public.has_role('admin'::public.app_role,(select auth.uid()))
);
create policy "db_backup_admin_update"
on storage.objects for update to authenticated
using (
  bucket_id='database_export_26_08_26'
  and (select auth.uid()) is not null
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and public.has_role('admin'::public.app_role,(select auth.uid()))
)
with check (
  bucket_id='database_export_26_08_26'
  and (select auth.uid()) is not null
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and public.has_role('admin'::public.app_role,(select auth.uid()))
);
create policy "db_backup_admin_delete"
on storage.objects for delete to authenticated
using (
  bucket_id='database_export_26_08_26'
  and (select auth.uid()) is not null
  and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)
  and public.has_role('admin'::public.app_role,(select auth.uid()))
);

-- ---------------------------------------------------------------------------
-- 8. SECURITY DEFINER hardening.
--    has_role is now INVOKER. All remaining app SECURITY DEFINER routines in
--    public are removed from PUBLIC/anon/authenticated execution and reserved
--    for service_role. Safe search_path prevents object-shadowing attacks.
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as proc,
           n.nspname,
           p.proname,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.proc);
    execute format('grant execute on function %s to service_role', f.proc);
    execute format('alter function %s set search_path = pg_catalog, public', f.proc);
  end loop;
end $$;

-- Explicitly protect the known destructive maintenance function even if its
-- definition is absent in an environment that skipped the dedupe migration.
do $$
begin
  if to_regprocedure('public.consolidate_duplicate_matches()') is not null then
    revoke all on function public.consolidate_duplicate_matches() from public, anon, authenticated;
    grant execute on function public.consolidate_duplicate_matches() to service_role;
    alter function public.consolidate_duplicate_matches() set search_path = pg_catalog, public;
  end if;
end $$;

commit;
