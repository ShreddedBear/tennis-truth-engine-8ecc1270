import { logger } from "../lib/logger.js";
import { isExternalSchedulingMode } from "./backgroundJobMode.js";
import { runRecentCompletedResultsJob } from "./runRecentCompletedResultsJob.js";
import type { JobTriggerType } from "./jobTriggerType.js";

export const RECENT_COMPLETED_RESULTS_INTERVAL_MS = 5 * 60_000;
const INITIAL_DELAY_MS = 35_000;

export function createRecentCompletedResultsCycleTrigger(
  runJob: (triggerType: JobTriggerType) => Promise<{ ok: boolean }> = runRecentCompletedResultsJob,
): (triggerType: JobTriggerType) => void {
  let inFlight = false;
  return (triggerType) => {
    if (inFlight) {
      logger.warn("Skipping recent completed-results tick: previous cycle is still running");
      return;
    }
    inFlight = true;
    runJob(triggerType)
      .catch((err) => {
        logger.error({ err }, "Recent completed-results cycle threw unexpectedly");
      })
      .finally(() => {
        inFlight = false;
      });
  };
}

export interface RecentCompletedResultsSchedulerHandle {
  enabled: boolean;
  intervalHandle: ReturnType<typeof setInterval> | null;
  initialTimeoutHandle: ReturnType<typeof setTimeout> | null;
}

/** In-process fallback; disabled when an external scheduler owns the cadence. */
export function startRecentCompletedResultsScheduler(
  env: NodeJS.ProcessEnv = process.env,
): RecentCompletedResultsSchedulerHandle {
  if (isExternalSchedulingMode(env)) {
    logger.info("Recent completed-results scheduler: DISABLED (BACKGROUND_JOB_MODE=external)");
    return { enabled: false, intervalHandle: null, initialTimeoutHandle: null };
  }

  logger.info({ cadence: "5m" }, "Recent completed-results scheduler: ENABLED cadence=5m");
  const trigger = createRecentCompletedResultsCycleTrigger();
  const intervalHandle = setInterval(
    () => trigger("interval"),
    RECENT_COMPLETED_RESULTS_INTERVAL_MS,
  );
  const initialTimeoutHandle = setTimeout(() => trigger("startup"), INITIAL_DELAY_MS);
  return { enabled: true, intervalHandle, initialTimeoutHandle };
}