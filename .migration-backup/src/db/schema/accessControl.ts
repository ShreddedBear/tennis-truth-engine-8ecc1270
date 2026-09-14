// GENERATED FROM THE LIVE PRODUCTION SCHEMA -- do not hand-edit column types.
//
// Property names are deliberately snake_case, identical to the Postgres column names.
// Drizzle normally maps camelCase properties onto snake_case columns, but this schema
// describes a database that predates it: every row shape in this app is already read as
// `row.usable_coverage_percent`, `row.final_selection`, and so on, across ~200 call sites.
// Keeping the property names equal to the column names makes a Drizzle row and the old
// PostgREST row byte-identical, so the migration changes how a query is BUILT without
// changing what any consumer of the result sees.

import { pgTable, pgEnum, uuid } from "drizzle-orm/pg-core";
import { isoTimestamp } from "../columns";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appRoleEnum = pgEnum("app_role", ["admin", "moderator", "user"]);

export const userRolesTable = pgTable("user_roles", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull(),
  role: appRoleEnum("role").notNull(),
  created_at: isoTimestamp("created_at").notNull().default(sql`now()`),
});

export const insertUserRolesSchema = createInsertSchema(userRolesTable);
export type InsertUserRoles = z.infer<typeof insertUserRolesSchema>;
export type UserRolesRow = typeof userRolesTable.$inferSelect;
