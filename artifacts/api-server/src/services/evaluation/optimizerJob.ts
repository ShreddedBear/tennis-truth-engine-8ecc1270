/**
 * Async job wrapper for the optimizer (training-mode walk-forward + candidate config generation).
 *
 * Optimizer runs take 12–20+ minutes. Same fire-and-poll pattern as walkForwardJob.ts.
 * Production config is NEVER auto-promoted — this only writes a candidate_configs row.
 */

import { logger } from "../../lib/logger";
import type { runOptimizerRun } from "./candidateOptimizer";
import { acquireHeavyJobLease, spawnEvaluationWorker, type EvaluationWorkerHandle } from "./evaluationWorkerControl";
import path from "node:path";

type OptimizerResult = {
  candidateConfigId: number;
  candidateConfigIds: number[];
  generatedCount: number;
  duplicateRejectedCount: number;
  nearDuplicateRejectedCount: number;
  retestCount: number;
  diversity: {
    requiredFamilies: string[];
    presentFamilies: string[];
    minimumFamilyCount: number;
    familyCoveragePassed: boolean;
    noveltyFloor: number;
    noveltyRate: number;
    noveltyPassed: boolean;
  };
  thresholdEvaluationId: number;
  walkForward: {
    foldsRun: number;
    foldIds: number[];
    skippedNoEligibleMatches: boolean;
    fallbackRate: number;
    warnings: string[];
  };
};

export type OptimizerJobStatus =
  | { state: "idle" }
  | { state: "running"; startedAt: string; phase: string }
  | { state: "done"; startedAt: string; finishedAt: string; result: OptimizerResult }
  | { state: "error"; startedAt: string; finishedAt: string; error: string };

let currentJob: OptimizerJobStatus = { state: "idle" };
let activeWorker: EvaluationWorkerHandle<Awaited<ReturnType<typeof runOptimizerRun>>> | null = null;
let releaseLease: (() => void) | null = null;

export function getOptimizerJobStatus(): OptimizerJobStatus {
  return currentJob;
}

export function startOptimizerJob(opts: {
  foldCount?: number;
  warmupFraction?: number;
  notes?: string;
}): { started: boolean; reason?: string } {
  if (currentJob.state === "running") {
    return { started: false, reason: "An optimizer run is already in progress." };
  }
  const lease = acquireHeavyJobLease("optimizer");
  if (!lease.acquired) return { started: false, reason: lease.reason };
  releaseLease = lease.release;

  const startedAt = new Date().toISOString();
  currentJob = { state: "running", startedAt, phase: "initializing" };

  // The optimizer and its nested walk-forward run are isolated from the API heap.
  void runJob(startedAt, opts);

  return { started: true };
}

async function runJob(
  startedAt: string,
  opts: { foldCount?: number; warmupFraction?: number; notes?: string },
): Promise<void> {
  try {
    currentJob = { state: "running", startedAt, phase: "walk-forward" };
    const worker = spawnEvaluationWorker<Awaited<ReturnType<typeof runOptimizerRun>>>(
      path.join(__dirname, "optimizerWorker.mjs"),
      opts,
    );
    activeWorker = worker;
    const result = await worker.promise;

    currentJob = {
      state: "done",
      startedAt,
      finishedAt: new Date().toISOString(),
      result: {
        candidateConfigId: result.candidateConfigId,
        candidateConfigIds: result.candidateConfigIds,
        generatedCount: result.generatedCount,
        duplicateRejectedCount: result.duplicateRejectedCount,
        nearDuplicateRejectedCount: result.nearDuplicateRejectedCount,
        retestCount: result.retestCount,
        diversity: result.diversity,
        thresholdEvaluationId: result.thresholdEvaluationId,
        walkForward: {
          foldsRun: result.walkForwardSummary.foldsRun,
          foldIds: result.walkForwardSummary.foldIds,
          skippedNoEligibleMatches: result.walkForwardSummary.skippedNoEligibleMatches,
          fallbackRate: result.walkForwardSummary.fallbackRate,
          warnings: result.walkForwardSummary.warnings,
        },
      },
    };
    logger.info({ candidateConfigId: result.candidateConfigId }, "Optimizer job completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Optimizer job failed");
    currentJob = {
      state: "error",
      startedAt,
      finishedAt: new Date().toISOString(),
      error: message,
    };
  } finally {
    activeWorker = null;
    releaseLease?.();
    releaseLease = null;
  }
}

export function cancelOptimizerJob(): { cancelled: boolean; reason?: string } {
  if (currentJob.state !== "running" || !activeWorker) {
    return { cancelled: false, reason: "No optimizer run is currently running." };
  }
  activeWorker.cancel();
  return { cancelled: true };
}
