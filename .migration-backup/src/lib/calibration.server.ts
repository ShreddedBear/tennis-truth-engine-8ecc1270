// Continuous calibration grading. SERVER ONLY.
//
// This ran in the browser with the publishable key, writing all three calibration control-
// plane tables. That was the second writable surface over the record the engine learns
// from -- the ledger, the bucket win-rates, and the flag deciding which version is active.
// The database lockdown revoked those grants; this is the path that replaces them.
import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client.server";
import { calibrationBucketsTable, calibrationLedgerTable, calibrationVersionsTable } from "@/db/schema";
import { bucketFor } from "./audit-engine";
import type { GradeInput } from "./calibration";

export async function gradeResult(input: GradeInput) {
  const [current] = await db.select().from(calibrationVersionsTable)
    .where(eq(calibrationVersionsTable.is_active, true)).limit(1);
  if (!current) throw new Error("No active calibration version");

  const buckets = await db.select().from(calibrationBucketsTable)
    .where(eq(calibrationBucketsTable.calibration_version_id, current.id))
    .orderBy(asc(calibrationBucketsTable.wp_min));
  if (!buckets.length) throw new Error("Active calibration version has no buckets");

  const bucket = bucketFor(input.matrixWp, buckets);
  // Retirements count as real graded results. Walkovers and voids do not.
  const counts = ["WIN", "LOSS", "RETIREMENT WIN", "RETIREMENT LOSS"].includes(input.resultType);
  const isWin = input.resultType === "WIN" || input.resultType === "RETIREMENT WIN";
  const countedInBucket = counts && !!bucket;

  // A new immutable version is created first and the previous one deactivated second, in
  // that order: nothing is ever edited in place, so any board row can be traced back to
  // the exact bucket record used at decision time.
  const [newVersion] = await db.insert(calibrationVersionsTable).values({
    label: `Calibration v${current.version_number + 1}`,
    version_number: current.version_number + 1,
    master_sequence_count: current.master_sequence_count + 1,
    graded_sample_count: current.graded_sample_count + (counts ? 1 : 0),
    is_active: true,
  } as never).returning();
  if (!newVersion) throw new Error("Calibration version was not created");

  await db.update(calibrationVersionsTable).set({ is_active: false })
    .where(eq(calibrationVersionsTable.id, current.id));

  const rows = buckets.map((b) => {
    const hit = countedInBucket && bucket!.id === b.id;
    const graded = b.graded + (hit ? 1 : 0);
    const wins = b.wins + (hit && isWin ? 1 : 0);
    return {
      calibration_version_id: newVersion.id,
      bucket_code: b.bucket_code,
      bucket_label: b.bucket_label,
      wp_min: b.wp_min,
      wp_max: b.wp_max,
      wins,
      graded,
      small_sample: graded < 10,
    };
  });
  await db.insert(calibrationBucketsTable).values(rows as never);

  await db.insert(calibrationLedgerTable).values({
    match_id: input.matchId,
    match_label: input.matchLabel,
    tournament: input.tournament,
    surface: input.surface,
    match_date: input.matchDate,
    matrix_predicted_winner: input.matrixPredictedWinner,
    matrix_wp: input.matrixWp,
    actual_winner: input.actualWinner,
    result_type: input.resultType,
    result_grading_status: counts ? "GRADED" : "NOT GRADED",
    counted_in_bucket: countedInBucket,
    bucket_code: bucket?.bucket_code ?? null,
    master_sequence: newVersion.master_sequence_count,
    calibration_version_before: current.id,
    calibration_version_after: newVersion.id,
    note: input.note ?? null,
  } as never);

  return newVersion;
}
