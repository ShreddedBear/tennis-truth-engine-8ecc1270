// Pure seeding shapes. No database access lives in this module any more -- it is imported
// by browser code, and the browser no longer has a database client of any kind. The reads
// and writes moved to audit-runs.server.ts, reached through audit-runs.functions.ts.
import { classifyMetric } from "./metric-classification";

type MetricRuleSeed = { rule_code: string; rule_name: string };

export function metricResultSeedRows(runId: string, metricRules: MetricRuleSeed[]) {
  return metricRules.map((rule) => {
    const classification = classifyMetric(rule.rule_code);
    const excluded = classification === "META_OR_NON_PLAYER";
    // MATRIX_SUMMARY_REQUIRED seeds through the identical settled path as
    // PROTECTED_UNAVAILABLE (status NO_SOURCE, treatment UNAVAILABLE, never researched),
    // differing only in the recorded reason -- this alternate creation path must stay in
    // lockstep with audit-pipeline.ts's instantiate(), or a quarantined code would seed
    // as "NOT STARTED" here and be handed to a researcher after all.
    const quarantined = classification === "MATRIX_SUMMARY_REQUIRED";
    const noSource = classification === "PROTECTED_UNAVAILABLE" || quarantined;
    const initialStatus = excluded ? "EXCLUDED" : noSource ? "NO_SOURCE" : "NOT STARTED";
    return {
      audit_run_id: runId,
      metric_code: rule.rule_code,
      metric_name: rule.rule_name,
      category: null,
      evidence_family: rule.rule_name,
      matrix_derived: false,
      status: initialStatus,
      p1_status: initialStatus,
      p2_status: initialStatus,
      p1_treatment: excluded ? "EXCLUDED" : "UNAVAILABLE",
      p2_treatment: excluded ? "EXCLUDED" : "UNAVAILABLE",
      unavailable_reason: excluded
        ? "PROCESS_META_NOT_PLAYER_EVIDENCE"
        : quarantined
          ? "MATRIX_SUMMARY_EVIDENCE_REQUIRED"
          : noSource
            ? "NO_SOURCE_NO_LEGITIMATE_PATHWAY"
            : null,
    };
  });
}
