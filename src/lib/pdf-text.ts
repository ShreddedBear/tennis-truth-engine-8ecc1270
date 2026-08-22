import { extractPdfTextServer } from "@/lib/pdf-extract.functions";

export interface ExtractedPdf {
  pages: string[];
  text: string;
}

/**
 * Read an uploaded File without depending on File.arrayBuffer().
 * Some iOS/WebKit upload objects expose File/Blob but do not implement
 * arrayBuffer().
 */
export function readPdfFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer().then((buf) => new Uint8Array(buf));
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

function bytesToBase64(bytes: Uint8Array): string {
  // Convert in chunks so large PDFs do not overflow Safari's argument/string limits.
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

/**
 * Browser wrapper only reads and uploads the bytes. PDF.js parsing happens on
 * the server so iOS/Safari never executes the PDF.js runtime.
 */
export async function extractPdfText(file: File): Promise<ExtractedPdf> {
  const bytes = await readPdfFileBytes(file);
  const base64 = bytesToBase64(bytes);
  return extractPdfTextServer({ data: { filename: file.name || "uploaded.pdf", base64 } });
}
