-- Triggers. Dropped and recreated so the file is idempotent (CREATE TRIGGER has no
-- OR REPLACE before PostgreSQL 14, and DROP IF EXISTS works everywhere).

drop trigger if exists matches_updated on public.matches;
create trigger matches_updated before update on public.matches
  for each row execute function public.update_updated_at_column();

drop trigger if exists audit_runs_updated on public.audit_runs;
create trigger audit_runs_updated before update on public.audit_runs
  for each row execute function public.update_updated_at_column();

drop trigger if exists audit_stage_runs_updated on public.audit_stage_runs;
create trigger audit_stage_runs_updated before update on public.audit_stage_runs
  for each row execute function public.update_updated_at_column();

drop trigger if exists final_decisions_updated on public.final_decisions;
create trigger final_decisions_updated before update on public.final_decisions
  for each row execute function public.update_updated_at_column();

drop trigger if exists result_grades_updated on public.result_grades;
create trigger result_grades_updated before update on public.result_grades
  for each row execute function public.update_updated_at_column();

drop trigger if exists autopsies_updated on public.autopsies;
create trigger autopsies_updated before update on public.autopsies
  for each row execute function public.update_updated_at_column();

-- Every match belongs to a prediction slate. This trigger is what makes that true without
-- every insert path having to remember it.
drop trigger if exists matches_assign_slate_trg on public.matches;
create trigger matches_assign_slate_trg before insert on public.matches
  for each row execute function public.matches_assign_slate();
