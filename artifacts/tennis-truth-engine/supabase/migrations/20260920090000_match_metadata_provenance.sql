alter table public.matches
  add column if not exists metadata_provenance jsonb not null default '{}'::jsonb;

comment on column public.matches.metadata_provenance is
  'Field-keyed source, method, status, and direct/derived provenance for tournament metadata.';

create or replace function public.refresh_match_metadata_provenance()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_match_id uuid;
begin
  select match_id into target_match_id
  from public.summary_versions
  where id = new.summary_version_id;

  if new.field_key = '__metadata_provenance' and new.normalized_value is not null then
    update public.matches
    set metadata_provenance = new.normalized_value::jsonb
    where id = target_match_id;
    return new;
  end if;

  if new.field_key in ('tournament', 'event_level', 'round', 'scheduled_date', 'surface', 'best_of') then
    update public.matches
    set metadata_provenance = coalesce(metadata_provenance, '{}'::jsonb) || jsonb_build_object(
      new.field_key,
      jsonb_build_object(
        'source', case when new.extraction_status = 'RECONSTRUCTED' then 'match context resolver' else 'OCR review field' end,
        'method', case when new.extraction_status = 'RECONSTRUCTED' then 'LOCAL_OR_PROVIDER_RESOLUTION' else 'OCR' end,
        'status', case when new.extraction_status = 'RECONSTRUCTED' then 'DERIVED' else new.extraction_status end,
        'direct', new.extraction_status = 'DIRECT'
      )
    )
    where id = target_match_id;
  end if;
  return new;
end;
$$;

drop trigger if exists parsed_summary_metadata_provenance on public.parsed_summary_fields;
create trigger parsed_summary_metadata_provenance
after insert or update of normalized_value, extraction_status
on public.parsed_summary_fields
for each row execute function public.refresh_match_metadata_provenance();