import { pgTable, serial, text, integer, real, boolean, jsonb, timestamp, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { calibrationModelsTable } from "./evaluation";

/**
 * LIVE_PRODUCTION_PAPER_TRADING — the genuine prospective record of what the CURRENT
 * production Parlay Builder (`computeBuilderScore` / `builderScoringService.ts`, unmodified)
 * would decide about an upcoming match, decided before it starts and graded after it finishes.
 *
 * Explicitly NOT COUNTERFACTUAL_RESEARCH_V1 (`parlayBuilderResearchV1.ts`): that table answers
 * a retrospective "what would an independent Builder-shaped scorer have said" research question
 * over a frozen historical cohort. This table is the opposite in every relevant way: it is
 * forward-looking, uses the real production scoring function as-is (not an equal-weighted
 * research variant), and accumulates indefinitely as real matches happen. Nothing here is ever
 * read by parlayBuilderResearchV1 code, and nothing there is ever read by this.
 *
 * DOUBLE-SIDED: the Builder's scoring API takes a `selectedPlayerId` to validate — there is no
 * "player1/player2" framing in `computeBuilderScore` itself, and no human is picking a side for
 * an autonomous job. So every fixture gets exactly TWO rows here (`evaluated_side` = PLAYER_1 /
 * PLAYER_2), both scored from the SAME frozen evidence snapshot (see
 * `parlay_paper_trade_snapshots`, keyed by `pair_id` so the two sibling rows are structurally
 * forced to share one evidence read, not just asserted to). `builder_picked_player_id` is the
 * actual graded prediction (the Builder's own independent pick, symmetric by construction); the
 * KEEP/BORDERLINE/REMOVE `decision` is a trust/validation label scoped to `selected_player_id`
 * and is NEVER the accuracy target — see `parlay_paper_trade_pairs.cross_side_agreement` for the
 * integrity check that `builder_picked_player_id` actually agrees between the two sibling rows.
 *
 * Lifecycle: DISCOVERED -> ELIGIBLE -> SNAPSHOTTED -> DECIDED -> FROZEN -> STARTED -> COMPLETED
 * -> GRADED, with terminal non-decision states NO_DECISION / INELIGIBLE / CANCELLED / VOID /
 * DATA_ERROR. A row exists even for a rejected/no-decision fixture (with `no_decision_reason`
 * set) -- fixtures are never silently dropped.
 *
 * Immutability (`parlay_paper_trades_immutable` trigger, `ensureEvaluationSchema.ts`): identity
 * fields (paper_trade_id, external_fixture_id, pair_id, evaluated_side, selected/opposing player
 * ids) are fixed from insert. Once `frozen_at` is set, every decision/evidence/lineage field is
 * permanently locked; only `status`, `match_started_at`, `outcome_attached_at`, `graded_at`, and
 * the outcome/grading columns may still change, and each of those only as a one-time
 * NULL -> value transition (never re-changed once set) -- the exact pattern
 * `parlay_builder_research_v1_results_immutable` already uses for outcome attachment.
 */
export const parlayPaperTradesTable = pgTable(
  "parlay_paper_trades",
  {
    id: serial("id").primaryKey(),
    paperTradeId: text("paper_trade_id").notNull(),

    /** Shared by exactly the two sibling rows (PLAYER_1 and PLAYER_2) for one fixture+lineage evaluation. */
    pairId: text("pair_id").notNull(),

    externalFixtureId: text("external_fixture_id").notNull(),
    fixtureProvider: text("fixture_provider").notNull().default("live-tennis-api"),

    player1Id: text("player1_id").notNull(),
    player1Name: text("player1_name").notNull(),
    player2Id: text("player2_id").notNull(),
    player2Name: text("player2_name").notNull(),

    tournamentName: text("tournament_name"),
    tournamentLevel: text("tournament_level"),
    round: text("round"),
    surface: text("surface"),
    matchFormat: text("match_format"),

    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }).notNull(),

    /** PLAYER_1 | PLAYER_2 -- which fixture player this row's computeBuilderScore call named `selectedPlayerId`. */
    evaluatedSide: text("evaluated_side").notNull(),
    selectedPlayerId: text("selected_player_id").notNull(),
    opposingPlayerId: text("opposing_player_id").notNull(),

    /**
     * DISCOVERED | ELIGIBLE | SNAPSHOTTED | DECIDED | FROZEN | STARTED | COMPLETED | GRADED
     * | NO_DECISION | INELIGIBLE | CANCELLED | VOID | DATA_ERROR
     */
    status: text("status").notNull().default("DISCOVERED"),
    /** Machine-readable reason code, required whenever status is a terminal non-decision state. */
    noDecisionReason: text("no_decision_reason"),

    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    /** Fixture-level: how far before scheduledStartAt the job is willing to decide. Strictly before scheduledStartAt. */
    decisionCutoffAt: timestamp("decision_cutoff_at", { withTimezone: true }).notNull(),
    decisionAt: timestamp("decision_at", { withTimezone: true }),
    frozenAt: timestamp("frozen_at", { withTimezone: true }),
    matchStartedAt: timestamp("match_started_at", { withTimezone: true }),
    outcomeAttachedAt: timestamp("outcome_attached_at", { withTimezone: true }),
    gradedAt: timestamp("graded_at", { withTimezone: true }),

    /** Verbatim BUILDER_VERSION at decision time. */
    builderVersion: text("builder_version"),
    /** sha256 fingerprint of the live DEFAULT_WEIGHTS/AGREEMENT_EDGE_WEIGHTS/threshold config at decision time -- see parlay_builder_version_manifests. */
    builderConfigFingerprint: text("builder_config_fingerprint"),
    /** Verbatim BuilderLineageStatus (builderVersioning.ts) for this decision. */
    builderLineageStatus: text("builder_lineage_status"),
    builderLineageReason: text("builder_lineage_reason"),
    calibrationModelId: integer("calibration_model_id").references(() => calibrationModelsTable.id),
    /**
     * Always-non-null derived key = builderConfigFingerprint + ':' + (calibrationModelId or
     * 'no-calibration') + ':' + builderLineageStatus. Exists so the duplicate-side-evaluation
     * unique index below never has to compare a nullable calibrationModelId directly --
     * Postgres treats every NULL as distinct from every other NULL, so a plain
     * UNIQUE(..., calibration_model_id) would silently allow duplicate CALIBRATION_UNAVAILABLE
     * rows for the same fixture+side. This column removes that pitfall entirely.
     */
    lineageKey: text("lineage_key").notNull(),

    /** KEEP | BORDERLINE | REMOVE | DATA_UNAVAILABLE -- a trust/validation label scoped to selectedPlayerId. NEVER the accuracy target. */
    decision: text("decision"),
    /** = computeBuilderScore(...).validationScore for THIS side. */
    selectedPlayerScore: integer("selected_player_score"),
    /** = computeBuilderScore(...).riskScore for THIS side. */
    selectedPlayerRiskScore: integer("selected_player_risk_score"),
    /** The Builder's own independent pick (physically a player id) -- THE prospective prediction, graded via actual_winner_id. */
    builderPickedPlayerId: text("builder_picked_player_id"),
    builderCalibratedProbability: integer("builder_calibrated_probability"),
    rawValidationScore: integer("raw_validation_score"),
    dataCoverage: integer("data_coverage"),

    /** Git SHA of the running server at decision time. */
    sourceCommit: text("source_commit").notNull(),
    /** sha256 of the canonicalized parlay_paper_trade_snapshots row this decision was computed from. */
    snapshotFingerprint: text("snapshot_fingerprint"),

    /** Outcome / settlement (populated only after the match completes). */
    actualWinnerId: text("actual_winner_id"),
    /** normal | walkover | retired | cancelled */
    resultType: text("result_type"),
    includedInAccuracy: boolean("included_in_accuracy"),
    /** = (actualWinnerId IS NOT NULL AND actualWinnerId = builderPickedPlayerId). Null until graded. */
    gradedCorrect: boolean("graded_correct"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("parlay_paper_trades_paper_trade_id_idx").on(table.paperTradeId),
    // The Phase-10 duplicate-side-evaluation guard: at most one row per (fixture, side,
    // lineage) -- lineageKey is always non-null so this behaves correctly even when
    // calibrationModelId is null (CALIBRATION_UNAVAILABLE), unlike a raw nullable-column unique.
    uniqueIndex("parlay_paper_trades_fixture_side_lineage_idx").on(
      table.externalFixtureId, table.evaluatedSide, table.lineageKey,
    ),
    // Exactly one PLAYER_1 and one PLAYER_2 row per pair.
    uniqueIndex("parlay_paper_trades_pair_side_idx").on(table.pairId, table.evaluatedSide),
    index("parlay_paper_trades_status_idx").on(table.status),
    index("parlay_paper_trades_scheduled_start_idx").on(table.scheduledStartAt),
    check(
      "parlay_paper_trades_evaluated_side_check",
      sql`${table.evaluatedSide} IN ('PLAYER_1', 'PLAYER_2')`,
    ),
    check(
      "parlay_paper_trades_decision_cutoff_check",
      sql`${table.decisionCutoffAt} < ${table.scheduledStartAt}`,
    ),
  ],
);

export const insertParlayPaperTradeSchema = createInsertSchema(parlayPaperTradesTable).omit({ id: true, createdAt: true });
export type InsertParlayPaperTrade = z.infer<typeof insertParlayPaperTradeSchema>;
export type ParlayPaperTradeRow = typeof parlayPaperTradesTable.$inferSelect;

/**
 * Fixture-level cross-side integrity record — one row per (external_fixture_id, lineage_key)
 * evaluation pair, i.e. exactly one row per sibling pair in `parlay_paper_trades`.
 *
 * `builderPickedPlayerId` derives from the same underlying, symmetric evidence in both
 * directional passes, so it MUST physically agree between the two sibling rows (barring the
 * exact-50/tie boundary). This table is where that check is actually performed and recorded --
 * see the user-facing rule: disagreement fails closed (both rows marked DATA_ERROR/NO_DECISION,
 * never silently resolved by picking one side), and both raw evaluations are preserved either way.
 */
export const parlayPaperTradePairsTable = pgTable(
  "parlay_paper_trade_pairs",
  {
    id: serial("id").primaryKey(),
    pairId: text("pair_id").notNull(),
    externalFixtureId: text("external_fixture_id").notNull(),
    lineageKey: text("lineage_key").notNull(),
    player1TradeId: text("player1_trade_id"),
    player2TradeId: text("player2_trade_id"),
    crossSideAgreement: boolean("cross_side_agreement"),
    /** Machine-readable reason when crossSideAgreement is false -- e.g. "DISAGREE:playerA-vs-playerB" or "TIE_BOUNDARY". */
    crossSideDisagreementReason: text("cross_side_disagreement_reason"),
    crossSideCheckedAt: timestamp("cross_side_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("parlay_paper_trade_pairs_pair_id_idx").on(table.pairId),
    uniqueIndex("parlay_paper_trade_pairs_fixture_lineage_idx").on(table.externalFixtureId, table.lineageKey),
  ],
);

export const insertParlayPaperTradePairSchema = createInsertSchema(parlayPaperTradePairsTable).omit({ id: true, createdAt: true });
export type InsertParlayPaperTradePair = z.infer<typeof insertParlayPaperTradePairSchema>;
export type ParlayPaperTradePairRow = typeof parlayPaperTradePairsTable.$inferSelect;

/**
 * Persisted factor-level evidence — one row per (paper_trade_id, factor_key), i.e. the exact
 * `FactorScore[]` `computeBuilderScore` returned for THIS side's evaluation. Append-only.
 */
export const parlayPaperTradeFactorsTable = pgTable(
  "parlay_paper_trade_factors",
  {
    id: serial("id").primaryKey(),
    paperTradeId: text("paper_trade_id").notNull(),
    factorKey: text("factor_key").notNull(),
    factorLabel: text("factor_label").notNull(),
    score: real("score"),
    weight: real("weight").notNull(),
    /** available | unavailable | limited */
    status: text("status").notNull(),
    supportsSelected: boolean("supports_selected"),
    detail: text("detail").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("parlay_paper_trade_factors_trade_factor_idx").on(table.paperTradeId, table.factorKey),
  ],
);

export const insertParlayPaperTradeFactorSchema = createInsertSchema(parlayPaperTradeFactorsTable).omit({ id: true, createdAt: true });
export type InsertParlayPaperTradeFactor = z.infer<typeof insertParlayPaperTradeFactorSchema>;
export type ParlayPaperTradeFactorRow = typeof parlayPaperTradeFactorsTable.$inferSelect;

/**
 * The immutable, shared evidence snapshot for one (external_fixture_id, lineage_key) pair --
 * keyed by `pair_id`, NOT by paper_trade_id, so there is exactly ONE snapshot row per fixture
 * evaluation and the two sibling `parlay_paper_trades` rows are structurally forced to reference
 * the same frozen evidence rather than merely being asserted to share it. This is what makes
 * `acquireBuilderEvidence()` being called exactly once per fixture a schema-enforced fact, not
 * just an application-level convention.
 *
 * Raw match rows / H2H rows / odds / injury-research / matchstat payloads are stored so a later
 * audit can answer "what exactly did the Builder know when it made this decision" without a new
 * live provider request (Phase 12's auditability requirement) -- see also `fingerprint`, a sha256
 * of the canonicalized bundle, which every sibling `parlay_paper_trades.snapshot_fingerprint`
 * must match.
 */
export const parlayPaperTradeSnapshotsTable = pgTable(
  "parlay_paper_trade_snapshots",
  {
    id: serial("id").primaryKey(),
    pairId: text("pair_id").notNull(),
    effectiveCeiling: timestamp("effective_ceiling", { withTimezone: true }).notNull(),
    player1MatchRows: jsonb("player1_match_rows").notNull(),
    player2MatchRows: jsonb("player2_match_rows").notNull(),
    h2hRows: jsonb("h2h_rows").notNull(),
    marketOddsRaw: jsonb("market_odds_raw"),
    injuryResearchRaw: jsonb("injury_research_raw"),
    matchstatRaw: jsonb("matchstat_raw"),
    fingerprint: text("fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("parlay_paper_trade_snapshots_pair_id_idx").on(table.pairId),
  ],
);

export const insertParlayPaperTradeSnapshotSchema = createInsertSchema(parlayPaperTradeSnapshotsTable).omit({ id: true, createdAt: true });
export type InsertParlayPaperTradeSnapshot = z.infer<typeof insertParlayPaperTradeSnapshotSchema>;
export type ParlayPaperTradeSnapshotRow = typeof parlayPaperTradeSnapshotsTable.$inferSelect;
