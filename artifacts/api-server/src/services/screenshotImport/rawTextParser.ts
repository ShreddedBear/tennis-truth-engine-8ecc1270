/**
 * rawTextParser — converts plain OCR text (from OCR.Space or a local Tesseract binary)
 * into RawMatchupEntry[] using heuristics.
 *
 * Vision AI providers (OpenAI, Gemini, Anthropic) do this via prompt-structured JSON.
 * Text-extraction providers give us raw strings; this module bridges that gap.
 *
 * Heuristics applied in order:
 *   1. Inline "X vs Y" / "X v Y" / "X def. Y" records, with metadata read only
 *      until the next explicit matchup heading.
 *   2. Exactly two name-like lines inside one blank-line-delimited block.
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
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i, // month prefixes
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
];

function isNameLike(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 60) return false;
  if (!/[a-zA-Z]/.test(t)) return false;
  return !SKIP_PATTERNS.some((p) => p.test(t));
}

function cleanName(raw: string): string | null {
  // Strip leading/trailing punctuation, seed numbers "(1)", bracket chars
  const cleaned = raw
    .replace(/^matchup\s+\d+(?:\s+of\s+\d+)?\s*[:\-–—]?\s*/i, "")
    .replace(/^\(\d+\)\s*/, "")   // "(1) "
    .replace(/\s*\(\d+\)$/, "")   // " (1)"
    .replace(/^[\s\-–—:]+/, "")
    .replace(/[\s\-–—:]+$/, "")
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

function parseNumberedFixtureTables(text: string): RawMatchupEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const matchups: RawMatchupEntry[] = [];
  let eventName: string | null = null;
  let level: RawMatchupEntry["level"] = null;
  let surface: RawMatchupEntry["surface"] = null;
  let round: string | null = null;
  let matchFormat: RawMatchupEntry["matchFormat"] = null;
  let insideTable = false;

  const isEventHeading = (line: string) =>
    /^(?:ATP|WTA|ITF)\b/i.test(line) &&
    !/^(?:ATP|WTA|ITF)\s+(?:PLAYER|EVENT DATA)\b/i.test(line);
  const isTableBoundary = (line: string) =>
    /^EVENT DATA$/i.test(line) || isEventHeading(line);
  const normalizeSurface = (value: string): RawMatchupEntry["surface"] => {
    const normalized = value.replace(/[\s_-]/g, "").toUpperCase();
    if (normalized === "HARD") return "Hard";
    if (normalized === "CLAY" || normalized === "REDCLAY") return "Clay";
    if (normalized === "GRASS") return "Grass";
    if (normalized === "INDOORHARD" || normalized === "CARPET") return "IndoorHard";
    return null;
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;

    if (isEventHeading(line)) {
      eventName = line;
      level = /challenger/i.test(line)
        ? "Challenger"
        : /^ITF\b/i.test(line)
          ? "ITF"
          : /^ATP\b/i.test(line) && /\b500\b/.test(line)
            ? "ATP500"
            : /^ATP\b/i.test(line) && /\b250\b/.test(line)
              ? "ATP250"
              : /^WTA\b/i.test(line) && /\b1000\b/.test(line)
                ? "WTA1000"
                : /^WTA\b/i.test(line) && /\b500\b/.test(line)
                  ? "WTA500"
                  : /^WTA\b/i.test(line) && /\b250\b/.test(line)
                    ? "WTA250"
                    : "Other";
      surface = null;
      round = null;
      matchFormat = null;
      insideTable = false;
      continue;
    }

    const metadata = /^(Indoor\s+Hard|Hard|Clay|Red\s+Clay|Grass|Carpet)\s*[•·|]\s*(Round[^•·|]+)\s*[•·|]\s*Best\s+of\s+([35])$/i.exec(line);
    if (metadata) {
      surface = normalizeSurface(metadata[1]!);
      round = metadata[2]!.trim();
      matchFormat = metadata[3] === "5" ? "BestOf5" : "BestOf3";
      continue;
    }

    if (line === "#" && eventName) {
      insideTable = true;
      continue;
    }
    if (/^EVENT DATA$/i.test(line)) {
      insideTable = false;
      continue;
    }
    if (!insideTable || !eventName || !/^\d+$/.test(line)) continue;

    const names: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor++) {
      const candidate = lines[cursor]!;
      if (/^\d+$/.test(candidate) || isTableBoundary(candidate)) break;
      if (/^PLAYER [12]$/i.test(candidate)) continue;
      if (isNameLike(candidate)) names.push(candidate);
    }
    if (names.length !== 2) continue;
    const player1Name = cleanName(names[0]!);
    const player2Name = cleanName(names[1]!);
    if (!player1Name || !player2Name || player1Name === player2Name) continue;
    matchups.push({
      player1Name,
      player2Name,
      eventName,
      level,
      round,
      scheduledDate: null,
      surface,
      matchFormat,
    });
  }

  return matchups;
}

export function parseOcrText(text: string): RawMatchupEntry[] {
  const fixtureMatchups = parseNumberedFixtureTables(text);
  if (fixtureMatchups.length > 0) return fixtureMatchups;

  const matchups: RawMatchupEntry[] = [];
  const vsRe = /^(.+?)\s+(?:vs?\.?|def\.?|–|-)\s+(.+)$/i;
  const rawLines = text.split(/\r?\n/);
  const headings = rawLines
    .map((line, index) => ({ index, match: vsRe.exec(line.trim()) }))
    .filter((entry): entry is { index: number; match: RegExpExecArray } => entry.match !== null);

  type FieldName = "eventName" | "level" | "round" | "scheduledDate" | "surface" | "bestOf";
  const labels: Array<{ name: FieldName; source: string }> = [
    { name: "eventName", source: "(?:tournament|tournamen|lournament|ournament|tourament|toumament|burnament|rumament|thumament|taumament|nurnament|journament)" },
    { name: "level", source: "(?:event\\s*[ _-]?(?:level|lavel|lovel)|evant\\s*[ _-]?level|fvent\\s*[ _-]?level|fuent\\s*[ _-]?level|tvmtlevel)(?=\\s*[:;,.-])" },
    { name: "round", source: "(?:round|raund|rount|rourd|kound)(?=\\s*[:;,.-])" },
    { name: "scheduledDate", source: "(?:scheduled\\s*[ _-]?(?:date|dale|dato)|scheduler\\s*[ _-]?date)(?=\\s*[:;,.-])" },
    { name: "surface", source: "(?:surface|surfuce|surtace|surace|surlace)(?=\\s*[:;,.-])" },
    { name: "bestOf", source: "(?:best\\s*[ _-]?(?:of|ot|or)|rest\\s*[ _-]?of)(?=\\s*[:;,.-])" },
  ];
  const allLabels = labels.map((label) => `(?<${label.name}>${label.source})`).join("|");

  const fields = (lines: string[]): Partial<Record<FieldName, string>> => {
    const values: Partial<Record<FieldName, string>> = {};
    for (const line of lines) {
      const matches = [...line.matchAll(new RegExp(allLabels, "gi"))];
      for (let index = 0; index < matches.length; index++) {
        const match = matches[index]!;
        const name = Object.keys(match.groups ?? {}).find(
          (key) => match.groups?.[key] !== undefined,
        ) as FieldName | undefined;
        if (!name || values[name]) continue;
        const start = (match.index ?? 0) + match[0].length;
        const end = matches[index + 1]?.index ?? line.length;
        const value = line.slice(start, end).replace(/^[\s:;,.-]+|[\s|/]+$/g, "").trim();
        if (value) values[name] = value;
      }
    }
    return values;
  };
  const normalizedSurface = (value: string | null): RawMatchupEntry["surface"] => {
    const normalized = value?.replace(/[\s_-]/g, "").toUpperCase();
    if (normalized === "HARD") return "Hard";
    if (normalized === "CLAY" || normalized === "REDCLAY") return "Clay";
    if (normalized === "GRASS") return "Grass";
    if (normalized === "INDOORHARD") return "IndoorHard";
    return null;
  };
  const normalizedLevel = (value: string | null): RawMatchupEntry["level"] => {
    const normalized = value?.replace(/[\s_-]/g, "").toUpperCase();
    if (normalized === "GRANDSLAM") return "GrandSlam";
    if (normalized === "MASTERS1000") return "Masters1000";
    if (["ATP500", "ATP250", "WTA1000", "WTA500", "WTA250", "ITF"].includes(normalized ?? "")) {
      return normalized as NonNullable<RawMatchupEntry["level"]>;
    }
    if (normalized === "CHALLENGER" || normalized === "ATPCHALLENGER") return "Challenger";
    return value ? "Other" : null;
  };
  const normalizedFormat = (value: string | null): RawMatchupEntry["matchFormat"] => {
    const normalized = value?.replace(/[\s_-]/g, "").toUpperCase();
    if (normalized === "3" || normalized === "BO3" || normalized === "BESTOF3") return "BestOf3";
    if (normalized === "5" || normalized === "BO5" || normalized === "BESTOF5") return "BestOf5";
    return null;
  };

  for (let headingIndex = 0; headingIndex < headings.length; headingIndex++) {
    const heading = headings[headingIndex]!;
    const nextStart = headings[headingIndex + 1]?.index ?? rawLines.length;
    const recordLines = rawLines.slice(heading.index + 1, nextStart);
    const p1 = cleanName(heading.match[1]!);
    const p2 = cleanName(heading.match[2]!);
    if (!p1 || !p2 || p1 === p2) continue;
    const metadata = fields(recordLines);
    matchups.push({
      player1Name: p1,
      player2Name: p2,
      eventName: metadata.eventName ?? null,
      level: normalizedLevel(metadata.level ?? null),
      round: metadata.round ?? null,
      scheduledDate: metadata.scheduledDate ?? null,
      surface: normalizedSurface(metadata.surface ?? null),
      matchFormat: normalizedFormat(metadata.bestOf ?? null),
    });
  }

  if (matchups.length > 0) {
    const comparableEvent = (value: string | null | undefined) =>
      String(value ?? "")
        .toLowerCase()
        .replace(/\b(?:atp|alp|all)\b/g, "atp")
        .replace(/[^a-z0-9]+/g, "")
        .replace(/(?:bell?s|biell[as])/g, "biella");
    const similarEvent = (left: string, right: string) => {
      if (left === right) return true;
      const shorter = left.length <= right.length ? left : right;
      const longer = left.length > right.length ? left : right;
      return shorter.length >= 8 && longer.includes(shorter);
    };
    // Metadata may be omitted from one otherwise-readable card. Fill only when both
    // immediate neighbours independently name the same event; never infer player names.
    for (let index = 1; index + 1 < matchups.length; index++) {
      const current = matchups[index]!;
      if (current.eventName) continue;
      const previous = matchups[index - 1]!.eventName;
      const next = matchups[index + 1]!.eventName;
      if (!previous || !next) continue;
      if (similarEvent(comparableEvent(previous), comparableEvent(next))) {
        current.eventName = previous.length <= next.length ? previous : next;
      }
    }
    return matchups;
  }

  // Fail closed: only pair stacked names when both occur in the same visible text block.
  const blocks = text.split(/\r?\n\s*\r?\n+/);
  for (const block of blocks) {
    const nameLines = block.split(/\r?\n/).map((line) => line.trim()).filter(isNameLike);
    if (nameLines.length !== 2) continue;
    const p1 = cleanName(nameLines[0]!);
    const p2 = cleanName(nameLines[1]!);
    if (p1 && p2 && p1 !== p2) {
      matchups.push({ player1Name: p1, player2Name: p2, eventName: null });
    }
  }

  return matchups;
}
