// Browser-side PDF text extraction (pdfjs). Whole document, every page.
export interface ExtractedPdf {
  pages: string[];
  text: string;
}

export async function extractPdfText(file: File): Promise<ExtractedPdf> {
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
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
        lines.push(line.trim());
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
