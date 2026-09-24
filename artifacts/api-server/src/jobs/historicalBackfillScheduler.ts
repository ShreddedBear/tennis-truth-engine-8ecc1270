/**
 * In-process scheduling for `historical_matches` ingestion (Task #144's fallback -- see
 * `runHistoricalBackfillJob.ts`'s own doc comment for why an in-process timer exists at all: no
 * Replit Scheduled Deployment has been configured, so this keeps the record advancing today).
 *
 * Cadence hardened from 24h to 30 minutes (result-ingestion cadence audit). The job's own window
 * design already bounds real work to at most once per calendar day becoming newly eligible --
 * `runIncrementalHistoricalBackfill`'s `dateStop` is always `now - 24h` (truncated to a date), so
 * under normal operation `dateStart..dateStop` is exactly one day wide no matter how often this
 * fires. A shorter cadence therefore does NOT cause redundant provider fetches, a full-history
 * rescan, or provider-rate abuse -- it only shrinks how long after UTC midnight (the moment a new
 * day's results become nominally fetchable) this job gets a chance to notice and fetch them.
 * Confirmed empirically from real `job_runs` history: a caught-up tick (nothing new yet) completes
 * in well under 30ms -- a single `getLatestCoveredMatchDate` read plus a skip -- while the one real
 * per-day fetch-and-insert costs on the order of ~4 minutes for a full day's completed matches.
 * That real cost is unaffected by cadence; only the AVOIDABLE alignment-drift delay (up to ~24h
 * under the old fixed-24h-interval cadence, since the interval's phase has no relationship to UTC
 * midnight) shrinks, to at most ~30 minutes.
 *
 * Real production lag this was meant to address: Builder's own recently-graded rows showed a
 * ~6.4-hour gap between a match's scheduled start and when it was actually graded, almost entirely
 * attributable to how long `historical_matches` took to receive the completed result -- Builder's
 * and Prediction Engine's own 15-minute cycles are not the bottleneck; this ingestion cadence was.
 *
 * Structurally mirrors the paper-trading/calibration-refit in-process triggers already in
 * `index.ts` (same in-flight guard + interval + startup-delay shape) -- extracted into its own
 * module, unlike those, so the interval and overlap-guard behavior can be exercised directly in
 * tests without spinning up the whole server bootstrap.
 */
import { logger } from "../lib/logger.js";
import { runHistoricalBackfillJob } from "./runHistoricalBackfillJob.js";

export const HISTORICAL_BACKFILL_INTERVAL_MS = 30 * 60_000;
const INITIAL_DELAY_MS = 20_000;

/**
 * Builds the cadence-tick trigger function: an in-process in-flight guard so a tick that fires
 * while the previous cycle is still running is skipped, never queued or run concurrently. Exported
 * as a factory, not a module-level singleton, so tests can construct independent instances with
 * independent in-flight state, and so a fake `runJob` can be injected instead of hitting the real
 * provider/database.
 */
export function createHistoricalBackfillCycleTrigger(
  runJob: () => Promise<{ ok: boolean }> = runHistoricalBackfillJob,
): () => void {
  let inFlight = false;
  return function triggerHistoricalBackfillCycle(): void {
    if (inFlight) {
      logger.warn("Skipping historical-backfill cycle tick: previous cycle is still running");
      return;
    }
    inFlight = true;
    runJob()
      .catch((err) => {
        // runHistoricalBackfillJob already records failures to job_runs; this catch only guards
        // against a truly unexpected throw escaping that, so it can never crash the server process.
        logger.error({ err }, "Historical-backfill cycle threw unexpectedly outside its own error handling");
      })
      .finally(() => {
        inFlight = false;
      });
  };
}

export interface HistoricalBackfillSchedulerHandle {
  intervalHandle: ReturnType<typeof setInterval>;
  initialTimeoutHandle: ReturnType<typeof setTimeout>;
}

/**
 * Called exactly once from index.ts's bootstrap(), which itself only runs once per process start
 * (app.listen's callback fires once) -- the same non-multiplying guarantee every other in-process
 * scheduler in this file already relies on; no additional guard invented here. Unlike the Builder
 * paper-trading scheduler, this job has no enable/disable flag -- it has run unconditionally since
 * Task #144, and this change doesn't introduce one.
 */
export function startHistoricalBackfillScheduler(
  runJob: () => Promise<{ ok: boolean }> = runHistoricalBackfillJob,
): HistoricalBackfillSchedulerHandle {
  const trigger = createHistoricalBackfillCycleTrigger(runJob);
  const intervalHandle = setInterval(trigger, HISTORICAL_BACKFILL_INTERVAL_MS);
  // Fire once shortly after startup too, offset from the paper-trading/calibration startup
  // triggers so they don't all hit the provider at once -- unchanged from before this hardening.
  const initialTimeoutHandle = setTimeout(trigger, INITIAL_DELAY_MS);
  return { intervalHandle, initialTimeoutHandle };
}
