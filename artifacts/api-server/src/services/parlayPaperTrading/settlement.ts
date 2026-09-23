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
import { deriveResultType, gradePaperTrade, hasMatchStarted, type ResultType } from "./settlementLogic.js";

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

export interface SettleAndGradeSummary {
  settled: number;
  graded: number;
  stillPending: number;
  errors: string[];
}

/**
 * One cycle: for every pair whose trades are FROZEN/STARTED and not yet settled, look for a
 * real match result; when found, attach the outcome and grade BOTH sibling rows in one
 * transaction (same real match, so actual_winner_id/result_type are identical across the pair;
 * gradedCorrect is per-row since it depends on that row's own builder_picked_player_id).
 * Safe to call repeatedly -- only touches rows with actual_winner_id still null.
 */
export async function settleAndGradePendingTrades(): Promise<SettleAndGradeSummary> {
  const summary: SettleAndGradeSummary = { settled: 0, graded: 0, stillPending: 0, errors: [] };

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
          const grading = gradePaperTrade({
            builderPickedPlayerId: row.builderPickedPlayerId ?? "",
            actualWinnerId,
            resultType,
          });
          await tx
            .update(parlayPaperTradesTable)
            .set({
              actualWinnerId,
              resultType,
              outcomeAttachedAt: now,
              includedInAccuracy: grading.includedInAccuracy,
              gradedCorrect: grading.gradedCorrect,
              gradedAt: now,
              status: "GRADED",
            })
            .where(eq(parlayPaperTradesTable.id, row.id));
        }
      });

      summary.settled++;
      summary.graded += 2;
    } catch (err) {
      summary.errors.push(`pair ${pairId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return summary;
}
