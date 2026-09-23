/**
 * Match-start marking, outcome settlement, and grading for frozen paper trades.
 *
 * Settlement reuses the EXACT matching pattern already established by
 * `scripts/resolveParlayLegOutcomes.ts` (player-pair match, either orientation, chronologically
 * at-or-after the decision was created, small clock-skew buffer) against the same
 * `historical_matches` table -- no new matching logic invented. Void semantics
 * (retired/walkover/cancelled -> resultType, cancelled||walkover -> void) reuse the same
 * convention `attachParlayBuilderResearchV1Outcomes.ts` already established for Research V1.
 *
 * Grading is the one place this module is NOT just reusing prior art: it grades
 * `actual_winner_id === builder_picked_player_id` (settlementLogic.ts's `gradePaperTrade`) --
 * deliberately never `selected_player_id`, never the KEEP/BORDERLINE/REMOVE `decision`. See
 * settlementLogic.test.ts's explicit wrong-side-trap test for the proof.
 */
import { db, parlayPaperTradesTable, parlayPaperTradePairsTable } from "@workspace/db";
import { pool } from "@workspace/db";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { deriveResultType, gradePaperTrade, type ResultType } from "./settlementLogic.js";

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

interface CandidateMatchRow {
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  scheduled_start_at: Date | null;
  retired: boolean | null;
  walkover: boolean | null;
  cancelled: boolean | null;
}

/**
 * Finds the real historical_matches row for a pending pair's fixture. Unlike
 * resolveParlayLegOutcomes.ts (which only knows a leg was created at some timestamp and must
 * guess "earliest match after that"), a paper trade already carries the fixture's OWN
 * scheduled_start_at -- so this matches player-pair (either orientation) AND scheduled_start_at
 * within a tight window of THIS fixture's own start time, not just "any later match between
 * these two players" (which risks picking up a different, subsequent meeting between the same
 * pair). This is the "settlement must identify the same fixture/player identities used by the
 * frozen paper trade" requirement, enforced structurally rather than by convention.
 */
async function findSettledMatch(
  player1Id: string, player2Id: string, fixtureScheduledStartAt: Date,
): Promise<CandidateMatchRow | null> {
  const windowMs = 24 * 60 * 60 * 1000; // matches are resolved same-day; generous for timezone/clock skew
  const { rows } = await pool.query<CandidateMatchRow>(`
    SELECT player1_id, player2_id, winner_id, scheduled_start_at, retired, walkover, cancelled
    FROM historical_matches
    WHERE ((player1_id = $1 AND player2_id = $2) OR (player1_id = $2 AND player2_id = $1))
      AND scheduled_start_at BETWEEN $3 AND $4
      AND (winner_id IS NOT NULL OR cancelled = true OR walkover = true)
    ORDER BY ABS(EXTRACT(EPOCH FROM (scheduled_start_at - $5::timestamptz)))
    LIMIT 1
  `, [
    player1Id, player2Id,
    new Date(fixtureScheduledStartAt.getTime() - windowMs),
    new Date(fixtureScheduledStartAt.getTime() + windowMs),
    fixtureScheduledStartAt,
  ]);
  return rows[0] ?? null;
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
    if (rows.length !== 2) {
      summary.errors.push(`pair ${pairId}: expected 2 pending rows, found ${rows.length} -- skipped`);
      continue;
    }
    const [row1] = rows;
    try {
      const match = await findSettledMatch(row1.player1Id, row1.player2Id, row1.scheduledStartAt);
      if (match == null) {
        summary.stillPending++;
        continue;
      }

      const resultType: ResultType = deriveResultType({
        cancelled: match.cancelled ?? false,
        walkover: match.walkover ?? false,
        retired: match.retired ?? false,
      });
      const actualWinnerId = match.winner_id;
      const now = new Date();

      await db.transaction(async (tx) => {
        for (const row of rows) {
          await tx
            .update(parlayPaperTradesTable)
            .set({
              actualWinnerId,
              resultType,
              outcomeAttachedAt: now,
              status: "COMPLETED",
            })
            .where(eq(parlayPaperTradesTable.id, row.id));
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
