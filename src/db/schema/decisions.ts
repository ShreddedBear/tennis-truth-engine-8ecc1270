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
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const finalDecisionsTable = pgTable("final_decisions", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  audit_run_id: uuid("audit_run_id").notNull(),
  final_audit_color: text("final_audit_color").notNull().default("INCOMPLETE"),
  final_selection: text("final_selection"),
  action: text("action"),
  gate_report: jsonb("gate_report").notNull().default(sql`'{}'::jsonb`),
  completion_percent: numeric("completion_percent").notNull().default("0"),
  audit_complete: boolean("audit_complete").notNull().default(false),
  matrix_firewall_valid: boolean("matrix_firewall_valid").notNull().default(true),
  calibration_bucket: text("calibration_bucket"),
  verified_win_rate: numeric("verified_win_rate"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  selected_player_id: uuid("selected_player_id"),
});

export const insertFinalDecisionsSchema = createInsertSchema(finalDecisionsTable);
export type InsertFinalDecisions = z.infer<typeof insertFinalDecisionsSchema>;
export type FinalDecisionsRow = typeof finalDecisionsTable.$inferSelect;

export const probabilityMethodsTable = pgTable("probability_methods", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  code: text("code").notNull(),
  version_number: integer("version_number").notNull().default(1),
  label: text("label").notNull(),
  formula: text("formula").notNull(),
  description: text("description"),
  params: jsonb("params").notNull().default(sql`'{}'::jsonb`),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProbabilityMethodsSchema = createInsertSchema(probabilityMethodsTable);
export type InsertProbabilityMethods = z.infer<typeof insertProbabilityMethodsSchema>;
export type ProbabilityMethodsRow = typeof probabilityMethodsTable.$inferSelect;

export const probabilityProvenanceTable = pgTable("probability_provenance", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  audit_run_id: uuid("audit_run_id").notNull(),
  metric_key: text("metric_key").notNull(),
  display_value: text("display_value").notNull(),
  numeric_value: numeric("numeric_value"),
  method_code: text("method_code").notNull(),
  method_version: text("method_version").notNull(),
  formula: text("formula").notNull(),
  inputs: jsonb("inputs").notNull().default(sql`'{}'::jsonb`),
  source_refs: jsonb("source_refs").notNull().default(sql`'[]'::jsonb`),
  interpretation_note: text("interpretation_note"),
  computed_at: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProbabilityProvenanceSchema = createInsertSchema(probabilityProvenanceTable);
export type InsertProbabilityProvenance = z.infer<typeof insertProbabilityProvenanceSchema>;
export type ProbabilityProvenanceRow = typeof probabilityProvenanceTable.$inferSelect;

export const formulaVersionsTable = pgTable("formula_versions", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  metric_code: text("metric_code").notNull(),
  version_number: integer("version_number").notNull().default(1),
  formula: text("formula").notNull(),
  notes: text("notes"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFormulaVersionsSchema = createInsertSchema(formulaVersionsTable);
export type InsertFormulaVersions = z.infer<typeof insertFormulaVersionsSchema>;
export type FormulaVersionsRow = typeof formulaVersionsTable.$inferSelect;

export const overrideRecordsTable = pgTable("override_records", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  entity_table: text("entity_table").notNull(),
  entity_id: uuid("entity_id"),
  match_id: uuid("match_id"),
  audit_run_id: uuid("audit_run_id"),
  field: text("field").notNull(),
  system_value: text("system_value"),
  override_value: text("override_value"),
  reason: text("reason").notNull(),
  requires_admin: boolean("requires_admin").notNull().default(false),
  changed_by: uuid("changed_by").notNull().default(sql`auth.uid()`),
  active: boolean("active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOverrideRecordsSchema = createInsertSchema(overrideRecordsTable);
export type InsertOverrideRecords = z.infer<typeof insertOverrideRecordsSchema>;
export type OverrideRecordsRow = typeof overrideRecordsTable.$inferSelect;

export const generatedReportsTable = pgTable("generated_reports", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  title: text("title").notNull(),
  report_type: text("report_type").notNull().default("PROVISIONAL"),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  template_version: text("template_version").notNull().default("v1"),
  validation: jsonb("validation").notNull().default(sql`'{}'::jsonb`),
  validation_status: text("validation_status").notNull().default("NOT VALIDATED"),
});

export const insertGeneratedReportsSchema = createInsertSchema(generatedReportsTable);
export type InsertGeneratedReports = z.infer<typeof insertGeneratedReportsSchema>;
export type GeneratedReportsRow = typeof generatedReportsTable.$inferSelect;

export const resultGradesTable = pgTable("result_grades", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  match_id: uuid("match_id").notNull(),
  audit_run_id: uuid("audit_run_id"),
  actual_winner: text("actual_winner"),
  result_type: text("result_type").notNull().default("WIN"),
  matrix_predicted_winner: text("matrix_predicted_winner"),
  matrix_wp: numeric("matrix_wp"),
  matrix_prediction_result: text("matrix_prediction_result").notNull().default("NOT GRADED"),
  independent_winner: text("independent_winner"),
  independent_low: numeric("independent_low"),
  independent_high: numeric("independent_high"),
  independent_audit_result: text("independent_audit_result").notNull().default("NOT GRADED"),
  final_selection: text("final_selection"),
  final_selection_result: text("final_selection_result").notNull().default("NOT GRADED"),
  audit_color: text("audit_color"),
  correction_pattern: text("correction_pattern").notNull().default("UNCLASSIFIED"),
  counted_in_matrix_calibration: boolean("counted_in_matrix_calibration").notNull().default(false),
  note: text("note"),
  graded_at: timestamp("graded_at", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertResultGradesSchema = createInsertSchema(resultGradesTable);
export type InsertResultGrades = z.infer<typeof insertResultGradesSchema>;
export type ResultGradesRow = typeof resultGradesTable.$inferSelect;
