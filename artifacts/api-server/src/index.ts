import app from "./app";
import { logger } from "./lib/logger";
import { startPaperTradingScheduler } from "./jobs/paperTradingScheduler";
import { startHistoricalBackfillScheduler } from "./jobs/historicalBackfillScheduler";
import { startMatchedCohortSyncScheduler } from "./jobs/matchedCohortSyncScheduler";
import { runDegradedPredictionRecomputeJob } from "./jobs/runDegradedPredictionRecomputeJob";
import { runCalibrationRefitJob } from "./jobs/runCalibrationRefitJob";
import { startParlayPaperTradingScheduler } from "./jobs/parlayPaperTradingScheduler";
import { ensureEvaluationSchema } from "./lib/ensureEvaluationSchema";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function bootstrap(): Promise<void> {
  app.listen(port, async (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    // Open the HTTP port before running the compatibility transaction. The schema
    // check includes a large set of idempotent DDL statements and data backfills
    // that can legitimately exceed the deployment platform's startup timeout on a
    // production database. Background jobs still wait for it to finish, so they
    // never run against a partially initialized schema.
    try {
      await ensureEvaluationSchema();
    } catch (err) {
      logger.error({ err }, "Schema compatibility check failed");
      process.exit(1);
    }

  // Prediction Engine paper-trading in-process scheduler -- see jobs/paperTradingScheduler.ts for
  // the full Task #121 history and rationale (extracted from this inline block into its own
  // module so it can be tested directly and honor the shared BACKGROUND_JOB_MODE
  // double-scheduling firewall the other three background-job schedulers below also honor).
  startPaperTradingScheduler();

  // Deliberate, explicitly-enabled in-process scheduler for the independent Builder
  // paper-trading job -- the same Replit Scheduled Deployment gap as above (never configured;
  // confirmed neither this assistant nor the in-workspace agent has a tool to create one), so
  // rather than pretend an external scheduler exists, this is now the intended production
  // mechanism, gated behind ENABLE_PARLAY_BUILDER_PAPER_TRADING_SCHEDULER (default disabled).
  // Structurally separate from the Prediction Engine's own scheduler above: its own in-flight
  // flag, its own Postgres advisory lock (guards against multiple Autoscale instances racing the
  // same cadence tick -- something an in-memory flag alone cannot do), never sharing state with
  // or modifying paperTrading.ts. See parlayPaperTradingScheduler.ts for the full design.
  startParlayPaperTradingScheduler();

  // Likewise, the live probability calibration model gets refreshed by a daily in-process
  // fallback as well as its standalone Scheduled Deployment entry. The refit job's
  // MIN_NEW_GRADED_FOR_REFIT guard makes frequent checks safe: it records a visible skip until
  // enough new graded predictions justify training. See GET
  // /evaluation/calibration-refit/job-runs for the durable run history.
  const CALIBRATION_REFIT_INTERVAL_MS = 24 * 60 * 60_000;
  let calibrationRefitInFlight = false;

  function triggerCalibrationRefitCycle(): void {
    if (calibrationRefitInFlight) {
      logger.warn("Skipping calibration-refit cycle tick: previous cycle is still running");
      return;
    }
    calibrationRefitInFlight = true;
    runCalibrationRefitJob()
      .catch((err) => {
        logger.error({ err }, "Calibration-refit cycle threw unexpectedly outside its own error handling");
      })
      .finally(() => {
        calibrationRefitInFlight = false;
      });
  }

  setInterval(triggerCalibrationRefitCycle, CALIBRATION_REFIT_INTERVAL_MS);
  // Fire after paper trading, but before historical backfill, to stagger provider work on startup.
  setTimeout(triggerCalibrationRefitCycle, 15_000);

  // Task #144: `historical_matches` -- the canonical record backtesting, calibration, and
  // canonical player-identity lookup all depend on -- used to only advance when someone manually
  // re-ran the CLI backfill with new dates, and silently stopped doing that over a year ago.
  // `runHistoricalBackfillJob` is self-advancing (always picks up from wherever the table already
  // reaches) and has its own standalone entry (`src/jobs/runHistoricalBackfillJob.ts`, intended
  // for a Replit Scheduled Deployment). Mirroring the paper-trading job's in-process fallback (see
  // its comment above for the full rationale): firing it here too means the record keeps advancing
  // today even before that Scheduled Deployment is configured, at the cost of pausing across a
  // server restart -- an acceptable tradeoff given the alternative is silently going stale again.
  // Cadence (30 minutes, not the previous 24 hours) and the overlap guard live in
  // `historicalBackfillScheduler.ts` -- see that file's own doc comment for the full result-
  // ingestion cadence audit this hardening was based on.
  startHistoricalBackfillScheduler();

  const DEGRADED_RECOMPUTE_INTERVAL_MS = 6 * 60 * 60_000;
  let degradedRecomputeInFlight = false;
  const triggerDegradedRecompute = (): void => {
    if (degradedRecomputeInFlight) return;
    degradedRecomputeInFlight = true;
    runDegradedPredictionRecomputeJob()
      .catch((err) => logger.error({ err }, "degraded prediction recomputation threw unexpectedly"))
      .finally(() => { degradedRecomputeInFlight = false; });
  };
  setInterval(triggerDegradedRecompute, DEGRADED_RECOMPUTE_INTERVAL_MS);
  setTimeout(triggerDegradedRecompute, 30_000);

  // Prospective, leak-proof comparison layer between the Prediction Engine's and the Parlay
  // Builder's independently-frozen paper-trading predictions -- structurally separate from both
  // engines' own schedulers (own in-flight guard, own interval, never merged into either). See
  // matchedCohortSyncScheduler.ts and services/matchedCohort/syncMatchedCohort.ts for the full
  // design, join-key verification, and leakage-firewall proof.
  startMatchedCohortSyncScheduler();
  });
}

void bootstrap();
