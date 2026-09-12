// GENERATED FROM THE LIVE PRODUCTION SCHEMA -- do not hand-edit column types.
//
// Property names are deliberately snake_case, identical to the Postgres column names.
// Drizzle normally maps camelCase properties onto snake_case columns, but this schema
// describes a database that predates it: every row shape in this app is already read as
// `row.usable_coverage_percent`, `row.final_selection`, and so on, across ~200 call sites.
// Keeping the property names equal to the column names makes a Drizzle row and the old
// PostgREST row byte-identical, so the migration changes how a query is BUILT without
// changing what any consumer of the result sees.

import { pgTable, boolean, integer, text, uuid } from "drizzle-orm/pg-core";
import { calendarDate, isoTimestamp } from "../columns";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchesTable = pgTable("matches", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  canonical_key: text("canonical_key").notNull(),
  player1_name: text("player1_name").notNull(),
  player2_name: text("player2_name").notNull(),
  player1_id: uuid("player1_id"),
  player2_id: uuid("player2_id"),
  tournament_id: uuid("tournament_id"),
  tournament_name: text("tournament_name"),
  event_level: text("event_level"),
  round: text("round"),
  scheduled_date: calendarDate("scheduled_date"),
  surface: text("surface"),
  indoor: boolean("indoor"),
  best_of: integer("best_of"),
  identity_status: text("identity_status").notNull().default("UNVERIFIED"),
  surface_status: text("surface_status").notNull().default("UNVERIFIED"),
  match_status: text("match_status").notNull().default("RUNNING"),
  active_summary_version_id: uuid("active_summary_version_id"),
  result_status: text("result_status").notNull().default("UNKNOWN"),
  actual_winner: text("actual_winner"),
  final_score: text("final_score"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
  updated_at: isoTimestamp("updated_at").notNull().default(sql`now()`),
  tournament_timezone: text("tournament_timezone"),
  scheduled_local_at: isoTimestamp("scheduled_local_at"),
  scheduled_utc_at: isoTimestamp("scheduled_utc_at"),
  actual_first_serve_at: isoTimestamp("actual_first_serve_at"),
  result_recorded_at: isoTimestamp("result_recorded_at"),
  slate_id: uuid("slate_id"),
});

export const insertMatchesSchema = createInsertSchema(matchesTable);
export type InsertMatches = z.infer<typeof insertMatchesSchema>;
export type MatchesRow = typeof matchesTable.$inferSelect;

export const playersTable = pgTable("players", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  canonical_name: text("canonical_name").notNull(),
  normalized_key: text("normalized_key").notNull(),
  tour: text("tour"),
  aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
});

export const insertPlayersSchema = createInsertSchema(playersTable);
export type InsertPlayers = z.infer<typeof insertPlayersSchema>;
export type PlayersRow = typeof playersTable.$inferSelect;

export const tournamentsTable = pgTable("tournaments", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  name: text("name").notNull(),
  edition_year: integer("edition_year"),
  event_level: text("event_level"),
  surface: text("surface"),
  indoor: boolean("indoor"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
});

export const insertTournamentsSchema = createInsertSchema(tournamentsTable);
export type InsertTournaments = z.infer<typeof insertTournamentsSchema>;
export type TournamentsRow = typeof tournamentsTable.$inferSelect;

export const matchIdentityRecordsTable = pgTable("match_identity_records", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
  match_id: uuid("match_id").notNull(),
  field: text("field").notNull(),
  claimed_value: text("claimed_value"),
  verified_value: text("verified_value"),
  status: text("status").notNull().default("NOT STARTED"),
  note: text("note"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
});

export const insertMatchIdentityRecordsSchema = createInsertSchema(matchIdentityRecordsTable);
export type InsertMatchIdentityRecords = z.infer<typeof insertMatchIdentityRecordsSchema>;
export type MatchIdentityRecordsRow = typeof matchIdentityRecordsTable.$inferSelect;

export const predictionSlatesTable = pgTable("prediction_slates", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default("00000000-0000-0000-0000-000000000001"),
  slate_number: integer("slate_number").notNull(),
  label: text("label"),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
  retired_at: isoTimestamp("retired_at"),
  retired_reason: text("retired_reason"),
});

export const insertPredictionSlatesSchema = createInsertSchema(predictionSlatesTable);
export type InsertPredictionSlates = z.infer<typeof insertPredictionSlatesSchema>;
export type PredictionSlatesRow = typeof predictionSlatesTable.$inferSelect;
