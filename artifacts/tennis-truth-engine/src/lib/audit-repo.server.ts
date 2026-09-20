/**
 * API-backed audit pipeline dependencies.
 *
 * The pipeline remains pure orchestration. Every persistence operation is a
 * named server operation; the API server owns PostgreSQL transactions,
 * workspace scoping, and lease ownership.
 */
import { LOCAL_WORKSPACE_ID } from "./constants";
import { warehouseFirstResearcher } from "./warehouse-first-researcher.server";
import { STAGES, type ChildTable, type PipelineDeps, type RunRow, type Stage } from "./audit-pipeline";
import { truthServerOperation } from "./truth-server-api";

const OWNER = LOCAL_WORKSPACE_ID;
const op = <T>(operation: string, input: Record<string, unknown> = {}) =>
  truthServerOperation<T>(operation, { ownerId: OWNER, ...input });

export async function makeDeps(): Promise<PipelineDeps> {
  return {
    now: () => new Date(),
    research: warehouseFirstResearcher,
    async getMatch(matchId) {
      const result = await op<{ match: unknown | null }>("audit-get-match", { matchId });
      return result.match as never;
    },
    async updateMatch(matchId, patch) {
      await op("audit-update-match", { matchId, patch });
    },
    async getParsedFields(matchId) {
      const result = await op<{ fields: Record<string, string> }>("audit-parsed-fields", { matchId });
      return result.fields;
    },
    async getActiveVersionId(docType) {
      const result = await op<{ activeVersionId: string | null }>("audit-active-version", { docType });
      return result.activeVersionId;
    },
    async getRules(versionId) {
      const result = await op<{ rules: unknown[] }>("audit-rules", { versionId });
      return result.rules as never;
    },
    async getLatestRun(matchId) {
      const result = await op<{ run: RunRow | null }>("audit-latest-run", { matchId });
      return result.run;
    },
    async createRun(row) {
      const result = await op<{ run: RunRow }>("audit-create-run", { row });
      return result.run;
    },
    async updateRun(runId, patch) {
      await op("audit-update-run", { runId, patch });
    },
    async acquireRunLease(runId, owner, leaseMs) {
      const result = await op<{ acquired: boolean }>("audit-claim-lease", { runId, leaseOwner: owner, leaseMs });
      return result.acquired;
    },
    async renewRunLease(runId, owner, leaseMs) {
      const result = await op<{ renewed: boolean }>("audit-renew-lease", { runId, leaseOwner: owner, leaseMs });
      return result.renewed;
    },
    async releaseRunLease(runId, owner) {
      await op("audit-release-lease", { runId, leaseOwner: owner });
    },
    async list(table: ChildTable, runId) {
      const result = await op<{ rows: unknown[] }>("audit-list-results", { table, runId });
      return result.rows as Array<Record<string, unknown>>;
    },
    async insert(table, rows) {
      await op("audit-insert-results", { table, rows });
    },
    async update(table, id, patch) {
      await op("audit-update-result", { table, id, patch });
    },
    async getStages(runId) {
      const result = await op<{ stages: unknown[] }>("audit-stages", { runId });
      return result.stages as never;
    },
    async setStage(runId, matchId, stage: Stage, patch) {
      await op("audit-set-stage", {
        runId,
        matchId,
        stage,
        stageOrder: STAGES.indexOf(stage),
        patch,
      });
    },
    async saveIdentityRecords(matchId, rows) {
      await op("audit-save-identity", { matchId, rows });
    },
    async saveSnapshots(runId, rows) {
      await op("audit-save-snapshots", { runId, rows });
    },
    async saveConflicts(runId, rows) {
      await op("audit-save-conflicts", { runId, rows });
    },
    async getCalibration(versionId) {
      return op("audit-calibration", { versionId });
    },
    async getDecisionId(runId) {
      const result = await op<{ id: string | null }>("audit-decision-id", { runId });
      return result.id;
    },
    async saveDecision(runId, existingId, payload) {
      await op("audit-save-decision", { runId, existingId, payload });
    },
    async getConflicts(runId) {
      const result = await op<{ rows: Array<{ critical: boolean; resolution_status: string }> }>("audit-conflicts", { runId });
      return result.rows;
    },
    async getReconstructions(runId) {
      const result = await op<{ rows: Array<{ status: string; player_side?: string; metric_code?: string }> }>("audit-reconstructions", { runId });
      return result.rows;
    },
    async saveCoverage(runId, rows) {
      await op("audit-save-coverage", { runId, rows });
    },
    async saveCoverageRates(runId, rows) {
      await op("audit-save-coverage-rates", { runId, rows });
    },
    async verifyFinalPersistence(runId, expectedMetricSides, expectedAuditComplete) {
      await op("audit-verify-final-persistence", { runId, expectedMetricSides, expectedAuditComplete });
    },
    async log(entry) {
      await op("audit-log", { entry });
    },
  };
}