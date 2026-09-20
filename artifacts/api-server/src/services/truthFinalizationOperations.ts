import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export async function listTruthResultCaptureMatches(userId: string) {
  const result = await db.execute(sql`
    select id, player1_name, player2_name, tournament_name, scheduled_date,
           surface, actual_winner, result_status, final_score
    from matches where user_id = ${userId}::uuid order by scheduled_date, id
  `);
  return result.rows;
}

export async function updateTruthMatchResult(userId: string, matchId: string, patch: Record<string, unknown>) {
  const allowed = new Set(["actual_winner", "result_status", "final_score", "result_recorded_at"]);
  const entries = Object.entries(patch).filter(([key]) => allowed.has(key));
  if (!entries.length) return;
  // This operation has a fixed column allow-list. It is intentionally not a
  // general update endpoint; each permitted assignment is emitted explicitly.
  const actualWinner = entries.some(([key]) => key === "actual_winner") ? patch.actual_winner : undefined;
  const resultStatus = entries.some(([key]) => key === "result_status") ? patch.result_status : undefined;
  const finalScore = entries.some(([key]) => key === "final_score") ? patch.final_score : undefined;
  await db.execute(sql`
    update matches set
      actual_winner = coalesce(${actualWinner ?? null}, actual_winner),
      result_status = coalesce(${resultStatus ?? null}, result_status),
      final_score = coalesce(${finalScore ?? null}, final_score),
      result_recorded_at = case when ${actualWinner !== undefined} then now() else result_recorded_at end,
      updated_at = now()
    where id = ${matchId}::uuid and user_id = ${userId}::uuid
  `);
}

export async function listTruthResultCaptureState(userId: string) {
  const [runs, decisions, grades] = await Promise.all([
    db.execute(sql`select id, match_id, run_number, independent_winner from audit_runs where user_id = ${userId}::uuid and id in (select audit_run_id from final_decisions where user_id = ${userId}::uuid)`),
    db.execute(sql`select audit_run_id, gate_report from final_decisions where user_id = ${userId}::uuid`),
    db.execute(sql`select id, match_id, audit_run_id from result_grades where user_id = ${userId}::uuid`),
  ]);
  return { runs: runs.rows, decisions: decisions.rows, grades: grades.rows };
}

export async function saveTruthResultGrade(userId: string, existingId: string | null, row: Record<string, unknown>) {
  const values = {
    actual_winner: row.actual_winner ?? null, result_type: row.result_type ?? "WIN",
    matrix_predicted_winner: row.matrix_predicted_winner ?? null, matrix_wp: row.matrix_wp ?? null,
    matrix_prediction_result: row.matrix_prediction_result ?? "NOT GRADED",
    independent_winner: row.independent_winner ?? null, independent_low: row.independent_low ?? null,
    independent_high: row.independent_high ?? null, independent_audit_result: row.independent_audit_result ?? "NOT GRADED",
    final_selection: row.final_selection ?? null, final_selection_result: row.final_selection_result ?? "NOT GRADED",
    audit_color: row.audit_color ?? null, correction_pattern: row.correction_pattern ?? "UNCLASSIFIED",
    counted_in_matrix_calibration: row.counted_in_matrix_calibration ?? false, note: row.note ?? null,
    match_id: row.match_id ?? null, audit_run_id: row.audit_run_id ?? null,
  };
  if (existingId) {
    await db.execute(sql`
      update result_grades set actual_winner=${values.actual_winner}, result_type=${values.result_type},
      matrix_predicted_winner=${values.matrix_predicted_winner}, matrix_wp=${values.matrix_wp},
      matrix_prediction_result=${values.matrix_prediction_result}, independent_winner=${values.independent_winner},
      independent_low=${values.independent_low}, independent_high=${values.independent_high},
      independent_audit_result=${values.independent_audit_result}, final_selection=${values.final_selection},
      final_selection_result=${values.final_selection_result}, audit_color=${values.audit_color},
      correction_pattern=${values.correction_pattern}, counted_in_matrix_calibration=${values.counted_in_matrix_calibration},
      note=${values.note}, updated_at=now() where id=${existingId}::uuid and user_id=${userId}::uuid
    `);
  } else {
    await db.execute(sql`
      insert into result_grades
      (user_id, match_id, audit_run_id, actual_winner, result_type, matrix_predicted_winner, matrix_wp,
       matrix_prediction_result, independent_winner, independent_low, independent_high, independent_audit_result,
       final_selection, final_selection_result, audit_color, correction_pattern, counted_in_matrix_calibration, note)
      values (${userId}::uuid, ${values.match_id}::uuid, ${values.audit_run_id}::uuid, ${values.actual_winner},
       ${values.result_type}, ${values.matrix_predicted_winner}, ${values.matrix_wp}, ${values.matrix_prediction_result},
       ${values.independent_winner}, ${values.independent_low}, ${values.independent_high}, ${values.independent_audit_result},
       ${values.final_selection}, ${values.final_selection_result}, ${values.audit_color}, ${values.correction_pattern},
       ${values.counted_in_matrix_calibration}, ${values.note})
    `);
  }
}

export async function insertTruthExecutionLog(userId: string, entry: Record<string, unknown>) {
  await db.execute(sql`
    insert into execution_logs (user_id, audit_run_id, match_id, stage, status, output, matrix_visible)
    values (${userId}::uuid, ${entry.audit_run_id ?? null}::uuid, ${entry.match_id ?? null}::uuid,
      ${entry.stage ?? "RESULT_CAPTURE"}, ${entry.status ?? "COMPLETE"}, ${JSON.stringify(entry.output ?? {})}::jsonb,
      ${Boolean(entry.matrix_visible ?? false)})
  `);
}

export async function loadTruthObservationRows(userId: string, aliases: string[], asOfDate: string, startDate: string) {
  if (!aliases.length) return [];
  const result = await db.execute(sql`
    select source_id, source_name, source_url, player_name, opponent_name, tournament, event_date,
           surface, observation_type, observation_key, text_value, numeric_value, sample_label,
           window_start, window_end
    from source_observations
    where (user_id = ${userId}::uuid or user_id is null)
      and ((event_date >= ${startDate}::date and event_date <= ${asOfDate}::date) or event_date is null)
      and (player_name = any(${aliases}::text[]) or player_name is null)
      and observation_type not in ('POINT_BY_POINT','PBP')
    order by event_date desc limit 2000
  `);
  return result.rows;
}

export async function listTruthMetricEvidence(userId: string, metricCodes: string[], asOfDate: string) {
  if (!metricCodes.length) return [];
  const result = await db.execute(sql`
    select metric_code, player_name, opponent_name, tournament, surface, as_of_date, treatment,
           value_text, reliability, sample_label, evidence_family, sources, unavailable_reason,
           valid_until, updated_at as computed_at, updated_at
    from metric_evidence_store
    where metric_code = any(${metricCodes}::text[]) and as_of_date <= ${asOfDate}::date
    order by as_of_date desc limit 5000
  `);
  return result.rows;
}

export async function gradeTruthCalibration(userId: string, input: Record<string, unknown>) {
  return db.transaction(async (tx) => {
    const current = await tx.execute(sql`select * from calibration_versions where user_id=${userId}::uuid and is_active=true order by version_number desc limit 1`);
    const version = current.rows[0] as Record<string, any> | undefined;
    if (!version) throw new Error("No active calibration version");
    const buckets = await tx.execute(sql`select * from calibration_buckets where user_id=${userId}::uuid and calibration_version_id=${version.id}::uuid order by wp_min`);
    if (!buckets.rows.length) throw new Error("Active calibration version has no buckets");
    const counted = ["WIN", "LOSS", "RETIREMENT WIN", "RETIREMENT LOSS"].includes(String(input.result_type));
    const isWin = input.result_type === "WIN" || input.result_type === "RETIREMENT WIN";
    const wp = input.matrix_wp == null ? null : Number(input.matrix_wp);
    const bucket = wp == null ? undefined : buckets.rows.find((row: any) => wp >= Number(row.wp_min) && wp <= Number(row.wp_max));
    const next = await tx.execute(sql`
      insert into calibration_versions (user_id,label,version_number,master_sequence_count,graded_sample_count,is_active)
      values (${userId}::uuid, ${`Calibration v${Number(version.version_number)+1}`}, ${Number(version.version_number)+1},
        ${Number(version.master_sequence_count)+1}, ${Number(version.graded_sample_count)+(counted?1:0)}, true) returning *
    `);
    await tx.execute(sql`update calibration_versions set is_active=false where id=${version.id}::uuid and user_id=${userId}::uuid`);
    const nextVersion = next.rows[0] as Record<string, any>;
    for (const row of buckets.rows as any[]) {
      const hit = Boolean(bucket && row.id === bucket.id);
      await tx.execute(sql`
        insert into calibration_buckets
        (user_id, calibration_version_id, bucket_code, bucket_label, wp_min, wp_max, wins, graded, small_sample)
        values (${userId}::uuid, ${nextVersion.id}::uuid, ${row.bucket_code}, ${row.bucket_label}, ${row.wp_min}, ${row.wp_max},
          ${Number(row.wins)+(hit&&isWin?1:0)}, ${Number(row.graded)+(hit&&counted?1:0)}, ${Number(row.graded)+(hit&&counted?1:0)<10})
      `);
    }
    await tx.execute(sql`
      insert into calibration_ledger
      (user_id,match_id,match_label,tournament,surface,match_date,matrix_predicted_winner,matrix_wp,actual_winner,
       result_type,result_grading_status,counted_in_bucket,bucket_code,master_sequence,calibration_version_before,
       calibration_version_after,note)
      values (${userId}::uuid, ${input.match_id ?? null}::uuid, ${input.match_label}, ${input.tournament ?? null},
        ${input.surface ?? null}, ${input.match_date ?? null}::date, ${input.matrix_predicted_winner ?? null}, ${input.matrix_wp ?? null},
        ${input.actual_winner ?? null}, ${input.result_type}, ${counted ? "GRADED" : "NOT GRADED"}, ${Boolean(counted&&bucket)},
        ${bucket?.bucket_code ?? null}, ${Number(nextVersion.master_sequence_count)}, ${version.id}::uuid, ${nextVersion.id}::uuid, ${input.note ?? null})
    `);
    return nextVersion;
  });
}