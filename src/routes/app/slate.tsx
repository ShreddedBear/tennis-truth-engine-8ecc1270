import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { runAuditPipeline } from "@/lib/audit-pipeline.functions";
import { Button } from "@/components/ui/button";
import { AuditColorBadge, StateText } from "@/components/StatusBadge";

export const Route = createFileRoute("/app/slate")({
  head: () => ({
    meta: [
      { title: "Active Slate — Tennis Matrix Audit System" },
      { name: "description", content: "Every ingested matchup with identity, surface and audit-run status. Blocked matches never stop the batch." },
      { property: "og:title", content: "Active Slate — Tennis Matrix Audit System" },
      { property: "og:description", content: "Per-match blocking, never global: the slate keeps processing." },
    ],
  }),
  component: Slate,
});

function Slate() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["slate"],
    queryFn: async () => {
      const { data: matches } = await supabase.from("matches").select("*").order("created_at", { ascending: false });
      const { data: runs } = await supabase.from("audit_runs").select("id, match_id, status, run_number");
      const { data: decisions } = await supabase.from("final_decisions").select("audit_run_id, final_audit_color, completion_percent");
      return { matches: matches ?? [], runs: runs ?? [], decisions: decisions ?? [] };
    },
  });

  const execute = useServerFn(runAuditPipeline);
  const start = useMutation({
    mutationFn: async (matchId: string) => {
      const res = await execute({ data: { matchId } });
      if (!res.ok) throw new Error(res.failures[0]?.message ?? "Pipeline failed");
      return res;
    },
    onSuccess: () => {
      toast.success("Audit execution started — open the workspace for stage diagnostics");
      qc.invalidateQueries({ queryKey: ["slate"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const runFor = (matchId: string) => data?.runs.find((r) => r.match_id === matchId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Active slate</h1>
        <p className="text-sm text-muted-foreground">
          Batch status: {data?.matches.length ? "RUNNING" : "EMPTY"} — a blocked dependency blocks only its own match and
          only its dependent calculations.
        </p>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-header text-header-foreground">
            <tr className="text-left">
              {["Match", "Tournament", "Round", "Surface", "Identity", "Surface status", "Audit run", "Color", "Completion", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.matches.map((m) => {
              const run = runFor(m.id);
              const decision = data.decisions.find((d) => d.audit_run_id === run?.id);
              return (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    {m.player1_name} vs {m.player2_name}
                  </td>
                  <td className="px-3 py-2">{m.tournament_name ?? "—"}</td>
                  <td className="px-3 py-2">{m.round ?? "—"}</td>
                  <td className="px-3 py-2">{m.surface ?? "—"}</td>
                  <td className="px-3 py-2">
                    <StateText state={m.identity_status} />
                  </td>
                  <td className="px-3 py-2">
                    <StateText state={m.surface_status} />
                  </td>
                  <td className="mono-num px-3 py-2 text-xs">{run ? `RUN ${run.run_number} · ${run.status}` : "—"}</td>
                  <td className="px-3 py-2">
                    <AuditColorBadge color={decision?.final_audit_color ?? "INCOMPLETE"} />
                  </td>
                  <td className="mono-num px-3 py-2 text-xs">{decision?.completion_percent ?? 0}%</td>
                  <td className="px-3 py-2 text-right">
                    {run ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/app/match/$matchId" params={{ matchId: m.id }}>
                          Open workspace
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => start.mutate(m.id)} disabled={start.isPending}>
                        Run Audit
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!data?.matches.length && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No matches ingested yet. Upload a summary PDF to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
