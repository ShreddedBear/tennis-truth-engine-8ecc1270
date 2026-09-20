import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { ensureRuntimeIndexLoaded, type WorkersAssetsBinding } from "./lib/runtime-tennis-index-data.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
function isServerFunctionRequest(request: Request): boolean {
  const contentType=request.headers.get("content-type")??"";
  return request.method==="POST"&&(contentType.includes("application/json")||request.headers.has("x-tanstack-start-server-fn")||request.headers.has("x-server-fn"));
}

async function normalizeCatastrophicSsrResponse(request:Request,response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  if(isServerFunctionRequest(request))return new Response(JSON.stringify({ok:false,error:{code:"SERVER_FUNCTION_FAILED",message:"The audit request failed before returning a valid result. Persisted progress is safe and can be resumed."}}),{
    status:500,
    headers:{"content-type":"application/json; charset=utf-8"},
  });
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Cloudflare Workers have no filesystem at request time; the generated tennis
      // runtime index (data/generated -> public/generated, see runtime-tennis-index-
      // data.server.ts) ships as a static asset and must be loaded via the ASSETS
      // binding before any request handler runs. Cheap after the first request per
      // isolate: the loader caches in module scope and short-circuits once populated.
      await ensureRuntimeIndexLoaded((env as { ASSETS?: WorkersAssetsBinding } | null | undefined)?.ASSETS);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(request,response);
    } catch (error) {
      console.error(error);
      if(isServerFunctionRequest(request))return new Response(JSON.stringify({ok:false,error:{code:"SERVER_FUNCTION_FAILED",message:error instanceof Error?error.message:"Server function failed"}}),{
        status:500,
        headers:{"content-type":"application/json; charset=utf-8"},
      });
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
