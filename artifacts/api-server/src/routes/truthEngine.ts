import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  clearOperationalSlate,
  db,
  getActiveRuleVersion,
  getActiveSummaryFields,
  getAuditRunById,
  getAuditStages,
  getCalibration,
  getLatestAuditRun,
  getMatch,
  listResultGraph,
  listCalibrationObservations,
  listEvidence,
  listGrades,
  listEnabledTargets,
  listSnapshots,
  listConflicts,
  listMetricResults,
  listMetricCoverage,
  listRules,
  matchesTable,
  parsedSummaryFieldsTable,
  resultGradesTable,
  summaryUploadsTable,
  summaryVersionsTable,
  ruleDocumentsTable,
  ruleDocumentVersionsTable,
  rulesTable,
  claimAuditRun,
  renewAuditRunLease,
  releaseAuditRunLease,
  upsertMetricEvidenceSide,
} from "@workspace/db";
import { requireClerkUser } from "../middlewares/requireClerkUser";
import { requireAdmin } from "../lib/adminAuth";
import { executeDeterministicOperation } from "../services/truthDeterministicOperations";
import { executeAuditCreateRun, executeAuditRepositoryOperation } from "../services/truthAuditOperations";
import {
  confirmSourceObservations,
  finishIngestionRun,
  getEnabledIngestionTargets,
  startIngestionRun,
  touchIngestionTarget,
  upsertSourceObservations,
} from "../services/truthIngestionOperations";
import {
  gradeTruthCalibration,
  insertTruthExecutionLog,
  listTruthResultCaptureMatches,
  listTruthResultCaptureState,
  loadTruthObservationRows,
  listTruthMetricEvidence,
  saveTruthResultGrade,
  updateTruthMatchResult,
} from "../services/truthFinalizationOperations";

const router: IRouter = Router();
// The db package may be consumed from its prebuilt declaration during API
// typechecking; keep the owner-scoped fifth argument explicit until packages
// are rebuilt together.
const claimAuditRunScoped = claimAuditRun as unknown as (...args: any[]) => Promise<boolean>;
const renewAuditRunLeaseScoped = renewAuditRunLease as unknown as (...args: any[]) => Promise<boolean>;
const releaseAuditRunLeaseScoped = releaseAuditRunLease as unknown as (...args: any[]) => Promise<boolean>;

// Truth Engine rows are workspace-scoped UUIDs, while Clerk supplies the
// authenticated actor identity. This keeps the existing authoritative
// heliumdb population intact and prevents arbitrary actor IDs being cast to UUID.
const WORKSPACE_ID = process.env.TRUTH_ENGINE_WORKSPACE_ID
  ?? "00000000-0000-0000-0000-000000000001";

/**
 * Server workers use a separate service credential. It is intentionally
 * checked before Clerk middleware below: workers do not have a browser
 * session cookie, while every operation remains explicitly allow-listed.
 */
function requireTruthWorker(req: Request, res: Response, next: () => void): void {
  const configured = process.env.ADMIN_ACCESS_KEY;
  const authorization = req.headers.authorization;
  if (!configured || authorization !== `Bearer ${configured}`) {
    res.status(401).json({ error: "Unauthorized Truth worker" });
    return;
  }
  next();
}

export function idParam(value: string | string[] | undefined): string | null {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)
    ? id
    : null;
}

router.post("/truth-engine/internal/:operation", requireTruthWorker, async (req, res): Promise<void> => {
  const operation = String(req.params.operation);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const ownerId = WORKSPACE_ID;
  const uuid = (value: unknown) => typeof value === "string" && idParam(value) ? value : null;
  try {
    if (operation === "result-capture-matches") {
      res.json({ matches: await listTruthResultCaptureMatches(ownerId) });
      return;
    }
    if (operation === "result-capture-state") {
      res.json(await listTruthResultCaptureState(ownerId));
      return;
    }
    if (operation === "result-capture-update-match") {
      const matchId = uuid(body.matchId);
      if (!matchId || !body.patch || typeof body.patch !== "object") {
        res.status(400).json({ error: "Invalid result match update" });
        return;
      }
      await updateTruthMatchResult(ownerId, matchId, body.patch as Record<string, unknown>);
      res.json({ ok: true });
      return;
    }
    if (operation === "result-capture-save-grade") {
      const existingId = body.existingId == null ? null : uuid(body.existingId);
      await saveTruthResultGrade(ownerId, existingId, body.row as Record<string, unknown>);
      res.json({ ok: true });
      return;
    }
    if (operation === "result-capture-log") {
      await insertTruthExecutionLog(ownerId, body.entry as Record<string, unknown>);
      res.json({ ok: true });
      return;
    }
    if (operation === "calibration-grade") {
      res.json({ version: await gradeTruthCalibration(ownerId, body.input as Record<string, unknown>) });
      return;
    }
    if (operation === "observation-context-rows") {
      const aliases = Array.isArray(body.aliases) ? body.aliases.filter((value): value is string => typeof value === "string") : [];
      const asOfDate = typeof body.asOfDate === "string" ? body.asOfDate : "";
      const startDate = typeof body.startDate === "string" ? body.startDate : "";
      if (!asOfDate || !startDate) {
        res.status(400).json({ error: "Invalid observation context dates" });
        return;
      }
      res.json({ rows: await loadTruthObservationRows(ownerId, aliases, asOfDate, startDate) });
      return;
    }
    if (operation === "metric-evidence-rows") {
      const metricCodes = Array.isArray(body.metricCodes)
        ? body.metricCodes.filter((value): value is string => typeof value === "string")
        : [];
      const asOfDate = typeof body.asOfDate === "string" ? body.asOfDate : "";
      if (!asOfDate) { res.status(400).json({ error: "Invalid evidence date" }); return; }
      res.json({ rows: await listTruthMetricEvidence(ownerId, metricCodes, asOfDate) });
      return;
    }
    if (operation === "audit-running-runs") {
      const rows = await db.execute(sql`select match_id from audit_runs where user_id = ${ownerId}::uuid and status = 'RUNNING' order by created_at asc limit ${Number(body.limit ?? 100)}`);
      res.json({ runs: rows.rows });
      return;
    }
    if (operation === "audit-active-version") {
      const rows = await db.execute(sql`select active_version_id from rule_documents where user_id = ${ownerId}::uuid and doc_type = ${String(body.docType ?? "")} limit 1`);
      res.json({ activeVersionId: (rows.rows[0] as { active_version_id?: string | null } | undefined)?.active_version_id ?? null });
      return;
    }
    if (operation === "audit-rules") {
      const versionId = uuid(body.versionId);
      if (!versionId) { res.status(400).json({ error: "Invalid versionId" }); return; }
      const rows = await db.execute(sql`select id, rule_code, rule_name, body, severity, blocking from rules where user_id = ${ownerId}::uuid and version_id = ${versionId}::uuid order by rule_code`);
      res.json({ rules: rows.rows });
      return;
    }
    if (operation === "audit-latest-run") {
      const matchId = uuid(body.matchId);
      if (!matchId) { res.status(400).json({ error: "Invalid matchId" }); return; }
      const rows = await db.execute(sql`select * from audit_runs where user_id = ${ownerId}::uuid and match_id = ${matchId}::uuid order by run_number desc limit 1`);
      res.json({ run: rows.rows[0] ?? null });
      return;
    }
    if (operation === "audit-claim-lease" || operation === "audit-renew-lease" || operation === "audit-release-lease") {
      const runId = uuid(body.runId);
      const leaseOwner = typeof body.leaseOwner === "string" ? body.leaseOwner : "";
      if (!runId || !leaseOwner) { res.status(400).json({ error: "Invalid lease request" }); return; }
      const leaseMs = Number(body.leaseMs ?? 60_000);
      const changed = operation === "audit-claim-lease"
        ? await claimAuditRunScoped(db, runId, leaseOwner, leaseMs, ownerId)
        : operation === "audit-renew-lease"
          ? await renewAuditRunLeaseScoped(db, runId, leaseOwner, leaseMs, ownerId)
          : await releaseAuditRunLeaseScoped(db, runId, leaseOwner, ownerId);
      res.json(operation === "audit-claim-lease" ? { acquired: changed } : operation === "audit-renew-lease" ? { renewed: changed } : { released: changed });
      return;
    }
    if (operation === "audit-create-run") {
      res.json(await executeAuditCreateRun(body, ownerId));
      return;
    }
    if ([
      "audit-get-match", "audit-update-match", "audit-parsed-fields", "audit-update-run",
      "audit-list-results", "audit-insert-results", "audit-update-result", "audit-stages",
      "audit-set-stage", "audit-save-identity", "audit-save-snapshots", "audit-save-conflicts",
      "audit-calibration", "audit-decision-id", "audit-save-decision", "audit-conflicts",
      "audit-reconstructions", "audit-save-coverage", "audit-save-coverage-rates",
      "audit-verify-final-persistence", "audit-log",
    ].includes(operation)) {
      res.json(await executeAuditRepositoryOperation(operation, body, ownerId));
      return;
    }
    if (operation === "match-context") {
      const rows = await db.select({
        player1_name: matchesTable.player1Name,
        player2_name: matchesTable.player2Name,
        tournament_name: matchesTable.tournamentName,
        event_level: matchesTable.eventLevel,
        round: matchesTable.round,
        scheduled_date: matchesTable.scheduledDate,
        surface: matchesTable.surface,
        best_of: matchesTable.bestOf,
        updated_at: matchesTable.updatedAt,
      }).from(matchesTable)
        .where(eq(matchesTable.userId, ownerId))
        .orderBy(desc(matchesTable.updatedAt))
        .limit(1000);
      res.json({ rows });
      return;
    }
    if (operation.startsWith("deterministic-")) {
      const result = await executeDeterministicOperation(operation, body, ownerId);
      res.json(result);
      return;
    }
    if (operation === "evidence-upsert") {
      const payload = body.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        res.status(400).json({ error: "evidence-upsert requires payload object" });
        return;
      }
      const row = await upsertMetricEvidenceSide(payload as Parameters<typeof upsertMetricEvidenceSide>[0]);
      res.json({ data: row, error: null });
      return;
    }
    if (operation === "ingestion-targets") {
      const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
      if (!sourceId) { res.status(400).json({ error: "sourceId is required" }); return; }
      res.json({ targets: await getEnabledIngestionTargets(sourceId) });
      return;
    }
    if (operation === "ingestion-start-run") {
      const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
      const jobType = typeof body.jobType === "string" ? body.jobType : "";
      if (!sourceId || !jobType) { res.status(400).json({ error: "sourceId and jobType are required" }); return; }
      res.json({ run: await startIngestionRun(sourceId, jobType) });
      return;
    }
    if (operation === "ingestion-finish-run" || operation === "ingestion-fail-run") {
      const runId = uuid(body.runId);
      if (!runId) { res.status(400).json({ error: "runId must be a UUID" }); return; }
      const status = operation === "ingestion-finish-run" ? "COMPLETE" : "FAILED";
      res.json({ run: await finishIngestionRun(runId, status, {
        recordsSeen: typeof body.recordsSeen === "number" ? body.recordsSeen : undefined,
        recordsInserted: typeof body.recordsInserted === "number" ? body.recordsInserted : undefined,
        errorMessage: typeof body.errorMessage === "string" ? body.errorMessage : undefined,
        metadata: body.metadata,
      }) });
      return;
    }
    if (operation === "ingestion-upsert-observations") {
      if (!Array.isArray(body.rows)) { res.status(400).json({ error: "rows must be an array" }); return; }
      res.json({ rows: await upsertSourceObservations(
        body.rows as Parameters<typeof upsertSourceObservations>[0],
        body.ignoreDuplicates === true,
      ) });
      return;
    }
    if (operation === "ingestion-confirm-observations") {
      const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
      const keys = Array.isArray(body.keys) ? body.keys.filter((key): key is string => typeof key === "string") : [];
      if (!sourceId) { res.status(400).json({ error: "sourceId is required" }); return; }
      res.json({ rows: await confirmSourceObservations(sourceId, keys) });
      return;
    }
    if (operation === "ingestion-touch-target") {
      const targetId = uuid(body.targetId);
      if (!targetId) { res.status(400).json({ error: "targetId must be a UUID" }); return; }
      res.json({ target: await touchIngestionTarget(targetId) });
      return;
    }
    res.status(404).json({ error: `Unknown Truth worker operation: ${operation}` });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.use(requireClerkUser);

// Read models for the existing Truth Engine application screens. These are
// named, user-scoped projections rather than an arbitrary table/query API; the
// stable snake_case payloads also keep the legacy screen data shapes intact.
router.get("/truth-engine/app/slate", async (_req, res): Promise<void> => {
  const [matches, runs, versions, decisions, stages, coverage] = await Promise.all([
    db.execute(sql`select * from matches where user_id = ${WORKSPACE_ID}::uuid order by created_at desc`),
    db.execute(sql`select id, match_id, status, run_number, heartbeat_at, lease_expires_at from audit_runs where user_id = ${WORKSPACE_ID}::uuid order by created_at desc`),
    db.execute(sql`select match_id, upload_id, created_at, is_active from summary_versions where user_id = ${WORKSPACE_ID}::uuid order by version_number desc`),
    db.execute(sql`select audit_run_id, final_audit_color, completion_percent, audit_complete from final_decisions where user_id = ${WORKSPACE_ID}::uuid`),
    db.execute(sql`select audit_run_id, stage, stage_order, status, done_count, total_count, started_at, finished_at, heartbeat_at from audit_stage_runs where user_id = ${WORKSPACE_ID}::uuid`),
    db.execute(sql`select audit_run_id, player_side, usable_coverage_percent, total_count from audit_coverage where user_id = ${WORKSPACE_ID}::uuid`),
  ]);
  res.json({ matches: matches.rows, runs: runs.rows, versions: versions.rows, decisions: decisions.rows, stages: stages.rows, coverage: coverage.rows });
});

router.get("/truth-engine/app/board", async (_req, res): Promise<void> => {
  const [decisions, runs, matches, fields, versions] = await Promise.all([
    db.execute(sql`select * from final_decisions where user_id = ${WORKSPACE_ID}::uuid`),
    db.execute(sql`select * from audit_runs where user_id = ${WORKSPACE_ID}::uuid order by created_at desc`),
    db.execute(sql`select * from matches where user_id = ${WORKSPACE_ID}::uuid order by created_at desc`),
    db.execute(sql`select summary_version_id, field_key, normalized_value from parsed_summary_fields where user_id = ${WORKSPACE_ID}::uuid`),
    db.execute(sql`select id, match_id, is_active from summary_versions where user_id = ${WORKSPACE_ID}::uuid`),
  ]);
  res.json({ decisions: decisions.rows, runs: runs.rows, matches: matches.rows, fields: fields.rows, versions: versions.rows });
});

router.get("/truth-engine/app/dashboard", async (_req, res): Promise<void> => {
  const [matches, runs, versions, decisions, stages, coverage, uploads, calibration] = await Promise.all([
    db.execute(sql`select * from matches where user_id = ${WORKSPACE_ID}::uuid order by created_at desc`),
    db.execute(sql`select id, match_id, status, run_number, heartbeat_at, lease_expires_at from audit_runs where user_id = ${WORKSPACE_ID}::uuid order by created_at desc`),
    db.execute(sql`select match_id, upload_id, created_at, is_active from summary_versions where user_id = ${WORKSPACE_ID}::uuid order by version_number desc`),
    db.execute(sql`select audit_run_id, final_audit_color, completion_percent, audit_complete from final_decisions where user_id = ${WORKSPACE_ID}::uuid`),
    db.execute(sql`select audit_run_id, stage, stage_order, status, done_count, total_count, started_at, finished_at, heartbeat_at from audit_stage_runs where user_id = ${WORKSPACE_ID}::uuid`),
    db.execute(sql`select audit_run_id, player_side, usable_coverage_percent, total_count from audit_coverage where user_id = ${WORKSPACE_ID}::uuid`),
    db.execute(sql`select id from summary_uploads where user_id = ${WORKSPACE_ID}::uuid`),
    db.execute(sql`select * from calibration_versions where user_id = ${WORKSPACE_ID}::uuid and is_active = true order by version_number desc limit 1`),
  ]);
  const version = calibration.rows[0] as { id?: string } | undefined;
  const buckets = version?.id
    ? await db.execute(sql`select * from calibration_buckets where user_id = ${WORKSPACE_ID}::uuid and calibration_version_id = ${version.id} order by wp_min`)
    : { rows: [] };
  res.json({ matches: matches.rows, runs: runs.rows, versions: versions.rows, decisions: decisions.rows, stages: stages.rows, coverage: coverage.rows, uploads: uploads.rows, version: version ?? null, buckets: buckets.rows });
});

router.get("/truth-engine/app/logs", async (_req, res): Promise<void> => {
  const [logs, runs, versions] = await Promise.all([
    db.execute(sql`select * from execution_logs where user_id = ${WORKSPACE_ID}::uuid order by created_at desc limit 300`),
    db.execute(sql`select id, match_id, run_number, status from audit_runs where user_id = ${WORKSPACE_ID}::uuid`),
    db.execute(sql`select match_id, is_active from summary_versions where user_id = ${WORKSPACE_ID}::uuid`),
  ]);
  res.json({ logs: logs.rows, runs: runs.rows, versions: versions.rows });
});

router.get("/truth-engine/app/sources", async (_req, res): Promise<void> => {
  const [snapshots, conflicts] = await Promise.all([
    db.execute(sql`select * from source_snapshots where user_id = ${WORKSPACE_ID}::uuid order by retrieved_at desc limit 200`),
    db.execute(sql`select * from source_conflicts where user_id = ${WORKSPACE_ID}::uuid order by created_at desc limit 200`),
  ]);
  res.json({ snapshots: snapshots.rows, conflicts: conflicts.rows });
});

router.get("/truth-engine/app/rules", async (_req, res): Promise<void> => {
  const [documents, versions, rules] = await Promise.all([
    db.execute(sql`select * from rule_documents where user_id = ${WORKSPACE_ID}::uuid order by doc_type`),
    db.execute(sql`select * from rule_document_versions where user_id = ${WORKSPACE_ID}::uuid order by version_number`),
    db.execute(sql`select * from rules where user_id = ${WORKSPACE_ID}::uuid order by rule_code`),
  ]);
  res.json({ documents: documents.rows, versions: versions.rows, rules: rules.rows });
});

router.get("/truth-engine/app/calibration", async (_req, res): Promise<void> => {
  const [versions, buckets, ledger] = await Promise.all([
    db.execute(sql`select * from calibration_versions where user_id = ${WORKSPACE_ID}::uuid and is_active = true order by version_number desc limit 1`),
    db.execute(sql`select * from calibration_buckets where user_id = ${WORKSPACE_ID}::uuid order by wp_min`),
    db.execute(sql`select * from calibration_ledger where user_id = ${WORKSPACE_ID}::uuid order by master_sequence desc limit 100`),
  ]);
  res.json({ version: versions.rows[0] ?? null, buckets: buckets.rows, ledger: ledger.rows });
});

router.get("/truth-engine/app/calibration-history", async (_req, res): Promise<void> => {
  const versions = await db.execute(sql`select * from calibration_versions where user_id = ${WORKSPACE_ID}::uuid order by version_number desc`);
  const buckets = await db.execute(sql`select * from calibration_buckets where user_id = ${WORKSPACE_ID}::uuid order by wp_min`);
  res.json({ versions: versions.rows, buckets: buckets.rows });
});

router.get("/truth-engine/app/matches/:matchId/view", async (req, res): Promise<void> => {
  const matchId = idParam(req.params.matchId);
  if (!matchId) { res.status(400).json({ error: "matchId must be a UUID" }); return; }
  const [matchResult, runs, versions] = await Promise.all([
    db.execute(sql`select * from matches where id = ${matchId}::uuid and user_id = ${WORKSPACE_ID}::uuid limit 1`),
    db.execute(sql`select * from audit_runs where match_id = ${matchId}::uuid and user_id = ${WORKSPACE_ID}::uuid order by run_number desc`),
    db.execute(sql`select id from summary_versions where match_id = ${matchId}::uuid and user_id = ${WORKSPACE_ID}::uuid and is_active = true limit 1`),
  ]);
  const match = matchResult.rows[0];
  if (!match) { res.status(404).json({ error: "Truth match not found" }); return; }
  const run = runs.rows[0] as { id?: string; calibration_version_id?: string } | undefined;
  if (!run?.id) { res.json({ match, runs: runs.rows, run: null, wasInvalidated: runs.rows.length > 0 }); return; }
  const runId = run.id;
  const [metrics, verification, disagreement, underdog, stress, conflicts, reconstructions, decision, coverage, coverageRates, buckets, version, fields, stages] = await Promise.all([
    db.execute(sql`select * from metric_results where audit_run_id = ${runId}::uuid order by metric_code`),
    db.execute(sql`select * from verification_results where audit_run_id = ${runId}::uuid order by rule_code`),
    db.execute(sql`select * from disagreement_results where audit_run_id = ${runId}::uuid order by pathway_code`),
    db.execute(sql`select * from underdog_results where audit_run_id = ${runId}::uuid order by pathway_code`),
    db.execute(sql`select * from stress_results where audit_run_id = ${runId}::uuid order by test_code`),
    db.execute(sql`select * from source_conflicts where audit_run_id = ${runId}::uuid`),
    db.execute(sql`select * from reconstruction_results where audit_run_id = ${runId}::uuid`),
    db.execute(sql`select * from final_decisions where audit_run_id = ${runId}::uuid limit 1`),
    db.execute(sql`select * from audit_coverage where audit_run_id = ${runId}::uuid order by player_side`),
    db.execute(sql`select * from metric_coverage_rates where audit_run_id = ${runId}::uuid`),
    db.execute(sql`select * from calibration_buckets where user_id = ${WORKSPACE_ID}::uuid order by wp_min`),
    run.calibration_version_id
      ? db.execute(sql`select * from calibration_versions where id = ${run.calibration_version_id}::uuid limit 1`)
      : Promise.resolve({ rows: [] }),
    versions.rows[0] ? db.execute(sql`select * from parsed_summary_fields where summary_version_id = ${versions.rows[0].id}::uuid`) : Promise.resolve({ rows: [] }),
    db.execute(sql`select * from audit_stage_runs where audit_run_id = ${runId}::uuid order by stage_order`),
  ]);
  res.json({ match, runs: runs.rows, run, wasInvalidated: false, metrics: metrics.rows, verification: verification.rows, disagreement: disagreement.rows, underdog: underdog.rows, stress: stress.rows, conflicts: conflicts.rows, reconstructions: reconstructions.rows, decision: decision.rows[0] ?? null, coverage: coverage.rows, coverageRates: coverageRates.rows, buckets: buckets.rows, version: version.rows[0] ?? null, fields: fields.rows, stages: stages.rows });
});

router.patch("/truth-engine/sources/conflicts/:conflictId", requireAdmin, async (req, res): Promise<void> => {
  const conflictId = idParam(req.params.conflictId);
  const status = typeof req.body?.resolutionStatus === "string" ? req.body.resolutionStatus : null;
  if (!conflictId || !status) { res.status(400).json({ error: "conflictId and resolutionStatus are required" }); return; }
  const result = await db.execute(sql`
    update source_conflicts set resolution_status = ${status}
    where id = ${conflictId}::uuid and user_id = ${WORKSPACE_ID}::uuid
    returning *
  `);
  if (!result.rows[0]) { res.status(404).json({ error: "Source conflict not found" }); return; }
  res.json(result.rows[0]);
});

router.patch("/truth-engine/audits/:runId/results/:resultType/:resultId", requireAdmin, async (req, res): Promise<void> => {
  const runId = idParam(req.params.runId);
  const resultId = idParam(req.params.resultId);
  const tableByType: Record<string, string> = {
    metrics: "metric_results",
    verification: "verification_results",
    disagreement: "disagreement_results",
    underdog: "underdog_results",
    stress: "stress_results",
  };
  const table = tableByType[String(req.params.resultType)];
  if (!runId || !resultId || !table || !req.body || typeof req.body !== "object") {
    res.status(400).json({ error: "Valid run/result identifiers and result fields are required" }); return;
  }
  const run = await getAuditRunById(db, WORKSPACE_ID, runId);
  if (!run) { res.status(404).json({ error: "Audit run not found" }); return; }
  if (run.status === "RUNNING" || run.status === "COMPLETE") {
    res.status(409).json({ error: "Persisted audit evidence cannot be edited in this state" }); return;
  }
  const allowed = Object.entries(req.body as Record<string, unknown>).filter(([key]) => /^[a-z][a-z0-9_]*$/u.test(key));
  if (!allowed.length) { res.status(400).json({ error: "No editable result fields supplied" }); return; }
  const assignments = sql.join(allowed.map(([key, value]) => sql`${sql.raw(key)} = ${value}`), sql`, `);
  const result = await db.execute(sql`update ${sql.raw(table)} set ${assignments} where id = ${resultId}::uuid and audit_run_id = ${runId}::uuid and user_id = ${WORKSPACE_ID}::uuid returning *`);
  if (!result.rows[0]) { res.status(404).json({ error: "Result not found" }); return; }
  res.json(result.rows[0]);
});

router.patch("/truth-engine/matches/:matchId", requireAdmin, async (req, res): Promise<void> => {
  const matchId = idParam(req.params.matchId);
  if (!matchId || !req.body || typeof req.body !== "object") { res.status(400).json({ error: "Valid matchId and fields are required" }); return; }
  const allowedKeys = new Set(["player1_name", "player2_name", "tournament_name", "event_level", "round", "scheduled_date", "surface", "best_of"]);
  const entries = Object.entries(req.body as Record<string, unknown>).filter(([key]) => allowedKeys.has(key));
  if (!entries.length) { res.status(400).json({ error: "No editable match fields supplied" }); return; }
  const assignments = sql.join(entries.map(([key, value]) => sql`${sql.raw(key)} = ${value}`), sql`, `);
  const result = await db.execute(sql`update matches set ${assignments} where id = ${matchId}::uuid and user_id = ${WORKSPACE_ID}::uuid returning *`);
  if (!result.rows[0]) { res.status(404).json({ error: "Truth match not found" }); return; }
  res.json(result.rows[0]);
});


router.post("/truth-engine/uploads", requireAdmin, async (req, res): Promise<void> => {
  const body = req.body as {
    filename?: unknown;
    pageCount?: unknown;
    rawText?: unknown;
    match?: Record<string, unknown>;
    fields?: Array<Record<string, unknown>>;
  };
  const match = body.match;
  if (typeof body.filename !== "string" || typeof body.rawText !== "string"
    || !match || typeof match.canonicalKey !== "string"
    || typeof match.player1Name !== "string" || typeof match.player2Name !== "string") {
    res.status(400).json({ error: "filename, rawText, and canonical match identity are required" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const existing = await tx.select().from(matchesTable).where(and(
      eq(matchesTable.userId, WORKSPACE_ID),
      eq(matchesTable.canonicalKey, match.canonicalKey as string),
    )).limit(1);
    const matchRow = existing[0] ?? (await tx.insert(matchesTable).values({
      userId: WORKSPACE_ID,
      canonicalKey: match.canonicalKey as string,
      player1Name: match.player1Name as string,
      player2Name: match.player2Name as string,
      tournamentName: typeof match.tournamentName === "string" ? match.tournamentName : null,
      eventLevel: typeof match.eventLevel === "string" ? match.eventLevel : null,
      round: typeof match.round === "string" ? match.round : null,
      scheduledDate: typeof match.scheduledDate === "string" ? match.scheduledDate : null,
      surface: typeof match.surface === "string" ? match.surface : null,
      bestOf: typeof match.bestOf === "number" ? match.bestOf : null,
    }).returning())[0];
    const upload = (await tx.insert(summaryUploadsTable).values({
      userId: WORKSPACE_ID,
      filename: body.filename as string,
      pageCount: typeof body.pageCount === "number" ? body.pageCount : null,
      parseStatus: "COMPLETE",
      rawText: body.rawText as string,
    }).returning())[0]!;
    const previous = await tx.select({ versionNumber: summaryVersionsTable.versionNumber })
      .from(summaryVersionsTable)
      .where(and(eq(summaryVersionsTable.userId, WORKSPACE_ID), eq(summaryVersionsTable.matchId, matchRow.id)))
      .orderBy(desc(summaryVersionsTable.versionNumber)).limit(1);
    await tx.update(summaryVersionsTable).set({ isActive: false })
      .where(and(eq(summaryVersionsTable.userId, WORKSPACE_ID), eq(summaryVersionsTable.matchId, matchRow.id)));
    const version = (await tx.insert(summaryVersionsTable).values({
      userId: WORKSPACE_ID,
      matchId: matchRow.id,
      uploadId: upload.id,
      versionNumber: (previous[0]?.versionNumber ?? 0) + 1,
      isActive: true,
    }).returning())[0]!;
    const fields = Array.isArray(body.fields) ? body.fields : [];
    if (fields.length) {
      await tx.insert(parsedSummaryFieldsTable).values(fields.map((field) => ({
        userId: WORKSPACE_ID,
        summaryVersionId: version.id,
        fieldKey: String(field.fieldKey ?? ""),
        rawValue: typeof field.rawValue === "string" ? field.rawValue : null,
        normalizedValue: typeof field.normalizedValue === "string" ? field.normalizedValue : null,
        fieldType: typeof field.fieldType === "string" ? field.fieldType : null,
      })));
    }
    return { match: matchRow, upload, version };
  });
  res.status(201).json(result);
});

router.get("/truth-engine/matches/:matchId", async (req, res): Promise<void> => {
  const matchId = idParam(req.params.matchId);
  if (!matchId) {
    res.status(400).json({ error: "matchId must be a UUID" });
    return;
  }
  const match = await getMatch(db, WORKSPACE_ID, matchId);
  if (!match) {
    res.status(404).json({ error: "Truth match not found" });
    return;
  }
  res.json({ match, fields: await getActiveSummaryFields(db, WORKSPACE_ID, matchId) });
});

router.get("/truth-engine/matches/:matchId/audit", async (req, res): Promise<void> => {
  const matchId = idParam(req.params.matchId);
  if (!matchId) {
    res.status(400).json({ error: "matchId must be a UUID" });
    return;
  }
  const match = await getMatch(db, WORKSPACE_ID, matchId);
  const run = await getLatestAuditRun(db, WORKSPACE_ID, matchId);
  if (!match || !run) {
    res.status(404).json({ error: "Truth audit not found" });
    return;
  }
  res.json({ run, stages: await getAuditStages(db, WORKSPACE_ID, run.id) });
});

router.get("/truth-engine/audits/:runId/stages", async (req, res): Promise<void> => {
  const runId = idParam(req.params.runId);
  if (!runId) {
    res.status(400).json({ error: "runId must be a UUID" });
    return;
  }
  const run = await getAuditRunById(db, WORKSPACE_ID, runId);
  if (!run) {
    res.status(404).json({ error: "Truth audit not found" });
    return;
  }
  res.json(await getAuditStages(db, WORKSPACE_ID, runId));
});

async function leaseAction(
  req: Request,
  res: Response,
  action: "claim" | "renew" | "release",
): Promise<void> {
  const runId = idParam(req.params.runId);
  const owner = typeof req.body?.owner === "string" ? req.body.owner.trim() : "";
  const leaseMs = Number(req.body?.leaseMs ?? 60_000);
  if (!runId || !owner || !Number.isFinite(leaseMs) || leaseMs < 10_000) {
    res.status(400).json({ error: "Valid runId, owner, and leaseMs >= 10000 are required" });
    return;
  }
  const ok = action === "claim"
    ? await claimAuditRunScoped(db, runId, owner, leaseMs, WORKSPACE_ID)
    : action === "renew"
      ? await renewAuditRunLeaseScoped(db, runId, owner, leaseMs, WORKSPACE_ID)
      : await releaseAuditRunLeaseScoped(db, runId, owner, WORKSPACE_ID);
  res.json({ success: ok });
}

router.post("/truth-engine/audits/:runId/lease/claim", requireAdmin, (req, res) => void leaseAction(req, res, "claim"));
router.post("/truth-engine/audits/:runId/lease/renew", requireAdmin, (req, res) => void leaseAction(req, res, "renew"));
router.post("/truth-engine/audits/:runId/lease/release", requireAdmin, (req, res) => void leaseAction(req, res, "release"));

router.get("/truth-engine/audits/:runId/results", async (req, res): Promise<void> => {
  const runId = idParam(req.params.runId);
  if (!runId) {
    res.status(400).json({ error: "runId must be a UUID" });
    return;
  }
  const run = await getAuditRunById(db, WORKSPACE_ID, runId);
  if (!run) {
    res.status(404).json({ error: "Truth audit not found" });
    return;
  }
  res.json(await listResultGraph(db, runId));
});

router.get("/truth-engine/audits/:runId/sources", async (req, res): Promise<void> => {
  const runId = idParam(req.params.runId);
  if (!runId || !(await getAuditRunById(db, WORKSPACE_ID, runId))) {
    res.status(404).json({ error: "Truth audit not found" });
    return;
  }
  const [snapshots, conflicts] = await Promise.all([
    listSnapshots(db, WORKSPACE_ID, runId),
    listConflicts(db, WORKSPACE_ID, runId),
  ]);
  res.json({ snapshots, conflicts });
});

router.get("/truth-engine/audits/:runId/metrics", async (req, res): Promise<void> => {
  const runId = idParam(req.params.runId);
  if (!runId || !(await getAuditRunById(db, WORKSPACE_ID, runId))) {
    res.status(404).json({ error: "Truth audit not found" });
    return;
  }
  const [results, coverage] = await Promise.all([
    listMetricResults(db, runId),
    listMetricCoverage(db, runId),
  ]);
  res.json({ results, coverage });
});

router.get("/truth-engine/evidence", async (req, res): Promise<void> => {
  const metricCode = typeof req.query.metricCode === "string" ? req.query.metricCode : "";
  const asOfDate = typeof req.query.asOfDate === "string" ? req.query.asOfDate : undefined;
  if (!metricCode) {
    res.status(400).json({ error: "metricCode is required" });
    return;
  }
  res.json(await listEvidence(db, metricCode, asOfDate));
});

router.get("/truth-engine/calibration", async (req, res): Promise<void> => {
  const versionId = typeof req.query.versionId === "string" ? req.query.versionId : undefined;
  res.json(await getCalibration(db, WORKSPACE_ID, versionId));
});

router.get("/truth-engine/matches/:matchId/calibration-observations", async (req, res): Promise<void> => {
  const matchId = idParam(req.params.matchId);
  if (!matchId) {
    res.status(400).json({ error: "matchId must be a UUID" });
    return;
  }
  if (!(await getMatch(db, WORKSPACE_ID, matchId))) {
    res.status(404).json({ error: "Truth match not found" });
    return;
  }
  res.json(await listCalibrationObservations(db, WORKSPACE_ID, matchId));
});

router.get("/truth-engine/rules/:docType", async (req, res): Promise<void> => {
  const docType = typeof req.params.docType === "string" ? req.params.docType : "";
  const versionId = await getActiveRuleVersion(db, WORKSPACE_ID, docType);
  res.json(versionId ? await listRules(db, WORKSPACE_ID, versionId) : []);
});

router.post("/truth-engine/admin/rules/:docType/publish", requireAdmin, async (req, res): Promise<void> => {
  const docType = typeof req.params.docType === "string" ? req.params.docType : "";
  const content = typeof req.body?.content === "string" ? req.body.content : "";
  const rules = Array.isArray(req.body?.rules) ? req.body.rules as Array<Record<string, unknown>> : [];
  if (!docType || !content || !rules.length) {
    res.status(400).json({ error: "docType, content, and at least one rule are required" });
    return;
  }
  const published = await db.transaction(async (tx) => {
    const doc = (await tx.select().from(ruleDocumentsTable)
      .where(and(eq(ruleDocumentsTable.userId, WORKSPACE_ID), eq(ruleDocumentsTable.docType, docType))).limit(1))[0]
      ?? (await tx.insert(ruleDocumentsTable).values({ userId: WORKSPACE_ID, docType }).returning())[0]!;
    const previous = await tx.select({ version: ruleDocumentVersionsTable.version })
      .from(ruleDocumentVersionsTable)
      .where(and(eq(ruleDocumentVersionsTable.userId, WORKSPACE_ID), eq(ruleDocumentVersionsTable.ruleDocumentId, doc.id)))
      .orderBy(desc(ruleDocumentVersionsTable.version)).limit(1);
    const version = (await tx.insert(ruleDocumentVersionsTable).values({
      userId: WORKSPACE_ID,
      ruleDocumentId: doc.id,
      version: (previous[0]?.version ?? 0) + 1,
      content,
    }).returning())[0]!;
    await tx.insert(rulesTable).values(rules.map((rule) => ({
      userId: WORKSPACE_ID,
      versionId: version.id,
      ruleCode: String(rule.ruleCode ?? ""),
      ruleName: String(rule.ruleName ?? ""),
      body: typeof rule.body === "string" ? rule.body : null,
      severity: typeof rule.severity === "string" ? rule.severity : undefined,
      blocking: typeof rule.blocking === "boolean" ? rule.blocking : undefined,
    })));
    await tx.update(ruleDocumentsTable).set({ activeVersionId: version.id }).where(eq(ruleDocumentsTable.id, doc.id));
    return { document: doc, version, ruleCount: rules.length };
  });
  res.status(201).json(published);
});

router.get("/truth-engine/matches/:matchId/grades", async (req, res): Promise<void> => {
  const matchId = idParam(req.params.matchId);
  if (!matchId) {
    res.status(400).json({ error: "matchId must be a UUID" });
    return;
  }
  res.json(await listGrades(db, WORKSPACE_ID, matchId));
});

router.post("/truth-engine/matches/:matchId/grades", requireAdmin, async (req, res): Promise<void> => {
  const matchId = idParam(req.params.matchId);
  const grade = typeof req.body?.grade === "string" ? req.body.grade.trim() : "";
  const auditRunId = idParam(typeof req.body?.auditRunId === "string" ? req.body.auditRunId : undefined);
  if (!matchId || !grade || !auditRunId) {
    res.status(400).json({ error: "matchId, auditRunId, and grade are required" });
    return;
  }
  const [row] = await db.insert(resultGradesTable).values({
    userId: WORKSPACE_ID,
    auditRunId,
    matchId,
    grade,
    result: req.body?.result ?? null,
    gradedAt: new Date(),
  }).returning();
  res.status(201).json(row);
});

router.get("/truth-engine/ingestion/:sourceId/targets", async (req, res): Promise<void> => {
  const sourceId = idParam(req.params.sourceId);
  if (!sourceId) {
    res.status(400).json({ error: "sourceId must be a UUID" });
    return;
  }
  res.json(await listEnabledTargets(db, sourceId));
});

router.post("/truth-engine/admin/clear-slate", requireAdmin, async (req, res): Promise<void> => {
  res.json(await clearOperationalSlate(WORKSPACE_ID, { isAuthorized: true }));
});

export default router;