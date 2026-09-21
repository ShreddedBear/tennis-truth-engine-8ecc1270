// 100+/150-item stress test for the mixed PNG/JPG/PDF batch orchestrator.
//
// Proves, with a REAL heterogeneous batch (image items and PDF items
// interleaved, not run separately):
//   - bounded concurrency across the WHOLE mixed batch (images + PDFs share
//     one pool -- never an unbounded Promise.all)
//   - a hung/slow item degrades to RESOLUTION_TIMEOUT in isolation, without
//     blocking or discarding any other item's real result
//   - a hard-failing item (malformed input) is isolated the same way
//   - the batch completes with no global/document-level timeout -- only
//     once every item reaches a terminal state
//   - peak concurrent work never exceeds the configured limit (a stand-in
//     for "does not exhaust memory/connections" -- the batch never has more
//     than `concurrency` items' worth of work in flight at once, regardless
//     of total batch size)
import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import {
  runMixedImportBatch,
  defaultImageHandler,
  type ImportBatchItem,
  type ImportItemOutcome,
  type MixedBatchHandlers,
} from "./mixedBatchOrchestrator.js";

function buildMixedItems(count: number): ImportBatchItem[] {
  const items: ImportBatchItem[] = [];
  for (let i = 0; i < count; i++) {
    // Alternate image/pdf so the batch is genuinely mixed, not two separate runs.
    const kind = i % 3 === 0 ? "pdf" : "image";
    items.push({ key: `item-${i}`, kind, filename: `${kind}-${i}.${kind === "pdf" ? "pdf" : "png"}`, payload: `payload-${i}` });
  }
  return items;
}

test("150-item mixed PNG/JPG/PDF batch: bounded concurrency, isolated timeout/failure, no global timeout", async () => {
  const CONCURRENCY = 8;
  const ITEM_TIMEOUT_MS = 200;
  const items = buildMixedItems(150);

  let concurrent = 0;
  let maxConcurrent = 0;
  const HUNG_INDEX = 47; // a slow/stuck item buried mid-batch, not at an edge
  const MALFORMED_INDEX = 103; // a hard failure elsewhere in the batch

  const track = async <T>(work: () => Promise<T>): Promise<T> => {
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    try {
      return await work();
    } finally {
      concurrent -= 1;
    }
  };

  const handlers: MixedBatchHandlers = {
    handleImage: (item) => track(async (): Promise<ImportItemOutcome> => {
      const idx = Number(item.key.split("-")[1]);
      if (idx === HUNG_INDEX) return new Promise<ImportItemOutcome>(() => {}); // never resolves
      if (idx === MALFORMED_INDEX) throw new Error("Malformed image payload");
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { matchupCount: 1, timedOut: false };
    }),
    handlePdf: (item) => track(async (): Promise<ImportItemOutcome> => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { matchupCount: 2, timedOut: false }; // e.g. a 2-matchup page batch
    }),
  };

  const t0 = Date.now();
  const summary = await runMixedImportBatch(items, handlers, { concurrency: CONCURRENCY, itemTimeoutMs: ITEM_TIMEOUT_MS });
  const elapsedMs = Date.now() - t0;

  // ── Completion: every item reached a terminal state, batch is whole ──
  assert.equal(summary.totalItems, 150);
  assert.equal(summary.results.length, 150);
  assert.equal(summary.successCount + summary.timeoutCount + summary.failedCount, 150);

  // ── Isolation: the hung item timed out; the malformed item failed; ──
  // ── every one of the other 148 items still succeeded.                ──
  assert.equal(summary.timeoutCount, 1);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.successCount, 148);
  assert.equal(summary.results[HUNG_INDEX]!.status, "RESOLUTION_TIMEOUT");
  assert.equal(summary.results[MALFORMED_INDEX]!.status, "FAILED");
  assert.match(summary.results[MALFORMED_INDEX]!.error ?? "", /Malformed image payload/);
  for (let i = 0; i < items.length; i++) {
    if (i === HUNG_INDEX || i === MALFORMED_INDEX) continue;
    assert.equal(summary.results[i]!.status, "RESOLUTION_SUCCESS", `item ${i} should have succeeded`);
  }

  // ── Both kinds actually ran and contributed ──
  const imageResults = summary.results.filter((r) => r.kind === "image");
  const pdfResults = summary.results.filter((r) => r.kind === "pdf");
  assert.ok(imageResults.length > 0 && pdfResults.length > 0);
  assert.equal(imageResults.length + pdfResults.length, 150);

  // ── Bounded concurrency: never more than CONCURRENCY items in flight, ──
  // ── across BOTH kinds combined, at any point during the whole batch.   ──
  assert.ok(maxConcurrent <= CONCURRENCY, `expected <= ${CONCURRENCY} concurrent, got ${maxConcurrent}`);
  assert.ok(maxConcurrent > 1, "the pool should have actually run items concurrently, not serially");

  // ── No global/document-level timeout: the batch finished once every  ──
  // ── item reached a terminal state, well under a naive "whole batch"  ──
  // ── timeout budget (150 items / 8 concurrency * ~5ms + one 200ms     ──
  // ── timeout for the hung item, not 150 * 200ms serially).             ──
  assert.ok(elapsedMs < 5_000, `batch took ${elapsedMs}ms -- should complete in low seconds, not time out as a whole`);
});

test("a batch over MAX_BATCH_ITEMS is rejected up front rather than silently truncated or run unbounded", async () => {
  const { MAX_BATCH_ITEMS } = await import("./mixedBatchOrchestrator.js");
  const items = buildMixedItems(MAX_BATCH_ITEMS + 1);
  const handlers: MixedBatchHandlers = {
    handleImage: async () => ({ matchupCount: 1, timedOut: false }),
    handlePdf: async () => ({ matchupCount: 1, timedOut: false }),
  };
  await assert.rejects(runMixedImportBatch(items, handlers), /exceeds the \d+-item limit/);
});

test("defaultImageHandler delegates to screenshotImportService and maps a lookup-timeout matchup correctly", async (t) => {
  const { screenshotImportService } = await import("./ScreenshotImportService.js");
  t.mock.method(screenshotImportService, "importScreenshot", async () => ({
    player1: { recognizedName: "Federico Arnaboldi", player: null, status: "lookup-timeout" },
    player2: { recognizedName: "Florian Broska", player: null, status: "lookup-timeout" },
    event: { recognizedName: "ATP Challenger Genoa", canonicalName: null, tour: null, surface: null, level: null, bestOf: null, round: null, provenance: {} as never },
    warnings: [],
    matchups: [{
      player1: { recognizedName: "Federico Arnaboldi", player: null, status: "lookup-timeout" },
      player2: { recognizedName: "Florian Broska", player: null, status: "lookup-timeout" },
      event: { recognizedName: "ATP Challenger Genoa", canonicalName: null, tour: null, surface: null, level: null, bestOf: null, round: null, provenance: {} as never },
      resolved: false,
      warnings: [],
    }],
    diagnostics: { ocrProvider: "test", ocrDurationMs: 1, totalDurationMs: 1, retryCount: 0, fromCache: false, debugLog: [] },
  }));

  const outcome = await defaultImageHandler({ key: "k", kind: "image", filename: "f.png", payload: "base64" });
  assert.equal(outcome.matchupCount, 1);
  assert.equal(outcome.timedOut, true); // OCR succeeded (names present); lookup timed out -- this must read as a timeout, not a silent failure.
  mock.reset();
});
