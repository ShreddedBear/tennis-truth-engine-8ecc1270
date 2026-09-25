/**
 * Double-scheduling firewall for the four background jobs whose cadence can now be driven either
 * by this process's own in-process setInterval/setTimeout timers OR by an external scheduler (a
 * Replit Scheduled Deployment, or equivalent always-on background-worker mechanism) invoking each
 * job's standalone CLI entry point (`runPaperTradingJob.ts`, `runParlayPaperTradingJob.ts`,
 * `runHistoricalBackfillJob.ts`, `runMatchedCohortSyncJob.ts`) on its own cadence.
 *
 * `BACKGROUND_JOB_MODE=external` makes every one of those four in-process schedulers skip
 * registering their setInterval/setTimeout entirely -- not merely "check a flag before running",
 * but never creating the timer at all, so there is no in-process trigger left to accidentally
 * race an external one. Any other value (including unset, today's default) leaves the current
 * in-process scheduling behavior completely unchanged -- this flag is opt-in, so nothing about
 * production behavior changes until it's explicitly set after an external scheduler is actually
 * configured.
 *
 * This flag does NOT need to be perfectly set to stay safe: each of the four jobs' own existing
 * protections (Builder's Postgres advisory lock; the unique DB indexes on evaluation_predictions,
 * parlay_paper_trades, and matched_engine_cohort; matched-cohort's upsert-not-insert write) already
 * make a genuinely concurrent double-invocation fail safe (a skipped/no-op second attempt, never a
 * duplicate or corrupted row) even if this flag is misconfigured -- it exists purely to avoid the
 * wasted work and log noise of routinely firing every job twice, not as the only thing preventing
 * a duplicate row.
 */
export function isExternalSchedulingMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env["BACKGROUND_JOB_MODE"] === "external";
}
