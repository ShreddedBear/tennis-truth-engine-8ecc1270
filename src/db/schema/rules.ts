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
import type { JsonValue } from "../json";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rulesTable = pgTable("rules", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  version_id: uuid("version_id").notNull(),
  rule_code: text("rule_code").notNull(),
  rule_name: text("rule_name").notNull(),
  category: text("category"),
  body: text("body"),
  severity: text("severity").notNull().default("STANDARD"),
  blocking: boolean("blocking").notNull().default(false),
  mapping_status: text("mapping_status").notNull().default("REQUIRES HUMAN RULE MAPPING"),
  machine_logic: jsonb("machine_logic").$type<JsonValue>(),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const insertRulesSchema = createInsertSchema(rulesTable);
export type InsertRules = z.infer<typeof insertRulesSchema>;
export type RulesRow = typeof rulesTable.$inferSelect;

export const ruleDocumentsTable = pgTable("rule_documents", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  doc_type: text("doc_type").notNull(),
  title: text("title").notNull(),
  active_version_id: uuid("active_version_id"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const insertRuleDocumentsSchema = createInsertSchema(ruleDocumentsTable);
export type InsertRuleDocuments = z.infer<typeof insertRuleDocumentsSchema>;
export type RuleDocumentsRow = typeof ruleDocumentsTable.$inferSelect;

export const ruleDocumentVersionsTable = pgTable("rule_document_versions", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().default(sql`COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)`),
  document_id: uuid("document_id").notNull(),
  version_number: integer("version_number").notNull().default(1),
  source_filename: text("source_filename"),
  raw_text: text("raw_text"),
  pages_detected: integer("pages_detected"),
  headings_detected: integer("headings_detected"),
  expected_rules: integer("expected_rules").notNull().default(0),
  parsed_rules: integer("parsed_rules").notNull().default(0),
  unmapped_rules: integer("unmapped_rules").notNull().default(0),
  parser_confidence: numeric("parser_confidence", { mode: "number" }),
  activation_status: text("activation_status").notNull().default("BLOCKED"),
  is_active: boolean("is_active").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const insertRuleDocumentVersionsSchema = createInsertSchema(ruleDocumentVersionsTable);
export type InsertRuleDocumentVersions = z.infer<typeof insertRuleDocumentVersionsSchema>;
export type RuleDocumentVersionsRow = typeof ruleDocumentVersionsTable.$inferSelect;
