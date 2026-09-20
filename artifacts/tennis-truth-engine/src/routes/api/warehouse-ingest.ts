import { createFileRoute } from "@tanstack/react-router";
import { runHistoricalHardPull, type SourceId, type OfficialSnapshot } from "@/lib/ingestion/orchestrator.server";
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
const SNAPSHOT_SOURCES = new Set<SourceId>(["atp", "atp_challenger", "atp_rankings"]);
const MAX_SNAPSHOTS = 6;
const MAX_ENCODED_BYTES = 12_000_000;
const MAX_HTML_BYTES = 12_000_000;

type EncodedSnapshot = { source?: string; url?: string; encoding?: string; body?: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function bridgeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const fields = ["message", "code", "details", "hint"]
      .map((key) => [key, value[key]] as const)
      .filter(([, field]) => field !== undefined && field !== null && String(field).trim());
    if (fields.length) return fields.map(([key, field]) => `${key}=${String(field)}`).join(" | ");
    try { return JSON.stringify(value); } catch {}
  }
  return String(error);
}

function base64Bytes(value:string) {
  const binary=atob(value);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}
async function decodeSnapshot(input:EncodedSnapshot, requested:Set<SourceId>):Promise<OfficialSnapshot> {
  const source=(input.source??"").trim() as SourceId;
  const url=(input.url??"").trim();
  if(!SNAPSHOT_SOURCES.has(source) || !requested.has(source)) throw new Error(`Unexpected official snapshot source: ${source || "missing"}`);
  if(input.encoding!=="gzip-base64") throw new Error("Official snapshot encoding must be gzip-base64");
  if(!url || typeof input.body!=="string" || !input.body.length) throw new Error("Official snapshot URL/body is required");
  if(input.body.length>MAX_ENCODED_BYTES) throw new Error(`Official snapshot compressed body is too large for ${source}`);
  const decompressed=new Blob([base64Bytes(input.body)]).stream().pipeThrough(new DecompressionStream("gzip"));
  const html=await new Response(decompressed).text();
  if(html.length>MAX_HTML_BYTES) throw new Error(`Official snapshot HTML is too large for ${source}`);
  return {source,url,html} as OfficialSnapshot;
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

        let payload: { sources?: string[]; official_snapshots?: EncodedSnapshot[] };
        try {
          payload = (await request.json()) as { sources?: string[]; official_snapshots?: EncodedSnapshot[] };
        } catch {
          return json({ ok: false, error: "Request body must be JSON" }, 400);
        }

        const sources = (payload.sources ?? []).map((source) => source.trim()).filter(Boolean) as SourceId[];
        if (!sources.length) return json({ ok: false, error: "At least one ingestion source is required" }, 400);

        const uniqueSources = [...new Set(sources)];
        for (const source of uniqueSources) {
          if (!ALLOWED_SOURCES.has(source)) return json({ ok: false, error: `Unsupported ingestion source: ${source}` }, 400);
        }

        const encodedSnapshots=payload.official_snapshots??[];
        if(encodedSnapshots.length>MAX_SNAPSHOTS) return json({ok:false,error:"Too many official browser snapshots"},400);
        let officialSnapshots:OfficialSnapshot[]=[];
        try {
          const requested=new Set(uniqueSources);
          officialSnapshots=await Promise.all(encodedSnapshots.map(snapshot=>decodeSnapshot(snapshot,requested)));
        } catch(error) {
          return json({ok:false,error:error instanceof Error?error.message:"Invalid official browser snapshot"},400);
        }

        try {
          const result = await runHistoricalHardPull(uniqueSources, { officialSnapshots });
          return json({ ok: true, sources: uniqueSources, result });
        } catch (error) {
          console.error("[warehouse-ingest] ingestion failed", error);
          return json({ ok: false, error: bridgeErrorMessage(error) }, 500);
        }
      },
    },
  },
});
