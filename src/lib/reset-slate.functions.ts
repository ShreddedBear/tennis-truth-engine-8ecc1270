import { createServerFn } from "@tanstack/react-start";

const CHILD_RUN_TABLES = [
  "metric_results",
  "reconstruction_results",
  "verification_results",
  "disagreement_results",
  "underdog_results",
  "stress_results",
  "audit_stage_runs",
  "source_snapshots",
  "source_conflicts",
  "audit_coverage",
  "metric_coverage_rates",
  "final_decisions",
] as const;

async function deleteIn(db: any, table: string, column: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    if (!batch.length) continue;
    const { error } = await db.from(table).delete().in(column, batch);
    if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
  }
}

/**
 * Clears only operational slate/upload/audit data.
 * Calibration versions/buckets, rule documents/definitions, metric registry,
 * and historical evidence datasets are intentionally preserved.
 */
export const resetOperationalSlate = createServerFn({ method: "POST" })
  .inputValidator((data: { confirm: string }) => {
    if (data?.confirm !== "CLEAR SLATE") throw new Error("Clear slate confirmation is required");
    return data;
  })
  .handler(async () => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const { data: matchRows, error: matchError } = await db.from("matches").select("id");
    if (matchError) throw new Error(`Could not read matches: ${matchError.message}`);
    const matchIds = (matchRows ?? []).map((r: any) => String(r.id));

    const runIds: string[] = [];
    const versionIds: string[] = [];
    for (let i = 0; i < matchIds.length; i += 200) {
      const batch = matchIds.slice(i, i + 200);
      if (!batch.length) continue;
      const [{ data: runs, error: runError }, { data: versions, error: versionError }] = await Promise.all([
        db.from("audit_runs").select("id").in("match_id", batch),
        db.from("summary_versions").select("id").in("match_id", batch),
      ]);
      if (runError) throw new Error(`Could not read audit runs: ${runError.message}`);
      if (versionError) throw new Error(`Could not read summary versions: ${versionError.message}`);
      runIds.push(...(runs ?? []).map((r: any) => String(r.id)));
      versionIds.push(...(versions ?? []).map((r: any) => String(r.id)));
    }

    for (const table of CHILD_RUN_TABLES) await deleteIn(db, table, "audit_run_id", runIds);
    await deleteIn(db, "execution_logs", "audit_run_id", runIds);
    await deleteIn(db, "execution_logs", "match_id", matchIds);
    await deleteIn(db, "audit_runs", "id", runIds);
    await deleteIn(db, "match_identity_records", "match_id", matchIds);
    await deleteIn(db, "parsed_summary_fields", "summary_version_id", versionIds);
    await deleteIn(db, "summary_versions", "id", versionIds);
    await deleteIn(db, "matches", "id", matchIds);

    const { data: uploads, error: uploadReadError } = await db.from("summary_uploads").select("id");
    if (uploadReadError) throw new Error(`Could not read uploads: ${uploadReadError.message}`);
    const uploadIds = (uploads ?? []).map((r: any) => String(r.id));
    await deleteIn(db, "summary_uploads", "id", uploadIds);

    return {
      ok: true as const,
      deleted: { matches: matchIds.length, auditRuns: runIds.length, summaryVersions: versionIds.length, uploads: uploadIds.length },
      preserved: ["calibration", "rules", "metric registry", "historical evidence"],
    };
  });
