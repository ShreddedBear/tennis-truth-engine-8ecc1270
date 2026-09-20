import { STRESS_TESTS, UNDERDOG_PATHWAYS } from "./constants";
import { classifyMetric } from "./metric-classification";
import { truthServerOperation } from "./truth-server-api";

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

async function activeVersionId(docType: string) {
  const result = await truthServerOperation<{ activeVersionId: string | null }>("audit-active-version", { docType });
  return result.activeVersionId;
}

async function rulesFor(versionId: string | null) {
  if (!versionId) return [];
  const result = await truthServerOperation<{ rules: MetricRuleSeed[] }>("audit-rules", { versionId });
  return result.rules;
}

export async function log(entry: {
  audit_run_id?: string | null;
  match_id?: string | null;
  stage: string;
  status: string;
  rule_code?: string | null;
  player_side?: string | null;
  output?: unknown;
  matrix_visible?: boolean;
}) {
  await truthServerOperation("audit-log", entry);
}

export async function createAuditRun(matchId: string) {
  const [verificationVersionId, disagreementVersionId, metricsVersionId] = await Promise.all([
    activeVersionId("VERIFICATION"),
    activeVersionId("DISAGREEMENT"),
    activeVersionId("METRICS"),
  ]);
  const [metricRules, verificationRules, disagreementRules] = await Promise.all([
    rulesFor(metricsVersionId),
    rulesFor(verificationVersionId),
    rulesFor(disagreementVersionId),
  ]);
  // The API operation owns this entire seed transaction. Keeping the seed
  // arrays here makes the classification contract testable and versioned.
  return truthServerOperation("audit-create-run", {
    matchId,
    metricSeeds: metricResultSeedRows("pending", metricRules),
    verificationSeeds: verificationRules,
    disagreementSeeds: disagreementRules,
    underdogPathways: UNDERDOG_PATHWAYS,
    stressTests: STRESS_TESTS,
  });
}
