import { S as doublePrecision, _ as uuid, b as jsonb, g as pgTable, k as sql, v as text, w as boolean, x as integer, y as numeric } from "../_libs/drizzle-orm.mjs";
import { n as isoTimestamp, t as calendarDate } from "./columns-DdiGZMmP.mjs";
import { t as createInsertSchema } from "../_libs/drizzle-zod+zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sources-B3f820Qo.js
var sourceDefinitionsTable = pgTable("source_definitions", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	source_name: text("source_name").notNull(),
	domain: text("domain"),
	category: text("category").notNull().default("TIER 2"),
	priority: integer("priority").notNull().default(100),
	reliability: numeric("reliability", { mode: "number" }).notNull().default(.8),
	supported_data: text("supported_data").array().notNull().default(sql`'{}'::text[]`),
	refresh_minutes: integer("refresh_minutes").notNull().default(1440),
	active: boolean("active").notNull().default(true),
	approved: boolean("approved").notNull().default(true),
	blacklisted: boolean("blacklisted").notNull().default(false),
	blacklist_reason: text("blacklist_reason"),
	last_fetch_at: isoTimestamp("last_fetch_at"),
	error_history: jsonb("error_history").$type().notNull().default(sql`'[]'::jsonb`),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
	access_method: text("access_method").notNull().default("MANUAL"),
	terms_status: text("terms_status").notNull().default("UNKNOWN"),
	terms_url: text("terms_url"),
	quota_per_day: integer("quota_per_day"),
	quota_used: integer("quota_used").notNull().default(0),
	quota_reset_at: isoTimestamp("quota_reset_at"),
	consecutive_failures: integer("consecutive_failures").notNull().default(0),
	health_status: text("health_status").notNull().default("HEALTHY"),
	fallback_source_id: uuid("fallback_source_id")
});
var insertSourceDefinitionsSchema = createInsertSchema(sourceDefinitionsTable);
var sourceObservationsTable = pgTable("source_observations", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id"),
	source_id: text("source_id").notNull(),
	source_name: text("source_name").notNull(),
	source_url: text("source_url"),
	source_record_key: text("source_record_key"),
	player_name: text("player_name"),
	opponent_name: text("opponent_name"),
	tournament: text("tournament"),
	event_date: calendarDate("event_date"),
	surface: text("surface"),
	observation_type: text("observation_type").notNull(),
	observation_key: text("observation_key").notNull(),
	numeric_value: doublePrecision("numeric_value"),
	text_value: text("text_value"),
	unit: text("unit"),
	sample_label: text("sample_label"),
	window_start: calendarDate("window_start"),
	window_end: calendarDate("window_end"),
	retrieved_at: isoTimestamp("retrieved_at").notNull().default(sql`now()`),
	source_published_at: isoTimestamp("source_published_at"),
	raw_payload: jsonb("raw_payload").$type(),
	provenance: jsonb("provenance").$type().notNull().default(sql`'{}'::jsonb`),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertSourceObservationsSchema = createInsertSchema(sourceObservationsTable);
var sourceConflictsTable = pgTable("source_conflicts", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	audit_run_id: uuid("audit_run_id").notNull(),
	data_key: text("data_key").notNull(),
	critical: boolean("critical").notNull().default(false),
	values: jsonb("values").$type().notNull().default(sql`'[]'::jsonb`),
	resolution_status: text("resolution_status").notNull().default("UNRESOLVED"),
	resolution_reason: text("resolution_reason"),
	selected_value: text("selected_value"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertSourceConflictsSchema = createInsertSchema(sourceConflictsTable);
var sourceSnapshotsTable = pgTable("source_snapshots", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	audit_run_id: uuid("audit_run_id").notNull(),
	source_id: uuid("source_id"),
	source_name: text("source_name").notNull(),
	data_key: text("data_key").notNull(),
	player_side: text("player_side"),
	raw_value: text("raw_value"),
	normalized_value: text("normalized_value"),
	retrieved_at: isoTimestamp("retrieved_at").notNull().default(sql`now()`),
	post_start: boolean("post_start").notNull().default(false),
	excluded: boolean("excluded").notNull().default(false),
	reliability: numeric("reliability", { mode: "number" }),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertSourceSnapshotsSchema = createInsertSchema(sourceSnapshotsTable);
var sourceIngestionRunsTable = pgTable("source_ingestion_runs", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	source_id: text("source_id").notNull(),
	job_type: text("job_type").notNull(),
	requested_window_start: calendarDate("requested_window_start"),
	requested_window_end: calendarDate("requested_window_end"),
	status: text("status").notNull().default("QUEUED"),
	records_seen: integer("records_seen").notNull().default(0),
	records_inserted: integer("records_inserted").notNull().default(0),
	records_updated: integer("records_updated").notNull().default(0),
	error_message: text("error_message"),
	metadata: jsonb("metadata").$type().notNull().default(sql`'{}'::jsonb`),
	started_at: isoTimestamp("started_at"),
	completed_at: isoTimestamp("completed_at"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertSourceIngestionRunsSchema = createInsertSchema(sourceIngestionRunsTable);
var sourceHealthEventsTable = pgTable("source_health_events", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	source_id: uuid("source_id"),
	source_name: text("source_name").notNull(),
	audit_run_id: uuid("audit_run_id"),
	data_key: text("data_key"),
	event_type: text("event_type").notNull(),
	http_status: integer("http_status"),
	attempt: integer("attempt").notNull().default(1),
	backoff_ms: integer("backoff_ms"),
	message: text("message"),
	temporary: boolean("temporary").notNull().default(true),
	fallback_used: text("fallback_used"),
	resolved: boolean("resolved").notNull().default(false),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertSourceHealthEventsSchema = createInsertSchema(sourceHealthEventsTable);
var ingestionTargetsTable = pgTable("ingestion_targets", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	source_id: text("source_id").notNull(),
	target_key: text("target_key").notNull(),
	enabled: boolean("enabled").notNull().default(true),
	pullback_start: calendarDate("pullback_start"),
	pullback_end: calendarDate("pullback_end"),
	latitude: doublePrecision("latitude"),
	longitude: doublePrecision("longitude"),
	timezone: text("timezone"),
	tournament: text("tournament"),
	sport_key: text("sport_key"),
	config: jsonb("config").$type().notNull().default(sql`'{}'::jsonb`),
	last_ingested_at: isoTimestamp("last_ingested_at"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
	updated_at: isoTimestamp("updated_at").notNull().default(sql`now()`)
});
var insertIngestionTargetsSchema = createInsertSchema(ingestionTargetsTable);
//#endregion
export { insertSourceHealthEventsSchema as a, insertSourceSnapshotsSchema as c, sourceHealthEventsTable as d, sourceIngestionRunsTable as f, insertSourceDefinitionsSchema as i, sourceConflictsTable as l, sourceSnapshotsTable as m, insertIngestionTargetsSchema as n, insertSourceIngestionRunsSchema as o, sourceObservationsTable as p, insertSourceConflictsSchema as r, insertSourceObservationsSchema as s, ingestionTargetsTable as t, sourceDefinitionsTable as u };
