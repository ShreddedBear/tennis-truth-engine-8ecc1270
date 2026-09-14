// Browser-callable first-run seeding.
//
// The app shell calls this once on mount, exactly as it called ensureBootstrapped before.
// It is idempotent: each ensure* step returns immediately once its table has a row.
import { createServerFn } from "@tanstack/react-start";

export const ensureBootstrapped = createServerFn({ method: "POST" }).handler(async () => {
  const { ensureBootstrapped: seed } = await import("./bootstrap.server");
  const { LOCAL_WORKSPACE_ID } = await import("./constants");
  // The owner is the server's own constant, not something the browser supplies. It was a
  // caller-provided argument before, which meant the page decided whose calibration
  // baseline to write.
  await seed(LOCAL_WORKSPACE_ID);
  return { ok: true as const };
});
