/**
 * rawTextParser — converts plain OCR text (from OCR.Space or a local Tesseract binary)
 * into RawMatchupEntry[] using heuristics.
 *
 * Vision AI providers (OpenAI, Gemini, Anthropic) do this via prompt-structured JSON.
 * Text-extraction providers give us raw strings; this module bridges that gap.
 *
 * Heuristics applied in order:
 *   1. Structured "MATCH / Tournament / Player 1 / Player 2" blocks
 *   2. Inline "X vs Y" / "X v Y" / "X def. Y" patterns on the same line
 *   3. Consecutive candidate-name lines (two name-like lines back-to-back)
 *
 * A "name-like" line:
 *   - Contains at least one letter
 *   - Does NOT look like a score, time, date, odds line, or decoration
 *   - Is 3–60 chars after trimming
 */

import type { RawMatchupEntry } from "../tennisData/screenshotRecognition.js";

// Patterns that indicate a line is NOT a player name
const SKIP_PATTERNS = [
  /^\d{1,2}:\d{2}/, // time "14:30"
  /^\d{1,2}\/\d{1,2}\/\d{2,4}/, // date "07/26/2024"
  /^[+\-]?\d+(\.\d+)?$/, // pure number (odds, score, rank)
  /^\d+-\d+$/, // score "6-3"
  /\d{2,}%/, // percentage "65%"
  /^(ATP|WTA|ITF|USD|EUR|GBP|\$|€|£)/, // currency / tour prefix
  /^(live|upcoming|scheduled|finished|court\s?\d|round\s?\d)/i, // status text
  /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, // day names
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i, // month abbreviations
  /^\[|\]$/, // bracket lines
  /^[-—–_=*#•>|]+$/, // decoration-only lines
  // Sportsbook UI labels and betting market type names
  /^(moneyline|spread|total|over|under|parlay|combo|teaser|prop|futures|handicap|sgp)$/i,
  /^(today|tomorrow|continue|back|next|more|home|add|remove|confirm|submit|view|open|close)$/i,
  /^(pro baseball|nfl|nba|nhl|mlb|mls|pga|mma|ufc|soccer|football|basketball|baseball|hockey|golf)$/i,
  /\bmarket[s]?\b/i, // "5 Markets", "Combo 3 Markets"
  /\bleg\s+parlay\b/i, // "3 leg parlay"
  /@/, // anything with @ (time references like "/ @ 4:20PM EDT")
  /\b(am|pm)\b.*\b(edt|est|pst|mst|cst|pt|ct|et|mt)\b/i, // time+timezone
  /(?:https?:\/\/|www\.|\.(?:com|net|org|io|dev|app)\b)/i, // URLs and app hostnames
  /[/_\\]/, // paths, timezone identifiers, and host fragments
  /\d/, // player names do not contain digits; rejects diagnostics/timestamps/odds
  /\b(run model|sign in|log in|save predictions|fixtures?|diagnostics|provider|received|filtered|timezone|retained|dismissed|last refresh|refresh|upcoming|live data|history|no .+ found)\b/i,
];

function isNameLike(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 60) return false;
  if (!/\p{L}/u.test(t)) return false;
  // Human names may contain Unicode letters, spaces, apostrophes, periods, and hyphens.
  // Reject arrows, bullets, colons, URL punctuation, and other app/UI decoration before pairing
  // consecutive OCR lines as a matchup.
  if (!/^[\p{L}\p{M}][\p{L}\p{M}.'’ -]*$/u.test(t)) return false;
  return !SKIP_PATTERNS.some((p) => p.test(t));
}

function cleanName(raw: string): string | null {
  // Strip leading/trailing punctuation, seed numbers "(1)", bracket chars
  const cleaned = raw
    .replace(/^\(\d+\)\s*/, "")   // "(1) "
    .replace(/\s*\(\d+\)$/, "")   // " (1)"
    .replace(/^[\s\-–—:]+/, "")
    .replace(/[\s\-–—:]+$/, "")
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

function extractLabeledValue(line: string, label: string): string | null {
  const nextLabel = String.raw`(?=\s+(?:Tournament|Surface|Level|Best\s+of|Date|Time|Player\s*[12])\s*:|$)`;
  const match = new RegExp(String.raw`(?:^|\s)${label}\s*:\s*(.*?)${nextLabel}`, "i").exec(line);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

/**
 * OCR.Space preserves the text on the supplied schedule sheets very accurately,
 * but it does not add semantic structure. Parse their explicit labels before the
 * generic name-line heuristic, which intentionally rejects colons and therefore
 * cannot recognize lines such as "Player 1: Carlos Alcaraz".
 */
function parseStructuredMatchBlocks(lines: string[]): RawMatchupEntry[] {
  const matchups: RawMatchupEntry[] = [];
  let current: RawMatchupEntry | null = null;

  const ensureCurrent = (): RawMatchupEntry => {
    current ??= { player1Name: null, player2Name: null, eventName: null };
    return current;
  };

  const flush = (): void => {
    if (!current) return;
    if (current.player1Name || current.player2Name) {
      matchups.push(current);
    }
    current = null;
  };

  for (const line of lines) {
    if (/^MATCH\s+\d+\b/i.test(line)) {
      flush();
      ensureCurrent();
      continue;
    }

    const tournament = extractLabeledValue(line, "Tournament");
    const surface = extractLabeledValue(line, "Surface");
    const level = extractLabeledValue(line, "Level");
    const bestOf = extractLabeledValue(line, String.raw`Best\s+of`);
    const date = extractLabeledValue(line, "Date");
    const time = extractLabeledValue(line, "Time");
    const player1 = extractLabeledValue(line, String.raw`Player\s*1`);
    const player2 = extractLabeledValue(line, String.raw`Player\s*2`);

    if (tournament) ensureCurrent().eventName = tournament;
    if (surface) ensureCurrent().surface = surface;
    if (level) ensureCurrent().eventLevel = level;
    if (bestOf) ensureCurrent().bestOf = bestOf;
    if (date) ensureCurrent().date = date;
    if (time) ensureCurrent().time = time;
    if (player1) ensureCurrent().player1Name = cleanName(player1);
    if (player2) ensureCurrent().player2Name = cleanName(player2);
  }

  flush();
  return matchups;
}

export function parseOcrText(text: string): RawMatchupEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const matchups: RawMatchupEntry[] = [];

  // Strategy 1 — explicit labeled matchup blocks
  const structured = parseStructuredMatchBlocks(lines);
  if (structured.length > 0) return structured;

  // Strategy 2 — inline "X vs Y" on the same line
  const vsRe = /^(.+?)\s+(?:vs?\.?|def\.?|–|-)\s+(.+)$/i;
  for (const line of lines) {
    const m = vsRe.exec(line);
    if (m) {
      const p1 = isNameLike(m[1]) ? cleanName(m[1]) : null;
      const p2 = isNameLike(m[2]) ? cleanName(m[2]) : null;
      if (p1 && p2 && p1 !== p2) {
        matchups.push({ player1Name: p1, player2Name: p2, eventName: null });
      }
    }
  }

  if (matchups.length > 0) return matchups;

  // Strategy 3 — consecutive name-like lines treated as a pair
  const nameLines = lines.filter(isNameLike);
  for (let i = 0; i + 1 < nameLines.length; i += 2) {
    const p1 = cleanName(nameLines[i]);
    const p2 = cleanName(nameLines[i + 1]);
    if (p1 && p2 && p1 !== p2) {
      matchups.push({ player1Name: p1, player2Name: p2, eventName: null });
    }
  }

  return matchups;
}
