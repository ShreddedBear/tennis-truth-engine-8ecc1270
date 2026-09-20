import { Worker } from "node:worker_threads";

export const EVALUATION_WORKER_MAX_OLD_GENERATION_MB = Number.parseInt(
  process.env.EVALUATION_WORKER_MAX_OLD_GENERATION_MB ?? "768",
  10,
);
export const EVALUATION_WORKER_TIMEOUT_MS = Number.parseInt(
  process.env.EVALUATION_WORKER_TIMEOUT_MS ?? String(30 * 60 * 1000),
  10,
);

type WorkerMessage<T> =
  | { type: "result"; result: T }
  | { type: "error"; error: string };

export interface EvaluationWorkerHandle<T> {
  promise: Promise<T>;
  cancel: (reason?: string) => void;
}

/**
 * Runs an evaluation job outside the API event loop and heap. The worker is
 * deliberately one-shot: terminating it always releases its indexes and DB
 * connection state instead of retaining a large corpus between jobs.
 */
export function spawnEvaluationWorker<T>(
  entrypoint: string | URL,
  payload: unknown,
  options: { timeoutMs?: number; maxOldGenerationMb?: number } = {},
): EvaluationWorkerHandle<T> {
  const worker = new Worker(entrypoint, {
    workerData: payload,
    resourceLimits: {
      maxOldGenerationSizeMb:
        options.maxOldGenerationMb ?? EVALUATION_WORKER_MAX_OLD_GENERATION_MB,
    },
  });
  const timeoutMs = options.timeoutMs ?? EVALUATION_WORKER_TIMEOUT_MS;
  let settled = false;
  let timer: NodeJS.Timeout | undefined;
  let rejectPromise: ((error: Error) => void) | undefined;

  const finish = (callback: () => void): void => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    callback();
  };

  const promise = new Promise<T>((resolve, reject) => {
    rejectPromise = reject;
    worker.once("message", (message: WorkerMessage<T>) => {
      finish(() => {
        if (message.type === "result") resolve(message.result);
        else reject(new Error(message.error));
        void worker.terminate();
      });
    });
    worker.once("error", (error) => {
      finish(() => {
        reject(error);
        void worker.terminate();
      });
    });
    worker.once("exit", (code) => {
      if (code !== 0) {
        finish(() => reject(new Error(`Evaluation worker exited with code ${code}`)));
      }
    });
    timer = setTimeout(() => {
      finish(() => {
        reject(new Error(`Evaluation worker timed out after ${timeoutMs}ms`));
        void worker.terminate();
      });
    }, timeoutMs);
  });

  return {
    promise,
    cancel: (reason = "Evaluation job cancelled") => {
      finish(() => {
        rejectPromise?.(new Error(reason));
        void worker.terminate();
      });
    },
  };
}

/**
 * Process-local mutual exclusion. This is intentionally not presented as a
 * distributed job lock; it prevents the two heavy jobs from competing inside
 * one API process while the worker boundary protects the API heap.
 */
let activeHeavyJob: "walk-forward" | "optimizer" | null = null;

export function acquireHeavyJobLease(
  kind: "walk-forward" | "optimizer",
): { acquired: true; release: () => void } | { acquired: false; reason: string } {
  if (activeHeavyJob) {
    return {
      acquired: false,
      reason: `A ${activeHeavyJob} evaluation is already running.`,
    };
  }
  activeHeavyJob = kind;
  let released = false;
  return {
    acquired: true,
    release: () => {
      if (!released && activeHeavyJob === kind) {
        released = true;
        activeHeavyJob = null;
      }
    },
  };
}

export function getActiveHeavyJob(): "walk-forward" | "optimizer" | null {
  return activeHeavyJob;
}