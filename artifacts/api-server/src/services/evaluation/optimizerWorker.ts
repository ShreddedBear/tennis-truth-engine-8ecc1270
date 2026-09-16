import { parentPort, workerData } from "node:worker_threads";
import { runOptimizerRun } from "./candidateOptimizer.js";

if (!parentPort) throw new Error("optimizerWorker requires a parent worker");

void runOptimizerRun(workerData).then(
  (result) => parentPort!.postMessage({ type: "result", result }),
  (error: unknown) =>
    parentPort!.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    }),
);