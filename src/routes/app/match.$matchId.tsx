import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { log } from "@/lib/audit-runs";
import { runAuditPipeline } from "@/lib/audit-pipeline.functions";
import { bucketFor, evaluate, winRate, type EngineInput } from "@/lib/audit-engine";
import { MATRIX_FIELDS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuditColorBadge, BucketBadge, StateText } from "@/components/StatusBadge";
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
    queryFn: async () => {
      const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
      const { data: runs } = await supabase
        .from("audit_runs")
        .select("*")
        .eq("match_id", matchId)
        .order("run_number", { ascending: false });
      const run = runs?.[0] ?? null;
      if (!run) return { match, run: null };
      const [metrics, verification, disagreement, underdog, stress, conflicts, reconstructions, decision, buckets, version, sv] =
        await Promise.all([
          supabase.from("metric_results").select("*").eq("audit_run_id", run.id).order("metric_code"),
          supabase.from("verification_results").select("*").eq("audit_run_id", run.id).order("rule_code"),
          supabase.from("disagreement_results").select("*").eq("audit_run_id", run.id).order("rule_code"),
          supabase.from("underdog_results").select("*").eq("audit_run_id", run.id).order("pathway_code"),
          supabase.from("stress_results").select("*").eq("audit_run_id", run.id).order("test_code"),
          supabase.from("source_conflicts").select("*").eq("audit_run_id", run.id),
          supabase.from("reconstruction_results").select("*").eq("audit_run_id", run.id),
          supabase.from("final_decisions").select("*").eq("audit_run_id", run.id).maybeSingle(),
          supabase.from("calibration_buckets").select("*").order("wp_min"),
          supabase.from("calibration_versions").select("*").eq("is_active", true).maybeSingle(),
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
    refetchInterval: running ? 3000 : false,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("audit_stage_runs")
        .select("*")
        .eq("match_id", matchId)
        .order("stage_order");
      return rows ?? [];
    },
  });

  const executePipeline = useServerFn(runAuditPipeline);

  const runAudit = async () => {
    setRunning(true);
    setPipelineError(null);
    try {
      // The pipeline is time-budgeted, idempotent and resumable: drive it in
      // chunks until it reports completion or stops making progress.
      for (let chunk = 0; chunk < 20; chunk += 1) {
        const res = await executePipeline({ data: { matchId } });
        refresh();
        if (!res.ok) {
          setPipelineError(res.failures[0]?.message ?? "Pipeline failed");
          toast.error(res.failures[0]?.message ?? "Pipeline failed");
          return;
        }
        if (res.complete) {
          toast.success(`Audit executed — ${res.color ?? "gate run"} · ${Math.round(res.completionPercent ?? 0)}%`);
          return;
        }
        if (!res.nextStage) {
          setPipelineError(res.failures[0]?.message ?? "Pipeline stopped before completing all stages.");
          toast.warning("Pipeline stopped early — see stage diagnostics");
          return;
        }
      }
      toast.warning("Pipeline still running — press Run Audit again to resume");
    } catch (e) {
      setPipelineError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
      refresh();
    }
  };


  if (isLoading || !data?.match) return <div className="panel p-6 text-sm">Loading match…</div>;
  const { match, run } = data;

  if (!run) return <div className="panel p-6 text-sm">No audit run yet. Start one from the Active Slate.</div>;

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
    await supabase.from(table).update(values as never).eq("id", id);
    await log({ audit_run_id: run.id, match_id: matchId, stage, status: "COMPLETE", output: values, matrix_visible: !!run.matrix_revealed_at });
    refresh();
  };


  const commitIndependent = async () => {
    if (!winner) {
      toast.error("Select the independent winner first");
      return;
    }
    const families = new Set(
      (data.metrics ?? []).filter((m) => !m.matrix_derived && m.status === "COMPLETE" && m.evidence_family).map((m) => m.evidence_family),
    );
    await supabase
      .from("audit_runs")
      .update({
        independent_winner: winner,
        independent_low: low ? Number(low) : null,
        independent_high: high ? Number(high) : null,
        independent_decision_committed_at: new Date().toISOString(),
        effective_evidence_count: families.size,
        raw_signal_count: (data.metrics ?? []).filter((m) => m.status === "COMPLETE").length,
      })
      .eq("id", run.id);
    await log({ audit_run_id: run.id, match_id: matchId, stage: "INDEPENDENT EVIDENCE CONCLUSION", status: "COMPLETE", output: { winner, families: families.size }, matrix_visible: false });
    toast.success("Independent conclusion committed and timestamped");
    refresh();
  };

  const revealMatrix = async () => {
    if (!committed) {
      toast.error("Matrix firewall: commit the independent conclusion first");
      return;
    }
    await supabase.from("audit_runs").update({ matrix_revealed_at: new Date().toISOString() }).eq("id", run.id);
    await log({ audit_run_id: run.id, match_id: matchId, stage: "MATRIX REVEAL AND COMPARISON", status: "COMPLETE", matrix_visible: true });
    setShowMatrix(true);
    refresh();
  };

  const applyCalibration = async () => {
    if (!run.matrix_revealed_at) {
      toast.error("Calibration runs after the Matrix comparison");
      return;
    }
    const bucket = bucketFor(matrixWp, data.buckets ?? []);
    const rate = bucket ? winRate(bucket.wins, bucket.graded) : null;
    const centre = rate ?? ((run.independent_low ?? 0) + (run.independent_high ?? 0)) / 2;
    await supabase
      .from("audit_runs")
      .update({
        calibration_version_id: data.version?.id ?? null,
        calibrated_low: Math.max(0, Math.round(centre - 5)),
        calibrated_high: Math.min(100, Math.round(centre + 5)),
      })
      .eq("id", run.id);
    await log({ audit_run_id: run.id, match_id: matchId, stage: "CURRENT CALIBRATION APPLICATION", status: "COMPLETE", output: { bucket: bucket?.bucket_code, rate } });
    refresh();
  };

  const runGate = async () => {
    const bucket = bucketFor(matrixWp, data.buckets ?? []);
    const rate = bucket ? winRate(bucket.wins, bucket.graded) : null;
    const payload = {
      audit_run_id: run.id,
      final_audit_color: report.color,
      final_selection: report.color.includes("GREEN") ? run.independent_winner : null,
      action: report.action,
      gate_report: report as unknown as Record<string, unknown>,
      completion_percent: report.completionPercent,
      audit_complete: report.auditComplete,
      matrix_firewall_valid: report.matrixFirewallValid,
      calibration_bucket: bucket?.bucket_code ?? null,
      verified_win_rate: rate,
    };
    if (data.decision) await supabase.from("final_decisions").update(payload as never).eq("id", data.decision.id);
    else await supabase.from("final_decisions").insert(payload as never);
    await supabase
      .from("matches")
      .update({ match_status: report.auditComplete ? "COMPLETE" : "PARTIALLY BLOCKED" })
      .eq("id", matchId);
    await log({ audit_run_id: run.id, match_id: matchId, stage: "FINAL COMBINATION GATE", status: report.auditComplete ? "COMPLETE" : "BLOCKED", output: { color: report.color } });
    toast.success(`Gate executed — ${report.color}`);
    refresh();
  };

  const counts = report.counts;

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
            <Button onClick={runGate}>Run Final Combination Gate</Button>
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
                {data.metrics?.map((m) => (
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
                {data.verification?.map((r) => (
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
                {data.disagreement?.map((r) => (
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
                {data.underdog?.map((r) => (
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
              {data.stress?.map((s) => (
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
