//#region node_modules/.nitro/vite/services/ssr/assets/pipeline-client-error-F6VIyWJR.js
var FORCE_RELOAD_MARKERS = [
	"FORCE_RELOAD",
	"window.parent.postMessage",
	"<html",
	"</html>"
];
var RECOVERABLE_TRANSPORT_MARKERS = [
	"load failed",
	"failed to fetch",
	"networkerror",
	"network request failed",
	"fetch failed",
	"expected content-type header",
	"server_function_failed",
	"before returning a valid result",
	"econnreset",
	"read econnreset"
];
function rawMessage(error) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	try {
		return JSON.stringify(error);
	} catch {
		return String(error ?? "");
	}
}
function isPreviewForceReloadError(error) {
	const message = rawMessage(error).toLowerCase();
	return FORCE_RELOAD_MARKERS.some((marker) => message.includes(marker.toLowerCase()));
}
function isRecoverablePipelineTransportError(error) {
	const message = rawMessage(error).toLowerCase();
	return RECOVERABLE_TRANSPORT_MARKERS.some((marker) => message.includes(marker));
}
function safePipelineErrorMessage(error) {
	const message = rawMessage(error);
	if (isPreviewForceReloadError(error)) return "The app preview refreshed while the audit was running. Your persisted audit progress was preserved. Reloading the workspace so the audit can resume safely.";
	return message.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500) || "Pipeline failed";
}
//#endregion
export { isRecoverablePipelineTransportError as n, safePipelineErrorMessage as r, isPreviewForceReloadError as t };
