import { describe, expect, it } from "vitest";
import { isPreviewForceReloadError, safePipelineErrorMessage } from "./pipeline-client-error";

describe("pipeline client error handling", () => {
  it("detects Lovable FORCE_RELOAD HTML and never exposes the raw document", () => {
    const raw = '<html><head><script>window.parent.postMessage({ type: "FORCE_RELOAD" }, "*");</script></head></html>';
    expect(isPreviewForceReloadError(new Error(raw))).toBe(true);
    const safe = safePipelineErrorMessage(new Error(raw));
    expect(safe).toContain("preview refreshed");
    expect(safe).not.toContain("<html>");
    expect(safe).not.toContain("FORCE_RELOAD");
  });

  it("strips HTML from ordinary upstream errors", () => {
    const safe = safePipelineErrorMessage(new Error("<b>Provider failed</b> after timeout"));
    expect(safe).toBe("Provider failed after timeout");
  });
});
