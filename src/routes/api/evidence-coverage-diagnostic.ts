import { createFileRoute } from "@tanstack/react-router";
import { runEvidenceCoverageRuntimeDiagnostic } from "@/lib/evidence-coverage-runtime-diagnostic.server";
import { enrichEvidenceCoverageAccounting } from "@/lib/evidence-availability-accounting";

const DIAGNOSTIC_KEY = "ECOV-20260825-b6f1";

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
        if (url.searchParams.get("key") !== DIAGNOSTIC_KEY) return json({ ok: false }, 404);
        try {
          const report = await runEvidenceCoverageRuntimeDiagnostic();
          return json({ ok: true, report: enrichEvidenceCoverageAccounting(report) });
        } catch (error) {
          return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    },
  },
});
