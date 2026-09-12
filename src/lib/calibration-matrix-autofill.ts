// Auto-fills the Calibration grading form's prediction-side fields (matrixPredictedWinner,
// matrixWp, tournament, surface, matchLabel) from a match's already-parsed summary fields,
// instead of requiring them to be re-typed by hand every time -- this is the
// "Calibration Feature directly correlates with reading the summaries" wiring.
//
// This only ever supplies the PREDICTION side of a grading input. actualWinner/resultType
// (the real-world outcome) can never come from a prediction-engine report and must remain
// a genuine, separate, human-entered fact -- calibration exists specifically to check the
// prediction against reality, so autofilling the outcome from the same report that made
// the prediction would make every graded result vacuously "correct."
import type { GradeInput } from "./calibration";

export type MatrixAutofill = Pick<GradeInput, "matchLabel" | "tournament" | "surface" | "matchDate" | "matrixPredictedWinner" | "matrixWp">;

export type ParsedFieldLike = { field_key: string; normalized_value: string | null };
export type MatchMetaLike = {
  player1_name: string;
  player2_name: string;
  tournament_name: string | null;
  surface: string | null;
  scheduled_date: string | null;
};

export function matrixInputsFromParsedFields(fields: ParsedFieldLike[], match: MatchMetaLike): MatrixAutofill {
  const byKey = new Map(fields.map((f) => [f.field_key, f.normalized_value]));
  const wpRaw = byKey.get("matrix_wp");
  const wp = wpRaw != null && wpRaw !== "" ? Number(wpRaw) : null;
  return {
    matchLabel: `${match.player1_name} vs ${match.player2_name}`,
    tournament: match.tournament_name ?? null,
    surface: match.surface ?? null,
    matchDate: match.scheduled_date ?? null,
    matrixPredictedWinner: byKey.get("matrix_predicted_winner") ?? null,
    matrixWp: Number.isFinite(wp) ? wp : null,
  };
}
