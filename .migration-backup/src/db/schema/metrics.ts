// GENERATED FROM THE LIVE PRODUCTION SCHEMA -- do not hand-edit column types.
//
// Property names are deliberately snake_case, identical to the Postgres column names.
// Drizzle normally maps camelCase properties onto snake_case columns, but this schema
// describes a database that predates it: every row shape in this app is already read as
// `row.usable_coverage_percent`, `row.final_selection`, and so on, across ~200 call sites.
// Keeping the property names equal to the column names makes a Drizzle row and the old
// PostgREST row byte-identical, so the migration changes how a query is BUILT without
// changing what any consumer of the result sees.

import { pgTable, boolean, doublePrecision, integer, jsonb, numeric, text, uuid } from "drizzle-orm/pg-core";
import { calendarDate, isoTimestamp } from "../columns";
import { sql } from "drizzle-orm";
import type { JsonValue } from "../json";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const metricRegistryTable = pgTable("metric_registry", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  metric_code: text("metric_code").notNull(),
  metric_name: text("metric_name").notNull(),
  lifecycle_status: text("lifecycle_status").notNull().default("ACTIVE"),
  tour_eligibility: text("tour_eligibility").array().notNull().default(sql`'{}'::text[]`),
  evidence_family: text("evidence_family"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
  updated_at: isoTimestamp("updated_at").notNull().default(sql`now()`),
  user_id: uuid("user_id"),
});

export const insertMetricRegistrySchema = createInsertSchema(metricRegistryTable);
export type InsertMetricRegistry = z.infer<typeof insertMetricRegistrySchema>;
export type MetricRegistryRow = typeof metricRegistryTable.$inferSelect;

export const metricResultsTable = pgTable("metric_results", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  audit_run_id: uuid("audit_run_id").notNull(),
  metric_code: text("metric_code").notNull(),
  metric_name: text("metric_name").notNull(),
  category: text("category"),
  p1_value: text("p1_value"),
  p2_value: text("p2_value"),
  p1_status: text("p1_status").notNull().default("NOT STARTED"),
  p2_status: text("p2_status").notNull().default("NOT STARTED"),
  differential: text("differential"),
  surface_adjusted_diff: text("surface_adjusted_diff"),
  treatment: text("treatment"),
  reliability: numeric("reliability", { mode: "number" }),
  sample: text("sample"),
  sources: jsonb("sources").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  evidence_family: text("evidence_family"),
  matrix_derived: boolean("matrix_derived").notNull().default(false),
  status: text("status").notNull().default("NOT STARTED"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
  p1_treatment: text("p1_treatment").notNull().default("UNAVAILABLE"),
  p2_treatment: text("p2_treatment").notNull().default("UNAVAILABLE"),
  unavailable_reason: text("unavailable_reason"),
  unavailable_detail: text("unavailable_detail"),
  provider_error: text("provider_error"),
  missing_inputs: jsonb("missing_inputs").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  source_attempts: jsonb("source_attempts").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  reconstruction_attempted: boolean("reconstruction_attempted").notNull().default(false),
  reconstruction_reason: text("reconstruction_reason"),
  reconstruction_result: text("reconstruction_result"),
  retrieved_at: isoTimestamp("retrieved_at"),
  p1_unavailable_reason: text("p1_unavailable_reason"),
  p2_unavailable_reason: text("p2_unavailable_reason"),
  p1_provider_error: text("p1_provider_error"),
  p2_provider_error: text("p2_provider_error"),
  p1_retrieved_at: isoTimestamp("p1_retrieved_at"),
  p2_retrieved_at: isoTimestamp("p2_retrieved_at"),
});

export const insertMetricResultsSchema = createInsertSchema(metricResultsTable);
export type InsertMetricResults = z.infer<typeof insertMetricResultsSchema>;
export type MetricResultsRow = typeof metricResultsTable.$inferSelect;

export const metricCoverageRatesTable = pgTable("metric_coverage_rates", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  metric_code: text("metric_code").notNull(),
  player_side: text("player_side").notNull(),
  treatment: text("treatment").notNull(),
  audit_run_id: uuid("audit_run_id").notNull(),
  usable: boolean("usable").notNull().default(false),
  recorded_at: isoTimestamp("recorded_at").notNull().default(sql`now()`),
  user_id: uuid("user_id"),
});

export const insertMetricCoverageRatesSchema = createInsertSchema(metricCoverageRatesTable);
export type InsertMetricCoverageRates = z.infer<typeof insertMetricCoverageRatesSchema>;
export type MetricCoverageRatesRow = typeof metricCoverageRatesTable.$inferSelect;

export const metricEvidenceStoreTable = pgTable("metric_evidence_store", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id"),
  metric_code: text("metric_code").notNull(),
  metric_name: text("metric_name").notNull(),
  player_name: text("player_name").notNull(),
  opponent_name: text("opponent_name"),
  tournament: text("tournament"),
  surface: text("surface"),
  as_of_date: calendarDate("as_of_date").notNull(),
  treatment: text("treatment").notNull(),
  value_text: text("value_text"),
  reliability: doublePrecision("reliability"),
  sample_label: text("sample_label"),
  evidence_family: text("evidence_family"),
  source_ids: text("source_ids").array().notNull().default(sql`'{}'::text[]`),
  sources: jsonb("sources").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  input_observation_ids: uuid("input_observation_ids").array().notNull().default(sql`'{}'::uuid[]`),
  formula: text("formula"),
  unavailable_reason: text("unavailable_reason"),
  valid_from: calendarDate("valid_from"),
  valid_until: isoTimestamp("valid_until"),
  computed_at: isoTimestamp("computed_at").notNull().default(sql`now()`),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
  updated_at: isoTimestamp("updated_at").notNull().default(sql`now()`),
});

export const insertMetricEvidenceStoreSchema = createInsertSchema(metricEvidenceStoreTable);
export type InsertMetricEvidenceStore = z.infer<typeof insertMetricEvidenceStoreSchema>;
export type MetricEvidenceStoreRow = typeof metricEvidenceStoreTable.$inferSelect;

export const evidenceFamilyCoverageTable = pgTable("evidence_family_coverage", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  audit_run_id: uuid("audit_run_id").notNull(),
  family_code: text("family_code").notNull(),
  family_label: text("family_label").notNull(),
  critical: boolean("critical").notNull().default(true),
  required_min: integer("required_min").notNull().default(1),
  covered_count: integer("covered_count").notNull().default(0),
  unavailable_count: integer("unavailable_count").notNull().default(0),
  p1_covered: integer("p1_covered").notNull().default(0),
  p2_covered: integer("p2_covered").notNull().default(0),
  coverage_status: text("coverage_status").notNull().default("MISSING"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
});

export const insertEvidenceFamilyCoverageSchema = createInsertSchema(evidenceFamilyCoverageTable);
export type InsertEvidenceFamilyCoverage = z.infer<typeof insertEvidenceFamilyCoverageSchema>;
export type EvidenceFamilyCoverageRow = typeof evidenceFamilyCoverageTable.$inferSelect;
