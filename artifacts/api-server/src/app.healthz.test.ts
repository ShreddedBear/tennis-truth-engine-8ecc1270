import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

// Regression: /api/healthz is the deployment's startup probe. It used to run behind
// clerkMiddleware, so a missing CLERK_SECRET_KEY made every health check return 500 and the
// platform treated the whole API as down.
test("GET /api/healthz returns 200 without any Clerk configuration", async () => {
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.CLERK_PUBLISHABLE_KEY;
  // The db module requires a URL at import time but only connects on first query.
  process.env.DATABASE_URL ??= "postgres://unused@127.0.0.1:1/unused";

  const { default: app } = await import("./app");
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/healthz`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  } finally {
    server.close();
  }
});

// Regression: without CLERK_SECRET_KEY every route (not just signed-in ones) returned 500.
// Public routes must keep working, and a route that needs a Clerk user must still refuse.
test("missing Clerk configuration keeps public routes up and signed-in routes closed", async () => {
  delete process.env.CLERK_SECRET_KEY;
  process.env.DATABASE_URL ??= "postgres://unused@127.0.0.1:1/unused";

  const { default: app } = await import("./app");
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const { port } = server.address() as AddressInfo;

    const health = await fetch(`http://127.0.0.1:${port}/api/health/system`);
    assert.notEqual(health.status, 500, "public route must not fail because Clerk is unconfigured");

    const signedIn = await fetch(`http://127.0.0.1:${port}/api/payments/me/status`);
    assert.ok(signedIn.status >= 400, `signed-in route must refuse, got ${signedIn.status}`);
  } finally {
    server.close();
  }
});
