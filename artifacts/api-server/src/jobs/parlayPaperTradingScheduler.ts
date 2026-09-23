/**
 * The deliberate, explicitly-enabled in-process scheduling mechanism for the Builder
 * paper-trading job. Replit Scheduled Deployment infrastructure is unavailable to both this
 * assistant and the in-workspace agent (neither has a tool to create/configure one -- confirmed
 * live), so rather than pretend an external scheduler exists, this reintroduces the same
 * architectural pattern already used for the Prediction Engine's own paper-trading job in
 * index.ts (setInterval + an immediate post-startup setTimeout, guarded by an in-process
 * in-flight boolean) -- see that file's own comment for the identical precedent and tradeoff
 * (progress pauses across a restart/crash, which is far better than a job with zero path to
 * ever running again).
 *
 * The one thing that precedent does NOT provide, and this MUST: Autoscale can run multiple
 * server instances simultaneously, so an in-memory in-flight boolean only stops one process from
 * overlapping itself -- it does nothing to stop two different instances from both starting a
 * cycle at the same cadence tick. runWithAdvisoryLock (advisoryLock.ts) closes that gap with a
 * Postgres session-level advisory lock that lives in the database, not in either process's
 * memory, and self-releases if an instance crashes (no TTL/heartbeat needed). Existing DB
 * uniqueness protections (parlay_paper_trades_fixture_side_lineage_idx et al.) remain the final
 * safety layer regardless -- this lock is a cost-saving/cleanliness measure (avoid two instances
 * redundantly re-acquiring the same evidence), not the only thing standing between the system
 * and a duplicate row.
 *
 * Never modifies, wraps, or shares any mutable state with the Prediction Engine's own scheduler
 * -- a structurally separate trigger, separate advisory lock key, separate in-flight flag,
 * calling only the existing, untouched five-phase runParlayPaperTradingJob.
 */
import { pool } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { runParlayPaperTradingJob, resolveSourceCommit } from "./runParlayPaperTradingJob.js";
import { runWithAdvisoryLock } from "./advisoryLock.js";

/**
 * Fixed, arbitrary bigint reserved exclusively for the Builder paper-trading cycle's
 * cross-instance execution guard. Must never be reused for any other advisory lock in this
 * codebase -- pg_try_advisory_lock keys share one flat namespace per database.
 */
export const PARLAY_PAPER_TRADING_ADVISORY_LOCK_KEY = 481516234n;

export const PARLAY_PAPER_TRADING_SCHEDULER_INTERVAL_MS = 15 * 60_000;
const INITIAL_DELAY_MS = 10_000;

export function isParlayPaperTradingSchedulerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env["ENABLE_PARLAY_BUILDER_PAPER_TRADING_SCHEDULER"] === "true";
}

/** Real DB-backed run, used by the actual server. Not itself unit-tested against a live DB -- the lock semantics it delegates to (runWithAdvisoryLock) are, and this is a thin, direct wire-up. */
export async function runParlayPaperTradingCycleWithLock(sourceCommit: string) {
  return runWithAdvisoryLock(pool, PARLAY_PAPER_TRADING_ADVISORY_LOCK_KEY, () => runParlayPaperTradingJob(sourceCommit));
}

/**
 * Builds the cadence-tick trigger function: an in-process in-flight guard (cheap, avoids even
 * attempting the DB round-trip when this same process is already mid-cycle) wrapping the
 * DB-backed advisory-lock guard (cross-instance). Exported as a factory, not a module-level
 * singleton, so tests can construct independent instances with independent in-flight state.
 */
export function createParlayPaperTradingCycleTrigger(
  sourceCommit: string,
  runWithLock: (sourceCommit: string) => ReturnType<typeof runParlayPaperTradingCycleWithLock> = runParlayPaperTradingCycleWithLock,
): () => void {
  let inFlight = false;
  return function triggerParlayPaperTradingCycle(): void {
    if (inFlight) {
      logger.warn("Skipping Builder paper-trading cycle tick: previous cycle is still running in this process");
      return;
    }
    inFlight = true;
    runWithLock(sourceCommit)
      .then((outcome) => {
        if (outcome.kind === "lock_skipped") {
          logger.info("Builder paper-trading cycle: advisory lock held by another instance, skipped cleanly");
        }
      })
      .catch((err) => {
        // runParlayPaperTradingJob already records failures to job_runs; this catch only guards
        // against a truly unexpected throw escaping that, so it can never crash the server.
        logger.error({ err }, "Builder paper-trading cycle threw unexpectedly outside its own error handling");
      })
      .finally(() => {
        inFlight = false;
      });
  };
}

export interface ParlaySchedulerHandle {
  enabled: boolean;
  intervalHandle: ReturnType<typeof setInterval> | null;
  initialTimeoutHandle: ReturnType<typeof setTimeout> | null;
}

/**
 * Called exactly once from index.ts's bootstrap(), which itself only runs once per process
 * start (app.listen's callback fires once) -- the same non-multiplying guarantee the Prediction
 * Engine's own scheduler wiring already relies on; no additional guard invented here.
 */
export function startParlayPaperTradingScheduler(
  env: NodeJS.ProcessEnv = process.env,
): ParlaySchedulerHandle {
  const enabled = isParlayPaperTradingSchedulerEnabled(env);
  if (!enabled) {
    logger.info("Builder paper trading scheduler: DISABLED");
    return { enabled: false, intervalHandle: null, initialTimeoutHandle: null };
  }

  const sourceCommit = resolveSourceCommit();
  logger.info({ cadence: "15m", sourceCommit }, "Builder paper trading scheduler: ENABLED cadence=15m");
  const trigger = createParlayPaperTradingCycleTrigger(sourceCommit);

  const intervalHandle = setInterval(trigger, PARLAY_PAPER_TRADING_SCHEDULER_INTERVAL_MS);
  // Fire once shortly after startup rather than waiting a full interval, so a server restart
  // doesn't add up to 15 minutes of extra silent gap on top of its own downtime -- identical
  // reasoning to the Prediction Engine's own scheduler.
  const initialTimeoutHandle = setTimeout(trigger, INITIAL_DELAY_MS);

  return { enabled: true, intervalHandle, initialTimeoutHandle };
}
