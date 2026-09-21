-- Database-level immutability for frozen evaluation holdout populations.
--
-- Recovered directly from the live database's own catalog (pg_get_functiondef /
-- pg_get_triggerdef against heliumdb's evaluation_holdout_populations and
-- evaluation_holdout_members triggers), not reconstructed from filenames or
-- descriptions. The base logic below (the evaluation_holdout_members guard, and
-- the controlled finalized=false -> true transition) is exactly what was found
-- live. The one change from what was found live is the fix described below.
--
-- Idempotent (CREATE OR REPLACE / DROP + CREATE) so it can be re-applied safely on
-- every push, matching this file's sibling sql/immutability-trigger.sql.
--
-- FIX applied here (the one verified gap): the live trigger on
-- evaluation_holdout_populations fired only on BEFORE DELETE OR UPDATE, so a
-- privileged direct SQL writer could INSERT a row with finalized=true, bypassing
-- the controlled false->true transition entirely (which requires exactly 9
-- existing members and unchanged immutable metadata). The trigger now also fires
-- on BEFORE INSERT, and the function explicitly permits INSERT only when
-- NEW.finalized = false; an INSERT with finalized = true falls through to the
-- existing final RAISE EXCEPTION, same as every other disallowed mutation.
-- Everything else (member immutability, the false->true transition's exact
-- metadata/9-member check, DELETE/UPDATE rejection) is unchanged from what the
-- live database's own catalog reports right now.
CREATE OR REPLACE FUNCTION reject_evaluation_holdout_freeze_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'evaluation_holdout_members' THEN
    IF (TG_OP = 'INSERT' AND EXISTS (
          SELECT 1 FROM evaluation_holdout_populations
          WHERE id = NEW.population_id AND finalized
        ))
       OR (TG_OP = 'DELETE' AND EXISTS (
          SELECT 1 FROM evaluation_holdout_populations
          WHERE id = OLD.population_id AND finalized
        ))
       OR (TG_OP = 'UPDATE' AND EXISTS (
          SELECT 1 FROM evaluation_holdout_populations
          WHERE id IN (OLD.population_id, NEW.population_id) AND finalized
        )) THEN
      RAISE EXCEPTION 'finalized evaluation holdout members are immutable';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Fix: a freshly-created population must start unfinalized. Only this explicit
  -- case is permitted for INSERT; INSERT with finalized = true falls through to
  -- the same final RAISE EXCEPTION as every other disallowed mutation below.
  IF TG_OP = 'INSERT' AND NEW.finalized = false THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.finalized = false
     AND NEW.finalized = true
     AND OLD.id = NEW.id
     AND OLD.window_from = NEW.window_from
     AND OLD.window_to = NEW.window_to
     AND OLD.candidate_fingerprint = NEW.candidate_fingerprint
     AND OLD.eligible_fingerprint = NEW.eligible_fingerprint
     AND OLD.candidate_count = NEW.candidate_count
     AND OLD.eligible_count = NEW.eligible_count
     AND OLD.provenance = NEW.provenance
     AND (SELECT count(*) FROM evaluation_holdout_members WHERE population_id = OLD.id) = 9
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'evaluation holdout populations are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS evaluation_holdout_populations_immutable ON evaluation_holdout_populations;

CREATE TRIGGER evaluation_holdout_populations_immutable
  BEFORE INSERT OR DELETE OR UPDATE ON evaluation_holdout_populations
  FOR EACH ROW
  EXECUTE FUNCTION reject_evaluation_holdout_freeze_mutation();

DROP TRIGGER IF EXISTS evaluation_holdout_members_immutable ON evaluation_holdout_members;

CREATE TRIGGER evaluation_holdout_members_immutable
  BEFORE INSERT OR DELETE OR UPDATE ON evaluation_holdout_members
  FOR EACH ROW
  EXECUTE FUNCTION reject_evaluation_holdout_freeze_mutation();
