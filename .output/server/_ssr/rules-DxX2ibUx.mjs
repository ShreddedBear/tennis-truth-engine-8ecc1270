import { _ as uuid, b as jsonb, g as pgTable, k as sql, v as text, w as boolean, x as integer, y as numeric } from "../_libs/drizzle-orm.mjs";
import { n as isoTimestamp } from "./columns-DdiGZMmP.mjs";
import { t as createInsertSchema } from "../_libs/drizzle-zod+zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rules-DxX2ibUx.js
var rulesTable = pgTable("rules", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	version_id: uuid("version_id").notNull(),
	rule_code: text("rule_code").notNull(),
	rule_name: text("rule_name").notNull(),
	category: text("category"),
	body: text("body"),
	severity: text("severity").notNull().default("STANDARD"),
	blocking: boolean("blocking").notNull().default(false),
	mapping_status: text("mapping_status").notNull().default("REQUIRES HUMAN RULE MAPPING"),
	machine_logic: jsonb("machine_logic").$type(),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertRulesSchema = createInsertSchema(rulesTable);
var ruleDocumentsTable = pgTable("rule_documents", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	doc_type: text("doc_type").notNull(),
	title: text("title").notNull(),
	active_version_id: uuid("active_version_id"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertRuleDocumentsSchema = createInsertSchema(ruleDocumentsTable);
var ruleDocumentVersionsTable = pgTable("rule_document_versions", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
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
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertRuleDocumentVersionsSchema = createInsertSchema(ruleDocumentVersionsTable);
//#endregion
export { ruleDocumentsTable as a, ruleDocumentVersionsTable as i, insertRuleDocumentsSchema as n, rulesTable as o, insertRulesSchema as r, insertRuleDocumentVersionsSchema as t };
