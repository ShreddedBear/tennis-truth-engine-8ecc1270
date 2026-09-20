import { and, asc, eq, inArray } from "drizzle-orm";
import { db as defaultDb } from "../index";
import { metricEvidenceStoreTable, sourceConflictsTable, sourceObservationsTable, sourceSnapshotsTable } from "../schema";
import type { TruthClient } from "./client";

export async function listEvidence(client: TruthClient = defaultDb, metricCode: string, asOfDate?: string) {
  const filters = [eq(metricEvidenceStoreTable.metricCode, metricCode)];
  if (asOfDate) filters.push(eq(metricEvidenceStoreTable.asOfDate, asOfDate));
  return client.select().from(metricEvidenceStoreTable).where(and(...filters)).orderBy(asc(metricEvidenceStoreTable.asOfDate));
}

export async function listSourceObservations(client: TruthClient = defaultDb, sourceId: string, keys: string[]) {
  if (!keys.length) return [];
  return client.select().from(sourceObservationsTable)
    .where(and(eq(sourceObservationsTable.sourceId, sourceId), inArray(sourceObservationsTable.sourceRecordKey, keys)));
}

export async function listSnapshots(client: TruthClient = defaultDb, userId: string, runId: string) {
  return client.select().from(sourceSnapshotsTable)
    .where(and(eq(sourceSnapshotsTable.userId, userId), eq(sourceSnapshotsTable.auditRunId, runId)));
}

export async function listConflicts(client: TruthClient = defaultDb, userId: string, runId: string) {
  return client.select().from(sourceConflictsTable)
    .where(and(eq(sourceConflictsTable.userId, userId), eq(sourceConflictsTable.auditRunId, runId)));
}