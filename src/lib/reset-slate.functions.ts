import { createServerFn } from "@tanstack/react-start";
import { INVALIDATED_RUN_STATUS } from "./audit-stages";

async function readIds(db: any, table: string, column: string, ids?: string[]): Promise<any[]> {
  if (ids && !ids.length) return [];
  let query = db.from(table).select("*");
  if (ids?.length) query = query.in(column, ids);
  const { data, error } = await query;
  if (error) throw new Error(`Could not read ${table}: ${error.message}`);
  return data ?? [];
}

async function updateIn(db: any, table: string, column: string, ids: string[], patch: Record<string, unknown>) {
  if (!ids.length) return;
  const { error } = await db.from(table).update(patch).in(column, ids);
  if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
}

export async function clearOperationalSlate(db: any) {
  const uploadRows = await readIds(db, "summary_uploads", "id");
  const uploadIds = uploadRows.map((r: any) => String(r.id));
  const versionRows = await readIds(db, "summary_versions", "upload_id", uploadIds);
  const activeVersions = versionRows.filter((row: any) => row.is_active !== false);
  const versionIds = activeVersions.map((r: any) => String(r.id));
  const activeUploadIds = [...new Set(activeVersions.map((r: any) => String(r.upload_id)).filter(Boolean))];
  const matchIds = [...new Set(activeVersions.map((r: any) => String(r.match_id)).filter(Boolean))];

  const latestRunIds: string[] = [];
  for (let i = 0; i < matchIds.length; i += 200) {
    const batch = matchIds.slice(i, i + 200);
    if (!batch.length) continue;
    const runs = await readIds(db, "audit_runs", "match_id", batch);
    const latestByMatch = new Map<string, any>();
    for (const run of runs) {
      const current = latestByMatch.get(String(run.match_id));
      if (!current || Number(run.run_number) > Number(current.run_number)) latestByMatch.set(String(run.match_id), run);
    }
    latestRunIds.push(...[...latestByMatch.values()].map((run: any) => String(run.id)));
  }

  await updateIn(db, "summary_versions", "id", versionIds, { is_active: false });
  await updateIn(db, "matches", "id", matchIds, { active_summary_version_id: null });
  await updateIn(db, "audit_runs", "id", latestRunIds, {
    status: INVALIDATED_RUN_STATUS,
    lease_owner: null,
    lease_expires_at: null,
  });

  return {
    matches: matchIds.length,
    auditRuns: latestRunIds.length,
    summaryVersions: versionIds.length,
    uploads: activeUploadIds.length,
  };
}

export function removableOperationalMatchIds(matchIds: string[], completedMatchIds: Iterable<string>) {
  const protectedIds = new Set(completedMatchIds);
  return matchIds.filter(id => !protectedIds.has(id));
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
    const deleted = await clearOperationalSlate(db);

    return {
      ok: true as const,
      deleted,
      preserved: ["permanent uploads", "completed audit snapshots", "calibration", "rules", "metric registry", "metric wiring", "source observations", "historical evidence"],
    };
  });
