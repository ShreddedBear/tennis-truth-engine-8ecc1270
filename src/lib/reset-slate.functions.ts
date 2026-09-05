import { createServerFn } from "@tanstack/react-start";
import { INVALIDATED_RUN_STATUS } from "./audit-stages";
import { retireActiveSlate } from "./prediction-slate.functions";

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
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db.from(table).update(patch).in(column, ids.slice(i, i + 200));
    if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
  }
}

/**
 * CLEAR SLATE.
 *
 * Three things happen, and the FIRST is the one that was missing:
 *
 *  1. THE SLATE IS RETIRED. prediction_slates row gets retired_at, which removes it from
 *     every "current slate" query AND -- the actual integrity fix -- removes its matches
 *     from the upload dedupe universe. Without this step the next upload of the same PDF
 *     found the cleared slate's own match rows by canonical_key and reported "0 new matches,
 *     50 existing matches reused", re-attaching the retired slate's audit runs, metric
 *     results, evidence and decisions to what the user believed was a new prediction.
 *
 *  2. Its summary versions are deactivated and matches lose their active version pointer, as
 *     before, so nothing on the retired slate reads as live.
 *
 *  3. EVERY audit run on the retired slate is invalidated -- not just each match's latest.
 *     A retired slate must not be able to resolve an "active run" through any older run
 *     either, however the resolver is reached.
 *
 * NOTHING IS DELETED. The retired slate stays on disk and stays auditable; it simply stops
 * being current. And nothing global is touched: players, tournaments, metric_registry,
 * metric_evidence_store, source_observations, rules, the runtime tennis index, calibration
 * versions/buckets and resolved calibration observations all survive Clear Slate untouched.
 */
export async function clearOperationalSlate(db: any) {
  const retiredSlateId = await retireActiveSlate(db, "CLEAR_SLATE");

  const uploadRows = await readIds(db, "summary_uploads", "id");
  const uploadIds = uploadRows.map((r: any) => String(r.id));
  const versionRows = await readIds(db, "summary_versions", "upload_id", uploadIds);
  const activeVersions = versionRows.filter((row: any) => row.is_active !== false);
  const versionIds = activeVersions.map((r: any) => String(r.id));
  const activeUploadIds = [...new Set(activeVersions.map((r: any) => String(r.upload_id)).filter(Boolean))];

  // Every match on the retired slate, plus anything that still holds an active summary
  // version. The two sets are normally identical; taking the union means a match that
  // predates the slate boundary (or was written by some other path) is still cleared.
  const slateMatchRows = retiredSlateId
    ? await readIds(db, "matches", "slate_id", [retiredSlateId])
    : [];
  const matchIds = [
    ...new Set([
      ...slateMatchRows.map((r: any) => String(r.id)),
      ...activeVersions.map((r: any) => String(r.match_id)).filter(Boolean),
    ]),
  ];

  const runIds: string[] = [];
  for (let i = 0; i < matchIds.length; i += 200) {
    const batch = matchIds.slice(i, i + 200);
    if (!batch.length) continue;
    const runs = await readIds(db, "audit_runs", "match_id", batch);
    runIds.push(...runs.map((run: any) => String(run.id)));
  }

  await updateIn(db, "summary_versions", "id", versionIds, { is_active: false });
  await updateIn(db, "matches", "id", matchIds, { active_summary_version_id: null });
  await updateIn(db, "audit_runs", "id", runIds, {
    status: INVALIDATED_RUN_STATUS,
    lease_owner: null,
    lease_expires_at: null,
  });

  return {
    retiredSlateId,
    matches: matchIds.length,
    auditRuns: runIds.length,
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
      preserved: ["permanent uploads", "completed audit snapshots", "calibration", "rules", "metric registry", "metric wiring", "source observations", "historical evidence", "resolved calibration observations", "player and tournament identity"],
    };
  });
