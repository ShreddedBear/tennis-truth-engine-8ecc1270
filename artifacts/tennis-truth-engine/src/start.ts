import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { createHmac, timingSafeEqual } from "node:crypto";

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

function isTruthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

function hasOwnerHeaders(request: Request): boolean {
  if (!isTruthy(process.env.OWNER_REPLIT_AUTO_AUTH)) return false;
  const ownerId = process.env.OWNER_REPLIT_USER_ID?.trim();
  const ownerName = process.env.OWNER_REPLIT_USER_NAME?.trim().toLowerCase();
  if (!ownerId && !ownerName) return false;
  if (ownerId && request.headers.get("x-replit-user-id") !== ownerId) return false;
  if (ownerName && request.headers.get("x-replit-user-name")?.toLowerCase() !== ownerName) return false;
  return true;
}

function hasValidAdminCookie(request: Request): boolean {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;

  const cookie = request.headers.get("cookie")?.split(";").find((part) => part.trim().startsWith("admin_session="));
  if (!cookie) return false;

  const encoded = cookie.slice(cookie.indexOf("=") + 1);
  let signed: string;
  try {
    signed = decodeURIComponent(encoded);
  } catch {
    return false;
  }
  if (!signed.startsWith("s:")) return false;

  const valueAndSignature = signed.slice(2);
  const separator = valueAndSignature.lastIndexOf(".");
  if (separator < 1) return false;
  const value = valueAndSignature.slice(0, separator);
  const actual = valueAndSignature.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(value).digest("base64").replace(/=+$/u, "");
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return value === "ok"
    && actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

/**
 * Truth Engine shares the Stats Engine's owner-only admin session. Verifying it
 * here protects direct deep links and every browser-callable server function,
 * not just the navigation item.
 */
const adminMiddleware = createMiddleware().server(async ({ next, request, context }) => {
  if (hasOwnerHeaders(request) || hasValidAdminCookie(request)) return await next();

  if ((context as { handlerType?: string } | undefined)?.handlerType === "serverFn") {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED", message: "Admin login required" } }),
      { status: 401, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }

  const currentUrl = new URL(request.url);
  const nextPath = `${currentUrl.pathname}${currentUrl.search}`;
  const loginUrl = `/admin/login?next=${encodeURIComponent(nextPath)}`;
  const encodedLoginUrl = JSON.stringify(loginUrl).replace(/</gu, "\\u003c");
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Admin login required</title></head><body><p>Admin login required. <a href="${loginUrl}">Continue to login</a>.</p><script>window.location.replace(${encodedLoginUrl})</script></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, adminMiddleware, csrfMiddleware],
}));
