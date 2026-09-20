/**
 * Client-side error reporting.
 *
 * This replaces lovable-error-reporting.ts, which called
 * `window.__lovableEvents.captureException` -- a hook that only exists inside Lovable's
 * preview iframe and was therefore a no-op everywhere the app actually runs, production
 * included.
 *
 * Rather than swap one vendor hook for another, this reports to the console with a stable
 * prefix and a structured payload, so the boundary and route that produced an error are
 * visible in the browser console and in any log collector that reads it. If a real error
 * service is ever added, this is the one place that changes.
 */
export function reportClientError(error: unknown, context: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const payload = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    route: window.location?.pathname,
    at: new Date().toISOString(),
    ...context,
  };
  console.error("[client-error]", payload);
}
