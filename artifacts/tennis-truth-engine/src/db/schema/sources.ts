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

export const sourceDefinitionsTable = pgTable("source_definitions", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  source_name: text("source_name").notNull(),
  domain: text("domain"),
  category: text("category").notNull().default("TIER 2"),
  priority: integer("priority").notNull().default(100),
  reliability: numeric("reliability", { mode: "number" }).notNull().default(0.8),
  supported_data: text("supported_data").array().notNull().default(sql`'{}'::text[]`),
  refresh_minutes: integer("refresh_minutes").notNull().default(1440),
  active: boolean("active").notNull().default(true),
  approved: boolean("approved").notNull().default(true),
  blacklisted: boolean("blacklisted").notNull().default(false),
  blacklist_reason: text("blacklist_reason"),
  last_fetch_at: isoTimestamp("last_fetch_at"),
  error_history: jsonb("error_history").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
  access_method: text("access_method").notNull().default("MANUAL"),
  terms_status: text("terms_status").notNull().default("UNKNOWN"),
  terms_url: text("terms_url"),
  quota_per_day: integer("quota_per_day"),
  quota_used: integer("quota_used").notNull().default(0),
  quota_reset_at: isoTimestamp("quota_reset_at"),
  consecutive_failures: integer("consecutive_failures").notNull().default(0),
  health_status: text("health_status").notNull().default("HEALTHY"),
  fallback_source_id: uuid("fallback_source_id"),
});

export const insertSourceDefinitionsSchema = createInsertSchema(sourceDefinitionsTable);
export type InsertSourceDefinitions = z.infer<typeof insertSourceDefinitionsSchema>;
export type SourceDefinitionsRow = typeof sourceDefinitionsTable.$inferSelect;

export const sourceObservationsTable = pgTable("source_observations", {
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
  raw_payload: jsonb("raw_payload").$type<JsonValue>(),
  provenance: jsonb("provenance").$type<JsonValue>().notNull().default(sql`'{}'::jsonb`),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
});

export const insertSourceObservationsSchema = createInsertSchema(sourceObservationsTable);
export type InsertSourceObservations = z.infer<typeof insertSourceObservationsSchema>;
export type SourceObservationsRow = typeof sourceObservationsTable.$inferSelect;

export const sourceConflictsTable = pgTable("source_conflicts", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  audit_run_id: uuid("audit_run_id").notNull(),
  data_key: text("data_key").notNull(),
  critical: boolean("critical").notNull().default(false),
  values: jsonb("values").$type<JsonValue>().notNull().default(sql`'[]'::jsonb`),
  resolution_status: text("resolution_status").notNull().default("UNRESOLVED"),
  resolution_reason: text("resolution_reason"),
  selected_value: text("selected_value"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
});

export const insertSourceConflictsSchema = createInsertSchema(sourceConflictsTable);
export type InsertSourceConflicts = z.infer<typeof insertSourceConflictsSchema>;
export type SourceConflictsRow = typeof sourceConflictsTable.$inferSelect;

export const sourceSnapshotsTable = pgTable("source_snapshots", {
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
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
});

export const insertSourceSnapshotsSchema = createInsertSchema(sourceSnapshotsTable);
export type InsertSourceSnapshots = z.infer<typeof insertSourceSnapshotsSchema>;
export type SourceSnapshotsRow = typeof sourceSnapshotsTable.$inferSelect;

export const sourceIngestionRunsTable = pgTable("source_ingestion_runs", {
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
  metadata: jsonb("metadata").$type<JsonValue>().notNull().default(sql`'{}'::jsonb`),
  started_at: isoTimestamp("started_at"),
  completed_at: isoTimestamp("completed_at"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
});

export const insertSourceIngestionRunsSchema = createInsertSchema(sourceIngestionRunsTable);
export type InsertSourceIngestionRuns = z.infer<typeof insertSourceIngestionRunsSchema>;
export type SourceIngestionRunsRow = typeof sourceIngestionRunsTable.$inferSelect;

export const sourceHealthEventsTable = pgTable("source_health_events", {
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
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
});

export const insertSourceHealthEventsSchema = createInsertSchema(sourceHealthEventsTable);
export type InsertSourceHealthEvents = z.infer<typeof insertSourceHealthEventsSchema>;
export type SourceHealthEventsRow = typeof sourceHealthEventsTable.$inferSelect;

export const ingestionTargetsTable = pgTable("ingestion_targets", {
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
  config: jsonb("config").$type<JsonValue>().notNull().default(sql`'{}'::jsonb`),
  last_ingested_at: isoTimestamp("last_ingested_at"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
  updated_at: isoTimestamp("updated_at").notNull().default(sql`now()`),
});

export const insertIngestionTargetsSchema = createInsertSchema(ingestionTargetsTable);
export type InsertIngestionTargets = z.infer<typeof insertIngestionTargetsSchema>;
export type IngestionTargetsRow = typeof ingestionTargetsTable.$inferSelect;
