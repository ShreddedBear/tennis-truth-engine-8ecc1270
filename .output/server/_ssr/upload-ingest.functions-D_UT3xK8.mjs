import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createServerRpc } from "./createServerRpc-BLr1vCfx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/upload-ingest.functions-D_UT3xK8.js
var ingestSummaries_createServerFn_handler = createServerRpc({
	id: "7d9c988c7befd20d5b130693c2428cf88eb286fa2564f328ac26cc6a53ec747f",
	name: "ingestSummaries",
	filename: "src/lib/upload-ingest.functions.ts"
}, (opts) => ingestSummaries.__executeServer(opts));
var ingestSummaries = createServerFn({ method: "POST" }).inputValidator((data) => {
	const files = Array.isArray(data?.files) ? data.files : [];
	if (!files.length) throw new Error("No files were supplied for ingestion.");
	for (const file of files) {
		if (!file || typeof file.filename !== "string" || !file.filename.trim()) throw new Error("Every staged file needs a filename.");
		if (!Array.isArray(file.pages) || !Array.isArray(file.matchups)) throw new Error(`Staged file "${file.filename}" is malformed.`);
		if (![
			"TEXT",
			"LOCAL_OCR",
			"VISION"
		].includes(file.source)) throw new Error(`Staged file "${file.filename}" has an unknown source "${file.source}".`);
	}
	return { files };
}).handler(ingestSummaries_createServerFn_handler, async ({ data }) => {
	const { ingestStagedFiles } = await import("./upload-ingest.server-UO4ssSLa.mjs");
	return ingestStagedFiles(data.files);
});
var fetchStageProgress_createServerFn_handler = createServerRpc({
	id: "4cf41fdc8d87d0015498d52d271f929291eb1ddf4db392226fd85d35ca08a238",
	name: "fetchStageProgress",
	filename: "src/lib/upload-ingest.functions.ts"
}, (opts) => fetchStageProgress.__executeServer(opts));
var fetchStageProgress = createServerFn({ method: "POST" }).inputValidator((data) => ({ runIds: Array.isArray(data?.runIds) ? data.runIds.map(String).filter(Boolean) : [] })).handler(fetchStageProgress_createServerFn_handler, async ({ data }) => {
	const { loadStageProgress } = await import("./upload-ingest.server-UO4ssSLa.mjs");
	return loadStageProgress(data.runIds);
});
//#endregion
export { fetchStageProgress_createServerFn_handler, ingestSummaries_createServerFn_handler };
