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

  const pages: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress?.(`Reading image-only page ${i}/${doc.numPages} locally…`);
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Could not create OCR canvas");
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const result = await worker.recognize(canvas);
      pages.push((result.data.text ?? "").replace(/\r/g, "").trim());
      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    await worker.terminate();
  }

  // Always return one entry per physical PDF page, even if OCR found no text.
  while (pages.length < doc.numPages) pages.push("");
  return { pages, pageCount: doc.numPages };
}
