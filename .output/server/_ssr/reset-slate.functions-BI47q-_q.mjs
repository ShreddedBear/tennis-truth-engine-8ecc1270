import { i as LOCAL_WORKSPACE_ID } from "./constants-DloZsw4H.mjs";
import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createServerRpc } from "./createServerRpc-BLr1vCfx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reset-slate.functions-BI47q-_q.js
/**
* Runs the authoritative deletion for one owner and returns its jsonb payload.
*
* A function rather than a client object, so this module stays free of any database
* import and the tests can drive it directly. The production implementation is
* clearSlateViaDatabase in reset-slate.server.ts, which calls
* public.clear_operational_slate -- the ONE path; there must never be a second scattered
* DELETE reimplementing it.
*/
async function clearOperationalSlate(runClear) {
	let raw;
	try {
		raw = await runClear(LOCAL_WORKSPACE_ID);
	} catch (error) {
		throw new Error(`Clear Slate failed: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!raw || typeof raw !== "object") throw new Error("Clear Slate failed: the database returned no result.");
	const data = raw;
	const survivors = Object.entries(data.after).filter(([, count]) => count > 0);
	if (survivors.length) throw new Error(`Clear Slate did not fully delete the operational slate: ${survivors.map(([table, count]) => `${table}=${count}`).join(", ")} still present.`);
	return {
		matches: data.deleted_matches,
		auditRuns: data.before["audit_runs"] ?? 0,
		summaryVersions: data.before["summary_versions"] ?? 0,
		uploads: data.deleted_uploads,
		slates: data.deleted_slates,
		calibrationObservations: data.deleted_calibration_observations,
		before: data.before,
		after: data.after
	};
}
var resetOperationalSlate_createServerFn_handler = createServerRpc({
	id: "1aa5fdb1585cfcb509dd0408ad640a15d199a963bf86a0b5f6f2b4bbe4a44412",
	name: "resetOperationalSlate",
	filename: "src/lib/reset-slate.functions.ts"
}, (opts) => resetOperationalSlate.__executeServer(opts));
var resetOperationalSlate = createServerFn({ method: "POST" }).inputValidator((data) => {
	if (data?.confirm !== "CLEAR SLATE") throw new Error("Clear slate confirmation is required");
	return data;
}).handler(resetOperationalSlate_createServerFn_handler, async () => {
	const { clearSlateViaDatabase } = await import("./reset-slate.server-Dw_3aduL.mjs");
	return {
		ok: true,
		deleted: await clearOperationalSlate(clearSlateViaDatabase),
		preserved: [
			"players",
			"tournaments",
			"metric registry",
			"rules",
			"calibration configuration",
			"source observations",
			"runtime tennis index"
		]
	};
});
//#endregion
export { resetOperationalSlate_createServerFn_handler };
