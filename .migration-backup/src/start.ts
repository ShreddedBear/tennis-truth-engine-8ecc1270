import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next, context }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    if ((context as { handlerType?: string } | undefined)?.handlerType === "serverFn") {
      return new Response(JSON.stringify({ ok: false, error: { code: "SERVER_FUNCTION_FAILED", message: error instanceof Error ? error.message : "Server function failed" } }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// NO FUNCTION MIDDLEWARE.
//
// This used to carry attachSupabaseAuth, which read a Supabase session in the browser and
// attached its access token as a bearer header on every server-function call. There is no
// Supabase session to read any more, and there never was one in practice: production holds
// zero auth.users, so getSession() always returned null and the header was never attached.
//
// The application's ownership model is a single constant, LOCAL_WORKSPACE_ID, applied
// server-side -- not a per-request identity. Adding an authentication system to replace a
// token that was never issued would change how the app behaves for its one user without
// protecting anything, so the access model is stated rather than invented: every request is
// the workspace owner, and the security boundary is the server/client split, which the
// CSRF middleware below and the server-only import rules enforce.
export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
