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
          const rawReport = await runEvidenceCoverageRuntimeDiagnostic();
          const report = enrichEvidenceCoverageAccounting(rawReport) as any;
          // Keep the structured report while also exposing the fields consumed by
          // the production-proof workflow. This makes the proof contract explicit
          // instead of depending on a route/workflow shape mismatch.
          return json({
            ok: true,
            ...report,
            requested_classes: report?.sampling?.requested_classes ?? [],
            report,
          });
        } catch (error) {
          return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    },
  },
});