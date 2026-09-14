import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createSsrRpc } from "./createSsrRpc-DDIv2aCY.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/screen-queries.functions-DIVmn9AK.js
var fetchLogsScreen = createServerFn({ method: "POST" }).handler(createSsrRpc("1ef775b405ce2624b61e2edd42828da5a6e308fe681149ac3336fbf82cd21acb"));
var fetchSourcesScreen = createServerFn({ method: "POST" }).handler(createSsrRpc("6458d700ccb94a36ca3dd5d7472c5dd9312d41a864ba23520e286b0bc6864e4e"));
var resolveConflict = createServerFn({ method: "POST" }).inputValidator((data) => {
	const id = String(data?.id ?? "").trim();
	const resolution = String(data?.resolution ?? "").trim();
	if (!id) throw new Error("A conflict id is required.");
	if (!["RESOLVED", "UNRESOLVED"].includes(resolution)) throw new Error(`Unsupported conflict resolution "${resolution}".`);
	return {
		id,
		resolution
	};
}).handler(createSsrRpc("a93fb17966bc91162eceada9a04f34b3903ec83139a5622462d2910632805883"));
var fetchRulesScreen = createServerFn({ method: "POST" }).handler(createSsrRpc("3cebbf2bf1bc91f211a6c8b21078879e3ea94698522273846818bf746ea79dab"));
var fetchCalibrationHistoryScreen = createServerFn({ method: "POST" }).handler(createSsrRpc("a953d05eb9d27066b0fd492e2d3ba6dc89c106f536fa177e5932a5e1cc152513"));
var fetchCalibrationScreen = createServerFn({ method: "POST" }).handler(createSsrRpc("9e3421d48ead56c54885d022946cd656f16126ac0ccd60591cb3fb04c0a23cb6"));
var fetchDashboardScreen = createServerFn({ method: "POST" }).handler(createSsrRpc("0a0c8890cffde1197cb0a0fcff6a422aafa8c4e042b218a7150269d08d7e4e64"));
var fetchBoardScreen = createServerFn({ method: "POST" }).handler(createSsrRpc("a3944134c2878a848607c1b4be4c0af532b7d1cb743e46d9be4566fbbc4b884f"));
var fetchSlateBase = createServerFn({ method: "POST" }).handler(createSsrRpc("5b01246fde8f96e1ad795db1bd2842a9ee4e434d49b4c689d5e7e2196a2e0f60"));
var fetchSlateRunDetail = createServerFn({ method: "POST" }).inputValidator((data) => {
	return { runIds: Array.isArray(data?.runIds) ? data.runIds.map(String).filter(Boolean) : [] };
}).handler(createSsrRpc("d00a526a546b30ba7828d5c36c646f6a233e664a37b1e2a42ce85fc8ef793a89"));
//#endregion
export { fetchLogsScreen as a, fetchSlateRunDetail as c, fetchDashboardScreen as i, fetchSourcesScreen as l, fetchCalibrationHistoryScreen as n, fetchRulesScreen as o, fetchCalibrationScreen as r, fetchSlateBase as s, fetchBoardScreen as t, resolveConflict as u };
