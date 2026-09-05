import { createServerFn } from "@tanstack/react-start";

/**
 * Capture real results, then rebuild the Truth Engine calibration population from the
 * decisions those results resolve.
 *
 * The order is the causal one and cannot be inverted: a decision becomes an observation only
 * once its match has a FINAL result, so results are captured first. Both halves are safe to
 * run repeatedly.
 */
export const rebuildCalibrationObservations = createServerFn({ method: "POST" }).handler(
  async () => {
    const { runResultCapture } = await import("./match-result-capture.server");
    const { populateCalibrationObservations, loadCalibrationModel } =
      await import("./calibration-observations.server");
    const capture = await runResultCapture();
    const population = await populateCalibrationObservations();
    const model = await loadCalibrationModel();
    return {
      ok: true as const,
      capture,
      observations: population.summary,
      written: population.written,
      calibration: {
        status: model.status,
        total_observations: model.total_observations,
        buckets: model.buckets,
      },
    };
  },
);
