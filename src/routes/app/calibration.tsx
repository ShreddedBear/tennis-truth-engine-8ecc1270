import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { gradeResult } from "@/lib/calibration";
import { winRate } from "@/lib/audit-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BucketBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/app/calibration")({
  head: () => ({
    meta: [
      { title: "Calibration Ledger — Tennis Matrix Audit System" },
      { name: "description", content: "Continuous calibration: every graded result, retirements included, creates a new immutable calibration version with updated verified win rates." },
      { property: "og:title", content: "Calibration Ledger — Tennis Matrix Audit System" },
      { property: "og:description", content: "Verified win rates recalculate on every graded result." },
    ],
  }),
  component: Calibration,
});

const RESULT_TYPES = ["WIN", "LOSS", "RETIREMENT WIN", "RETIREMENT LOSS", "WALKOVER", "VOID"];

function Calibration() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    matchLabel: "",
    tournament: "",
    surface: "",
    matrixPredictedWinner: "",
    matrixWp: "",
    actualWinner: "",
    resultType: "WIN",
    note: "",
  });

  const { data } = useQuery({
    queryKey: ["calibration"],
    queryFn: async () => {
      const { data: version } = await supabase.from("calibration_versions").select("*").eq("is_active", true).maybeSingle();
      const { data: buckets } = version
        ? await supabase.from("calibration_buckets").select("*").eq("calibration_version_id", version.id).order("wp_min")
        : { data: [] };
      const { data: ledger } = await supabase
        .from("calibration_ledger")
        .select("*")
        .order("master_sequence", { ascending: false })
        .limit(100);
      return { version, buckets: buckets ?? [], ledger: ledger ?? [] };
    },
  });

  const grade = useMutation({
    mutationFn: () =>
      gradeResult({
        matchId: null,
        matchLabel: form.matchLabel,
        tournament: form.tournament || null,
        surface: form.surface || null,
        matchDate: null,
        matrixPredictedWinner: form.matrixPredictedWinner || null,
        matrixWp: form.matrixWp ? Number(form.matrixWp) : null,
        actualWinner: form.actualWinner || null,
        resultType: form.resultType,
        note: form.note,
      }),
    onSuccess: (v) => {
      toast.success(`Result graded — ${v.label} is now active`);
      setForm({ ...form, matchLabel: "", matrixWp: "", actualWinner: "", note: "" });
      qc.invalidateQueries();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Calibration — {data?.version?.label ?? "not initialised"}</h1>
          <p className="mono-num text-xs text-muted-foreground">
            Master sequence {data?.version?.master_sequence_count ?? 0} · graded sample{" "}
            {data?.version?.graded_sample_count ?? 0}
          </p>
        </div>
        <Link to="/app/calibration-history" className="text-sm text-primary underline-offset-4 hover:underline">
          Version history
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data?.buckets.map((b) => {
          const rate = winRate(b.wins, b.graded);
          return (
            <div key={b.id} className="panel p-3">
              <div className="flex items-center justify-between">
                <BucketBadge code={b.bucket_code} />
                <span className="mono-num text-xs text-muted-foreground">
                  {b.wp_min}–{b.wp_max}%
                </span>
              </div>
              <p className="mono-num mt-2 text-2xl font-semibold">{rate ?? "—"}%</p>
              <p className="mono-num text-xs text-muted-foreground">
                {b.wins}/{b.graded} graded {b.small_sample ? "· SMALL SAMPLE" : ""}
              </p>
            </div>
          );
        })}
      </div>

      <div className="panel p-4">
        <h2 className="font-semibold">Grade a result</h2>
        <p className="text-xs text-muted-foreground">
          In-match retirements are graded as real results. Walkovers and voids are recorded but never counted in a bucket.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-3 lg:grid-cols-4">
          <Input placeholder="Match label" value={form.matchLabel} onChange={(e) => setForm({ ...form, matchLabel: e.target.value })} />
          <Input placeholder="Tournament" value={form.tournament} onChange={(e) => setForm({ ...form, tournament: e.target.value })} />
          <Input placeholder="Surface" value={form.surface} onChange={(e) => setForm({ ...form, surface: e.target.value })} />
          <Input placeholder="Matrix predicted winner" value={form.matrixPredictedWinner} onChange={(e) => setForm({ ...form, matrixPredictedWinner: e.target.value })} />
          <Input placeholder="Matrix WP %" value={form.matrixWp} onChange={(e) => setForm({ ...form, matrixWp: e.target.value })} />
          <Input placeholder="Actual winner" value={form.actualWinner} onChange={(e) => setForm({ ...form, actualWinner: e.target.value })} />
          <select
            className="h-9 rounded-md border border-input bg-card px-2 text-sm"
            value={form.resultType}
            onChange={(e) => setForm({ ...form, resultType: e.target.value })}
          >
            {RESULT_TYPES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <Input placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
        <Button className="mt-3" onClick={() => grade.mutate()} disabled={!form.matchLabel || grade.isPending}>
          Grade result & recalculate
        </Button>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-header text-header-foreground">
            <tr className="text-left">
              {["Seq", "Match", "Tournament", "Surface", "Matrix pick", "WP", "Actual", "Result", "Grading", "Bucket", "Counted"].map((h) => (
                <th key={h} className="px-2 py-2 text-xs font-semibold uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.ledger.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="mono-num px-2 py-1">{l.master_sequence}</td>
                <td className="px-2 py-1">{l.match_label}</td>
                <td className="px-2 py-1">{l.tournament ?? "—"}</td>
                <td className="px-2 py-1">{l.surface ?? "—"}</td>
                <td className="px-2 py-1">{l.matrix_predicted_winner ?? "—"}</td>
                <td className="mono-num px-2 py-1">{l.matrix_wp ?? "—"}</td>
                <td className="px-2 py-1">{l.actual_winner ?? "—"}</td>
                <td className="px-2 py-1">{l.result_type}</td>
                <td className="px-2 py-1">{l.result_grading_status}</td>
                <td className="px-2 py-1"><BucketBadge code={l.bucket_code} /></td>
                <td className="px-2 py-1">{l.counted_in_bucket ? "YES" : "NO"}</td>
              </tr>
            ))}
            {!data?.ledger.length && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Ledger empty — graded results will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
