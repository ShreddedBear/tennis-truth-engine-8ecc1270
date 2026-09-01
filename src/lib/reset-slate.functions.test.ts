import { describe, expect, it } from "vitest";
import { clearOperationalSlate } from "./reset-slate.functions";

type Row = Record<string, unknown>;

class MemoryDb {
  tables: Record<string, Row[]>;

  constructor() {
    const current = { id: "match-current" };
    this.tables = {
      summary_uploads: [{ id: "upload-1" }, { id: "upload-2" }],
      summary_pages: [{ id: "page-1", upload_id: "upload-1" }],
      summary_versions: [
        { id: "version-1", upload_id: "upload-1", match_id: current.id, is_active: true },
        { id: "version-2", upload_id: "upload-2", match_id: current.id, is_active: true },
      ],
      matches: [current, { id: "historical-match" }],
      audit_runs: [{ id: "run-current", match_id: current.id, status: "RUNNING", lease_owner: "worker-1" }, { id: "run-history", match_id: "historical-match" }],
      metric_results: [{ id: "metric-current", audit_run_id: "run-current" }],
      reconstruction_results: [],
      verification_results: [],
      disagreement_results: [],
      underdog_results: [],
      stress_results: [],
      audit_stage_runs: [{ id: "stage-current", audit_run_id: "run-current", status: "RUNNING" }],
      source_snapshots: [],
      source_conflicts: [],
      audit_coverage: [],
      metric_coverage_rates: [],
      final_decisions: [{ id: "decision-current", audit_run_id: "run-current" }],
      execution_logs: [{ id: "log-current", audit_run_id: "run-current", match_id: current.id }],
      match_identity_records: [{ id: "identity-current", match_id: current.id }],
      parsed_summary_fields: [{ id: "field-current", summary_version_id: "version-1" }],
      calibration_versions: [{ id: "calibration-1" }],
      calibration_buckets: [{ id: "bucket-1", calibration_version_id: "calibration-1" }],
      source_observations: [{ id: "observation-1" }],
      rule_documents: [{ id: "rules-1" }],
    };
  }

  from(table: string) {
    const db = this;
    return {
      mode: "select" as "select" | "update" | "delete",
      column: "",
      values: null as string[] | null,
      patch: null as Record<string, unknown> | null,
      select() { return this; },
      update(patch: Record<string, unknown>) { this.mode = "update" as never; this.patch = patch; return this; },
      delete() { this.mode = "delete"; return this; },
      in(column: string, values: string[]) {
        this.column = column;
        this.values = values;
        const rows = db.tables[table] ?? [];
        const selected = new Set(values);
        if (this.mode === "update") {
          db.tables[table] = rows.map((row) => selected.has(String(row[column])) ? { ...row, ...this.patch } : row);
          return Promise.resolve({ data: null, error: null });
        }
        if (this.mode === "delete") {
          db.tables[table] = rows.filter((row) => !selected.has(String(row[column])));
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: rows.filter((row) => selected.has(String(row[column]))), error: null });
      },
      then(resolve: (value: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve({ data: db.tables[table] ?? [], error: null }).then(resolve);
      },
    };
  }
}

describe("clearOperationalSlate", () => {
  it("clears populated current slate rows while preserving permanent data", async () => {
    const db = new MemoryDb();
    const deleted = await clearOperationalSlate(db);

    expect(deleted).toEqual({ matches: 1, auditRuns: 1, summaryVersions: 2, uploads: 2 });
    expect(db.tables.matches).toEqual([{ id: "match-current", active_summary_version_id: null }, { id: "historical-match" }]);
    expect(db.tables.audit_runs).toHaveLength(2);
    expect(db.tables.audit_runs.find((row) => row.id === "run-history")).toBeTruthy();
    expect(db.tables.summary_uploads).toHaveLength(2);
    expect(db.tables.summary_pages).toHaveLength(1);
    expect(db.tables.summary_versions.every((row) => row.is_active === false)).toBe(true);
    expect(db.tables.audit_runs.find((row) => row.id === "run-current")).toMatchObject({ status: "INVALIDATED — RERUN REQUIRED", lease_owner: null, lease_expires_at: null });
    expect(db.tables.calibration_versions).toEqual([{ id: "calibration-1" }]);
    expect(db.tables.calibration_buckets).toEqual([{ id: "bucket-1", calibration_version_id: "calibration-1" }]);
    expect(db.tables.source_observations).toEqual([{ id: "observation-1" }]);
    expect(db.tables.rule_documents).toEqual([{ id: "rules-1" }]);
  });

  it("clears stuck leased and resumable runs, is idempotent, and allows a clean new upload", async () => {
    const db = new MemoryDb();
    await clearOperationalSlate(db);

    expect(await clearOperationalSlate(db)).toEqual({ matches: 0, auditRuns: 0, summaryVersions: 0, uploads: 0 });
    db.tables.summary_uploads.push({ id: "upload-new" });
    db.tables.summary_versions.push({ id: "version-new", upload_id: "upload-new", match_id: "match-new", is_active: true });
    db.tables.matches.push({ id: "match-new", active_summary_version_id: "version-new" });

    expect(await clearOperationalSlate(db)).toEqual({ matches: 1, auditRuns: 0, summaryVersions: 1, uploads: 1 });
    expect(db.tables.matches).toHaveLength(3);
    expect(db.tables.source_observations).toHaveLength(1);
  });
});
