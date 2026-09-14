// Browser-callable ingestion entry points.
//
// Module scope stays free of server-only imports; the server module is reached with a
// dynamic import inside each handler.
import { createServerFn } from "@tanstack/react-start";

import type { ParsedMatchup } from "./summary-parser";

export interface StagedFileInput {
  filename: string;
  pages: string[];
  matchups: ParsedMatchup[];
  source: "TEXT" | "LOCAL_OCR" | "VISION";
}

/**
 * Ingests the reviewed matchups the upload screen is holding.
 *
 * The browser sends what the reviewer approved -- filenames, page text, parsed matchups --
 * and the server decides what rows that becomes. It cannot name a table, a column or a row
 * id, which is the whole point: this was previously a direct multi-table write from a page
 * holding a publishable key.
 */
export const ingestSummaries = createServerFn({ method: "POST" })
  .inputValidator((data: { files: StagedFileInput[] }) => {
    const files = Array.isArray(data?.files) ? data.files : [];
    if (!files.length) throw new Error("No files were supplied for ingestion.");
    for (const file of files) {
      if (!file || typeof file.filename !== "string" || !file.filename.trim()) {
        throw new Error("Every staged file needs a filename.");
      }
      if (!Array.isArray(file.pages) || !Array.isArray(file.matchups)) {
        throw new Error(`Staged file "${file.filename}" is malformed.`);
      }
      if (!["TEXT", "LOCAL_OCR", "VISION"].includes(file.source)) {
        throw new Error(`Staged file "${file.filename}" has an unknown source "${file.source}".`);
      }
    }
    return { files };
  })
  .handler(async ({ data }) => {
    const { ingestStagedFiles } = await import("./upload-ingest.server");
    return ingestStagedFiles(data.files);
  });

/** Stage rows for a set of runs, for the upload screen's batch progress bar. */
export const fetchStageProgress = createServerFn({ method: "POST" })
  .inputValidator((data: { runIds: string[] }) => ({
    runIds: Array.isArray(data?.runIds) ? data.runIds.map(String).filter(Boolean) : [],
  }))
  .handler(async ({ data }) => {
    const { loadStageProgress } = await import("./upload-ingest.server");
    return loadStageProgress(data.runIds);
  });
