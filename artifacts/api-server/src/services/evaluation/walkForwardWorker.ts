import { parentPort, workerData } from "node:worker_threads";
import { runWalkForwardEvaluation } from "./walkForward.js";

if (!parentPort) throw new Error("walkForwardWorker requires a parent worker");

void runWalkForwardEvaluation(workerData)
  .then((result) => parentPort!.postMessage({ type: "result", result }))
  .catch((error: unknown) =>
    parentPort!.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    }),
  );