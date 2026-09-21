-- Database-level backstop for "immutable" on parlay_builder_version_manifests and
-- parlay_builder_lineage_audit.
--
-- Application code (builderVersioning.ts's insertBuilderVersionManifest /
-- recordBuilderLineageAudit) never updates or deletes a row in either table -- a new
-- Builder version is always a NEW row, and closing out the previously-open manifest's
-- effectiveTo happens via one INSERT + one UPDATE inside the SAME transaction that opens
-- the new row (the one legitimate mutation this trigger must still allow). This trigger
-- makes both tables structurally append-only at the DB layer too, so no code path --
-- present or future -- can silently rewrite a historical Builder version or lineage
-- verdict after the fact.
--
-- The one exception, mirrored from evaluation_holdout_populations' own immutability
-- trigger: closing the currently-open manifest row (effective_to IS NULL -> a concrete
-- timestamp) is the single UPDATE this trigger permits, and only that column may change.
-- Every other UPDATE, and every DELETE, is rejected outright.
--
-- Idempotent (CREATE OR REPLACE / DROP + CREATE) so it can be re-applied safely on every
-- push.

CREATE OR REPLACE FUNCTION parlay_builder_version_manifests_prevent_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'parlay_builder_version_manifests row % is immutable and cannot be deleted', OLD.id;
  END IF;

  -- Only permitted UPDATE: closing an open row's effective_to (NULL -> timestamp), with
  -- every other column unchanged. Re-opening (timestamp -> NULL) or touching any other
  -- column is rejected.
  IF OLD.effective_to IS NOT NULL
     OR NEW.effective_to IS NULL
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
     OR NEW.algorithm_config IS DISTINCT FROM OLD.algorithm_config
     OR NEW.calibration_model_id IS DISTINCT FROM OLD.calibration_model_id
     OR NEW.optimizer_run_id IS DISTINCT FROM OLD.optimizer_run_id
     OR NEW.source_commit IS DISTINCT FROM OLD.source_commit
     OR NEW.config_fingerprint IS DISTINCT FROM OLD.config_fingerprint
     OR NEW.reconstruction_method IS DISTINCT FROM OLD.reconstruction_method
     OR NEW.confidence IS DISTINCT FROM OLD.confidence
     OR NEW.provenance IS DISTINCT FROM OLD.provenance
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION
      'parlay_builder_version_manifests row % is immutable; only closing effective_to (NULL -> timestamp) is permitted',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parlay_builder_version_manifests_immutable ON parlay_builder_version_manifests;

CREATE TRIGGER parlay_builder_version_manifests_immutable
  BEFORE UPDATE OR DELETE ON parlay_builder_version_manifests
  FOR EACH ROW
  EXECUTE FUNCTION parlay_builder_version_manifests_prevent_mutation();

-- parlay_builder_lineage_audit is pure append-only: no mutation is ever legitimate, not
-- even the "close the open row" exception above.

CREATE OR REPLACE FUNCTION parlay_builder_lineage_audit_prevent_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'parlay_builder_lineage_audit row % is append-only and cannot be modified or deleted',
    COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parlay_builder_lineage_audit_immutable ON parlay_builder_lineage_audit;

CREATE TRIGGER parlay_builder_lineage_audit_immutable
  BEFORE UPDATE OR DELETE ON parlay_builder_lineage_audit
  FOR EACH ROW
  EXECUTE FUNCTION parlay_builder_lineage_audit_prevent_mutation();
