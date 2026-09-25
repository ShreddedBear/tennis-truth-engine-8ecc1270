/**
 * In-process scheduling for the Prediction Engine's paper-trading cycle. Extracted out of
 * index.ts's inline bootstrap block (unchanged behavior, same in-flight guard + interval +
 * startup-delay shape) into its own module -- mirroring historicalBackfillScheduler.ts and
 * matchedCohortSyncScheduler.ts -- so it can be exercised directly in tests and so it can honor
 * the shared BACKGROUND_JOB_MODE double-scheduling firewall the same way those two already do.
 *
 * Task #121 root cause (preserved from the original inline comment): this in-process trigger was
 * once deliberately removed in favor of a standalone, durably-logged job
 * (`src/jobs/runPaperTradingJob.ts`) intended to be invoked by a Replit Scheduled Deployment every
 * 15 minutes, independent of this server's uptime. That Scheduled Deployment was never configured
 * (a person must choose the deployment type), so the moment the trigger was removed the job simply
 * never ran again. Re-adding it here (inside the already-running API server process) gets real
 * predictions actually locking and grading again without creating a new deployment resource. This
 * reintroduces the original tradeoff (progress pauses across a server restart/crash), but a
 * paused-while-down job that resumes on restart is a far better outcome than one with no path to
 * ever running again. Every write inside runPaperTradingJob goes through the same idempotent lock
 * (unique fixture index) and pending-only settle guard the standalone job relies on, so having both
 * this in-process trigger and an external scheduler active (e.g. briefly during a migration to
 * BACKGROUND_JOB_MODE=external) cannot create duplicate or double-graded rows.
 *
 * `runPaperTradingJob` (not a bare cycle function) is used so every invocation still gets the same
 * durable `job_runs` row, retry-on-transient-failure behavior, and piggybacked Ledger grading the
 * standalone script provides -- GET /paper-trading/job-runs stays the one place to check for a
 * stalled pipeline, regardless of which process or trigger actually ran it.
 */
import { logger } from "../lib/logger.js";
import { runPaperTradingJob } from "./runPaperTradingJob.js";
import { isExternalSchedulingMode } from "./backgroundJobMode.js";
import type { JobTriggerType } from "./jobTriggerType.js";

export const PAPER_TRADING_INTERVAL_MS = 15 * 60_000;
const INITIAL_DELAY_MS = 10_000;

/**
 * Builds the cadence-tick trigger function: an in-process in-flight guard so a tick that fires
 * while the previous cycle is still running is skipped, never queued or run concurrently. The
 * returned trigger takes the triggerType PER CALL so the SAME in-flight flag is shared between the
 * startup setTimeout and the steady-state setInterval -- see parlayPaperTradingScheduler.ts's
 * identical note for why two separately-constructed triggers would silently reopen the overlap.
 */
export function createPaperTradingCycleTrigger(
  runJob: (triggerType: JobTriggerType) => Promise<{ ok: boolean }> = runPaperTradingJob,
): (triggerType: JobTriggerType) => void {
  let inFlight = false;
  return function triggerPaperTradingCycle(triggerType: JobTriggerType): void {
    if (inFlight) {
      logger.warn("Skipping paper-trading cycle tick: previous cycle is still running");
      return;
    }
    inFlight = true;
    runJob(triggerType)
      .catch((err) => {
        // runPaperTradingJob already records failures to job_runs; this catch only guards against
        // a truly unexpected throw escaping that (e.g. a DB write failure while recording the
        // failure itself) so it can never crash the server process.
        logger.error({ err }, "Paper-trading cycle threw unexpectedly outside its own error handling");
      })
      .finally(() => {
        inFlight = false;
      });
  };
}

export interface PaperTradingSchedulerHandle {
  intervalHandle: ReturnType<typeof setInterval> | null;
  initialTimeoutHandle: ReturnType<typeof setTimeout> | null;
}

/**
 * Called exactly once from index.ts's bootstrap(), which itself only runs once per process start
 * (app.listen's callback fires once). Honors the shared BACKGROUND_JOB_MODE double-scheduling
 * firewall (backgroundJobMode.ts): once external scheduling is enabled, this timer must never
 * register at all.
 */
export function startPaperTradingScheduler(
  runJob: (triggerType: JobTriggerType) => Promise<{ ok: boolean }> = runPaperTradingJob,
  env: NodeJS.ProcessEnv = process.env,
): PaperTradingSchedulerHandle {
  if (isExternalSchedulingMode(env)) {
    logger.info("Prediction Engine paper-trading scheduler: DISABLED (BACKGROUND_JOB_MODE=external)");
    return { intervalHandle: null, initialTimeoutHandle: null };
  }

  const trigger = createPaperTradingCycleTrigger(runJob);
  const intervalHandle = setInterval(() => trigger("interval"), PAPER_TRADING_INTERVAL_MS);
  // Fire once shortly after startup rather than waiting a full interval, so a server restart
  // doesn't add up to 15 minutes of extra silent gap on top of its own downtime.
  const initialTimeoutHandle = setTimeout(() => trigger("startup"), INITIAL_DELAY_MS);
  return { intervalHandle, initialTimeoutHandle };
}
