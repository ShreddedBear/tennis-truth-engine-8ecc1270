import { t as db } from "./client.server-B14ewPcb.mjs";
import { o as executionLogsTable } from "./audit-ChUwSBsg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/audit-runs.server-BHLIQ7ng.js
async function log(entry) {
	try {
		await db.insert(executionLogsTable).values({
			audit_run_id: entry.audit_run_id ?? null,
			match_id: entry.match_id ?? null,
			stage: entry.stage,
			status: entry.status,
			rule_code: entry.rule_code ?? null,
			player_side: entry.player_side ?? null,
			output: entry.output ?? null,
			matrix_visible: entry.matrix_visible ?? false
		});
	} catch (error) {
		throw new Error(`Could not persist execution log: ${error instanceof Error ? error.message : String(error)}`);
	}
}
//#endregion
export { log as t };
