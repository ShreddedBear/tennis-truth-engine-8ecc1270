// GENERATED FROM THE LIVE PRODUCTION SCHEMA -- do not hand-edit column types.
//
// Property names are deliberately snake_case, identical to the Postgres column names.
// Drizzle normally maps camelCase properties onto snake_case columns, but this schema
// describes a database that predates it: every row shape in this app is already read as
// `row.usable_coverage_percent`, `row.final_selection`, and so on, across ~200 call sites.
// Keeping the property names equal to the column names makes a Drizzle row and the old
// PostgREST row byte-identical, so the migration changes how a query is BUILT without
// changing what any consumer of the result sees.

import { pgTable, boolean, jsonb, numeric, text, uuid } from "drizzle-orm/pg-core";
import { isoTimestamp } from "../columns";
import { sql } from "drizzle-orm";
import type { JsonValue } from "../json";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const verificationResultsTable = pgTable("verification_results", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  audit_run_id: uuid("audit_run_id").notNull(),
  rule_id: uuid("rule_id"),
  rule_code: text("rule_code").notNull(),
  rule_name: text("rule_name").notNull(),
  p1_finding: text("p1_finding"),
  p2_finding: text("p2_finding"),
  outcome: text("outcome").notNull().default("NOT STARTED"),
  severity: text("severity"),
  decision_effect: text("decision_effect"),
  sources: jsonb("sources").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  status: text("status").notNull().default("NOT STARTED"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
  unavailable_reason: text("unavailable_reason"),
  unavailable_detail: text("unavailable_detail"),
  provider_error: text("provider_error"),
  missing_inputs: jsonb("missing_inputs").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  source_attempts: jsonb("source_attempts").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  reconstruction_attempted: boolean("reconstruction_attempted").notNull().default(false),
  reconstruction_reason: text("reconstruction_reason"),
  reconstruction_result: text("reconstruction_result"),
  retrieved_at: isoTimestamp("retrieved_at"),
});

export const insertVerificationResultsSchema = createInsertSchema(verificationResultsTable);
export type InsertVerificationResults = z.infer<typeof insertVerificationResultsSchema>;
export type VerificationResultsRow = typeof verificationResultsTable.$inferSelect;

export const disagreementResultsTable = pgTable("disagreement_results", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  audit_run_id: uuid("audit_run_id").notNull(),
  rule_id: uuid("rule_id"),
  rule_code: text("rule_code").notNull(),
  rule_name: text("rule_name").notNull(),
  p1_risk: text("p1_risk"),
  p2_risk: text("p2_risk"),
  supporting_evidence: text("supporting_evidence"),
  opposing_evidence: text("opposing_evidence"),
  contradiction_severity: text("contradiction_severity"),
  final_effect: text("final_effect"),
  status: text("status").notNull().default("NOT STARTED"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
  unavailable_reason: text("unavailable_reason"),
  unavailable_detail: text("unavailable_detail"),
  provider_error: text("provider_error"),
  sources: jsonb("sources").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  missing_inputs: jsonb("missing_inputs").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  source_attempts: jsonb("source_attempts").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  reconstruction_attempted: boolean("reconstruction_attempted").notNull().default(false),
  reconstruction_reason: text("reconstruction_reason"),
  reconstruction_result: text("reconstruction_result"),
  retrieved_at: isoTimestamp("retrieved_at"),
});

export const insertDisagreementResultsSchema = createInsertSchema(disagreementResultsTable);
export type InsertDisagreementResults = z.infer<typeof insertDisagreementResultsSchema>;
export type DisagreementResultsRow = typeof disagreementResultsTable.$inferSelect;

export const underdogResultsTable = pgTable("underdog_results", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  audit_run_id: uuid("audit_run_id").notNull(),
  pathway_code: text("pathway_code").notNull(),
  pathway_name: text("pathway_name").notNull(),
  player_side: text("player_side").notNull(),
  classification: text("classification").notNull().default("UNRESOLVED"),
  evidence: text("evidence"),
  repeatable: boolean("repeatable").notNull().default(false),
  status: text("status").notNull().default("NOT STARTED"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
  unavailable_reason: text("unavailable_reason"),
  unavailable_detail: text("unavailable_detail"),
  provider_error: text("provider_error"),
  sources: jsonb("sources").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  missing_inputs: jsonb("missing_inputs").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  source_attempts: jsonb("source_attempts").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  reconstruction_attempted: boolean("reconstruction_attempted").notNull().default(false),
  reconstruction_reason: text("reconstruction_reason"),
  reconstruction_result: text("reconstruction_result"),
  retrieved_at: isoTimestamp("retrieved_at"),
});

export const insertUnderdogResultsSchema = createInsertSchema(underdogResultsTable);
export type InsertUnderdogResults = z.infer<typeof insertUnderdogResultsSchema>;
export type UnderdogResultsRow = typeof underdogResultsTable.$inferSelect;

export const stressResultsTable = pgTable("stress_results", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  audit_run_id: uuid("audit_run_id").notNull(),
  test_code: text("test_code").notNull(),
  test_name: text("test_name").notNull(),
  winner_before: text("winner_before"),
  winner_after: text("winner_after"),
  range_before: text("range_before"),
  range_after: text("range_after"),
  outcome: text("outcome").notNull().default("NOT STARTED"),
  status: text("status").notNull().default("NOT STARTED"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
  unavailable_reason: text("unavailable_reason"),
  unavailable_detail: text("unavailable_detail"),
  provider_error: text("provider_error"),
  sources: jsonb("sources").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  missing_inputs: jsonb("missing_inputs").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  source_attempts: jsonb("source_attempts").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  reconstruction_attempted: boolean("reconstruction_attempted").notNull().default(false),
  reconstruction_reason: text("reconstruction_reason"),
  reconstruction_result: text("reconstruction_result"),
  retrieved_at: isoTimestamp("retrieved_at"),
  p1_outcome_when_stressed: text("p1_outcome_when_stressed"),
  p2_outcome_when_stressed: text("p2_outcome_when_stressed"),
  p1_support_percent_before: numeric("p1_support_percent_before", { mode: "number" }),
  p1_support_percent_after: numeric("p1_support_percent_after", { mode: "number" }),
  p2_support_percent_before: numeric("p2_support_percent_before", { mode: "number" }),
  p2_support_percent_after: numeric("p2_support_percent_after", { mode: "number" }),
  comparative_robustness: text("comparative_robustness"),
});

export const insertStressResultsSchema = createInsertSchema(stressResultsTable);
export type InsertStressResults = z.infer<typeof insertStressResultsSchema>;
export type StressResultsRow = typeof stressResultsTable.$inferSelect;

export const reconstructionResultsTable = pgTable("reconstruction_results", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  audit_run_id: uuid("audit_run_id").notNull(),
  metric_code: text("metric_code").notNull(),
  player_side: text("player_side").notNull(),
  formula: text("formula"),
  inputs: jsonb("inputs").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  assumptions: text("assumptions"),
  output: text("output"),
  reliability: numeric("reliability", { mode: "number" }),
  status: text("status").notNull().default("NOT STARTED"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
  formula_version_id: uuid("formula_version_id"),
  formula_version_label: text("formula_version_label"),
  calculation: text("calculation"),
  source_refs: jsonb("source_refs").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  unavailable_reason: text("unavailable_reason"),
  provider_error: text("provider_error"),
  missing_inputs: jsonb("missing_inputs").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  source_attempts: jsonb("source_attempts").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  reconstruction_attempted: boolean("reconstruction_attempted").notNull().default(true),
  reconstruction_reason: text("reconstruction_reason"),
  reconstruction_result: text("reconstruction_result"),
  retrieved_at: isoTimestamp("retrieved_at"),
});

export const insertReconstructionResultsSchema = createInsertSchema(reconstructionResultsTable);
export type InsertReconstructionResults = z.infer<typeof insertReconstructionResultsSchema>;
export type ReconstructionResultsRow = typeof reconstructionResultsTable.$inferSelect;

export const autopsiesTable = pgTable("autopsies", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  match_id: uuid("match_id"),
  result_grade_id: uuid("result_grade_id"),
  autopsy_type: text("autopsy_type").notNull(),
  audit_color: text("audit_color"),
  trigger_reason: text("trigger_reason"),
  summary: text("summary"),
  status: text("status").notNull().default("OPEN"),
  leakage_check_status: text("leakage_check_status").notNull().default("PENDING"),
  first_serve_at: isoTimestamp("first_serve_at"),
  informs_rule_revision: boolean("informs_rule_revision").notNull().default(false),
  retroactive_change_blocked: boolean("retroactive_change_blocked").notNull().default(true),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
  updated_at: isoTimestamp("updated_at").notNull().default(sql`now()`),
});

export const insertAutopsiesSchema = createInsertSchema(autopsiesTable);
export type InsertAutopsies = z.infer<typeof insertAutopsiesSchema>;
export type AutopsiesRow = typeof autopsiesTable.$inferSelect;

export const autopsyFindingsTable = pgTable("autopsy_findings", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  autopsy_id: uuid("autopsy_id").notNull(),
  failure_code: text("failure_code").notNull(),
  failure_label: text("failure_label").notNull(),
  evidence: text("evidence"),
  evidence_source: text("evidence_source"),
  evidence_published_at: isoTimestamp("evidence_published_at"),
  publicly_available_pre_match: boolean("publicly_available_pre_match").notNull().default(false),
  admissible: boolean("admissible").notNull().default(false),
  inadmissible_reason: text("inadmissible_reason"),
  severity: text("severity").notNull().default("MEDIUM"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
});

export const insertAutopsyFindingsSchema = createInsertSchema(autopsyFindingsTable);
export type InsertAutopsyFindings = z.infer<typeof insertAutopsyFindingsSchema>;
export type AutopsyFindingsRow = typeof autopsyFindingsTable.$inferSelect;

export const blockReasonsTable = pgTable("block_reasons", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  audit_run_id: uuid("audit_run_id"),
  match_id: uuid("match_id"),
  code: text("code").notNull(),
  label: text("label").notNull(),
  severity: text("severity").notNull().default("BLOCKING"),
  detail: text("detail"),
  resolved: boolean("resolved").notNull().default(false),
  resolved_at: isoTimestamp("resolved_at"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
});

export const insertBlockReasonsSchema = createInsertSchema(blockReasonsTable);
export type InsertBlockReasons = z.infer<typeof insertBlockReasonsSchema>;
export type BlockReasonsRow = typeof blockReasonsTable.$inferSelect;
