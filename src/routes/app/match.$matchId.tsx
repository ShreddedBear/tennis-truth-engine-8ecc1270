import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { log } from "@/lib/audit-runs";
import { runAuditBatch } from "@/lib/audit-pipeline.functions";
import { bucketFor, evaluate, type EngineInput } from "@/lib/audit-engine";
import { buildCalibrationSnapshot } from "@/lib/calibration-snapshot";
import { MATRIX_FIELDS } from "@/lib/constants";
import { isPreviewForceReloadError, isRecoverablePipelineTransportError, safePipelineErrorMessage } from "@/lib/pipeline-client-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuditColorBadge, BucketBadge, StateText } from "@/components/StatusBadge";
import { EvidenceGapReport } from "@/components/EvidenceGapReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/match/$matchId")({
  head: () => ({
    meta: [
      { title: "Match Audit Workspace — Tennis Matrix Audit System" },
      { name: "description", content: "Execute the full pipeline for one matchup: symmetric metrics, verification, trap audit, underdog pathways, stress tests and the Final Combination Gate." },
      { property: "og:title", content: "Match Audit Workspace — Tennis Matrix Audit System" },
      { property: "og:description", content: "Every stage persists an execution record. No record, no completion." },
    ],
  }),
  component: Workspace,
});

const STATUS_OPTIONS = ["NOT STARTED", "RUNNING", "COMPLETE", "BLOCKED", "UNAVAILABLE", "FAILED", "REQUIRES HUMAN REVIEW"];

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      className="h-8 rounded-md border border-input bg-card px-2 text-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

type ResultRow = any;

function textValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function sourcesValue(value: unknown): Array<Record<string, any>> {
  return Array.isArray(value) ? (value as Array<Record<string, any>>) : [];
}

function Provenance({ row }: { row: ResultRow }) {
  const sources = sourcesValue(row.sources ?? row.source_attempts);
  const missing = row.missing_inputs ?? row.inputs?.missing;
  return (
    <details className="mt-2 rounded-md bg-muted p-2 text-xs">
      <summary className="cursor-pointer font-semibold">Evidence and provenance</summary>
      <dl className="mt-2 grid gap-1 md:grid-cols-2">
        <div><dt className="text-muted-foreground">Exact reason</dt><dd>{textValue(row.unavailable_reason ?? row.reconstruction_reason)}</dd></div>
        <div><dt className="text-muted-foreground">Provider/API error</dt><dd>{textValue(row.provider_error)}</dd></div>
        <div><dt className="text-muted-foreground">Missing inputs</dt><dd>{textValue(missing)}</dd></div>
        <div><dt className="text-muted-foreground">Reconstruction</dt><dd>{row.reconstruction_attempted ? `YES · ${textValue(row.reconstruction_reason)}` : "NO"}</dd></div>
        <div><dt className="text-muted-foreground">Formula / method</dt><dd>{textValue(row.formula)}</dd></div>
        <div><dt className="text-muted-foreground">Calculation</dt><dd>{textValue(row.calculation)}</dd></div>
        <div><dt className="text-muted-foreground">Confidence / quality</dt><dd>{textValue(row.reliability ?? row.confidence)}</dd></div>
        <div><dt className="text-muted-foreground">Retrieved</dt><dd>{row.retrieved_at ? new Date(row.retrieved_at).toLocaleString() : "—"}</dd></div>
      </dl>
      <div className="mt-2">
        <p className="text-muted-foreground">Sources/providers</p>
        {sources.length ? sources.map((source, index) => (
          <p key={index}>{textValue(source["source_name"] ?? source["provider"])}{source["url"] ? ` · ${source["url"]}` : ""}{source["retrieved_at"] ? ` · ${source["retrieved_at"]}` : ""}</p>
        )) : <p>—</p>}
      </div>
    </details>
  );
}

function ResultCard({ title, subtitle, row }: { title: string; subtitle?: string; row: ResultRow }) {
  const status = textValue(row.treatment ?? row.status);
  return (
    <article className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h4 className="font-semibold">{title}</h4>{subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}</div>
        <span className={status === "UNAVAILABLE" || status === "PARTIAL" || status === "RECONSTRUCTION_FAILED" ? "text-warn" : "text-ok"}>{status}</span>
      </div>
      <dl className="mt-2 grid gap-1 text-xs md:grid-cols-3">
        <div><dt className="text-muted-foreground">Result/value</dt><dd>{textValue(row.value ?? row.output ?? row.outcome ?? row.final_effect)}</dd></div>
        <div><dt className="text-muted-foreground">Evidence</dt><dd>{textValue(row.evidence ?? row.p1_finding ?? row.p1_risk ?? row.supporting_evidence)}</dd></div>
        <div><dt className="text-muted-foreground">Player/affected side</dt><dd>{textValue(row.player_side ?? `${row.p1_finding ? "P1 and P2" : "—"}`)}</dd></div>
      </dl>
      <Provenance row={row} />
    </article>
  );
}

function Workspace() {
  const { matchId } = Route.useParams();
  const qc = useQueryClient();
  const [showMatrix, setShowMatrix] = useState(false);
  const [winner, setWinner] = useState("");
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [running, setRunning] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["match", matchId],
    refetchInterval: 3000,
    queryFn: async () => {
      const { data: match, error: matchError } = await supabase.from("matches").select("*").eq("id", matchId).single();
      if (matchError) throw new Error(`Could not load match: ${matchError.message}`);
      const { data: runs, error: runsError } = await supabase
        .from("audit_runs")
        .select("*")
        .eq("match_id", matchId)
        .order("run_number", { ascending: false });
      if (runsError) throw new Error(`Could not load audit runs: ${runsError.message}`);
      const run = runs?.[0] ?? null;
      if (!run) return { match, run: null };
      const calibrationVersionQuery = run.calibration_version_id
        ? supabase.from("calibration_versions").select("*").eq("id", run.calibration_version_id).maybeSingle()
        : supabase.from("calibration_versions").select("*").eq("is_active", true).maybeSingle();
      const [metrics, verification, disagreement, underdog, stress, conflicts, reconstructions, decision, coverage, coverageRates, buckets, version, sv] =
        await Promise.all([
          supabase.from("metric_results").select("*").eq("audit_run_id", run.id).order("metric_code"),
          supabase.from("verification_results").select("*").eq("audit_run_id", run.id).order("rule_code"),
          supabase.from("disagreement_results").select("*").eq("audit_run_id", run.id).order("rule_code"),
          supabase.from("underdog_results").select("*").eq("audit_run_id", run.id).order("pathway_code"),
          supabase.from("stress_results").select("*").eq("audit_run_id", run.id).order("test_code"),
          supabase.from("source_conflicts").select("*").eq("audit_run_id", run.id),
          supabase.from("reconstruction_results").select("*").eq("audit_run_id", run.id),
          supabase.from("final_decisions").select("*").eq("audit_run_id", run.id).maybeSingle(),
          supabase.from("audit_coverage").select("*").eq("audit_run_id", run.id).order("player_side"),
          supabase.from("metric_coverage_rates").select("*").eq("audit_run_id", run.id),
          supabase.from("calibration_buckets").select("*").order("wp_min"),
          calibrationVersionQuery,
          supabase.from("summary_versions").select("id").eq("match_id", matchId).eq("is_active", true).maybeSingle(),
        ]);
      const fields = sv.data
        ? (await supabase.from("parsed_summary_fields").select("*").eq("summary_version_id", sv.data.id)).data ?? []
        : [];
      const activeVersion = version.data;
      return {
        match,
        run,
        metrics: metrics.data ?? [],
        verification: verification.data ?? [],
        disagreement: disagreement.data ?? [],
        underdog: underdog.data ?? [],
        stress: stress.data ?? [],
        conflicts: conflicts.data ?? [],
        reconstructions: reconstructions.data ?? [],
        decision: decision.data,
        coverage: coverage.data ?? [],
        coverageRates: coverageRates.data ?? [],
        buckets: (buckets.data ?? []).filter((b) => b.calibration_version_id === activeVersion?.id),
        version: activeVersion,
        fields,
      };
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["match", matchId] });
    qc.invalidateQueries({ queryKey: ["stages", matchId] });
  };

  const { data: stages } = useQuery({
    queryKey: ["stages", matchId],
    refetchInterval: 3000,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("audit_stage_runs")
        .select("*")
        .eq("match_id", matchId)
        .order("stage_order");
      return rows ?? [];
    },
  });

  const executeBatch = useServerFn(runAuditBatch);

  const runAudit = async () => {
    setRunning(true);
    setPipelineError(null);
    try {
      const batch = await executeBatch({ data: { matchIds: [matchId], concurrency: 1 } });
      const res=batch.results[0];
      refresh();
      if (!res?.ok) {
        const message = safePipelineErrorMessage(res?.failures?.[0]?.message ?? "Pipeline failed");
        setPipelineError(message);
        toast.error(message);
        return;
      }
      if (res.complete) toast.success(`Audit executed — ${res.color ?? "gate run"} · ${Math.round(res.completionPercent ?? 0)}%`);
    } catch (e) {
      const message = safePipelineErrorMessage(e);
      setPipelineError(message);
      if (isPreviewForceReloadError(e)) {
        toast.info("The preview updated while the audit was running. Reloading the workspace; persisted progress is safe.");
        window.setTimeout(() => window.location.reload(), 350);
        return;
      }
      if (!isRecoverablePipelineTransportError(e)) toast.error(message);
    } finally {
      setRunning(false);
      refresh();
    }
  };

  useEffect(() => {
    if(data?.run?.status!=="RUNNING"||running)return;
    const timer=window.setTimeout(()=>void runAudit(),500);
    return()=>window.clearTimeout(timer);
  },[data?.run?.status,data?.run?.heartbeat_at,running]);

  if (isLoading || !data?.match) return <div className="panel p-6 text-sm">Loading match…</div>;
  const { match, run } = data;

  if (!run)
    return (
      <div className="panel space-y-3 p-6 text-sm">
        <p>No audit run yet for {match.player1_name} vs {match.player2_name}.</p>
        <Button onClick={runAudit} disabled={running}>
          {running ? "Running audit…" : "Run Audit"}
        </Button>
        {pipelineError && <p className="text-blocked text-xs">{pipelineError}</p>}
      </div>
    );

  const matrixWpRaw = data.fields?.find((f) => f.field_key === "matrix_wp")?.normalized_value ?? null;
  const matrixWp = matrixWpRaw ? Number(String(matrixWpRaw).replace(/[^\d.]/g, "")) : null;

  const engineInput: EngineInput = {
    match: {
      identity_status: match.identity_status,
      surface_status: match.surface_status,
      player1_name: match.player1_name,
      player2_name: match.player2_name,
    },
    run: {
      research_lock_at: run.research_lock_at,
      independent_decision_committed_at: run.independent_decision_committed_at,
      matrix_revealed_at: run.matrix_revealed_at,
      independent_winner: run.independent_winner,
      independent_low: run.independent_low,
      independent_high: run.independent_high,
      calibration_version_id: run.calibration_version_id,
      effective_evidence_count: run.effective_evidence_count,
    },
    metrics: data.metrics ?? [],
    verification: data.verification ?? [],
    disagreement: data.disagreement ?? [],
    underdog: data.underdog ?? [],
    stress: data.stress ?? [],
    reconstructions: data.reconstructions ?? [],
    conflicts: data.conflicts ?? [],
    matrixWp,
  };
  const report = evaluate(engineInput);
  const committed = !!run.independent_decision_committed_at;

  const patch = async (table: "metric_results" | "verification_results" | "disagreement_results" | "underdog_results" | "stress_results", id: string, values: Record<string, unknown>, stage: string) => {
    if(run.status==="RUNNING"||run.status==="COMPLETE"){toast.error("Persisted audit evidence cannot be edited while an audit is running or after its final decision is complete.");return;}
    const { error } = await supabase.from(table).update(values as never).eq("id", id);
    if (error) {
      toast.error(`Could not update ${table}: ${error.message}`);
      return;
    }
    await log({ audit_run_id: run.id, match_id: matchId, stage, status: "COMPLETE", output: values, matrix_visible: !!run.matrix_revealed_at });
    refresh();
  };

  const commitIndependent = async () => {
    await runAudit();
  };

  const revealMatrix = async () => {
    await runAudit();
  };

  const applyCalibration = async () => {
    await runAudit();
  };

  const runGate = async () => {
    await runAudit();
  };

  const counts = report.counts;
  const metricRows = (data.metrics ?? []) as ResultRow[];
  const verificationRows = (data.verification ?? []) as ResultRow[];
  const disagreementRows = (data.disagreement ?? []) as ResultRow[];
  const underdogRows = (data.underdog ?? []) as ResultRow[];
  const stressRows = (data.stress ?? []) as ResultRow[];
  const reconstructionRows = (data.reconstructions ?? []) as ResultRow[];
  const unavailableItems: ResultRow[] = [
    ...metricRows.flatMap((row) => [
      { ...row, itemName: `${row.metric_name} · ${match.player1_name}`, treatment: row.p1_treatment ?? row.p1_status, unavailable_reason: row.p1_unavailable_reason ?? row.unavailable_reason, provider_error: row.p1_provider_error ?? row.provider_error, retrieved_at: row.p1_retrieved_at ?? row.retrieved_at },
      { ...row, itemName: `${row.metric_name} · ${match.player2_name}`, treatment: row.p2_treatment ?? row.p2_status, unavailable_reason: row.p2_unavailable_reason ?? row.unavailable_reason, provider_error: row.p2_provider_error ?? row.provider_error, retrieved_at: row.p2_retrieved_at ?? row.retrieved_at },
    ]),
    ...verificationRows.map((row) => ({ ...row, itemName: row.rule_name, treatment: row.status })),
    ...disagreementRows.map((row) => ({ ...row, itemName: row.rule_name, treatment: row.status })),
    ...underdogRows.map((row) => ({ ...row, itemName: `${row.pathway_name} · ${row.player_side}`, treatment: row.status })),
    ...stressRows.map((row) => ({ ...row, itemName: row.test_name, treatment: row.status })),
    ...reconstructionRows.map((row) => ({ ...row, itemName: `${row.metric_code} · ${row.player_side}`, treatment: row.status === "UNAVAILABLE" ? "RECONSTRUCTION_FAILED" : row.status })),
  ].filter((row) => row.treatment === "UNAVAILABLE" || row.treatment === "PARTIAL" || row.treatment === "RECONSTRUCTION_FAILED");

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">
              {match.player1_name} <span className="text-muted-foreground">vs</span> {match.player2_name}
            </h1>
            <p className="mono-num text-xs text-muted-foreground">
              {match.tournament_name ?? "tournament unverified"} · {match.round ?? "round unverified"} ·{" "}
              {match.surface ?? "surface unverified"} · RUN {run.run_number} · lock{" "}
              {run.research_lock_at ? new Date(run.research_lock_at).toLocaleString() : "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AuditColorBadge color={data.decision?.final_audit_color ?? report.color} />
            <Button onClick={runAudit} disabled={running}>
              {running ? "Running audit…" : "Run Audit"}
            </Button>
            <Button variant="secondary" onClick={runGate}>
              Run Final Combination Gate
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "Identity", value: match.identity_status, field: "identity_status" },
            { label: "Surface", value: match.surface_status, field: "surface_status" },
          ].map((s) => (
            <div key={s.field} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <Select
                value={s.value}
                options={["UNVERIFIED", "VERIFIED", "CONFLICT"]}
                onChange={async (v) => {
                  await supabase.from("matches").update({ [s.field]: v } as never).eq("id", matchId);
                  await log({ audit_run_id: run.id, match_id: matchId, stage: "MATCH IDENTITY VERIFICATION", status: v });
                  refresh();
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="font-semibold">Execution diagnostics</h2>
        {pipelineError && <p className="mt-1 text-xs text-blocked">{pipelineError}</p>}
        {!stages?.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            No stage has executed yet. Press Run Audit to execute the pipeline end to end.
          </p>
        )}
        <div className="mt-2 grid gap-1 text-xs md:grid-cols-2">
          {stages?.map((st) => (
            <div key={st.stage} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1">
              <span className="truncate">{st.stage}</span>
              <span className="mono-num flex shrink-0 items-center gap-2">
                <span>
                  {st.done_count}/{st.total_count} · attempt {st.attempts}
                </span>
                <StateText state={st.status} />
              </span>
              {st.error_message && <span className="text-blocked">{st.error_message}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="font-semibold">Completion proof</h2>
        <div className="mono-num mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4 xl:grid-cols-5">
          {[
            ["Metrics", counts.metrics],
            ["P1 metric treatment", counts.p1],
            ["P2 metric treatment", counts.p2],
            ["Verification", counts.verification],
            ["Disagreement", counts.disagreement],
            ["Underdog pathways", counts.underdog],
            ["Stress tests", counts.stress],
            ["Reconstructions", counts.reconstructions],
            ["Critical conflicts resolved", counts.criticalConflicts],
            ["Coverage records", { done: data.coverage?.length ?? 0, total: 2 }],
            ["Metric coverage records", { done: data.coverageRates?.length ?? 0, total: (data.metrics?.length ?? 0) * 2 }],
            ["Final decision", { done: data.decision ? 1 : 0, total: 1 }],
          ].map(([label, c]) => {
            const pair = c as { done: number; total: number };
            return (
              <div key={label as string} className="rounded-md border border-border p-2">
                <p className="text-muted-foreground">{label as string}</p>
                <p className={pair.total > 0 && pair.done === pair.total ? "text-ok" : "text-warn"}>
                  {pair.done} / {pair.total}
                </p>
              </div>
            );
          })}
          <div className="rounded-md border border-border p-2">
            <p className="text-muted-foreground">Matrix firewall</p>
            <p className={report.matrixFirewallValid ? "text-ok" : "text-blocked"}>
              {report.matrixFirewallValid ? "VALID" : "VIOLATED"}
            </p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="text-muted-foreground">Effective independent evidence</p>
            <p>{report.effectiveEvidenceCount}</p>
          </div>
        </div>
        <p className={`mt-3 text-sm font-semibold ${report.auditComplete ? "text-ok" : "text-warn"}`}>
          {report.auditComplete ? "AUDIT COMPLETE — NO REQUIRED STEPS MISSING · NO SHORTCUTS" : "AUDIT INCOMPLETE"}
        </p>
        <div className="mt-3 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Evidence coverage</h3>
            <span className={report.coverage.usablePercent >= report.coverage.thresholdPercent ? "text-ok" : "text-warn"}>
              {report.coverage.usablePercent}% usable · execution {report.completionPercent}%
            </span>
          </div>
          <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
            {[
              [match.player1_name, report.coverage.p1],
              [match.player2_name, report.coverage.p2],
            ].map(([player, coverage]) => {
              const c = coverage as typeof report.coverage.p1;
              return (
                <div key={player as string} className="rounded-md bg-muted p-2">
                  <div className="flex justify-between font-semibold">
                    <span>{player as string}</span>
                    <span>{c.usablePercent}% usable</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    DIRECT {c.direct} · RECONSTRUCTED {c.reconstructed} · PARTIAL {c.partial} · UNAVAILABLE {c.unavailable} · EXCLUDED {c.excluded}
                  </p>
                </div>
              );
            })}
          </div>
          {report.coverage.usablePercent < report.coverage.thresholdPercent && (
            <p className="mt-2 text-xs text-warn">Low coverage changes the gate to INSUFFICIENT EVIDENCE; it is reported separately from execution completion.</p>
          )}
        </div>
        <ul className="mt-2 grid gap-1 text-xs md:grid-cols-2">
          {report.checks.map((c) => (
            <li key={c.key} className={c.pass ? "text-muted-foreground" : "text-blocked"}>
              {c.pass ? "✓" : "✗"} {c.label} — {c.detail}
            </li>
          ))}
        </ul>
        {report.greenLockReasons.length > 0 && (
          <div className="mt-3 rounded-md border border-border bg-muted p-3 text-xs">
            <p className="font-semibold">GREEN LOCKED</p>
            <ul className="mt-1 list-disc pl-4">
              {report.greenLockReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <EvidenceGapReport metrics={metricRows} player1={match.player1_name} player2={match.player2_name} />

      <section className="panel space-y-4 p-4">
        <div>
          <h2 className="font-semibold">Detailed audit results · current run {run.run_number}</h2>
          <p className="text-xs text-muted-foreground">Every persisted metric, rule, pathway, stress test, and reconstruction is shown below. Expand a row for source, timestamp, missing inputs, provider errors, and method.</p>
        </div>
        <details open>
          <summary className="cursor-pointer font-semibold">Player 1 metrics · {metricRows.length}</summary>
          <div className="mt-2 grid gap-2">{metricRows.map((row) => <ResultCard key={`${row.id}-p1`} title={textValue(row.metric_name)} subtitle={`${match.player1_name} · ${textValue(row.metric_code)}`} row={{ ...row, value: row.p1_value, treatment: row.p1_treatment ?? row.p1_status, unavailable_reason: row.p1_unavailable_reason ?? row.unavailable_reason, provider_error: row.p1_provider_error ?? row.provider_error, retrieved_at: row.p1_retrieved_at ?? row.retrieved_at }} />)}</div>
        </details>
        <details open>
          <summary className="cursor-pointer font-semibold">Player 2 metrics · {metricRows.length}</summary>
          <div className="mt-2 grid gap-2">{metricRows.map((row) => <ResultCard key={`${row.id}-p2`} title={textValue(row.metric_name)} subtitle={`${match.player2_name} · ${textValue(row.metric_code)}`} row={{ ...row, value: row.p2_value, treatment: row.p2_treatment ?? row.p2_status, unavailable_reason: row.p2_unavailable_reason ?? row.unavailable_reason, provider_error: row.p2_provider_error ?? row.p2_provider_error, retrieved_at: row.p2_retrieved_at ?? row.retrieved_at }} />)}</div>
        </details>
        <details open>
          <summary className="cursor-pointer font-semibold">Verification Audit · {verificationRows.length} rules</summary>
          <div className="mt-2 grid gap-2">{verificationRows.map((row) => <ResultCard key={row.id} title={textValue(row.rule_name)} subtitle={`${textValue(row.rule_code)} · outcome ${textValue(row.outcome)} · severity ${textValue(row.severity)}`} row={row} />)}</div>
        </details>
        <details open>
          <summary className="cursor-pointer font-semibold">Disagreement / Trap Audit · {disagreementRows.length} rules</summary>
          <div className="mt-2 grid gap-2">{disagreementRows.map((row) => <ResultCard key={row.id} title={textValue(row.rule_name)} subtitle={`${textValue(row.rule_code)} · contradiction ${textValue(row.contradiction_severity)}`} row={row} />)}</div>
        </details>
        <details open>
          <summary className="cursor-pointer font-semibold">Dangerous Underdog Audit · {underdogRows.length} pathways</summary>
          <div className="mt-2 grid gap-2">{underdogRows.map((row) => <ResultCard key={row.id} title={textValue(row.pathway_name)} subtitle={`${textValue(row.pathway_code)} · ${textValue(row.player_side)} · classification ${textValue(row.classification)}`} row={row} />)}</div>
        </details>
        <details open>
          <summary className="cursor-pointer font-semibold">Stress / Removal Tests · {stressRows.length}</summary>
          <div className="mt-2 grid gap-2">{stressRows.map((row) => <ResultCard key={row.id} title={textValue(row.test_name)} subtitle={`${textValue(row.test_code)} · before ${textValue(row.winner_before)} · after ${textValue(row.winner_after)}`} row={row} />)}</div>
        </details>
        <details open>
          <summary className="cursor-pointer font-semibold">Reconstructions · {reconstructionRows.length} attempts</summary>
          <div className="mt-2 grid gap-2">{reconstructionRows.map((row) => <ResultCard key={row.id} title={textValue(row.metric_code)} subtitle={`${textValue(row.player_side)} · ${textValue(row.status)}`} row={{ ...row, value: row.output, missing_inputs: row.missing_inputs ?? row.inputs?.missing }} />)}</div>
        </details>
        <details open>
          <summary className="cursor-pointer font-semibold">UNAVAILABLE DATA · {unavailableItems.length} items</summary>
          <div className="mt-2 grid gap-2">{unavailableItems.length ? unavailableItems.map((row, index) => <ResultCard key={`${row.id ?? row.itemName}-${index}`} title={textValue(row.itemName)} subtitle={textValue(row.treatment)} row={row} />) : <p className="text-sm text-ok">No unavailable or partial items recorded for this run.</p>}</div>
        </details>
        <details>
          <summary className="cursor-pointer font-semibold">Source conflicts · {data.conflicts?.length ?? 0}</summary>
          <div className="mt-2 grid gap-2">{(data.conflicts ?? []).map((row: any) => <ResultCard key={row.id} title={textValue(row.data_key)} subtitle={`${textValue(row.resolution_status)} · critical ${textValue(row.critical)}`} row={row} />)}</div>
        </details>
      </section>

      <Tabs defaultValue="metrics">
        <TabsList className="flex-wrap">
          <TabsTrigger value="metrics">P1 vs P2 Metrics</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="disagreement">Disagreement / Trap</TabsTrigger>
          <TabsTrigger value="underdog">Dangerous Underdog</TabsTrigger>
          <TabsTrigger value="stress">Stress / Removal</TabsTrigger>
          <TabsTrigger value="conclusion">Conclusion & Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="panel mt-3 p-3">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-header text-header-foreground">
                <tr className="text-left">
                  {["#", "Metric", `P1 · ${match.player1_name}`, "P1 status", `P2 · ${match.player2_name}`, "P2 status", "Metric status"].map((h) => (
                    <th key={h} className="px-2 py-2 text-xs font-semibold uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metricRows.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="mono-num px-2 py-1 text-xs">{m.metric_code}</td>
                    <td className="px-2 py-1">{m.metric_name}</td>
                    <td className="px-2 py-1">
                      <Input
                        className="h-8"
                        defaultValue={m.p1_value ?? ""}
                        onBlur={(e) => patch("metric_results", m.id, { p1_value: e.target.value }, "P1 VS P2 FULL METRICS")}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Select value={m.p1_status} options={STATUS_OPTIONS} onChange={(v) => patch("metric_results", m.id, { p1_status: v }, "P1 VS P2 FULL METRICS")} />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        className="h-8"
                        defaultValue={m.p2_value ?? ""}
                        onBlur={(e) => patch("metric_results", m.id, { p2_value: e.target.value }, "P1 VS P2 FULL METRICS")}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Select value={m.p2_status} options={STATUS_OPTIONS} onChange={(v) => patch("metric_results", m.id, { p2_status: v }, "P1 VS P2 FULL METRICS")} />
                    </td>
                    <td className="px-2 py-1">
                      <Select value={m.status} options={STATUS_OPTIONS} onChange={(v) => patch("metric_results", m.id, { status: v }, "P1 VS P2 FULL METRICS")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="verification" className="panel mt-3 p-3">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-header text-header-foreground">
                <tr className="text-left">
                  {["#", "Rule", "P1 finding", "P2 finding", "Outcome", "Severity", "Status"].map((h) => (
                    <th key={h} className="px-2 py-2 text-xs font-semibold uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {verificationRows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="mono-num px-2 py-1 text-xs">{r.rule_code}</td>
                    <td className="px-2 py-1">{r.rule_name}</td>
                    <td className="px-2 py-1">
                      <Input className="h-8" defaultValue={r.p1_finding ?? ""} onBlur={(e) => patch("verification_results", r.id, { p1_finding: e.target.value }, "VERIFICATION AUDIT")} />
                    </td>
                    <td className="px-2 py-1">
                      <Input className="h-8" defaultValue={r.p2_finding ?? ""} onBlur={(e) => patch("verification_results", r.id, { p2_finding: e.target.value }, "VERIFICATION AUDIT")} />
                    </td>
                    <td className="px-2 py-1">
                      <Select value={r.outcome} options={["NOT STARTED", "PASS", "WARN", "FAIL"]} onChange={(v) => patch("verification_results", r.id, { outcome: v }, "VERIFICATION AUDIT")} />
                    </td>
                    <td className="px-2 py-1">
                      <Select value={r.severity ?? "STANDARD"} options={["STANDARD", "CRITICAL"]} onChange={(v) => patch("verification_results", r.id, { severity: v }, "VERIFICATION AUDIT")} />
                    </td>
                    <td className="px-2 py-1">
                      <Select value={r.status} options={STATUS_OPTIONS} onChange={(v) => patch("verification_results", r.id, { status: v }, "VERIFICATION AUDIT")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="disagreement" className="panel mt-3 p-3">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-header text-header-foreground">
                <tr className="text-left">
                  {["#", "Rule", "P1 risk", "P2 risk", "Contradiction severity", "Status"].map((h) => (
                    <th key={h} className="px-2 py-2 text-xs font-semibold uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {disagreementRows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="mono-num px-2 py-1 text-xs">{r.rule_code}</td>
                    <td className="px-2 py-1">{r.rule_name}</td>
                    <td className="px-2 py-1">
                      <Input className="h-8" defaultValue={r.p1_risk ?? ""} onBlur={(e) => patch("disagreement_results", r.id, { p1_risk: e.target.value }, "DISAGREEMENT / TRAP AUDIT")} />
                    </td>
                    <td className="px-2 py-1">
                      <Input className="h-8" defaultValue={r.p2_risk ?? ""} onBlur={(e) => patch("disagreement_results", r.id, { p2_risk: e.target.value }, "DISAGREEMENT / TRAP AUDIT")} />
                    </td>
                    <td className="px-2 py-1">
                      <Select value={r.contradiction_severity ?? "NONE"} options={["NONE", "MINOR", "MATERIAL", "CRITICAL"]} onChange={(v) => patch("disagreement_results", r.id, { contradiction_severity: v }, "DISAGREEMENT / TRAP AUDIT")} />
                    </td>
                    <td className="px-2 py-1">
                      <Select value={r.status} options={STATUS_OPTIONS} onChange={(v) => patch("disagreement_results", r.id, { status: v }, "DISAGREEMENT / TRAP AUDIT")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="underdog" className="panel mt-3 p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Both players get every pathway. "Underdog" is the lower-confidence side of the independent audit, not the
            Matrix underdog.
          </p>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-header text-header-foreground">
                <tr className="text-left">
                  {["Player", "Pathway", "Evidence", "Classification", "Status"].map((h) => (
                    <th key={h} className="px-2 py-2 text-xs font-semibold uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {underdogRows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-2 py-1">{r.player_side}</td>
                    <td className="px-2 py-1">{r.pathway_name}</td>
                    <td className="px-2 py-1">
                      <Input className="h-8" defaultValue={r.evidence ?? ""} onBlur={(e) => patch("underdog_results", r.id, { evidence: e.target.value }, "DANGEROUS UNDERDOG AUDIT")} />
                    </td>
                    <td className="px-2 py-1">
                      <Select value={r.classification} options={["UNRESOLVED", "WEAK", "REALISTIC", "STRONG"]} onChange={(v) => patch("underdog_results", r.id, { classification: v }, "DANGEROUS UNDERDOG AUDIT")} />
                    </td>
                    <td className="px-2 py-1">
                      <Select value={r.status} options={STATUS_OPTIONS} onChange={(v) => patch("underdog_results", r.id, { status: v }, "DANGEROUS UNDERDOG AUDIT")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="stress" className="panel mt-3 p-3">
          <table className="w-full text-sm">
            <thead className="bg-header text-header-foreground">
              <tr className="text-left">
                {["#", "Test", "Winner before", "Winner after", "Outcome", "Status"].map((h) => (
                  <th key={h} className="px-2 py-2 text-xs font-semibold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stressRows.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="mono-num px-2 py-1 text-xs">{s.test_code}</td>
                  <td className="px-2 py-1">{s.test_name}</td>
                  <td className="px-2 py-1">
                    <Input className="h-8" defaultValue={s.winner_before ?? ""} onBlur={(e) => patch("stress_results", s.id, { winner_before: e.target.value }, "STRESS / REMOVAL TESTS")} />
                  </td>
                  <td className="px-2 py-1">
                    <Input className="h-8" defaultValue={s.winner_after ?? ""} onBlur={(e) => patch("stress_results", s.id, { winner_after: e.target.value }, "STRESS / REMOVAL TESTS")} />
                  </td>
                  <td className="px-2 py-1">
                    <Select value={s.outcome} options={["NOT STARTED", "STABLE", "MOSTLY STABLE", "UNSTABLE", "FAILS"]} onChange={(v) => patch("stress_results", s.id, { outcome: v }, "STRESS / REMOVAL TESTS")} />
                  </td>
                  <td className="px-2 py-1">
                    <Select value={s.status} options={STATUS_OPTIONS} onChange={(v) => patch("stress_results", s.id, { status: v }, "STRESS / REMOVAL TESTS")} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="conclusion" className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="panel p-4">
            <h3 className="font-semibold">Branch B — independent conclusion</h3>
            <p className="text-xs text-muted-foreground">Committed before any Matrix output is visible.</p>
            <div className="mt-3 space-y-2">
              <Select
                value={winner || run.independent_winner || ""}
                options={["", match.player1_name, match.player2_name]}
                onChange={setWinner}
              />
              <div className="flex gap-2">
                <Input placeholder="range low %" className="h-8" value={low} onChange={(e) => setLow(e.target.value)} />
                <Input placeholder="range high %" className="h-8" value={high} onChange={(e) => setHigh(e.target.value)} />
              </div>
              <Button size="sm" onClick={commitIndependent} disabled={committed}>
                {committed ? "Committed" : "Commit independent conclusion"}
              </Button>
              {committed && (
                <p className="mono-num text-xs text-muted-foreground">
                  {run.independent_winner} · committed {new Date(run.independent_decision_committed_at!).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="panel p-4">
            <h3 className="font-semibold">Branch A — Matrix (firewalled)</h3>
            {!run.matrix_revealed_at ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Matrix outputs are hidden. Reveal is only possible after the independent conclusion is committed.
                </p>
                <Button size="sm" className="mt-3" onClick={revealMatrix} disabled={!committed}>
                  Reveal Matrix & compare
                </Button>
              </>
            ) : (
              <>
                <p className="mono-num mt-1 text-xs text-muted-foreground">
                  revealed {new Date(run.matrix_revealed_at).toLocaleString()}
                </p>
                <dl className="mono-num mt-2 grid grid-cols-2 gap-1 text-xs">
                  {MATRIX_FIELDS.map((k) => {
                    const v = data.fields?.find((f) => f.field_key === k)?.normalized_value;
                    if (!v && !showMatrix) return null;
                    return (
                      <div key={k} className="rounded border border-border p-1.5">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd>{v ?? "UNAVAILABLE"}</dd>
                      </div>
                    );
                  })}
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">
                  Matrix-derived signals never count toward independent evidence.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={applyCalibration}>
                    Apply current calibration
                  </Button>
                  <BucketBadge code={bucketFor(matrixWp, data.buckets ?? [])?.bucket_code ?? null} />
                  <StateText state={run.calibration_version_id ? "COMPLETE" : "NOT STARTED"} />
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
