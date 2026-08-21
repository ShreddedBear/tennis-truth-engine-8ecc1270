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

const PROMPT = `This PDF contains tennis match summaries or screenshots (one or more matchups per page).
Read EVERY page, including pages that are only images/screenshots.
Return strict JSON: {"matchups":[{"page_number":1,"player1_name":"","player2_name":"","tournament":null,"event_level":null,"round":null,"scheduled_date":null,"surface":null,"best_of":null,"matrix_predicted_winner":null,"matrix_wp":null,"other_fields":{}}]}
Rules: never invent a value — use null when it is not visible. Put any other readable labelled values (odds, win probability, ranking, form, market) in other_fields as string values. player1_name and player2_name must be full player names as printed.`;

export const extractMatchupsFromPdf = createServerFn({ method: "POST" })
  .inputValidator((data: { filename: string; base64: string }) => {
    if (!data?.base64) throw new Error("No PDF data supplied");
    return data;
  })
  .handler(async ({ data }): Promise<{ matchups: AiMatchup[] }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI extraction is not configured (missing API key).");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
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

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI extraction is rate limited — wait a moment and press Analyze again.");
      if (res.status === 402) throw new Error("AI credits exhausted — top up credits to keep reading PDFs.");
      throw new Error(`PDF reading failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { matchups?: AiMatchup[] };
    try {
      parsed = JSON.parse(content) as { matchups?: AiMatchup[] };
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? (JSON.parse(m[0]) as { matchups?: AiMatchup[] }) : {};
    }
    const matchups = (parsed.matchups ?? []).filter((m) => m.player1_name && m.player2_name);
    return { matchups };
  });
