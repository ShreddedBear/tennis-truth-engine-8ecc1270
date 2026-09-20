import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "../index";
import { ingestionTargetsTable, sourceIngestionRunsTable } from "../schema";
import type { TruthClient } from "./client";

export async function listEnabledTargets(client: TruthClient = defaultDb, sourceId: string) {
  return client.select().from(ingestionTargetsTable)
    .where(and(eq(ingestionTargetsTable.sourceId, sourceId), eq(ingestionTargetsTable.enabled, true)));
}
export async function startIngestionRun(client: TruthClient = defaultDb, sourceId: string, jobType: string) {
  const rows = await client.insert(sourceIngestionRunsTable)
    .values({ sourceId, jobType, status: "RUNNING" }).returning();
  return rows[0];
}
export async function finishIngestionRun(client: TruthClient = defaultDb, runId: string, status: "COMPLETE" | "FAILED", detail: { recordsSeen?: number; recordsInserted?: number; errorMessage?: string }) {
  const rows = await client.update(sourceIngestionRunsTable).set({
    status, recordsSeen: detail.recordsSeen, recordsInserted: detail.recordsInserted,
    errorMessage: detail.errorMessage ?? null, completedAt: new Date(),
  }).where(eq(sourceIngestionRunsTable.id, runId)).returning();
  return rows[0] ?? null;
}