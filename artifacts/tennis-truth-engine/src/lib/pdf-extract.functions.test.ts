// Tests for the page-batched PDF vision extraction added to fix the
// "one giant 90s call for the whole PDF" anti-pattern: a slow/failing page
// range must not cancel or discard other page ranges' real results, and the
// AI gateway must never be fanned out to unboundedly for a large PDF.
//
// Uses a REAL multi-page PDF built with pdf-lib (not a mock) so
// splitPdfIntoPageBatches genuinely exercises page splitting; only the
// external AI-gateway `fetch` call is mocked.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

async function buildTestPdf(pageCount: number): Promise<string> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([200, 200]);
  const bytes = await doc.save();
  return Buffer.from(bytes).toString("base64");
}

function gatewayResponse(matchups: Array<{ page_number: number; player1_name: string; player2_name: string }>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify({ matchups }) } }] }),
    text: async () => "",
  } as Response;
}

describe("extractMatchupsFromPdfCore (page-batched vision extraction)", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env["LOVABLE_API_KEY"];

  beforeAll(() => {
    process.env["LOVABLE_API_KEY"] = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.resetModules();
    process.env["LOVABLE_API_KEY"] = originalKey ?? "test-key";
  });

  it("preserves matchups from successful batches when one batch times out — does not discard the whole document", async () => {
    vi.stubEnv("PDF_VISION_PAGE_BATCH_SIZE", "2"); // 2 pages per batch
    vi.stubEnv("PDF_VISION_BATCH_CONCURRENCY", "3");
    vi.stubEnv("PDF_VISION_BATCH_TIMEOUT_MS", "50"); // fast for the test
    vi.resetModules();
    const { extractMatchupsFromPdfCore } = await import("./pdf-extract.functions");

    const base64 = await buildTestPdf(6); // 3 batches of 2 pages: [1-2],[3-4],[5-6]
    let call = 0;
    global.fetch = vi.fn(async () => {
      call += 1;
      if (call === 2) {
        // Second batch called: hang forever so the bounded pool's own
        // deadline (not an AbortController) is what saves this test.
        return new Promise<Response>(() => {});
      }
      return gatewayResponse([{ page_number: 1, player1_name: `P${call}A`, player2_name: `P${call}B` }]);
    }) as unknown as typeof fetch;

    const result = await extractMatchupsFromPdfCore({ filename: "six-pages.pdf", base64 });

    expect(result.pageCount).toBe(6);
    // Batches 1 and 3 succeeded (1 matchup each); batch 2 timed out.
    expect(result.matchups.length).toBe(2);
    expect(result.pagesFailed).toBe(2); // pages 3-4 (the hung batch)
    expect(result.pagesProcessed).toBe(4);
    expect(result.batchFailures).toEqual([
      { startPage: 3, endPage: 4, error: "Timed out after 50ms" },
    ]);
  }, 10_000);

  it("remaps each batch's page_number back to the source PDF's absolute page numbers", async () => {
    vi.stubEnv("PDF_VISION_PAGE_BATCH_SIZE", "3");
    vi.stubEnv("PDF_VISION_BATCH_CONCURRENCY", "2");
    vi.stubEnv("PDF_VISION_BATCH_TIMEOUT_MS", "2000");
    vi.resetModules();
    const { extractMatchupsFromPdfCore } = await import("./pdf-extract.functions");

    const base64 = await buildTestPdf(6); // batches: [1-3],[4-6]
    global.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      const fileData = body.messages[0].content[1].file.file_data as string;
      // Every sub-PDF is its own document, so the AI always reports page 2
      // (the middle page) of whichever 3-page batch it was handed.
      void fileData;
      return gatewayResponse([{ page_number: 2, player1_name: "Federico Arnaboldi", player2_name: "Florian Broska" }]);
    }) as unknown as typeof fetch;

    const result = await extractMatchupsFromPdfCore({ filename: "six-pages.pdf", base64 });

    const pageNumbers = result.matchups.map((m) => m.page_number).sort((a, b) => a - b);
    // Batch 1 [1-3]: local page 2 -> absolute page 2. Batch 2 [4-6]: local page 2 -> absolute page 5.
    expect(pageNumbers).toEqual([2, 5]);
  });

  it("never exceeds PDF_VISION_BATCH_CONCURRENCY concurrent gateway calls", async () => {
    vi.stubEnv("PDF_VISION_PAGE_BATCH_SIZE", "1"); // 1 page per batch -> 8 batches
    vi.stubEnv("PDF_VISION_BATCH_CONCURRENCY", "3");
    vi.stubEnv("PDF_VISION_BATCH_TIMEOUT_MS", "2000");
    vi.resetModules();
    const { extractMatchupsFromPdfCore } = await import("./pdf-extract.functions");

    const base64 = await buildTestPdf(8);
    let concurrent = 0;
    let maxConcurrent = 0;
    global.fetch = vi.fn(async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 15));
      concurrent -= 1;
      return gatewayResponse([{ page_number: 1, player1_name: "A", player2_name: "B" }]);
    }) as unknown as typeof fetch;

    const result = await extractMatchupsFromPdfCore({ filename: "eight-pages.pdf", base64 });

    expect(result.matchups.length).toBe(8);
    expect(result.batchFailures).toEqual([]);
    expect(maxConcurrent).toBeLessThanOrEqual(3);
    expect(maxConcurrent).toBeGreaterThan(0);
  });

  it("throws only when EVERY batch fails and nothing was extracted at all", async () => {
    vi.stubEnv("PDF_VISION_PAGE_BATCH_SIZE", "2");
    vi.stubEnv("PDF_VISION_BATCH_CONCURRENCY", "2");
    vi.stubEnv("PDF_VISION_BATCH_TIMEOUT_MS", "2000");
    vi.resetModules();
    const { extractMatchupsFromPdfCore } = await import("./pdf-extract.functions");

    const base64 = await buildTestPdf(4);
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "gateway down",
    })) as unknown as typeof fetch;

    await expect(extractMatchupsFromPdfCore({ filename: "bad.pdf", base64 })).rejects.toThrow(
      /found no player matchup names/i,
    );
  });

  it("a single malformed/unparseable batch response does not cancel sibling batches", async () => {
    vi.stubEnv("PDF_VISION_PAGE_BATCH_SIZE", "1");
    vi.stubEnv("PDF_VISION_BATCH_CONCURRENCY", "4");
    vi.stubEnv("PDF_VISION_BATCH_TIMEOUT_MS", "2000");
    vi.resetModules();
    const { extractMatchupsFromPdfCore } = await import("./pdf-extract.functions");

    const base64 = await buildTestPdf(3);
    let call = 0;
    global.fetch = vi.fn(async () => {
      call += 1;
      if (call === 2) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "not json at all {{{" } }] }),
          text: async () => "",
        } as Response;
      }
      return gatewayResponse([{ page_number: 1, player1_name: `Player${call}`, player2_name: `Opponent${call}` }]);
    }) as unknown as typeof fetch;

    const result = await extractMatchupsFromPdfCore({ filename: "three-pages.pdf", base64 });

    expect(result.matchups.length).toBe(2); // pages 1 and 3 succeeded
    expect(result.batchFailures.length).toBe(1);
    expect(result.pagesFailed).toBe(1);
    expect(result.pagesProcessed).toBe(2);
  });
});
