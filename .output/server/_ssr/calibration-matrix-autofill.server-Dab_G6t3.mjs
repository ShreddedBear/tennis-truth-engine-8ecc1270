import { a as eq } from "../_libs/drizzle-orm.mjs";
import { t as db } from "./client.server-B14ewPcb.mjs";
import { s as matchesTable } from "./matches-CtYuxOLN.mjs";
import { a as parsedSummaryFieldsTable } from "./uploads-vW6NguTg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calibration-matrix-autofill.server-Dab_G6t3.js
function matrixInputsFromParsedFields(fields, match) {
	const byKey = new Map(fields.map((f) => [f.field_key, f.normalized_value]));
	const wpRaw = byKey.get("matrix_wp");
	const wp = wpRaw != null && wpRaw !== "" ? Number(wpRaw) : null;
	return {
		matchLabel: `${match.player1_name} vs ${match.player2_name}`,
		tournament: match.tournament_name ?? null,
		surface: match.surface ?? null,
		matchDate: match.scheduled_date ?? null,
		matrixPredictedWinner: byKey.get("matrix_predicted_winner") ?? null,
		matrixWp: Number.isFinite(wp) ? wp : null
	};
}
async function loadMatrixCalibrationInputs(matchId) {
	const [match] = await db.select({
		id: matchesTable.id,
		player1_name: matchesTable.player1_name,
		player2_name: matchesTable.player2_name,
		tournament_name: matchesTable.tournament_name,
		surface: matchesTable.surface,
		scheduled_date: matchesTable.scheduled_date,
		active_summary_version_id: matchesTable.active_summary_version_id
	}).from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
	if (!match) return null;
	const versionId = match.active_summary_version_id;
	if (!versionId) return matrixInputsFromParsedFields([], match);
	try {
		return matrixInputsFromParsedFields(await db.select({
			field_key: parsedSummaryFieldsTable.field_key,
			normalized_value: parsedSummaryFieldsTable.normalized_value
		}).from(parsedSummaryFieldsTable).where(eq(parsedSummaryFieldsTable.summary_version_id, versionId)), match);
	} catch {
		return matrixInputsFromParsedFields([], match);
	}
}
//#endregion
export { loadMatrixCalibrationInputs };
