import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createServerRpc } from "./createServerRpc-BLr1vCfx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calibration.functions-DV3AJyPg.js
/** WIN and LOSS count. Retirements count as real graded results. Walkovers and voids do not. */
var RESULT_TYPES = [
	"WIN",
	"LOSS",
	"RETIREMENT WIN",
	"RETIREMENT LOSS",
	"WALKOVER",
	"VOID"
];
var gradeCalibrationResult_createServerFn_handler = createServerRpc({
	id: "86e416dde5063bd6e103bf277fd9ab34850d5b05bef3c229e2364a1c31c46e12",
	name: "gradeCalibrationResult",
	filename: "src/lib/calibration.functions.ts"
}, (opts) => gradeCalibrationResult.__executeServer(opts));
var gradeCalibrationResult = createServerFn({ method: "POST" }).inputValidator((data) => {
	const resultType = String(data?.resultType ?? "").trim();
	if (!RESULT_TYPES.includes(resultType)) throw new Error(`"${resultType}" is not a valid result type.`);
	const matchLabel = String(data?.matchLabel ?? "").trim();
	if (!matchLabel) throw new Error("A match label is required.");
	const matrixWp = data?.matrixWp;
	if (matrixWp !== null && matrixWp !== void 0 && !Number.isFinite(Number(matrixWp))) throw new Error("Matrix win probability must be a number or empty.");
	return {
		matchId: data.matchId ?? null,
		matchLabel,
		tournament: data.tournament ?? null,
		surface: data.surface ?? null,
		matchDate: data.matchDate ?? null,
		matrixPredictedWinner: data.matrixPredictedWinner ?? null,
		matrixWp: matrixWp === null || matrixWp === void 0 ? null : Number(matrixWp),
		actualWinner: data.actualWinner ?? null,
		resultType,
		note: data.note ?? void 0
	};
}).handler(gradeCalibrationResult_createServerFn_handler, async ({ data }) => {
	const { gradeResult } = await import("./calibration.server-QaRVXxVa.mjs");
	const version = await gradeResult(data);
	return {
		ok: true,
		versionId: version.id,
		versionNumber: version.version_number
	};
});
var loadMatrixAutofill_createServerFn_handler = createServerRpc({
	id: "da00d342afa07c1e5f894de717574bc3d10cee81c3cc05d2eb787fd1a209bd09",
	name: "loadMatrixAutofill",
	filename: "src/lib/calibration.functions.ts"
}, (opts) => loadMatrixAutofill.__executeServer(opts));
var loadMatrixAutofill = createServerFn({ method: "POST" }).inputValidator((data) => {
	const matchId = String(data?.matchId ?? "").trim();
	if (!matchId) throw new Error("A match id is required.");
	return { matchId };
}).handler(loadMatrixAutofill_createServerFn_handler, async ({ data }) => {
	const { loadMatrixCalibrationInputs } = await import("./calibration-matrix-autofill.server-Dab_G6t3.mjs");
	return loadMatrixCalibrationInputs(data.matchId);
});
//#endregion
export { gradeCalibrationResult_createServerFn_handler, loadMatrixAutofill_createServerFn_handler };
