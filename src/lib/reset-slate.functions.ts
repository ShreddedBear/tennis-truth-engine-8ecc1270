import { createServerFn } from "@tanstack/react-start";
import { LOCAL_WORKSPACE_ID } from "./constants";

// CLEAR SLATE MEANS PHYSICAL DELETION -- never retirement, archival, an is_active flag,
// or "preserve for auditing". The previous implementation only flipped
// summary_versions.is_active to false, nulled matches.active_summary_version_id, and
// invalidated the latest audit_runs row: every matches row, every metric/verification/
// disagreement/underdog/stress/decision row, and every summary_versions/summary_uploads
// row survived, physically, in the database. Because upload.tsx's findReusable() searches
// `matches` globally by canonical_key with no "cleared" filter, re-uploading the same PDF
// after that soft clear found and reused the old match row -- reviving its old audit
// history under what looked like a fresh upload. That is the leak this closes.
//
// The actual deletion, and everything it must and must not cascade, lives in ONE place:
// the public.clear_operational_slate(uuid) database function (see the migration this
// commit adds). This module is a thin, typed wrapper around that single authoritative
// path -- there must never be a second scattered DELETE statement reimplementing it here.
export interface ClearSlateResult {
  matches: number;
  auditRuns: number;
  summaryVersions: number;
  uploads: number;
  slates: number;
  calibrationObservations: number;
  before: Record<string, number>;
  after: Record<string, number>;
}

interface ClearOperationalSlateRpcRow {
  before: Record<string, number>;
  after: Record<string, number>;
  deleted_matches: number;
  deleted_uploads: number;
  deleted_slates: number;
  deleted_calibration_observations: number;
}

export async function clearOperationalSlate(db: {
  rpc(fn: "clear_operational_slate", args: { p_user_id: string }): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}): Promise<ClearSlateResult> {
  const { data: raw, error } = await db.rpc("clear_operational_slate", { p_user_id: LOCAL_WORKSPACE_ID });
  if (error) throw new Error(`Clear Slate failed: ${error.message}`);
  if (!raw || typeof raw !== "object") throw new Error("Clear Slate failed: the database returned no result.");
  const data = raw as ClearOperationalSlateRpcRow;

  // AFTER must independently prove the delete actually happened, not just that the RPC
  // returned without error -- every count here comes from the function re-querying the
  // exact rows it just deleted, inside the same transaction (see the migration).
  const survivors = Object.entries(data.after).filter(([, count]) => count > 0);
  if (survivors.length) {
    throw new Error(`Clear Slate did not fully delete the operational slate: ${survivors.map(([table, count]) => `${table}=${count}`).join(", ")} still present.`);
  }

  return {
    matches: data.deleted_matches,
    auditRuns: data.before["audit_runs"] ?? 0,
    summaryVersions: data.before["summary_versions"] ?? 0,
    uploads: data.deleted_uploads,
    slates: data.deleted_slates,
    calibrationObservations: data.deleted_calibration_observations,
    before: data.before,
    after: data.after,
  };
}

/**
 * Clears the entire operational prediction slate: uploaded matches, every audit_runs row
 * and everything computed from them (metrics, verification, disagreement, underdog,
 * stress, final decisions, coverage, execution logs, result grades), match identity/
 * dedup records, summary versions/uploads, and the prediction slate row itself.
 *
 * Nothing here is soft-deleted, retired, or archived. Global reference data --
 * players, tournaments, the metric registry, rules, calibration configuration, source
 * observations, the runtime tennis index -- is untouched: none of it is reachable from
 * `matches` by any foreign key, and clear_operational_slate() never references it.
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
      preserved: ["players", "tournaments", "metric registry", "rules", "calibration configuration", "source observations", "runtime tennis index"],
    };
  });
