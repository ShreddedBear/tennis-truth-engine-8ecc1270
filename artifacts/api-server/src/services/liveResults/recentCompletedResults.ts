import {
  db,
  liveCompletedResultsTable,
  type LiveCompletedResultRow,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  createCanonicalIngestionResolver,
  loadCanonicalIngestionDependencies,
} from "../identity/canonicalIngestionResolver.js";
import type { HistoricalFixture, TennisDataProvider } from "../tennisData/types.js";
import { combineDateTimeUtc } from "../tennisData/apiTennisProvider.js";
import { LIVE_TENNIS_PROVIDER_NAME } from "../tennisData/liveTennisHistoricalProvider.js";
import { resolveTournamentTimezone } from "../tennisData/timezoneMap.js";

export type LiveTerminalResultType = "finished" | "retired" | "walkover";
export const LIVE_TENNIS_PROVIDER_ALIAS_NAMESPACE = LIVE_TENNIS_PROVIDER_NAME;
export const RECENT_COMPLETED_RESULTS_MAX_CHUNK_DAYS = 2;

export interface VerifiedLiveResult {
  provider: string;
  externalId: string;
  providerPlayer1Id: string;
  providerPlayer2Id: string;
  canonicalPlayer1Id: string;
  canonicalPlayer2Id: string;
  canonicalWinnerId: string;
  terminalResultType: LiveTerminalResultType;
  scheduledStartAt: Date;
  tournamentName: string | null;
  surface: string | null;
}

export type LiveResultWriteDisposition = "inserted" | "updated" | "unchanged" | "identity_conflict";

export interface RecentCompletedResultsSummary {
  fixturesFetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skippedByReason: Record<string, number>;
  /** Explicit date window + error for every provider chunk that failed during a partial fetch. */
  providerErrors: string[];
}

export function recentCompletedResultsJobStatus(
  summary: Pick<RecentCompletedResultsSummary, "providerErrors">,
): "success" | "degraded" {
  return summary.providerErrors.length > 0 ? "degraded" : "success";
}

export interface RecentCompletedProviderFetch {
  fixtures: HistoricalFixture[];
  providerErrors: string[];
  chunksFetched: number;
}

export interface RecentCompletedResultsDependencies {
  resolveCanonicalPlayer(input: {
    provider: string;
    externalPlayerId: string;
    externalPlayerName: string;
    metadata?: { tour?: string | null; tournamentNames?: string[] };
  }): Promise<{ canonicalPlayerId: string | null; resolutionMethod: string }>;
  persist(result: VerifiedLiveResult): Promise<LiveResultWriteDisposition>;
}

function terminalType(fixture: HistoricalFixture): LiveTerminalResultType | null {
  if (fixture.cancelled || !fixture.winnerId) return null;
  if (fixture.retired) return "retired";
  if (fixture.walkover) return "walkover";
  return "finished";
}

/**
 * The provider method returns only completed/definitively-terminated fixtures. Requiring a
 * non-cancelled official winner and exact participant IDs here is an additional fail-closed
 * boundary before the result can be persisted.
 */
export async function ingestRecentCompletedFixtures(
  fixtures: HistoricalFixture[],
  dependencies: RecentCompletedResultsDependencies,
  providerErrors: string[] = [],
  now: Date = new Date(),
): Promise<RecentCompletedResultsSummary> {
  const summary: RecentCompletedResultsSummary = {
    fixturesFetched: fixtures.length,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skippedByReason: {},
    providerErrors,
  };
  const seen = new Set<string>();
  const skip = (reason: string): void => {
    summary.skippedByReason[reason] = (summary.skippedByReason[reason] ?? 0) + 1;
  };

  for (const fixture of fixtures) {
    const uniqueKey = `${fixture.provider}\u0000${fixture.id}`;
    if (!fixture.provider || !fixture.id || seen.has(uniqueKey)) {
      skip("missing_or_duplicate_provider_fixture_identity");
      continue;
    }
    seen.add(uniqueKey);

    // Current authenticated provider fixtures identify themselves as "Live Tennis API", which
    // is the provider namespace used by verified player_aliases. Never silently resolve against
    // another source's numeric player IDs.
    if (fixture.provider !== LIVE_TENNIS_PROVIDER_ALIAS_NAMESPACE) {
      skip("provider_namespace_not_backed_by_verified_aliases");
      continue;
    }

    if (!fixture.player1Id || !fixture.player2Id || fixture.player1Id === fixture.player2Id) {
      skip("missing_or_invalid_provider_player_identity");
      continue;
    }

    const resultType = terminalType(fixture);
    if (!resultType) {
      skip(fixture.cancelled ? "cancelled_without_gradeable_result" : "missing_official_winner");
      continue;
    }
    if (fixture.winnerId !== fixture.player1Id && fixture.winnerId !== fixture.player2Id) {
      skip("official_winner_not_a_fixture_participant");
      continue;
    }

    // Live Tennis API's normalizer already extracts UTC calendar/time components from its ISO
    // scheduled_time. Convert those components back with UTC, never the venue timezone. Other
    // providers continue through the historical venue-local conversion, with no guessed fallback.
    const schedule = fixture.provider === LIVE_TENNIS_PROVIDER_ALIAS_NAMESPACE
      ? combineDateTimeUtc(fixture.date, fixture.time ?? undefined, "UTC")
      : combineDateTimeUtc(
          fixture.date,
          fixture.time ?? undefined,
          resolveTournamentTimezone(fixture.tournamentName),
        );
    if (!schedule) {
      skip("scheduled_start_unconfirmed");
      continue;
    }
    if (new Date(schedule).getTime() > now.getTime()) {
      skip("official_result_before_scheduled_start");
      continue;
    }

    const metadata = {
      tour: fixture.tour,
      tournamentNames: fixture.tournamentName ? [fixture.tournamentName] : [],
    };
    const [player1, player2] = await Promise.all([
      dependencies.resolveCanonicalPlayer({
        provider: fixture.provider,
        externalPlayerId: fixture.player1Id,
        externalPlayerName: fixture.player1Name,
        metadata,
      }),
      dependencies.resolveCanonicalPlayer({
        provider: fixture.provider,
        externalPlayerId: fixture.player2Id,
        externalPlayerName: fixture.player2Name,
        metadata,
      }),
    ]);

    // This path accepts only a previously verified exact provider-ID alias. Name, surname,
    // fuzzy, and ambiguous resolver outcomes are intentionally not enough to attach a result.
    if (
      player1.resolutionMethod !== "provider-alias"
      || player2.resolutionMethod !== "provider-alias"
      || !player1.canonicalPlayerId
      || !player2.canonicalPlayerId
    ) {
      skip("canonical_provider_alias_missing_or_ambiguous");
      continue;
    }
    if (player1.canonicalPlayerId === player2.canonicalPlayerId) {
      skip("canonical_players_not_distinct");
      continue;
    }

    const canonicalWinnerId =
      fixture.winnerId === fixture.player1Id
        ? player1.canonicalPlayerId
        : player2.canonicalPlayerId;
    const disposition = await dependencies.persist({
      provider: fixture.provider,
      externalId: fixture.id,
      providerPlayer1Id: fixture.player1Id,
      providerPlayer2Id: fixture.player2Id,
      canonicalPlayer1Id: player1.canonicalPlayerId,
      canonicalPlayer2Id: player2.canonicalPlayerId,
      canonicalWinnerId,
      terminalResultType: resultType,
      scheduledStartAt: new Date(schedule),
      tournamentName: fixture.tournamentName,
      surface: fixture.surface,
    });

    if (disposition === "identity_conflict") {
      skip("provider_fixture_identity_changed");
      continue;
    }
    summary[disposition]++;
  }

  return summary;
}

export async function persistVerifiedLiveResult(
  result: VerifiedLiveResult,
): Promise<LiveResultWriteDisposition> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(liveCompletedResultsTable)
      .where(and(
        eq(liveCompletedResultsTable.provider, result.provider),
        eq(liveCompletedResultsTable.externalId, result.externalId),
      ))
      .limit(1);

    if (existing) {
      if (!sameFixtureIdentity(existing, result)) return "identity_conflict";
      const changed =
        existing.canonicalWinnerId !== result.canonicalWinnerId
        || existing.terminalResultType !== result.terminalResultType
        || existing.scheduledStartAt.getTime() !== result.scheduledStartAt.getTime()
        || existing.tournamentName !== result.tournamentName
        || existing.surface !== result.surface;
      if (!changed) {
        await tx
          .update(liveCompletedResultsTable)
          .set({ lastVerifiedAt: new Date() })
          .where(eq(liveCompletedResultsTable.id, existing.id));
        return "unchanged";
      }
      await tx
        .update(liveCompletedResultsTable)
        .set({
          canonicalWinnerId: result.canonicalWinnerId,
          terminalResultType: result.terminalResultType,
          scheduledStartAt: result.scheduledStartAt,
          tournamentName: result.tournamentName,
          surface: result.surface,
          lastVerifiedAt: new Date(),
        })
        .where(eq(liveCompletedResultsTable.id, existing.id));
      return "updated";
    }

    const inserted = await tx
      .insert(liveCompletedResultsTable)
      .values(result)
      .onConflictDoNothing({
        target: [liveCompletedResultsTable.provider, liveCompletedResultsTable.externalId],
      })
      .returning({ id: liveCompletedResultsTable.id });
    if (inserted.length > 0) return "inserted";

    // A concurrent insert won the unique-key race. Read and verify its identity rather than
    // attaching this provider payload to a different fixture that reused the same key.
    const [raced] = await tx
      .select()
      .from(liveCompletedResultsTable)
      .where(and(
        eq(liveCompletedResultsTable.provider, result.provider),
        eq(liveCompletedResultsTable.externalId, result.externalId),
      ))
      .limit(1);
    return raced && sameFixtureIdentity(raced, result) ? "unchanged" : "identity_conflict";
  });
}

function sameFixtureIdentity(
  existing: Pick<
    LiveCompletedResultRow,
    "providerPlayer1Id" | "providerPlayer2Id" | "canonicalPlayer1Id" | "canonicalPlayer2Id"
  >,
  incoming: VerifiedLiveResult,
): boolean {
  return existing.providerPlayer1Id === incoming.providerPlayer1Id
    && existing.providerPlayer2Id === incoming.providerPlayer2Id
    && existing.canonicalPlayer1Id === incoming.canonicalPlayer1Id
    && existing.canonicalPlayer2Id === incoming.canonicalPlayer2Id;
}

export async function runRecentCompletedResultsIngestion(
  provider: TennisDataProvider,
  now: Date = new Date(),
): Promise<RecentCompletedResultsSummary> {
  const { dateStart, dateStop } = recentCompletedResultsDateRange(now);
  const fetched = await fetchRecentCompletedFixturesInChunks(provider, dateStart, dateStop);

  const dependencies = await loadCanonicalIngestionDependencies({
    verifiedProviderAliasesOnly: true,
  });
  const resolver = createCanonicalIngestionResolver("recent-completed-results", {
    ...dependencies,
    // Do not create inferred aliases or an unbounded queue of repeated review rows from a polling
    // job. This path consumes only already-verified exact provider aliases.
    persistAlias: async () => undefined,
    enqueueReview: async () => undefined,
  });

  return ingestRecentCompletedFixtures(fetched.fixtures, {
    resolveCanonicalPlayer: async (input) => resolver.resolve(input),
    persist: persistVerifiedLiveResult,
  }, fetched.providerErrors, now);
}

/** Seven-day recovery window covers weekend outages while remaining within provider-safe ranges. */
export function recentCompletedResultsDateRange(now: Date): { dateStart: string; dateStop: string } {
  const dateStop = now.toISOString().slice(0, 10);
  const start = new Date(`${dateStop}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return { dateStart: start.toISOString().slice(0, 10), dateStop };
}

function addUtcDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function chunkRecentCompletedResultsDateRange(
  dateStart: string,
  dateStop: string,
  maxChunkDays = RECENT_COMPLETED_RESULTS_MAX_CHUNK_DAYS,
): Array<{ dateStart: string; dateStop: string }> {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateStart)
    || !/^\d{4}-\d{2}-\d{2}$/.test(dateStop)
    || dateStart > dateStop
    || !Number.isInteger(maxChunkDays)
    || maxChunkDays < 1
  ) {
    throw new Error("Recent completed-result range requires valid inclusive dates and a positive integer chunk size");
  }
  const chunks: Array<{ dateStart: string; dateStop: string }> = [];
  let cursor = dateStart;
  while (cursor <= dateStop) {
    const proposedStop = addUtcDays(cursor, maxChunkDays - 1);
    const chunkStop = proposedStop < dateStop ? proposedStop : dateStop;
    chunks.push({ dateStart: cursor, dateStop: chunkStop });
    cursor = addUtcDays(chunkStop, 1);
  }
  return chunks;
}

export async function fetchRecentCompletedFixturesInChunks(
  provider: Pick<TennisDataProvider, "getCompletedMatchesByDateRange">,
  dateStart: string,
  dateStop: string,
): Promise<RecentCompletedProviderFetch> {
  const chunks = chunkRecentCompletedResultsDateRange(dateStart, dateStop);
  const result: RecentCompletedProviderFetch = {
    fixtures: [],
    providerErrors: [],
    chunksFetched: 0,
  };
  for (const chunk of chunks) {
    try {
      result.fixtures.push(
        ...await provider.getCompletedMatchesByDateRange(chunk.dateStart, chunk.dateStop),
      );
      result.chunksFetched++;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      result.providerErrors.push(
        `${chunk.dateStart}..${chunk.dateStop}: ${detail}`,
      );
    }
  }
  if (result.chunksFetched === 0 && result.providerErrors.length > 0) {
    throw new Error(
      `All recent completed-result provider chunks failed: ${result.providerErrors.join("; ")}`,
    );
  }
  return result;
}