// Browser-callable entry points for the match workspace.
//
// Module scope stays free of server-only imports; the server module is reached with a
// dynamic import inside each handler.
import { createServerFn } from "@tanstack/react-start";

const EDITABLE_AUDIT_TABLES = [
  "metric_results", "verification_results", "disagreement_results",
  "underdog_results", "stress_results",
] as const;
export type EditableAuditTable = (typeof EDITABLE_AUDIT_TABLES)[number];

const IDENTITY_FIELDS = ["identity_status", "surface_status"] as const;
const IDENTITY_VALUES = ["UNVERIFIED", "VERIFIED", "CONFLICT"] as const;
export type IdentityField = (typeof IDENTITY_FIELDS)[number];

export const fetchMatchWorkspace = createServerFn({ method: "POST" })
  .inputValidator((data: { matchId: string }) => {
    const matchId = String(data?.matchId ?? "").trim();
    if (!matchId) throw new Error("A match id is required.");
    return { matchId };
  })
  .handler(async ({ data }) => {
    const { loadMatchWorkspace } = await import("./match-workspace.server");
    return loadMatchWorkspace(data.matchId);
  });

export const fetchStageRows = createServerFn({ method: "POST" })
  .inputValidator((data: { runId: string }) => {
    const runId = String(data?.runId ?? "").trim();
    if (!runId) throw new Error("A run id is required.");
    return { runId };
  })
  .handler(async ({ data }) => {
    const { loadStageRows } = await import("./match-workspace.server");
    return loadStageRows(data.runId);
  });

/**
 * Edits one persisted audit row.
 *
 * The table name is checked against a fixed list rather than passed through: it used to be
 * interpolated straight into supabase.from(table) from the browser, and the five result
 * tables are the only ones this screen has any business writing.
 */
export const patchAuditRowFn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    table: EditableAuditTable; id: string; values: Record<string, unknown>;
    runId: string; matchId: string; stage: string;
  }) => {
    const table = data?.table;
    if (!EDITABLE_AUDIT_TABLES.includes(table)) throw new Error(`"${String(table)}" is not an editable audit table.`);
    const id = String(data?.id ?? "").trim();
    const runId = String(data?.runId ?? "").trim();
    const matchId = String(data?.matchId ?? "").trim();
    if (!id || !runId || !matchId) throw new Error("An audit row edit needs a row id, a run id and a match id.");
    if (!data.values || typeof data.values !== "object") throw new Error("An audit row edit needs values.");
    return { table, id, values: data.values, runId, matchId, stage: String(data?.stage ?? "") };
  })
  .handler(async ({ data }) => {
    const { patchAuditRow } = await import("./match-workspace.server");
    await patchAuditRow(data.table, data.id, data.values, {
      runId: data.runId, matchId: data.matchId, stage: data.stage,
    });
    return { ok: true as const };
  });

export const setIdentityField = createServerFn({ method: "POST" })
  .inputValidator((data: { matchId: string; field: IdentityField; value: string; runId: string | null }) => {
    const matchId = String(data?.matchId ?? "").trim();
    if (!matchId) throw new Error("A match id is required.");
    if (!IDENTITY_FIELDS.includes(data?.field)) throw new Error(`"${String(data?.field)}" is not a settable identity field.`);
    if (!IDENTITY_VALUES.includes(data?.value as (typeof IDENTITY_VALUES)[number])) {
      throw new Error(`"${String(data?.value)}" is not a valid verification status.`);
    }
    return { matchId, field: data.field, value: data.value, runId: data.runId ?? null };
  })
  .handler(async ({ data }) => {
    const { setMatchIdentityField } = await import("./match-workspace.server");
    await setMatchIdentityField(data.matchId, data.field, data.value, data.runId);
    return { ok: true as const };
  });
