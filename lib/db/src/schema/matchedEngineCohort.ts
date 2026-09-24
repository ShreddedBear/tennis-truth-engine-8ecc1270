import { pgTable, serial, text, integer, real, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { evaluationPredictionsTable } from "./evaluation";

/**
 * Prospective, leak-proof comparison layer between the Prediction Engine's and the Parlay
 * Builder's independently-frozen paper-trading predictions on the SAME real fixture.
 *
 * This is an ADDITIONAL, read-only-derived layer -- it never feeds back into either engine's own
 * scoring, discovery, or native grading, and neither engine's own paper-trading tables are ever
 * mutated by the sync job that populates this table. Both engines' own accuracy/logLoss/Brier
 * reporting (predictionStats.ts, adminParlayPaperTrading stats route) continue to read only their
 * own native tables, completely unaware this table exists.
 *
 * CANONICAL JOIN KEY: `externalFixtureId` alone -- empirically verified (real production data,
 * 2026-09-24) against 352 real overlapping fixtures between evaluation_predictions
 * (run_kind='paper_trade') and parlay_paper_trades:
 *   - Player-ID-pair identity matched exactly on ALL 352 rows (0 partial/mismatched pairs) --
 *     this is what actually proves externalFixtureId alone safely identifies the same real match
 *     on both sides, including the 6 rows with the largest (>360 minute) scheduled-start drift.
 *   - The two sides' provider strings differ on 100% of those rows by DESIGN, not by inconsistency:
 *     PE's `evaluation_predictions.provider` stores the composite provider's full name
 *     ("Live Tennis API+Live Tennis API (no secondary provider)"), while Builder's
 *     `parlay_paper_trades.fixture_provider` stores the plain default string ("live-tennis-api" /
 *     "Live Tennis API"). A compound (provider, externalFixtureId) join key would therefore never
 *     match the same real fixture -- provider is stored here for audit only and is NEVER part of
 *     matching logic.
 *   - `scheduledStartAt` legitimately drifts between the two sides (avg ~25 min, max ~445 min
 *     across those 352 rows) because each engine's own independent 15-minute discovery cycle can
 *     capture the live provider's fixture at a different point as real-world order-of-play shifts
 *     the scheduled time over the course of a day. This is NOT an identity risk (player-ID pairs
 *     still matched exactly on every one of those rows) and is therefore never used to gate or
 *     invalidate a match -- both sides' values are stored for reference only.
 *
 * PROSPECTIVE ELIGIBILITY (membership never depends on the match result, the winner, or whether
 * the two engines agreed -- only on whether a genuine pre-match prediction independently existed
 * on both sides):
 *   - PE side: an evaluation_predictions row (run_kind='paper_trade') with lockedAt IS NOT NULL
 *     AND predictedWinnerId IS NOT NULL (status 'missed' never satisfies this -- a missed cutoff
 *     means no prediction was ever generated, and none is backfilled).
 *   - Builder side: a parlay_paper_trades row with frozenAt IS NOT NULL AND
 *     builderPickedPlayerId IS NOT NULL (the immutability trigger only allows frozenAt to be set
 *     once a real decision was made; disagreement/ineligibility/data-error paths never reach
 *     frozenAt with a picked player, so this gate alone already excludes them without needing to
 *     separately re-check crossSideAgreement here).
 *
 * The sync job (`services/matchedCohort/syncMatchedCohort.ts`) is the only writer. It is
 * idempotent (upsert on externalFixtureId) and runs on its own schedule
 * (`jobs/matchedCohortSyncScheduler.ts`), structurally separate from both engines' own schedulers.
 *
 * Deliberately NOT stored here: full evidence snapshots, factor breakdowns, or raw provider
 * payloads from either engine -- those remain queryable via the FK/reference fields
 * (`peEvaluationPredictionId`, `builderPairId`) against each engine's own tables. This table only
 * ever holds references plus small frozen summary scalars.
 */
export const matchedEngineCohortTable = pgTable(
  "matched_engine_cohort",
  {
    id: serial("id").primaryKey(),

    // ── Identity ────────────────────────────────────────────────────────────────────────────
    externalFixtureId: text("external_fixture_id").notNull(),
    player1Id: text("player1_id").notNull(),
    player1Name: text("player1_name").notNull(),
    player2Id: text("player2_id").notNull(),
    player2Name: text("player2_name").notNull(),
    tournamentName: text("tournament_name"),
    surface: text("surface"),
    matchFormat: text("match_format"),

    // ── Prediction Engine reference (frozen summary values only) ──────────────────────────────
    peEvaluationPredictionId: integer("pe_evaluation_prediction_id")
      .notNull()
      .references(() => evaluationPredictionsTable.id),
    /** Audit only -- see doc comment above. Never used for joining. */
    peProvider: text("pe_provider").notNull(),
    peScheduledStartAt: timestamp("pe_scheduled_start_at", { withTimezone: true }).notNull(),
    peLockedAt: timestamp("pe_locked_at", { withTimezone: true }).notNull(),
    pePredictedWinnerId: text("pe_predicted_winner_id").notNull(),
    pePredictedWinnerName: text("pe_predicted_winner_name").notNull(),
    /**
     * calibratedProbability as stored on evaluation_predictions is always player1-relative, not
     * picked-relative (the same subtlety previously fixed for adminShaping.ts's
     * canonicalCalibratedProbability). Reprojected here at sync time to be relative to
     * pePredictedWinnerId, 0-100 scale, so comparison metrics never need to know which side was
     * player1.
     */
    peCalibratedProbabilityForPick: real("pe_calibrated_probability_for_pick").notNull(),
    /** Snapshot of evaluation_predictions.status as of the last sync: pending | graded | void. */
    peStatus: text("pe_status").notNull(),
    peActualWinnerId: text("pe_actual_winner_id"),
    peResultType: text("pe_result_type"),
    peGradedAt: timestamp("pe_graded_at", { withTimezone: true }),

    // ── Parlay Builder reference (frozen summary values only) ─────────────────────────────────
    /** References parlay_paper_trade_pairs.pair_id -- not a DB-level FK (pairId is text, not a PK there), but the stable Builder-side identity for this fixture's decision. */
    builderPairId: text("builder_pair_id").notNull(),
    /** Audit only -- see doc comment above. Never used for joining. */
    builderProvider: text("builder_provider").notNull(),
    builderScheduledStartAt: timestamp("builder_scheduled_start_at", { withTimezone: true }).notNull(),
    builderFrozenAt: timestamp("builder_frozen_at", { withTimezone: true }).notNull(),
    builderPickedPlayerId: text("builder_picked_player_id").notNull(),
    builderCrossSideAgreement: boolean("builder_cross_side_agreement").notNull(),
    /** Already picked-relative by construction: the sibling row whose selectedPlayerId === builderPickedPlayerId. 0-100 scale, matching peCalibratedProbabilityForPick. */
    builderCalibratedProbabilityForPick: integer("builder_calibrated_probability_for_pick"),
    /** Snapshot of parlay_paper_trades.status as of the last sync. */
    builderStatus: text("builder_status").notNull(),
    builderActualWinnerId: text("builder_actual_winner_id"),
    builderResultType: text("builder_result_type"),
    builderGradedAt: timestamp("builder_graded_at", { withTimezone: true }),

    // ── Canonical outcome ───────────────────────────────────────────────────────────────────
    // Populated ONLY once both engines have independently, natively graded this fixture
    // (peStatus IN ('graded','void') AND builderStatus IN ('GRADED','VOID')). Never re-derived
    // from historical_matches or any other third source -- this table is never a second,
    // competing source of truth for "what actually happened"; it only cross-checks the two
    // engines' own already-computed results against each other.
    canonicalActualWinnerId: text("canonical_actual_winner_id"),
    canonicalGradedAt: timestamp("canonical_graded_at", { withTimezone: true }),
    /**
     * True once both sides have graded and their actualWinnerId (and cancelled/non-cancelled
     * status) genuinely agree. False -- never left null once both sides have graded -- means the
     * two engines' independent real-result lookups disagreed: a CANONICAL_RESULT_MISMATCH,
     * surfaced explicitly rather than silently resolved by preferring one side.
     */
    nativeGradingAgrees: boolean("native_grading_agrees"),

    // ── Derived comparison booleans ─────────────────────────────────────────────────────────
    /** Set as soon as both pre-match predictions exist -- independent of any result. */
    enginesAgreedOnPick: boolean("engines_agreed_on_pick").notNull(),
    /** Everything below is null until canonicalActualWinnerId is set (i.e. both sides graded and agreed). */
    peCorrect: boolean("pe_correct"),
    builderCorrect: boolean("builder_correct"),
    bothCorrect: boolean("both_correct"),
    bothWrong: boolean("both_wrong"),
    onlyPeCorrect: boolean("only_pe_correct"),
    onlyBuilderCorrect: boolean("only_builder_correct"),

    // ── Sync bookkeeping ────────────────────────────────────────────────────────────────────
    firstMatchedAt: timestamp("first_matched_at", { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("matched_engine_cohort_fixture_idx").on(table.externalFixtureId),
    index("matched_engine_cohort_canonical_graded_idx").on(table.canonicalGradedAt),
    index("matched_engine_cohort_pe_prediction_idx").on(table.peEvaluationPredictionId),
  ],
);

export const insertMatchedEngineCohortSchema = createInsertSchema(matchedEngineCohortTable).omit({
  id: true,
  firstMatchedAt: true,
});
export type InsertMatchedEngineCohort = z.infer<typeof insertMatchedEngineCohortSchema>;
export type MatchedEngineCohortRow = typeof matchedEngineCohortTable.$inferSelect;
