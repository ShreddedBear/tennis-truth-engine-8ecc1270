import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  isSurnameOnlyEvidenceIdentity,
  normalizeEvidenceIdentity,
  uniqueCanonicalWarehouseIdentity,
} from "./evidence-player-alias";

const db = supabaseAdmin as any;
const LOOKUP_LIMIT = 1000;

type IdentityStatus = "ALREADY_CANONICAL" | "RESOLVED" | "UNRESOLVED" | "AMBIGUOUS" | "QUERY_FAILED";

export type CanonicalEvidenceIdentity = {
  input: string;
  canonical: string;
  status: IdentityStatus;
  candidates: string[];
  query_errors: string[];
};

function candidateNames(rows: any[], fields: string[]) {
  const out: string[] = [];
  for (const row of rows) for (const field of fields) {
    const value = String(row?.[field] ?? "").trim();
    if (value) out.push(value);
  }
  return out;
}

async function queryCandidates(input: string) {
  const token = normalizeEvidenceIdentity(input);
  if (!token || !/^[a-z0-9]+$/.test(token)) return { names: [] as string[], errors: ["Identity token is not query-safe."], truncated: false };
  const pattern = `%${token}%`;
  const sourceBase = () => db.from("source_observations")
    .select("player_name,opponent_name")
    .not("observation_type", "in", "(POINT_BY_POINT,PBP,MARKET)")
    .limit(LOOKUP_LIMIT);

  const results = await Promise.allSettled([
    sourceBase().ilike("player_name", pattern),
    sourceBase().ilike("opponent_name", pattern),
    db.from("metric_evidence_store").select("player_name,opponent_name").ilike("player_name", pattern).limit(LOOKUP_LIMIT),
    db.from("metric_evidence_store").select("player_name,opponent_name").ilike("opponent_name", pattern).limit(LOOKUP_LIMIT),
    db.from("matches").select("player1_name,player2_name").ilike("player1_name", pattern).limit(LOOKUP_LIMIT),
    db.from("matches").select("player1_name,player2_name").ilike("player2_name", pattern).limit(LOOKUP_LIMIT),
  ]);

  const names: string[] = [];
  const errors: string[] = [];
  let truncated = false;
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") { errors.push(String(result.reason)); continue; }
    if (result.value.error) { errors.push(result.value.error.message); continue; }
    const rows = result.value.data ?? [];
    if (rows.length >= LOOKUP_LIMIT) truncated = true;
    names.push(...candidateNames(rows, index < 4 ? ["player_name", "opponent_name"] : ["player1_name", "player2_name"]));
  }
  return { names, errors, truncated };
}

export async function resolveCanonicalEvidenceIdentity(input: string): Promise<CanonicalEvidenceIdentity> {
  if (!isSurnameOnlyEvidenceIdentity(input)) {
    return { input, canonical: input, status: "ALREADY_CANONICAL", candidates: [input], query_errors: [] };
  }

  const lookup = await queryCandidates(input);
  const normalizedCandidates = new Map<string, string>();
  for (const value of lookup.names) {
    const canonical = uniqueCanonicalWarehouseIdentity(input, [value]);
    if (!canonical) continue;
    normalizedCandidates.set(normalizeEvidenceIdentity(canonical), canonical);
  }
  const candidates = [...normalizedCandidates.values()].sort();

  // Any incomplete/erroring candidate lane means uniqueness was not proven.
  if (lookup.errors.length || lookup.truncated) {
    return { input, canonical: input, status: "QUERY_FAILED", candidates, query_errors: [...lookup.errors, ...(lookup.truncated ? ["Canonical identity candidate lookup reached its safety limit."] : [])] };
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
