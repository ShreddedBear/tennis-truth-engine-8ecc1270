import { pgTable, serial, text, integer, jsonb, timestamp, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { calibrationModelsTable } from "./evaluation";

/**
 * Immutable historical version manifest for the independent Parlay Builder.
 *
 * Root cause this fixes: the Builder's live scoring path (`computeBuilderScore` in
 * `builderScoringService.ts`) has only ever had ONE algorithm configuration
 * (`BUILDER_VERSION = "1.0.0"`, unchanged since introduction), and its calibration lookup
 * (`getActiveCalibration()`) unconditionally returns whichever `calibration_models` row is
 * CURRENTLY `active = true` -- with no notion of "as of a given date", even when the caller is
 * scoring a historical match via `BuilderSnapshot.asOfDate`. That made every backfill/historical
 * score silently apply TODAY's algorithm+calibration to matches that occurred before either one
 * existed, with no record that this had happened.
 *
 * This table is the fix: an append-only, non-overlapping timeline of "which Builder
 * algorithm/calibration pairing was genuinely in force, starting at `effectiveFrom`". A row's
 * `effectiveTo` is null while it is the current/active version; a later row's insertion is
 * expected to close out the previous open row's `effectiveTo` in the same transaction (see
 * `builderVersioning.ts`'s `insertBuilderVersionManifest`). Rows are NEVER updated or deleted
 * once inserted (`sql/builder-version-manifest-immutable.sql` enforces this at the DB layer) --
 * closing a row means the NEXT row starts, not that history gets rewritten.
 *
 * `calibrationModelId` intentionally references `calibration_models` (Task #154's table) rather
 * than duplicating calibration state here: a Builder version is a pairing of (algorithm config,
 * whichever calibration model was genuinely active when this version's effectiveFrom began), not
 * a fork of calibration itself. It is nullable because a Builder version can legitimately have no
 * paired calibration yet (falls back to raw validationScore, exactly like the existing
 * `getActiveCalibration()` catch-fallback already does).
 *
 * `reconstructionMethod` and `confidence` exist because not every future manifest row will be a
 * direct code read: some may need to be reconstructed from git history, exported artifacts, or
 * documentation, and the two evidence classes must never be conflated. `provenance` carries the
 * actual supporting evidence (commit SHAs, dates, ablation run references, notes on any
 * conflicting evidence and how it was resolved) so a manifest row's validity is independently
 * auditable, never just asserted.
 */
export const builderVersionManifestsTable = pgTable(
  "parlay_builder_version_manifests",
  {
    id: serial("id").primaryKey(),

    /** Monotonically increasing, human-assigned (1, 2, 3, ...) -- never reused, never decreasing. */
    version: integer("version").notNull(),

    /** Inclusive. The instant this exact (algorithmConfig, calibrationModelId) pairing became the genuinely active one. */
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    /** Exclusive upper bound. Null means "still active" -- the current version. */
    effectiveTo: timestamp("effective_to", { withTimezone: true }),

    /**
     * Full snapshot of the factor weights + agreement-edge weights + thresholds that were
     * active for this version -- i.e. builderScoringService.ts's DEFAULT_WEIGHTS,
     * AGREEMENT_EDGE_WEIGHTS, and any decision thresholds, captured verbatim, not summarized.
     */
    algorithmConfig: jsonb("algorithm_config").notNull(),

    /** The calibration_models row genuinely active as of effectiveFrom, if any. */
    calibrationModelId: integer("calibration_model_id").references(() => calibrationModelsTable.id),

    /** Optimizer/tuning run that produced algorithmConfig, if one exists (e.g. auditParlayFactorWeights.ts run id). Null when the config was hand-set or no run id was ever recorded. */
    optimizerRunId: text("optimizer_run_id"),

    /** Git commit SHA the algorithmConfig was read from. Required -- every manifest row must be traceable to real source, never freehand. */
    sourceCommit: text("source_commit").notNull(),

    /** sha256 of a deterministic JSON serialization of algorithmConfig -- lets two manifest rows (or a manifest row and the live code) be compared for exact equality without diffing JSON by eye. */
    configFingerprint: text("config_fingerprint").notNull(),

    /** 'observed_from_source' | 'reconstructed_from_git_history' | 'reconstructed_from_export' -- see computeConfigFingerprint's callers for the full set actually used. */
    reconstructionMethod: text("reconstruction_method").notNull(),

    /** 'high' | 'partial' | 'unavailable' -- 'partial'/'unavailable' rows must still carry a provenance.gaps explanation, never silently look identical to 'high'. */
    confidence: text("confidence").notNull(),

    /** Evidence chain: { sourceCommitDate, weightsAblationCommit?, weightsAblationDate?, calibrationFittedAt?, conflictingEvidence?, notes }. Never empty for a real row. */
    provenance: jsonb("provenance").notNull().default({}),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    uniqueIndex("parlay_builder_version_manifests_version_idx").on(table.version),
    uniqueIndex("parlay_builder_version_manifests_fingerprint_idx").on(table.configFingerprint),
    index("parlay_builder_version_manifests_effective_from_idx").on(table.effectiveFrom),
    // At most one open (effectiveTo IS NULL) row at a time -- a partial unique index, not a
    // CHECK, because "at most one NULL" cannot be expressed as a row-local CHECK constraint.
    uniqueIndex("parlay_builder_version_manifests_one_open_idx")
      .on(table.effectiveTo)
      .where(sql`${table.effectiveTo} IS NULL`),
    check(
      "parlay_builder_version_manifests_interval_check",
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
  ],
);

export const insertBuilderVersionManifestSchema = createInsertSchema(builderVersionManifestsTable).omit({ id: true, createdAt: true });
export type InsertBuilderVersionManifest = z.infer<typeof insertBuilderVersionManifestSchema>;
export type BuilderVersionManifestRow = typeof builderVersionManifestsTable.$inferSelect;

/**
 * Machine-readable, per-match audit trail for a historical Builder lineage resolution attempt.
 * One row per (auditRunId, historicalMatchId) -- append-only, re-running the same audit under a
 * new auditRunId never overwrites a prior run's rows, so two runs' outputs can be diffed.
 *
 * This is what makes a historical replay attempt inspectable after the fact instead of
 * collapsing into a single pass/fail: `status` is always one of the six explicit
 * `BuilderLineageStatus` values (see `builderVersioning.ts`), never a generic error string.
 */
export const builderLineageAuditTable = pgTable(
  "parlay_builder_lineage_audit",
  {
    id: serial("id").primaryKey(),
    auditRunId: text("audit_run_id").notNull(),
    historicalMatchId: integer("historical_match_id").notNull(),
    cutoffAt: timestamp("cutoff_at", { withTimezone: true }).notNull(),

    /** VALID_HISTORICAL_LINEAGE | NO_BUILDER_DECISION | CALIBRATION_UNAVAILABLE | ALGORITHM_VERSION_UNAVAILABLE | CONFLICTING_LINEAGE | PIT_VIOLATION */
    status: text("status").notNull(),

    resolvedManifestId: integer("resolved_manifest_id").references(() => builderVersionManifestsTable.id),
    resolvedManifestVersion: integer("resolved_manifest_version"),
    resolvedCalibrationModelId: integer("resolved_calibration_model_id").references(() => calibrationModelsTable.id),

    /** Human-readable explanation of exactly why this status was reached -- never blank. */
    reason: text("reason").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("parlay_builder_lineage_audit_run_match_idx").on(table.auditRunId, table.historicalMatchId),
    index("parlay_builder_lineage_audit_status_idx").on(table.auditRunId, table.status),
  ],
);

export const insertBuilderLineageAuditSchema = createInsertSchema(builderLineageAuditTable).omit({ id: true, createdAt: true });
export type InsertBuilderLineageAudit = z.infer<typeof insertBuilderLineageAuditSchema>;
export type BuilderLineageAuditRow = typeof builderLineageAuditTable.$inferSelect;
