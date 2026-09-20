import { _ as uuid, b as jsonb, g as pgTable, k as sql, v as text, w as boolean, x as integer, y as numeric } from "../_libs/drizzle-orm.mjs";
import { n as isoTimestamp } from "./columns-DdiGZMmP.mjs";
import { t as createInsertSchema } from "../_libs/drizzle-zod+zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/audit-ChUwSBsg.js
var auditRunsTable = pgTable("audit_runs", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	match_id: uuid("match_id").notNull(),
	run_number: integer("run_number").notNull().default(1),
	research_lock_at: isoTimestamp("research_lock_at"),
	independent_decision_committed_at: isoTimestamp("independent_decision_committed_at"),
	matrix_revealed_at: isoTimestamp("matrix_revealed_at"),
	independent_winner: text("independent_winner"),
	independent_low: numeric("independent_low", { mode: "number" }),
	independent_high: numeric("independent_high", { mode: "number" }),
	calibrated_low: numeric("calibrated_low", { mode: "number" }),
	calibrated_high: numeric("calibrated_high", { mode: "number" }),
	effective_evidence_count: integer("effective_evidence_count").notNull().default(0),
	raw_signal_count: integer("raw_signal_count").notNull().default(0),
	status: text("status").notNull().default("RUNNING"),
	stale_reason: text("stale_reason"),
	verification_version_id: uuid("verification_version_id"),
	disagreement_version_id: uuid("disagreement_version_id"),
	metrics_version_id: uuid("metrics_version_id"),
	calibration_version_id: uuid("calibration_version_id"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
	updated_at: isoTimestamp("updated_at").notNull().default(sql`now()`),
	independent_method_id: uuid("independent_method_id"),
	independent_method_version: text("independent_method_version"),
	independent_inputs: jsonb("independent_inputs").$type().notNull().default(sql`'{}'::jsonb`),
	lease_owner: text("lease_owner"),
	lease_expires_at: isoTimestamp("lease_expires_at"),
	heartbeat_at: isoTimestamp("heartbeat_at"),
	independent_winner_id: uuid("independent_winner_id"),
	independent_winner_side: text("independent_winner_side")
});
var insertAuditRunsSchema = createInsertSchema(auditRunsTable);
var auditStageRunsTable = pgTable("audit_stage_runs", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	audit_run_id: uuid("audit_run_id").notNull(),
	match_id: uuid("match_id"),
	stage: text("stage").notNull(),
	stage_order: integer("stage_order").notNull().default(0),
	status: text("status").notNull().default("PENDING"),
	attempts: integer("attempts").notNull().default(0),
	started_at: isoTimestamp("started_at"),
	finished_at: isoTimestamp("finished_at"),
	error_code: text("error_code"),
	error_message: text("error_message"),
	detail: jsonb("detail").$type().notNull().default(sql`'{}'::jsonb`),
	done_count: integer("done_count").notNull().default(0),
	total_count: integer("total_count").notNull().default(0),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
	updated_at: isoTimestamp("updated_at").notNull().default(sql`now()`),
	heartbeat_at: isoTimestamp("heartbeat_at")
});
var insertAuditStageRunsSchema = createInsertSchema(auditStageRunsTable);
var auditCoverageTable = pgTable("audit_coverage", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	audit_run_id: uuid("audit_run_id").notNull(),
	player_side: text("player_side").notNull(),
	direct_count: integer("direct_count").notNull().default(0),
	reconstructed_count: integer("reconstructed_count").notNull().default(0),
	partial_count: integer("partial_count").notNull().default(0),
	unavailable_count: integer("unavailable_count").notNull().default(0),
	excluded_count: integer("excluded_count").notNull().default(0),
	total_count: integer("total_count").notNull().default(0),
	usable_coverage_percent: numeric("usable_coverage_percent", { mode: "number" }).notNull().default(0),
	execution_completion_percent: numeric("execution_completion_percent", { mode: "number" }).notNull().default(0),
	recorded_at: isoTimestamp("recorded_at").notNull().default(sql`now()`),
	user_id: uuid("user_id")
});
var insertAuditCoverageSchema = createInsertSchema(auditCoverageTable);
var auditColorLedgerTable = pgTable("audit_color_ledger", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	result_grade_id: uuid("result_grade_id"),
	match_id: uuid("match_id"),
	match_label: text("match_label").notNull(),
	audit_color: text("audit_color").notNull(),
	final_selection: text("final_selection"),
	final_selection_result: text("final_selection_result").notNull(),
	independent_audit_result: text("independent_audit_result"),
	matrix_prediction_result: text("matrix_prediction_result"),
	counted: boolean("counted").notNull().default(true),
	note: text("note"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertAuditColorLedgerSchema = createInsertSchema(auditColorLedgerTable);
var executionLogsTable = pgTable("execution_logs", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	audit_run_id: uuid("audit_run_id"),
	match_id: uuid("match_id"),
	stage: text("stage").notNull(),
	rule_code: text("rule_code"),
	player_side: text("player_side"),
	input: jsonb("input").$type(),
	output: jsonb("output").$type(),
	source: text("source"),
	status: text("status").notNull(),
	matrix_visible: boolean("matrix_visible").notNull().default(false),
	rule_version: text("rule_version"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertExecutionLogsSchema = createInsertSchema(executionLogsTable);
var batchIntegrityChecksTable = pgTable("batch_integrity_checks", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	label: text("label").notNull(),
	uploaded_count: integer("uploaded_count").notNull().default(0),
	canonical_count: integer("canonical_count").notNull().default(0),
	board_count: integer("board_count").notNull().default(0),
	duplicates: jsonb("duplicates").$type().notNull().default(sql`'[]'::jsonb`),
	unresolved: jsonb("unresolved").$type().notNull().default(sql`'[]'::jsonb`),
	status: text("status").notNull().default("MISMATCH"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertBatchIntegrityChecksSchema = createInsertSchema(batchIntegrityChecksTable);
//#endregion
export { batchIntegrityChecksTable as a, insertAuditCoverageSchema as c, insertBatchIntegrityChecksSchema as d, insertExecutionLogsSchema as f, auditStageRunsTable as i, insertAuditRunsSchema as l, auditCoverageTable as n, executionLogsTable as o, auditRunsTable as r, insertAuditColorLedgerSchema as s, auditColorLedgerTable as t, insertAuditStageRunsSchema as u };
