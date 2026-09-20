import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  ingestionTargetsTable,
  sourceIngestionRunsTable,
  sourceObservationsTable,
} from "@workspace/db";

export type IngestionTarget = typeof ingestionTargetsTable.$inferSelect;
export type SourceObservationInput = {
  source_id: string;
  source_name: string;
  source_url?: string | null;
  source_record_key?: string | null;
  player_name?: string | null;
  opponent_name?: string | null;
  tournament?: string | null;
  event_date?: string | null;
  surface?: string | null;
  observation_type: string;
  observation_key: string;
  numeric_value?: number | null;
  text_value?: string | null;
  unit?: string | null;
  sample_label?: string | null;
  window_start?: string | null;
  window_end?: string | null;
  source_published_at?: string | null;
  raw_payload?: unknown;
  provenance?: unknown;
};

export async function getEnabledIngestionTargets(sourceId: string): Promise<IngestionTarget[]> {
  return db.select().from(ingestionTargetsTable).where(and(
    eq(ingestionTargetsTable.sourceId, sourceId),
    eq(ingestionTargetsTable.enabled, true),
  ));
}

export async function startIngestionRun(sourceId: string, jobType: string) {
  const [run] = await db.insert(sourceIngestionRunsTable)
    .values({ sourceId, jobType, status: "RUNNING", startedAt: new Date() })
    .returning();
  return run;
}

export async function finishIngestionRun(
  runId: string,
  status: "COMPLETE" | "FAILED",
  detail: { recordsSeen?: number; recordsInserted?: number; errorMessage?: string; metadata?: unknown },
) {
  const [run] = await db.update(sourceIngestionRunsTable).set({
    status,
    recordsSeen: detail.recordsSeen ?? 0,
    recordsInserted: detail.recordsInserted ?? 0,
    metadata: detail.metadata ?? {},
    errorMessage: detail.errorMessage ?? null,
    completedAt: new Date(),
  }).where(eq(sourceIngestionRunsTable.id, runId)).returning();
  return run ?? null;
}

function mapObservation(row: SourceObservationInput) {
  return {
    sourceId: row.source_id,
    sourceName: row.source_name,
    sourceUrl: row.source_url ?? null,
    sourceRecordKey: row.source_record_key ?? "",
    playerName: row.player_name ?? null,
    opponentName: row.opponent_name ?? null,
    tournament: row.tournament ?? null,
    eventDate: row.event_date ?? null,
    surface: row.surface ?? null,
    observationType: row.observation_type,
    observationKey: row.observation_key,
    numericValue: row.numeric_value ?? null,
    textValue: row.text_value ?? null,
    unit: row.unit ?? null,
    sampleLabel: row.sample_label ?? null,
    windowStart: row.window_start ?? null,
    windowEnd: row.window_end ?? null,
    sourcePublishedAt: row.source_published_at ? new Date(row.source_published_at) : null,
    rawPayload: row.raw_payload ?? null,
    provenance: row.provenance ?? {},
  };
}

export async function upsertSourceObservations(
  rows: SourceObservationInput[],
  ignoreDuplicates = false,
) {
  if (!rows.length) return [];
  const values = rows.map(mapObservation);
  const query = db.insert(sourceObservationsTable).values(values);
  if (ignoreDuplicates) {
    return query.onConflictDoNothing({
      target: [sourceObservationsTable.sourceId, sourceObservationsTable.sourceRecordKey],
    }).returning();
  }
  return query.onConflictDoUpdate({
    target: [sourceObservationsTable.sourceId, sourceObservationsTable.sourceRecordKey],
    set: {
      sourceName: sql`excluded.source_name`,
      sourceUrl: sql`excluded.source_url`,
      playerName: sql`excluded.player_name`,
      opponentName: sql`excluded.opponent_name`,
      tournament: sql`excluded.tournament`,
      eventDate: sql`excluded.event_date`,
      surface: sql`excluded.surface`,
      observationType: sql`excluded.observation_type`,
      observationKey: sql`excluded.observation_key`,
      numericValue: sql`excluded.numeric_value`,
      textValue: sql`excluded.text_value`,
      unit: sql`excluded.unit`,
      sampleLabel: sql`excluded.sample_label`,
      windowStart: sql`excluded.window_start`,
      windowEnd: sql`excluded.window_end`,
      sourcePublishedAt: sql`excluded.source_published_at`,
      rawPayload: sql`excluded.raw_payload`,
      provenance: sql`excluded.provenance`,
    },
  }).returning();
}

export async function confirmSourceObservations(sourceId: string, keys: string[]) {
  if (!keys.length) return [];
  return db.select({ sourceRecordKey: sourceObservationsTable.sourceRecordKey })
    .from(sourceObservationsTable)
    .where(and(
      eq(sourceObservationsTable.sourceId, sourceId),
      inArray(sourceObservationsTable.sourceRecordKey, keys),
    ));
}

export async function touchIngestionTarget(targetId: string) {
  const [target] = await db.update(ingestionTargetsTable).set({
    lastIngestedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(ingestionTargetsTable.id, targetId)).returning();
  return target ?? null;
}