import { r as desc } from "../_libs/drizzle-orm.mjs";
import { t as db } from "./client.server-B14ewPcb.mjs";
import { s as matchesTable } from "./matches-CtYuxOLN.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/match-context.server-B5n9N_9N.js
/**
* The 1,000 most recently updated matches.
*
* Ordered newest-first and capped, exactly as before: the caller takes the FIRST row of
* whichever pair group it finds, so this ordering is what makes "most recent context for
* this matchup" true rather than arbitrary.
*/
async function loadMatchContextHistory() {
	return db.select({
		player1_name: matchesTable.player1_name,
		player2_name: matchesTable.player2_name,
		tournament_name: matchesTable.tournament_name,
		event_level: matchesTable.event_level,
		round: matchesTable.round,
		scheduled_date: matchesTable.scheduled_date,
		surface: matchesTable.surface,
		best_of: matchesTable.best_of,
		updated_at: matchesTable.updated_at
	}).from(matchesTable).orderBy(desc(matchesTable.updated_at)).limit(1e3);
}
//#endregion
export { loadMatchContextHistory };
