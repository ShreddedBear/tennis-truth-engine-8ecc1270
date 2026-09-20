import { and, asc, eq } from "drizzle-orm";
import { db as defaultDb } from "../index";
import { ruleDocumentsTable, ruleDocumentVersionsTable, rulesTable } from "../schema";
import type { TruthClient } from "./client";

export async function getActiveRuleVersion(client: TruthClient = defaultDb, userId: string, docType: string) {
  const rows = await client.select({ activeVersionId: ruleDocumentsTable.activeVersionId })
    .from(ruleDocumentsTable).where(and(eq(ruleDocumentsTable.userId, userId), eq(ruleDocumentsTable.docType, docType))).limit(1);
  return rows[0]?.activeVersionId ?? null;
}
export async function listRules(client: TruthClient = defaultDb, userId: string, versionId: string) {
  return client.select().from(rulesTable)
    .where(and(eq(rulesTable.userId, userId), eq(rulesTable.versionId, versionId))).orderBy(asc(rulesTable.ruleCode));
}
export async function listRuleVersions(client: TruthClient = defaultDb, userId: string, documentId: string) {
  return client.select().from(ruleDocumentVersionsTable)
    .where(and(eq(ruleDocumentVersionsTable.userId, userId), eq(ruleDocumentVersionsTable.ruleDocumentId, documentId)))
    .orderBy(asc(ruleDocumentVersionsTable.version));
}