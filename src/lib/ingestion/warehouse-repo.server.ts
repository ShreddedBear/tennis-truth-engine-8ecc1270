// The evidence warehouse's write path, in one place.
//
// Seven ingestion producers (odds, weather, rankings, results/schedule, rules context, the
// WTA official feed, and the orchestrator) all performed the same five operations against
// PostgREST, spelled slightly differently each time. Migrating them meant either writing
// seven near-identical Drizzle chains or naming the operations once. This is the latter,
// and it is also what Phase 2 asks for: a server-side repository between the producers and
// the driver.
//
// SERVER ONLY -- every export here opens a database connection.
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db/client.server";
import { ingestionTargetsTable, sourceIngestionRunsTable, sourceObservationsTable } from "@/db/schema";
import { excludedSet } from "@/db/upsert";

/** A warehouse row as the producers build it: open, because each feed shapes its own. */
export type ObservationRow = Record<string, unknown>;

export interface IngestionTarget {
  id: string;
  source_id: string;
  target_key: string;
  pullback_start: string | null;
  pullback_end: string | null;
  config: unknown;
}

/**
 * Upserts observations on (source_id, source_record_key).
 *
 * `ignoreDuplicates` maps PostgREST's option of the same name: true means DO NOTHING (the
 * first write of a record wins and re-ingesting is inert), false means DO UPDATE (a
 * re-ingest refreshes the row). The distinction is not cosmetic -- the rankings, results
 * and WTA feeds relied on DO NOTHING to make a repeated pull idempotent, while the rules
 * feed relied on DO UPDATE to let corrected text overwrite -- so it is preserved per caller
 * rather than unified.
 */
export async function upsertObservations(
  rows: readonly ObservationRow[],
  options: { ignoreDuplicates: boolean },
): Promise<number> {
  if (!rows.length) return 0;
  const insert = db.insert(sourceObservationsTable).values(rows as never);
  await (options.ignoreDuplicates
    ? insert.onConflictDoNothing({
        target: [sourceObservationsTable.source_id, sourceObservationsTable.source_record_key],
      })
    : insert.onConflictDoUpdate({
        target: [sourceObservationsTable.source_id, sourceObservationsTable.source_record_key],
        set: excludedSet(sourceObservationsTable, rows, ["source_id", "source_record_key"]),
      }));
  return rows.length;
}

/**
 * Which of `keys` are actually present for this source.
 *
 * The feeds use this to count what a DO NOTHING upsert really wrote, rather than trusting
 * the number of rows they submitted.
 */
export async function confirmObservationKeys(sourceId: string, keys: readonly string[]): Promise<string[]> {
  if (!keys.length) return [];
  const found = await db
    .select({ source_record_key: sourceObservationsTable.source_record_key })
    .from(sourceObservationsTable)
    .where(and(
      eq(sourceObservationsTable.source_id, sourceId),
      inArray(sourceObservationsTable.source_record_key, keys as string[]),
    ));
  return found.map((r) => r.source_record_key).filter((k): k is string => k !== null);
}

/** Enabled ingestion targets for a source, in no particular order (as before). */
export async function enabledTargets(sourceId: string): Promise<IngestionTarget[]> {
  const found = await db
    .select({
      id: ingestionTargetsTable.id,
      source_id: ingestionTargetsTable.source_id,
      target_key: ingestionTargetsTable.target_key,
      pullback_start: ingestionTargetsTable.pullback_start,
      pullback_end: ingestionTargetsTable.pullback_end,
      config: ingestionTargetsTable.config,
    })
    .from(ingestionTargetsTable)
    .where(and(eq(ingestionTargetsTable.source_id, sourceId), eq(ingestionTargetsTable.enabled, true)));
  return found as IngestionTarget[];
}

export interface GeoIngestionTarget extends IngestionTarget {
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  tournament: string | null;
}

/**
 * Enabled targets that carry coordinates. The weather feed needs a venue to query, so a
 * target with a null latitude or longitude is skipped rather than pulled -- that filter was
 * `.not("latitude", "is", null)` before and is a real one, not a tidy-up.
 */
export async function enabledGeoTargets(sourceId: string): Promise<GeoIngestionTarget[]> {
  const found = await db
    .select({
      id: ingestionTargetsTable.id,
      source_id: ingestionTargetsTable.source_id,
      target_key: ingestionTargetsTable.target_key,
      pullback_start: ingestionTargetsTable.pullback_start,
      pullback_end: ingestionTargetsTable.pullback_end,
      config: ingestionTargetsTable.config,
      latitude: ingestionTargetsTable.latitude,
      longitude: ingestionTargetsTable.longitude,
      timezone: ingestionTargetsTable.timezone,
      tournament: ingestionTargetsTable.tournament,
    })
    .from(ingestionTargetsTable)
    .where(and(
      eq(ingestionTargetsTable.source_id, sourceId),
      eq(ingestionTargetsTable.enabled, true),
      isNotNull(ingestionTargetsTable.latitude),
      isNotNull(ingestionTargetsTable.longitude),
    ));
  return found as GeoIngestionTarget[];
}

/** Stamps a target as pulled. Both timestamps move together, as they did before. */
export async function markTargetIngested(targetId: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(ingestionTargetsTable)
    .set({ last_ingested_at: now, updated_at: now })
    .where(eq(ingestionTargetsTable.id, targetId));
}

/** Opens a run row and returns its id. */
export async function startIngestionRun(sourceId: string, jobType: string): Promise<string> {
  const [run] = await db
    .insert(sourceIngestionRunsTable)
    .values({ source_id: sourceId, job_type: jobType, status: "RUNNING", started_at: new Date().toISOString() } as never)
    .returning({ id: sourceIngestionRunsTable.id });
  if (!run) throw new Error("Could not open an ingestion run: the insert returned no row.");
  return run.id;
}

export async function completeIngestionRun(runId: string, written: number, metadata: unknown): Promise<void> {
  await db
    .update(sourceIngestionRunsTable)
    .set({
      status: "COMPLETE", records_seen: written, records_inserted: written,
      metadata: metadata as never, completed_at: new Date().toISOString(),
    })
    .where(eq(sourceIngestionRunsTable.id, runId));
}

export async function failIngestionRun(runId: string, message: string): Promise<void> {
  await db
    .update(sourceIngestionRunsTable)
    .set({ status: "FAILED", error_message: message, completed_at: new Date().toISOString() })
    .where(eq(sourceIngestionRunsTable.id, runId));
}
