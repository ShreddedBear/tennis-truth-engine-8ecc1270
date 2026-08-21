import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BucketBadge } from "@/components/StatusBadge";
import { winRate } from "@/lib/audit-engine";

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
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [matches, decisions, version, uploads] = await Promise.all([
        supabase.from("matches").select("id, match_status, identity_status, surface_status"),
        supabase.from("final_decisions").select("final_audit_color, audit_complete"),
        supabase.from("calibration_versions").select("*").eq("is_active", true).maybeSingle(),
        supabase.from("summary_uploads").select("id"),
      ]);
      const buckets = version.data
        ? (await supabase.from("calibration_buckets").select("*").eq("calibration_version_id", version.data.id).order("wp_min")).data ?? []
        : [];
      return {
        matches: matches.data ?? [],
        decisions: decisions.data ?? [],
        version: version.data,
        buckets,
        uploads: uploads.data?.length ?? 0,
      };
    },
  });

  const colorCount = (c: string) => data?.decisions.filter((d) => d.final_audit_color === c).length ?? 0;

  const tiles = [
    { label: "Matches on slate", value: data?.matches.length ?? 0 },
    { label: "Summary PDFs ingested", value: data?.uploads ?? 0 },
    { label: "Double Green", value: colorCount("DOUBLE GREEN") },
    { label: "Green", value: colorCount("GREEN") },
    { label: "Yellow", value: colorCount("YELLOW") },
    { label: "Red / Pass", value: colorCount("RED / PASS") },
    { label: "Incomplete", value: (data?.matches.length ?? 0) - (data?.decisions.filter((d) => d.audit_complete).length ?? 0) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Audit dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Batch status is independent of match status: one blocked match never stops the slate.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {tiles.map((t) => (
          <div key={t.label} className="panel p-4">
            <p className="mono-num text-2xl font-semibold">{t.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.label}</p>
          </div>
        ))}
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
