/**
 * Prospective, leak-proof matched-cohort sync -- joins the Prediction Engine's and the Parlay
 * Builder's independently-frozen paper-trading predictions on the SAME real fixture into
 * `matched_engine_cohort`.
 *
 * LEAKAGE FIREWALL: this module only ever READS each engine's own already-frozen/locked rows
 * (evaluation_predictions, parlay_paper_trades, parlay_paper_trade_pairs) after the fact. It never
 * imports from `../predictionEngine/` or `../parlayBuilder/` (the two engines' live scoring
 * modules) and never calls into either engine's discovery/scoring/grading functions -- see
 * `syncMatchedCohort.boundary.test.ts` for the static proof this module (and the whole
 * `matchedCohort/` directory) never does. Neither engine's own tables are ever written by this
 * job; it is strictly additive, reading two already-committed prospective predictions and writing
 * only to `matched_engine_cohort`.
 *
 * COHORT MEMBERSHIP is decided ONLY by whether a genuine pre-match prediction independently
 * existed on both sides -- never by the match result, the winner, or whether the two engines
 * agreed (see `matchedEngineCohort.ts`'s schema doc comment for the exact eligibility gates and
 * the empirical join-key verification this design is based on).
 *
 * Idempotent: upserts on `externalFixtureId` (the proven-safe canonical join key), so re-running
 * this job never creates duplicate rows and safely picks up newly-graded results on later syncs.
 */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  db,
  evaluationPredictionsTable,
  parlayPaperTradesTable,
  parlayPaperTradePairsTable,
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

const PE_GRADED_STATUSES = new Set(["graded", "void"]);
const BUILDER_GRADED_STATUSES = new Set(["GRADED", "VOID"]);

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

  // Builder prospective eligibility: frozenAt set AND a real picked player -- the immutability
  // trigger only permits frozenAt once a genuine decision was made, so disagreement/ineligible/
  // data-error paths (which never reach frozenAt with a picked player) are already excluded by
  // this gate alone.
  const builderRows = await db
    .select()
    .from(parlayPaperTradesTable)
    .where(
      and(
        inArray(parlayPaperTradesTable.externalFixtureId, fixtureIds),
        isNotNull(parlayPaperTradesTable.frozenAt),
        isNotNull(parlayPaperTradesTable.builderPickedPlayerId),
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
    // Defensive re-check -- fails closed even though the write-path guarantees this already.
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

    const peGraded = PE_GRADED_STATUSES.has(peRow.status);
    const builderGraded = BUILDER_GRADED_STATUSES.has(canonicalBuilderRow.status);

    let canonicalActualWinnerId: string | null = null;
    let canonicalGradedAt: Date | null = null;
    let nativeGradingAgrees: boolean | null = null;

    if (peGraded && builderGraded) {
      const peResultKey = peRow.status === "void" ? "VOID" : peRow.actualWinnerId;
      const builderResultKey = canonicalBuilderRow.status === "VOID" ? "VOID" : canonicalBuilderRow.actualWinnerId;
      nativeGradingAgrees = peResultKey === builderResultKey;
      if (nativeGradingAgrees && peRow.status !== "void") {
        canonicalActualWinnerId = peRow.actualWinnerId;
        canonicalGradedAt = peRow.gradedAt ?? canonicalBuilderRow.gradedAt ?? new Date();
      }
      // A mismatch (nativeGradingAgrees === false) deliberately leaves canonicalActualWinnerId
      // null -- surfaced via nativeGradingAgrees, never silently resolved by preferring one side.
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
      canonicalGradedAt,
      nativeGradingAgrees,

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
          canonicalGradedAt: sql`excluded.canonical_graded_at`,
          nativeGradingAgrees: sql`excluded.native_grading_agrees`,

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
