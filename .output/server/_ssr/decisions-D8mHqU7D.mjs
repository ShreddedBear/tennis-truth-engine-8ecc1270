import { _ as uuid, b as jsonb, g as pgTable, k as sql, v as text, w as boolean, x as integer, y as numeric } from "../_libs/drizzle-orm.mjs";
import { n as isoTimestamp } from "./columns-DdiGZMmP.mjs";
import { t as createInsertSchema } from "../_libs/drizzle-zod+zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/decisions-D8mHqU7D.js
var finalDecisionsTable = pgTable("final_decisions", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	audit_run_id: uuid("audit_run_id").notNull(),
	final_audit_color: text("final_audit_color").notNull().default("INCOMPLETE"),
	final_selection: text("final_selection"),
	action: text("action"),
	gate_report: jsonb("gate_report").$type().notNull().default(sql`'{}'::jsonb`),
	completion_percent: numeric("completion_percent", { mode: "number" }).notNull().default(0),
	audit_complete: boolean("audit_complete").notNull().default(false),
	matrix_firewall_valid: boolean("matrix_firewall_valid").notNull().default(true),
	calibration_bucket: text("calibration_bucket"),
	verified_win_rate: numeric("verified_win_rate", { mode: "number" }),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
	updated_at: isoTimestamp("updated_at").notNull().default(sql`now()`),
	selected_player_id: uuid("selected_player_id")
});
var insertFinalDecisionsSchema = createInsertSchema(finalDecisionsTable);
var probabilityMethodsTable = pgTable("probability_methods", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	code: text("code").notNull(),
	version_number: integer("version_number").notNull().default(1),
	label: text("label").notNull(),
	formula: text("formula").notNull(),
	description: text("description"),
	params: jsonb("params").$type().notNull().default(sql`'{}'::jsonb`),
	is_active: boolean("is_active").notNull().default(true),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertProbabilityMethodsSchema = createInsertSchema(probabilityMethodsTable);
var probabilityProvenanceTable = pgTable("probability_provenance", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	audit_run_id: uuid("audit_run_id").notNull(),
	metric_key: text("metric_key").notNull(),
	display_value: text("display_value").notNull(),
	numeric_value: numeric("numeric_value", { mode: "number" }),
	method_code: text("method_code").notNull(),
	method_version: text("method_version").notNull(),
	formula: text("formula").notNull(),
	inputs: jsonb("inputs").$type().notNull().default(sql`'{}'::jsonb`),
	source_refs: jsonb("source_refs").$type().notNull().default(sql`'[]'::jsonb`),
	interpretation_note: text("interpretation_note"),
	computed_at: isoTimestamp("computed_at").notNull().default(sql`now()`)
});
var insertProbabilityProvenanceSchema = createInsertSchema(probabilityProvenanceTable);
var formulaVersionsTable = pgTable("formula_versions", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	metric_code: text("metric_code").notNull(),
	version_number: integer("version_number").notNull().default(1),
	formula: text("formula").notNull(),
	notes: text("notes"),
	is_active: boolean("is_active").notNull().default(true),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertFormulaVersionsSchema = createInsertSchema(formulaVersionsTable);
var overrideRecordsTable = pgTable("override_records", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	entity_table: text("entity_table").notNull(),
	entity_id: uuid("entity_id"),
	match_id: uuid("match_id"),
	audit_run_id: uuid("audit_run_id"),
	field: text("field").notNull(),
	system_value: text("system_value"),
	override_value: text("override_value"),
	reason: text("reason").notNull(),
	requires_admin: boolean("requires_admin").notNull().default(false),
	changed_by: uuid("changed_by").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	active: boolean("active").notNull().default(true),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertOverrideRecordsSchema = createInsertSchema(overrideRecordsTable);
var generatedReportsTable = pgTable("generated_reports", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	title: text("title").notNull(),
	report_type: text("report_type").notNull().default("PROVISIONAL"),
	payload: jsonb("payload").$type().notNull().default(sql`'{}'::jsonb`),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
	template_version: text("template_version").notNull().default("v1"),
	validation: jsonb("validation").$type().notNull().default(sql`'{}'::jsonb`),
	validation_status: text("validation_status").notNull().default("NOT VALIDATED")
});
var insertGeneratedReportsSchema = createInsertSchema(generatedReportsTable);
var resultGradesTable = pgTable("result_grades", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	match_id: uuid("match_id").notNull(),
	audit_run_id: uuid("audit_run_id"),
	actual_winner: text("actual_winner"),
	result_type: text("result_type").notNull().default("WIN"),
	matrix_predicted_winner: text("matrix_predicted_winner"),
	matrix_wp: numeric("matrix_wp", { mode: "number" }),
	matrix_prediction_result: text("matrix_prediction_result").notNull().default("NOT GRADED"),
	independent_winner: text("independent_winner"),
	independent_low: numeric("independent_low", { mode: "number" }),
	independent_high: numeric("independent_high", { mode: "number" }),
	independent_audit_result: text("independent_audit_result").notNull().default("NOT GRADED"),
	final_selection: text("final_selection"),
	final_selection_result: text("final_selection_result").notNull().default("NOT GRADED"),
	audit_color: text("audit_color"),
	correction_pattern: text("correction_pattern").notNull().default("UNCLASSIFIED"),
	counted_in_matrix_calibration: boolean("counted_in_matrix_calibration").notNull().default(false),
	note: text("note"),
	graded_at: isoTimestamp("graded_at").notNull().default(sql`now()`),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
	updated_at: isoTimestamp("updated_at").notNull().default(sql`now()`)
});
var insertResultGradesSchema = createInsertSchema(resultGradesTable);
//#endregion
export { insertFormulaVersionsSchema as a, insertProbabilityMethodsSchema as c, overrideRecordsTable as d, probabilityMethodsTable as f, insertFinalDecisionsSchema as i, insertProbabilityProvenanceSchema as l, resultGradesTable as m, formulaVersionsTable as n, insertGeneratedReportsSchema as o, probabilityProvenanceTable as p, generatedReportsTable as r, insertOverrideRecordsSchema as s, finalDecisionsTable as t, insertResultGradesSchema as u };
