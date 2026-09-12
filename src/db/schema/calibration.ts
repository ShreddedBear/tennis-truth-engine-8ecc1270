// GENERATED FROM THE LIVE PRODUCTION SCHEMA -- do not hand-edit column types.
//
// Property names are deliberately snake_case, identical to the Postgres column names.
// Drizzle normally maps camelCase properties onto snake_case columns, but this schema
// describes a database that predates it: every row shape in this app is already read as
// `row.usable_coverage_percent`, `row.final_selection`, and so on, across ~200 call sites.
// Keeping the property names equal to the column names makes a Drizzle row and the old
// PostgREST row byte-identical, so the migration changes how a query is BUILT without
// changing what any consumer of the result sees.

import { pgTable, boolean, date, integer, numeric, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const calibrationVersionsTable = pgTable("calibration_versions", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  version_number: integer("version_number").notNull().default(1),
  label: text("label").notNull(),
  master_sequence_count: integer("master_sequence_count").notNull().default(0),
  graded_sample_count: integer("graded_sample_count").notNull().default(0),
  is_active: boolean("is_active").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const insertCalibrationVersionsSchema = createInsertSchema(calibrationVersionsTable);
export type InsertCalibrationVersions = z.infer<typeof insertCalibrationVersionsSchema>;
export type CalibrationVersionsRow = typeof calibrationVersionsTable.$inferSelect;

export const calibrationBucketsTable = pgTable("calibration_buckets", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  calibration_version_id: uuid("calibration_version_id").notNull(),
  bucket_code: text("bucket_code").notNull(),
  bucket_label: text("bucket_label").notNull(),
  wp_min: numeric("wp_min").notNull(),
  wp_max: numeric("wp_max").notNull(),
  wins: integer("wins").notNull().default(0),
  graded: integer("graded").notNull().default(0),
  small_sample: boolean("small_sample").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const insertCalibrationBucketsSchema = createInsertSchema(calibrationBucketsTable);
export type InsertCalibrationBuckets = z.infer<typeof insertCalibrationBucketsSchema>;
export type CalibrationBucketsRow = typeof calibrationBucketsTable.$inferSelect;

export const calibrationLedgerTable = pgTable("calibration_ledger", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  master_sequence: integer("master_sequence").notNull(),
  match_id: uuid("match_id"),
  match_label: text("match_label").notNull(),
  tournament: text("tournament"),
  match_date: date("match_date"),
  surface: text("surface"),
  matrix_predicted_winner: text("matrix_predicted_winner"),
  matrix_wp: numeric("matrix_wp"),
  bucket_code: text("bucket_code"),
  actual_winner: text("actual_winner"),
  result_type: text("result_type").notNull().default("UNKNOWN"),
  result_grading_status: text("result_grading_status").notNull().default("PENDING"),
  counted_in_bucket: boolean("counted_in_bucket").notNull().default(false),
  calibration_version_before: uuid("calibration_version_before"),
  calibration_version_after: uuid("calibration_version_after"),
  note: text("note"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const insertCalibrationLedgerSchema = createInsertSchema(calibrationLedgerTable);
export type InsertCalibrationLedger = z.infer<typeof insertCalibrationLedgerSchema>;
export type CalibrationLedgerRow = typeof calibrationLedgerTable.$inferSelect;

export const truthEngineCalibrationObservationsTable = pgTable("truth_engine_calibration_observations", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default("00000000-0000-0000-0000-000000000001"),
  match_id: uuid("match_id").notNull(),
  audit_run_id: uuid("audit_run_id").notNull(),
  slate_id: uuid("slate_id"),
  run_number: integer("run_number").notNull().default(0),
  predicted_at: timestamp("predicted_at", { withTimezone: true, mode: "string" }),
  scheduled_date: date("scheduled_date"),
  player1_name: text("player1_name").notNull(),
  player2_name: text("player2_name").notNull(),
  selected_player: text("selected_player").notNull(),
  decision_outcome: text("decision_outcome").notNull(),
  evidence_support_percent: numeric("evidence_support_percent"),
  directional_families: integer("directional_families"),
  supporting_families: text("supporting_families").array().notNull().default(sql`'{}'::text[]`),
  contradicting_families: text("contradicting_families").array().notNull().default(sql`'{}'::text[]`),
  neutral_families: text("neutral_families").array().notNull().default(sql`'{}'::text[]`),
  conflicted_families: text("conflicted_families").array().notNull().default(sql`'{}'::text[]`),
  supporting_family_count: integer("supporting_family_count"),
  contradicting_family_count: integer("contradicting_family_count"),
  corroborated: boolean("corroborated"),
  stability: text("stability"),
  verification_result: text("verification_result"),
  disagreement_result: text("disagreement_result"),
  underdog_result: text("underdog_result"),
  stress_result: text("stress_result"),
  evidence_coverage_percent: numeric("evidence_coverage_percent"),
  evidence_coverage_usable: integer("evidence_coverage_usable"),
  evidence_coverage_expected: integer("evidence_coverage_expected"),
  actual_winner: text("actual_winner").notNull(),
  result_status: text("result_status"),
  final_score: text("final_score"),
  prediction_outcome: text("prediction_outcome").notNull(),
  calibration_eligible: boolean("calibration_eligible").notNull().default(false),
  eligibility_reason: text("eligibility_reason"),
  observed_at: timestamp("observed_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  player1_id: uuid("player1_id"),
  player2_id: uuid("player2_id"),
  selected_player_id: uuid("selected_player_id"),
  actual_winner_id: uuid("actual_winner_id"),
  tournament_name: text("tournament_name"),
  surface: text("surface"),
  event_level: text("event_level"),
  metrics_version_id: uuid("metrics_version_id"),
  verification_version_id: uuid("verification_version_id"),
  disagreement_version_id: uuid("disagreement_version_id"),
  calibration_model_version: text("calibration_model_version"),
  feature_version: text("feature_version"),
});

export const insertTruthEngineCalibrationObservationsSchema = createInsertSchema(truthEngineCalibrationObservationsTable);
export type InsertTruthEngineCalibrationObservations = z.infer<typeof insertTruthEngineCalibrationObservationsSchema>;
export type TruthEngineCalibrationObservationsRow = typeof truthEngineCalibrationObservationsTable.$inferSelect;
