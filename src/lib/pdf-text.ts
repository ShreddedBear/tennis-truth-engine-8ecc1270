// Browser-side PDF text extraction (pdfjs). Whole document, every page.
export interface ExtractedPdf {
  pages: string[];
  text: string;
}

/**
 * Read an uploaded File without depending on File.arrayBuffer().
 * Some iOS/WebKit upload objects expose File/Blob but do not implement
 * arrayBuffer(), which previously caused "undefined is not a function".
 */
function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer().then(buf => new Uint8Array(buf));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read uploaded PDF"));
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error("Uploaded PDF did not produce binary data"));
        return;
      }
      resolve(new Uint8Array(reader.result));
    };
    reader.readAsArrayBuffer(file);
  });
}

export async function extractPdfText(file: File): Promise<ExtractedPdf> {
  const pdfjs = await import("pdfjs-dist");
  const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  const workerSrc = workerModule.default;
  if (workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const data = await readFileBytes(file);
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str?: string; transform?: number[] }>;
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const it of items) {
      const y = it.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        if (line.trim()) lines.push(line.trim());
        line = "";
      }
      line += (it.str ?? "") + " ";
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join("\n"));
  }
  return { pages, text: pages.join("\n\f\n") };
}
