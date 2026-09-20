import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { winRate } from "@/lib/audit-engine";
import { BucketBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/app/calibration-history")({
  head: () => ({
    meta: [
      { title: "Calibration History — Tennis Matrix Audit System" },
      { name: "description", content: "Immutable calibration versions with the exact bucket records used by every past audit decision." },
      { property: "og:title", content: "Calibration History — Tennis Matrix Audit System" },
      { property: "og:description", content: "Full traceability of verified win rate changes over time." },
    ],
  }),
  component: History,
});

function History() {
  const { data } = useQuery({
    queryKey: ["calibration-history"],
    queryFn: async () => {
      const { data: versions } = await supabase
        .from("calibration_versions")
        .select("*")
        .order("version_number", { ascending: false })
        .limit(40);
      const ids = (versions ?? []).map((v) => v.id);
      const { data: buckets } = ids.length
        ? await supabase.from("calibration_buckets").select("*").in("calibration_version_id", ids).order("wp_min")
        : { data: [] };
      return { versions: versions ?? [], buckets: buckets ?? [] };
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Calibration version history</h1>
        <p className="text-sm text-muted-foreground">
          Versions are never edited. Each graded result produces a new snapshot, so historical decisions stay auditable.
        </p>
      </div>

      {data?.versions.map((v) => (
        <div key={v.id} className="panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              {v.label} {v.is_active && <span className="text-ok text-xs">· ACTIVE</span>}
            </h2>
            <p className="mono-num text-xs text-muted-foreground">
              seq {v.master_sequence_count} · graded {v.graded_sample_count} · {new Date(v.created_at).toLocaleString()}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.buckets
              .filter((b) => b.calibration_version_id === v.id)
              .map((b) => (
                <div key={b.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
                  <BucketBadge code={b.bucket_code} />
                  <span className="mono-num text-xs">
                    {winRate(b.wins, b.graded) ?? "—"}% ({b.wins}/{b.graded})
                  </span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
