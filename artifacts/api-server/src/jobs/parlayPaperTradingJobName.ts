/**
 * Shared identifier for the standalone parlay paper-trading job's `job_runs` rows. Kept in its
 * own module for the same reason `paperTradingJobName.ts` is: importing it from a route to
 * filter job-run history must not pull the job's retry-and-run entrypoint (with its
 * standalone-only auto-run guard) into the server's bundle.
 */
export const PARLAY_PAPER_TRADING_JOB_NAME = "parlay-paper-trading-cycle";
