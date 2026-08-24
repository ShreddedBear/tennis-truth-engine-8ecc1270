import { extractPdfTextServer } from "@/lib/pdf-extract.functions";

export interface ExtractedPdf {
  pages: string[];
  text: string;
}

/**
 * Read an uploaded File without depending on File.arrayBuffer().
 * Some iOS/WebKit upload objects expose File/Blob but do not implement
 * arrayBuffer(). This is still used by the local OCR fallback.
 */
export function readPdfFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer().then((buf) => new Uint8Array(buf));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read uploaded PDF bytes"));
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

/**
 * Safari-safe Base64 conversion. Use FileReader's native Data URL path rather
 * than rebuilding a binary string with String.fromCharCode(...)/btoa.
 */
export function readPdfFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read uploaded PDF as Base64"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Uploaded PDF did not produce a Data URL"));
        return;
      }
      const comma = result.indexOf(",");
      if (comma < 0 || comma === result.length - 1) {
        reject(new Error("Uploaded PDF produced an invalid Data URL"));
        return;
      }
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

async function extractPdfTextLocally(file: File): Promise<ExtractedPdf> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerSrc = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
  if (workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const bytes = await readPdfFileBytes(file);
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str?: string; transform?: number[] }>;
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];

    for (const item of items) {
      const y = item.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        if (line.trim()) lines.push(line.trim());
        line = "";
      }
      line += `${item.str ?? ""} `;
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join("\n"));
  }

  return { pages, text: pages.join("\n\f\n") };
}

/**
 * Prefer the free browser-side PDF.js path. It uses the same legacy build and
 * worker already proven by local OCR, so image-only PDFs can cleanly return
 * empty text and fall through to OCR without an unnecessary server-function
 * upload. The server path remains a compatibility fallback for browsers where
 * local PDF.js cannot open the document.
 */
export async function extractPdfText(file: File): Promise<ExtractedPdf> {
  let localError: unknown = null;
  try {
    return await extractPdfTextLocally(file);
  } catch (error) {
    localError = error;
  }

  let base64: string;
  try {
    base64 = await readPdfFileBase64(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const localMessage = localError instanceof Error ? localError.message : String(localError ?? "unknown local PDF error");
    throw new Error(`PDF browser read failed: ${message}; local text extraction also failed: ${localMessage}`);
  }

  try {
    return await extractPdfTextServer({
      data: { filename: file.name || "uploaded.pdf", base64 },
    });
  } catch (error) {
    const serverMessage = error instanceof Error ? error.message : String(error);
    const localMessage = localError instanceof Error ? localError.message : String(localError ?? "unknown local PDF error");
    throw new Error(`PDF text extraction failed locally (${localMessage}) and server fallback failed (${serverMessage})`);
  }
}
