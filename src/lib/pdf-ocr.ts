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

  // A "screenshot compiled into a PDF" page often declares a tiny page box
  // (e.g. a 4x6in "photo" page, 288x432pt) while the embedded image is a
  // full-resolution, very tall scrolling capture (observed: 804x16000px on a
  // 288x432pt page — the declared page is ~5% of the image's real height).
  // Rendering at a fixed multiple of the *page's* point size in that case
  // produces a canvas at a small fraction of the source image's actual
  // resolution, and no amount of OCR can read text that was downsampled to
  // mush before Tesseract ever sees it. Detect the dominant embedded image's
  // native pixel size via PDF.js's operator list (the same page.objs image
  // registry PDF.js itself populates while building it) and scale toward
  // that instead of a fixed page-relative multiplier. Falls back to the
  // fixed-scale behavior for pages with no single dominant embedded image
  // (vector content, multiple comparable images, or detection failure).
  async function detectDominantImageSize(page: any): Promise<{ width: number; height: number } | null> {
    try {
      const opList = await page.getOperatorList();
      const pdfjsOps = (pdfjs as any).OPS;
      let best: { width: number; height: number } | null = null;
      for (let i = 0; i < opList.fnArray.length; i++) {
        if (opList.fnArray[i] !== pdfjsOps.paintImageXObject && opList.fnArray[i] !== pdfjsOps.paintJpegXObject) continue;
        const name = opList.argsArray[i][0];
        const img = await new Promise<{ width?: number; height?: number } | null>((resolve) => {
          try {
            page.objs.get(name, resolve);
          } catch {
            resolve(null);
          }
        });
        if (!img?.width || !img?.height) continue;
        if (!best || img.width * img.height > best.width * best.height) best = { width: img.width, height: img.height };
      }
      return best;
    } catch {
      return null;
    }
  }

  const newWorker = () =>
    createWorker("eng", 1, {
      logger: (m: { status?: string; progress?: number }) => {
        if (!onProgress || !m.status) return;
        const pct = typeof m.progress === "number" ? ` ${Math.round(m.progress * 100)}%` : "";
        onProgress(`Local OCR: ${m.status}${pct}`);
      },
    });

  onProgress?.(`PDF opened: ${doc.numPages} page${doc.numPages === 1 ? "" : "s"}. Starting local OCR…`);
  let worker = await newWorker();

  // Large scanned pages (tall full-screen screenshots at scale:2 can each be
  // several thousand pixels tall) push mobile Safari's memory hard over a
  // 30-50 page batch. Several defenses, each addressing a different growth
  // source: cap render scale on unusually tall pages instead of always
  // rendering at a fixed 2x; yield to the event loop between pages so the GC
  // gets a real chance to reclaim the previous page's canvas/OCR buffers; and
  // periodically recreate the Tesseract worker, since its WASM heap is known
  // to grow across many recognize() calls in one long-lived worker and isn't
  // reliably reclaimed until the worker itself is torn down. None of this can
  // save a page whose single canvas allocation alone exceeds what the device
  // can give a tab, but that is a single bad page, not the whole batch.
  const MAX_CANVAS_DIMENSION = 4000;
  const WORKER_RESTART_EVERY_PAGES = 8;
  const pages: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress?.(`Reading image-only page ${i}/${doc.numPages} locally…`);
      try {
        const page = await doc.getPage(i);
        const vp1 = page.getViewport({ scale: 1 });
        const nativeImage = await detectDominantImageSize(page);
        // Scale toward whichever axis the embedded image most exceeds the
        // declared page box on, so a squeezed-in tall screenshot renders near
        // its own resolution instead of the page's; never render below the
        // normal 2x baseline used for pages that aren't a squeezed image.
        const targetScale = nativeImage
          ? Math.max(2, nativeImage.width / vp1.width, nativeImage.height / vp1.height)
          : 2;
        const scale = Math.min(targetScale, MAX_CANVAS_DIMENSION / Math.max(vp1.width, vp1.height, 1));
        const viewport = page.getViewport({ scale });
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
      if (i < doc.numPages && i % WORKER_RESTART_EVERY_PAGES === 0) {
        onProgress?.(`Recycling OCR worker to free memory (${i}/${doc.numPages} pages done)…`);
        await worker.terminate();
        worker = await newWorker();
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
