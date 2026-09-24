/**
 * Prospective, leak-proof matched-cohort sync -- joins the Prediction Engine's and the Parlay
 * Builder's independently-frozen paper-trading predictions on the SAME real fixture into
 * `matched_engine_cohort`.
 *
 * LEAKAGE FIREWALL: this module only ever READS each engine's own already-frozen/locked rows
 * (evaluation_predictions, parlay_paper_trades, parlay_paper_trade_pairs) and the independent
 * completed-result store (historical_matches) after the fact. It never imports from
 * `../predictionEngine/` or `../parlayBuilder/` (the two engines' live scoring modules), never
 * imports `../parlayPaperTrading/settlement.ts` (Builder's OWN native settlement/grading code --
 * see the canonical-result section below for why), and never calls into either engine's
 * discovery/scoring/grading functions -- see `syncMatchedCohort.boundary.test.ts` for the static
 * proof this module (and the whole `matchedCohort/` directory) never does. Neither engine's own
 * tables are ever written by this job; it is strictly additive, reading two already-committed
 * prospective predictions plus the independent result store, and writing only to
 * `matched_engine_cohort`.
 *
 * COHORT MEMBERSHIP is decided ONLY by whether a genuine pre-match prediction independently
 * existed on both sides -- never by the match result, the winner, or whether the two engines
 * agreed (see `matchedEngineCohort.ts`'s schema doc comment for the exact eligibility gates and
 * the empirical join-key verification this design is based on).
 *
 * CANONICAL RESULT (corrected 2026-09-24): the winner used to grade BOTH engines is read
 * independently from `historical_matches`, matched by canonical player-ID pair (either
 * orientation) within a scheduled-time window -- the SAME established technique Builder's own
 * native settlement (`parlayPaperTrading/settlement.ts`'s `findSettledMatch`) already uses against
 * the same table, re-implemented independently here rather than imported, so a bug in Builder's
 * own settlement code can never silently become the cohort's canonical result too. This is
 * deliberately NOT an equality join on external_fixture_id: an empirical investigation
 * (2026-09-24) proved historical_matches.external_id and a live fixture's externalFixtureId are
 * different Live Tennis API resource ID spaces ("/fixtures" vs "/history/matches" endpoints) with
 * zero overlap in either direction across every real row checked. Each engine's OWN native grade
 * (evaluation_predictions.actualWinnerId / parlay_paper_trades.actualWinnerId) is used ONLY as a
 * downstream cross-check against this independently-sourced canonical result -- never to establish
 * it, and never required to agree before a canonical result can be recorded.
 *
 * Idempotent: upserts on `externalFixtureId` (the proven-safe canonical join key), so re-running
 * this job never creates duplicate rows and safely picks up newly-available canonical results and
 * newly-graded native results on later syncs.
 */
import { and, eq, gte, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import {
  db,
  evaluationPredictionsTable,
  parlayPaperTradesTable,
  parlayPaperTradePairsTable,
  historicalMatchesTable,
  matchedEngineCohortTable,
  type EvaluationPredictionRow,
  type ParlayPaperTradeRow,
} from "@workspace/db";

export interface MatchedCohortSyncSummary {
  peEligibleCount: number;
  builderEligibleCount: number;
  upserted: number;
  skipped: string[];
}

/**
 * Real decision-bearing Builder statuses only. Correction (2026-09-24, found via a real
 * production integrity audit of fixture 35909): frozenAt/builderPickedPlayerId non-null alone is
 * NOT a safe eligibility signal -- a genuine DATA_ERROR row (the sibling-disagreement fail-closed
 * path) can still carry a non-null frozenAt and a per-side builderPickedPlayerId as a forensic
 * record of what each side individually computed, even though no real accepted decision exists.
 * VOID is included (a real frozen decision existed, the match simply turned out unresolvable for
 * accuracy purposes -- analogous to PE's own 'void' status), while NO_DECISION / INELIGIBLE /
 * CANCELLED / DATA_ERROR are excluded (no real accepted decision).
 */
const BUILDER_DECISION_STATUSES = new Set(["FROZEN", "STARTED", "COMPLETED", "GRADED", "VOID"]);

/** Half-width of the window (either side of the anchor scheduled start) searched for a canonical result. */
const CANONICAL_RESULT_WINDOW_MS = 24 * 60 * 60 * 1000;

interface CanonicalResultCandidate {
  id: number;
  winnerId: string | null;
  cancelled: boolean;
  retired: boolean;
  walkover: boolean;
  scheduledStartAt: Date;
}

/**
 * Independently re-implemented (not imported) version of the player-pair + scheduled-time-window
 * lookup Builder's own `findSettledMatch` (parlayPaperTrading/settlement.ts) already uses against
 * historical_matches. Returns the terminal (winner known, cancelled, or walkover) row nearest in
 * time to `anchorScheduledStartAt`, or null if none exists in the window yet.
 */
async function findCanonicalResult(
  player1Id: string,
  player2Id: string,
  anchorScheduledStartAt: Date,
): Promise<CanonicalResultCandidate | null> {
  const windowStart = new Date(anchorScheduledStartAt.getTime() - CANONICAL_RESULT_WINDOW_MS);
  const windowEnd = new Date(anchorScheduledStartAt.getTime() + CANONICAL_RESULT_WINDOW_MS);

  const candidates = await db
    .select({
      id: historicalMatchesTable.id,
      winnerId: historicalMatchesTable.winnerId,
      cancelled: historicalMatchesTable.cancelled,
      retired: historicalMatchesTable.retired,
      walkover: historicalMatchesTable.walkover,
      scheduledStartAt: historicalMatchesTable.scheduledStartAt,
    })
    .from(historicalMatchesTable)
    .where(
      and(
        or(
          and(eq(historicalMatchesTable.player1Id, player1Id), eq(historicalMatchesTable.player2Id, player2Id)),
          and(eq(historicalMatchesTable.player1Id, player2Id), eq(historicalMatchesTable.player2Id, player1Id)),
        ),
        gte(historicalMatchesTable.scheduledStartAt, windowStart),
        lte(historicalMatchesTable.scheduledStartAt, windowEnd),
        or(
          isNotNull(historicalMatchesTable.winnerId),
          eq(historicalMatchesTable.cancelled, true),
          eq(historicalMatchesTable.walkover, true),
        ),
      ),
    );

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      Math.abs(a.scheduledStartAt.getTime() - anchorScheduledStartAt.getTime()) -
      Math.abs(b.scheduledStartAt.getTime() - anchorScheduledStartAt.getTime()),
  );
  return candidates[0]!;
}

export async function syncMatchedCohort(): Promise<MatchedCohortSyncSummary> {
  const summary: MatchedCohortSyncSummary = {
    peEligibleCount: 0,
    builderEligibleCount: 0,
    upserted: 0,
    skipped: [],
  };

  // PE prospective eligibility: a real pre-match prediction was locked (lockedAt is always set at
  // insert time -- see evaluationPredictionsTable.lockedAt.notNull()) and a real pick exists
  // (excludes 'missed' rows, which never get predictedWinnerId backfilled).
  const peRows = await db
    .select()
    .from(evaluationPredictionsTable)
    .where(
      and(
        eq(evaluationPredictionsTable.runKind, "paper_trade"),
        isNotNull(evaluationPredictionsTable.predictedWinnerId),
        isNotNull(evaluationPredictionsTable.externalFixtureId),
      ),
    );
  summary.peEligibleCount = peRows.length;
  if (peRows.length === 0) return summary;

  const peByFixture = new Map<string, EvaluationPredictionRow[]>();
  for (const row of peRows) {
    const fixtureId = row.externalFixtureId;
    if (!fixtureId) continue;
    const list = peByFixture.get(fixtureId) ?? [];
    list.push(row);
    peByFixture.set(fixtureId, list);
  }

  const fixtureIds = Array.from(peByFixture.keys());

  const builderRows = await db
    .select()
    .from(parlayPaperTradesTable)
    .where(
      and(
        inArray(parlayPaperTradesTable.externalFixtureId, fixtureIds),
        isNotNull(parlayPaperTradesTable.frozenAt),
        isNotNull(parlayPaperTradesTable.builderPickedPlayerId),
        inArray(parlayPaperTradesTable.status, Array.from(BUILDER_DECISION_STATUSES)),
      ),
    );
  summary.builderEligibleCount = builderRows.length;
  if (builderRows.length === 0) return summary;

  const builderByFixture = new Map<string, ParlayPaperTradeRow[]>();
  for (const row of builderRows) {
    const list = builderByFixture.get(row.externalFixtureId) ?? [];
    list.push(row);
    builderByFixture.set(row.externalFixtureId, list);
  }

  const pairIds = Array.from(new Set(builderRows.map((r) => r.pairId)));
  const pairs = await db
    .select()
    .from(parlayPaperTradePairsTable)
    .where(inArray(parlayPaperTradePairsTable.pairId, pairIds));
  const pairByPairId = new Map(pairs.map((p) => [p.pairId, p]));

  for (const [fixtureId, peCandidates] of peByFixture) {
    const builderSiblings = builderByFixture.get(fixtureId);
    if (!builderSiblings || builderSiblings.length === 0) continue;

    if (peCandidates.length > 1) {
      summary.skipped.push(`Fixture ${fixtureId}: ${peCandidates.length} ambiguous PE rows -- skipped`);
      continue;
    }
    const peRow = peCandidates[0]!;

    const pickedPlayerId = builderSiblings[0]!.builderPickedPlayerId;
    if (!builderSiblings.every((s) => s.builderPickedPlayerId === pickedPlayerId)) {
      summary.skipped.push(`Fixture ${fixtureId}: Builder sibling rows disagree on builderPickedPlayerId -- skipped`);
      continue;
    }
    const canonicalBuilderRow = builderSiblings.find((s) => s.selectedPlayerId === pickedPlayerId);
    if (!canonicalBuilderRow) {
      summary.skipped.push(`Fixture ${fixtureId}: no Builder sibling row's selectedPlayerId matches builderPickedPlayerId -- skipped`);
      continue;
    }

    const pair = pairByPairId.get(canonicalBuilderRow.pairId);
    // Defensive re-check -- fails closed even though the status whitelist above already excludes
    // the known DATA_ERROR/disagreement path.
    if (pair?.crossSideAgreement !== true) {
      summary.skipped.push(`Fixture ${fixtureId}: Builder pair crossSideAgreement is not true -- skipped`);
      continue;
    }

    if (peRow.calibratedProbability === null) {
      summary.skipped.push(`Fixture ${fixtureId}: PE row has predictedWinnerId but null calibratedProbability -- skipped`);
      continue;
    }

    const peCalibratedProbabilityForPick =
      peRow.predictedWinnerId === peRow.player1Id
        ? peRow.calibratedProbability
        : 100 - peRow.calibratedProbability;

    // Canonical result: sourced independently from historical_matches, never from either engine's
    // own actualWinnerId. Anchored on PE's scheduledStartAt (both sides' values are within a few
    // hours of each other -- see the schema doc comment -- so either would work equally well).
    const canonicalMatch = await findCanonicalResult(peRow.player1Id, peRow.player2Id, peRow.scheduledStartAt);

    let canonicalActualWinnerId: string | null = null;
    let canonicalSourceHistoricalMatchId: number | null = null;
    let canonicalResultType: string | null = null;
    let canonicalGradedAt: Date | null = null;

    if (canonicalMatch) {
      canonicalSourceHistoricalMatchId = canonicalMatch.id;
      canonicalResultType = canonicalMatch.cancelled
        ? "cancelled"
        : canonicalMatch.walkover
          ? "walkover"
          : canonicalMatch.retired
            ? "retired"
            : "normal";
      // historicalMatchesTable.winnerId is only ever null for cancelled matches -- see its schema
      // doc comment -- so a non-cancelled terminal row always has a real winner.
      canonicalActualWinnerId = canonicalMatch.cancelled ? null : canonicalMatch.winnerId;
      canonicalGradedAt = new Date();
    }

    const enginesAgreedOnPick = peRow.predictedWinnerId === pickedPlayerId;

    let peCorrect: boolean | null = null;
    let builderCorrect: boolean | null = null;
    let bothCorrect: boolean | null = null;
    let bothWrong: boolean | null = null;
    let onlyPeCorrect: boolean | null = null;
    let onlyBuilderCorrect: boolean | null = null;

    if (canonicalActualWinnerId !== null) {
      peCorrect = peRow.predictedWinnerId === canonicalActualWinnerId;
      builderCorrect = pickedPlayerId === canonicalActualWinnerId;
      bothCorrect = peCorrect && builderCorrect;
      bothWrong = !peCorrect && !builderCorrect;
      onlyPeCorrect = peCorrect && !builderCorrect;
      onlyBuilderCorrect = !peCorrect && builderCorrect;
    }

    // Cross-checks ONLY -- computed after the canonical result is already known, never used to
    // establish it. Each is null unless the canonical result exists AND that specific engine has
    // natively graded; a false value is a real, surfaced integrity signal, never silently resolved.
    const peNativeGradeMatchesCanonical =
      canonicalActualWinnerId !== null && peRow.status === "graded"
        ? peRow.actualWinnerId === canonicalActualWinnerId
        : null;
    const builderNativeGradeMatchesCanonical =
      canonicalActualWinnerId !== null && canonicalBuilderRow.status === "GRADED"
        ? canonicalBuilderRow.actualWinnerId === canonicalActualWinnerId
        : null;

    const values = {
      externalFixtureId: fixtureId,
      player1Id: peRow.player1Id,
      player1Name: peRow.player1Name,
      player2Id: peRow.player2Id,
      player2Name: peRow.player2Name,
      tournamentName: peRow.tournamentName,
      surface: peRow.surface,
      matchFormat: peRow.matchFormat,

      peEvaluationPredictionId: peRow.id,
      peProvider: peRow.provider ?? "",
      peScheduledStartAt: peRow.scheduledStartAt,
      peLockedAt: peRow.lockedAt,
      pePredictedWinnerId: peRow.predictedWinnerId!,
      pePredictedWinnerName: peRow.predictedWinnerName ?? "",
      peCalibratedProbabilityForPick,
      peStatus: peRow.status,
      peActualWinnerId: peRow.actualWinnerId,
      peResultType: peRow.resultType,
      peGradedAt: peRow.gradedAt,

      builderPairId: canonicalBuilderRow.pairId,
      builderProvider: canonicalBuilderRow.fixtureProvider,
      builderScheduledStartAt: canonicalBuilderRow.scheduledStartAt,
      builderFrozenAt: canonicalBuilderRow.frozenAt!,
      builderPickedPlayerId: pickedPlayerId!,
      builderCrossSideAgreement: true,
      builderCalibratedProbabilityForPick: canonicalBuilderRow.builderCalibratedProbability,
      builderStatus: canonicalBuilderRow.status,
      builderActualWinnerId: canonicalBuilderRow.actualWinnerId,
      builderResultType: canonicalBuilderRow.resultType,
      builderGradedAt: canonicalBuilderRow.gradedAt,

      canonicalActualWinnerId,
      canonicalSourceHistoricalMatchId,
      canonicalResultType,
      canonicalGradedAt,
      peNativeGradeMatchesCanonical,
      builderNativeGradeMatchesCanonical,

      enginesAgreedOnPick,
      peCorrect,
      builderCorrect,
      bothCorrect,
      bothWrong,
      onlyPeCorrect,
      onlyBuilderCorrect,

      lastSyncedAt: new Date(),
    };

    await db
      .insert(matchedEngineCohortTable)
      .values(values)
      .onConflictDoUpdate({
        target: matchedEngineCohortTable.externalFixtureId,
        set: {
          peEvaluationPredictionId: sql`excluded.pe_evaluation_prediction_id`,
          peProvider: sql`excluded.pe_provider`,
          peScheduledStartAt: sql`excluded.pe_scheduled_start_at`,
          peLockedAt: sql`excluded.pe_locked_at`,
          pePredictedWinnerId: sql`excluded.pe_predicted_winner_id`,
          pePredictedWinnerName: sql`excluded.pe_predicted_winner_name`,
          peCalibratedProbabilityForPick: sql`excluded.pe_calibrated_probability_for_pick`,
          peStatus: sql`excluded.pe_status`,
          peActualWinnerId: sql`excluded.pe_actual_winner_id`,
          peResultType: sql`excluded.pe_result_type`,
          peGradedAt: sql`excluded.pe_graded_at`,

          builderPairId: sql`excluded.builder_pair_id`,
          builderProvider: sql`excluded.builder_provider`,
          builderScheduledStartAt: sql`excluded.builder_scheduled_start_at`,
          builderFrozenAt: sql`excluded.builder_frozen_at`,
          builderPickedPlayerId: sql`excluded.builder_picked_player_id`,
          builderCrossSideAgreement: sql`excluded.builder_cross_side_agreement`,
          builderCalibratedProbabilityForPick: sql`excluded.builder_calibrated_probability_for_pick`,
          builderStatus: sql`excluded.builder_status`,
          builderActualWinnerId: sql`excluded.builder_actual_winner_id`,
          builderResultType: sql`excluded.builder_result_type`,
          builderGradedAt: sql`excluded.builder_graded_at`,

          canonicalActualWinnerId: sql`excluded.canonical_actual_winner_id`,
          canonicalSourceHistoricalMatchId: sql`excluded.canonical_source_historical_match_id`,
          canonicalResultType: sql`excluded.canonical_result_type`,
          canonicalGradedAt: sql`excluded.canonical_graded_at`,
          peNativeGradeMatchesCanonical: sql`excluded.pe_native_grade_matches_canonical`,
          builderNativeGradeMatchesCanonical: sql`excluded.builder_native_grade_matches_canonical`,

          enginesAgreedOnPick: sql`excluded.engines_agreed_on_pick`,
          peCorrect: sql`excluded.pe_correct`,
          builderCorrect: sql`excluded.builder_correct`,
          bothCorrect: sql`excluded.both_correct`,
          bothWrong: sql`excluded.both_wrong`,
          onlyPeCorrect: sql`excluded.only_pe_correct`,
          onlyBuilderCorrect: sql`excluded.only_builder_correct`,

          lastSyncedAt: sql`excluded.last_synced_at`,
          // firstMatchedAt is deliberately omitted -- it must never change once a row exists.
        },
      });

    summary.upserted += 1;
  }

  return summary;
}
