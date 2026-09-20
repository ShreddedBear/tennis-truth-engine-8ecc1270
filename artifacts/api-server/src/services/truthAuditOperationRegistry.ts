export const AUDIT_OPERATION_HANDLERS = new Set([
  "audit-active-version", "audit-rules", "audit-running-runs", "audit-latest-run",
  "audit-create-run", "audit-get-match", "audit-update-match", "audit-parsed-fields",
  "audit-update-run", "audit-claim-lease", "audit-renew-lease", "audit-release-lease",
  "audit-list-results", "audit-insert-results", "audit-update-result", "audit-stages",
  "audit-set-stage", "audit-save-identity", "audit-save-snapshots", "audit-save-conflicts",
  "audit-calibration", "audit-decision-id", "audit-save-decision", "audit-conflicts",
  "audit-reconstructions", "audit-save-coverage", "audit-save-coverage-rates",
  "audit-verify-final-persistence", "audit-log",
]);