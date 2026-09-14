import { _ as uuid, g as pgTable, k as sql, v as text, w as boolean, x as integer, y as numeric } from "../_libs/drizzle-orm.mjs";
import { n as isoTimestamp } from "./columns-DdiGZMmP.mjs";
import { t as createInsertSchema } from "../_libs/drizzle-zod+zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/uploads-vW6NguTg.js
var summaryUploadsTable = pgTable("summary_uploads", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	filename: text("filename").notNull(),
	page_count: integer("page_count"),
	parse_status: text("parse_status").notNull().default("NOT STARTED"),
	raw_text: text("raw_text"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
	pages_processed: integer("pages_processed").notNull().default(0),
	pages_vision: integer("pages_vision").notNull().default(0),
	pages_failed: integer("pages_failed").notNull().default(0),
	extraction_status: text("extraction_status").notNull().default("PENDING")
});
var insertSummaryUploadsSchema = createInsertSchema(summaryUploadsTable);
var summaryVersionsTable = pgTable("summary_versions", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	match_id: uuid("match_id").notNull(),
	upload_id: uuid("upload_id").notNull(),
	version_number: integer("version_number").notNull().default(1),
	page_number: integer("page_number"),
	is_active: boolean("is_active").notNull().default(true),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertSummaryVersionsSchema = createInsertSchema(summaryVersionsTable);
var summaryPagesTable = pgTable("summary_pages", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	upload_id: uuid("upload_id").notNull(),
	page_number: integer("page_number").notNull(),
	extraction_method: text("extraction_method").notNull().default("TEXT"),
	char_count: integer("char_count").notNull().default(0),
	confidence: numeric("confidence", { mode: "number" }),
	status: text("status").notNull().default("COMPLETE"),
	note: text("note"),
	text_content: text("text_content"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertSummaryPagesSchema = createInsertSchema(summaryPagesTable);
var parsedSummaryFieldsTable = pgTable("parsed_summary_fields", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull().default(sql`'00000000-0000-0000-0000-000000000001'::uuid`),
	summary_version_id: uuid("summary_version_id").notNull(),
	field_key: text("field_key").notNull(),
	raw_value: text("raw_value"),
	normalized_value: text("normalized_value"),
	extraction_status: text("extraction_status").notNull().default("DIRECT"),
	confidence: numeric("confidence", { mode: "number" }),
	corrected: boolean("corrected").notNull().default(false),
	page_number: integer("page_number"),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertParsedSummaryFieldsSchema = createInsertSchema(parsedSummaryFieldsTable);
//#endregion
export { parsedSummaryFieldsTable as a, summaryVersionsTable as c, insertSummaryVersionsSchema as i, insertSummaryPagesSchema as n, summaryPagesTable as o, insertSummaryUploadsSchema as r, summaryUploadsTable as s, insertParsedSummaryFieldsSchema as t };
