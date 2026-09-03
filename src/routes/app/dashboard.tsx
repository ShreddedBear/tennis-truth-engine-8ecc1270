import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BucketBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { winRate } from "@/lib/audit-engine";
import { resetOperationalSlate } from "@/lib/reset-slate.functions";
import { APP_BUILD_INFO } from "@/generated/app-build-info";
import { currentAuditRows, activeSlateMatchIds } from "@/lib/current-audit-state";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({
    meta: [
      { title: "Audit Dashboard — Tennis Matrix Audit System" },
      { name: "description", content: "Slate status, calibration snapshot and pipeline health for the Tennis Matrix audit engine." },
      { property: "og:title", content: "Audit Dashboard — Tennis Matrix Audit System" },
      { property: "og:description", content: "Slate status and live calibration for every audited matchup." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const queryClient = useQueryClient();
  const resetSlate = useServerFn(resetOperationalSlate);
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [matches, runs, decisions, version, uploads, slateVersions] = await Promise.all([
        supabase.from("matches").select("id, match_status, identity_status, surface_status"),
        supabase.from("audit_runs").select("id, match_id, run_number, status"),
        supabase.from("final_decisions").select("audit_run_id, final_audit_color, audit_complete"),
        supabase.from("calibration_versions").select("*").eq("is_active", true).maybeSingle(),
        supabase.from("summary_uploads").select("id"),
        supabase.from("summary_versions").select("match_id, upload_id, is_active"),
      ]);
      const buckets = version.data
        ? (await supabase.from("calibration_buckets").select("*").eq("calibration_version_id", version.data.id).order("wp_min")).data ?? []
        : [];
      const slateMatchIds = activeSlateMatchIds(slateVersions.data ?? []);
      const slateUploadIds = new Set((slateVersions.data ?? []).filter((row) => row.is_active === true).map((row) => row.upload_id));
      const currentRows = currentAuditRows(
        (matches.data ?? []).filter((match) => slateMatchIds.has(match.id)),
        runs.data ?? [],
        decisions.data ?? [],
      );
      return {
        matches: (matches.data ?? []).filter((match) => slateMatchIds.has(match.id)),
        currentRows,
        version: version.data,
        buckets,
        uploads: [...slateUploadIds].filter((id) => (uploads.data ?? []).some((upload) => upload.id === id)).length,
      };
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const confirmed = window.confirm(
        "Clear the operational slate to 0? This removes uploaded match/slate/audit run data but preserves calibration, rules, and historical evidence.",
      );
      if (!confirmed) throw new Error("CANCELLED");
      return resetSlate({ data: { confirm: "CLEAR SLATE" } });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      toast.success(`Slate cleared: ${result.deleted.matches} matches and ${result.deleted.uploads} uploads removed.`);
    },
    onError: (error) => {
      if ((error as Error).message === "CANCELLED") return;
      toast.error(`Could not clear slate: ${(error as Error).message}`);
    },
  });

  const completed = data?.currentRows.filter((row) => row.decision?.audit_complete) ?? [];
  const colorCount = (c: string) => completed.filter((row) => row.decision?.final_audit_color === c).length;
  const builtAt = APP_BUILD_INFO.builtAt ? new Date(APP_BUILD_INFO.builtAt) : null;
  const buildLabel = builtAt && !Number.isNaN(builtAt.getTime()) ? builtAt.toLocaleString() : "development build";

  const tiles = [
    { label: "Matches on slate", value: data?.matches.length ?? 0 },
    { label: "Summary PDFs ingested", value: data?.uploads ?? 0 },
    { label: "Double Green", value: colorCount("DOUBLE GREEN") },
    { label: "Green", value: colorCount("GREEN") },
    { label: "Yellow", value: colorCount("YELLOW") },
    { label: "Red / Pass", value: colorCount("RED / PASS") },
    { label: "Insufficient evidence", value: colorCount("INSUFFICIENT EVIDENCE") },
    { label: "Incomplete", value: (data?.currentRows.length ?? 0) - completed.length },
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">Audit dashboard</h1>
          <div className="rounded-md border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">UPDATED</span>{" "}
            <span className="mono-num">{buildLabel}</span>{" · "}
            <span className="mono-num">commit {APP_BUILD_INFO.commit}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Batch status is independent of match status: one blocked match never stops the slate.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {tiles.map((t) => (
          <div key={t.label} className="panel p-4">
            <p className="mono-num text-2xl font-semibold">{t.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={clearMutation.isPending} onClick={() => clearMutation.mutate()}>
          {clearMutation.isPending ? "Clearing slate…" : "Clear slate to 0"}
        </Button>
        <p className="text-xs text-muted-foreground">Preserves the 183 calibration record, audit definitions, and imported historical evidence.</p>
      </div>

      <section className="panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Active calibration — {data?.version?.label ?? "not initialised"}</h2>
          <Link to="/app/calibration" className="text-sm text-primary underline-offset-4 hover:underline">
            Open calibration
          </Link>
        </div>
        <p className="mono-num mt-1 text-xs text-muted-foreground">
          Master record sequence: {data?.version?.master_sequence_count ?? 0} · Graded calibration sample:{" "}
          {data?.version?.graded_sample_count ?? 0}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data?.buckets.map((b) => (
            <div key={b.id} className="rounded-md border border-border p-3">
              <BucketBadge code={b.bucket_code}>{b.bucket_label}</BucketBadge>
              <p className="mono-num mt-2 text-sm">
                {b.wins}/{b.graded} · {winRate(b.wins, b.graded) ?? "—"}%
              </p>
              {b.small_sample && <p className="text-[11px] font-medium text-warn">SMALL SAMPLE</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="font-semibold">Pipeline</h2>
        <ol className="mono-num mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
          {[
            "Summary PDF ingestion",
            "Match identity verification",
            "Pre-match research lock",
            "P1 vs P2 full metrics",
            "Reconstruction of permitted metrics",
            "Independent evidence conclusion",
            "Verification Audit",
            "Disagreement / Trap Audit",
            "Dangerous Underdog Audit",
            "Stress / component-removal tests",
            "Matrix reveal and comparison",
            "Calibration application",
            "Final Combination Gate",
            "Master ranked board + PDF report",
          ].map((s, i) => (
            <li key={s}>
              {String(i + 1).padStart(2, "0")} — {s}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
