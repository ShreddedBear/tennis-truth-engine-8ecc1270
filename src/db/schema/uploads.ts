// GENERATED FROM THE LIVE PRODUCTION SCHEMA -- do not hand-edit column types.
//
// Property names are deliberately snake_case, identical to the Postgres column names.
// Drizzle normally maps camelCase properties onto snake_case columns, but this schema
// describes a database that predates it: every row shape in this app is already read as
// `row.usable_coverage_percent`, `row.final_selection`, and so on, across ~200 call sites.
// Keeping the property names equal to the column names makes a Drizzle row and the old
// PostgREST row byte-identical, so the migration changes how a query is BUILT without
// changing what any consumer of the result sees.

import { pgTable, boolean, integer, numeric, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const summaryUploadsTable = pgTable("summary_uploads", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  filename: text("filename").notNull(),
  page_count: integer("page_count"),
  parse_status: text("parse_status").notNull().default("NOT STARTED"),
  raw_text: text("raw_text"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  pages_processed: integer("pages_processed").notNull().default(0),
  pages_vision: integer("pages_vision").notNull().default(0),
  pages_failed: integer("pages_failed").notNull().default(0),
  extraction_status: text("extraction_status").notNull().default("PENDING"),
});

export const insertSummaryUploadsSchema = createInsertSchema(summaryUploadsTable);
export type InsertSummaryUploads = z.infer<typeof insertSummaryUploadsSchema>;
export type SummaryUploadsRow = typeof summaryUploadsTable.$inferSelect;

export const summaryVersionsTable = pgTable("summary_versions", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  match_id: uuid("match_id").notNull(),
  upload_id: uuid("upload_id").notNull(),
  version_number: integer("version_number").notNull().default(1),
  page_number: integer("page_number"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const insertSummaryVersionsSchema = createInsertSchema(summaryVersionsTable);
export type InsertSummaryVersions = z.infer<typeof insertSummaryVersionsSchema>;
export type SummaryVersionsRow = typeof summaryVersionsTable.$inferSelect;

export const summaryPagesTable = pgTable("summary_pages", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  upload_id: uuid("upload_id").notNull(),
  page_number: integer("page_number").notNull(),
  extraction_method: text("extraction_method").notNull().default("TEXT"),
  char_count: integer("char_count").notNull().default(0),
  confidence: numeric("confidence"),
  status: text("status").notNull().default("COMPLETE"),
  note: text("note"),
  text_content: text("text_content"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const insertSummaryPagesSchema = createInsertSchema(summaryPagesTable);
export type InsertSummaryPages = z.infer<typeof insertSummaryPagesSchema>;
export type SummaryPagesRow = typeof summaryPagesTable.$inferSelect;

export const parsedSummaryFieldsTable = pgTable("parsed_summary_fields", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  summary_version_id: uuid("summary_version_id").notNull(),
  field_key: text("field_key").notNull(),
  raw_value: text("raw_value"),
  normalized_value: text("normalized_value"),
  extraction_status: text("extraction_status").notNull().default("DIRECT"),
  confidence: numeric("confidence"),
  corrected: boolean("corrected").notNull().default(false),
  page_number: integer("page_number"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const insertParsedSummaryFieldsSchema = createInsertSchema(parsedSummaryFieldsTable);
export type InsertParsedSummaryFields = z.infer<typeof insertParsedSummaryFieldsSchema>;
export type ParsedSummaryFieldsRow = typeof parsedSummaryFieldsTable.$inferSelect;
