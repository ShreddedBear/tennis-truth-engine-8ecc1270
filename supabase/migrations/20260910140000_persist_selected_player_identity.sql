-- PERSIST THE SELECTED PLAYER AS AN IDENTITY, NOT A DISPLAY STRING.
--
-- Two columns, one of which already exists live with nothing writing it.
--
-- 1. audit_runs.independent_winner_side.
--    The deterministic conclusion produces a SIDE ("P1"/"P2") and a name. commitConclusion
--    persisted only the name, so the side -- the one unambiguous link from the decision to a
--    row on `matches` -- was discarded at the moment of commit. Everything downstream then
--    had to guess it back from a display name. Recording it costs one column and removes the
--    guessing entirely.
--
--    Nullable on purpose: the 28 winners already committed in production predate this column
--    and legitimately have no side stored. They are resolved through the documented legacy
--    path (recover the side by matching the committed name against the match's own two
--    names) rather than being rewritten here -- this migration does not touch existing rows.
--
-- 2. final_decisions.selected_player_id.
--    This column ALREADY EXISTS in the live database with no migration in this repo and no
--    application code referencing it anywhere (0 of 60 rows populated). `add column if not
--    exists` brings migration history back in sync with what is live without altering the
--    already-populated table -- the same situation, and the same remedy, as prediction_slates
--    in 20260905050000_hard_delete_clear_slate.sql.
--
-- NOTHING HERE CHANGES WHO IS SELECTED. No threshold, no metric, no family rule and no colour
-- rule is touched by this migration or by the code that fills these columns.

alter table public.audit_runs
  add column if not exists independent_winner_side text
  check (independent_winner_side is null or independent_winner_side in ('P1','P2'));

comment on column public.audit_runs.independent_winner_side is
  'P1/P2 side of the committed deterministic winner, from the same conclusion that set independent_winner. Null for runs committed before this column existed.';

alter table public.final_decisions
  add column if not exists selected_player_id uuid;

comment on column public.final_decisions.selected_player_id is
  'matches.player1_id or matches.player2_id for the selected side. Null when the match carries no canonical player ids -- never fabricated, and never an id belonging to any other match.';

create index if not exists final_decisions_selected_player_id_idx
  on public.final_decisions(selected_player_id) where selected_player_id is not null;
