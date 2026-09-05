-- THE SECOND global rule, and the one production actually enforced. It was found by running
-- the re-upload live rather than by reading this file: with the dedupe query fixed but this
-- index still spanning every slate, re-uploading the same PDF failed outright on
-- "duplicate key value violates unique constraint matches_user_canonical" instead of
-- creating the fresh prediction instances. Same fix, same reason: one fixture may appear
-- once per slate.
drop index if exists public.matches_user_canonical;
create unique index if not exists matches_user_slate_canonical
  on public.matches (user_id, slate_id, canonical_key);
