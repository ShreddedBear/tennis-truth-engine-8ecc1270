import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StateText } from "@/components/StatusBadge";

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
  const { data } = useQuery({
    queryKey: ["logs"],
    queryFn: async () => {
      const { data: logs } = await supabase
        .from("execution_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      return logs ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Execution logs</h1>
        <p className="text-sm text-muted-foreground">
          Each row proves a stage ran. The Matrix-visible flag makes any firewall violation detectable after the fact.
        </p>
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
            {data?.map((l) => (
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
            {!data?.length && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">No executions logged yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
