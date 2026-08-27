// Free browser-side OCR fallback for screenshot/image-only PDFs.
// Tesseract is bundled with the app so OCR does not depend on a remote CDN,
// Lovable AI credits, or an API key.

import { readPdfFileBytes } from "./pdf-text";

export interface OcrPdfResult {
  pages: string[];
  pageCount: number;
}

export async function ocrPdfLocally(
  file: File,
  onProgress?: (message: string) => void,
): Promise<OcrPdfResult> {
  // Match the text-extraction path: use PDF.js' legacy browser build so
  // iPhone/Safari does not fail on unsupported modern runtime APIs.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerSrc = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
  if (workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  // Do not assume File.arrayBuffer() exists in WebKit upload objects.
  const data = await readPdfFileBytes(file);
  const doc = await pdfjs.getDocument({ data }).promise;
  const { createWorker } = await import("tesseract.js");

  onProgress?.(`PDF opened: ${doc.numPages} page${doc.numPages === 1 ? "" : "s"}. Starting local OCR…`);
  const worker = await createWorker("eng", 1, {
    logger: (m: { status?: string; progress?: number }) => {
      if (!onProgress || !m.status) return;
      const pct = typeof m.progress === "number" ? ` ${Math.round(m.progress * 100)}%` : "";
      onProgress(`Local OCR: ${m.status}${pct}`);
    },
  });

  // Large scanned pages (tall full-screen screenshots at scale:2 can each be
  // several thousand pixels tall) push mobile Safari's memory hard over a
  // 30-50 page batch. Two defenses: cap render scale on unusually tall pages
  // instead of always rendering at a fixed 2x, and yield to the event loop
  // between pages so the GC gets a real chance to reclaim the previous
  // page's canvas/OCR buffers before the next one is allocated. Neither can
  // save a page whose single canvas allocation alone exceeds what the device
  // can give a tab, but that is a single bad page, not the whole batch.
  const MAX_CANVAS_DIMENSION = 4000;
  const pages: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress?.(`Reading image-only page ${i}/${doc.numPages} locally…`);
      try {
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 2 });
        const scale = Math.min(2, MAX_CANVAS_DIMENSION / Math.max(base.width, base.height, 1));
        const viewport = scale < 2 ? page.getViewport({ scale }) : base;
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Could not create OCR canvas");
        await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;
        const result = await worker.recognize(canvas);
        pages.push((result.data.text ?? "").replace(/\r/g, "").trim());
        canvas.width = 1;
        canvas.height = 1;
      } catch (error) {
        onProgress?.(`Page ${i}/${doc.numPages} failed locally (${error instanceof Error ? error.message : String(error)}) — skipping and continuing.`);
        pages.push("");
      }
      // Let the browser breathe (GC, repaint, respond to input) between
      // pages instead of running dozens of multi-second renders back to back.
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  } finally {
    await worker.terminate();
  }

  // Always return one entry per physical PDF page, even if OCR found no text.
  while (pages.length < doc.numPages) pages.push("");
  return { pages, pageCount: doc.numPages };
}
