import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { safeEvidenceAliases } from "./evidence-player-alias";
import { metricAllowsObservation, observationFamily, policyForMetric, type ObservationFamily } from "./metric-source-family-policy";

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
type LaneFailure = { lane: string; families: ObservationFamily[]; message: string };

type Lane = { name: string; families: ObservationFamily[]; result: { data: any[] | null; error: { message: string } | null } };

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
  const p1Aliases = safeEvidenceAliases(player, opponent);
  const p2Aliases = safeEvidenceAliases(opponent, player);
  const select = "source_id,source_name,source_url,player_name,opponent_name,tournament,event_date,surface,observation_type,observation_key,text_value,numeric_value,sample_label,window_start,window_end";
  const base = () => db.from("source_observations").select(select)
    .gte("event_date", start.toISOString().slice(0, 10)).lte("event_date", asOfDate)
    .order("event_date", { ascending: false });

  // Family isolation prevents PBP/market density from crowding other evidence.
  // Side isolation prevents a high-volume player from consuming the shared LIMIT
  // before the opponent's rows are reached. Every player/family lane gets its
  // own bounded query and a failure in one lane never erases successful lanes.
  const [p1Other, p2Other, p1Market, p2Market, p1Pbp, p2Pbp, sharedResult] = await Promise.all([
    base().in("player_name", p1Aliases).not("observation_type", "in", "(POINT_BY_POINT,PBP,MARKET)").limit(1000),
    base().in("player_name", p2Aliases).not("observation_type", "in", "(POINT_BY_POINT,PBP,MARKET)").limit(1000),
    base().in("player_name", p1Aliases).eq("observation_type", "MARKET").limit(1000),
    base().in("player_name", p2Aliases).eq("observation_type", "MARKET").limit(1000),
    base().in("player_name", p1Aliases).in("observation_type", ["POINT_BY_POINT", "PBP"]).limit(1000),
    base().in("player_name", p2Aliases).in("observation_type", ["POINT_BY_POINT", "PBP"]).limit(1000),
    base().is("player_name", null).limit(1000),
  ]);

  const lanes: Lane[] = [
    { name: "p1_other", families: ["RESULTS_SCHEDULE", "RANKING", "ENVIRONMENT", "RULES_CONTEXT"], result: p1Other },
    { name: "p2_other", families: ["RESULTS_SCHEDULE", "RANKING", "ENVIRONMENT", "RULES_CONTEXT"], result: p2Other },
    { name: "p1_market", families: ["MARKET"], result: p1Market },
    { name: "p2_market", families: ["MARKET"], result: p2Market },
    { name: "p1_pbp", families: ["POINT_BY_POINT"], result: p1Pbp },
    { name: "p2_pbp", families: ["POINT_BY_POINT"], result: p2Pbp },
    { name: "shared", families: ["RESULTS_SCHEDULE", "ENVIRONMENT", "RULES_CONTEXT"], result: sharedResult },
  ];
  const laneFailures: LaneFailure[] = lanes.filter((lane) => lane.result.error).map((lane) => ({ lane: lane.name, families: lane.families, message: lane.result.error!.message }));
  const rows = lanes.flatMap((lane) => lane.result.error ? [] : ((lane.result.data ?? []) as ObservationRow[]));
  const seen = new Set<string>();
  const deduped = rows.filter((row) => {
    const key = [row.source_id,row.source_url,row.player_name,row.opponent_name,row.event_date,row.observation_key,row.text_value,row.numeric_value].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { rows: deduped, laneFailures };
}

export async function buildMetricObservationContext(args: { metrics: MetricLike[]; p1: string; p2: string; asOfDate: string; }) {
  const { rows, laneFailures } = await loadCandidateRows(args.p1, args.p2, args.asOfDate);
  const packet: Record<string, unknown> = {};
  if (laneFailures.length) packet._query_errors = laneFailures;
  for (const metric of args.metrics) {
    const code = codeOf(metric.code);
    const policy = policyForMetric(code);
    const allowed = rows.filter((row) => metricAllowsObservation(code, row));
    if (!allowed.length) continue;
    const families = unique(allowed.map((row) => observationFamily(row)).filter(Boolean));
    const supportOnly = policy.support_only_families ?? [];
    const sufficient = policy.sufficient_families ?? [];
    packet[code] = { metric_name: metric.name, allowed_families: policy.allowed_families, sufficient_families: sufficient, support_only_families: supportOnly, observed_families: families, direct_satisfaction_allowed: families.some((family) => sufficient.includes(family!)), observations: allowed.slice(0, 80).map(compactObservation) };
  }
  return packet;
}

export function appendMetricObservationContext(baseContext: string | null | undefined, packet: Record<string, unknown>) {
  if (!Object.keys(packet).length) return baseContext ?? "";
  const appendix = `\n\nWAREHOUSE_OBSERVATION_CONTEXT\n${JSON.stringify(packet)}\nEND_WAREHOUSE_OBSERVATION_CONTEXT\nRules: use only observations listed under the requested metric code; never borrow an observation family from another metric; support-only families may inform reconstruction but cannot alone justify DIRECT treatment or a complete metric answer. Warehouse lane query errors are diagnostic metadata and never authorize evidence borrowing or fabricated findings.`;
  return `${baseContext ?? ""}${appendix}`;
}
