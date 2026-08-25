import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  isSurnameOnlyEvidenceIdentity,
  normalizeEvidenceIdentity,
  uniqueCanonicalWarehouseIdentity,
} from "./evidence-player-alias";

const db = supabaseAdmin as any;
const PAGE_SIZE = 1000;
const MAX_PAGES_PER_LANE = 20;

type IdentityStatus = "ALREADY_CANONICAL" | "RESOLVED" | "UNRESOLVED" | "AMBIGUOUS" | "QUERY_FAILED";

export type CanonicalEvidenceIdentity = {
  input: string;
  canonical: string;
  status: IdentityStatus;
  candidates: string[];
  query_errors: string[];
};

type LaneResult = { names: string[]; errors: string[]; truncated: boolean };

function candidateNames(rows: any[], fields: string[]) {
  const out: string[] = [];
  for (const row of rows) for (const field of fields) {
    const value = String(row?.[field] ?? "").trim();
    if (value) out.push(value);
  }
  return out;
}

function exactCanonicalCandidates(uploaded: string, names: string[]) {
  const candidates = new Map<string, string>();
  for (const value of names) {
    const canonical = uniqueCanonicalWarehouseIdentity(uploaded, [value]);
    if (!canonical) continue;
    candidates.set(normalizeEvidenceIdentity(canonical), canonical);
  }
  return candidates;
}

async function pagedLane(
  input: string,
  fields: string[],
  makeQuery: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>,
): Promise<LaneResult> {
  const names: string[] = [];
  for (let page = 0; page < MAX_PAGES_PER_LANE; page++) {
    const from = page * PAGE_SIZE;
    let result: { data: any[] | null; error: { message: string } | null };
    try { result = await makeQuery(from, from + PAGE_SIZE - 1); }
    catch (error) { return { names, errors: [error instanceof Error ? error.message : String(error)], truncated: false }; }
    if (result.error) return { names, errors: [result.error.message], truncated: false };
    const rows = result.data ?? [];
    names.push(...candidateNames(rows, fields));

    if (exactCanonicalCandidates(input, names).size > 1) return { names, errors: [], truncated: false };
    if (rows.length < PAGE_SIZE) return { names, errors: [], truncated: false };
  }
  return { names, errors: [], truncated: true };
}

async function queryCandidates(input: string) {
  const token = normalizeEvidenceIdentity(input);
  if (!token || !/^[a-z0-9]+$/.test(token)) return { names: [] as string[], errors: ["Identity token is not query-safe."], truncated: false };
  const pattern = `%${token}%`;

  // Warehouse evidence is the only canonical proof. Never let an uploaded app
  // row manufacture identity certainty that the evidence warehouse cannot prove.
  const lanes = await Promise.all([
    pagedLane(input, ["player_name"], (from, to) => db.from("source_observations")
      .select("id,player_name")
      .not("observation_type", "in", "(POINT_BY_POINT,PBP,MARKET)")
      .ilike("player_name", pattern).order("id", { ascending: true }).range(from, to)),
    pagedLane(input, ["opponent_name"], (from, to) => db.from("source_observations")
      .select("id,opponent_name")
      .not("observation_type", "in", "(POINT_BY_POINT,PBP,MARKET)")
      .ilike("opponent_name", pattern).order("id", { ascending: true }).range(from, to)),
    pagedLane(input, ["player_name"], (from, to) => db.from("metric_evidence_store")
      .select("id,player_name").ilike("player_name", pattern).order("id", { ascending: true }).range(from, to)),
    pagedLane(input, ["opponent_name"], (from, to) => db.from("metric_evidence_store")
      .select("id,opponent_name").ilike("opponent_name", pattern).order("id", { ascending: true }).range(from, to)),
  ]);

  return {
    names: lanes.flatMap((lane) => lane.names),
    errors: lanes.flatMap((lane) => lane.errors),
    truncated: lanes.some((lane) => lane.truncated),
  };
}

export async function resolveCanonicalEvidenceIdentity(input: string): Promise<CanonicalEvidenceIdentity> {
  if (!isSurnameOnlyEvidenceIdentity(input)) {
    return { input, canonical: input, status: "ALREADY_CANONICAL", candidates: [input], query_errors: [] };
  }

  const lookup = await queryCandidates(input);
  const normalizedCandidates = exactCanonicalCandidates(input, lookup.names);
  const candidates = [...normalizedCandidates.values()].sort();

  if (lookup.errors.length || lookup.truncated) {
    return { input, canonical: input, status: "QUERY_FAILED", candidates, query_errors: [...lookup.errors, ...(lookup.truncated ? ["Canonical warehouse identity lookup exceeded its bounded pagination window."] : [])] };
  }
  const canonical = uniqueCanonicalWarehouseIdentity(input, candidates);
  if (canonical) return { input, canonical, status: "RESOLVED", candidates, query_errors: [] };
  return { input, canonical: input, status: candidates.length > 1 ? "AMBIGUOUS" : "UNRESOLVED", candidates, query_errors: [] };
}

export async function resolveCanonicalEvidencePair(p1: string, p2: string) {
  const [left, right] = await Promise.all([resolveCanonicalEvidenceIdentity(p1), resolveCanonicalEvidenceIdentity(p2)]);
  if (normalizeEvidenceIdentity(left.canonical) === normalizeEvidenceIdentity(right.canonical)) {
    return {
      p1: { ...left, canonical: p1, status: left.status === "ALREADY_CANONICAL" ? left.status : "AMBIGUOUS" as IdentityStatus },
      p2: { ...right, canonical: p2, status: right.status === "ALREADY_CANONICAL" ? right.status : "AMBIGUOUS" as IdentityStatus },
    };
  }
  return { p1: left, p2: right };
}
