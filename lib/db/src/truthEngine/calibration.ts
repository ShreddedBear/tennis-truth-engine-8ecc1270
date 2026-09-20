import { and, asc, desc, eq } from "drizzle-orm";
import { db as defaultDb } from "../index";
import { calibrationBucketsTable, calibrationLedgerTable, calibrationVersionsTable, truthEngineCalibrationObservationsTable } from "../schema";
import type { TruthClient } from "./client";

export async function getCalibration(client: TruthClient = defaultDb, userId: string, versionId?: string) {
  const versions = await client.select().from(calibrationVersionsTable).where(and(
    eq(calibrationVersionsTable.userId, userId),
    versionId ? eq(calibrationVersionsTable.id, versionId) : eq(calibrationVersionsTable.isActive, true),
  )).orderBy(desc(calibrationVersionsTable.versionNumber)).limit(1);
  const version = versions[0] ?? null;
  const buckets = version ? await client.select().from(calibrationBucketsTable)
    .where(and(eq(calibrationBucketsTable.userId, userId), eq(calibrationBucketsTable.calibrationVersionId, version.id)))
    .orderBy(asc(calibrationBucketsTable.wpMin)) : [];
  return { version, buckets };
}
export async function listCalibrationObservations(client: TruthClient = defaultDb, userId: string, matchId: string) {
  return client.select().from(truthEngineCalibrationObservationsTable)
    .where(and(eq(truthEngineCalibrationObservationsTable.userId, userId), eq(truthEngineCalibrationObservationsTable.matchId, matchId)))
    .orderBy(desc(truthEngineCalibrationObservationsTable.observedAt));
}
export async function listCalibrationLedger(client: TruthClient = defaultDb, userId: string) {
  return client.select().from(calibrationLedgerTable).where(eq(calibrationLedgerTable.userId, userId))
    .orderBy(asc(calibrationLedgerTable.masterSequence));
}