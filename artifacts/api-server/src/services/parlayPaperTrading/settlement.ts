/**
 * Match-start marking, outcome settlement, and grading for frozen paper trades.
 *
 * Settlement resolves exact canonical player ids and comparable fixture metadata against
 * `historical_matches`, and fails closed on missing or ambiguous results. Void semantics
 * (retired/walkover/cancelled -> resultType, cancelled||walkover -> void) reuse the same
 * convention `attachParlayBuilderResearchV1Outcomes.ts` already established for Research V1.
 *
 * Grading is the one place this module is NOT just reusing prior art: it grades
 * `actual_winner_id === builder_picked_player_id` (settlementLogic.ts's `gradePaperTrade`) --
 * deliberately never `selected_player_id`, never the KEEP/BORDERLINE/REMOVE `decision`. See
 * settlementLogic.test.ts's explicit wrong-side-trap test for the proof.
 */
import {
  db,
  liveCompletedResultsTable,
  parlayPaperTradesTable,
  parlayPaperTradePairsTable,
} from "@workspace/db";
import { pool } from "@workspace/db";
import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import {
  deriveResultType,
  gradePaperTrade,
  isSettlementTimeReady,
  isValidSettlementPair,
  reconcileHistoricalWithLiveResult,
  resolveLiveSettlementCandidate,
  resolveSettlementCandidate,
  SETTLEMENT_MATCH_TIME_WINDOW_MS,
  shouldUseHistoricalSettlementFallback,
  type ResultType,
  type SettlementCandidate,
} from "./settlementLogic.js";

export interface MarkStartedSummary {
  pairsMarkedStarted: number;
}

/**
 * Once a fixture's scheduled_start_at has passed, mark both sibling rows STARTED
 * (match_started_at = now). This is the hard PIT boundary: `discoverAndDecidePaperTrade`'s own
 * eligibility check already refuses a NEW decision once this is true (MATCH_ALREADY_STARTED);
 * this function is the complementary "close out the ones that were already frozen before the
 * match began" step. Idempotent: only touches rows still at FROZEN with match_started_at unset.
 */
export async function markStartedFixtures(now: Date = new Date()): Promise<MarkStartedSummary> {
  const result = await db
    .update(parlayPaperTradesTable)
    .set({ matchStartedAt: now, status: "STARTED" })
    .where(and(
      eq(parlayPaperTradesTable.status, "FROZEN"),
      isNull(parlayPaperTradesTable.matchStartedAt),
      lte(parlayPaperTradesTable.scheduledStartAt, now),
    ))
    .returning({ id: parlayPaperTradesTable.id });

  return { pairsMarkedStarted: result.length / 2 };
}

type TradeRow = typeof parlayPaperTradesTable.$inferSelect;
type HistoricalResolution = ReturnType<typeof resolveSettlementCandidate>;
type LiveResolution = ReturnType<typeof resolveLiveSettlementCandidate>;

async function findLiveSettledMatch(row: TradeRow): Promise<LiveResolution> {
  const windowMs = SETTLEMENT_MATCH_TIME_WINDOW_MS;
  const candidates = await db
    .select()
    .from(liveCompletedResultsTable)
    .where(and(
      eq(liveCompletedResultsTable.provider, row.fixtureProvider),
      gte(liveCompletedResultsTable.scheduledStartAt, new Date(row.scheduledStartAt.getTime() - windowMs)),
      lte(liveCompletedResultsTable.scheduledStartAt, new Date(row.scheduledStartAt.getTime() + windowMs)),
      or(
        and(
          eq(liveCompletedResultsTable.providerPlayer1Id, row.player1Id),
          eq(liveCompletedResultsTable.providerPlayer2Id, row.player2Id),
        ),
        and(
          eq(liveCompletedResultsTable.providerPlayer1Id, row.player2Id),
          eq(liveCompletedResultsTable.providerPlayer2Id, row.player1Id),
        ),
      ),
    ));
  return resolveLiveSettlementCandidate({
    candidates,
    provider: row.fixtureProvider,
    providerPlayer1Id: row.player1Id,
    providerPlayer2Id: row.player2Id,
    scheduledStartAt: row.scheduledStartAt,
    tournamentName: row.tournamentName,
    surface: row.surface,
  });
}

async function findHistoricalCandidates(row: TradeRow, additionalPlayerIds: [string, string] | null = null): Promise<SettlementCandidate[]> {
  const windowMs = SETTLEMENT_MATCH_TIME_WINDOW_MS;
  const player1Id = additionalPlayerIds?.[0] ?? row.player1Id;
  const player2Id = additionalPlayerIds?.[1] ?? row.player2Id;
  const { rows } = await pool.query<SettlementCandidate>(`
    SELECT id, provider, player1_id, player2_id, winner_id, scheduled_start_at, retired, walkover, cancelled,
      tournament_name, surface
    FROM historical_matches
    WHERE provider = $1
      AND scheduled_start_time_confirmed = true
      AND ((player1_id = $2 AND player2_id = $3) OR (player1_id = $3 AND player2_id = $2))
      AND scheduled_start_at BETWEEN $4 AND $5
  `, [
    row.fixtureProvider, player1Id, player2Id,
    new Date(row.scheduledStartAt.getTime() - windowMs),
    new Date(row.scheduledStartAt.getTime() + windowMs),
  ]);
  return rows;
}

function resolveHistoricalForTrade(
  row: TradeRow,
  candidates: SettlementCandidate[],
): HistoricalResolution {
  return resolveSettlementCandidate({
    candidates,
    provider: row.fixtureProvider,
    player1Id: row.player1Id,
    player2Id: row.player2Id,
    scheduledStartAt: row.scheduledStartAt,
    tournamentName: row.tournamentName,
    surface: row.surface,
  });
}

async function findHistoricalConflictWithLiveResult(
  row: TradeRow,
  live: Extract<LiveResolution, { kind: "settled" }>,
): Promise<"consistent" | "conflict" | "ambiguous"> {
  const providerIds: [string, string] = [
    live.candidate.providerPlayer1Id,
    live.candidate.providerPlayer2Id,
  ];
  const canonicalIds: [string, string] = [
    live.candidate.canonicalPlayer1Id,
    live.candidate.canonicalPlayer2Id,
  ];
  const providerCandidates = await findHistoricalCandidates(row, providerIds);
  const canonicalCandidates = canonicalIds[0] === providerIds[0] && canonicalIds[1] === providerIds[1]
    ? providerCandidates
    : await findHistoricalCandidates(row, canonicalIds);
  const historicalCandidates = [
    ...new Map(
      [...providerCandidates, ...canonicalCandidates].map((candidate) => [candidate.id, candidate]),
    ).values(),
  ];
  return reconcileHistoricalWithLiveResult({
    historicalCandidates,
    liveCandidate: live.candidate,
    providerWinnerId: live.providerWinnerId,
    scheduledStartAt: row.scheduledStartAt,
    tournamentName: row.tournamentName,
    surface: row.surface,
  });
}

export interface SettleSummary {
  settled: number;
  stillPending: number;
  errors: string[];
}

/**
 * Phase 4 of the lifecycle (deliberately separate from grading, phase 5): for every pair whose
 * trades are FROZEN/STARTED and not yet settled, look for a real match result; when found,
 * attach ONLY the outcome (actual_winner_id, result_type, outcome_attached_at) and advance to
 * COMPLETED -- no grading math here. A failed provider/DB lookup for one pair is caught and
 * recorded per-pair, never aborting the rest of the batch or blocking grading of OTHER
 * already-completed pairs. Safe to call repeatedly -- only touches rows with actual_winner_id
 * still null.
 */
export async function settlePendingTrades(): Promise<SettleSummary> {
  const summary: SettleSummary = { settled: 0, stillPending: 0, errors: [] };

  const pending = await db
    .select()
    .from(parlayPaperTradesTable)
    .where(and(
      inArray(parlayPaperTradesTable.status, ["FROZEN", "STARTED"]),
      isNull(parlayPaperTradesTable.actualWinnerId),
    ));

  const byPair = new Map<string, typeof pending>();
  for (const row of pending) {
    const list = byPair.get(row.pairId) ?? [];
    list.push(row);
    byPair.set(row.pairId, list);
  }

  for (const [pairId, rows] of byPair) {
    if (!isValidSettlementPair(rows)) {
      summary.errors.push(`pair ${pairId}: pending rows are not a valid, coherent two-sided frozen fixture -- skipped`);
      continue;
    }
    const [row1] = rows;
    try {
      if (!isSettlementTimeReady(row1.scheduledStartAt, row1.scheduledStartAt, new Date())) {
        summary.stillPending++;
        continue;
      }
      const liveResolution = await findLiveSettledMatch(row1);
      let actualWinnerId: string;
      let resultType: ResultType;
      let resultScheduledStartAt: Date;

      if (liveResolution.kind === "ambiguous") {
        summary.stillPending++;
        summary.errors.push(`pair ${pairId}: ${liveResolution.candidateCount} plausible live completed results; settlement held as ambiguous`);
        continue;
      }

      if (liveResolution.kind === "settled") {
        if (!isSettlementTimeReady(row1.scheduledStartAt, liveResolution.candidate.scheduledStartAt, new Date())) {
          summary.stillPending++;
          continue;
        }
        const agreement = await findHistoricalConflictWithLiveResult(row1, liveResolution);
        if (agreement !== "consistent") {
          summary.stillPending++;
          summary.errors.push(`pair ${pairId}: historical/live result ${agreement}; settlement held`);
          continue;
        }
        // Keep the outcome in the Builder's provider-ID namespace. The live row's canonical
        // winner was translated through its exact provider-player slot by the pure resolver.
        actualWinnerId = liveResolution.providerWinnerId;
        resultType = liveResolution.resultType;
        resultScheduledStartAt = liveResolution.candidate.scheduledStartAt;
      } else if (!shouldUseHistoricalSettlementFallback(liveResolution)) {
        summary.stillPending++;
        summary.errors.push(`pair ${pairId}: live result exists for the provider fixture but identity/metadata could not be defensibly resolved`);
        continue;
      } else {
        // Compatibility fallback for old Builder rows that predate live_completed_results.
        // Historical winner ids are accepted only when their exact stored player IDs match the
        // Builder provider IDs; no fuzzy name mapping or cross-provider guess is attempted.
        const historyCandidates = await findHistoricalCandidates(row1);
        const historyResolution = resolveHistoricalForTrade(row1, historyCandidates);
        if (historyResolution.kind === "pending") {
          summary.stillPending++;
          continue;
        }
        if (historyResolution.kind === "ambiguous") {
          summary.stillPending++;
          summary.errors.push(`pair ${pairId}: ${historyResolution.candidateCount} plausible historical results; settlement held as ambiguous`);
          continue;
        }
        if (!isSettlementTimeReady(row1.scheduledStartAt, historyResolution.match.scheduled_start_at, new Date())) {
          summary.stillPending++;
          continue;
        }
        actualWinnerId = historyResolution.match.winner_id!;
        resultType = deriveResultType({
          cancelled: historyResolution.match.cancelled ?? false,
          walkover: historyResolution.match.walkover ?? false,
          retired: historyResolution.match.retired ?? false,
        });
        resultScheduledStartAt = historyResolution.match.scheduled_start_at;
      }
      const now = new Date();
      if (!isSettlementTimeReady(row1.scheduledStartAt, resultScheduledStartAt, now)) {
        summary.stillPending++;
        continue;
      }

      await db.transaction(async (tx) => {
        for (const row of rows) {
          const updated = await tx
            .update(parlayPaperTradesTable)
            .set({
              actualWinnerId,
              resultType,
              outcomeAttachedAt: now,
              status: "COMPLETED",
            })
            .where(and(
              eq(parlayPaperTradesTable.id, row.id),
              inArray(parlayPaperTradesTable.status, ["FROZEN", "STARTED"]),
              isNull(parlayPaperTradesTable.actualWinnerId),
            ))
            .returning({ id: parlayPaperTradesTable.id });
          if (updated.length !== 1) {
            throw new Error(`pair ${pairId}: sibling changed before outcome attachment; transaction rolled back`);
          }
        }
      });

      summary.settled++;
    } catch (err) {
      summary.errors.push(`pair ${pairId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return summary;
}

export interface GradeSummary {
  graded: number;
  errors: string[];
}

/**
 * Phase 5 of the lifecycle: for every COMPLETED row not yet graded, compute
 * actual_winner_id === builder_picked_player_id (never selected_player_id, never `decision` --
 * see settlementLogic.ts's gradePaperTrade and its wrong-side-trap test) and advance to GRADED.
 * Deliberately reads ALREADY-attached outcome columns rather than re-querying
 * historical_matches, so a settlement-phase failure can never corrupt or duplicate grading, and
 * a grading-phase failure never needs to re-fetch match data. Safe to call repeatedly -- only
 * touches rows with graded_at still null (the immutability trigger would reject a second write
 * to an already-graded row's grading columns regardless).
 */
export async function gradeSettledTrades(): Promise<GradeSummary> {
  const summary: GradeSummary = { graded: 0, errors: [] };

  const completed = await db
    .select()
    .from(parlayPaperTradesTable)
    .where(and(
      eq(parlayPaperTradesTable.status, "COMPLETED"),
      isNull(parlayPaperTradesTable.gradedAt),
    ));

  for (const row of completed) {
    try {
      if (row.resultType == null) {
        summary.errors.push(`trade ${row.paperTradeId}: status COMPLETED but resultType is null -- skipped`);
        continue;
      }
      const grading = gradePaperTrade({
        builderPickedPlayerId: row.builderPickedPlayerId ?? "",
        actualWinnerId: row.actualWinnerId,
        resultType: row.resultType as ResultType,
      });
      await db
        .update(parlayPaperTradesTable)
        .set({
          includedInAccuracy: grading.includedInAccuracy,
          gradedCorrect: grading.gradedCorrect,
          gradedAt: new Date(),
          status: "GRADED",
        })
        .where(eq(parlayPaperTradesTable.id, row.id));
      summary.graded++;
    } catch (err) {
      summary.errors.push(`trade ${row.paperTradeId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return summary;
}
