import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { policyForMetric } from "./metric-source-family-policy";

const COVERAGE_START = "2025-01-01";
const APPROVED_INDEX = join(process.cwd(), "data", "metrics", "pbp", "wta_challenger", "approved-index.jsonl");
const PBP_CODES = new Set(["024", "025", "033", "036", "040", "042", "043", "044", "060", "079"]);

type MetricLike = { code: string; name: string };
type ApprovedRow = {
  tour?: string;
  year?: number;
  match_id?: string | number;
  date?: string;
  tournament?: string;
  player1?: string;
  player2?: string;
  metrics?: {
    set_scores?: Array<[number, number]>;
    match_winner_slot?: "player1" | "player2" | string;
    total_games?: number;
    total_points?: number;
    breaks?: number;
  };
  status?: string;
};

const norm = (value: unknown) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const codeOf = (value: unknown) => { const match = String(value ?? "").match(/(\d{1,3})$/); return match ? match[1].padStart(3, "0") : String(value ?? "").padStart(3, "0"); };

/**
 * WTA 125 production history uses compact display identities such as
 * "Pohankova M." while the approved BSD PBP index carries full names. Resolve
 * that representation only when the approved namespace contains exactly one
 * matching full identity. Ambiguous initials fail closed.
 */
export function resolveUniqueApprovedWtaIdentity(input: string, approvedNames: string[]) {
  const inputNorm = norm(input);
  if (!inputNorm) return null;
  const unique = [...new Map(approvedNames.filter(Boolean).map((name) => [norm(name), name])).values()];
  const exact = unique.filter((name) => norm(name) === inputNorm);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const tokens = inputNorm.split(" ").filter(Boolean);
  if (tokens.length !== 2) return null;
  let surname = "", initial = "";
  if (tokens[1].length === 1) { surname = tokens[0]; initial = tokens[1]; }
  else if (tokens[0].length === 1) { initial = tokens[0]; surname = tokens[1]; }
  else return null;

  const candidates = unique.filter((name) => {
    const parts = norm(name).split(" ").filter(Boolean);
    if (parts.length < 2) return false;
    return parts.at(-1) === surname && parts[0]?.startsWith(initial);
  });
  return candidates.length === 1 ? candidates[0] : null;
}

function explicitWtaChallengerContext(context: string | null | undefined) {
  const text = norm(context);
  if (!text) return false;
  if (["atp", "itf", "futures", "utr", "satellite", "exhibition"].some((marker) => text.includes(marker))) return false;
  return text.includes("wta 125") || text.includes("wta125") || text.includes("125k") || text.includes("wta challenger");
}

async function loadApprovedIndex(): Promise<ApprovedRow[]> {
  try {
    const raw = await readFile(APPROVED_INDEX, "utf8");
    return raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as ApprovedRow).filter((row) => row.status === "APPROVED_WTA_CHALLENGER_PBP" && row.tour === "WTA_CHALLENGER");
  } catch {
    return [];
  }
}

export async function buildBsdWtaChallengerPbpContext(args: {
  metrics: MetricLike[];
  p1: string;
  p2: string;
  asOfDate: string;
  context?: string | null;
}) {
  const status = { eligible: false, reason: "", matches_used: 0, coverage_start: COVERAGE_START, source: "BSD/Bzzoiro WTA Challenger approved PBP index" };
  if (!explicitWtaChallengerContext(args.context)) {
    status.reason = "Fail-closed tour guard: context is not explicitly WTA Challenger/WTA 125.";
    return { packet: {} as Record<string, unknown>, status };
  }
  if (args.asOfDate < COVERAGE_START) {
    status.reason = "Outside confirmed BSD WTA Challenger/WTA 125 PBP coverage boundary (2025-current).";
    return { packet: {} as Record<string, unknown>, status };
  }

  status.eligible = true;
  const approved = await loadApprovedIndex();
  const approvedNames = approved.flatMap((row) => [String(row.player1 ?? ""), String(row.player2 ?? "")]).filter(Boolean);
  const p1Canonical = resolveUniqueApprovedWtaIdentity(args.p1, approvedNames);
  const p2Canonical = resolveUniqueApprovedWtaIdentity(args.p2, approvedNames);
  const targets = [
    p1Canonical ? { requested: args.p1, canonical: p1Canonical } : null,
    p2Canonical ? { requested: args.p2, canonical: p2Canonical } : null,
  ].filter((value): value is { requested: string; canonical: string } => Boolean(value));
  const targetNorms = new Set(targets.map((target) => norm(target.canonical)));

  const rows = approved.filter((row) => {
    const date = String(row.date ?? "").slice(0, 10);
    if (!date || date > args.asOfDate) return false;
    const a = norm(row.player1), b = norm(row.player2);
    return targetNorms.has(a) || targetNorms.has(b);
  }).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? ""))).slice(0, 40);

  const observations: any[] = [];
  const usedMatches = new Set<string>();
  for (const row of rows) {
    const a = String(row.player1 ?? ""), b = String(row.player2 ?? "");
    const an = norm(a), bn = norm(b), metrics = row.metrics ?? {};
    const summary = {
      totalPoints: Number.isFinite(Number(metrics.total_points)) ? Number(metrics.total_points) : null,
      gamesObserved: Number.isFinite(Number(metrics.total_games)) ? Number(metrics.total_games) : null,
      breaksWon: Number.isFinite(Number(metrics.breaks)) ? Number(metrics.breaks) : null,
      setScores: metrics.set_scores ?? null,
      matchWinnerSlot: metrics.match_winner_slot ?? null,
    };
    for (const target of targets) {
      const tn = norm(target.canonical);
      if (tn !== an && tn !== bn) continue;
      const opponent = tn === an ? b : a;
      observations.push({
        family: "POINT_BY_POINT",
        source: "BSD/Bzzoiro WTA Challenger approved PBP index",
        url: null,
        player: target.requested,
        opponent,
        player1: a,
        player2: b,
        tournament: row.tournament ?? null,
        event_date: String(row.date ?? "").slice(0, 10),
        key: "bsd_wta_challenger_approved_pbp_summary",
        value: summary,
        sample: `${summary.totalPoints ?? "NA"} points; ${summary.gamesObserved ?? "NA"} games; ${summary.breaksWon ?? "NA"} breaks`,
        provenance: {
          tour: "WTA_CHALLENGER",
          approved_only: true,
          structural_validation: true,
          match_identity_validation: true,
          unique_abbreviated_identity_resolution: norm(target.requested) !== norm(target.canonical),
          canonical_player: target.canonical,
          duplicate_protection: true,
          rejected_records_reintroduced: false,
        },
      });
      usedMatches.add(String(row.match_id ?? `${row.date}|${an}|${bn}`));
    }
  }
  status.matches_used = usedMatches.size;

  const packet: Record<string, unknown> = {};
  for (const metric of args.metrics) {
    const code = codeOf(metric.code);
    if (!PBP_CODES.has(code) || !observations.length) continue;
    const policy = policyForMetric(code);
    if (!policy.allowed_families.includes("POINT_BY_POINT")) continue;
    packet[code] = {
      metric_name: metric.name,
      allowed_families: policy.allowed_families,
      sufficient_families: policy.sufficient_families,
      support_only_families: policy.support_only_families ?? [],
      observed_families: ["POINT_BY_POINT"],
      direct_satisfaction_allowed: policy.sufficient_families.includes("POINT_BY_POINT"),
      observations: observations.slice(0, 80),
      tour_guard: "STRICT_WTA_CHALLENGER_WTA125_ONLY",
    };
  }

  if (!targets.length) status.reason = "No approved WTA Challenger identity matched these players; ambiguous abbreviated identities fail closed.";
  else status.reason = observations.length ? "Approved WTA Challenger/WTA 125 PBP summaries attached to eligible metric codes." : "No approved WTA Challenger/WTA 125 PBP observations matched these players.";
  return { packet, status };
}
