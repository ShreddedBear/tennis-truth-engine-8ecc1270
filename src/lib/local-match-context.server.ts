import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE_URL = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";

type CsvRow = Record<string, string>;
type Fields = Record<string, string | null>;

let atpCache: CsvRow[] | null = null;
let wtaCache: CsvRow[] | null = null;

function norm(v: string) {
  return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()])));
}

function load(tour: "ATP" | "WTA") {
  if (tour === "ATP" && atpCache) return atpCache;
  if (tour === "WTA" && wtaCache) return wtaCache;
  const rel = tour === "ATP"
    ? "data/public/predixsport/atp/atp_elo_matches.csv"
    : "data/public/predixsport/wta/wta_elo_ratings.csv";
  try {
    const rows = parseCsv(readFileSync(join(process.cwd(), rel), "utf8"));
    if (tour === "ATP") atpCache = rows; else wtaCache = rows;
    return rows;
  } catch { return []; }
}

function cleanTournament(v: string | null | undefined) {
  if (!v) return null;
  return v.replace(/^\$?[\d,]+\s*(?:vol(?:ume)?)?\s*/i, "").trim() || null;
}

function hintTournament(hints: Fields) {
  return cleanTournament(hints.tournament ?? hints.event ?? null);
}

function hintDate(hints: Fields) {
  const v = hints.scheduled_date ?? hints.date ?? null;
  if (!v) return null;
  const m = String(v).match(/20\d{2}-\d{2}-\d{2}/);
  return m?.[0] ?? null;
}

function eventLevelFromRow(row: CsvRow): string | null {
  const raw = row.tournament_type || row.event_level || row.level || "";
  if (/challenger/i.test(raw) || /challenger/i.test(row.tournament || "")) return "Challenger";
  if (/grand.?slam|slam/i.test(raw)) return "Grand Slam";
  if (/masters.?1000|1000/i.test(raw)) return "Masters 1000";
  if (/atp.?500|500/i.test(raw)) return "ATP 500";
  if (/atp.?250|250/i.test(raw)) return "ATP 250";
  if (/wta.?1000|1000/i.test(raw)) return "WTA 1000";
  if (/wta.?500|500/i.test(raw)) return "WTA 500";
  if (/wta.?250|250/i.test(raw)) return "WTA 250";
  if (/itf/i.test(raw)) return "ITF";
  return raw.trim() || null;
}

function bestOfFromContext(level: string | null, tournament: string | null, tour: "ATP" | "WTA"): string | null {
  if (tour === "WTA") return "3";
  if (/grand slam/i.test(level ?? "") || /wimbledon|roland garros|french open|us open|australian open/i.test(tournament ?? "")) return "5";
  if (level || tournament) return "3";
  return null;
}

function exactAtpPair(p1: string, p2: string, hints: Fields): CsvRow | null {
  const a = norm(p1), b = norm(p2), ht = norm(hintTournament(hints) ?? ""), hd = hintDate(hints);
  const candidates = load("ATP").filter((r) => {
    const rp = norm(r.player || ""), ro = norm(r.opponent || "");
    return (rp === a && ro === b) || (rp === b && ro === a);
  });
  if (!candidates.length) return null;
  const scored = candidates.map((r) => {
    let score = 0;
    if (hd && r.date === hd) score += 100;
    const rt = norm(r.tournament || "");
    if (ht && (rt === ht || rt.includes(ht) || ht.includes(rt))) score += 50;
    const hs = norm(hints.surface ?? ""); if (hs && norm(r.surface || "") === hs) score += 10;
    return { r, score };
  }).sort((x, y) => y.score - x.score || (y.r.date || "").localeCompare(x.r.date || ""));
  // If there are multiple historical meetings and no date/tournament evidence,
  // do not pretend the most recent one is the uploaded match.
  if (scored.length > 1 && scored[0].score === 0) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score && scored[0].score < 50) return null;
  return scored[0].r;
}

function tournamentSurface(tournament: string | null): { surface: string | null; tour: "ATP" | "WTA" | null; level: string | null } {
  if (!tournament) return { surface: null, tour: null, level: null };
  const ht = norm(tournament);
  const all: Array<{ row: CsvRow; tour: "ATP" | "WTA" }> = [
    ...load("ATP").map((row) => ({ row, tour: "ATP" as const })),
    ...load("WTA").map((row) => ({ row, tour: "WTA" as const })),
  ].filter(({ row }) => {
    const rt = norm(row.tournament || "");
    return rt && (rt === ht || rt.includes(ht) || ht.includes(rt));
  });
  if (!all.length) return { surface: null, tour: null, level: null };
  const surfaceCounts = new Map<string, number>();
  const tourCounts = new Map<"ATP" | "WTA", number>();
  for (const x of all) {
    if (x.row.surface) surfaceCounts.set(x.row.surface, (surfaceCounts.get(x.row.surface) ?? 0) + 1);
    tourCounts.set(x.tour, (tourCounts.get(x.tour) ?? 0) + 1);
  }
  const surface = [...surfaceCounts].sort((a,b) => b[1]-a[1])[0]?.[0] ?? null;
  const tour = [...tourCounts].sort((a,b) => b[1]-a[1])[0]?.[0] ?? null;
  const representative = all.sort((a,b)=>(b.row.date||"").localeCompare(a.row.date||""))[0]?.row;
  return { surface, tour, level: representative ? eventLevelFromRow(representative) : null };
}

export function resolveLocalMatchContext(p1: string, p2: string, hints: Fields) {
  const direct = exactAtpPair(p1, p2, hints);
  const hintedTournament = hintTournament(hints);
  const hist = tournamentSurface(hintedTournament);
  const tour: "ATP" | "WTA" | null = direct ? "ATP" : hist.tour;
  const tournament = cleanTournament(direct?.tournament) ?? hintedTournament;
  const level = direct ? eventLevelFromRow(direct) : hist.level;
  const surface = direct?.surface || hist.surface || null;
  const date = direct?.date || hintDate(hints) || null;
  const fields: Fields = {
    tournament,
    event_level: level,
    round: direct?.round || null,
    scheduled_date: date,
    surface,
    best_of: bestOfFromContext(level, tournament, tour ?? "ATP"),
  };
  const any = Object.values(fields).some(Boolean);
  return {
    ok: any,
    fields,
    sources: any ? ["PredixSport public tennis data"] : [],
    sourceUrl: any ? SOURCE_URL : null,
    unresolvedReason: any ? null : "No confident local public-data match context found",
  };
}
