// Heuristic extraction of matchups + fields from Tennis Matrix summaries and
// screenshot/betting-card PDFs. Nothing is silently guessed: every field is
// reviewable before the audit starts.

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

const VS = /([A-ZÀ-Ý][\p{L}'’.\- ]{1,55}?)\s+(?:vs\.?|v\.|versus|—|–)\s+([A-ZÀ-Ý][\p{L}'’.\- ]{1,55})/iu;
const ODDS = /^[+\-−]\s*\d{2,4}$/;
const NOISE = /^(?:tennis|today|tomorrow|live|open|closed|volume|vol|atp|wta|itf|challenger|moneyline|spread|total|draw|market|starts?|ends?)\b/i;
const EVENTISH = /\b(?:ATP|WTA|ITF|Challenger|Cincinnati|Cancun|US Open|Wimbledon|Roland Garros|Australian Open)\b/i;

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

function cleanLine(v: string): string {
  return v.replace(/[|]/g, " ").replace(/\s+/g, " ").trim();
}

function looksLikeFullPlayerName(line: string): boolean {
  const s = cleanLine(line).replace(/[+\-−]\s*\d{2,4}\s*$/, "").trim();
  if (!s || s.length < 4 || s.length > 55 || NOISE.test(s) || EVENTISH.test(s)) return false;
  if (/\d|\$|@|%|\bvol\b/i.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  // Betting cards normally print first + last name. Requiring 2+ words avoids
  // treating short surname-only headings such as "Fearnley vs Galarneau" as
  // the canonical names when the full names are printed below.
  if (words.length < 2 || words.length > 6) return false;
  return words.every((w) => /^[\p{L}][\p{L}'’.\-]*$/u.test(w));
}

function fieldsFromBlock(block: string, page: number): ParsedField[] {
  const out: ParsedField[] = [];
  for (const [key, re] of FIELD_PATTERNS) {
    const m = block.match(re);
    if (!m) continue;
    const raw = (m[1] ?? "").trim().replace(/\s{2,}.*$/, "");
    if (!raw) continue;
    out.push({ field_key:key, raw_value:raw, normalized_value:raw, extraction_status:"DIRECT", confidence:0.9, page_number:page });
  }
  // Screenshot cards often show an event name without a "Tournament:" label.
  if (!out.some((f) => f.field_key === "tournament")) {
    const eventLine = block.split(/\n/).map(cleanLine).find((l) => EVENTISH.test(l) && !/\bvs\b/i.test(l));
    if (eventLine) out.push({ field_key:"tournament", raw_value:eventLine, normalized_value:eventLine, extraction_status:"DIRECT", confidence:0.8, page_number:page });
  }
  return out;
}

function canonicalNamesAroundAnchor(lines: string[], anchor: number, p1Hint: string, p2Hint: string): [string,string] {
  const window = lines.slice(anchor + 1, Math.min(lines.length, anchor + 12)).map(cleanLine);
  const names = window.filter(looksLikeFullPlayerName);
  if (names.length >= 2) return [names[0], names[1]];
  return [cleanLine(p1Hint), cleanLine(p2Hint)];
}

function inferPairWithoutVs(lines: string[]): [string,string] | null {
  const cleaned = lines.map(cleanLine).filter(Boolean);
  const candidates = cleaned.filter(looksLikeFullPlayerName);
  if (candidates.length < 2) return null;

  // Prefer two names that appear before the event/footer line and in the same
  // betting card. For a one-card-per-page PDF this correctly handles pages
  // such as Arthur Fils / Thiago Agustin Tirante that have no visible "vs".
  const unique = candidates.filter((n,i,a) => a.findIndex((x) => normalizeName(x) === normalizeName(n)) === i);
  return unique.length >= 2 ? [unique[0], unique[1]] : null;
}

export function parseSummaryText(pages: string[]): ParsedMatchup[] {
  const matchups: ParsedMatchup[] = [];

  pages.forEach((pageText, idx) => {
    const page = idx + 1;
    const lines = pageText.split(/\n/).map(cleanLine).filter(Boolean);
    const anchors: number[] = [];
    lines.forEach((l,i) => { if (VS.test(l)) anchors.push(i); });

    if (anchors.length) {
      anchors.forEach((anchorIdx,k) => {
        const nextAnchor = anchors[k+1] ?? lines.length;
        const block = lines.slice(anchorIdx,nextAnchor).join("\n");
        const m = lines[anchorIdx].match(VS); if (!m) return;
        const [p1,p2] = canonicalNamesAroundAnchor(lines,anchorIdx,m[1]??"",m[2]??"");
        if (!p1 || !p2) return;
        const fields = fieldsFromBlock(block,page);
        matchups.push({ player1_name:p1, player2_name:p2, page_number:page, fields, confidence:Number(Math.min(1,0.65+fields.length*0.04).toFixed(2)) });
      });
      return;
    }

    const inferred = inferPairWithoutVs(lines);
    if (!inferred) return;
    const fields = fieldsFromBlock(lines.join("\n"),page);
    matchups.push({ player1_name:inferred[0], player2_name:inferred[1], page_number:page, fields, confidence:Number(Math.min(0.9,0.72+fields.length*0.03).toFixed(2)) });
  });

  return matchups;
}

export function normalizeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

export function canonicalKey(parts: { tournament?: string|null; round?: string|null; date?: string|null; p1:string; p2:string; }) {
  const players=[normalizeName(parts.p1),normalizeName(parts.p2)].sort().join("|");
  return [(parts.tournament??"unknown").toLowerCase().trim(),(parts.round??"unknown").toLowerCase().trim(),(parts.date??"unknown").toLowerCase().trim(),players].join("::");
}
