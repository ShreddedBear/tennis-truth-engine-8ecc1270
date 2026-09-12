import { createFileRoute } from "@tanstack/react-router";
import { runEvidenceCoverageRuntimeDiagnostic } from "@/lib/evidence-coverage-runtime-diagnostic.server";
import { enrichEvidenceCoverageAccounting } from "@/lib/evidence-availability-accounting";
import { checkApiKey } from "@/lib/api-key-auth";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/evidence-coverage-diagnostic")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const auth = checkApiKey("EVIDENCE_COVERAGE_KEY", url.searchParams.get("key"));
        if (!auth.ok) return json(auth.body, auth.status);
        try {
          const rawReport = await runEvidenceCoverageRuntimeDiagnostic();
          const report = enrichEvidenceCoverageAccounting(rawReport);
          return json({ ok: true, report });
        } catch (error) {
          return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    },
  },
});
