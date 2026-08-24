import { createFileRoute } from "@tanstack/react-router";
import { runHistoricalHardPull, type SourceId } from "@/lib/ingestion/orchestrator.server";
import { verifyGithubActionsOidc } from "@/lib/github-oidc.server";

const ALLOWED_SOURCES = new Set<SourceId>([
  "open_meteo",
  "odds_api",
  "atp",
  "wta",
  "atp_challenger",
  "atp_rankings",
  "wta_rankings",
  "itf_rules",
  "atp_rules",
  "wta_rules",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/warehouse-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return json({ ok: false, error: "Missing GitHub OIDC bearer token" }, 401);

        try {
          await verifyGithubActionsOidc(auth.slice("Bearer ".length).trim());
        } catch (error) {
          return json({ ok: false, error: error instanceof Error ? error.message : "GitHub OIDC verification failed" }, 403);
        }

        let payload: { sources?: string[] };
        try {
          payload = (await request.json()) as { sources?: string[] };
        } catch {
          return json({ ok: false, error: "Request body must be JSON" }, 400);
        }

        const sources = (payload.sources ?? []).map((source) => source.trim()).filter(Boolean) as SourceId[];
        if (!sources.length) return json({ ok: false, error: "At least one ingestion source is required" }, 400);

        const uniqueSources = [...new Set(sources)];
        for (const source of uniqueSources) {
          if (!ALLOWED_SOURCES.has(source)) return json({ ok: false, error: `Unsupported ingestion source: ${source}` }, 400);
        }

        try {
          const result = await runHistoricalHardPull(uniqueSources);
          return json({ ok: true, sources: uniqueSources, result });
        } catch (error) {
          console.error("[warehouse-ingest] ingestion failed", error);
          return json({ ok: false, error: error instanceof Error ? error.message : "Warehouse ingestion failed" }, 500);
        }
      },
    },
  },
});
