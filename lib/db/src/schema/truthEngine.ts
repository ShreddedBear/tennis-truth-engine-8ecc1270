import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * PostgreSQL Truth Engine tables.
 *
 * These definitions mirror the already-existing heliumdb tables. They are
 * intentionally additive: this file describes the live database and is not a
 * migration. Keep operational writes behind repositories so browser code never
 * receives a database connection.
 */
const auditColumns = {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  auditRunId: uuid("audit_run_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

export const auditCoverageTable = pgTable("audit_coverage", {
  id: uuid("id").defaultRandom().primaryKey(),
  auditRunId: uuid("audit_run_id").notNull(),
  playerSide: text("player_side").notNull(),
  directCount: integer("direct_count").notNull().default(0),
  reconstructedCount: integer("reconstructed_count").notNull().default(0),
  partialCount: integer("partial_count").notNull().default(0),
  unavailableCount: integer("unavailable_count").notNull().default(0),
  excludedCount: integer("excluded_count").notNull().default(0),
  totalCount: integer("total_count").notNull().default(0),
  usableCoveragePercent: numeric("usable_coverage_percent").notNull().default("0"),
  executionCompletionPercent: numeric("execution_completion_percent").notNull().default("0"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  userId: uuid("user_id"),
});

export const auditRunsTable = pgTable("audit_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  matchId: uuid("match_id").notNull(),
  runNumber: integer("run_number").notNull().default(1),
  researchLockAt: timestamp("research_lock_at", { withTimezone: true }),
  independentDecisionCommittedAt: timestamp("independent_decision_committed_at", { withTimezone: true }),
  matrixRevealedAt: timestamp("matrix_revealed_at", { withTimezone: true }),
  independentWinner: text("independent_winner"),
  independentLow: numeric("independent_low"),
  independentHigh: numeric("independent_high"),
  calibratedLow: numeric("calibrated_low"),
  calibratedHigh: numeric("calibrated_high"),
  effectiveEvidenceCount: integer("effective_evidence_count").notNull().default(0),
  rawSignalCount: integer("raw_signal_count").notNull().default(0),
  status: text("status").notNull().default("RUNNING"),
  staleReason: text("stale_reason"),
  verificationVersionId: uuid("verification_version_id"),
  disagreementVersionId: uuid("disagreement_version_id"),
  metricsVersionId: uuid("metrics_version_id"),
  calibrationVersionId: uuid("calibration_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  independentMethodId: uuid("independent_method_id"),
  independentMethodVersion: text("independent_method_version"),
  independentInputs: jsonb("independent_inputs").notNull().default({}),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
  independentWinnerId: uuid("independent_winner_id"),
  independentWinnerSide: text("independent_winner_side"),
});

export const auditStageRunsTable = pgTable("audit_stage_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  auditRunId: uuid("audit_run_id").notNull(),
  matchId: uuid("match_id"),
  stage: text("stage").notNull(),
  stageOrder: integer("stage_order").notNull().default(0),
  status: text("status").notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  detail: jsonb("detail").notNull().default({}),
  doneCount: integer("done_count").notNull().default(0),
  totalCount: integer("total_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
});

export const matchesTable = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  canonicalKey: text("canonical_key").notNull(),
  player1Name: text("player1_name").notNull(),
  player2Name: text("player2_name").notNull(),
  tournamentName: text("tournament_name"),
  eventLevel: text("event_level"),
  round: text("round"),
  scheduledDate: date("scheduled_date", { mode: "string" }),
  surface: text("surface"),
  bestOf: integer("best_of"),
  winner: text("winner"),
  winnerId: uuid("winner_id"),
  resultStatus: text("result_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const summaryUploadsTable = pgTable("summary_uploads", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  filename: text("filename").notNull(),
  pageCount: integer("page_count"),
  parseStatus: text("parse_status").notNull().default("NOT STARTED"),
  rawText: text("raw_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  pagesProcessed: integer("pages_processed").notNull().default(0),
  pagesVision: integer("pages_vision").notNull().default(0),
  pagesFailed: integer("pages_failed").notNull().default(0),
  extractionStatus: text("extraction_status").notNull().default("PENDING"),
});

export const summaryVersionsTable = pgTable("summary_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  matchId: uuid("match_id").notNull(),
  uploadId: uuid("upload_id").notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  pageNumber: integer("page_number"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const parsedSummaryFieldsTable = pgTable("parsed_summary_fields", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  summaryVersionId: uuid("summary_version_id").notNull(),
  fieldKey: text("field_key").notNull(),
  rawValue: text("raw_value"),
  normalizedValue: text("normalized_value"),
  fieldType: text("field_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const metricEvidenceStoreTable = pgTable("metric_evidence_store", {
  id: uuid("id").defaultRandom().primaryKey(),
  metricCode: text("metric_code").notNull(),
  metricName: text("metric_name").notNull(),
  playerName: text("player_name").notNull(),
  opponentName: text("opponent_name"),
  tournament: text("tournament"),
  surface: text("surface"),
  asOfDate: date("as_of_date", { mode: "string" }).notNull(),
  treatment: text("treatment").notNull(),
  valueText: text("value_text").notNull(),
  reliability: numeric("reliability"),
  sampleLabel: text("sample_label"),
  evidenceFamily: text("evidence_family"),
  sourceIds: text("source_ids").array().notNull().default([]),
  sources: jsonb("sources").notNull().default([]),
  unavailableReason: text("unavailable_reason"),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const metricResultsTable = pgTable("metric_results", { ...auditColumns, metricCode: text("metric_code").notNull(), metricName: text("metric_name"), p1Treatment: text("p1_treatment"), p2Treatment: text("p2_treatment"), p1Value: text("p1_value"), p2Value: text("p2_value"), status: text("status"), result: jsonb("result") });
export const verificationResultsTable = pgTable("verification_results", { ...auditColumns, ruleId: uuid("rule_id"), ruleCode: text("rule_code").notNull(), ruleName: text("rule_name").notNull(), p1Finding: text("p1_finding"), p2Finding: text("p2_finding"), outcome: text("outcome").notNull().default("NOT STARTED"), severity: text("severity"), decisionEffect: text("decision_effect"), sources: jsonb("sources").notNull().default([]), status: text("status").notNull().default("NOT STARTED"), unavailableReason: text("unavailable_reason"), unavailableDetail: text("unavailable_detail"), missingInputs: jsonb("missing_inputs").notNull().default([]), reconstructionAttempted: boolean("reconstruction_attempted").notNull().default(false), reconstructionReason: text("reconstruction_reason"), reconstructionResult: text("reconstruction_result"), retrievedAt: timestamp("retrieved_at", { withTimezone: true }) });
export const disagreementResultsTable = pgTable("disagreement_results", { ...auditColumns, ruleCode: text("rule_code").notNull(), ruleName: text("rule_name").notNull(), status: text("status").notNull().default("NOT STARTED"), ruleId: uuid("rule_id"), p1Risk: text("p1_risk"), p2Risk: text("p2_risk"), supportingEvidence: text("supporting_evidence"), opposingEvidence: text("opposing_evidence"), contradictionSeverity: text("contradiction_severity"), finalEffect: text("final_effect"), unavailableReason: text("unavailable_reason"), unavailableDetail: text("unavailable_detail"), providerError: text("provider_error"), sources: jsonb("sources").notNull().default([]), missingInputs: jsonb("missing_inputs").notNull().default([]), sourceAttempts: jsonb("source_attempts").notNull().default([]), reconstructionAttempted: boolean("reconstruction_attempted").notNull().default(false), reconstructionReason: text("reconstruction_reason"), reconstructionResult: text("reconstruction_result"), retrievedAt: timestamp("retrieved_at", { withTimezone: true }) });
export const underdogResultsTable = pgTable("underdog_results", { ...auditColumns, pathwayCode: text("pathway_code").notNull(), pathwayName: text("pathway_name").notNull(), playerSide: text("player_side").notNull(), classification: text("classification").notNull().default("UNRESOLVED"), evidence: text("evidence"), repeatable: boolean("repeatable").notNull().default(false), status: text("status").notNull().default("NOT STARTED"), sources: jsonb("sources").notNull().default([]) });
export const stressResultsTable = pgTable("stress_results", { ...auditColumns, testCode: text("test_code").notNull(), testName: text("test_name").notNull(), outcome: text("outcome").notNull().default("NOT STARTED"), status: text("status").notNull().default("NOT STARTED"), winnerBefore: text("winner_before"), winnerAfter: text("winner_after"), rangeBefore: text("range_before"), rangeAfter: text("range_after"), unavailableReason: text("unavailable_reason"), providerError: text("provider_error"), sources: jsonb("sources").notNull().default([]), missingInputs: jsonb("missing_inputs").notNull().default([]), reconstructionAttempted: boolean("reconstruction_attempted").notNull().default(false), reconstructionReason: text("reconstruction_reason"), reconstructionResult: text("reconstruction_result"), retrievedAt: timestamp("retrieved_at", { withTimezone: true }), p1StressedOutcome: text("p1_stressed_outcome"), p2StressedOutcome: text("p2_stressed_outcome"), p1Support: text("p1_support"), p2Support: text("p2_support"), comparativeRobustness: text("comparative_robustness") });
export const reconstructionResultsTable = pgTable("reconstruction_results", { ...auditColumns, metricCode: text("metric_code"), playerSide: text("player_side"), status: text("status").notNull().default("NOT STARTED"), result: jsonb("result"), sources: jsonb("sources").notNull().default([]) });

export const finalDecisionsTable = pgTable("final_decisions", { ...auditColumns, finalAuditColor: text("final_audit_color"), finalSelection: text("final_selection"), selectedPlayerId: uuid("selected_player_id"), action: text("action"), gateReport: jsonb("gate_report"), completionPercent: numeric("completion_percent"), auditComplete: boolean("audit_complete").notNull().default(false), matrixFirewallValid: boolean("matrix_firewall_valid").notNull().default(false), calibrationBucket: text("calibration_bucket"), verifiedWinRate: numeric("verified_win_rate") });
export const executionLogsTable = pgTable("execution_logs", { ...auditColumns, matchId: uuid("match_id"), stage: text("stage").notNull(), status: text("status").notNull(), output: jsonb("output"), matrixVisible: boolean("matrix_visible").notNull().default(false) });
export const resultGradesTable = pgTable("result_grades", { ...auditColumns, matchId: uuid("match_id"), grade: text("grade"), result: jsonb("result"), gradedAt: timestamp("graded_at", { withTimezone: true }) });
export const matchIdentityRecordsTable = pgTable("match_identity_records", { ...auditColumns, matchId: uuid("match_id").notNull(), field: text("field").notNull(), claimedValue: text("claimed_value"), verifiedValue: text("verified_value"), status: text("status"), note: text("note") });
export const sourceSnapshotsTable = pgTable("source_snapshots", { ...auditColumns, sourceId: text("source_id"), sourceName: text("source_name"), dataKey: text("data_key"), playerSide: text("player_side"), rawValue: text("raw_value"), normalizedValue: text("normalized_value"), retrievedAt: timestamp("retrieved_at", { withTimezone: true }), postStart: boolean("post_start"), excluded: boolean("excluded"), reliability: numeric("reliability") });
export const sourceConflictsTable = pgTable("source_conflicts", { ...auditColumns, sourceId: text("source_id"), dataKey: text("data_key"), playerSide: text("player_side"), critical: boolean("critical").notNull().default(false), values: jsonb("values"), resolutionStatus: text("resolution_status"), resolutionReason: text("resolution_reason"), selectedValue: text("selected_value") });
export const sourceObservationsTable = pgTable("source_observations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  sourceId: text("source_id").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url"),
  sourceRecordKey: text("source_record_key"),
  playerName: text("player_name"),
  opponentName: text("opponent_name"),
  tournament: text("tournament"),
  eventDate: date("event_date", { mode: "string" }),
  surface: text("surface"),
  observationType: text("observation_type").notNull(),
  observationKey: text("observation_key").notNull(),
  numericValue: doublePrecision("numeric_value"),
  textValue: text("text_value"),
  unit: text("unit"),
  sampleLabel: text("sample_label"),
  windowStart: date("window_start", { mode: "string" }),
  windowEnd: date("window_end", { mode: "string" }),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
  sourcePublishedAt: timestamp("source_published_at", { withTimezone: true }),
  rawPayload: jsonb("raw_payload"),
  provenance: jsonb("provenance").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const playersTable = pgTable("players", { id: uuid("id").defaultRandom().primaryKey(), name: text("name"), normalizedName: text("normalized_name"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const rulesTable = pgTable("rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  versionId: uuid("version_id"),
  ruleCode: text("rule_code").notNull(),
  ruleName: text("rule_name").notNull(),
  category: text("category"),
  body: text("body"),
  severity: text("severity").notNull().default("STANDARD"),
  blocking: boolean("blocking").notNull().default(false),
  mappingStatus: text("mapping_status").notNull().default("REQUIRES HUMAN RULE MAPPING"),
  machineLogic: text("machine_logic"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const ruleDocumentsTable = pgTable("rule_documents", { id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull(), docType: text("doc_type").notNull(), activeVersionId: uuid("active_version_id"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const ruleDocumentVersionsTable = pgTable("rule_document_versions", { id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull(), ruleDocumentId: uuid("rule_document_id"), version: integer("version"), content: text("content"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const calibrationVersionsTable = pgTable("calibration_versions", { id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull(), label: text("label"), versionNumber: integer("version_number").notNull(), isActive: boolean("is_active").notNull().default(false), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const calibrationBucketsTable = pgTable("calibration_buckets", { id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull(), calibrationVersionId: uuid("calibration_version_id").notNull(), bucketCode: text("bucket_code").notNull(), bucketLabel: text("bucket_label").notNull(), wpMin: numeric("wp_min").notNull(), wpMax: numeric("wp_max").notNull(), wins: integer("wins").notNull().default(0), graded: integer("graded").notNull().default(0), smallSample: boolean("small_sample").notNull().default(false), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const calibrationLedgerTable = pgTable("calibration_ledger", { id: uuid("id").defaultRandom().primaryKey(), userId: uuid("user_id").notNull(), masterSequence: integer("master_sequence").notNull(), matchId: uuid("match_id"), matchLabel: text("match_label").notNull(), tournament: text("tournament"), matchDate: date("match_date", { mode: "string" }), surface: text("surface"), payload: jsonb("payload"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const metricCoverageRatesTable = pgTable("metric_coverage_rates", { ...auditColumns, metricCode: text("metric_code").notNull(), playerSide: text("player_side").notNull(), treatment: text("treatment").notNull(), usable: boolean("usable").notNull(), recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow() });
export const metricRegistryTable = pgTable("metric_registry", { id: uuid("id").defaultRandom().primaryKey(), metricCode: text("metric_code").notNull(), metricName: text("metric_name").notNull(), lifecycleStatus: text("lifecycle_status"), tourEligibility: jsonb("tour_eligibility").notNull().default([]), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const ingestionTargetsTable = pgTable("ingestion_targets", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: text("source_id").notNull(),
  targetKey: text("target_key").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  pullbackStart: date("pullback_start", { mode: "string" }),
  pullbackEnd: date("pullback_end", { mode: "string" }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  timezone: text("timezone"),
  tournament: text("tournament"),
  sportKey: text("sport_key"),
  config: jsonb("config").notNull().default({}),
  lastIngestedAt: timestamp("last_ingested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sourceTargetUnique: uniqueIndex("ingestion_targets_source_id_target_key_key")
    .on(table.sourceId, table.targetKey),
}));
export const sourceIngestionRunsTable = pgTable("source_ingestion_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: text("source_id").notNull(),
  jobType: text("job_type").notNull(),
  requestedWindowStart: date("requested_window_start", { mode: "string" }),
  requestedWindowEnd: date("requested_window_end", { mode: "string" }),
  status: text("status").notNull().default("QUEUED"),
  recordsSeen: integer("records_seen").notNull().default(0),
  recordsInserted: integer("records_inserted").notNull().default(0),
  recordsUpdated: integer("records_updated").notNull().default(0),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const sourceDefinitionsTable = pgTable("source_definitions", { id: uuid("id").defaultRandom().primaryKey(), sourceKey: text("source_key"), name: text("name"), config: jsonb("config"), enabled: boolean("enabled").notNull().default(true) });
export const truthEngineCalibrationObservationsTable = pgTable("truth_engine_calibration_observations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  matchId: uuid("match_id").notNull(),
  auditRunId: uuid("audit_run_id").notNull(),
  slateId: uuid("slate_id"),
  runNumber: integer("run_number").notNull().default(0),
  predictedAt: timestamp("predicted_at", { withTimezone: true }),
  scheduledDate: date("scheduled_date", { mode: "string" }),
  player1Name: text("player1_name").notNull(),
  player2Name: text("player2_name").notNull(),
  selectedPlayer: text("selected_player").notNull(),
  decisionOutcome: text("decision_outcome").notNull(),
  evidenceSupportPercent: numeric("evidence_support_percent"),
  directionalFamilies: integer("directional_families"),
  supportingFamilies: text("supporting_families").array().notNull().default([]),
  contradictingFamilies: text("contradicting_families").array().notNull().default([]),
  neutralFamilies: text("neutral_families").array().notNull().default([]),
  conflictedFamilies: text("conflicted_families").array().notNull().default([]),
  supportingFamilyCount: integer("supporting_family_count"),
  contradictingFamilyCount: integer("contradicting_family_count"),
  corroborated: boolean("corroborated"),
  stability: text("stability"),
  verificationResult: text("verification_result"),
  disagreementResult: text("disagreement_result"),
  underdogResult: text("underdog_result"),
  stressResult: text("stress_result"),
  evidenceCoveragePercent: numeric("evidence_coverage_percent"),
  evidenceCoverageUsable: integer("evidence_coverage_usable"),
  evidenceCoverageExpected: integer("evidence_coverage_expected"),
  actualWinner: text("actual_winner").notNull(),
  resultStatus: text("result_status"),
  finalScore: text("final_score"),
  predictionOutcome: text("prediction_outcome").notNull(),
  calibrationEligible: boolean("calibration_eligible").notNull().default(false),
  eligibilityReason: text("eligibility_reason"),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  player1Id: uuid("player1_id"),
  player2Id: uuid("player2_id"),
  selectedPlayerId: uuid("selected_player_id"),
  actualWinnerId: uuid("actual_winner_id"),
  tournamentName: text("tournament_name"),
  surface: text("surface"),
  eventLevel: text("event_level"),
  metricsVersionId: uuid("metrics_version_id"),
  verificationVersionId: uuid("verification_version_id"),
  disagreementVersionId: uuid("disagreement_version_id"),
  calibrationModelVersion: text("calibration_model_version"),
  featureVersion: text("feature_version"),
});

export const insertAuditRunsSchema = createInsertSchema(auditRunsTable);
export const insertMetricEvidenceStoreSchema = createInsertSchema(metricEvidenceStoreTable);
export const insertTruthEngineCalibrationObservationSchema = createInsertSchema(truthEngineCalibrationObservationsTable);
export type AuditRun = typeof auditRunsTable.$inferSelect;
export type InsertAuditRun = z.infer<typeof insertAuditRunsSchema>;
export type MetricEvidenceStore = typeof metricEvidenceStoreTable.$inferSelect;
export type InsertMetricEvidenceStore = z.infer<typeof insertMetricEvidenceStoreSchema>;
export type TruthEngineCalibrationObservation = typeof truthEngineCalibrationObservationsTable.$inferSelect;
export type InsertTruthEngineCalibrationObservation = z.infer<typeof insertTruthEngineCalibrationObservationSchema>;