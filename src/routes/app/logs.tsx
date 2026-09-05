import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StateText } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { activeSlateMatchIds, activeRunIds } from "@/lib/current-audit-state";
import { fetchActiveSlateId } from "@/lib/active-slate-client";

export const Route = createFileRoute("/app/logs")({
  head: () => ({
    meta: [
      { title: "Execution Logs — Tennis Matrix Audit System" },
      { name: "description", content: "Timestamped proof of every stage executed, including whether Matrix data was visible at the time." },
      { property: "og:title", content: "Execution Logs — Tennis Matrix Audit System" },
      { property: "og:description", content: "No execution record means the stage did not happen." },
    ],
  }),
  component: Logs,
});

function Logs() {
  const [scope, setScope] = useState<"active" | "all">("active");
  const { data } = useQuery({
    queryKey: ["logs"],
    queryFn: async () => {
      const slateId = await fetchActiveSlateId();
      const [{ data: logs }, { data: runs }, { data: versions }, { data: slateMatches }] = await Promise.all([
        supabase.from("execution_logs").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("audit_runs").select("id, match_id, run_number, status"),
        supabase.from("summary_versions").select("match_id, is_active"),
        slateId ? supabase.from("matches").select("id").eq("slate_id", slateId) : Promise.resolve({ data: [] as Array<{ id: string }> }),
      ]);
      // Operational execution data must be scoped to active/current runs --
      // the same activeSlateMatchIds + resolveActiveRun-backed definition
      // every other operational page reuses. A cleared match's (or an
      // invalidated run's) log rows are real history, never deleted, but
      // they must not read as current operational output by default.
      // Current slate first, then the active-summary-version rule within it: a retired
      // slate's runs are never "current operational output", however they are reached.
      const onSlate = new Set((slateMatches ?? []).map((m) => m.id));
      const currentMatchIds = new Set([...activeSlateMatchIds(versions ?? [])].filter((id) => onSlate.has(id)));
      const activeIds = activeRunIds(runs ?? [], currentMatchIds);
      return { logs: logs ?? [], activeRunIds: [...activeIds] };
    },
  });

  const activeSet = new Set(data?.activeRunIds ?? []);
  const visible = (data?.logs ?? []).filter((l) => scope === "all" || (l.audit_run_id !== null && activeSet.has(l.audit_run_id)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Execution logs</h1>
          <p className="text-sm text-muted-foreground">
            {scope === "active"
              ? "Scoped to active/current runs -- cleared matches and invalidated runs disappear immediately. Each row proves a stage ran; the Matrix-visible flag makes any firewall violation detectable after the fact."
              : "Historical view: every execution ever logged, including cleared matches and invalidated runs."}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setScope(scope === "active" ? "all" : "active")}>
          {scope === "active" ? "Show full history" : "Show active runs only"}
        </Button>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-header text-header-foreground">
            <tr className="text-left">
              {["Time", "Stage", "Status", "Matrix visible", "Output"].map((h) => (
                <th key={h} className="px-2 py-2 text-xs font-semibold uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => (
              <tr key={l.id} className="border-t border-border align-top">
                <td className="mono-num px-2 py-1 text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                <td className="px-2 py-1">{l.stage}</td>
                <td className="px-2 py-1"><StateText state={l.status} /></td>
                <td className={`px-2 py-1 text-xs ${l.matrix_visible ? "text-warn" : "text-muted-foreground"}`}>
                  {l.matrix_visible ? "VISIBLE" : "HIDDEN"}
                </td>
                <td className="mono-num max-w-lg truncate px-2 py-1 text-xs text-muted-foreground">
                  {l.output ? JSON.stringify(l.output) : "—"}
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {scope === "active" ? "No active executions logged. Try \"Show full history\" for past runs." : "No executions logged yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
