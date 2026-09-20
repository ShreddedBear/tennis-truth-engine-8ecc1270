import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StateText } from "@/components/StatusBadge";

export const Route = createFileRoute("/app/rules")({
  head: () => ({
    meta: [
      { title: "Rule Knowledge Base — Tennis Matrix Audit System" },
      { name: "description", content: "Active rule document versions: verification metrics, verification audit, disagreement/trap audit and calibration record, parsed rule by rule." },
      { property: "og:title", content: "Rule Knowledge Base — Tennis Matrix Audit System" },
      { property: "og:description", content: "Every audit run clones the active rule set, so past runs stay reproducible." },
    ],
  }),
  component: Rules,
});

function Rules() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["rules"],
    queryFn: async () => {
      const { data: docs } = await supabase.from("rule_documents").select("*").order("doc_type");
      const { data: versions } = await supabase.from("rule_document_versions").select("*").order("version_number");
      const { data: rules } = await supabase.from("rules").select("*").order("rule_code");
      return { docs: docs ?? [], versions: versions ?? [], rules: rules ?? [] };
    },
  });

  const activeVersion = (docId: string) => data?.versions.find((v) => v.document_id === docId && v.is_active);
  const current = selected ?? data?.docs[0]?.id ?? null;
  const version = current ? activeVersion(current) : null;
  const rules = data?.rules.filter((r) => r.version_id === version?.id) ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Rule knowledge base</h1>
        <p className="text-sm text-muted-foreground">
          Rules are parsed deterministically from the uploaded documents. A version with an incomplete parse cannot be
          activated, so a run never silently skips a rule.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {data?.docs.map((d) => {
          const v = activeVersion(d.id);
          return (
            <button
              key={d.id}
              onClick={() => setSelected(d.id)}
              className={`rounded-md border px-3 py-2 text-left text-sm ${
                current === d.id ? "border-primary bg-muted" : "border-border"
              }`}
            >
              <p className="font-medium">{d.title}</p>
              <p className="mono-num text-xs text-muted-foreground">
                {d.doc_type} · v{v?.version_number ?? "—"} · {v?.parsed_rules ?? 0} rules
              </p>
            </button>
          );
        })}
      </div>

      {version && (
        <div className="panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Version {version.version_number}</h2>
            <div className="flex items-center gap-2 text-xs">
              <StateText state={version.activation_status} />
              <span className="mono-num text-muted-foreground">
                declared {version.expected_rules} · parsed {version.parsed_rules}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-header text-header-foreground">
            <tr className="text-left">
              {["#", "Rule", "Category", "Severity", "Blocking", "Text"].map((h) => (
                <th key={h} className="px-2 py-2 text-xs font-semibold uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="mono-num px-2 py-1 text-xs">{r.rule_code}</td>
                <td className="px-2 py-1 font-medium">{r.rule_name}</td>
                <td className="px-2 py-1 text-xs">{r.category ?? "—"}</td>
                <td className="px-2 py-1 text-xs">{r.severity}</td>
                <td className="px-2 py-1 text-xs">{r.blocking ? "BLOCKING" : "STANDARD"}</td>
                <td className="max-w-xl px-2 py-1 text-xs text-muted-foreground">{r.body}</td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No parsed rules for this document version.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
