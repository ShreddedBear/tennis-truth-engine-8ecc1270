const FORCE_RELOAD_MARKERS = ["FORCE_RELOAD", "window.parent.postMessage", "<html", "</html>"];

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
