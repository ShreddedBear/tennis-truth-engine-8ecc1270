// GENERATED FROM THE LIVE PRODUCTION SCHEMA -- do not hand-edit column types.
//
// Property names are deliberately snake_case, identical to the Postgres column names.
// Drizzle normally maps camelCase properties onto snake_case columns, but this schema
// describes a database that predates it: every row shape in this app is already read as
// `row.usable_coverage_percent`, `row.final_selection`, and so on, across ~200 call sites.
// Keeping the property names equal to the column names makes a Drizzle row and the old
// PostgREST row byte-identical, so the migration changes how a query is BUILT without
// changing what any consumer of the result sees.

import { pgTable, boolean, integer, jsonb, numeric, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { JsonValue } from "../json";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditRunsTable = pgTable("audit_runs", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  match_id: uuid("match_id").notNull(),
  run_number: integer("run_number").notNull().default(1),
  research_lock_at: timestamp("research_lock_at", { withTimezone: true, mode: "string" }),
  independent_decision_committed_at: timestamp("independent_decision_committed_at", { withTimezone: true, mode: "string" }),
  matrix_revealed_at: timestamp("matrix_revealed_at", { withTimezone: true, mode: "string" }),
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
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  independent_method_id: uuid("independent_method_id"),
  independent_method_version: text("independent_method_version"),
  independent_inputs: jsonb("independent_inputs").$type<JsonValue>().notNull().default(sql`'{}'::jsonb`),
  lease_owner: text("lease_owner"),
  lease_expires_at: timestamp("lease_expires_at", { withTimezone: true, mode: "string" }),
  heartbeat_at: timestamp("heartbeat_at", { withTimezone: true, mode: "string" }),
  independent_winner_id: uuid("independent_winner_id"),
  independent_winner_side: text("independent_winner_side"),
});

export const insertAuditRunsSchema = createInsertSchema(auditRunsTable);
export type InsertAuditRuns = z.infer<typeof insertAuditRunsSchema>;
export type AuditRunsRow = typeof auditRunsTable.$inferSelect;

export const auditStageRunsTable = pgTable("audit_stage_runs", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  audit_run_id: uuid("audit_run_id").notNull(),
  match_id: uuid("match_id"),
  stage: text("stage").notNull(),
  stage_order: integer("stage_order").notNull().default(0),
  status: text("status").notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  started_at: timestamp("started_at", { withTimezone: true, mode: "string" }),
  finished_at: timestamp("finished_at", { withTimezone: true, mode: "string" }),
  error_code: text("error_code"),
  error_message: text("error_message"),
  detail: jsonb("detail").$type<JsonValue>().notNull().default(sql`'{}'::jsonb`),
  done_count: integer("done_count").notNull().default(0),
  total_count: integer("total_count").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  heartbeat_at: timestamp("heartbeat_at", { withTimezone: true, mode: "string" }),
});

export const insertAuditStageRunsSchema = createInsertSchema(auditStageRunsTable);
export type InsertAuditStageRuns = z.infer<typeof insertAuditStageRunsSchema>;
export type AuditStageRunsRow = typeof auditStageRunsTable.$inferSelect;

export const auditCoverageTable = pgTable("audit_coverage", {
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
  recorded_at: timestamp("recorded_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  user_id: uuid("user_id"),
});

export const insertAuditCoverageSchema = createInsertSchema(auditCoverageTable);
export type InsertAuditCoverage = z.infer<typeof insertAuditCoverageSchema>;
export type AuditCoverageRow = typeof auditCoverageTable.$inferSelect;

export const auditColorLedgerTable = pgTable("audit_color_ledger", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
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
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const insertAuditColorLedgerSchema = createInsertSchema(auditColorLedgerTable);
export type InsertAuditColorLedger = z.infer<typeof insertAuditColorLedgerSchema>;
export type AuditColorLedgerRow = typeof auditColorLedgerTable.$inferSelect;

export const executionLogsTable = pgTable("execution_logs", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  audit_run_id: uuid("audit_run_id"),
  match_id: uuid("match_id"),
  stage: text("stage").notNull(),
  rule_code: text("rule_code"),
  player_side: text("player_side"),
  input: jsonb("input").$type<JsonValue>(),
  output: jsonb("output").$type<JsonValue>(),
  source: text("source"),
  status: text("status").notNull(),
  matrix_visible: boolean("matrix_visible").notNull().default(false),
  rule_version: text("rule_version"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const insertExecutionLogsSchema = createInsertSchema(executionLogsTable);
export type InsertExecutionLogs = z.infer<typeof insertExecutionLogsSchema>;
export type ExecutionLogsRow = typeof executionLogsTable.$inferSelect;

export const batchIntegrityChecksTable = pgTable("batch_integrity_checks", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  label: text("label").notNull(),
  uploaded_count: integer("uploaded_count").notNull().default(0),
  canonical_count: integer("canonical_count").notNull().default(0),
  board_count: integer("board_count").notNull().default(0),
  duplicates: jsonb("duplicates").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  unresolved: jsonb("unresolved").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  status: text("status").notNull().default("MISMATCH"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const insertBatchIntegrityChecksSchema = createInsertSchema(batchIntegrityChecksTable);
export type InsertBatchIntegrityChecks = z.infer<typeof insertBatchIntegrityChecksSchema>;
export type BatchIntegrityChecksRow = typeof batchIntegrityChecksTable.$inferSelect;
