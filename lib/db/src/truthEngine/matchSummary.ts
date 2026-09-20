import { and, asc, desc, eq } from "drizzle-orm";
import { db as defaultDb } from "../index";
import {
  matchesTable,
  parsedSummaryFieldsTable,
  summaryUploadsTable,
  summaryVersionsTable,
} from "../schema";
import { inTruthTransaction, type TruthClient } from "./client";

export async function getMatch(client: TruthClient = defaultDb, userId: string, matchId: string) {
  const rows = await client.select().from(matchesTable)
    .where(and(eq(matchesTable.userId, userId), eq(matchesTable.id, matchId))).limit(1);
  return rows[0] ?? null;
}

export async function getActiveSummaryFields(client: TruthClient = defaultDb, userId: string, matchId: string) {
  const versions = await client.select({ id: summaryVersionsTable.id })
    .from(summaryVersionsTable)
    .where(and(eq(summaryVersionsTable.userId, userId), eq(summaryVersionsTable.matchId, matchId), eq(summaryVersionsTable.isActive, true)))
    .limit(1);
  if (!versions[0]) return {};
  const fields = await client.select({
    fieldKey: parsedSummaryFieldsTable.fieldKey,
    rawValue: parsedSummaryFieldsTable.rawValue,
    normalizedValue: parsedSummaryFieldsTable.normalizedValue,
  }).from(parsedSummaryFieldsTable).where(eq(parsedSummaryFieldsTable.summaryVersionId, versions[0].id));
  return Object.fromEntries(fields.flatMap((field) => {
    const value = field.normalizedValue ?? field.rawValue;
    return value ? [[field.fieldKey, value]] : [];
  }));
}

export async function findLatestSummaryVersion(client: TruthClient = defaultDb, userId: string, matchId: string) {
  const rows = await client.select().from(summaryVersionsTable)
    .where(and(eq(summaryVersionsTable.userId, userId), eq(summaryVersionsTable.matchId, matchId)))
    .orderBy(desc(summaryVersionsTable.versionNumber)).limit(1);
  return rows[0] ?? null;
}

export async function createSummaryUpload(client: TruthClient = defaultDb, userId: string, input: typeof summaryUploadsTable.$inferInsert) {
  const rows = await client.insert(summaryUploadsTable).values({ ...input, userId }).returning();
  return rows[0];
}

export async function createSummaryVersion(client: TruthClient = defaultDb, userId: string, input: typeof summaryVersionsTable.$inferInsert) {
  return inTruthTransaction(client, async (tx) => {
    const previous = await tx.select({ versionNumber: summaryVersionsTable.versionNumber })
      .from(summaryVersionsTable)
      .where(and(eq(summaryVersionsTable.userId, userId), eq(summaryVersionsTable.matchId, input.matchId)))
      .orderBy(desc(summaryVersionsTable.versionNumber)).limit(1);
    await tx.update(summaryVersionsTable).set({ isActive: false })
      .where(and(eq(summaryVersionsTable.userId, userId), eq(summaryVersionsTable.matchId, input.matchId)));
    const rows = await tx.insert(summaryVersionsTable).values({
      ...input, userId, versionNumber: input.versionNumber ?? (previous[0]?.versionNumber ?? 0) + 1, isActive: true,
    }).returning();
    return rows[0];
  });
}