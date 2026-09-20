import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createServerRpc } from "./createServerRpc-BLr1vCfx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/screen-queries.functions-CwvJyWAT.js
var fetchLogsScreen_createServerFn_handler = createServerRpc({
	id: "1ef775b405ce2624b61e2edd42828da5a6e308fe681149ac3336fbf82cd21acb",
	name: "fetchLogsScreen",
	filename: "src/lib/screen-queries.functions.ts"
}, (opts) => fetchLogsScreen.__executeServer(opts));
var fetchLogsScreen = createServerFn({ method: "POST" }).handler(fetchLogsScreen_createServerFn_handler, async () => {
	const { loadLogsScreen } = await import("./screen-queries.server-BzV7orGb.mjs");
	return loadLogsScreen();
});
var fetchSourcesScreen_createServerFn_handler = createServerRpc({
	id: "6458d700ccb94a36ca3dd5d7472c5dd9312d41a864ba23520e286b0bc6864e4e",
	name: "fetchSourcesScreen",
	filename: "src/lib/screen-queries.functions.ts"
}, (opts) => fetchSourcesScreen.__executeServer(opts));
var fetchSourcesScreen = createServerFn({ method: "POST" }).handler(fetchSourcesScreen_createServerFn_handler, async () => {
	const { loadSourcesScreen } = await import("./screen-queries.server-BzV7orGb.mjs");
	return loadSourcesScreen();
});
var resolveConflict_createServerFn_handler = createServerRpc({
	id: "a93fb17966bc91162eceada9a04f34b3903ec83139a5622462d2910632805883",
	name: "resolveConflict",
	filename: "src/lib/screen-queries.functions.ts"
}, (opts) => resolveConflict.__executeServer(opts));
var resolveConflict = createServerFn({ method: "POST" }).inputValidator((data) => {
	const id = String(data?.id ?? "").trim();
	const resolution = String(data?.resolution ?? "").trim();
	if (!id) throw new Error("A conflict id is required.");
	if (!["RESOLVED", "UNRESOLVED"].includes(resolution)) throw new Error(`Unsupported conflict resolution "${resolution}".`);
	return {
		id,
		resolution
	};
}).handler(resolveConflict_createServerFn_handler, async ({ data }) => {
	const { resolveSourceConflict } = await import("./screen-queries.server-BzV7orGb.mjs");
	await resolveSourceConflict(data.id, data.resolution);
	return { ok: true };
});
var fetchRulesScreen_createServerFn_handler = createServerRpc({
	id: "3cebbf2bf1bc91f211a6c8b21078879e3ea94698522273846818bf746ea79dab",
	name: "fetchRulesScreen",
	filename: "src/lib/screen-queries.functions.ts"
}, (opts) => fetchRulesScreen.__executeServer(opts));
var fetchRulesScreen = createServerFn({ method: "POST" }).handler(fetchRulesScreen_createServerFn_handler, async () => {
	const { loadRulesScreen } = await import("./screen-queries.server-BzV7orGb.mjs");
	return loadRulesScreen();
});
var fetchCalibrationHistoryScreen_createServerFn_handler = createServerRpc({
	id: "a953d05eb9d27066b0fd492e2d3ba6dc89c106f536fa177e5932a5e1cc152513",
	name: "fetchCalibrationHistoryScreen",
	filename: "src/lib/screen-queries.functions.ts"
}, (opts) => fetchCalibrationHistoryScreen.__executeServer(opts));
var fetchCalibrationHistoryScreen = createServerFn({ method: "POST" }).handler(fetchCalibrationHistoryScreen_createServerFn_handler, async () => {
	const { loadCalibrationHistoryScreen } = await import("./screen-queries.server-BzV7orGb.mjs");
	return loadCalibrationHistoryScreen();
});
var fetchCalibrationScreen_createServerFn_handler = createServerRpc({
	id: "9e3421d48ead56c54885d022946cd656f16126ac0ccd60591cb3fb04c0a23cb6",
	name: "fetchCalibrationScreen",
	filename: "src/lib/screen-queries.functions.ts"
}, (opts) => fetchCalibrationScreen.__executeServer(opts));
var fetchCalibrationScreen = createServerFn({ method: "POST" }).handler(fetchCalibrationScreen_createServerFn_handler, async () => {
	const { loadCalibrationScreen } = await import("./screen-queries.server-BzV7orGb.mjs");
	return loadCalibrationScreen();
});
var fetchDashboardScreen_createServerFn_handler = createServerRpc({
	id: "0a0c8890cffde1197cb0a0fcff6a422aafa8c4e042b218a7150269d08d7e4e64",
	name: "fetchDashboardScreen",
	filename: "src/lib/screen-queries.functions.ts"
}, (opts) => fetchDashboardScreen.__executeServer(opts));
var fetchDashboardScreen = createServerFn({ method: "POST" }).handler(fetchDashboardScreen_createServerFn_handler, async () => {
	const { loadDashboardScreen } = await import("./screen-queries.server-BzV7orGb.mjs");
	return loadDashboardScreen();
});
var fetchBoardScreen_createServerFn_handler = createServerRpc({
	id: "a3944134c2878a848607c1b4be4c0af532b7d1cb743e46d9be4566fbbc4b884f",
	name: "fetchBoardScreen",
	filename: "src/lib/screen-queries.functions.ts"
}, (opts) => fetchBoardScreen.__executeServer(opts));
var fetchBoardScreen = createServerFn({ method: "POST" }).handler(fetchBoardScreen_createServerFn_handler, async () => {
	const { loadBoardScreen } = await import("./screen-queries.server-BzV7orGb.mjs");
	return loadBoardScreen();
});
var fetchSlateBase_createServerFn_handler = createServerRpc({
	id: "5b01246fde8f96e1ad795db1bd2842a9ee4e434d49b4c689d5e7e2196a2e0f60",
	name: "fetchSlateBase",
	filename: "src/lib/screen-queries.functions.ts"
}, (opts) => fetchSlateBase.__executeServer(opts));
var fetchSlateBase = createServerFn({ method: "POST" }).handler(fetchSlateBase_createServerFn_handler, async () => {
	const { loadSlateBase } = await import("./screen-queries.server-BzV7orGb.mjs");
	return loadSlateBase();
});
var fetchSlateRunDetail_createServerFn_handler = createServerRpc({
	id: "d00a526a546b30ba7828d5c36c646f6a233e664a37b1e2a42ce85fc8ef793a89",
	name: "fetchSlateRunDetail",
	filename: "src/lib/screen-queries.functions.ts"
}, (opts) => fetchSlateRunDetail.__executeServer(opts));
var fetchSlateRunDetail = createServerFn({ method: "POST" }).inputValidator((data) => {
	return { runIds: Array.isArray(data?.runIds) ? data.runIds.map(String).filter(Boolean) : [] };
}).handler(fetchSlateRunDetail_createServerFn_handler, async ({ data }) => {
	const { loadSlateRunDetail } = await import("./screen-queries.server-BzV7orGb.mjs");
	return loadSlateRunDetail(data.runIds);
});
//#endregion
export { fetchBoardScreen_createServerFn_handler, fetchCalibrationHistoryScreen_createServerFn_handler, fetchCalibrationScreen_createServerFn_handler, fetchDashboardScreen_createServerFn_handler, fetchLogsScreen_createServerFn_handler, fetchRulesScreen_createServerFn_handler, fetchSlateBase_createServerFn_handler, fetchSlateRunDetail_createServerFn_handler, fetchSourcesScreen_createServerFn_handler, resolveConflict_createServerFn_handler };
