import { _ as uuid, g as pgTable, k as sql, v as text, w as boolean, x as integer, y as numeric } from "../_libs/drizzle-orm.mjs";
import { n as isoTimestamp, t as calendarDate } from "./columns-DdiGZMmP.mjs";
import { t as createInsertSchema } from "../_libs/drizzle-zod+zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calibration-BTgOpQAP.js
var calibrationVersionsTable = pgTable("calibration_versions", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	version_number: integer("version_number").notNull().default(1),
	label: text("label").notNull(),
	master_sequence_count: integer("master_sequence_count").notNull().default(0),
	graded_sample_count: integer("graded_sample_count").notNull().default(0),
	is_active: boolean("is_active").notNull().default(false),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertCalibrationVersionsSchema = createInsertSchema(calibrationVersionsTable);
var calibrationBucketsTable = pgTable("calibration_buckets", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	calibration_version_id: uuid("calibration_version_id").notNull(),
	bucket_code: text("bucket_code").notNull(),
	bucket_label: text("bucket_label").notNull(),
	wp_min: numeric("wp_min", { mode: "number" }).notNull(),
	wp_max: numeric("wp_max", { mode: "number" }).notNull(),
	wins: integer("wins").notNull().default(0),
	graded: integer("graded").notNull().default(0),
	small_sample: boolean("small_sample").notNull().default(false),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertCalibrationBucketsSchema = createInsertSchema(calibrationBucketsTable);
var calibrationLedgerTable = pgTable("calibration_ledger", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	master_sequence: integer("master_sequence").notNull(),
	match_id: uuid("match_id"),
	match_label: text("match_label").notNull(),
	tournament: text("tournament"),
	match_date: calendarDate("match_date"),
	surface: text("surface"),
	matrix_predicted_winner: text("matrix_predicted_winner"),
	matrix_wp: numeric("matrix_wp", { mode: "number" }),
	bucket_code: text("bucket_code"),
	actual_winner: text("actual_winner"),
	result_type: text("result_type").notNull().default("UNKNOWN"),
	result_grading_status: text("result_grading_status").notNull().default("PENDING"),
	counted_in_bucket: boolean("counted_in_bucket").notNull().default(false),
	calibration_version_before: uuid("calibration_version_before"),
	calibration_version_after: uuid("calibration_version_after"),
	note: text("note"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertCalibrationLedgerSchema = createInsertSchema(calibrationLedgerTable);
var truthEngineCalibrationObservationsTable = pgTable("truth_engine_calibration_observations", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default("00000000-0000-0000-0000-000000000001"),
	match_id: uuid("match_id").notNull(),
	audit_run_id: uuid("audit_run_id").notNull(),
	slate_id: uuid("slate_id"),
	run_number: integer("run_number").notNull().default(0),
	predicted_at: isoTimestamp("predicted_at"),
	scheduled_date: calendarDate("scheduled_date"),
	player1_name: text("player1_name").notNull(),
	player2_name: text("player2_name").notNull(),
	selected_player: text("selected_player").notNull(),
	decision_outcome: text("decision_outcome").notNull(),
	evidence_support_percent: numeric("evidence_support_percent", { mode: "number" }),
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
	evidence_coverage_percent: numeric("evidence_coverage_percent", { mode: "number" }),
	evidence_coverage_usable: integer("evidence_coverage_usable"),
	evidence_coverage_expected: integer("evidence_coverage_expected"),
	actual_winner: text("actual_winner").notNull(),
	result_status: text("result_status"),
	final_score: text("final_score"),
	prediction_outcome: text("prediction_outcome").notNull(),
	calibration_eligible: boolean("calibration_eligible").notNull().default(false),
	eligibility_reason: text("eligibility_reason"),
	observed_at: isoTimestamp("observed_at").notNull().default(sql`now()`),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
	updated_at: isoTimestamp("updated_at").notNull().default(sql`now()`),
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
	feature_version: text("feature_version")
});
var insertTruthEngineCalibrationObservationsSchema = createInsertSchema(truthEngineCalibrationObservationsTable);
//#endregion
export { insertCalibrationLedgerSchema as a, truthEngineCalibrationObservationsTable as c, insertCalibrationBucketsSchema as i, calibrationLedgerTable as n, insertCalibrationVersionsSchema as o, calibrationVersionsTable as r, insertTruthEngineCalibrationObservationsSchema as s, calibrationBucketsTable as t };
