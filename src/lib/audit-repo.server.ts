// PostgreSQL-backed implementation of the audit pipeline data contract.
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client.server";
import { dbCall } from "@/db/query-errors";
import {
  auditCoverageTable, auditRunsTable, auditStageRunsTable, calibrationBucketsTable,
  calibrationVersionsTable, executionLogsTable, finalDecisionsTable, matchIdentityRecordsTable,
  matchesTable, metricCoverageRatesTable, metricRegistryTable, metricResultsTable,
  parsedSummaryFieldsTable, reconstructionResultsTable, ruleDocumentsTable, rulesTable, sourceConflictsTable,
  sourceSnapshotsTable, summaryVersionsTable,
} from "@/db/schema";
import { tableByName } from "@/db/table-registry";
import { excludedSet } from "@/db/upsert";
import { LOCAL_WORKSPACE_ID } from "./constants";
import { warehouseFirstResearcher } from "./warehouse-first-researcher.server";
import { STAGES, type ChildTable, type PipelineDeps, type RunRow, type Stage } from "./audit-pipeline";

const OWNER = LOCAL_WORKSPACE_ID;
async function ownerId(): Promise<string> { return OWNER; }

/** Drizzle types .set()/.values() against the table; these payloads are open records by contract. */
type Row = Record<string, unknown>;
const row = (value: Row) => value as never;
const rows = (value: readonly Row[]) => value as never;

/**
 * Calls one of the database's lease/slate functions and returns its single scalar result.
 * These were PostgREST /rpc/ calls; over a direct connection they are ordinary SELECTs.
 */
async function callScalar<T>(fn: SQLQuery): Promise<T | undefined> {
  const result = await db.execute(fn);
  return (result.rows[0] as Record<string, T> | undefined)?.["result"];
}
type SQLQuery = ReturnType<typeof sql>;

export async function makeDeps(): Promise<PipelineDeps> {
  const user_id = await ownerId();
  return {
    now: () => new Date(), research: warehouseFirstResearcher,

    async getMatch(matchId) {
      const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
      return (match as never) ?? null;
    },
    async updateMatch(matchId, patch) {
      await dbCall("update", "matches", () => db.update(matchesTable).set(row(patch)).where(eq(matchesTable.id, matchId)));
    },
    async getParsedFields(matchId) {
      const [version] = await db.select({ id: summaryVersionsTable.id }).from(summaryVersionsTable)
        .where(and(eq(summaryVersionsTable.match_id, matchId), eq(summaryVersionsTable.is_active, true))).limit(1);
      if (!version) return {};
      const fields = await db.select({
        field_key: parsedSummaryFieldsTable.field_key,
        normalized_value: parsedSummaryFieldsTable.normalized_value,
        raw_value: parsedSummaryFieldsTable.raw_value,
      }).from(parsedSummaryFieldsTable).where(eq(parsedSummaryFieldsTable.summary_version_id, version.id));
      const out: Record<string, string> = {};
      for (const field of fields) { const v = field.normalized_value ?? field.raw_value; if (v) out[field.field_key] = v; }
      return out;
    },
    async getActiveVersionId(docType) {
      const [document] = await db.select({ active_version_id: ruleDocumentsTable.active_version_id })
        .from(ruleDocumentsTable).where(eq(ruleDocumentsTable.doc_type, docType)).limit(1);
      return document?.active_version_id ?? null;
    },
    async getRules(versionId) {
      const found = await db.select({
        id: rulesTable.id, rule_code: rulesTable.rule_code, rule_name: rulesTable.rule_name,
        body: rulesTable.body, severity: rulesTable.severity, blocking: rulesTable.blocking,
      }).from(rulesTable).where(eq(rulesTable.version_id, versionId)).orderBy(rulesTable.rule_code);
      return found as never;
    },
    async getLatestRun(matchId) {
      const [run] = await db.select().from(auditRunsTable).where(eq(auditRunsTable.match_id, matchId))
        .orderBy(desc(auditRunsTable.run_number)).limit(1);
      return ((run as never) ?? null) as RunRow | null;
    },
    async createRun(newRun) {
      const [created] = await dbCall("insert", "audit_runs",
        () => db.insert(auditRunsTable).values(row({ ...newRun, user_id })).returning());
      if (!created) throw new Error("Could not create audit run: the insert returned no row.");
      return created as never;
    },
    async updateRun(runId, patch) {
      await dbCall("update", "audit_runs", () => db.update(auditRunsTable).set(row(patch)).where(eq(auditRunsTable.id, runId)));
    },

    // Run leases. The three functions are unchanged plpgsql (src/db/sql/01-functions.sql);
    // only the transport changed, from POST /rpc/<fn> to SELECT <fn>().
    async acquireRunLease(runId, owner, leaseMs) {
      const seconds = Math.ceil(leaseMs / 1000);
      const claimed = await dbCall("write", "audit_runs", () => callScalar<boolean>(
        sql`select public.claim_audit_run(${runId}::uuid, ${owner}::text, ${seconds}::int) as result`));
      return claimed === true;
    },
    async renewRunLease(runId, owner, leaseMs) {
      const seconds = Math.ceil(leaseMs / 1000);
      const renewed = await dbCall("write", "audit_runs", () => callScalar<boolean>(
        sql`select public.renew_audit_run_lease(${runId}::uuid, ${owner}::text, ${seconds}::int) as result`));
      return renewed === true;
    },
    async releaseRunLease(runId, owner) {
      await dbCall("write", "audit_runs", () => callScalar<boolean>(
        sql`select public.release_audit_run_lease(${runId}::uuid, ${owner}::text) as result`));
    },

    // The six sibling result tables the pipeline writes, chosen by name at runtime.
    // They are structurally alike where it matters here -- every one has `id` and
    // `audit_run_id` -- so one of them stands in for the column types. tableByName still
    // validates the name against the schema, so an unknown table throws rather than
    // producing a malformed query.
    async list(table: ChildTable, runId) {
      const target = tableByName(table) as typeof metricResultsTable;
      return await dbCall("read", table, async () =>
        (await db.select().from(target).where(eq(target.audit_run_id, runId))) as never);
    },
    async insert(table: ChildTable, newRows) {
      const target = tableByName(table);
      // Batched at 200 to keep a single statement's parameter count well inside the
      // protocol's 65,535 bound -- the widest of these tables has 37 columns.
      for (let i = 0; i < newRows.length; i += 200) {
        const batch = newRows.slice(i, i + 200).map((r) => ({ ...r, user_id }));
        await dbCall("insert", table, () => db.insert(target).values(rows(batch)));
      }
    },
    async update(table: ChildTable, id, patch) {
      const target = tableByName(table) as typeof metricResultsTable;
      await dbCall("update", table, () => db.update(target).set(row(patch)).where(eq(target.id, id)));
    },

    async getStages(runId) {
      return await dbCall("read", "audit_stage_runs", async () => (await db.select({
        stage: auditStageRunsTable.stage, status: auditStageRunsTable.status,
        attempts: auditStageRunsTable.attempts, error_message: auditStageRunsTable.error_message,
        done_count: auditStageRunsTable.done_count, total_count: auditStageRunsTable.total_count,
        heartbeat_at: auditStageRunsTable.heartbeat_at, started_at: auditStageRunsTable.started_at,
        finished_at: auditStageRunsTable.finished_at,
      }).from(auditStageRunsTable).where(eq(auditStageRunsTable.audit_run_id, runId))) as never);
    },
    async setStage(runId, matchId, stage: Stage, patch) {
      const heartbeat_at = patch["heartbeat_at"] ?? new Date().toISOString();
      const values = {
        audit_run_id: runId, match_id: matchId, stage, stage_order: STAGES.indexOf(stage),
        user_id, heartbeat_at, ...patch,
      };
      await dbCall("write", "audit_stage_runs", () => db.insert(auditStageRunsTable).values(row(values))
        .onConflictDoUpdate({
          target: [auditStageRunsTable.audit_run_id, auditStageRunsTable.stage],
          set: excludedSet(auditStageRunsTable, [values], ["audit_run_id", "stage"]),
        }));
    },

    async saveIdentityRecords(matchId, newRows) {
      const fields = newRows.map((r) => String(r["field"]));
      if (fields.length) {
        await db.delete(matchIdentityRecordsTable).where(and(
          eq(matchIdentityRecordsTable.match_id, matchId),
          inArray(matchIdentityRecordsTable.field, fields),
        ));
      }
      if (!newRows.length) return;
      await db.insert(matchIdentityRecordsTable).values(rows(newRows.map((r) => ({ ...r, match_id: matchId, user_id }))));
    },
    async saveSnapshots(runId, newRows) {
      if (!newRows.length) return;
      await db.insert(sourceSnapshotsTable).values(rows(newRows.map((r) => ({ ...r, audit_run_id: runId, user_id }))));
    },
    async saveConflicts(runId, newRows) {
      if (!newRows.length) return;
      await db.insert(sourceConflictsTable).values(rows(newRows.map((r) => ({ ...r, audit_run_id: runId, user_id }))));
    },

    async getCalibration(versionId) {
      const columns = { id: calibrationVersionsTable.id, label: calibrationVersionsTable.label, version_number: calibrationVersionsTable.version_number };
      const [version] = versionId
        ? await dbCall("read", "calibration_versions", () => db.select(columns).from(calibrationVersionsTable).where(eq(calibrationVersionsTable.id, versionId)).limit(1))
        : await dbCall("read", "calibration_versions", () => db.select(columns).from(calibrationVersionsTable).where(eq(calibrationVersionsTable.is_active, true)).orderBy(desc(calibrationVersionsTable.version_number)).limit(1));
      if (!version) return { version: null, buckets: [] };
      const buckets = await dbCall("read", "calibration_buckets", () => db.select({
        bucket_code: calibrationBucketsTable.bucket_code, wp_min: calibrationBucketsTable.wp_min,
        wp_max: calibrationBucketsTable.wp_max, wins: calibrationBucketsTable.wins, graded: calibrationBucketsTable.graded,
      }).from(calibrationBucketsTable).where(eq(calibrationBucketsTable.calibration_version_id, version.id)).orderBy(calibrationBucketsTable.wp_min));
      return { version, buckets: buckets as never };
    },

    async getDecisionId(runId) {
      const [decision] = await db.select({ id: finalDecisionsTable.id }).from(finalDecisionsTable)
        .where(eq(finalDecisionsTable.audit_run_id, runId)).limit(1);
      return decision?.id ?? null;
    },
    async saveDecision(runId, existingId, payload) {
      const extras = {
        final_recommendation: payload["final_recommendation"] ?? null,
        independent_winner: payload["independent_winner"] ?? null,
        independent_range: payload["independent_range"] ?? null,
        calibrated_range: payload["calibrated_range"] ?? null,
        calibration_version_id: payload["calibration_version_id"] ?? null,
        calibration_wins: payload["calibration_wins"] ?? null,
        calibration_graded: payload["calibration_graded"] ?? null,
        green_locked: payload["green_locked"] ?? null,
        green_lock_reasons: payload["green_lock_reasons"] ?? [],
      };
      const persisted = {
        audit_run_id: runId,
        final_audit_color: payload["final_audit_color"] ?? null,
        final_selection: payload["final_selection"] ?? payload["final_recommendation"] ?? null,
        selected_player_id: payload["selected_player_id"] ?? null,
        action: payload["action"] ?? payload["final_recommendation"] ?? null,
        gate_report: { ...extras, ...((payload["gate_report"] && typeof payload["gate_report"] === "object") ? payload["gate_report"] as Record<string, unknown> : {}) },
        completion_percent: payload["completion_percent"] ?? 0,
        audit_complete: payload["audit_complete"] ?? true,
        matrix_firewall_valid: payload["matrix_firewall_valid"] ?? false,
        calibration_bucket: payload["calibration_bucket"] ?? null,
        verified_win_rate: payload["verified_win_rate"] ?? null,
      };
      if (existingId) {
        await dbCall("update", "final_decisions", () => db.update(finalDecisionsTable).set(row(persisted)).where(eq(finalDecisionsTable.id, existingId)));
      } else {
        await dbCall("insert", "final_decisions", () => db.insert(finalDecisionsTable).values(row({ ...persisted, user_id })));
      }
    },

    async getConflicts(runId) {
      const found = await db.select({ critical: sourceConflictsTable.critical, resolution_status: sourceConflictsTable.resolution_status })
        .from(sourceConflictsTable).where(eq(sourceConflictsTable.audit_run_id, runId));
      return found as never;
    },
    async getReconstructions(runId) {
      const found = await db.select({ status: reconstructionResultsTable.status })
        .from(reconstructionResultsTable).where(eq(reconstructionResultsTable.audit_run_id, runId));
      return found as never;
    },

    async saveCoverage(runId, newRows) {
      const mapped = newRows.map((r) => ({
        audit_run_id: r["audit_run_id"] ?? runId, player_side: r["player_side"],
        direct_count: r["direct_count"] ?? r["direct"] ?? 0,
        reconstructed_count: r["reconstructed_count"] ?? r["reconstructed"] ?? 0,
        partial_count: r["partial_count"] ?? r["partial"] ?? 0,
        unavailable_count: r["unavailable_count"] ?? r["unavailable"] ?? 0,
        excluded_count: r["excluded_count"] ?? r["excluded"] ?? 0,
        total_count: r["total_count"] ?? r["total"] ?? 0,
        usable_coverage_percent: r["usable_coverage_percent"] ?? r["usablePercent"] ?? 0,
        execution_completion_percent: r["execution_completion_percent"] ?? r["executionPercent"] ?? 0,
        recorded_at: r["recorded_at"] ?? new Date().toISOString(), user_id,
      }));
      if (!mapped.length) return;
      await dbCall("write", "audit_coverage", () => db.insert(auditCoverageTable).values(rows(mapped))
        .onConflictDoUpdate({
          target: [auditCoverageTable.audit_run_id, auditCoverageTable.player_side],
          set: excludedSet(auditCoverageTable, mapped, ["audit_run_id", "player_side"]),
        }));
    },
    async saveCoverageRates(runId, newRows) {
      let sourceRows = newRows.filter((r) => typeof r["metric_code"] === "string" && String(r["metric_code"]).trim() !== "");
      if (!sourceRows.length) {
        const metrics = await dbCall("read", "metric_results coverage", () => db.select({
          metric_code: metricResultsTable.metric_code, metric_name: metricResultsTable.metric_name,
          p1_treatment: metricResultsTable.p1_treatment, p2_treatment: metricResultsTable.p2_treatment,
        }).from(metricResultsTable).where(eq(metricResultsTable.audit_run_id, runId)));
        const usable = (t: unknown) => ["DIRECT", "RECONSTRUCTED", "PARTIAL"].includes(String(t ?? ""));
        sourceRows = metrics.flatMap((metric) => {
          const code = String(metric.metric_code ?? "").trim();
          if (!code) return [];
          return [
            { metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P1", treatment: metric.p1_treatment ?? "UNAVAILABLE", usable: usable(metric.p1_treatment) },
            { metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P2", treatment: metric.p2_treatment ?? "UNAVAILABLE", usable: usable(metric.p2_treatment) },
          ];
        });
      }
      if (!sourceRows.length) return;
      const registryRows = [...new Map(sourceRows.map((r) => [String(r["metric_code"]), {
        metric_code: String(r["metric_code"]), metric_name: String(r["metric_name"] ?? r["metric_code"]),
        lifecycle_status: "ACTIVE", tour_eligibility: [] as string[],
      }])).values()];
      await dbCall("write", "metric_registry", () => db.insert(metricRegistryTable).values(rows(registryRows))
        .onConflictDoUpdate({
          target: [metricRegistryTable.metric_code],
          set: excludedSet(metricRegistryTable, registryRows, ["metric_code"]),
        }));
      const now = new Date().toISOString();
      const coverageRows = sourceRows.map((r) => ({
        metric_code: String(r["metric_code"]), player_side: r["player_side"],
        treatment: r["treatment"] ?? "UNAVAILABLE", usable: Boolean(r["usable"]),
        recorded_at: r["recorded_at"] ?? now, audit_run_id: runId, user_id,
      }));
      await dbCall("write", "metric_coverage_rates", () => db.insert(metricCoverageRatesTable).values(rows(coverageRows))
        .onConflictDoUpdate({
          target: [metricCoverageRatesTable.metric_code, metricCoverageRatesTable.player_side, metricCoverageRatesTable.audit_run_id],
          set: excludedSet(metricCoverageRatesTable, coverageRows, ["metric_code", "player_side", "audit_run_id"]),
        }));
    },

    async verifyFinalPersistence(runId, expectedMetricSides, expectedAuditComplete) {
      const [coverage, rates, decisions] = await Promise.all([
        dbCall("read", "audit_coverage", () => db.select({
          player_side: auditCoverageTable.player_side, total_count: auditCoverageTable.total_count,
          usable_coverage_percent: auditCoverageTable.usable_coverage_percent,
        }).from(auditCoverageTable).where(eq(auditCoverageTable.audit_run_id, runId))).catch(failInvariant("audit_coverage")),
        dbCall("read", "metric_coverage_rates", () => db.select({
          metric_code: metricCoverageRatesTable.metric_code, player_side: metricCoverageRatesTable.player_side,
          treatment: metricCoverageRatesTable.treatment, usable: metricCoverageRatesTable.usable,
        }).from(metricCoverageRatesTable).where(eq(metricCoverageRatesTable.audit_run_id, runId))).catch(failInvariant("metric_coverage_rates")),
        dbCall("read", "final_decisions", () => db.select({
          id: finalDecisionsTable.id, audit_complete: finalDecisionsTable.audit_complete,
          completion_percent: finalDecisionsTable.completion_percent,
        }).from(finalDecisionsTable).where(eq(finalDecisionsTable.audit_run_id, runId)).limit(1)).catch(failInvariant("final_decisions")),
      ]);
      const decision = decisions[0];
      if (!decision) throw new Error("Final persistence invariant failed (final_decisions): missing row");
      if (coverage.length !== 2) throw new Error(`Final persistence invariant failed: expected 2 audit coverage rows, found ${coverage.length}.`);
      if (rates.length !== expectedMetricSides) throw new Error(`Final persistence invariant failed: expected ${expectedMetricSides} metric coverage rows, found ${rates.length}.`);
      if (Boolean(decision.audit_complete) !== expectedAuditComplete) throw new Error("Final persistence invariant failed: decision completion flag does not match the deterministic gate.");
    },

    async log(entry) {
      await db.insert(executionLogsTable).values(row({
        user_id,
        audit_run_id: (entry["audit_run_id"] as string) ?? null,
        match_id: (entry["match_id"] as string) ?? null,
        stage: String(entry["stage"]), status: String(entry["status"]),
        output: entry["output"] ?? null, matrix_visible: Boolean(entry["matrix_visible"]),
      }));
    },
  };
}

/** A read failure inside verifyFinalPersistence is an invariant failure, not a plain read error. */
function failInvariant(table: string): (error: unknown) => never {
  return (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Final persistence invariant failed (${table}): ${message}`);
  };
}
