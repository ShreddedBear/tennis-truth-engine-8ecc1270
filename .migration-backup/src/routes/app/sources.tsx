import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StateText } from "@/components/StatusBadge";

export const Route = createFileRoute("/app/sources")({
  head: () => ({
    meta: [
      { title: "Sources & Conflicts — Tennis Matrix Audit System" },
      { name: "description", content: "Source snapshots behind each audit plus every recorded source conflict and its resolution state." },
      { property: "og:title", content: "Sources & Conflicts — Tennis Matrix Audit System" },
      { property: "og:description", content: "Unresolved critical conflicts block completion for that match only." },
    ],
  }),
  component: Sources,
});

function Sources() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const [{ data: snapshots }, { data: conflicts }] = await Promise.all([
        supabase.from("source_snapshots").select("*").order("retrieved_at", { ascending: false }).limit(200),
        supabase.from("source_conflicts").select("*").order("created_at", { ascending: false }).limit(200),
      ]);
      return { snapshots: snapshots ?? [], conflicts: conflicts ?? [] };
    },
  });

  const resolve = async (id: string, resolution: string) => {
    await supabase
      .from("source_conflicts")
      .update({ resolution_status: resolution } as never)
      .eq("id", id);
    toast.success(`Conflict marked ${resolution}`);
    qc.invalidateQueries({ queryKey: ["sources"] });
  };

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-xl font-semibold">Source conflicts</h1>
        <p className="text-sm text-muted-foreground">
          Conflicting values are never silently averaged. Critical conflicts must be resolved or the match cannot complete.
        </p>
        <div className="panel mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-header text-header-foreground">
              <tr className="text-left">
                {["Field", "Values", "Selected", "Severity", "Status", ""].map((h) => (
                  <th key={h} className="px-2 py-2 text-xs font-semibold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.conflicts.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-2 py-1">{c.data_key}</td>
                  <td className="px-2 py-1">{JSON.stringify(c.values)}</td>
                  <td className="px-2 py-1">{c.selected_value ?? "—"}</td>
                  <td className="px-2 py-1 text-xs">{c.critical ? "CRITICAL" : "STANDARD"}</td>
                  <td className="px-2 py-1"><StateText state={c.resolution_status} /></td>
                  <td className="px-2 py-1 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => resolve(c.id, "RESOLVED")}>Resolve</Button>
                      <Button size="sm" variant="ghost" onClick={() => resolve(c.id, "UNRESOLVABLE")}>Unresolvable</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data?.conflicts.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">No conflicts recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Source snapshots</h2>
        <div className="panel mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-header text-header-foreground">
              <tr className="text-left">
                {["Captured", "Source", "Key", "Value", "Reliability"].map((h) => (
                  <th key={h} className="px-2 py-2 text-xs font-semibold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.snapshots.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="mono-num px-2 py-1 text-xs whitespace-nowrap">{new Date(s.retrieved_at).toLocaleString()}</td>
                  <td className="px-2 py-1">{s.source_name}</td>
                  <td className="px-2 py-1 text-xs">{s.data_key}</td>
                  <td className="mono-num max-w-md truncate px-2 py-1 text-xs text-muted-foreground">{s.normalized_value ?? s.raw_value ?? "—"}</td>
                  <td className="px-2 py-1 text-xs">{s.reliability ?? "—"}</td>
                </tr>
              ))}
              {!data?.snapshots.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">No snapshots captured yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
