/**
 * In-process scheduling for the matched-cohort sync job -- structurally separate from BOTH the
 * Prediction Engine's in-process trigger and the Builder's `parlayPaperTradingScheduler.ts` (own
 * in-flight guard, own interval, own startup delay, never sharing state with either). This mirrors
 * `historicalBackfillScheduler.ts`'s shape, extracted into its own module (rather than left inline
 * in index.ts) so the interval and overlap-guard behavior can be exercised directly in tests.
 *
 * ~30 minute cadence, matching the task's own guidance -- the matched cohort is a downstream,
 * read-only-derived analytics layer, not itself time-critical (unlike PE/Builder's own 15-minute
 * cycles, which must lock predictions before a real match starts). A 30-minute cadence keeps newly
 * matched fixtures and newly-graded outcomes reasonably fresh without adding meaningful DB load.
 */
import { logger } from "../lib/logger.js";
import { runMatchedCohortSyncJob } from "./runMatchedCohortSyncJob.js";
import { isExternalSchedulingMode } from "./backgroundJobMode.js";
import type { JobTriggerType } from "./jobTriggerType.js";

export const MATCHED_COHORT_SYNC_INTERVAL_MS = 30 * 60_000;
const INITIAL_DELAY_MS = 40_000;

/**
 * Builds the cadence-tick trigger function: an in-process in-flight guard so a tick that fires
 * while the previous cycle is still running is skipped, never queued or run concurrently. Exported
 * as a factory (not a module-level singleton) so tests can construct independent instances with
 * independent in-flight state and inject a fake `runJob`.
 *
 * The returned trigger takes the triggerType PER CALL so the SAME in-flight flag is shared between
 * the startup setTimeout and the steady-state setInterval -- see parlayPaperTradingScheduler.ts's
 * identical note for why two separately-constructed triggers would silently reopen the overlap.
 */
export function createMatchedCohortSyncCycleTrigger(
  runJob: (triggerType: JobTriggerType) => Promise<{ ok: boolean }> = runMatchedCohortSyncJob,
): (triggerType: JobTriggerType) => void {
  let inFlight = false;
  return function triggerMatchedCohortSyncCycle(triggerType: JobTriggerType): void {
    if (inFlight) {
      logger.warn("Skipping matched-cohort sync cycle tick: previous cycle is still running");
      return;
    }
    inFlight = true;
    runJob(triggerType)
      .catch((err) => {
        // runMatchedCohortSyncJob already records failures to job_runs; this catch only guards
        // against a truly unexpected throw escaping that, so it can never crash the server process.
        logger.error({ err }, "Matched-cohort sync cycle threw unexpectedly outside its own error handling");
      })
      .finally(() => {
        inFlight = false;
      });
  };
}

export interface MatchedCohortSyncSchedulerHandle {
  intervalHandle: ReturnType<typeof setInterval> | null;
  initialTimeoutHandle: ReturnType<typeof setTimeout> | null;
}

/**
 * Called exactly once from index.ts's bootstrap(), which itself only runs once per process start
 * -- the same non-multiplying guarantee every other in-process scheduler in this file relies on.
 * Honors the shared BACKGROUND_JOB_MODE double-scheduling firewall (backgroundJobMode.ts): once
 * external scheduling is enabled, this timer must never register at all.
 */
export function startMatchedCohortSyncScheduler(
  runJob: (triggerType: JobTriggerType) => Promise<{ ok: boolean }> = runMatchedCohortSyncJob,
  env: NodeJS.ProcessEnv = process.env,
): MatchedCohortSyncSchedulerHandle {
  if (isExternalSchedulingMode(env)) {
    logger.info("Matched-cohort sync scheduler: DISABLED (BACKGROUND_JOB_MODE=external)");
    return { intervalHandle: null, initialTimeoutHandle: null };
  }

  const trigger = createMatchedCohortSyncCycleTrigger(runJob);
  const intervalHandle = setInterval(() => trigger("interval"), MATCHED_COHORT_SYNC_INTERVAL_MS);
  // Offset from the paper-trading/calibration-refit/historical-backfill startup triggers so they
  // don't all hit the database at once on a cold start.
  const initialTimeoutHandle = setTimeout(() => trigger("startup"), INITIAL_DELAY_MS);
  return { intervalHandle, initialTimeoutHandle };
}
