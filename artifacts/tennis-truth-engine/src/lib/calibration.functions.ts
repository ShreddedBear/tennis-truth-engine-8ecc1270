// Browser-callable calibration grading.
//
// Module scope stays free of server-only imports; the server module is reached with a
// dynamic import inside the handler.
import { createServerFn } from "@tanstack/react-start";

import type { GradeInput } from "./calibration";

/** WIN and LOSS count. Retirements count as real graded results. Walkovers and voids do not. */
const RESULT_TYPES = [
  "WIN", "LOSS", "RETIREMENT WIN", "RETIREMENT LOSS", "WALKOVER", "VOID",
] as const;

export const gradeCalibrationResult = createServerFn({ method: "POST" })
  .inputValidator((data: GradeInput) => {
    const resultType = String(data?.resultType ?? "").trim();
    if (!RESULT_TYPES.includes(resultType as (typeof RESULT_TYPES)[number])) {
      throw new Error(`"${resultType}" is not a valid result type.`);
    }
    const matchLabel = String(data?.matchLabel ?? "").trim();
    if (!matchLabel) throw new Error("A match label is required.");
    const matrixWp = data?.matrixWp;
    if (matrixWp !== null && matrixWp !== undefined && !Number.isFinite(Number(matrixWp))) {
      throw new Error("Matrix win probability must be a number or empty.");
    }
    return {
      matchId: data.matchId ?? null,
      matchLabel,
      tournament: data.tournament ?? null,
      surface: data.surface ?? null,
      matchDate: data.matchDate ?? null,
      matrixPredictedWinner: data.matrixPredictedWinner ?? null,
      matrixWp: matrixWp === null || matrixWp === undefined ? null : Number(matrixWp),
      actualWinner: data.actualWinner ?? null,
      resultType,
      note: data.note ?? undefined,
    } satisfies GradeInput;
  })
  .handler(async ({ data }) => {
    const { gradeResult } = await import("./calibration.server");
    const version = await gradeResult(data);
    return { ok: true as const, versionId: version.id, versionNumber: version.version_number };
  });

/** Prefills the grading form from a match's persisted Matrix summary. */
export const loadMatrixAutofill = createServerFn({ method: "POST" })
  .inputValidator((data: { matchId: string }) => {
    const matchId = String(data?.matchId ?? "").trim();
    if (!matchId) throw new Error("A match id is required.");
    return { matchId };
  })
  .handler(async ({ data }) => {
    const { loadMatrixCalibrationInputs } = await import("./calibration-matrix-autofill.server");
    return loadMatrixCalibrationInputs(data.matchId);
  });
