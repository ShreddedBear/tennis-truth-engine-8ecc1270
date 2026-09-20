import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createServerRpc } from "./createServerRpc-BLr1vCfx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/match-workspace.functions-DT2scZW4.js
var EDITABLE_AUDIT_TABLES = [
	"metric_results",
	"verification_results",
	"disagreement_results",
	"underdog_results",
	"stress_results"
];
var IDENTITY_FIELDS = ["identity_status", "surface_status"];
var IDENTITY_VALUES = [
	"UNVERIFIED",
	"VERIFIED",
	"CONFLICT"
];
var fetchMatchWorkspace_createServerFn_handler = createServerRpc({
	id: "699213fb9b097345148afe27cb210e7f599179195de0b99579fc2a36e928e411",
	name: "fetchMatchWorkspace",
	filename: "src/lib/match-workspace.functions.ts"
}, (opts) => fetchMatchWorkspace.__executeServer(opts));
var fetchMatchWorkspace = createServerFn({ method: "POST" }).inputValidator((data) => {
	const matchId = String(data?.matchId ?? "").trim();
	if (!matchId) throw new Error("A match id is required.");
	return { matchId };
}).handler(fetchMatchWorkspace_createServerFn_handler, async ({ data }) => {
	const { loadMatchWorkspace } = await import("./match-workspace.server-Ci45mxJv.mjs");
	return loadMatchWorkspace(data.matchId);
});
var fetchStageRows_createServerFn_handler = createServerRpc({
	id: "35fae21b5400d987ce094e25c32686519438d8ac426497367e6ac50a70c62aa8",
	name: "fetchStageRows",
	filename: "src/lib/match-workspace.functions.ts"
}, (opts) => fetchStageRows.__executeServer(opts));
var fetchStageRows = createServerFn({ method: "POST" }).inputValidator((data) => {
	const runId = String(data?.runId ?? "").trim();
	if (!runId) throw new Error("A run id is required.");
	return { runId };
}).handler(fetchStageRows_createServerFn_handler, async ({ data }) => {
	const { loadStageRows } = await import("./match-workspace.server-Ci45mxJv.mjs");
	return loadStageRows(data.runId);
});
var patchAuditRowFn_createServerFn_handler = createServerRpc({
	id: "13a6209230772209cd5d765390096804281734d26be8f2bb049601364ea9cb9b",
	name: "patchAuditRowFn",
	filename: "src/lib/match-workspace.functions.ts"
}, (opts) => patchAuditRowFn.__executeServer(opts));
var patchAuditRowFn = createServerFn({ method: "POST" }).inputValidator((data) => {
	const table = data?.table;
	if (!EDITABLE_AUDIT_TABLES.includes(table)) throw new Error(`"${String(table)}" is not an editable audit table.`);
	const id = String(data?.id ?? "").trim();
	const runId = String(data?.runId ?? "").trim();
	const matchId = String(data?.matchId ?? "").trim();
	if (!id || !runId || !matchId) throw new Error("An audit row edit needs a row id, a run id and a match id.");
	if (!data.values || typeof data.values !== "object") throw new Error("An audit row edit needs values.");
	return {
		table,
		id,
		values: data.values,
		runId,
		matchId,
		stage: String(data?.stage ?? "")
	};
}).handler(patchAuditRowFn_createServerFn_handler, async ({ data }) => {
	const { patchAuditRow } = await import("./match-workspace.server-Ci45mxJv.mjs");
	await patchAuditRow(data.table, data.id, data.values, {
		runId: data.runId,
		matchId: data.matchId,
		stage: data.stage
	});
	return { ok: true };
});
var setIdentityField_createServerFn_handler = createServerRpc({
	id: "a9644ec28a2874973ba113f2fb0d96f1fa0a9f6d9693361ba5207da2e996a33f",
	name: "setIdentityField",
	filename: "src/lib/match-workspace.functions.ts"
}, (opts) => setIdentityField.__executeServer(opts));
var setIdentityField = createServerFn({ method: "POST" }).inputValidator((data) => {
	const matchId = String(data?.matchId ?? "").trim();
	if (!matchId) throw new Error("A match id is required.");
	if (!IDENTITY_FIELDS.includes(data?.field)) throw new Error(`"${String(data?.field)}" is not a settable identity field.`);
	if (!IDENTITY_VALUES.includes(data?.value)) throw new Error(`"${String(data?.value)}" is not a valid verification status.`);
	return {
		matchId,
		field: data.field,
		value: data.value,
		runId: data.runId ?? null
	};
}).handler(setIdentityField_createServerFn_handler, async ({ data }) => {
	const { setMatchIdentityField } = await import("./match-workspace.server-Ci45mxJv.mjs");
	await setMatchIdentityField(data.matchId, data.field, data.value, data.runId);
	return { ok: true };
});
//#endregion
export { fetchMatchWorkspace_createServerFn_handler, fetchStageRows_createServerFn_handler, patchAuditRowFn_createServerFn_handler, setIdentityField_createServerFn_handler };
