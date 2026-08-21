import { supabase } from "@/integrations/supabase/client";
import { bucketFor } from "./audit-engine";

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
  const { data: current } = await supabase
    .from("calibration_versions")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (!current) throw new Error("No active calibration version");

  const { data: buckets } = await supabase
    .from("calibration_buckets")
    .select("*")
    .eq("calibration_version_id", current.id)
    .order("wp_min");
  if (!buckets?.length) throw new Error("Active calibration version has no buckets");

  const bucket = bucketFor(input.matrixWp, buckets);
  // Retirements count as real graded results. Walkovers and voids do not.
  const counts = ["WIN", "LOSS", "RETIREMENT WIN", "RETIREMENT LOSS"].includes(input.resultType);
  const isWin = input.resultType === "WIN" || input.resultType === "RETIREMENT WIN";
  const countedInBucket = counts && !!bucket;

  const { data: newVersion, error: vErr } = await supabase
    .from("calibration_versions")
    .insert({
      label: `Calibration v${current.version_number + 1}`,
      version_number: current.version_number + 1,
      master_sequence_count: current.master_sequence_count + 1,
      graded_sample_count: current.graded_sample_count + (counts ? 1 : 0),
      is_active: true,
    })
    .select()
    .single();
  if (vErr) throw vErr;

  await supabase.from("calibration_versions").update({ is_active: false }).eq("id", current.id);

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
  const { error: bErr } = await supabase.from("calibration_buckets").insert(rows);
  if (bErr) throw bErr;

  const { error: lErr } = await supabase.from("calibration_ledger").insert({
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
  });
  if (lErr) throw lErr;

  return newVersion;
}
