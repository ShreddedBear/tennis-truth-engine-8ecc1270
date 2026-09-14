// Persisted match-context history. SERVER ONLY.
//
// The upload review screen resolves a matchup's tournament/round/surface from matches this
// workspace has already recorded, before falling back to bundled local context and finally
// to online research. This is the read behind that first tier.
import { desc } from "drizzle-orm";

import { db } from "@/db/client.server";
import { matchesTable } from "@/db/schema";

export interface MatchContextRow {
  player1_name: string;
  player2_name: string;
  tournament_name: string | null;
  event_level: string | null;
  round: string | null;
  scheduled_date: string | null;
  surface: string | null;
  best_of: number | null;
  updated_at: string | null;
}

/**
 * The 1,000 most recently updated matches.
 *
 * Ordered newest-first and capped, exactly as before: the caller takes the FIRST row of
 * whichever pair group it finds, so this ordering is what makes "most recent context for
 * this matchup" true rather than arbitrary.
 */
export async function loadMatchContextHistory(): Promise<MatchContextRow[]> {
  return db.select({
    player1_name: matchesTable.player1_name,
    player2_name: matchesTable.player2_name,
    tournament_name: matchesTable.tournament_name,
    event_level: matchesTable.event_level,
    round: matchesTable.round,
    scheduled_date: matchesTable.scheduled_date,
    surface: matchesTable.surface,
    best_of: matchesTable.best_of,
    updated_at: matchesTable.updated_at,
  }).from(matchesTable).orderBy(desc(matchesTable.updated_at)).limit(1000);
}
