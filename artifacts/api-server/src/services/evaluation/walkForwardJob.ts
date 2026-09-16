/**
 * Async job wrapper for the walk-forward evaluation.
 *
 * Walk-forward runs take 8–12+ minutes, far beyond any HTTP proxy timeout.
 * Pattern: POST returns immediately with { started }, frontend polls GET /status.
 * Identical architecture to ablationJob.ts — see that file for the rationale.
 */

import { logger } from "../../lib/logger";
import type { WalkForwardSummary } from "./walkForward";
import { acquireHeavyJobLease, spawnEvaluationWorker, type EvaluationWorkerHandle } from "./evaluationWorkerControl";
import path from "node:path";

export type WalkForwardJobStatus =
  | { state: "idle" }
  | { state: "running"; startedAt: string; evaluationOnly: boolean; matchesScored: number }
  | { state: "done"; startedAt: string; finishedAt: string; evaluationOnly: boolean; result: WalkForwardSummary }
  | { state: "error"; startedAt: string; finishedAt: string; evaluationOnly: boolean; error: string };

let currentJob: WalkForwardJobStatus = { state: "idle" };
let activeWorker: EvaluationWorkerHandle<WalkForwardSummary> | null = null;
let releaseLease: (() => void) | null = null;

// Simple in-process counter updated by the walk-forward progress callback.
let _matchesScored = 0;

export function getWalkForwardJobStatus(): WalkForwardJobStatus {
  return currentJob;
}

export function startWalkForwardJob(opts: {
  foldCount?: number;
  evaluationOnly?: boolean;
  /** Scope the run to specific historical_matches.id values (integer PKs). */
  matchIds?: number[];
  /** Task #127: optional inclusive start date (YYYY-MM-DD) for the date-range backfill mode. */
  startDate?: string;
  /** Task #127: optional inclusive end date (YYYY-MM-DD) for the date-range backfill mode. */
  endDate?: string;
  /**
   * Task #198: when true, a training-mode walk-forward stores the result as pending rather than
   * auto-activating. Admin must approve via POST /evaluation/walk-forward/activate/:modelId.
   * The public /run and /full-refit endpoints default this to true for training runs.
   */
  requireApproval?: boolean;
}): { started: boolean; reason?: string } {
  if (currentJob.state === "running") {
    return { started: false, reason: "A walk-forward run is already in progress." };
  }
  const lease = acquireHeavyJobLease("walk-forward");
  if (!lease.acquired) return { started: false, reason: lease.reason };
  releaseLease = lease.release;

  const startedAt = new Date().toISOString();
  const evaluationOnly = opts.evaluationOnly ?? true;
  _matchesScored = 0;

  currentJob = { state: "running", startedAt, evaluationOnly, matchesScored: 0 };

  // The heavy corpus/indexes run in a bounded one-shot worker, never in the API heap.
  void runJob(startedAt, evaluationOnly, opts);

  return { started: true };
}

async function runJob(
  startedAt: string,
  evaluationOnly: boolean,
  opts: { foldCount?: number; evaluationOnly?: boolean; matchIds?: number[]; startDate?: string; endDate?: string; requireApproval?: boolean },
): Promise<void> {
  try {
    const worker = spawnEvaluationWorker<WalkForwardSummary>(
      path.join(__dirname, "walkForwardWorker.mjs"),
      { ...opts, requireApproval: opts.requireApproval },
    );
    activeWorker = worker;
    const result = await worker.promise;

    currentJob = {
      state: "done",
      startedAt,
      finishedAt: new Date().toISOString(),
      evaluationOnly,
      result,
    };
    logger.info({ foldsRun: result.foldsRun }, "Walk-forward job completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Walk-forward job failed");
    currentJob = {
      state: "error",
      startedAt,
      finishedAt: new Date().toISOString(),
      evaluationOnly,
      error: message,
    };
  } finally {
    activeWorker = null;
    releaseLease?.();
    releaseLease = null;
  }
}

export function cancelWalkForwardJob(): { cancelled: boolean; reason?: string } {
  if (currentJob.state !== "running" || !activeWorker) {
    return { cancelled: false, reason: "No walk-forward run is currently running." };
  }
  activeWorker.cancel();
  return { cancelled: true };
}
