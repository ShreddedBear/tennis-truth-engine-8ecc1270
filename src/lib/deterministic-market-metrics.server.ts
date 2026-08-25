import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { MetricFinding } from "./audit-pipeline";
import { evidencePairMatches, safeEvidenceAliases } from "./evidence-player-alias";
import { metricAllowsObservation } from "./metric-source-family-policy";

const db = supabaseAdmin as any;
const MARKET_CODES = new Set(["015", "019", "043", "044"]);

type MarketRow = {
  source_id: string | null;
  source_name: string | null;
  source_url: string | null;
  source_record_key: string | null;
  player_name: string | null;
  opponent_name: string | null;
  event_date: string | null;
  observation_type: string | null;
  observation_key: string | null;
  numeric_value: number | null;
  source_published_at: string | null;
  sample_label: string | null;
  raw_payload: any;
  provenance: any;
};

function codeOf(value: unknown) {
  const m = String(value ?? "").match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function mean(values: number[]) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }
function median(values: number[]) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; }
function implied(decimalOdds: number) { return decimalOdds > 1 ? 1 / decimalOdds : null; }
function snapshotKey(row: MarketRow) { return String(row.provenance?.snapshot_timestamp ?? row.source_published_at ?? row.source_record_key ?? "unknown"); }
function bookmakerKey(row: MarketRow) { return String(row.provenance?.bookmaker_key ?? row.sample_label ?? "unknown"); }

function deVigForPlayer(playerRows: MarketRow[], opponentRows: MarketRow[]) {
  const oppByPair = new Map<string, number>();
  for (const row of opponentRows) { if (!row.numeric_value) continue; oppByPair.set(`${snapshotKey(row)}|${bookmakerKey(row)}`, row.numeric_value); }
  const probs: number[] = [];
  for (const row of playerRows) {
    if (!row.numeric_value) continue;
    const oppOdds = oppByPair.get(`${snapshotKey(row)}|${bookmakerKey(row)}`);
    if (!oppOdds) continue;
    const p = implied(row.numeric_value); const q = implied(oppOdds);
    if (p == null || q == null || p + q <= 0) continue;
    probs.push(p / (p + q));
  }
  return probs;
}
function movement(rows: MarketRow[]) {
  const pts = rows.filter((r) => typeof r.numeric_value === "number" && r.numeric_value! > 1)
    .map((r) => ({ t: Date.parse(String(r.source_published_at ?? r.provenance?.snapshot_timestamp ?? "")), p: implied(r.numeric_value!) }))
    .filter((x) => Number.isFinite(x.t) && x.p != null).sort((a, b) => a.t - b.t) as Array<{ t: number; p: number }>;
  if (pts.length < 2) return null;
  return pts[pts.length - 1].p - pts[0].p;
}

async function loadSide(player: string, opponent: string, asOfDate: string) {
  const playerAliases = safeEvidenceAliases(player, opponent);
  const opponentAliases = safeEvidenceAliases(opponent, player);
  const { data, error } = await db.from("source_observations")
    .select("source_id,source_name,source_url,source_record_key,player_name,opponent_name,event_date,observation_type,observation_key,numeric_value,source_published_at,sample_label,raw_payload,provenance")
    .eq("source_id", "odds_api").eq("observation_type", "MARKET")
    .in("player_name", playerAliases).in("opponent_name", opponentAliases)
    .gte("event_date", "2020-06-06").lte("event_date", asOfDate).order("source_published_at", { ascending: true });
  if (error) return [] as MarketRow[];
  return ((data ?? []) as MarketRow[]).filter((row) => evidencePairMatches(row.player_name, row.opponent_name, player, opponent));
}

function summarizeMarket(rows: MarketRow[], opponentRows: MarketRow[]) {
  const odds = rows.map((r) => Number(r.numeric_value)).filter((v) => Number.isFinite(v) && v > 1);
  const rawImplied = odds.map((o) => 1 / o); const devig = deVigForPlayer(rows, opponentRows);
  return { observations: odds.length, paired_devig_observations: devig.length, avg_decimal_odds: mean(odds), median_decimal_odds: median(odds), avg_raw_implied_probability: mean(rawImplied), avg_devig_probability: mean(devig), probability_movement: movement(rows), favorite_share: rawImplied.length ? rawImplied.filter((p) => p > 0.5).length / rawImplied.length : null };
}
function fmtPct(v: number | null) { return v == null ? "n/a" : `${(v * 100).toFixed(1)}%`; }
function valueText(summary: ReturnType<typeof summarizeMarket>) { return [`avg_de_vig=${fmtPct(summary.avg_devig_probability)}`, `avg_raw=${fmtPct(summary.avg_raw_implied_probability)}`, `move=${fmtPct(summary.probability_movement)}`, `favorite_share=${fmtPct(summary.favorite_share)}`, `n=${summary.observations}`, `paired=${summary.paired_devig_observations}`].join("; "); }
function treatmentFor(code: string, rows: MarketRow[], summary: ReturnType<typeof summarizeMarket>): MetricFinding["p1_treatment"] {
  if (!rows.length || summary.observations === 0) return "UNAVAILABLE";
  if ((code === "015" || code === "019") && summary.paired_devig_observations > 0) return "RECONSTRUCTED";
  return "PARTIAL";
}

export async function deterministicMarketMetric(args: { metricCode: unknown; p1: string; p2: string; asOfDate: string; }): Promise<MetricFinding | null> {
  const code = codeOf(args.metricCode); if (!MARKET_CODES.has(code)) return null;
  const [p1RowsRaw, p2RowsRaw] = await Promise.all([loadSide(args.p1, args.p2, args.asOfDate), loadSide(args.p2, args.p1, args.asOfDate)]);
  const p1Rows = p1RowsRaw.filter((row) => metricAllowsObservation(code, row));
  const p2Rows = p2RowsRaw.filter((row) => metricAllowsObservation(code, row));
  if (!p1Rows.length && !p2Rows.length) return null;

  const p1Summary = summarizeMarket(p1Rows, p2Rows);
  const p2Summary = summarizeMarket(p2Rows, p1Rows);
  const p1Treatment = treatmentFor(code, p1Rows, p1Summary);
  const p2Treatment = treatmentFor(code, p2Rows, p2Summary);
  const p1Value = p1Treatment === "UNAVAILABLE" ? null : valueText(p1Summary);
  const p2Value = p2Treatment === "UNAVAILABLE" ? null : valueText(p2Summary);
  const sourceUrl = p1Rows[0]?.source_url ?? p2Rows[0]?.source_url ?? "https://the-odds-api.com/historical-odds-data/";
  const sourceName = p1Rows[0]?.source_name ?? p2Rows[0]?.source_name ?? "The Odds API Historical Data";
  const missingSide = p1Treatment === "UNAVAILABLE" || p2Treatment === "UNAVAILABLE";
  const unpairedCore = (code === "015" || code === "019") && (p1Summary.paired_devig_observations === 0 || p2Summary.paired_devig_observations === 0);

  return {
    metric_code: code,
    p1_value: p1Value,
    p2_value: p2Value,
    p1_treatment: p1Treatment,
    p2_treatment: p2Treatment,
    differential: p1Summary.avg_devig_probability != null && p2Summary.avg_devig_probability != null ? `${((p1Summary.avg_devig_probability - p2Summary.avg_devig_probability) * 100).toFixed(1)} pp de-vig` : null,
    evidence_family: "MARKET",
    reliability: Math.min(95, 55 + Math.min(40, Math.floor((p1Summary.paired_devig_observations + p2Summary.paired_devig_observations) / 4))),
    sample: `The Odds API historical h2h; 2020-06-06→${args.asOfDate}; p1_n=${p1Summary.observations}; p2_n=${p2Summary.observations}`,
    unavailable_reason: missingSide ? "Market evidence is one-sided; the missing side is not synthesized or credited." : unpairedCore ? "Raw market observations exist but paired opponent snapshots required for de-vig reconstruction are incomplete." : code === "019" ? "Outcome-linked calibration completion still requires verified result labels; this row supplies deterministic historical market probability components." : null,
    sources: [{ source_name: sourceName, url: sourceUrl }],
  };
}
