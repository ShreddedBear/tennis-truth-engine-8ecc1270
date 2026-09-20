#!/usr/bin/env bun
// Integrate the verified Sackmann-local historical gap (ATP Main 2012-2023, WTA Main
// 2013-2020) into the existing production-history canonical path, following the exact
// pattern already established by scripts/integrate-wta125-history-production.py:
//   raw source -> canonicalization/validation -> committed production-history CSV + manifest
//   -> consumed by scripts/build-runtime-tennis-index.mjs.
//
// This does NOT invent a new data path. It writes into
// data/public/production-history/{atp_main_sackmann,wta_main_sackmann}/, alongside the
// existing data/public/production-history/wta_challenger/ directory that already feeds the
// runtime index the same way.
//
// Runs the canonicalization pipeline (src/lib/historical-source-canonicalization.ts, UNCHANGED)
// against the CORRECT baseline: all four existing runtime lanes (ATP_MAIN, WTA_MAIN,
// ATP_CHALLENGER, WTA_CHALLENGER), not just the two-lane baseline used for the initial 40,988
// estimate in Step 2 -- Step 3D's own audit found that a two-lane baseline misses a real
// cross-lane collision (Popyrin/Musetti vs. a TennisMyLife Challenger record), so this script
// uses the complete population to avoid inserting that same class of record.
//
// Sequential, mutating registry.process() -- matching Step 2's methodology exactly -- so
// Sackmann's own internal duplicate rows (the Davis Cup double-tourney_id pattern found in
// Step 3C) are also correctly caught and never double-inserted.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CanonicalMatchRegistry, type CandidateHistoricalMatch, type MatchResolution } from "../src/lib/historical-source-canonicalization";

const ROOT = process.cwd();

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some(Boolean)) rows.push(row); row = []; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? "").trim()])));
}
function csvCell(v: string | null | undefined): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function winnerCodeBool(code: string): boolean | null {
  const n = Number(String(code ?? "").trim());
  if (Number.isFinite(n)) { if (n === 1) return true; if (n === 2) return false; }
  return null;
}
function sackmannDateToIso(raw: string): string | null {
  if (!raw || raw.length < 8) return null;
  const y = raw.slice(0, 4), m = raw.slice(4, 6), d = raw.slice(6, 8);
  const c = `${y}-${m}-${d}`;
  return Number.isNaN(Date.parse(c)) ? null : c;
}

// ---- existing runtime baseline, loaded exactly as build-runtime-tennis-index.mjs does ----
function loadAtpMainBaseline(): CandidateHistoricalMatch[] {
  const rows = parseCsv(readFileSync(join(ROOT, "data/public/predixsport/atp/atp_elo_matches.csv"), "utf8"));
  const out: CandidateHistoricalMatch[] = [];
  for (const row of rows) {
    if (!row.player || !row.opponent || !row.date) continue;
    const won = row.won === "1" ? true : row.won === "0" ? false : null;
    if (won === null) continue;
    out.push({ sourceId: "predixsport-atp", sourceRef: `${row.date}|${row.tournament}|${row.player}|${row.opponent}`,
      player1Name: row.player, player2Name: row.opponent, winnerName: won ? row.player : row.opponent,
      tournament: row.tournament, date: row.date, round: null, tour: "ATP", eventLevel: row.tournament_type ?? null, score: null });
  }
  return out;
}
function loadWtaMainBaseline(): CandidateHistoricalMatch[] {
  const dir = join(ROOT, "data/public/tennisdata-wta-main"); const out: CandidateHistoricalMatch[] = [];
  for (const file of readdirSync(dir).filter((f) => /^\d{4}wtaseason\.csv$/.test(f)).sort()) {
    const rows = parseCsv(readFileSync(join(dir, file), "utf8"));
    for (const row of rows) {
      if (row.tour_type_human !== "WTA Tour" || row.status !== "FINISHED") continue;
      const homeWon = winnerCodeBool(row.winner_code); if (homeWon === null) continue;
      const ts = Number(row.date_timestamp);
      const date = Number.isFinite(ts) ? new Date(ts * 1000).toISOString().slice(0, 10) : "";
      if (!row.home_name || !row.away_name || !date) continue;
      out.push({ sourceId: "tennisdata-wta-main", sourceRef: row.match_id, player1Name: row.home_name, player2Name: row.away_name,
        winnerName: homeWon ? row.home_name : row.away_name, tournament: row.tournament, date, round: row.round, tour: "WTA",
        eventLevel: "WTA Tour", score: null });
    }
  }
  return out;
}
function loadAtpChallengerBaseline(): CandidateHistoricalMatch[] {
  const dir = join(ROOT, "data/public/tennismylife-challenger/normalized");
  const currentYear = new Date().getUTCFullYear();
  const out: CandidateHistoricalMatch[] = [];
  for (const file of readdirSync(dir).filter((f) => /^\d{4}_challenger_normalized\.csv$/.test(f)).sort()) {
    const year = Number(file.slice(0, 4));
    if (year < currentYear - 5) continue; // identical filter to build-runtime-tennis-index.mjs
    const rows = parseCsv(readFileSync(join(dir, file), "utf8"));
    for (const row of rows) {
      if (row._dedup_status && row._dedup_status !== "NEW_MATCH") continue;
      if (!row.winner_name || !row.loser_name || !row.tourney_date) continue;
      const date = sackmannDateToIso(row.tourney_date);
      if (!date) continue;
      out.push({ sourceId: "tennismylife-atp-challenger", sourceRef: `${row.tourney_id}-${row.match_num}`,
        player1Name: row.winner_name, player2Name: row.loser_name, winnerName: row.winner_name,
        tournament: row.tourney_name, date, round: row.round || null, tour: "ATP", eventLevel: "ATP Challenger", score: row.score || null });
    }
  }
  return out;
}
function loadWtaChallengerBaseline(): CandidateHistoricalMatch[] {
  const rows = parseCsv(readFileSync(join(ROOT, "data/public/production-history/wta_challenger/matches_2021_2026.csv"), "utf8"));
  const out: CandidateHistoricalMatch[] = [];
  for (const row of rows) {
    if (!row.home_player || !row.away_player || !row.date) continue;
    const homeWon = winnerCodeBool(row.winner_code); if (homeWon === null) continue;
    out.push({ sourceId: "wta125-production-history", sourceRef: row.match_key, player1Name: row.home_player, player2Name: row.away_player,
      winnerName: homeWon ? row.home_player : row.away_player, tournament: row.tournament, date: row.date, round: row.round, tour: "WTA",
      eventLevel: "WTA 125", score: null });
  }
  return out;
}

// ---- Sackmann candidates ----
type SackmannCandidate = CandidateHistoricalMatch & {
  year: number; tourneyId: string; matchNum: string; tourneyLevel: string; surface: string; bestOf: string;
};
function loadSackmannAtpYear(year: number): SackmannCandidate[] {
  const rows = parseCsv(readFileSync(join(ROOT, `data/public/sackmann-local-atp-main/raw/${year}.csv`), "utf8"));
  const out: SackmannCandidate[] = [];
  for (const row of rows) {
    const date = sackmannDateToIso(row.tourney_date);
    if (!date || !row.winner_name || !row.loser_name) continue;
    out.push({ sourceId: "sackmann-local-atp-main", sourceRef: `${row.tourney_id}-${row.match_num}`,
      player1Name: row.winner_name, player2Name: row.loser_name, winnerName: row.winner_name,
      tournament: row.tourney_name, date, round: row.round || null, tour: "ATP", eventLevel: row.tourney_level || null,
      score: row.score || null, year, tourneyId: row.tourney_id, matchNum: row.match_num, tourneyLevel: row.tourney_level ?? "",
      surface: row.surface ?? "", bestOf: row.best_of ?? "" });
  }
  return out;
}
function loadSackmannWtaYear(year: number): SackmannCandidate[] {
  const rows = parseCsv(readFileSync(join(ROOT, `data/public/sackmann-local-wta-main/raw/${year}_wta.csv`), "utf8"));
  const out: SackmannCandidate[] = [];
  for (const row of rows) {
    const date = sackmannDateToIso(row.tourney_date);
    if (!date || !row.winner_name || !row.loser_name) continue;
    out.push({ sourceId: "sackmann-local-wta-main", sourceRef: `${row.tourney_id}-${row.match_num}`,
      player1Name: row.winner_name, player2Name: row.loser_name, winnerName: row.winner_name,
      tournament: row.tourney_name, date, round: row.round || null, tour: "WTA", eventLevel: row.tourney_level || null,
      score: row.score || null, year, tourneyId: row.tourney_id, matchNum: row.match_num, tourneyLevel: row.tourney_level ?? "",
      surface: row.surface ?? "", bestOf: row.best_of ?? "" });
  }
  return out;
}

const ATP_YEARS = [2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023];
const WTA_YEARS = [2013,2014,2015,2016,2017,2018,2019,2020];

function buildFullBaselineRegistry(): CanonicalMatchRegistry {
  const registry = new CanonicalMatchRegistry();
  for (const c of loadAtpMainBaseline()) registry.process(c);
  for (const c of loadWtaMainBaseline()) registry.process(c);
  for (const c of loadAtpChallengerBaseline()) registry.process(c);
  for (const c of loadWtaChallengerBaseline()) registry.process(c);
  return registry;
}

type Row = { candidate: SackmannCandidate; resolution: MatchResolution };

function classifyAll(): { atp: Row[]; wta: Row[]; registry: CanonicalMatchRegistry } {
  const registry = buildFullBaselineRegistry();
  const atp: Row[] = [];
  for (const year of ATP_YEARS) for (const c of loadSackmannAtpYear(year)) atp.push({ candidate: c, resolution: registry.process(c) });
  const wta: Row[] = [];
  for (const year of WTA_YEARS) for (const c of loadSackmannWtaYear(year)) wta.push({ candidate: c, resolution: registry.process(c) });
  return { atp, wta, registry };
}

const PROD_HEADER = ["date","tournament","surface","round","winner_name","loser_name","score","best_of","sackmann_source_ref","sackmann_tourney_id","sackmann_match_num","sackmann_tourney_level","provider"];
function toProdRow(r: Row): string {
  const c = r.candidate;
  return [c.date, c.tournament, c.surface, c.round ?? "", c.player1Name, c.player2Name, c.score ?? "", c.bestOf,
    c.sourceRef, c.tourneyId, c.matchNum, c.tourneyLevel, "sackmann-local"].map(csvCell).join(",");
}

function run() {
  const { atp, wta } = classifyAll();

  const counts = (rows: Row[]) => {
    const c = { NEW: 0, DUPLICATE: 0, CONFLICT: 0, AMBIGUOUS: 0 };
    for (const r of rows) c[r.resolution.status]++;
    return c;
  };
  const atpCounts = counts(atp), wtaCounts = counts(wta);

  const byYear = (rows: Row[], years: number[]) => {
    const out: Record<number, { NEW: number; DUPLICATE: number; CONFLICT: number; AMBIGUOUS: number }> = {};
    for (const y of years) out[y] = { NEW: 0, DUPLICATE: 0, CONFLICT: 0, AMBIGUOUS: 0 };
    for (const r of rows) out[r.candidate.year][r.resolution.status]++;
    return out;
  };
  const atpByYear = byYear(atp, ATP_YEARS), wtaByYear = byYear(wta, WTA_YEARS);

  // ---- Contamination firewall: every accepted row must genuinely be main-tour level ----
  const CHALLENGER_ITF_CODES = new Set(["C", "S", "15", "25"]);
  const atpNewRows = atp.filter((r) => r.resolution.status === "NEW");
  const wtaNewRows = wta.filter((r) => r.resolution.status === "NEW");
  const contaminated = [...atpNewRows, ...wtaNewRows].filter((r) => CHALLENGER_ITF_CODES.has(r.candidate.tourneyLevel));
  if (contaminated.length) {
    throw new Error(`CONTAMINATION_FIREWALL_BLOCKED: ${contaminated.length} accepted rows carry a Challenger/ITF tourney_level code`);
  }

  // ---- Write production-history outputs (NEW only) ----
  const atpDir = join(ROOT, "data/public/production-history/atp_main_sackmann");
  const wtaDir = join(ROOT, "data/public/production-history/wta_main_sackmann");
  mkdirSync(atpDir, { recursive: true }); mkdirSync(wtaDir, { recursive: true });

  const atpSorted = [...atpNewRows].sort((a, b) => a.candidate.date === b.candidate.date ? a.candidate.sourceRef.localeCompare(b.candidate.sourceRef) : a.candidate.date.localeCompare(b.candidate.date));
  const wtaSorted = [...wtaNewRows].sort((a, b) => a.candidate.date === b.candidate.date ? a.candidate.sourceRef.localeCompare(b.candidate.sourceRef) : a.candidate.date.localeCompare(b.candidate.date));

  writeFileSync(join(atpDir, "matches_2012_2023.csv"), [PROD_HEADER.join(","), ...atpSorted.map(toProdRow)].join("\n") + "\n");
  writeFileSync(join(wtaDir, "matches_2013_2020.csv"), [PROD_HEADER.join(","), ...wtaSorted.map(toProdRow)].join("\n") + "\n");

  const nowIso = new Date().toISOString();
  const atpManifest = {
    state: "SUCCESS", scope: "ATP MAIN ONLY (Sackmann-local supplement, 2012-2023)",
    source: "data/public/sackmann-local-atp-main/raw/*.csv",
    output: "data/public/production-history/atp_main_sackmann/matches_2012_2023.csv",
    license: "CC BY-NC-SA 4.0 -- see data/public/sackmann-local-atp-main/SOURCE.md and NON_COMMERCIAL_USE_CLASSIFICATION.md",
    canonicalization_baseline: "Full 4-lane runtime population (ATP_MAIN, WTA_MAIN, ATP_CHALLENGER, WTA_CHALLENGER) via src/lib/historical-source-canonicalization.ts, unmodified",
    years: Object.fromEntries(ATP_YEARS.map((y) => [y, atpByYear[y].NEW])),
    rows_source_total: atp.length,
    rows_integrated_new: atpNewRows.length,
    rows_duplicate: atpCounts.DUPLICATE,
    rows_ambiguous_quarantined: atpCounts.AMBIGUOUS,
    rows_conflict: atpCounts.CONFLICT,
    contamination_firewall: "PASS",
    production_tour_family: "ATP_MAIN",
    generated_at_utc: nowIso,
  };
  const wtaManifest = {
    state: "SUCCESS", scope: "WTA MAIN ONLY (Sackmann-local supplement, 2013-2020)",
    source: "data/public/sackmann-local-wta-main/raw/*.csv",
    output: "data/public/production-history/wta_main_sackmann/matches_2013_2020.csv",
    license: "CC BY-NC-SA 4.0 -- see data/public/sackmann-local-wta-main/SOURCE.md and NON_COMMERCIAL_USE_CLASSIFICATION.md",
    canonicalization_baseline: "Full 4-lane runtime population (ATP_MAIN, WTA_MAIN, ATP_CHALLENGER, WTA_CHALLENGER) via src/lib/historical-source-canonicalization.ts, unmodified",
    years: Object.fromEntries(WTA_YEARS.map((y) => [y, wtaByYear[y].NEW])),
    rows_source_total: wta.length,
    rows_integrated_new: wtaNewRows.length,
    rows_duplicate: wtaCounts.DUPLICATE,
    rows_ambiguous_quarantined: wtaCounts.AMBIGUOUS,
    rows_conflict: wtaCounts.CONFLICT,
    contamination_firewall: "PASS",
    production_tour_family: "WTA_MAIN",
    generated_at_utc: nowIso,
  };
  writeFileSync(join(atpDir, "INTEGRATION_MANIFEST.json"), JSON.stringify(atpManifest, null, 2) + "\n");
  writeFileSync(join(wtaDir, "INTEGRATION_MANIFEST.json"), JSON.stringify(wtaManifest, null, 2) + "\n");

  // ---- Quarantine (AMBIGUOUS + CONFLICT), auditable, provenance-preserving ----
  const quarantineDir = join(ROOT, "data/audit/sackmann-local-history-quarantine");
  mkdirSync(quarantineDir, { recursive: true });
  const quarantineLine = (r: Row) => JSON.stringify({
    tour: r.candidate.tour, year: r.candidate.year, status: r.resolution.status,
    reason: (r.resolution as any).reason ?? null,
    winner: r.candidate.winnerName, loser: r.candidate.player1Name === r.candidate.winnerName ? r.candidate.player2Name : r.candidate.player1Name,
    date: r.candidate.date, tournament: r.candidate.tournament, round: r.candidate.round, score: r.candidate.score,
    sackmann_source_ref: r.candidate.sourceRef, sackmann_tourney_id: r.candidate.tourneyId, sackmann_match_num: r.candidate.matchNum,
    colliding_canonical_key: (r.resolution as any).canonical?.identity?.key ?? null,
    colliding_source: (r.resolution as any).canonical?.primarySource ?? null,
    detail: (r.resolution as any).detail ?? null,
  });
  const atpQuarantine = atp.filter((r) => r.resolution.status === "AMBIGUOUS" || r.resolution.status === "CONFLICT");
  const wtaQuarantine = wta.filter((r) => r.resolution.status === "AMBIGUOUS" || r.resolution.status === "CONFLICT");
  writeFileSync(join(quarantineDir, "atp_main.jsonl"), atpQuarantine.map(quarantineLine).join("\n") + (atpQuarantine.length ? "\n" : ""));
  writeFileSync(join(quarantineDir, "wta_main.jsonl"), wtaQuarantine.map(quarantineLine).join("\n") + (wtaQuarantine.length ? "\n" : ""));
  writeFileSync(join(quarantineDir, "summary.md"), [
    "# Sackmann-local ATP/WTA Main history -- quarantine (Step 4 integration)",
    "",
    "Records classified AMBIGUOUS or CONFLICT against the full 4-lane runtime population by",
    "`src/lib/historical-source-canonicalization.ts` (unmodified). Never inserted into the",
    "runtime index. Preserved here with full provenance for future review -- see",
    "`atp_main.jsonl` / `wta_main.jsonl` for the individual records and their exact collision",
    "reason and colliding canonical entry.",
    "",
    `- ATP: ${atpCounts.AMBIGUOUS} ambiguous, ${atpCounts.CONFLICT} conflict, out of ${atp.length} source rows`,
    `- WTA: ${wtaCounts.AMBIGUOUS} ambiguous, ${wtaCounts.CONFLICT} conflict, out of ${wta.length} source rows`,
    `- Generated: ${nowIso}`,
    "",
  ].join("\n"));

  console.log(JSON.stringify({
    atpCounts, wtaCounts, atpByYear, wtaByYear,
    atpTotalSource: atp.length, wtaTotalSource: wta.length,
    atpNewWritten: atpSorted.length, wtaNewWritten: wtaSorted.length,
  }, null, 2));
}

run();
