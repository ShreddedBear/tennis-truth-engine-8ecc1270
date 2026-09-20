-- Safely consolidate duplicate physical-match records without deleting audit evidence.
-- Conservative by design: only rows with the same normalized player pair and
-- compatible known context are merged. Conflicting non-null context is never merged.

create or replace function public.norm_match_text(v text)
returns text language sql immutable as $$
  select trim(regexp_replace(lower(coalesce(v,'')), '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function public.match_pair_key(p1 text,p2 text)
returns text language sql immutable as $$
  select case when public.norm_match_text(p1) <= public.norm_match_text(p2)
    then public.norm_match_text(p1)||'|'||public.norm_match_text(p2)
    else public.norm_match_text(p2)||'|'||public.norm_match_text(p1) end;
$$;

create table if not exists public.match_merge_log (
  id uuid primary key default gen_random_uuid(),
  keeper_match_id uuid not null,
  merged_match_id uuid not null,
  reason text not null,
  snapshot jsonb not null default '{}'::jsonb,
  merged_at timestamptz not null default now(),
  unique(merged_match_id)
);

grant select on public.match_merge_log to anon, authenticated;
grant all on public.match_merge_log to service_role;
alter table public.match_merge_log enable row level security;
drop policy if exists "single user read match merge log" on public.match_merge_log;
create policy "single user read match merge log" on public.match_merge_log for select to anon, authenticated using (true);

create or replace function public.consolidate_duplicate_matches()
returns table(keeper_match_id uuid, merged_match_id uuid)
language plpgsql security definer set search_path=public as $$
declare
  r record; k public.matches%rowtype; d public.matches%rowtype;
begin
  for r in
    select a.id as aid,b.id as bid
    from public.matches a join public.matches b on a.id < b.id
    where public.match_pair_key(a.player1_name,a.player2_name)=public.match_pair_key(b.player1_name,b.player2_name)
      and (a.scheduled_date is null or b.scheduled_date is null or a.scheduled_date=b.scheduled_date)
      and (a.tournament_name is null or b.tournament_name is null or public.norm_match_text(a.tournament_name)=public.norm_match_text(b.tournament_name))
      and (a.round is null or b.round is null or public.norm_match_text(a.round)=public.norm_match_text(b.round))
      and (a.surface is null or b.surface is null or public.norm_match_text(a.surface)=public.norm_match_text(b.surface))
  loop
    select * into k from public.matches where id=r.aid;
    select * into d from public.matches where id=r.bid;
    if k.id is null or d.id is null then continue; end if;
    -- Keep the richer row; ties keep the older row for stable IDs.
    if ((d.tournament_name is not null)::int+(d.round is not null)::int+(d.scheduled_date is not null)::int+(d.surface is not null)::int+(d.best_of is not null)::int) >
       ((k.tournament_name is not null)::int+(k.round is not null)::int+(k.scheduled_date is not null)::int+(k.surface is not null)::int+(k.best_of is not null)::int) then
      k:=d; select * into d from public.matches where id=r.aid;
    end if;
    insert into public.match_merge_log(keeper_match_id,merged_match_id,reason,snapshot)
    values(k.id,d.id,'same normalized player pair with compatible context',to_jsonb(d)) on conflict(merged_match_id) do nothing;
    -- Repoint every known child relation before deleting the duplicate.
    update public.audit_runs set match_id=k.id where match_id=d.id;
    update public.summary_versions set match_id=k.id where match_id=d.id;
    update public.matches set
      tournament_name=coalesce(k.tournament_name,d.tournament_name), event_level=coalesce(k.event_level,d.event_level),
      round=coalesce(k.round,d.round), scheduled_date=coalesce(k.scheduled_date,d.scheduled_date), surface=coalesce(k.surface,d.surface),
      best_of=coalesce(k.best_of,d.best_of), identity_status=coalesce(k.identity_status,d.identity_status), surface_status=coalesce(k.surface_status,d.surface_status)
    where id=k.id;
    delete from public.matches where id=d.id;
    keeper_match_id:=k.id; merged_match_id:=d.id; return next;
  end loop;
end $$;

-- Future-ingest guard: exact canonical keys must be unique once historical exact duplicates are resolved.
create unique index if not exists matches_canonical_key_unique_nonblank
on public.matches(canonical_key) where canonical_key is not null and btrim(canonical_key)<>'';
