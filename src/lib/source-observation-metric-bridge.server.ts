import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { safeEvidenceAliases } from "./evidence-player-alias";
import { metricAllowsObservation, observationFamily, policyForMetric } from "./metric-source-family-policy";
import { classifyEvidenceTourFamily } from "./evidence-match-identity";
import { buildBsdAtpMainPbpContext } from "./bsd-atp-main-pbp.server";
import { buildBsdWtaMainPbpContext } from "./bsd-wta-main-pbp.server";
import { buildBsdAtpChallengerPbpContext } from "./bsd-atp-challenger-pbp.server";
import { buildBsdWtaChallengerPbpContext } from "./bsd-wta-challenger-pbp.server";

const db = supabaseAdmin as any;

type MetricLike = { code: string; name: string };
type ObservationRow = {
  source_id: string | null;
  source_name: string | null;
  source_url: string | null;
  player_name: string | null;
  opponent_name: string | null;
  tournament: string | null;
  event_date: string | null;
  surface: string | null;
  observation_type: string | null;
  observation_key: string | null;
  text_value: string | null;
  numeric_value: number | null;
  sample_label: string | null;
  window_start: string | null;
  window_end: string | null;
};

function codeOf(value: unknown) {
  const match = String(value ?? "").match(/(\d{1,3})$/);
  return match ? match[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function unique<T>(values: T[]) { return [...new Set(values)]; }
function compactObservation(row: ObservationRow) {
  return { family: observationFamily(row), source: row.source_name ?? row.source_id, url: row.source_url, player: row.player_name, opponent: row.opponent_name, tournament: row.tournament, event_date: row.event_date, surface: row.surface, key: row.observation_key, value: row.text_value ?? row.numeric_value, sample: row.sample_label, window_start: row.window_start, window_end: row.window_end };
}

async function loadCandidateRows(player: string, opponent: string, asOfDate: string) {
  const start = new Date(`${asOfDate}T00:00:00Z`);
  start.setUTCFullYear(start.getUTCFullYear() - 5);
  const aliases = unique([...safeEvidenceAliases(player, opponent), ...safeEvidenceAliases(opponent, player)]);
  const select = "source_id,source_name,source_url,player_name,opponent_name,tournament,event_date,surface,observation_type,observation_key,text_value,numeric_value,sample_label,window_start,window_end";
  const datedBase = () => db.from("source_observations").select(select)
    .gte("event_date", start.toISOString().slice(0, 10)).lte("event_date", asOfDate)
    .order("event_date", { ascending: false });
  const nullDateBase = () => db.from("source_observations").select(select).is("event_date", null);

  // PBP is intentionally excluded from the generic warehouse lane. Evidence Coverage
  // receives PBP only through the tour-scoped BSD bridges below, so quarantined or
  // ambiguous records cannot become evidence merely because they exist in a table.
  const [otherResult, marketResult, sharedResult, nullDatePlayerResult, nullDateSharedResult] = await Promise.all([
    datedBase().in("player_name", aliases).not("observation_type", "in", "(POINT_BY_POINT,PBP,MARKET)").limit(1000),
    datedBase().in("player_name", aliases).eq("observation_type", "MARKET").limit(1000),
    datedBase().is("player_name", null).not("observation_type", "in", "(POINT_BY_POINT,PBP)").limit(1000),
    nullDateBase().in("player_name", aliases).not("observation_type", "in", "(POINT_BY_POINT,PBP)").limit(1000),
    nullDateBase().is("player_name", null).not("observation_type", "in", "(POINT_BY_POINT,PBP)").limit(500),
  ]);
  const results = [otherResult, marketResult, sharedResult, nullDatePlayerResult, nullDateSharedResult];
  if (results.some((result) => result.error)) return [] as ObservationRow[];
  const rows = results.flatMap((result) => (result.data ?? []) as ObservationRow[]);
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = [row.source_id,row.source_url,row.player_name,row.opponent_name,row.event_date,row.observation_key,row.text_value,row.numeric_value].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function approvedPbpPacket(args: { metrics: MetricLike[]; p1: string; p2: string; asOfDate: string; context?: string | null }) {
  const tour = classifyEvidenceTourFamily(args.context);
  if (!tour) return {} as Record<string, any>;
  const input = { metrics: args.metrics, p1: args.p1, p2: args.p2, asOfDate: args.asOfDate, context: args.context };
  if (tour === "ATP_MAIN") return (await buildBsdAtpMainPbpContext(input)).packet as Record<string, any>;
  if (tour === "WTA_MAIN") return (await buildBsdWtaMainPbpContext(input)).packet as Record<string, any>;
  if (tour === "ATP_CHALLENGER") return (await buildBsdAtpChallengerPbpContext(input)).packet as Record<string, any>;
  return (await buildBsdWtaChallengerPbpContext(input)).packet as Record<string, any>;
}

function mergePacketEntry(base: any, pbp: any) {
  if (!base) return pbp;
  if (!pbp) return base;
  const observations = [...(base.observations ?? []), ...(pbp.observations ?? [])];
  const seen = new Set<string>();
  const deduped = observations.filter((row: any) => {
    const value = row?.value ?? {};
    const matchId = value?.match_id ?? String(row?.url ?? "").match(/\/matches\/(\d+)\//)?.[1] ?? "";
    const key = [row?.family,row?.source,matchId,row?.player,row?.opponent,row?.player1,row?.player2,row?.event_date,row?.key].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    ...base,
    observed_families: unique([...(base.observed_families ?? []), ...(pbp.observed_families ?? [])]),
    direct_satisfaction_allowed: Boolean(base.direct_satisfaction_allowed || pbp.direct_satisfaction_allowed),
    observations: deduped.slice(0, 80),
    pbp_tour_guard: pbp.tour_guard ?? null,
  };
}

export async function buildMetricObservationContext(args: { metrics: MetricLike[]; p1: string; p2: string; asOfDate: string; context?: string | null; }) {
  const [rows, pbpPacket] = await Promise.all([
    loadCandidateRows(args.p1, args.p2, args.asOfDate),
    approvedPbpPacket(args),
  ]);
  const packet: Record<string, any> = {};
  for (const metric of args.metrics) {
    const code = codeOf(metric.code);
    const policy = policyForMetric(code);
    const allowed = rows.filter((row) => metricAllowsObservation(code, row));
    if (allowed.length) {
      const families = unique(allowed.map((row) => observationFamily(row)).filter(Boolean));
      const supportOnly = policy.support_only_families ?? [];
      const sufficient = policy.sufficient_families ?? [];
      packet[code] = { metric_name: metric.name, allowed_families: policy.allowed_families, sufficient_families: sufficient, support_only_families: supportOnly, observed_families: families, direct_satisfaction_allowed: families.some((family) => sufficient.includes(family!)), observations: allowed.slice(0, 80).map(compactObservation) };
    }
    packet[code] = mergePacketEntry(packet[code], pbpPacket[code]);
    if (!packet[code]) delete packet[code];
  }
  return packet;
}

export function appendMetricObservationContext(baseContext: string | null | undefined, packet: Record<string, unknown>) {
  if (!Object.keys(packet).length) return baseContext ?? "";
  const appendix = `\n\nWAREHOUSE_OBSERVATION_CONTEXT\n${JSON.stringify(packet)}\nEND_WAREHOUSE_OBSERVATION_CONTEXT\nRules: use only observations listed under the requested metric code; never borrow an observation family from another metric; support-only families may inform reconstruction but cannot alone justify DIRECT treatment or a complete metric answer.`;
  return `${baseContext ?? ""}${appendix}`;
}
