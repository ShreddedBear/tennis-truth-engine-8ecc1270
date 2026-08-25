import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { MetricFinding, SourceRef } from "./audit-pipeline";
import { evidenceNameMatches, safeEvidenceAliases } from "./evidence-player-alias";
import { metricAllowsObservation } from "./metric-source-family-policy";

const db = supabaseAdmin as any;
const SUPPORTED = new Set(["012", "028", "030", "064", "071", "076", "077", "081"]);

type Observation = {
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
  sample_label: string | null;
};

type PlayerComponents = {
  matches_14d: number;
  matches_30d: number;
  matches_52w: number;
  days_since_last_match: number | null;
  distinct_tournaments_30d: number;
  same_tournament_matches_5y: number;
  same_tournament_wins_5y: number;
  qualifying_matches_14d: number;
  scheduled_current_event_rows: number;
};

function codeOf(value: unknown) {
  const m = String(value ?? "").match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}

function daysBetween(a: string, b: string) {
  return Math.floor((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

function parseText(row: Observation) {
  if (!row.text_value) return {} as Record<string, unknown>;
  try { return JSON.parse(row.text_value) as Record<string, unknown>; } catch { return {}; }
}

function isMatch(row: Observation) {
  return row.observation_key === "match_record" && !!row.event_date && !!row.player_name;
}

function sources(rows: Observation[]): SourceRef[] {
  const seen = new Set<string>();
  const out: SourceRef[] = [];
  for (const row of rows) {
    if (!row.source_name) continue;
    const key = `${row.source_name}|${row.source_url ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ source_name: row.source_name, url: row.source_url, retrieved_at: null });
  }
  return out;
}

function componentsFor(player: string, opponent: string, rows: Observation[], asOfDate: string, tournament: string | null): PlayerComponents {
  const playerRows = rows.filter((r) => evidenceNameMatches(r.player_name, player, opponent) && isMatch(r));
  const recent = (days: number) => playerRows.filter((r) => r.event_date && daysBetween(r.event_date, asOfDate) >= 0 && daysBetween(r.event_date, asOfDate) <= days);
  const r14 = recent(14);
  const r30 = recent(30);
  const r52w = recent(364);
  const dates = playerRows.map((r) => r.event_date!).sort().reverse();
  const last = dates[0] ?? null;
  const sameTournament = tournament ? playerRows.filter((r) => r.tournament === tournament && r.event_date && daysBetween(r.event_date, asOfDate) <= 365 * 5) : [];
  let sameTournamentWins = 0;
  for (const row of sameTournament) {
    const payload = parseText(row);
    if (evidenceNameMatches(String(payload.winner ?? ""), player, opponent)) sameTournamentWins += 1;
  }
  const qualifying = r14.filter((r) => /qual/i.test(String(r.sample_label ?? parseText(r).round ?? "")));
  const scheduledCurrent = rows.filter((r) => r.observation_key === "event_schedule" && (!tournament || r.tournament === tournament)).length;
  return {
    matches_14d: r14.length,
    matches_30d: r30.length,
    matches_52w: r52w.length,
    days_since_last_match: last ? daysBetween(last, asOfDate) : null,
    distinct_tournaments_30d: new Set(r30.map((r) => r.tournament).filter(Boolean)).size,
    same_tournament_matches_5y: sameTournament.length,
    same_tournament_wins_5y: sameTournamentWins,
    qualifying_matches_14d: qualifying.length,
    scheduled_current_event_rows: scheduledCurrent,
  };
}

function valueFor(code: string, c: PlayerComponents) {
  switch (code) {
    case "012":
    case "077": return `matches_14d=${c.matches_14d}; matches_30d=${c.matches_30d}; matches_52w=${c.matches_52w}; days_since_last_match=${c.days_since_last_match ?? "NA"}`;
    case "028": return `matches_30d=${c.matches_30d}; distinct_tournaments_30d=${c.distinct_tournaments_30d}; days_since_last_match=${c.days_since_last_match ?? "NA"}`;
    case "030": return `same_tournament_matches_5y=${c.same_tournament_matches_5y}; same_tournament_wins_5y=${c.same_tournament_wins_5y}`;
    case "064": return `qualifying_matches_14d=${c.qualifying_matches_14d}; current_event_schedule_rows=${c.scheduled_current_event_rows}`;
    case "071": return `days_since_last_match=${c.days_since_last_match ?? "NA"}; current_event_schedule_rows=${c.scheduled_current_event_rows}`;
    case "076": return `matches_14d=${c.matches_14d}; qualifying_matches_14d=${c.qualifying_matches_14d}; days_since_last_match=${c.days_since_last_match ?? "NA"}`;
    case "081": return `matches_30d=${c.matches_30d}; distinct_tournaments_30d=${c.distinct_tournaments_30d}; qualifying_matches_14d=${c.qualifying_matches_14d}`;
    default: return null;
  }
}

export async function deterministicResultsScheduleMetric(args: {
  metricCode: string;
  p1: string;
  p2: string;
  asOfDate: string;
  tournament?: string | null;
}): Promise<MetricFinding | null> {
  const code = codeOf(args.metricCode);
  if (!SUPPORTED.has(code)) return null;
  const start = new Date(`${args.asOfDate}T00:00:00Z`);
  start.setUTCFullYear(start.getUTCFullYear() - 5);
  const aliases = [...new Set([...safeEvidenceAliases(args.p1, args.p2), ...safeEvidenceAliases(args.p2, args.p1)])];
  const select = "source_id,source_name,source_url,player_name,opponent_name,tournament,event_date,surface,observation_type,observation_key,text_value,sample_label";
  const base = () => db.from("source_observations").select(select)
    .gte("event_date", start.toISOString().slice(0, 10))
    .lte("event_date", args.asOfDate)
    .order("event_date", { ascending: false })
    .limit(2000);
  const [playerResult, sharedResult] = await Promise.all([
    base().in("player_name", aliases),
    base().is("player_name", null),
  ]);
  if (playerResult.error || sharedResult.error) return null;
  const rows = ([...(playerResult.data ?? []), ...(sharedResult.data ?? [])] as Observation[]).filter((row) => metricAllowsObservation(code, row));
  const playerRows = rows.filter((r) => evidenceNameMatches(r.player_name, args.p1, args.p2) || evidenceNameMatches(r.player_name, args.p2, args.p1));
  if (!playerRows.length) return null;
  const c1 = componentsFor(args.p1, args.p2, rows, args.asOfDate, args.tournament ?? null);
  const c2 = componentsFor(args.p2, args.p1, rows, args.asOfDate, args.tournament ?? null);
  const p1 = valueFor(code, c1);
  const p2 = valueFor(code, c2);
  if (!p1 || !p2) return null;
  return {
    metric_code: code,
    p1_value: p1,
    p2_value: p2,
    p1_treatment: "PARTIAL",
    p2_treatment: "PARTIAL",
    differential: null,
    evidence_family: "RESULTS_SCHEDULE",
    reliability: 80,
    sample: `deterministic warehouse components through ${args.asOfDate}`,
    unavailable_reason: null,
    sources: sources(rows),
  };
}
