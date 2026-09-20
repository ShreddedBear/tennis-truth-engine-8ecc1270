import { gradeCalibration } from "./truth-server-api";

export interface GradeInput {
  matchId: string | null;
  matchLabel: string;
  tournament: string | null;
  surface: string | null;
  matchDate: string | null;
  matrixPredictedWinner: string | null;
  matrixWp: number | null;
  actualWinner: string | null;
  /** WIN | LOSS | RETIREMENT WIN | RETIREMENT LOSS | WALKOVER | VOID */
  resultType: string;
  note?: string;
}

/**
 * Deterministic continuous calibration: every graded result creates a new
 * immutable calibration version. Nothing is ever edited in place, so any board
 * row can be traced back to the exact bucket record used at decision time.
 */
export async function gradeResult(input: GradeInput) {
  return (await gradeCalibration({
    match_id: input.matchId,
    match_label: input.matchLabel,
    tournament: input.tournament,
    surface: input.surface,
    match_date: input.matchDate,
    matrix_predicted_winner: input.matrixPredictedWinner,
    matrix_wp: input.matrixWp,
    actual_winner: input.actualWinner,
    result_type: input.resultType,
    note: input.note ?? null,
  })).version;
}
