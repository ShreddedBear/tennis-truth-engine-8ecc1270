import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "../index";
import { disagreementResultsTable, metricCoverageRatesTable, metricResultsTable, reconstructionResultsTable, resultGradesTable, stressResultsTable, underdogResultsTable, verificationResultsTable } from "../schema";
import type { TruthClient } from "./client";

export async function listMetricResults(client: TruthClient = defaultDb, runId: string) {
  return client.select().from(metricResultsTable).where(eq(metricResultsTable.auditRunId, runId));
}
export async function listVerificationResults(client: TruthClient = defaultDb, runId: string) {
  return client.select().from(verificationResultsTable).where(eq(verificationResultsTable.auditRunId, runId));
}
export async function listMetricCoverage(client: TruthClient = defaultDb, runId: string) {
  return client.select().from(metricCoverageRatesTable).where(eq(metricCoverageRatesTable.auditRunId, runId));
}
export async function listResultGraph(client: TruthClient = defaultDb, runId: string) {
  const [metrics, verification, disagreement, underdog, stress, reconstruction] = await Promise.all([
    client.select().from(metricResultsTable).where(eq(metricResultsTable.auditRunId, runId)),
    client.select().from(verificationResultsTable).where(eq(verificationResultsTable.auditRunId, runId)),
    client.select().from(disagreementResultsTable).where(eq(disagreementResultsTable.auditRunId, runId)),
    client.select().from(underdogResultsTable).where(eq(underdogResultsTable.auditRunId, runId)),
    client.select().from(stressResultsTable).where(eq(stressResultsTable.auditRunId, runId)),
    client.select().from(reconstructionResultsTable).where(eq(reconstructionResultsTable.auditRunId, runId)),
  ]);
  return { metrics, verification, disagreement, underdog, stress, reconstruction };
}
export async function listGrades(client: TruthClient = defaultDb, userId: string, matchId: string) {
  return client.select().from(resultGradesTable).where(and(eq(resultGradesTable.userId, userId), eq(resultGradesTable.matchId, matchId)));
}