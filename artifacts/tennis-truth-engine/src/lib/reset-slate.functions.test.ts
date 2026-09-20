import { describe, expect, it } from "vitest";
import { clearOperationalSlate } from "./reset-slate.functions";
import { LOCAL_WORKSPACE_ID } from "./constants";

// Clear Slate means physical deletion, proven end to end through this module's thin RPC
// wrapper: it must call the one authoritative database function with the right user, and
// it must refuse to report success unless the function's own AFTER snapshot proves every
// row is actually gone -- never trust a bare "no error" as proof of deletion.

function fakeDb(result: { before: Record<string, number>; after: Record<string, number>; deleted_matches: number; deleted_uploads: number; deleted_slates: number; deleted_calibration_observations: number } | null, error: string | null = null) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  return {
    calls,
    rpc(fn: string, args: unknown) {
      calls.push({ fn, args });
      return Promise.resolve({ data: result, error: error ? { message: error } : null });
    },
  };
}

const CLEAN_AFTER = {
  matches: 0, audit_runs: 0, metric_results: 0, verification_results: 0, disagreement_results: 0,
  underdog_results: 0, stress_results: 0, final_decisions: 0, audit_coverage: 0, audit_stage_runs: 0,
  execution_logs: 0, result_grades: 0, match_identity_records: 0, summary_versions: 0, prediction_slates: 0,
  truth_engine_calibration_observations: 0,
};
const POPULATED_BEFORE = { ...CLEAN_AFTER, matches: 50, audit_runs: 62, metric_results: 4300, summary_versions: 50, summary_uploads: 3, prediction_slates: 1 };

describe("clearOperationalSlate", () => {
  it("A/D. calls the single authoritative RPC, scoped to this app's operational owner", async () => {
    const db = fakeDb({ before: POPULATED_BEFORE, after: CLEAN_AFTER, deleted_matches: 50, deleted_uploads: 3, deleted_slates: 1, deleted_calibration_observations: 0 });
    await clearOperationalSlate(db);
    expect(db.calls).toEqual([{ fn: "clear_operational_slate", args: { p_user_id: LOCAL_WORKSPACE_ID } }]);
  });

  it("reports the real deleted counts, not a soft-clear count", async () => {
    const db = fakeDb({ before: POPULATED_BEFORE, after: CLEAN_AFTER, deleted_matches: 50, deleted_uploads: 3, deleted_slates: 1, deleted_calibration_observations: 0 });
    const result = await clearOperationalSlate(db);
    expect(result).toMatchObject({ matches: 50, auditRuns: 62, summaryVersions: 50, uploads: 3, slates: 1, calibrationObservations: 0 });
    expect(result.before).toEqual(POPULATED_BEFORE);
    expect(result.after).toEqual(CLEAN_AFTER);
  });

  it("P. zero matches on the slate succeeds cleanly, reporting zero deletions", async () => {
    const emptyBefore = { ...CLEAN_AFTER, summary_uploads: 0 };
    const db = fakeDb({ before: emptyBefore, after: CLEAN_AFTER, deleted_matches: 0, deleted_uploads: 0, deleted_slates: 0, deleted_calibration_observations: 0 });
    const result = await clearOperationalSlate(db);
    expect(result).toMatchObject({ matches: 0, auditRuns: 0, summaryVersions: 0, uploads: 0, slates: 0 });
  });

  it("O. calling it twice in a row is safe: the second call reports nothing left to delete", async () => {
    const db = fakeDb({ before: CLEAN_AFTER, after: CLEAN_AFTER, deleted_matches: 0, deleted_uploads: 0, deleted_slates: 0, deleted_calibration_observations: 0 });
    await expect(clearOperationalSlate(db)).resolves.toMatchObject({ matches: 0 });
  });

  it("refuses to report success if the database's own AFTER snapshot shows survivors", async () => {
    // This is the exact bug class being fixed: a soft clear that returns happily while
    // rows remain. If the RPC's own post-delete verification ever regresses to that, the
    // wrapper must fail loudly instead of reporting a clean slate.
    const db = fakeDb({ before: POPULATED_BEFORE, after: { ...CLEAN_AFTER, matches: 50 }, deleted_matches: 0, deleted_uploads: 0, deleted_slates: 0, deleted_calibration_observations: 0 });
    await expect(clearOperationalSlate(db)).rejects.toThrow(/did not fully delete/i);
  });

  it("surfaces a database error rather than reporting a silent, incomplete success", async () => {
    const db = fakeDb(null, "permission denied for function clear_operational_slate");
    await expect(clearOperationalSlate(db)).rejects.toThrow(/permission denied/);
  });
});
