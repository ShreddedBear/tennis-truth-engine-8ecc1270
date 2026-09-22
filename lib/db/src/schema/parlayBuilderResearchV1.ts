import { pgTable, serial, text, integer, real, boolean, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * COUNTERFACTUAL_RESEARCH_V1 — isolated research/staging tables for a counterfactual Parlay
 * Builder backtest over the frozen 2026-04-22..2026-06-02 Prediction Engine cohort.
 *
 * This is explicitly NOT a claim that the production Parlay Builder existed or produced these
 * decisions historically -- confirmed by Phase 0 (see docs/historical-builder-integration/) that
 * it did not. It is a counterfactual research question: "what would a Builder-like independent
 * scoring layer, using ONLY information available before each match's own cutoffAt and NEVER
 * fit on this same cohort, have said?" Every row is tagged `researchBuilderVersion =
 * 'COUNTERFACTUAL_RESEARCH_V1'` so no downstream consumer can mistake it for
 * `PRODUCTION_BUILDER` output. These tables are never read by builderScoringService.ts,
 * builder_decision_log, or parlay_leg_outcomes, and nothing here ever writes to those either --
 * the production Builder and Prediction Engine boundary from Phase 0 is preserved unchanged.
 */
export const parlayBuilderResearchV1RunsTable = pgTable(
  "parlay_builder_research_v1_runs",
  {
    id: serial("id").primaryKey(),
    runId: text("run_id").notNull(),

    researchBuilderVersion: text("research_builder_version").notNull().default("COUNTERFACTUAL_RESEARCH_V1"),
    /** sha256 of the immutable Research V1 algorithm spec (factor set + equal weights + fixed decision thresholds). */
    configFingerprint: text("config_fingerprint").notNull(),
    algorithmConfig: jsonb("algorithm_config").notNull(),

    cohortStart: timestamp("cohort_start", { withTimezone: true }).notNull(),
    cohortEnd: timestamp("cohort_end", { withTimezone: true }).notNull(),
    /** sha256 over the stable-sorted list of canonical match ids in the cohort. */
    cohortFingerprint: text("cohort_fingerprint").notNull(),
    cohortMatchCount: integer("cohort_match_count").notNull(),

    /** queued -> running -> decisions_frozen -> outcomes_attached -> completed | failed */
    status: text("status").notNull().default("queued"),

    startedAt: timestamp("started_at", { withTimezone: true }),
    /** Set the instant every match's decision has been computed and written -- BEFORE any outcome is read or attached. */
    decisionsFrozenAt: timestamp("decisions_frozen_at", { withTimezone: true }),
    outcomesAttachedAt: timestamp("outcomes_attached_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** For the deterministic-rerun check: the other run this one was compared against, and whether every row matched. */
    deterministicComparisonRunId: text("deterministic_comparison_run_id"),
    deterministicMatch: boolean("deterministic_match"),
    /** sha256 over the stable-sorted (historicalMatchId, builderScore, builderDecision, pitStatus) tuples -- compared across runs for the determinism check. */
    resultSetFingerprint: text("result_set_fingerprint"),

    /** { total, eligible, ineligible, byRejectionReason, byPitStatus, byDecision } */
    summary: jsonb("summary").$type<Record<string, unknown>>(),

    errors: jsonb("errors").$type<Array<{ message: string; historicalMatchId?: number }>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("parlay_builder_research_v1_runs_run_id_idx").on(table.runId),
    index("parlay_builder_research_v1_runs_status_idx").on(table.status),
  ],
);

export const insertParlayBuilderResearchV1RunSchema = createInsertSchema(parlayBuilderResearchV1RunsTable).omit({ id: true, createdAt: true });
export type InsertParlayBuilderResearchV1Run = z.infer<typeof insertParlayBuilderResearchV1RunSchema>;
export type ParlayBuilderResearchV1RunRow = typeof parlayBuilderResearchV1RunsTable.$inferSelect;

/**
 * One row per (runId, historicalMatchId). Append-only per run -- a match is scored once per run;
 * re-running under a NEW runId never overwrites a prior run's rows, which is what makes the
 * deterministic-rerun comparison meaningful.
 *
 * `outcomeActualWinnerId`/`outcomeIncludedInAccuracy`/`outcomeCorrect` are populated by a SEPARATE
 * pass (`attachResearchV1Outcomes`) that only ever runs AFTER `decisionsFrozenAt` is set on the
 * owning run -- the decision-computation pass never reads them, so an outcome can never leak into
 * the Builder's own score or decision for that same match.
 */
export const parlayBuilderResearchV1ResultsTable = pgTable(
  "parlay_builder_research_v1_results",
  {
    id: serial("id").primaryKey(),
    runId: text("run_id").notNull(),

    historicalMatchId: integer("historical_match_id").notNull(),
    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }).notNull(),
    cutoffAt: timestamp("cutoff_at", { withTimezone: true }).notNull(),

    player1Id: text("player1_id").notNull(),
    player1Name: text("player1_name").notNull(),
    player2Id: text("player2_id").notNull(),
    player2Name: text("player2_name").notNull(),
    surface: text("surface"),

    /** Read-only reference to the Prediction Engine's own already-computed, already-PIT-verified output for this match -- never used to derive the Research Builder's own independent score (see researchBuilderV1.ts doc). Null when no Prediction Engine row was found. */
    predictionEngineOutput: jsonb("prediction_engine_output").$type<Record<string, unknown> | null>(),

    researchBuilderVersion: text("research_builder_version").notNull().default("COUNTERFACTUAL_RESEARCH_V1"),
    configFingerprint: text("config_fingerprint").notNull(),
    /** Always null for V1 -- no calibration curve is fit (would require either post-cutoff data or fitting on this same cohort). Present for schema forward-compatibility with a future, genuinely PIT-safe calibrated version. */
    calibrationSnapshotId: text("calibration_snapshot_id"),
    calibrationFittedAt: timestamp("calibration_fitted_at", { withTimezone: true }),

    /** Raw, uncalibrated 0-100 score -- the equal-weighted average of available factor scores. */
    builderScore: real("builder_score"),
    builderPickedPlayerId: text("builder_picked_player_id"),
    builderDecision: text("builder_decision"), // KEEP | BORDERLINE | REMOVE | null (when ineligible)

    /** ELIGIBLE | INELIGIBLE */
    eligibility: text("eligibility").notNull(),
    rejectionReason: text("rejection_reason"),

    /** VALID_PIT | PIT_VIOLATION */
    pitStatus: text("pit_status").notNull(),

    dataCoverage: real("data_coverage"),
    factorScores: jsonb("factor_scores").$type<Record<string, unknown>>(),

    outcomeActualWinnerId: text("outcome_actual_winner_id"),
    outcomeIncludedInAccuracy: boolean("outcome_included_in_accuracy"),
    outcomeCorrect: boolean("outcome_correct"),

    provenance: jsonb("provenance").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("parlay_builder_research_v1_results_run_match_idx").on(table.runId, table.historicalMatchId),
    index("parlay_builder_research_v1_results_decision_idx").on(table.runId, table.builderDecision),
    index("parlay_builder_research_v1_results_eligibility_idx").on(table.runId, table.eligibility),
  ],
);

export const insertParlayBuilderResearchV1ResultSchema = createInsertSchema(parlayBuilderResearchV1ResultsTable).omit({ id: true, createdAt: true });
export type InsertParlayBuilderResearchV1Result = z.infer<typeof insertParlayBuilderResearchV1ResultSchema>;
export type ParlayBuilderResearchV1ResultRow = typeof parlayBuilderResearchV1ResultsTable.$inferSelect;
