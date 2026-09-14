// Matrix autofill for the calibration grading form. SERVER ONLY.
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client.server";
import { matchesTable, parsedSummaryFieldsTable } from "@/db/schema";
import { matrixInputsFromParsedFields, type MatrixAutofill } from "./calibration-matrix-autofill";

export async function loadMatrixCalibrationInputs(matchId: string): Promise<MatrixAutofill | null> {
  const [match] = await db.select({
    id: matchesTable.id,
    player1_name: matchesTable.player1_name,
    player2_name: matchesTable.player2_name,
    tournament_name: matchesTable.tournament_name,
    surface: matchesTable.surface,
    scheduled_date: matchesTable.scheduled_date,
    active_summary_version_id: matchesTable.active_summary_version_id,
  }).from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
  if (!match) return null;

  const versionId = match.active_summary_version_id;
  if (!versionId) return matrixInputsFromParsedFields([], match);

  // A failed field read falls back to the empty-field path rather than propagating: the
  // form is a convenience, and it must still open with the match's own identity filled in.
  try {
    const fields = await db.select({
      field_key: parsedSummaryFieldsTable.field_key,
      normalized_value: parsedSummaryFieldsTable.normalized_value,
    }).from(parsedSummaryFieldsTable).where(eq(parsedSummaryFieldsTable.summary_version_id, versionId));
    return matrixInputsFromParsedFields(fields, match);
  } catch {
    return matrixInputsFromParsedFields([], match);
  }
}
