import { createServerFn } from "@tanstack/react-start";

export interface AiMatchup {
  page_number: number;
  player1_name: string;
  player2_name: string;
  tournament: string | null;
  event_level: string | null;
  round: string | null;
  scheduled_date: string | null;
  surface: string | null;
  best_of: string | null;
  matrix_predicted_winner: string | null;
  matrix_wp: string | null;
  other_fields: Record<string, string> | null;
}

export interface ServerExtractedPdf {
  pages: string[];
  text: string;
}

/**
 * Extract embedded PDF text on the server, never in the browser.
 * This deliberately keeps PDF.js out of iOS/Safari, where the browser-side
 * runtime has produced opaque WebKit errors such as "undefined is not a function".
 * Image-only PDFs return empty page text and continue to the existing OCR path.
 */
export const extractPdfTextServer = createServerFn({ method: "POST" })
  .inputValidator((data: { filename: string; base64: string }) => {
    if (!data?.base64) throw new Error("No PDF data supplied");
    return data;
  })
  .handler(async ({ data }): Promise<ServerExtractedPdf> => {
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const bytes = new Uint8Array(Buffer.from(data.base64, "base64"));
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Server PDF text extraction failed for ${data.filename || "uploaded PDF"}: ${message}`);
    }
  });

const PROMPT = `This PDF contains tennis match summaries or screenshots (one or more matchups per page).
Read EVERY page, including pages that are only images/screenshots.
Return strict JSON: {"matchups":[{"page_number":1,"player1_name":"","player2_name":"","tournament":null,"event_level":null,"round":null,"scheduled_date":null,"surface":null,"best_of":null,"matrix_predicted_winner":null,"matrix_wp":null,"other_fields":{}}]}
Rules: never invent a value — use null when it is not visible. Put any other readable labelled values (odds, win probability, ranking, form, market) in other_fields as string values. player1_name and player2_name must be full player names as printed.`;

const EXTRACTION_TIMEOUT_MS = 90_000;

export const extractMatchupsFromPdf = createServerFn({ method: "POST" })
  .inputValidator((data: { filename: string; base64: string }) => {
    if (!data?.base64) throw new Error("No PDF data supplied");
    return data;
  })
  .handler(async ({ data }): Promise<{ matchups: AiMatchup[] }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI extraction is not configured (missing API key).");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", "Lovable-API-Key": apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: PROMPT },
                {
                  type: "file",
                  file: { filename: data.filename || "summary.pdf", file_data: `data:application/pdf;base64,${data.base64}` },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("PDF extraction timed out after 90 seconds — try a smaller PDF or press Analyze again.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI extraction is rate limited — wait a moment and press Analyze again.");
      if (res.status === 402) throw new Error("AI credits exhausted — top up credits to keep reading PDFs.");
      throw new Error(`PDF reading failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    if (!content.trim()) throw new Error("PDF reader returned an empty response — press Analyze again.");
    let parsed: { matchups?: AiMatchup[] };
    try {
      parsed = JSON.parse(content) as { matchups?: AiMatchup[] };
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("PDF reader returned an invalid result — press Analyze again.");
      parsed = JSON.parse(m[0]) as { matchups?: AiMatchup[] };
    }
    const matchups = (parsed.matchups ?? []).filter((m) => m.player1_name && m.player2_name);
    if (!matchups.length) throw new Error("PDF reader found no player matchup names. Try a clearer PDF or image.");
    return { matchups };
  });
