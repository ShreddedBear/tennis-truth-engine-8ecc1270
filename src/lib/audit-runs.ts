import { supabase } from "@/integrations/supabase/client";
import { STRESS_TESTS, UNDERDOG_PATHWAYS } from "./constants";

async function activeVersionId(docType: string) {
  const { data } = await supabase
    .from("rule_documents")
    .select("id, active_version_id, doc_type")
    .eq("doc_type", docType)
    .maybeSingle();
  return data?.active_version_id ?? null;
}

async function rulesFor(versionId: string | null) {
  if (!versionId) return [];
  const { data } = await supabase
    .from("rules")
    .select("id, rule_code, rule_name, severity, blocking, mapping_status")
    .eq("version_id", versionId)
    .order("rule_code");
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
  await supabase.from("execution_logs").insert({
    audit_run_id: entry.audit_run_id ?? null,
    match_id: entry.match_id ?? null,
    stage: entry.stage,
    status: entry.status,
    rule_code: entry.rule_code ?? null,
    player_side: entry.player_side ?? null,
    output: (entry.output ?? null) as never,
    matrix_visible: entry.matrix_visible ?? false,
  });
}

export async function createAuditRun(matchId: string) {
  const [verId, disId, metId] = await Promise.all([
    activeVersionId("VERIFICATION"),
    activeVersionId("DISAGREEMENT"),
    activeVersionId("METRICS"),
  ]);

  const { data: prior } = await supabase
    .from("audit_runs")
    .select("run_number")
    .eq("match_id", matchId)
    .order("run_number", { ascending: false })
    .limit(1);

  const { data: run, error } = await supabase
    .from("audit_runs")
    .insert({
      match_id: matchId,
      run_number: (prior?.[0]?.run_number ?? 0) + 1,
      research_lock_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      verification_version_id: verId,
      disagreement_version_id: disId,
      metrics_version_id: metId,
      status: "RUNNING",
    })
    .select()
    .single();
  if (error || !run) throw error ?? new Error("Could not create audit run");

  const [metricRules, verRules, disRules] = await Promise.all([rulesFor(metId), rulesFor(verId), rulesFor(disId)]);

  const chunked = async <T,>(rows: T[], insert: (batch: T[]) => PromiseLike<unknown>) => {
    for (let i = 0; i < rows.length; i += 200) await insert(rows.slice(i, i + 200));
  };

  await chunked(
    metricRules.map((r) => ({
      audit_run_id: run.id,
      metric_code: r.rule_code,
      metric_name: r.rule_name,
      category: null,
      evidence_family: r.rule_name,
      matrix_derived: false,
      status: "NOT STARTED",
      p1_status: "NOT STARTED",
      p2_status: "NOT STARTED",
    })),
    (batch) => supabase.from("metric_results").insert(batch),
  );

  await chunked(
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
    disRules.map((r) => ({
      audit_run_id: run.id,
      rule_id: r.id,
      rule_code: r.rule_code,
      rule_name: r.rule_name,
      status: "NOT STARTED",
    })),
    (batch) => supabase.from("disagreement_results").insert(batch),
  );

  const { data: match } = await supabase
    .from("matches")
    .select("player1_name, player2_name")
    .eq("id", matchId)
    .single();

  const sides = [match?.player1_name ?? "Player 1", match?.player2_name ?? "Player 2"];
  await supabase.from("underdog_results").insert(
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

  await supabase.from("stress_results").insert(
    STRESS_TESTS.map(([code, name]) => ({
      audit_run_id: run.id,
      test_code: code,
      test_name: name,
      status: "NOT STARTED",
      outcome: "NOT STARTED",
    })),
  );

  await log({
    audit_run_id: run.id,
    match_id: matchId,
    stage: "PRE-MATCH RESEARCH LOCK",
    status: "COMPLETE",
    output: { metrics: metricRules.length, verification: verRules.length, disagreement: disRules.length },
  });

  return run;
}
