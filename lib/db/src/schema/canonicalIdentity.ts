import { boolean, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Additive provider-independent identity registry. Existing provider IDs remain untouched. */
export const canonicalPlayersTable = pgTable("canonical_players", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  tour: text("tour"),
  nationality: text("nationality"),
  dateOfBirth: timestamp("date_of_birth", { withTimezone: true }),
  handedness: text("handedness"),
  heightCm: integer("height_cm"),
  activeFrom: timestamp("active_from", { withTimezone: true }),
  activeTo: timestamp("active_to", { withTimezone: true }),
  reviewStatus: text("review_status").notNull().default("approved"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("canonical_players_normalized_name_idx").on(table.normalizedName),
  index("canonical_players_tour_idx").on(table.tour),
]);

export const playerAliasesTable = pgTable("player_aliases", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  externalPlayerId: text("external_player_id").notNull(),
  externalPlayerName: text("external_player_name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  canonicalPlayerId: text("canonical_player_id").notNull().references(() => canonicalPlayersTable.id),
  aliasType: text("alias_type").notNull().default("provider-id"),
  verificationStatus: text("verification_status").notNull().default("verified"),
  metadata: jsonb("metadata").notNull().default({}),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("player_aliases_provider_external_id_idx").on(table.provider, table.externalPlayerId),
  index("player_aliases_normalized_name_idx").on(table.normalizedName),
  index("player_aliases_canonical_player_idx").on(table.canonicalPlayerId),
]);

export const tournamentCrosswalksTable = pgTable("provider_tournament_crosswalks", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  externalTournamentId: text("external_tournament_id").notNull(),
  externalTournamentName: text("external_tournament_name").notNull(),
  canonicalTournamentId: text("canonical_tournament_id").notNull(),
  canonicalTournamentName: text("canonical_tournament_name").notNull(),
  tour: text("tour").notNull(),
  competitionLevel: text("competition_level").notNull(),
  verificationStatus: text("verification_status").notNull().default("verified"),
  resolutionMethod: text("resolution_method").notNull(),
  evidenceSource: text("evidence_source").notNull(),
  evidenceId: text("evidence_id").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("provider_tournament_crosswalk_provider_external_idx")
    .on(table.provider, table.externalTournamentId),
  index("provider_tournament_crosswalk_canonical_idx").on(table.canonicalTournamentId),
]);

export const canonicalMatchesTable = pgTable("canonical_matches", {
  id: text("id").primaryKey(),
  matchKey: text("match_key").notNull(),
  playerAId: text("player_a_id").notNull().references(() => canonicalPlayersTable.id),
  playerBId: text("player_b_id").notNull().references(() => canonicalPlayersTable.id),
  tournamentName: text("tournament_name"),
  normalizedTournamentName: text("normalized_tournament_name"),
  tour: text("tour"),
  eventLevel: text("event_level"),
  matchDate: timestamp("match_date", { withTimezone: true }),
  round: text("round"),
  surface: text("surface"),
  drawType: text("draw_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("canonical_matches_match_key_idx").on(table.matchKey)]);

export const matchSourceLinksTable = pgTable("match_source_links", {
  id: text("id").primaryKey(),
  canonicalMatchId: text("canonical_match_id").notNull().references(() => canonicalMatchesTable.id),
  provider: text("provider").notNull(),
  externalMatchId: text("external_match_id").notNull(),
  sourcePayload: jsonb("source_payload").notNull().default({}),
  sourceTimestamp: timestamp("source_timestamp", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("match_source_links_provider_external_id_idx").on(table.provider, table.externalMatchId),
  index("match_source_links_canonical_match_idx").on(table.canonicalMatchId),
]);

/** Independently verified result links; date semantics are explicit and never implied. */
export const matchCrosswalksTable = pgTable("provider_match_crosswalks", {
  id: text("id").primaryKey(),
  liveProvider: text("live_provider").notNull(),
  liveExternalMatchId: text("live_external_match_id").notNull(),
  independentProvider: text("independent_provider").notNull(),
  independentExternalMatchId: text("independent_external_match_id").notNull(),
  canonicalMatchId: text("canonical_match_id").notNull(),
  player1CanonicalId: text("player1_canonical_id").notNull().references(() => canonicalPlayersTable.id),
  player2CanonicalId: text("player2_canonical_id").notNull().references(() => canonicalPlayersTable.id),
  canonicalTournamentId: text("canonical_tournament_id").notNull(),
  round: text("round").notNull(),
  score: text("score").notNull(),
  winnerCanonicalId: text("winner_canonical_id").notNull().references(() => canonicalPlayersTable.id),
  linkageMethod: text("linkage_method").notNull(),
  dateSemantics: text("date_semantics").notNull(),
  evidenceId: text("evidence_id").notNull(),
  provenance: jsonb("provenance").notNull().default({}),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("provider_match_crosswalk_live_match_idx")
    .on(table.liveProvider, table.liveExternalMatchId),
  uniqueIndex("provider_match_crosswalk_independent_match_idx")
    .on(table.independentProvider, table.independentExternalMatchId),
  uniqueIndex("provider_match_crosswalk_canonical_match_idx")
    .on(table.canonicalMatchId),
]);

export const evaluationHoldoutPopulationsTable = pgTable("evaluation_holdout_populations", {
  id: text("id").primaryKey(),
  windowFrom: text("window_from").notNull(),
  windowTo: text("window_to").notNull(),
  candidateFingerprint: text("candidate_fingerprint").notNull(),
  eligibleFingerprint: text("eligible_fingerprint").notNull(),
  candidateCount: integer("candidate_count").notNull(),
  eligibleCount: integer("eligible_count").notNull(),
  finalized: boolean("finalized").notNull().default(false),
  provenance: jsonb("provenance").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("evaluation_holdout_populations_eligible_fingerprint_idx")
    .on(table.eligibleFingerprint),
  uniqueIndex("evaluation_holdout_populations_window_idx")
    .on(table.windowFrom, table.windowTo),
]);

export const evaluationHoldoutMembersTable = pgTable("evaluation_holdout_members", {
  populationId: text("population_id").notNull()
    .references(() => evaluationHoldoutPopulationsTable.id),
  fixtureId: text("fixture_id").notNull(),
  fixture: jsonb("fixture").notNull(),
  admission: jsonb("admission").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("evaluation_holdout_members_population_fixture_idx")
    .on(table.populationId, table.fixtureId),
]);

export const playerResolutionReviewsTable = pgTable("player_resolution_reviews", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  provider: text("provider"),
  externalPlayerId: text("external_player_id"),
  externalPlayerName: text("external_player_name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  candidateCanonicalIds: jsonb("candidate_canonical_ids").notNull().default([]),
  resolutionMethod: text("resolution_method").notNull(),
  confidence: real("confidence").notNull(),
  supportingMetadata: jsonb("supporting_metadata").notNull().default({}),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const historicalFeatureDiagnosticsTable = pgTable("historical_feature_diagnostics", {
  id: text("id").primaryKey(),
  canonicalPlayerId: text("canonical_player_id").notNull().references(() => canonicalPlayersTable.id),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  matchesFound: integer("matches_found").notNull().default(0),
  dateFrom: timestamp("date_from", { withTimezone: true }),
  dateTo: timestamp("date_to", { withTimezone: true }),
  surfaceMatchesFound: integer("surface_matches_found").notNull().default(0),
  opponentQualitySample: integer("opponent_quality_sample").notNull().default(0),
  serveReturnSampleSize: integer("serve_return_sample_size").notNull().default(0),
  resolutionMethod: text("resolution_method").notNull(),
  resolutionConfidence: real("resolution_confidence").notNull(),
  sourceCoverage: jsonb("source_coverage").notNull().default({}),
  fallbackReason: text("fallback_reason"),
  historicalDataStatus: text("historical_data_status").notNull(),
  fallbackUsed: boolean("fallback_used").notNull().default(false),
  lineage: jsonb("lineage").notNull().default({}),
});

export const insertCanonicalPlayerSchema = createInsertSchema(canonicalPlayersTable).omit({ createdAt: true, updatedAt: true });
export const insertPlayerAliasSchema = createInsertSchema(playerAliasesTable).omit({ createdAt: true, updatedAt: true });
export const insertTournamentCrosswalkSchema = createInsertSchema(tournamentCrosswalksTable).omit({ createdAt: true, updatedAt: true });
export const insertCanonicalMatchSchema = createInsertSchema(canonicalMatchesTable).omit({ createdAt: true });
export const insertMatchSourceLinkSchema = createInsertSchema(matchSourceLinksTable).omit({ createdAt: true });
export const insertMatchCrosswalkSchema = createInsertSchema(matchCrosswalksTable).omit({ createdAt: true, updatedAt: true });
export const insertEvaluationHoldoutPopulationSchema = createInsertSchema(evaluationHoldoutPopulationsTable).omit({ createdAt: true });
export const insertEvaluationHoldoutMemberSchema = createInsertSchema(evaluationHoldoutMembersTable).omit({ createdAt: true });
export const insertPlayerResolutionReviewSchema = createInsertSchema(playerResolutionReviewsTable).omit({ createdAt: true, reviewedAt: true });
export const insertHistoricalFeatureDiagnosticsSchema = createInsertSchema(historicalFeatureDiagnosticsTable).omit({ requestedAt: true });

export type CanonicalPlayer = typeof canonicalPlayersTable.$inferSelect;
export type PlayerAlias = typeof playerAliasesTable.$inferSelect;
export type TournamentCrosswalk = typeof tournamentCrosswalksTable.$inferSelect;
export type CanonicalMatch = typeof canonicalMatchesTable.$inferSelect;
export type MatchSourceLink = typeof matchSourceLinksTable.$inferSelect;
export type MatchCrosswalk = typeof matchCrosswalksTable.$inferSelect;
export type EvaluationHoldoutPopulation = typeof evaluationHoldoutPopulationsTable.$inferSelect;
export type EvaluationHoldoutMember = typeof evaluationHoldoutMembersTable.$inferSelect;
export type PlayerResolutionReview = typeof playerResolutionReviewsTable.$inferSelect;
export type HistoricalFeatureDiagnostics = typeof historicalFeatureDiagnosticsTable.$inferSelect;
export type InsertCanonicalPlayer = z.infer<typeof insertCanonicalPlayerSchema>;
export type InsertPlayerAlias = z.infer<typeof insertPlayerAliasSchema>;