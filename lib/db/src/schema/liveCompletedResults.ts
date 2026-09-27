import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { canonicalPlayersTable } from "./canonicalIdentity";

/**
 * Official terminal results fetched on a short live-trading cadence.
 *
 * This is deliberately separate from historical_matches: it carries no feature snapshots,
 * does not participate in the historical backfill watermark, and may be consumed only as a
 * post-match outcome. Player identities are the canonical IDs reached through verified exact
 * provider aliases; source IDs remain alongside them for deterministic provider-fixture joins.
 */
export const liveCompletedResultsTable = pgTable(
  "live_completed_results",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    providerPlayer1Id: text("provider_player1_id").notNull(),
    providerPlayer2Id: text("provider_player2_id").notNull(),
    canonicalPlayer1Id: text("canonical_player1_id")
      .notNull()
      .references(() => canonicalPlayersTable.id),
    canonicalPlayer2Id: text("canonical_player2_id")
      .notNull()
      .references(() => canonicalPlayersTable.id),
    canonicalWinnerId: text("canonical_winner_id")
      .notNull()
      .references(() => canonicalPlayersTable.id),
    terminalResultType: text("terminal_result_type").notNull(),
    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }).notNull(),
    tournamentName: text("tournament_name"),
    surface: text("surface"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("live_completed_results_provider_external_idx").on(table.provider, table.externalId),
    index("live_completed_results_scheduled_start_idx").on(table.scheduledStartAt),
    index("live_completed_results_canonical_players_idx").on(
      table.canonicalPlayer1Id,
      table.canonicalPlayer2Id,
    ),
    check(
      "live_completed_results_winner_participant_check",
      sql`${table.canonicalWinnerId} = ${table.canonicalPlayer1Id} OR ${table.canonicalWinnerId} = ${table.canonicalPlayer2Id}`,
    ),
    check(
      "live_completed_results_distinct_players_check",
      sql`${table.canonicalPlayer1Id} <> ${table.canonicalPlayer2Id}`,
    ),
    check(
      "live_completed_results_terminal_type_check",
      sql`${table.terminalResultType} IN ('finished', 'retired', 'walkover')`,
    ),
  ],
);

export const insertLiveCompletedResultSchema = createInsertSchema(liveCompletedResultsTable).omit({
  id: true,
  ingestedAt: true,
  lastVerifiedAt: true,
});
export type InsertLiveCompletedResult = z.infer<typeof insertLiveCompletedResultSchema>;
export type LiveCompletedResultRow = typeof liveCompletedResultsTable.$inferSelect;