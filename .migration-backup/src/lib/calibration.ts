// The shape of a manual grade. No database access lives here any more -- this module is
// imported by the calibration screen, and the browser has no database client. gradeResult
// moved to calibration.server.ts, reached through calibration.functions.ts.

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
