const FORCE_RELOAD_MARKERS = ["FORCE_RELOAD", "window.parent.postMessage", "<html", "</html>"];
const RECOVERABLE_TRANSPORT_MARKERS = [
  "load failed",
  "failed to fetch",
  "networkerror",
  "network request failed",
  "fetch failed",
  "expected content-type header",
  "server_function_failed",
  "before returning a valid result",
];

function rawMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error ?? "");
  }
}

export function isPreviewForceReloadError(error: unknown) {
  const message = rawMessage(error).toLowerCase();
  return FORCE_RELOAD_MARKERS.some((marker) => message.includes(marker.toLowerCase()));
}

export function isRecoverablePipelineTransportError(error:unknown){
  const message=rawMessage(error).toLowerCase();
  return RECOVERABLE_TRANSPORT_MARKERS.some(marker=>message.includes(marker));
}

export function safePipelineErrorMessage(error: unknown) {
  const message = rawMessage(error);
  if (isPreviewForceReloadError(error)) {
    return "The app preview refreshed while the audit was running. Your persisted audit progress was preserved. Reloading the workspace so the audit can resume safely.";
  }

  const cleaned = message
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, 500) || "Pipeline failed";
}
