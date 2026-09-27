import { db, jobRunsTable, pool } from "@workspace/db";
import { logger } from "../lib/logger.js";
import {
  recentCompletedResultsJobStatus,
  runRecentCompletedResultsIngestion,
} from "../services/liveResults/recentCompletedResults.js";
import { getTennisDataProvider } from "../services/tennisData/index.js";
import { runWithAdvisoryLock } from "./advisoryLock.js";
import type { JobTriggerType } from "./jobTriggerType.js";
import { RECENT_COMPLETED_RESULTS_JOB_NAME } from "./recentCompletedResultsJobName.js";

export { RECENT_COMPLETED_RESULTS_JOB_NAME };

/** Dedicated cross-process lock, unrelated to either prediction engine’s lock. */
export const RECENT_COMPLETED_RESULTS_ADVISORY_LOCK_KEY = 190734863n;
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [5_000, 30_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetry(): Promise<
  { attempts: number; summary: Awaited<ReturnType<typeof runRecentCompletedResultsIngestion>> }
  | { attempts: number; error: unknown }
> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const provider = getTennisDataProvider();
      return { attempts: attempt, summary: await runRecentCompletedResultsIngestion(provider) };
    } catch (err) {
      lastError = err;
      logger.error({ err, attempt, maxAttempts: MAX_ATTEMPTS }, "Recent completed-results ingestion attempt failed");
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]);
      }
    }
  }
  return { attempts: MAX_ATTEMPTS, error: lastError };
}

async function runRecentCompletedResultsJobUnlocked(
  triggerType: JobTriggerType,
): Promise<{ ok: boolean }> {
  const startedAt = new Date();
  const outcome = await runWithRetry();
  const finishedAt = new Date();

  if ("summary" in outcome) {
    const status = recentCompletedResultsJobStatus(outcome.summary);
    const errorMessage = outcome.summary.providerErrors.length > 0
      ? `Provider chunk failures: ${outcome.summary.providerErrors.join("; ")}`
      : null;
    await db.insert(jobRunsTable).values({
      jobName: RECENT_COMPLETED_RESULTS_JOB_NAME,
      startedAt,
      finishedAt,
      status,
      attempts: outcome.attempts,
      summary: outcome.summary,
      errorMessage,
      triggerType,
    });
    logger.info(
      { ...outcome.summary, attempts: outcome.attempts, status },
      status === "degraded"
        ? "Recent completed-results ingestion cycle completed with provider chunk failures"
        : "Recent completed-results ingestion cycle completed",
    );
    return { ok: status === "success" };
  }

  const errorMessage = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
  await db.insert(jobRunsTable).values({
    jobName: RECENT_COMPLETED_RESULTS_JOB_NAME,
    startedAt,
    finishedAt,
    status: "failed",
    attempts: outcome.attempts,
    summary: null,
    errorMessage,
    triggerType,
  });
  logger.error({ err: outcome.error, attempts: outcome.attempts }, "Recent completed-results ingestion failed after retries");
  return { ok: false };
}

/**
 * Shared in-process and standalone entry point. The DB advisory lock prevents simultaneous
 * fetch/ingest cycles across API replicas and an external scheduled deployment.
 */
export async function runRecentCompletedResultsJob(
  triggerType: JobTriggerType = "unknown",
): Promise<{ ok: boolean }> {
  const outcome = await runWithAdvisoryLock(
    pool,
    RECENT_COMPLETED_RESULTS_ADVISORY_LOCK_KEY,
    () => runRecentCompletedResultsJobUnlocked(triggerType),
  );
  if (outcome.kind === "lock_skipped") {
    logger.info("Recent completed-results ingestion cycle skipped: advisory lock held by another process");
    return { ok: true };
  }
  return outcome.result;
}

// Standalone Replit Scheduled Deployment command:
// RECENT_COMPLETED_RESULTS_JOB_STANDALONE=1 node --enable-source-maps dist/jobs/runRecentCompletedResultsJob.mjs
if (process.env["RECENT_COMPLETED_RESULTS_JOB_STANDALONE"] === "1") {
  runRecentCompletedResultsJob("external_schedule")
    .then(({ ok }) => process.exit(ok ? 0 : 1))
    .catch((err) => {
      logger.error({ err }, "Unhandled error in recent completed-results standalone job");
      process.exit(1);
    });
}