\set ON_ERROR_STOP on

-- Fails closed when any original vulnerability class remains.
do $$
declare detail text;
begin
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by c.relname)
  into detail
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity;
  if detail is not null then
    raise exception 'RLS disabled in public: %', detail;
  end if;
end $$;

do $$
declare detail text;
begin
  select string_agg(format('%I.%I:%I', schemaname,tablename,policyname), ', ' order by tablename,policyname)
  into detail
  from pg_policies
  where schemaname='public'
    and permissive='PERMISSIVE'
    and roles && array['anon'::name,'authenticated'::name,'public'::name]
    and cmd in ('ALL','INSERT','UPDATE','DELETE')
    and (coalesce(qual,'') in ('true','(true)') or coalesce(with_check,'') in ('true','(true)'));
  if detail is not null then
    raise exception 'Always-true client write policies remain: %', detail;
  end if;
end $$;

do $$
declare t text; role_name text; privilege text; leaks text[] := '{}';
begin
  foreach t in array array['ingestion_targets','metric_evidence_store','source_ingestion_runs','source_observations'] loop
    foreach role_name in array array['anon','authenticated'] loop
      foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
        if to_regclass(format('public.%I',t)) is not null
           and has_table_privilege(role_name, format('public.%I',t), privilege) then
          leaks := array_append(leaks, role_name||':'||t||':'||privilege);
        end if;
      end loop;
    end loop;
  end loop;
  if cardinality(leaks)>0 then
    raise exception 'Backend-only table privilege leak: %', array_to_string(leaks, ', ');
  end if;
end $$;

do $$
declare detail text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
  into detail
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and (
      has_function_privilege('PUBLIC', p.oid, 'EXECUTE')
      or has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );
  if detail is not null then
    raise exception 'Client-executable SECURITY DEFINER functions remain: %', detail;
  end if;
end $$;

do $$
declare is_public boolean; policy_count int; unsafe int;
begin
  select public into is_public from storage.buckets where id='database_export_26_08_26';
  if is_public is distinct from false then
    raise exception 'database_export_26_08_26 is missing or public';
  end if;

  select count(*) into policy_count from pg_policies
  where schemaname='storage' and tablename='objects' and policyname like 'db_backup_admin_%';
  if policy_count <> 4 then
    raise exception 'Expected 4 explicit backup policies, found %', policy_count;
  end if;

  select count(*) into unsafe from pg_policies
  where schemaname='storage' and tablename='objects'
    and roles && array['anon'::name,'public'::name]
    and (coalesce(qual,'') ilike '%database_export_26_08_26%' or coalesce(with_check,'') ilike '%database_export_26_08_26%');
  if unsafe <> 0 then
    raise exception 'Anonymous/public backup bucket policy remains';
  end if;
end $$;

do $$
declare unsafe int;
begin
  select count(*) into unsafe
  from pg_policies
  where schemaname='public' and tablename='override_records'
    and roles && array['anon'::name,'public'::name];
  if unsafe <> 0 then
    raise exception 'override_records still has anonymous/public policies';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='override_records'
      and policyname='override_owner_or_admin_update'
      and coalesce(qual,'') ilike '%requires_admin%'
      and coalesce(with_check,'') ilike '%requires_admin%'
  ) then
    raise exception 'override_records requires_admin update boundary missing';
  end if;
end $$;

-- Service-role grants required by Evidence Coverage and ingestion.
do $$
declare t text; privilege text; missing text[] := '{}';
begin
  foreach t in array array['ingestion_targets','metric_evidence_store','source_ingestion_runs','source_observations'] loop
    foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if to_regclass(format('public.%I',t)) is not null
         and not has_table_privilege('service_role', format('public.%I',t), privilege) then
        missing := array_append(missing, t||':'||privilege);
      end if;
    end loop;
  end loop;
  if cardinality(missing)>0 then
    raise exception 'Required service_role privilege missing: %', array_to_string(missing, ', ');
  end if;
end $$;

-- Machine-readable inventory for the final report.
select 'RLS_TABLES' as section,
       json_agg(json_build_object('table',c.relname,'rls',c.relrowsecurity) order by c.relname) as result
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p');

select 'POLICIES' as section,
       json_agg(json_build_object('table',tablename,'policy',policyname,'cmd',cmd,'roles',roles,'qual',qual,'with_check',with_check) order by tablename,policyname) as result
from pg_policies where schemaname in ('public','storage');

select 'SECURITY_DEFINER' as section,
       coalesce(json_agg(json_build_object('function',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'config',p.proconfig) order by p.oid::regprocedure::text),'[]'::json) as result
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef;

select 'WAREHOUSE_COUNTS' as section,
       json_build_object(
         'source_observations',(select count(*) from public.source_observations),
         'metric_evidence_store',(select count(*) from public.metric_evidence_store),
         'ingestion_targets',(select count(*) from public.ingestion_targets),
         'source_ingestion_runs',(select count(*) from public.source_ingestion_runs)
       ) as result;
