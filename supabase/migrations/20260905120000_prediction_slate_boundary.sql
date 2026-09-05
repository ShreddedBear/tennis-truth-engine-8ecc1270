-- PREDICTION SLATE BOUNDARY
--
-- THE BUG THIS FIXES. Clear Slate deactivated summary_versions and invalidated each match's
-- latest audit_run, but left the `matches` rows themselves untouched -- and upload.tsx's
-- dedupe (findReusable) searches `matches` GLOBALLY by canonical_key. Re-uploading the same
-- PDF therefore matched the cleared slate's own match rows and reported
-- "0 new matches, 50 existing matches reused": the new slate inherited the retired slate's
-- match_id, and with it every prediction record hanging off that id (audit_runs,
-- metric_results, verification/disagreement/underdog/stress results, final_decisions,
-- coverage). A cleared slate was never actually isolated.
--
-- THE FIX. A prediction slate becomes a first-class row, and every match belongs to exactly
-- one. Clear Slate RETIRES the active slate; the next ingest lands in a new one. Dedupe is
-- scoped to the active slate, so the same fixture uploaded into Slate B creates a fresh
-- match instance rather than reviving Slate A's.
--
-- WHAT IS DELIBERATELY NOT TOUCHED. This partitions PREDICTION records only. Global
-- reference data -- players, tournaments, metric_registry, metric_evidence_store,
-- source_observations, rules/rule documents, calibration_versions/buckets and the runtime
-- tennis index -- has no slate and is never cleared, retired or duplicated by any of this.
-- A player is the same player in every slate; their previous prediction evidence is not.

create table if not exists public.prediction_slates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,
  slate_number integer not null,
  label text,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  retired_reason text
);

-- AT MOST ONE ACTIVE SLATE, enforced by the database rather than by convention. The index
-- key is a constant over the "not retired" subset, so a second un-retired slate cannot be
-- inserted even by a concurrent writer.
create unique index if not exists prediction_slates_single_active
  on public.prediction_slates ((true)) where retired_at is null;
create unique index if not exists prediction_slates_number_unique
  on public.prediction_slates (slate_number);

grant select on public.prediction_slates to anon, authenticated;
grant all on public.prediction_slates to service_role;
alter table public.prediction_slates enable row level security;
drop policy if exists "single user open access" on public.prediction_slates;
create policy "single user open access" on public.prediction_slates for all to anon, authenticated using (true) with check (true);

alter table public.matches add column if not exists slate_id uuid references public.prediction_slates(id) on delete set null;
create index if not exists matches_slate_id_idx on public.matches(slate_id);

-- ------------------------------------------------------------------------------------
-- SLATE LIFECYCLE
-- ------------------------------------------------------------------------------------

create or replace function public.active_prediction_slate()
returns public.prediction_slates language sql stable security definer set search_path=public as $$
  select * from public.prediction_slates where retired_at is null limit 1;
$$;

-- Creates the active slate only when there is none. Called by the ingest trigger below, so
-- the very first upload after a Clear Slate opens the next slate automatically -- there is
-- no window in which a match can be written with no slate at all.
create or replace function public.ensure_active_prediction_slate()
returns public.prediction_slates language plpgsql security definer set search_path=public as $$
declare s public.prediction_slates%rowtype;
begin
  select * into s from public.prediction_slates where retired_at is null limit 1;
  if found then return s; end if;
  insert into public.prediction_slates(slate_number, label)
  values ((select coalesce(max(slate_number),0)+1 from public.prediction_slates),
          'SLATE ' || (select coalesce(max(slate_number),0)+1 from public.prediction_slates))
  returning * into s;
  return s;
end $$;

-- Clear Slate's database half. Retiring is a state change, never a delete: the retired
-- slate's matches, runs and evidence stay on disk and stay auditable -- they simply stop
-- being the current slate, and can never again be reused by an upload.
create or replace function public.retire_active_prediction_slate(reason text default 'CLEAR_SLATE')
returns uuid language plpgsql security definer set search_path=public as $$
declare retired uuid;
begin
  update public.prediction_slates
     set retired_at = now(), retired_reason = coalesce(reason, 'CLEAR_SLATE')
   where retired_at is null
  returning id into retired;
  return retired;
end $$;

grant execute on function public.active_prediction_slate() to anon, authenticated, service_role;
grant execute on function public.ensure_active_prediction_slate() to anon, authenticated, service_role;
grant execute on function public.retire_active_prediction_slate(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------------
-- BACKFILL: everything that exists today is one legacy slate, kept active so the current
-- operational view is unchanged by this migration.
-- ------------------------------------------------------------------------------------
do $$
declare s uuid;
begin
  if exists (select 1 from public.matches where slate_id is null) then
    select id into s from public.prediction_slates where retired_at is null limit 1;
    if s is null then
      insert into public.prediction_slates(slate_number, label)
      values ((select coalesce(max(slate_number),0)+1 from public.prediction_slates), 'SLATE 1 (pre-boundary backfill)')
      returning id into s;
    end if;
    update public.matches set slate_id = s where slate_id is null;
  end if;
end $$;

-- Every match written from now on carries a slate, whichever code path inserts it. This is
-- what makes the boundary an invariant of the data rather than a rule the UI remembers.
create or replace function public.matches_assign_slate()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.slate_id is null then
    new.slate_id := (public.ensure_active_prediction_slate()).id;
  end if;
  return new;
end $$;

drop trigger if exists matches_assign_slate_trg on public.matches;
create trigger matches_assign_slate_trg before insert on public.matches
for each row execute function public.matches_assign_slate();

-- ------------------------------------------------------------------------------------
-- DEDUPE SCOPE. The canonical key is unique WITHIN a slate, not globally: the same fixture
-- appearing in a later slate is a new prediction instance, not a duplicate to collapse into
-- the retired one. This is the index whose global form made "50 existing matches reused"
-- structurally unavoidable.
-- ------------------------------------------------------------------------------------
drop index if exists public.matches_canonical_key_unique_nonblank;
create unique index if not exists matches_slate_canonical_key_unique_nonblank
  on public.matches(slate_id, canonical_key)
  where canonical_key is not null and btrim(canonical_key) <> '';

-- THE SECOND global rule, and the one production actually enforced. It was found by running
-- the re-upload live rather than by reading this file: with the dedupe query fixed but this
-- index still spanning every slate, re-uploading the same PDF failed outright on
-- "duplicate key value violates unique constraint matches_user_canonical" instead of
-- creating the fresh prediction instances. Same fix, same reason: one fixture may appear
-- once per slate.
drop index if exists public.matches_user_canonical;
create unique index if not exists matches_user_slate_canonical
  on public.matches (user_id, slate_id, canonical_key);

-- The historical duplicate consolidator must respect the same boundary: merging a Slate B
-- match into its Slate A twin would re-create exactly the leak this migration closes.
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
      and a.slate_id is not distinct from b.slate_id
      and (a.scheduled_date is null or b.scheduled_date is null or a.scheduled_date=b.scheduled_date)
      and (a.tournament_name is null or b.tournament_name is null or public.norm_match_text(a.tournament_name)=public.norm_match_text(b.tournament_name))
      and (a.round is null or b.round is null or public.norm_match_text(a.round)=public.norm_match_text(b.round))
      and (a.surface is null or b.surface is null or public.norm_match_text(a.surface)=public.norm_match_text(b.surface))
  loop
    select * into k from public.matches where id=r.aid;
    select * into d from public.matches where id=r.bid;
    if k.id is null or d.id is null then continue; end if;
    if ((d.tournament_name is not null)::int+(d.round is not null)::int+(d.scheduled_date is not null)::int+(d.surface is not null)::int+(d.best_of is not null)::int) >
       ((k.tournament_name is not null)::int+(k.round is not null)::int+(k.scheduled_date is not null)::int+(k.surface is not null)::int+(k.best_of is not null)::int) then
      k:=d; select * into d from public.matches where id=r.aid;
    end if;
    insert into public.match_merge_log(keeper_match_id,merged_match_id,reason,snapshot)
    values(k.id,d.id,'same normalized player pair with compatible context, same prediction slate',to_jsonb(d)) on conflict(merged_match_id) do nothing;
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
