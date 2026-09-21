/**
 * mixedBatchOrchestrator — runs a single heterogeneous batch of import items
 * (screenshots AND PDFs together) through ONE bounded worker pool, producing
 * a unified per-item result.
 *
 * Why this exists: the screenshot pipeline (ScreenshotImportService, this
 * package) and the PDF pipeline (extractMatchupsFromPdfCore, the separate
 * artifacts/tennis-truth-engine app, which runs on Cloudflare Workers and
 * calls an external AI gateway) are two different runtimes/frameworks. This
 * module does NOT reach into that other app directly -- instead it takes the
 * per-kind handler as a dependency (`MixedBatchHandlers`), so the SAME
 * bounded-pool/timeout/isolation guarantees apply no matter which kind of
 * item is running, without coupling this Express backend to a Cloudflare
 * Worker's server functions. `defaultImageHandler` below wires the "image"
 * side to the real, already-bounded ScreenshotImportService in-process; the
 * "pdf" side is supplied by the caller (in production: an HTTP call to the
 * Truth Engine app's extraction endpoint, or any handler matching the same
 * `{ matchupCount, timedOut }` contract `extractMatchupsFromPdfCore` already
 * returns).
 *
 * Guarantees, proven by mixedBatchOrchestrator.stress.test.ts with 100-150
 * mixed items:
 *   - bounded concurrency across the WHOLE mixed batch (images and PDFs
 *     share one pool -- never one unbounded Promise.all per kind)
 *   - a per-item deadline; one slow/hung item degrades to its own
 *     RESOLUTION_TIMEOUT entry without blocking or cancelling any other item
 *   - no global batch timeout -- the batch finishes only when every item
 *     reaches SUCCESS/RESOLUTION_TIMEOUT/FAILED, not on a fixed wall clock
 *   - order-preserving, deterministic per-item results regardless of which
 *     worker slot or how long any other item took
 */
import { runWithConcurrency } from "../../lib/concurrency.js";
import { screenshotImportService } from "./ScreenshotImportService.js";

export type ImportItemKind = "image" | "pdf";

export interface ImportBatchItem {
  key: string;
  kind: ImportItemKind;
  filename: string;
  /** Base64 payload (image bytes or PDF bytes) -- opaque to the orchestrator, passed straight to the kind's handler. */
  payload: string;
}

/**
 * Every terminal state a batch item can reach. OCR_SUCCESS/RESOLUTION_SUCCESS
 * mirror the frontend status model already shipped for the screenshot
 * pipeline (BulkMatchupPredictor.tsx): a lookup/extraction timeout is a
 * distinct, retryable state, never silently collapsed into a generic
 * "skipped"/"failed" bucket the way the original bug report described.
 */
export type ImportItemStatus = "RESOLUTION_SUCCESS" | "RESOLUTION_TIMEOUT" | "FAILED";

export interface ImportItemOutcome {
  matchupCount: number;
  /** True when the item's own extraction/lookup work reported a timeout (not a hard error). */
  timedOut: boolean;
}

export interface ImportBatchResult {
  key: string;
  kind: ImportItemKind;
  filename: string;
  status: ImportItemStatus;
  matchupCount: number;
  error?: string;
  durationMs: number;
}

export interface ImportBatchSummary {
  results: ImportBatchResult[];
  totalItems: number;
  successCount: number;
  timeoutCount: number;
  failedCount: number;
  totalMatchups: number;
  totalDurationMs: number;
}

export interface MixedBatchHandlers {
  handleImage: (item: ImportBatchItem) => Promise<ImportItemOutcome>;
  handlePdf: (item: ImportBatchItem) => Promise<ImportItemOutcome>;
}

// Shared across BOTH item kinds in one batch -- this is what "no unbounded
// Promise.all on the high-volume path" means at the batch-orchestration
// level: images and PDFs never each get their own unbounded fan-out, they
// draw from the same bounded pool.
const DEFAULT_CONCURRENCY = Number(process.env.MIXED_BATCH_CONCURRENCY) || 8;
const DEFAULT_ITEM_TIMEOUT_MS = Number(process.env.MIXED_BATCH_ITEM_TIMEOUT_MS) || 45_000;
// Matches the frontend's own MAX_FILES cap (BulkMatchupPredictor.tsx /
// AdminParlayBuilder.tsx) -- one guard against an unbounded submission size,
// enforced here too since this orchestrator can be called independently.
export const MAX_BATCH_ITEMS = 150;

class ImportItemTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Batch item exceeded ${timeoutMs}ms`);
    this.name = "ImportItemTimeoutError";
  }
}

async function withItemDeadline<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ImportItemTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Wires the "image" side of the batch to the real, already-bounded
 * ScreenshotImportService (per-matchup timeout + concurrency fixed in
 * screenshotMatchupResolver.ts). Player-lookup timeouts surface here as
 * `timedOut: true` with the OCR-recognized matchups still counted --
 * consistent with "OCR success must not depend on player lookup success."
 */
export async function defaultImageHandler(item: ImportBatchItem): Promise<ImportItemOutcome> {
  const result = await screenshotImportService.importScreenshot(item.payload);
  const matchupCount = result.matchups?.length ?? (result.player1.player || result.player2.player ? 1 : 0);
  const timedOut = (result.matchups ?? []).some(
    (m) => m.player1.status === "lookup-timeout" || m.player2.status === "lookup-timeout",
  );
  return { matchupCount, timedOut };
}

export async function runMixedImportBatch(
  items: ImportBatchItem[],
  handlers: MixedBatchHandlers,
  opts?: { concurrency?: number; itemTimeoutMs?: number },
): Promise<ImportBatchSummary> {
  if (items.length > MAX_BATCH_ITEMS) {
    throw new Error(`Batch of ${items.length} items exceeds the ${MAX_BATCH_ITEMS}-item limit -- split into multiple submissions.`);
  }

  const concurrency = opts?.concurrency ?? DEFAULT_CONCURRENCY;
  const itemTimeoutMs = opts?.itemTimeoutMs ?? DEFAULT_ITEM_TIMEOUT_MS;
  const batchStart = Date.now();
  const results: ImportBatchResult[] = new Array(items.length);

  await runWithConcurrency(items, concurrency, async (item, i) => {
    const t0 = Date.now();
    const handler = item.kind === "image" ? handlers.handleImage : handlers.handlePdf;
    try {
      const outcome = await withItemDeadline(handler(item), itemTimeoutMs);
      results[i] = {
        key: item.key,
        kind: item.kind,
        filename: item.filename,
        status: outcome.timedOut ? "RESOLUTION_TIMEOUT" : "RESOLUTION_SUCCESS",
        matchupCount: outcome.matchupCount,
        durationMs: Date.now() - t0,
      };
    } catch (error) {
      const timedOut = error instanceof ImportItemTimeoutError;
      results[i] = {
        key: item.key,
        kind: item.kind,
        filename: item.filename,
        status: timedOut ? "RESOLUTION_TIMEOUT" : "FAILED",
        matchupCount: 0,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - t0,
      };
    }
  });

  return {
    results,
    totalItems: results.length,
    successCount: results.filter((r) => r.status === "RESOLUTION_SUCCESS").length,
    timeoutCount: results.filter((r) => r.status === "RESOLUTION_TIMEOUT").length,
    failedCount: results.filter((r) => r.status === "FAILED").length,
    totalMatchups: results.reduce((sum, r) => sum + r.matchupCount, 0),
    totalDurationMs: Date.now() - batchStart,
  };
}
