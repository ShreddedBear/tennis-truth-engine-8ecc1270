import { pgTable, serial, text, integer, real, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { evaluationPredictionsTable } from "./evaluation";

/**
 * Forward-looking market-evidence capture (see docs/design/market-evidence-capture-contract.md
 * for the full design rationale). One row per market-evidence-capture ATTEMPT for one matchup,
 * taken at one instant -- never overwritten, never backfilled. "Attempt", not just "success": a
 * row is written whether or not the attempt actually produced a usable quote, so the table can
 * answer both "what was the market?" (captureStatus = "included") and "why did this prediction
 * have no market?" (captureStatus = "no_market_available" | "provider_not_configured" |
 * "provider_error" -- see captureStatus's own comment below and design doc section A). A "no
 * market" row is a legitimate, expected row shape, not a malformed one -- see the nullability
 * notes on the odds/probability/isEligible columns below and the CHECK constraint in the
 * migration file that enforces exactly which columns are populated for which captureStatus.
 *
 * This is deliberately a NEW table rather than a retrofit of `predictions.oddsStatus`/odds columns
 * or `parlay_leg_outcomes.market_odds`: (a) those columns are single-slot -- a row can hold exactly
 * one odds observation, so a matchup observed multiple times before cutoff (price movement is
 * itself evidence) has nowhere to go, and (b) `parlay_leg_outcomes` only stores an
 * already-derived `market_odds NUMERIC`, with no raw two-sided price and no capture timestamp.
 * `market_snapshots` is the general-purpose, provider-agnostic, multi-observation table both the
 * Prediction Engine and Parlay Builder capture paths can write into; the existing single-slot
 * columns remain as the "odds at lock time" convenience copies they already are.
 *
 * Every row stores RAW decimal odds for both sides (the auditable primitive) plus two SEPARATELY
 * computed derived probabilities, so a later re-derivation can be checked against what was
 * actually stored rather than trusting a single pre-computed number:
 *   - `normalizedProbabilityPlayer1`: naive 1/odds, normalized so both sides sum to 1 (the
 *     Builder's `1 / marketOdds` convention, generalized to two-sided renormalization).
 *   - `devigProbabilityPlayer1`: `computeVigAdjustedImpliedProbability`'s proportional-overround
 *     removal (the Prediction Engine's convention; see services/oddsData/impliedProbability.ts).
 * Both are computable from `oddsPlayer1Decimal`/`oddsPlayer2Decimal` alone -- they are stored
 * redundantly (not read from) purely so a reader never has to re-run the transformation to spot-
 * check it, and so a future change to either formula is visible as a stored-vs-recomputed diff
 * instead of silently changing history.
 */
export const marketSnapshotsTable = pgTable(
  "market_snapshots",
  {
    id: serial("id").primaryKey(),

    // ── Provenance ──────────────────────────────────────────────────────────────────────────────
    // Free-form identifier for the single capture invocation that produced this row (e.g. a UUID
    // minted once per paper-trading cycle or per Builder /validate call) -- lets every snapshot
    // written by the same run be grouped/audited together without re-deriving "same run" from
    // timestamps alone.
    captureRunId: text("capture_run_id").notNull(),
    // git SHA of the worktree HEAD at capture time, read live via readCurrentCommit() (see
    // captureMarketSnapshot.ts) -- never hardcoded.
    capturedByCommit: text("captured_by_commit").notNull(),
    // Which internal pipeline performed the capture, e.g. "paperTradingCycle" or
    // "builderValidate" -- lets a reader tell the two capture paths apart without joining back to
    // predictionId/legId (which are nullable and mutually exclusive; see below).
    capturePipeline: text("capture_pipeline").notNull(),

    // ── Linkage (dual nullable FK -- see design doc section A for the "why not two tables"
    // decision). Exactly one of predictionId / legId is set per row; the CHECK constraint in the
    // migration enforces this at the DB level, not just by convention. ─────────────────────────
    predictionId: integer("prediction_id").references(() => evaluationPredictionsTable.id),
    // References parlay_leg_outcomes.id. Not a Drizzle FK here because parlay_leg_outcomes is
    // deliberately outside Drizzle ownership -- enforced instead by the raw-SQL FK in the
    // migration file.
    legId: integer("leg_id"),

    // ── Timing (the eligibility invariant's inputs) ────────────────────────────────────────────
    // When this specific market observation was taken. Set by the capturing code from the
    // provider's own fetch time when available, else from the capture module's own clock --
    // never backdated and never defaulted from `predictionCutoffAt`.
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    // Denormalized copy of the linked prediction/leg's cutoff instant, frozen at write time so a
    // later change to the parent row's cutoff (should one ever occur) cannot retroactively flip
    // an already-written snapshot's eligibility. This is the right-hand side of the invariant
    // `capturedAt <= predictionCutoffAt`; see isSnapshotEligible() in captureMarketSnapshot.ts.
    predictionCutoffAt: timestamp("prediction_cutoff_at", { withTimezone: true }).notNull(),
    // Set (write-time enforcement, see design doc section B) whenever capturedAt > predictionCutoffAt
    // at insert time -- ONLY when captureStatus = "included". A successful snapshot is never
    // silently dropped for being late -- it is still written, but flagged, so late-arriving data
    // is visible and auditable rather than invisible. Every read path that computes
    // prediction-time experiment evidence MUST filter `WHERE is_eligible = true` (see
    // market_snapshots_eligible view in the migration file).
    //
    // NULL (not false, not true) for every non-"included" captureStatus. "Ineligible" (false)
    // means "this WAS a real market observation, just a late one" -- that claim doesn't apply to
    // a row that never captured an observation at all (no_market_available /
    // provider_not_configured / provider_error). There is no captured_at-vs-cutoff_at question to
    // answer when there is no captured odds timestamp to compare -- capturedAt on those rows is
    // the ATTEMPT time, not an observation time, and comparing an attempt time to the cutoff would
    // silently manufacture a false eligibility signal for a row with no evidence in it. NULL is
    // "not applicable", the third truth value this column actually needs. See design doc section B
    // ("attempt-aware eligibility") for the full reasoning and the CHECK constraint in the
    // migration file that enforces this NULL-iff-non-included shape at the DB level.
    isEligible: boolean("is_eligible"),

    /**
     * Task #146 (corrected) vocabulary (see services/oddsData/index.ts's `OddsStatus` doc
     * comment), reused verbatim as this row's capture outcome -- one row is now written for every
     * capture ATTEMPT, not only for a successful one (see file header):
     * - "included"                — a real quote was captured; the odds/derived-probability
     *                              columns below and `isEligible` are all populated.
     * - "no_market_available"     — a configured, working provider was queried and genuinely had
     *                              no odds for this matchup.
     * - "provider_not_configured" — no provider had an API key set at all; nothing was queried.
     * - "provider_error"          — a configured provider threw (quota/network/circuit-open).
     * For every status other than "included", the odds/derived-probability columns and
     * `isEligible` are NULL (see each column's own comment) -- enforced by a CHECK constraint in
     * the migration file, not just by convention.
     */
    captureStatus: text("capture_status").notNull().$type<"included" | "no_market_available" | "provider_not_configured" | "provider_error">(),

    // ── Market identity ─────────────────────────────────────────────────────────────────────────
    // e.g. "TheOddsAPI" | "OddsApiIo" -- the actual upstream odds source. NULL only when
    // captureStatus = "provider_not_configured" (there is no provider to name -- none was even
    // constructed). Populated (which provider was queried/threw/came back empty) for every other
    // status, including the no-quote ones, so a "why no market" row still says which provider was
    // asked.
    provider: text("provider"),
    // e.g. "h2h_moneyline" -- reserved for future market types (spreads, totals) without a schema
    // change; today only moneyline is ever written.
    marketType: text("market_type").notNull().default("h2h_moneyline"),

    player1Id: text("player1_id").notNull(),
    player1Name: text("player1_name").notNull(),
    player2Id: text("player2_id").notNull(),
    player2Name: text("player2_name").notNull(),

    // ── Raw odds (the auditable primitive) ─────────────────────────────────────────────────────
    // Decimal odds, both sides, exactly as returned by the provider. Never adjusted, never
    // rounded beyond what the provider itself returns. This is the one value that must survive
    // even if every derived-probability formula in this codebase changes later. NULL whenever
    // captureStatus != "included" -- there is no raw price to store when no quote was captured;
    // this is the expected, legitimate shape of a "no market" attempt row, not a missing-data bug.
    oddsPlayer1Decimal: real("odds_player1_decimal"),
    oddsPlayer2Decimal: real("odds_player2_decimal"),

    // ── Derived probabilities (both computable from the raw odds above; stored redundantly for
    // auditability, never as the sole record -- see file header). NULL whenever captureStatus !=
    // "included", for the same reason as the raw odds above -- nothing to derive from. ──────────
    normalizedProbabilityPlayer1: real("normalized_probability_player1"),
    devigProbabilityPlayer1: real("devig_probability_player1"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One capture run should never write the same (predictionId, providerish) pairing twice --
    // repeat observations are legitimate (price movement) but must come from distinct capture
    // runs, never a retry double-write within the same run.
    uniqueIndex("market_snapshots_prediction_run_idx").on(table.predictionId, table.captureRunId),
    uniqueIndex("market_snapshots_leg_run_idx").on(table.legId, table.captureRunId),
    index("market_snapshots_prediction_idx").on(table.predictionId),
    index("market_snapshots_leg_idx").on(table.legId),
    // Backs the eligibility view/query helper's WHERE clause.
    index("market_snapshots_eligible_idx").on(table.isEligible, table.capturedAt),
    // Backs "why did this prediction have no market?" queries grouped by outcome.
    index("market_snapshots_capture_status_idx").on(table.captureStatus),
  ],
);

export const insertMarketSnapshotSchema = createInsertSchema(marketSnapshotsTable).omit({ id: true, createdAt: true });
export type InsertMarketSnapshot = z.infer<typeof insertMarketSnapshotSchema>;
export type MarketSnapshotRow = typeof marketSnapshotsTable.$inferSelect;
