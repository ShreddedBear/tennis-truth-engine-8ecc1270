import { createServerFn } from "@tanstack/react-start";

/**
 * Capture real match results and resolve the Truth Engine decisions that depend on them.
 *
 * Read-only with respect to prediction: it writes matches.actual_winner and result_grades
 * and touches nothing the engine used to decide. Safe to run repeatedly -- a match that
 * already holds a result is left alone, and an existing grade row is updated in place.
 */
export const captureMatchResults = createServerFn({ method: "POST" }).handler(async () => {
  const { runResultCapture } = await import("./match-result-capture.server");
  return { ok: true as const, summary: await runResultCapture() };
});
