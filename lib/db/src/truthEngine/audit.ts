import { and, desc, eq, or, sql } from "drizzle-orm";
import { db as defaultDb } from "../index";
import { auditRunsTable, auditStageRunsTable } from "../schema";
import type { TruthClient } from "./client";

const seconds = (milliseconds: number) => Math.max(10, Math.ceil(milliseconds / 1000));

export async function claimAuditRun(client: TruthClient = defaultDb, runId: string, owner: string, leaseMs = 60_000, userId: string) {
  const rows = await client.update(auditRunsTable).set({
    leaseOwner: owner,
    leaseExpiresAt: sql`now() + make_interval(secs => greatest(${seconds(leaseMs)}, 10))`,
    heartbeatAt: sql`now()`, updatedAt: sql`now()`,
  }).where(and(eq(auditRunsTable.userId, userId), eq(auditRunsTable.id, runId), sql`${auditRunsTable.status} in ('RUNNING','COMPLETE')`,
    or(sql`${auditRunsTable.leaseOwner} is null`, sql`${auditRunsTable.leaseExpiresAt} is null`,
      sql`${auditRunsTable.leaseExpiresAt} < now()`, eq(auditRunsTable.leaseOwner, owner)))).returning({ id: auditRunsTable.id });
  return rows.length === 1;
}

export async function renewAuditRunLease(client: TruthClient = defaultDb, runId: string, owner: string, leaseMs = 60_000, userId: string) {
  const rows = await client.update(auditRunsTable).set({
    leaseExpiresAt: sql`now() + make_interval(secs => greatest(${seconds(leaseMs)}, 10))`,
    heartbeatAt: sql`now()`, updatedAt: sql`now()`,
  }).where(and(eq(auditRunsTable.userId, userId), eq(auditRunsTable.id, runId), eq(auditRunsTable.status, "RUNNING"), eq(auditRunsTable.leaseOwner, owner))).returning({ id: auditRunsTable.id });
  return rows.length === 1;
}

export async function releaseAuditRunLease(client: TruthClient = defaultDb, runId: string, owner: string, userId: string) {
  const rows = await client.update(auditRunsTable).set({
    leaseOwner: null, leaseExpiresAt: null, heartbeatAt: sql`now()`, updatedAt: sql`now()`,
  }).where(and(eq(auditRunsTable.userId, userId), eq(auditRunsTable.id, runId), eq(auditRunsTable.leaseOwner, owner))).returning({ id: auditRunsTable.id });
  return rows.length === 1;
}

export async function getLatestAuditRun(client: TruthClient = defaultDb, userId: string, matchId: string) {
  const rows = await client.select().from(auditRunsTable)
    .where(and(eq(auditRunsTable.userId, userId), eq(auditRunsTable.matchId, matchId)))
    .orderBy(desc(auditRunsTable.runNumber)).limit(1);
  return rows[0] ?? null;
}

export async function getAuditRunById(client: TruthClient = defaultDb, userId: string, runId: string) {
  const rows = await client.select().from(auditRunsTable)
    .where(and(eq(auditRunsTable.userId, userId), eq(auditRunsTable.id, runId))).limit(1);
  return rows[0] ?? null;
}

export async function getAuditStages(client: TruthClient = defaultDb, userId: string, runId: string) {
  return client.select().from(auditStageRunsTable)
    .where(and(eq(auditStageRunsTable.userId, userId), eq(auditStageRunsTable.auditRunId, runId)))
    .orderBy(auditStageRunsTable.stageOrder);
}