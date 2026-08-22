// Free browser-side OCR fallback for screenshot/image-only PDFs.
// Uses the existing pdfjs dependency to render each page, then loads Tesseract.js
// directly in the browser. No Lovable/AI credits or API key are required.

export interface OcrPdfResult {
  pages: string[];
  pageCount: number;
}

type TesseractModule = {
  createWorker: (
    langs?: string | string[],
    oem?: number,
    options?: { logger?: (m: { status?: string; progress?: number }) => void },
  ) => Promise<{
    recognize: (image: HTMLCanvasElement) => Promise<{ data: { text?: string } }>;
    terminate: () => Promise<void>;
  }>;
};

async function loadTesseract(): Promise<TesseractModule> {
  // Keep OCR out of the app bundle. This runtime import is intentionally remote
  // so the fallback can work without changing the package lock or consuming
  // Lovable credits. jsDelivr serves the published tesseract.js ESM build.
  const dynamicImport = new Function("url", "return import(url)") as (
    url: string,
  ) => Promise<TesseractModule>;
  return dynamicImport(
    "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js",
  );
}

export async function ocrPdfLocally(
  file: File,
  onProgress?: (message: string) => void,
): Promise<OcrPdfResult> {
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const Tesseract = await loadTesseract();
  const worker = await Tesseract.createWorker("eng", 1, {
    logger: (m) => {
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
      // About 2x display resolution: high enough for phone screenshots while
      // avoiding enormous canvas memory use on iOS.
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Could not create OCR canvas");
      await page.render({ canvasContext: ctx, viewport }).promise;
      const result = await worker.recognize(canvas);
      pages.push((result.data.text ?? "").replace(/\r/g, "").trim());
      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    await worker.terminate();
  }

  return { pages, pageCount: doc.numPages };
}
