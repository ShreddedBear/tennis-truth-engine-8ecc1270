/**
 * Standalone-style entrypoint for the matched-cohort sync cycle -- mirrors
 * `runHistoricalBackfillJob.ts`'s shape (retry-with-backoff, durable `job_runs` logging, guarded
 * standalone CLI invocation) so this new job is observable and operable the same way every other
 * background job in this codebase already is.
 *
 * This job is strictly additive: `syncMatchedCohort()` only reads each engine's own already-
 * frozen/locked rows and writes only to `matched_engine_cohort` (see that module's and the schema
 * file's doc comments for the full leakage-firewall and eligibility design). It never touches
 * `evaluation_predictions` or `parlay_paper_trades`, so it cannot affect either engine's native
 * scoring, discovery, or grading -- a failed or delayed cycle here has zero effect on either
 * engine's own paper trading.
 */
import { db, jobRunsTable } from "@workspace/db";
import { syncMatchedCohort, type MatchedCohortSyncSummary } from "../services/matchedCohort/syncMatchedCohort";
import { logger } from "../lib/logger";
import { MATCHED_COHORT_SYNC_JOB_NAME } from "./matchedCohortSyncJobName";

export { MATCHED_COHORT_SYNC_JOB_NAME };

const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [5_000, 30_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetry(): Promise<{ attempts: number; result: MatchedCohortSyncSummary } | { attempts: number; error: unknown }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await syncMatchedCohort();
      return { attempts: attempt, result };
    } catch (err) {
      lastError = err;
      logger.error({ err, attempt, maxAttempts: MAX_ATTEMPTS }, "Matched-cohort sync cycle attempt failed");
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]);
      }
    }
  }
  return { attempts: MAX_ATTEMPTS, error: lastError };
}

export async function runMatchedCohortSyncJob(): Promise<{ ok: boolean }> {
  const startedAt = new Date();
  const outcome = await runWithRetry();
  const finishedAt = new Date();

  if ("result" in outcome) {
    await db.insert(jobRunsTable).values({
      jobName: MATCHED_COHORT_SYNC_JOB_NAME,
      startedAt,
      finishedAt,
      status: "success",
      attempts: outcome.attempts,
      summary: outcome.result,
      errorMessage: null,
    });
    logger.info({ ...outcome.result, attempts: outcome.attempts }, "Matched-cohort sync cycle completed");
    return { ok: true };
  }

  const errorMessage = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
  await db.insert(jobRunsTable).values({
    jobName: MATCHED_COHORT_SYNC_JOB_NAME,
    startedAt,
    finishedAt,
    status: "failed",
    attempts: outcome.attempts,
    summary: null,
    errorMessage,
  });
  logger.error({ err: outcome.error, attempts: outcome.attempts }, "Matched-cohort sync cycle failed after exhausting retries");
  return { ok: false };
}

// Guarded by an explicit env var rather than an import.meta.url/process.argv[1] comparison -- see
// runHistoricalBackfillJob.ts / runPaperTradingJob.ts for why.
if (process.env["MATCHED_COHORT_SYNC_JOB_STANDALONE"] === "1") {
  runMatchedCohortSyncJob()
    .then(({ ok }) => process.exit(ok ? 0 : 1))
    .catch((err) => {
      logger.error({ err }, "Unhandled error running matched-cohort sync job");
      process.exit(1);
    });
}
