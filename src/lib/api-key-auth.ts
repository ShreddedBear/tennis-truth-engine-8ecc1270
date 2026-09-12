/**
 * Shared-secret check for the admin/diagnostic HTTP routes.
 *
 * These routes used to compare the query key against a STRING LITERAL IN THIS REPOSITORY.
 * That was not a history problem to be cleaned up later -- it was live: anyone who could
 * read the repo could call them, and one of them republishes the METRICS rule document and
 * invalidates audit runs. The retired values are named only in api-key-auth.test.ts, which
 * exists to stop them (or anything shaped like them) coming back.
 *
 * The expected value now comes from the environment, and the check FAILS CLOSED: with no
 * secret configured the route is refused rather than silently opened. That matches the
 * behaviour /api/drive-audit-batch already had.
 */
export type KeyCheck =
  | { ok: true }
  | { ok: false; status: number; body: { ok: false; error?: string } };

/** Length-independent comparison, so a wrong key cannot be narrowed down by timing. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let differing = 0;
  for (let i = 0; i < a.length; i++) differing |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return differing === 0;
}

/**
 * @param envName  the variable holding the expected key
 * @param supplied the key the caller presented, or null
 */
export function checkApiKey(envName: string, supplied: string | null): KeyCheck {
  const expected = process.env[envName];
  if (!expected) {
    // 503, not 404: an unconfigured route is a deployment problem the operator should see,
    // and saying so leaks nothing -- the route's existence is already public.
    return { ok: false, status: 503, body: { ok: false, error: `${envName} is not configured; refusing to serve this route.` } };
  }
  if (!supplied || !constantTimeEquals(supplied, expected)) {
    // 404, as before: an unauthenticated caller learns nothing about whether the route exists.
    return { ok: false, status: 404, body: { ok: false } };
  }
  return { ok: true };
}
