import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type EvidenceIndexSample = {
  id: "ATP_MAIN" | "WTA_MAIN" | "ATP_CHALLENGER" | "WTA_CHALLENGER";
  match_id: string;
  p1: string;
  p2: string;
  date: string;
  tournament: string;
  surface: string | null;
  sampling_source: "verified_pbp_index" | "wta125_production_history";
};

type IndexRow = {
  match_id?: string | number | null;
  date?: string | null;
  players?: [string | null, string | null] | string[];
  tournament?: string | null;
  circuit?: string | null;
  category?: string | null;
  surface?: string | null;
  structurally_present?: boolean;
};

const norm = (v: unknown) => String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function validPlayers(row: IndexRow) {
  return Array.isArray(row.players) && row.players.length >= 2 && Boolean(String(row.players[0] ?? "").trim()) && Boolean(String(row.players[1] ?? "").trim()) && norm(row.players[0]) !== norm(row.players[1]);
}

function strictClass(row: IndexRow, id: EvidenceIndexSample["id"]) {
  if (row.structurally_present !== true || !row.date || !row.match_id || !validPlayers(row)) return false;
  const circuit = String(row.circuit ?? "").trim().toUpperCase();
  const blob = norm(`${row.category ?? ""} ${row.tournament ?? ""}`);
  if (id === "ATP_MAIN") {
    return circuit === "ATP" && !["challenger", "wta", "wta 125", "wta125", "itf", "futures", "utr", "satellite", "exhibition"].some(x => blob.includes(x));
  }
  if (id === "WTA_MAIN") {
    return circuit === "WTA" && !["challenger", "wta 125", "wta125", "125k", "atp", "itf", "futures", "utr", "satellite", "exhibition"].some(x => blob.includes(x));
  }
  return circuit === "ATP" && blob.includes("challenger") && !["wta", "itf", "futures", "utr", "satellite", "exhibition"].some(x => blob.includes(x));
}

async function load(path: string): Promise<IndexRow[]> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const SPECS: Partial<Record<EvidenceIndexSample["id"], { dir: string; years: number[]; floor: string }>> = {
  ATP_MAIN: { dir: "bsd-atp-main-pbp-history", years: [2026, 2025, 2024], floor: "2024-01-01" },
  WTA_MAIN: { dir: "bsd-wta-main-pbp-history", years: [2026, 2025, 2024], floor: "2024-12-02" },
  ATP_CHALLENGER: { dir: "bsd-atp-challenger-pbp-history", years: [2026, 2025], floor: "2025-01-01" },
};

// Deployment-safe representative rows generated from the checked-in verified PBP indexes.
// These are diagnostic sampling identities only; they never attach PBP or create evidence.
// Runtime filesystem access remains preferred so a newer checked-in verified row wins when available.
export const BUNDLED_VERIFIED_EVIDENCE_INDEX_SAMPLES: Record<EvidenceIndexSample["id"], EvidenceIndexSample> = {
  ATP_MAIN: { id: "ATP_MAIN", match_id: "verified-index:ATP_MAIN:43148", p1: "Alejandro Tabilo", p2: "Tiago Torres", date: "2026-07-22", tournament: "Estoril", surface: "clay", sampling_source: "verified_pbp_index" },
  WTA_MAIN: { id: "WTA_MAIN", match_id: "verified-index:WTA_MAIN:43309", p1: "Fiona Ferro", p2: "Erika Andreeva", date: "2026-07-22", tournament: "Palermo, Italy", surface: "clay", sampling_source: "verified_pbp_index" },
  ATP_CHALLENGER: { id: "ATP_CHALLENGER", match_id: "verified-index:ATP_CHALLENGER:31912", p1: "Leandro Riedi", p2: "Yunchaokete Bu", date: "2026-04-19", tournament: "Busan, South Korea", surface: "hard", sampling_source: "verified_pbp_index" },
  WTA_CHALLENGER: { id: "WTA_CHALLENGER", match_id: "wta125-history:e9fa13bb3987336d7687b58a", p1: "Pohankova M.", p2: "Volynets K.", date: "2026-08-26", tournament: "Philadelphia Chall. Women", surface: "hard" || null, sampling_source: "wta125_production_history" },
};

export async function sampleVerifiedEvidenceIndexMatch(id: EvidenceIndexSample["id"]): Promise<EvidenceIndexSample | null> {
  const spec = SPECS[id];
  if (spec) for (const year of spec.years) {
    const rows = await load(join(process.cwd(), "data", "audit", spec.dir, String(year), "results.json"));
    const row = rows
      .filter(r => strictClass(r, id) && String(r.date).slice(0, 10) >= spec.floor)
      .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))[0];
    if (!row) continue;
    return {
      id,
      match_id: `verified-index:${id}:${String(row.match_id)}`,
      p1: String(row.players![0]),
      p2: String(row.players![1]),
      date: String(row.date).slice(0, 10),
      tournament: String(row.tournament ?? `${id} verified PBP index match`),
      surface: row.surface ? String(row.surface) : null,
      sampling_source: "verified_pbp_index",
    };
  }
  return BUNDLED_VERIFIED_EVIDENCE_INDEX_SAMPLES[id] ?? null;
}
