import { supabase } from "@/integrations/supabase/client";
import { STRESS_TESTS, UNDERDOG_PATHWAYS } from "./constants";
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

async function activeVersionId(docType: string) {
  const { data, error } = await supabase
    .from("rule_documents")
    .select("id, active_version_id, doc_type")
    .eq("doc_type", docType)
    .maybeSingle();
  if (error) throw new Error(`Could not load active ${docType} definitions: ${error.message}`);
  return data?.active_version_id ?? null;
}

async function rulesFor(versionId: string | null) {
  if (!versionId) return [];
  const { data, error } = await supabase
    .from("rules")
    .select("id, rule_code, rule_name, severity, blocking, mapping_status")
    .eq("version_id", versionId)
    .order("rule_code");
  if (error) throw new Error(`Could not load rules for ${versionId}: ${error.message}`);
  return data ?? [];
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
  const { error } = await supabase.from("execution_logs").insert({
    audit_run_id: entry.audit_run_id ?? null,
    match_id: entry.match_id ?? null,
    stage: entry.stage,
    status: entry.status,
    rule_code: entry.rule_code ?? null,
    player_side: entry.player_side ?? null,
    output: (entry.output ?? null) as never,
    matrix_visible: entry.matrix_visible ?? false,
  });
  if (error) throw new Error(`Could not persist execution log: ${error.message}`);
}

export async function createAuditRun(matchId: string) {
  const [verId, disId, metId] = await Promise.all([
    activeVersionId("VERIFICATION"),
    activeVersionId("DISAGREEMENT"),
    activeVersionId("METRICS"),
  ]);

  const { data: prior, error: priorError } = await supabase
    .from("audit_runs")
    .select("run_number")
    .eq("match_id", matchId)
    .order("run_number", { ascending: false })
    .limit(1);
  if (priorError) throw new Error(`Could not read prior audit runs: ${priorError.message}`);

  const { data: run, error } = await supabase
    .from("audit_runs")
    .insert({
      match_id: matchId,
      run_number: (prior?.[0]?.run_number ?? 0) + 1,
      research_lock_at: new Date().toISOString(),
      verification_version_id: verId,
      disagreement_version_id: disId,
      metrics_version_id: metId,
      status: "RUNNING",
    })
    .select()
    .single();
  if (error || !run) throw error ?? new Error("Could not create audit run");

  const [metricRules, verRules, disRules] = await Promise.all([rulesFor(metId), rulesFor(verId), rulesFor(disId)]);

  const chunked = async <T,>(label: string, rows: T[], insert: (batch: T[]) => PromiseLike<unknown>) => {
    for (let i = 0; i < rows.length; i += 200) {
      const result = await insert(rows.slice(i, i + 200));
      const insertError = (result as { error?: { message?: string } | null } | null)?.error;
      if (insertError) throw new Error(`Could not seed ${label}: ${insertError.message ?? "database insert failed"}`);
    }
  };

  await chunked(
    "metric results",
    metricResultSeedRows(run.id, metricRules),
    (batch) => supabase.from("metric_results").insert(batch),
  );

  await chunked(
    "verification results",
    verRules.map((r) => ({
      audit_run_id: run.id,
      rule_id: r.id,
      rule_code: r.rule_code,
      rule_name: r.rule_name,
      severity: r.severity,
      status: "NOT STARTED",
      outcome: "NOT STARTED",
    })),
    (batch) => supabase.from("verification_results").insert(batch),
  );

  await chunked(
    "disagreement results",
    disRules.map((r) => ({
      audit_run_id: run.id,
      rule_id: r.id,
      rule_code: r.rule_code,
      rule_name: r.rule_name,
      status: "NOT STARTED",
    })),
    (batch) => supabase.from("disagreement_results").insert(batch),
  );

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("player1_name, player2_name")
    .eq("id", matchId)
    .single();
  if (matchError) throw new Error(`Could not load match identity: ${matchError.message}`);

  const sides = [match?.player1_name ?? "Player 1", match?.player2_name ?? "Player 2"];
  const { error: underdogError } = await supabase.from("underdog_results").insert(
    sides.flatMap((side) =>
      UNDERDOG_PATHWAYS.map(([code, name]) => ({
        audit_run_id: run.id,
        pathway_code: code,
        pathway_name: name,
        player_side: side,
        classification: "UNRESOLVED",
        status: "NOT STARTED",
      })),
    ),
  );
  if (underdogError) throw new Error(`Could not seed underdog results: ${underdogError.message}`);

  const { error: stressError } = await supabase.from("stress_results").insert(
    STRESS_TESTS.map(([code, name]) => ({
      audit_run_id: run.id,
      test_code: code,
      test_name: name,
      status: "NOT STARTED",
      outcome: "NOT STARTED",
    })),
  );
  if (stressError) throw new Error(`Could not seed stress results: ${stressError.message}`);

  await log({
    audit_run_id: run.id,
    match_id: matchId,
    stage: "PRE-MATCH RESEARCH LOCK",
    status: "COMPLETE",
    output: { metrics: metricRules.length, verification: verRules.length, disagreement: disRules.length },
  });

  return run;
}
