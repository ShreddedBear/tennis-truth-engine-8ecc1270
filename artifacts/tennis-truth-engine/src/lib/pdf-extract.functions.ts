import { createServerFn } from "@tanstack/react-start";
import { BoundedOperationPool } from "./async-time-budget";

// Prediction-engine-specific structured sections. Every field here is guidance/reference
// only -- see the CRITICAL EVIDENCE FIREWALL note on MATRIX_FIELDS in constants.ts. Kept
// as a nested, semi-structured object (one canonical scalar per named module plus a
// free-form detail bag) rather than a long flat list of exact sub-field names: the
// per-module stats a report actually shows can vary, so a rigid fixed schema would break
// on the first format change. Anything not covered by a named module still lands in
// other_fields, same as before.
export interface AiMatrixSummary {
  confidence_label: string | null;
  win_probability_range: string | null;
  agreement_label: string | null;
  model_votes: Record<string, string> | null;
  monte_carlo: {
    win_probability: string | null;
    range: string | null;
    expected_sets: string | null;
    simulations: string | null;
    set_score_distribution: Record<string, string> | null;
  } | null;
  engine_breakdown: Record<string, Record<string, string>> | null;
}

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
  matrix_summary: AiMatrixSummary | null;
  other_fields: Record<string, string> | null;
}

export interface ServerExtractedPdf {
  pages: string[];
  text: string;
}

function ensureServerDomMatrix(): void {
  const g = globalThis as any;
  if (typeof g.DOMMatrix === "function") return;

  class ServerDOMMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;

    constructor(init?: number[] | { a?: number; b?: number; c?: number; d?: number; e?: number; f?: number }) {
      if (Array.isArray(init) && init.length >= 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init.slice(0, 6);
      } else if (init && typeof init === "object" && !Array.isArray(init)) {
        this.a = init.a ?? 1;
        this.b = init.b ?? 0;
        this.c = init.c ?? 0;
        this.d = init.d ?? 1;
        this.e = init.e ?? 0;
        this.f = init.f ?? 0;
      }
    }

    get is2D() { return true; }
    get isIdentity() { return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0; }

    multiply(other: any) {
      return new ServerDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]).multiplySelf(other);
    }

    multiplySelf(other: any) {
      const o = other ?? {};
      const oa = o.a ?? 1, ob = o.b ?? 0, oc = o.c ?? 0, od = o.d ?? 1, oe = o.e ?? 0, of = o.f ?? 0;
      const a = this.a * oa + this.c * ob;
      const b = this.b * oa + this.d * ob;
      const c = this.a * oc + this.c * od;
      const d = this.b * oc + this.d * od;
      const e = this.a * oe + this.c * of + this.e;
      const f = this.b * oe + this.d * of + this.f;
      this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
      return this;
    }

    preMultiplySelf(other: any) {
      const left = new ServerDOMMatrix(other).multiply(this);
      this.a = left.a; this.b = left.b; this.c = left.c; this.d = left.d; this.e = left.e; this.f = left.f;
      return this;
    }

    translate(tx = 0, ty = 0) { return this.multiply(new ServerDOMMatrix([1, 0, 0, 1, tx, ty])); }
    translateSelf(tx = 0, ty = 0) { return this.multiplySelf(new ServerDOMMatrix([1, 0, 0, 1, tx, ty])); }
    scale(scaleX = 1, scaleY = scaleX) { return this.multiply(new ServerDOMMatrix([scaleX, 0, 0, scaleY, 0, 0])); }
    scaleSelf(scaleX = 1, scaleY = scaleX) { return this.multiplySelf(new ServerDOMMatrix([scaleX, 0, 0, scaleY, 0, 0])); }
    rotate(angle = 0) {
      const r = (angle * Math.PI) / 180;
      const cos = Math.cos(r), sin = Math.sin(r);
      return this.multiply(new ServerDOMMatrix([cos, sin, -sin, cos, 0, 0]));
    }
    rotateSelf(angle = 0) {
      const next = this.rotate(angle);
      this.a = next.a; this.b = next.b; this.c = next.c; this.d = next.d; this.e = next.e; this.f = next.f;
      return this;
    }
    inverse() { return new ServerDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]).invertSelf(); }
    invertSelf() {
      const det = this.a * this.d - this.b * this.c;
      if (!det) {
        this.a = this.b = this.c = this.d = this.e = this.f = Number.NaN;
        return this;
      }
      const a = this.d / det, b = -this.b / det, c = -this.c / det, d = this.a / det;
      const e = (this.c * this.f - this.d * this.e) / det;
      const f = (this.b * this.e - this.a * this.f) / det;
      this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
      return this;
    }
    transformPoint(point: { x?: number; y?: number } = {}) {
      const x = point.x ?? 0, y = point.y ?? 0;
      return { x: this.a * x + this.c * y + this.e, y: this.b * x + this.d * y + this.f, z: 0, w: 1 };
    }
    toFloat32Array() { return new Float32Array([this.a, this.b, 0, 0, this.c, this.d, 0, 0, 0, 0, 1, 0, this.e, this.f, 0, 1]); }
    toFloat64Array() { return new Float64Array([this.a, this.b, 0, 0, this.c, this.d, 0, 0, 0, 0, 1, 0, this.e, this.f, 0, 1]); }
  }

  g.DOMMatrix = ServerDOMMatrix;
}

async function ensureServerPdfWorker(): Promise<void> {
  const g = globalThis as any;
  if (g.pdfjsWorker?.WorkerMessageHandler) return;
  const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs" as any);
  if (!(workerModule as any).WorkerMessageHandler) {
    throw new Error("PDF.js worker module loaded without WorkerMessageHandler");
  }
  g.pdfjsWorker = workerModule;
}

export const extractPdfTextServer = createServerFn({ method: "POST" })
  .inputValidator((data: { filename: string; base64: string }) => {
    if (!data?.base64) throw new Error("No PDF data supplied");
    return data;
  })
  .handler(async ({ data }): Promise<ServerExtractedPdf> => {
    try {
      ensureServerDomMatrix();
      await ensureServerPdfWorker();
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

const PROMPT = `This PDF contains tennis match summaries or screenshots (one or more matchups per page), possibly including "Tennis Matrix AI" prediction-engine reports with sections like Model Votes, Monte Carlo Simulation, Set Score Distribution, and a Full Engine Breakdown (Surface Elo, Serve & Return, Recent Form, Fatigue Index / Match Load Recovery, Rest/Travel/Injury, Head-to-Head, Style Matchup).
Read EVERY page, including pages that are only images/screenshots.
Return strict JSON: {"matchups":[{"page_number":1,"player1_name":"","player2_name":"","tournament":null,"event_level":null,"round":null,"scheduled_date":null,"surface":null,"best_of":null,"matrix_predicted_winner":null,"matrix_wp":null,"matrix_summary":null,"other_fields":{}}]}
Rules: never invent a value — use null when a field is not visible on the page, and never guess a number.
If this page shows a "Tennis Matrix AI"-style prediction-engine report, also populate matrix_summary with this shape (omit or null out whatever isn't shown):
{"confidence_label":"e.g. LOW CONFIDENCE / HIGH CONFIDENCE / EXTREME","win_probability_range":"e.g. 21-99","agreement_label":"e.g. STRONGLY AGREE / HIGH DISAGREEMENT / Close to a coin flip","model_votes":{"<model name as printed, lowercase with underscores, e.g. surface_elo, serve_return, recent_form, head_to_head, market_consensus, general_model, specialist_model>":"<the printed probability pair exactly as shown, e.g. 71/29>"},"monte_carlo":{"win_probability":"e.g. 63.9%","range":"e.g. 21-99","expected_sets":"e.g. 2.4","simulations":"e.g. 10000","set_score_distribution":{"<score, e.g. 6-4>":"<its printed percentage>"}},"engine_breakdown":{"<module name as printed, lowercase with underscores, e.g. surface_elo, serve_return, recent_form, fatigue_index, match_load_recovery, rest_travel_injury, head_to_head, style_matchup>":{"<every labelled stat printed inside that module's panel, key = its label lowercase with underscores, value = exactly as printed>":"..."}}}
Put any other readable labelled value that doesn't fit a named module in other_fields as a string. player1_name and player2_name must be full player names as printed. This data is prediction-engine output for reference only — extract it faithfully, do not compute or infer values it doesn't show.`;

// ---------------------------------------------------------------------------
// Page-batched vision extraction
//
// The AI-gateway vision tier used to send the ENTIRE PDF as one base64 blob in
// one fetch, racing the whole call against a single 90s AbortController. That
// meant a 20+ page PDF got exactly one shot at finishing inside one timeout --
// if it didn't, every page's extraction was lost, not just the slow ones. It
// also meant one malformed/oversized page could sink pages that would
// otherwise have extracted cleanly.
//
// Fixed here by splitting the PDF into small page-range sub-documents (via
// pdf-lib, which needs no native bindings) and sending each range through its
// own bounded fetch, through a bounded worker pool. A batch that times out or
// errors degrades to a recorded page-range failure -- the OTHER batches' real
// results are kept. This is the same "bounded pool + per-unit deadline +
// isolated failure" shape as screenshotMatchupResolver.ts's per-matchup
// resolution (artifacts/api-server), just applied to PDF page ranges instead
// of screenshot matchups.
// ---------------------------------------------------------------------------

// Pages per AI-gateway call. Small enough that one call reading a batch stays
// well inside PDF_VISION_BATCH_TIMEOUT_MS even for dense grouped-match pages;
// large enough that a 100+-page PDF doesn't need hundreds of round trips.
const PDF_VISION_PAGE_BATCH_SIZE = Number(process.env["PDF_VISION_PAGE_BATCH_SIZE"]) || 4;
// How many page-batches are in flight against the AI gateway at once for a
// single PDF. Bounded so one large upload can't fan out unboundedly against a
// rate-limited external API -- mirrors MATCHUP_RESOLUTION_CONCURRENCY's role
// in the screenshot resolver.
const PDF_VISION_BATCH_CONCURRENCY = Number(process.env["PDF_VISION_BATCH_CONCURRENCY"]) || 3;
// Per-batch deadline (was: one 90s deadline for the whole document). A batch
// that blows this deadline degrades to a recorded failure for just its page
// range; every other batch keeps running.
const PDF_VISION_BATCH_TIMEOUT_MS = Number(process.env["PDF_VISION_BATCH_TIMEOUT_MS"]) || 60_000;

export interface PdfPageBatchFailure {
  startPage: number;
  endPage: number;
  error: string;
}

export interface ExtractMatchupsFromPdfResult {
  matchups: AiMatchup[];
  /** Total pages in the source PDF, from pdf-lib -- not just the pages that happened to extract. */
  pageCount: number;
  pagesProcessed: number;
  pagesFailed: number;
  /** One entry per page-range batch that timed out or errored. Empty when every batch succeeded. */
  batchFailures: PdfPageBatchFailure[];
}

interface PdfPageBatch {
  startPage: number;
  endPage: number;
  bytes: Uint8Array;
}

/** Splits a PDF into small page-range sub-documents. Pure I/O over pdf-lib, no network. */
async function splitPdfIntoPageBatches(bytes: Uint8Array, pagesPerBatch: number): Promise<{ pageCount: number; batches: PdfPageBatch[] }> {
  const { PDFDocument } = await import("pdf-lib");
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pageCount = source.getPageCount();
  const batches: PdfPageBatch[] = [];
  for (let start = 0; start < pageCount; start += pagesPerBatch) {
    const end = Math.min(start + pagesPerBatch, pageCount);
    const indices = Array.from({ length: end - start }, (_, i) => start + i);
    const sub = await PDFDocument.create();
    const copiedPages = await sub.copyPages(source, indices);
    for (const page of copiedPages) sub.addPage(page);
    const subBytes = await sub.save();
    batches.push({ startPage: start + 1, endPage: end, bytes: subBytes });
  }
  return { pageCount, batches };
}

/** Calls the AI gateway for ONE page-range batch. Throws on any failure -- the caller isolates it per batch. */
async function extractBatchViaVisionApi(params: { apiKey: string; filename: string; base64: string }): Promise<AiMatchup[]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": params.apiKey },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "file", file: { filename: params.filename || "summary.pdf", file_data: `data:application/pdf;base64,${params.base64}` } },
        ],
      }],
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
  if (!content.trim()) throw new Error("PDF reader returned an empty response for this page range.");

  let parsed: { matchups?: AiMatchup[] };
  try {
    parsed = JSON.parse(content) as { matchups?: AiMatchup[] };
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("PDF reader returned an invalid result for this page range.");
    parsed = JSON.parse(m[0]) as { matchups?: AiMatchup[] };
  }

  return parsed.matchups ?? [];
}

/**
 * Core page-batched extraction logic, kept as a plain exported function
 * (rather than only inside .handler) so it's directly unit-testable without
 * the TanStack server-function runtime -- same pattern as
 * audit-pipeline.functions.ts's driveAuditBatch/runAuditBatch split.
 */
type PdfBatchOutcome =
  | { ok: true; matchups: AiMatchup[] }
  | { ok: false; error: string };

export async function extractMatchupsFromPdfCore(data: { filename: string; base64: string }): Promise<ExtractMatchupsFromPdfResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI extraction is not configured (missing API key).");

  const bytes = Buffer.from(data.base64, "base64");
  const { pageCount, batches } = await splitPdfIntoPageBatches(bytes, PDF_VISION_PAGE_BATCH_SIZE);

  // BoundedOperationPool (already used elsewhere in this app for research-provider
  // calls) gives us both the concurrency cap AND the per-unit deadline in one
  // primitive: `work` never throws past this call (errors are caught and turned
  // into an { ok: false } outcome inside it), and a batch that blows its deadline
  // gets the `fallback` outcome instead -- while the slow call itself is left to
  // finish in the background rather than aborted, matching this pool's existing
  // behavior for research calls elsewhere in the audit pipeline.
  const pool = new BoundedOperationPool(PDF_VISION_BATCH_CONCURRENCY);
  const outcomes = await Promise.all(
    batches.map((batch) =>
      pool.runWithBudget<PdfBatchOutcome>(
        `pdf-vision-batch-p${batch.startPage}-${batch.endPage}`,
        PDF_VISION_BATCH_TIMEOUT_MS,
        async () => {
          try {
            const batchBase64 = Buffer.from(batch.bytes).toString("base64");
            const raw = await extractBatchViaVisionApi({ apiKey, filename: data.filename, base64: batchBase64 });
            // The AI numbers pages 1..N within the sub-PDF it was actually given;
            // remap back to the source PDF's real page numbers for accurate provenance.
            const matchups = raw.map((m) => ({ ...m, page_number: (m.page_number || 1) + batch.startPage - 1 }));
            return { ok: true, matchups };
          } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : String(error) };
          }
        },
        () => ({ ok: false, error: `Timed out after ${PDF_VISION_BATCH_TIMEOUT_MS}ms` }),
      ),
    ),
  );

  const batchFailures: PdfPageBatchFailure[] = [];
  const matchupLists: AiMatchup[][] = [];
  outcomes.forEach((outcome, i) => {
    const batch = batches[i]!;
    if (outcome.ok) matchupLists.push(outcome.matchups);
    else batchFailures.push({ startPage: batch.startPage, endPage: batch.endPage, error: outcome.error });
  });

  const matchups = matchupLists.flat().filter((m) => m.player1_name && m.player2_name);
  const pagesFailed = batchFailures.reduce((sum, f) => sum + (f.endPage - f.startPage + 1), 0);
  const pagesProcessed = pageCount - pagesFailed;

  // Only a total loss (nothing extracted AND nothing even completed) is a hard
  // failure. A partial result -- some pages read, some batches failed -- is
  // real, usable data and must reach the caller instead of being thrown away.
  if (matchups.length === 0 && pagesProcessed === 0) {
    const reason = batchFailures[0] ? ` First failure: ${batchFailures[0].error}` : "";
    throw new Error(`PDF reader found no player matchup names across ${batches.length} page batch(es).${reason} Try a clearer PDF or image.`);
  }

  return { matchups, pageCount, pagesProcessed, pagesFailed, batchFailures };
}

export const extractMatchupsFromPdf = createServerFn({ method: "POST" })
  .inputValidator((data: { filename: string; base64: string }) => {
    if (!data?.base64) throw new Error("No PDF data supplied");
    return data;
  })
  .handler(async ({ data }): Promise<ExtractMatchupsFromPdfResult> => extractMatchupsFromPdfCore(data));
