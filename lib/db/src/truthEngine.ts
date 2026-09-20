import { sql } from "drizzle-orm";
import { db } from "./index";
import { auditRunsTable, metricEvidenceStoreTable } from "./schema";
import { assertOperationalSlateAuthorization, type TruthAuthorization } from "./truthEngine/authorization";

export type TruthDb = typeof db;

export type MetricEvidenceSideInput = {
  metricCode: string;
  metricName: string;
  playerName: string;
  opponentName?: string | null;
  tournament?: string | null;
  surface?: string | null;
  asOfDate: string;
  treatment: string;
  valueText: string;
  reliability?: number | null;
  sampleLabel?: string | null;
  evidenceFamily?: string | null;
  sourceIds?: string[];
  sources?: unknown[];
  unavailableReason?: string | null;
  validUntil?: Date | null;
  updatedAt?: Date;
};

/**
 * Preserves the functional unique-key conflict semantics of
 * upsert_metric_evidence_side. Drizzle's expression-index API cannot safely
 * infer this pre-existing index, so the SQL is parameterized through Drizzle.
 */
export async function upsertMetricEvidenceSide(input: MetricEvidenceSideInput) {
  const result = await db.execute(sql`
    insert into metric_evidence_store (
      metric_code, metric_name, player_name, opponent_name, tournament, surface,
      as_of_date, treatment, value_text, reliability, sample_label,
      evidence_family, source_ids, sources, unavailable_reason, valid_until,
      updated_at
    ) values (
      ${input.metricCode}, ${input.metricName}, ${input.playerName},
      ${input.opponentName ?? null}, ${input.tournament ?? null},
      ${input.surface ?? null}, ${input.asOfDate}, ${input.treatment},
      ${input.valueText}, ${input.reliability ?? null},
      ${input.sampleLabel ?? null}, ${input.evidenceFamily ?? null},
      ${input.sourceIds ?? []}, ${JSON.stringify(input.sources ?? [])}::jsonb,
      ${input.unavailableReason ?? null}, ${input.validUntil ?? null},
      ${input.updatedAt ?? sql`now()`}
    )
    on conflict (
      metric_code, (lower(player_name)),
      (coalesce(lower(opponent_name), '')),
      (coalesce(lower(tournament), '')),
      (coalesce(lower(surface), '')), as_of_date
    ) do update set
      metric_name = excluded.metric_name,
      treatment = excluded.treatment,
      value_text = excluded.value_text,
      reliability = excluded.reliability,
      sample_label = excluded.sample_label,
      evidence_family = excluded.evidence_family,
      source_ids = excluded.source_ids,
      sources = excluded.sources,
      unavailable_reason = excluded.unavailable_reason,
      valid_until = excluded.valid_until,
      updated_at = excluded.updated_at
    returning *
  `);
  return result.rows[0] as typeof metricEvidenceStoreTable.$inferSelect;
}

export type ClearSlateResult = {
  before: Record<string, number>;
  after: Record<string, number>;
  deletedMatches: number;
  deletedUploads: number;
  deletedSlates: number;
  deletedCalibrationObservations: number;
};

/**
 * Explicit administrative operation. The authorization check is deliberately
 * part of this function's contract; callers must obtain an admin-capable
 * request context before invoking it. This is not a general-purpose delete.
 */
export async function clearOperationalSlate(
  userId: string,
  authorization: TruthAuthorization,
): Promise<ClearSlateResult> {
  assertOperationalSlateAuthorization(authorization);

  return db.transaction(async (tx) => {
    const matchIds = await tx.execute<{ id: string }>(
      sql`select id from matches where user_id = ${userId}::uuid`,
    );
    const ids = matchIds.rows.map((row) => row.id);
    const runIds = ids.length
      ? await tx.execute<{ id: string }>(
        sql`select id from audit_runs where match_id = any(${ids}::uuid[])`,
      )
      : { rows: [] as { id: string }[] };
    const runs = runIds.rows.map((row) => row.id);
    const before = {
      matches: ids.length,
      audit_runs: runs.length,
      metric_results: runs.length ? await countFor(tx, "metric_results", "audit_run_id", runs) : 0,
      verification_results: runs.length ? await countFor(tx, "verification_results", "audit_run_id", runs) : 0,
      final_decisions: runs.length ? await countFor(tx, "final_decisions", "audit_run_id", runs) : 0,
      summary_versions: ids.length ? await countFor(tx, "summary_versions", "match_id", ids) : 0,
    };

    // Child records are explicitly listed to avoid relying on an accidental
    // cascade and to keep the deletion scope auditable.
    if (runs.length) {
      for (const table of [
        "metric_results", "verification_results", "disagreement_results",
        "underdog_results", "stress_results", "reconstruction_results",
        "metric_coverage_rates", "source_snapshots", "source_conflicts",
        "final_decisions", "audit_coverage", "audit_stage_runs",
      ]) await deleteByIds(tx, table, "audit_run_id", runs);
    }
    if (ids.length) {
      for (const table of ["execution_logs", "result_grades", "match_identity_records", "summary_versions"]) {
        await deleteByIds(tx, table, "match_id", ids);
      }
    }
    const deletedUploads = await tx.execute<{ count: string }>(sql`
      delete from summary_uploads su
      where su.user_id = ${userId}::uuid
        and not exists (select 1 from summary_versions sv where sv.upload_id = su.id)
      returning su.id
    `);
    if (runs.length) {
      await tx.execute(sql`delete from audit_runs where id = any(array[${sql.join(runs.map((id) => sql`${id}::uuid`), sql`, `)}]::uuid[])`);
    }
    const deletedMatchRows = ids.length
      ? await tx.execute(sql`delete from matches where id = any(array[${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}]::uuid[])`)
      : { rowCount: 0 };
    const after = { matches: 0, audit_runs: 0, metric_results: 0, verification_results: 0, final_decisions: 0, summary_versions: 0 };
    return {
      before,
      after,
      deletedMatches: deletedMatchRows.rowCount ?? 0,
      deletedUploads: deletedUploads.rows.length,
      deletedSlates: 0,
      deletedCalibrationObservations: 0,
    };
  });
}

async function countFor(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], table: string, column: string, ids: string[]) {
  const tableName = sql.raw(table);
  const columnName = sql.raw(column);
  const values = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
  const result = await tx.execute<{ count: string }>(
    sql`select count(*)::text as count from ${tableName} where ${columnName} = any(array[${values}]::uuid[])`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function deleteByIds(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], table: string, column: string, ids: string[]) {
  const tableName = sql.raw(table);
  const columnName = sql.raw(column);
  const values = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
  await tx.execute(sql`delete from ${tableName} where ${columnName} = any(array[${values}]::uuid[])`);
}