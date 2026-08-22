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

/**
 * Browser wrapper only reads/uploads the file. PDF.js parsing happens on the
 * server so iOS/Safari never executes PDF.js during normal text extraction.
 */
export async function extractPdfText(file: File): Promise<ExtractedPdf> {
  let base64: string;
  try {
    base64 = await readPdfFileBase64(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF browser read failed: ${message}`);
  }

  try {
    return await extractPdfTextServer({
      data: { filename: file.name || "uploaded.pdf", base64 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF server handoff failed: ${message}`);
  }
}
