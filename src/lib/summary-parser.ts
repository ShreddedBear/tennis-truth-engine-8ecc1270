// Heuristic extraction of matchups + fields from a Tennis Matrix summary PDF.
// Nothing is silently guessed: every field carries an extraction status and
// confidence, and everything is reviewable before the audit starts.

export type ExtractionStatus = "DIRECT" | "RECONSTRUCTED" | "PARTIAL" | "UNAVAILABLE" | "EXCLUDED";

export interface ParsedField {
  field_key: string;
  raw_value: string | null;
  normalized_value: string | null;
  extraction_status: ExtractionStatus;
  confidence: number;
  page_number: number;
}

export interface ParsedMatchup {
  player1_name: string;
  player2_name: string;
  page_number: number;
  fields: ParsedField[];
  confidence: number;
}

const VS = /([A-ZÀ-Ý][\p{L}'’.\- ]{1,40}?)\s+(?:vs\.?|v\.|versus|—|–)\s+([A-ZÀ-Ý][\p{L}'’.\- ]{1,40})/u;

const FIELD_PATTERNS: Array<[string, RegExp]> = [
  ["tournament", /(?:tournament|event)\s*[:\-]\s*(.+)/i],
  ["event_level", /(?:event level|level|category)\s*[:\-]\s*(.+)/i],
  ["round", /round\s*[:\-]\s*(.+)/i],
  ["scheduled_date", /(?:date|scheduled)\s*[:\-]\s*(.+)/i],
  ["surface", /surface\s*[:\-]\s*(.+)/i],
  ["indoor_outdoor", /(indoor|outdoor)\s*[:\-]?\s*(.*)/i],
  ["best_of", /best[\s\-]?of\s*[:\-]?\s*(\d)/i],
  ["matrix_predicted_winner", /predicted winner\s*[:\-]\s*(.+)/i],
  ["matrix_wp", /(?:win probability|matrix wp|wp)\s*[:\-]\s*([\d.]+)\s*%?/i],
  ["monte_carlo_winner", /monte carlo winner\s*[:\-]\s*(.+)/i],
  ["monte_carlo_prob", /monte carlo (?:win )?(?:probability|prob)\s*[:\-]\s*([\d.]+)/i],
  ["monte_carlo_range", /monte carlo range\s*[:\-]\s*(.+)/i],
  ["data_quality", /(?:data quality|dq)\s*[:\-]\s*(.+)/i],
  ["upset_risk", /upset risk\s*[:\-]\s*(.+)/i],
  ["model_agreement", /(?:model )?agreement\s*[:\-]\s*(.+)/i],
  ["matchup_closeness", /matchup closeness\s*[:\-]\s*(.+)/i],
  ["p1_elo", /player 1 elo\s*[:\-]\s*([\d.]+)/i],
  ["p2_elo", /player 2 elo\s*[:\-]\s*([\d.]+)/i],
  ["elo_win_prob", /elo win prob\w*\s*[:\-]\s*([\d.]+)/i],
  ["general_model", /general model\s*[:\-]\s*(.+)/i],
  ["specialist_model", /specialist model\s*[:\-]\s*(.+)/i],
  ["h2h", /h2h\s*[:\-]\s*(.+)/i],
  ["matrix_market", /market\s*[:\-]\s*(.+)/i],
  ["p1_recent_form", /p1 recent form\s*[:\-]\s*(.+)/i],
  ["p2_recent_form", /p2 recent form\s*[:\-]\s*(.+)/i],
  ["p1_fatigue", /p1 fatigue\s*[:\-]\s*(.+)/i],
  ["p2_fatigue", /p2 fatigue\s*[:\-]\s*(.+)/i],
  ["p1_style", /p1 style\s*[:\-]\s*(.+)/i],
  ["p2_style", /p2 style\s*[:\-]\s*(.+)/i],
];

function fieldsFromBlock(block: string, page: number): ParsedField[] {
  const out: ParsedField[] = [];
  for (const [key, re] of FIELD_PATTERNS) {
    const m = block.match(re);
    if (!m) continue;
    const raw = (m[1] ?? "").trim().replace(/\s{2,}.*$/, "");
    if (!raw) continue;
    out.push({
      field_key: key,
      raw_value: raw,
      normalized_value: raw,
      extraction_status: "DIRECT",
      confidence: 0.9,
      page_number: page,
    });
  }
  return out;
}

export function parseSummaryText(pages: string[]): ParsedMatchup[] {
  const matchups: ParsedMatchup[] = [];

  pages.forEach((pageText, idx) => {
    const page = idx + 1;
    const lines = pageText.split(/\n/);
    const anchors: number[] = [];
    lines.forEach((l, i) => {
      if (VS.test(l)) anchors.push(i);
    });

    if (anchors.length === 0) return;

    anchors.forEach((anchorIdx, k) => {
      const nextAnchor = anchors[k + 1] ?? lines.length;
      const block = lines.slice(anchorIdx, nextAnchor).join("\n");
      const m = (lines[anchorIdx] ?? "").match(VS);
      if (!m) return;
      const p1 = (m[1] ?? "").trim().replace(/\s+/g, " ");
      const p2 = (m[2] ?? "").trim().replace(/\s+/g, " ");
      if (!p1 || !p2) return;
      const fields = fieldsFromBlock(block, page);
      matchups.push({
        player1_name: p1,
        player2_name: p2,
        page_number: page,
        fields,
        confidence: Number(Math.min(1, 0.45 + fields.length * 0.05).toFixed(2)),
      });
    });
  });

  return matchups;
}

export function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalKey(parts: {
  tournament?: string | null;
  round?: string | null;
  date?: string | null;
  p1: string;
  p2: string;
}) {
  const players = [normalizeName(parts.p1), normalizeName(parts.p2)].sort().join("|");
  return [
    (parts.tournament ?? "unknown").toLowerCase().trim(),
    (parts.round ?? "unknown").toLowerCase().trim(),
    (parts.date ?? "unknown").toLowerCase().trim(),
    players,
  ].join("::");
}
