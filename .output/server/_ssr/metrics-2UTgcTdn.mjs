import { S as doublePrecision, _ as uuid, b as jsonb, g as pgTable, k as sql, v as text, w as boolean, x as integer, y as numeric } from "../_libs/drizzle-orm.mjs";
import { n as isoTimestamp, t as calendarDate } from "./columns-DdiGZMmP.mjs";
import { t as createInsertSchema } from "../_libs/drizzle-zod+zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/metrics-2UTgcTdn.js
var metricRegistryTable = pgTable("metric_registry", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	metric_code: text("metric_code").notNull(),
	metric_name: text("metric_name").notNull(),
	lifecycle_status: text("lifecycle_status").notNull().default("ACTIVE"),
	tour_eligibility: text("tour_eligibility").array().notNull().default(sql`'{}'::text[]`),
	evidence_family: text("evidence_family"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
	updated_at: isoTimestamp("updated_at").notNull().default(sql`now()`),
	user_id: uuid("user_id")
});
var insertMetricRegistrySchema = createInsertSchema(metricRegistryTable);
var metricResultsTable = pgTable("metric_results", {
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
	sources: jsonb("sources").$type().notNull().default(sql`'[]'::jsonb`),
	evidence_family: text("evidence_family"),
	matrix_derived: boolean("matrix_derived").notNull().default(false),
	status: text("status").notNull().default("NOT STARTED"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
	p1_treatment: text("p1_treatment").notNull().default("UNAVAILABLE"),
	p2_treatment: text("p2_treatment").notNull().default("UNAVAILABLE"),
	unavailable_reason: text("unavailable_reason"),
	unavailable_detail: text("unavailable_detail"),
	provider_error: text("provider_error"),
	missing_inputs: jsonb("missing_inputs").$type().notNull().default(sql`'[]'::jsonb`),
	source_attempts: jsonb("source_attempts").$type().notNull().default(sql`'[]'::jsonb`),
	reconstruction_attempted: boolean("reconstruction_attempted").notNull().default(false),
	reconstruction_reason: text("reconstruction_reason"),
	reconstruction_result: text("reconstruction_result"),
	retrieved_at: isoTimestamp("retrieved_at"),
	p1_unavailable_reason: text("p1_unavailable_reason"),
	p2_unavailable_reason: text("p2_unavailable_reason"),
	p1_provider_error: text("p1_provider_error"),
	p2_provider_error: text("p2_provider_error"),
	p1_retrieved_at: isoTimestamp("p1_retrieved_at"),
	p2_retrieved_at: isoTimestamp("p2_retrieved_at")
});
var insertMetricResultsSchema = createInsertSchema(metricResultsTable);
var metricCoverageRatesTable = pgTable("metric_coverage_rates", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	metric_code: text("metric_code").notNull(),
	player_side: text("player_side").notNull(),
	treatment: text("treatment").notNull(),
	audit_run_id: uuid("audit_run_id").notNull(),
	usable: boolean("usable").notNull().default(false),
	recorded_at: isoTimestamp("recorded_at").notNull().default(sql`now()`),
	user_id: uuid("user_id")
});
var insertMetricCoverageRatesSchema = createInsertSchema(metricCoverageRatesTable);
var metricEvidenceStoreTable = pgTable("metric_evidence_store", {
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
	sources: jsonb("sources").$type().notNull().default(sql`'[]'::jsonb`),
	input_observation_ids: uuid("input_observation_ids").array().notNull().default(sql`'{}'::uuid[]`),
	formula: text("formula"),
	unavailable_reason: text("unavailable_reason"),
	valid_from: calendarDate("valid_from"),
	valid_until: isoTimestamp("valid_until"),
	computed_at: isoTimestamp("computed_at").notNull().default(sql`now()`),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
	updated_at: isoTimestamp("updated_at").notNull().default(sql`now()`)
});
var insertMetricEvidenceStoreSchema = createInsertSchema(metricEvidenceStoreTable);
var evidenceFamilyCoverageTable = pgTable("evidence_family_coverage", {
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
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertEvidenceFamilyCoverageSchema = createInsertSchema(evidenceFamilyCoverageTable);
//#endregion
export { insertMetricRegistrySchema as a, metricEvidenceStoreTable as c, insertMetricEvidenceStoreSchema as i, metricRegistryTable as l, insertEvidenceFamilyCoverageSchema as n, insertMetricResultsSchema as o, insertMetricCoverageRatesSchema as r, metricCoverageRatesTable as s, evidenceFamilyCoverageTable as t, metricResultsTable as u };
