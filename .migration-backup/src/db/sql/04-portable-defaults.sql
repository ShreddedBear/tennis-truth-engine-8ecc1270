-- Makes the schema runnable on ANY PostgreSQL server, not only a Supabase-hosted one.
--
-- Forty columns across the schema carried this default:
--
--     COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)
--
-- `auth.uid()` is a Supabase function that reads the caller's JWT out of a GUC. It only
-- exists because the Supabase platform creates an `auth` schema. On a plain PostgreSQL
-- server -- Neon, RDS, Railway, a local container -- that function does not exist, and
-- every INSERT that omits user_id fails with `schema "auth" does not exist`.
--
-- The application no longer sends a JWT at all: it connects as a database role over
-- DATABASE_URL. auth.uid() is therefore NULL on every call even on Supabase, and the
-- COALESCE has been collapsing to the second branch for the whole life of the deployment
-- (production holds zero auth.users). So this is not a behaviour change -- it replaces an
-- expression that always evaluated to the constant with the constant itself.
--
-- The value is LOCAL_WORKSPACE_ID from src/lib/constants.ts. It must stay in step with it.
do $$
declare
  r record;
  local_workspace constant text := '00000000-0000-0000-0000-000000000001';
begin
  for r in
    select c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema
       and t.table_name = c.table_name
       and t.table_type = 'BASE TABLE'
     where c.table_schema = 'public'
       and c.column_default like '%auth.uid()%'
  loop
    execute format(
      'alter table public.%I alter column %I set default %L::uuid',
      r.table_name, r.column_name, local_workspace
    );
    raise notice 'portable default: public.%.% -> %', r.table_name, r.column_name, local_workspace;
  end loop;
end $$;
