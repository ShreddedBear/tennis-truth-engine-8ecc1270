/**
 * How a given job_runs row's cycle was actually invoked -- shared across every background job
 * (Prediction Engine paper trading, Builder paper trading, historical-backfill, matched-cohort
 * sync) so `job_runs.trigger_type` means the same thing everywhere instead of being inferred after
 * the fact from timing heuristics.
 *
 *   startup           -- the in-process scheduler's post-boot setTimeout fire.
 *   interval          -- the in-process scheduler's steady-state setInterval fire.
 *   external_schedule -- the standalone CLI entry point, invoked by an external scheduler (a
 *                         Replit Scheduled Deployment or equivalent) OR by a human running the
 *                         same `job:*`/`job:*:dev` command by hand to simulate exactly that --
 *                         both use the identical entry point and are indistinguishable from
 *                         inside the process, so both are honestly labeled this way rather than
 *                         guessing which one happened.
 *   manual            -- reserved for a future explicit manual-trigger code path (e.g. an admin
 *                         route), not currently wired to anything.
 *   unknown           -- the job function was called directly (e.g. from a test or a REPL)
 *                         without going through either scheduling path.
 */
export type JobTriggerType = "startup" | "interval" | "external_schedule" | "manual" | "unknown";
