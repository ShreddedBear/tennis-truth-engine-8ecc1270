// Hybrid audit researcher. Local public historical evidence is always attempted first; live AI/web research supplements it when available.
import type { IdentityFinding, Researcher, MetricFinding } from "./audit-pipeline";
import type { SourcedStat } from "./reconstruction/engine";
import { aiResearcher } from "./audit-research.server";
import { getPredixDatasetEvidence, predixDatasetDossier, statsFromPredixDatasetDossier } from "./predixsport-dataset.server";
import { getRecentReconstruction } from "./predixsport-recent.server";
import { getDerivedHistoricalStats } from "./predixsport-derived.server";
import { getStrengthTrajectoryStats } from "./predixsport-strength.server";
import { getRankingPerformanceStats } from "./ranking-performance.server";
import { getH2HStats } from "./predixsport-h2h.server";
import { getHistoricalServeReturnStats } from "./datahub-atp-serve-return.server";
import { getHistoricalScoreProfileStats } from "./datahub-atp-score-profile.server";
import { getMatchupEfficiencyStats } from "./matchup-efficiency.server";
import { getEnhancedCommonOpponentStats } from "./common-opponent-enhanced.server";
import { getAvailabilityHistoryStats } from "./availability-layoff.server";
import { getTournamentContextStats } from "./tournament-context.server";
import { getTravelBurdenStats } from "./travel-burden.server";
import { getCourtContextStats } from "./court-context.server";
import { getWeatherContextStats } from "./weather-context.server";
import { getCommonOpponentEvidence } from "./predixsport-common.server";
import { resolveLocalMatchContext } from "./local-match-context.server";

function isProviderFailure(error: unknown) {
  const m = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /402|credit|quota|429|rate limit|timeout|provider|api key|auth|fetch|not configured/.test(m);
}

function localIdentity(input: { p1: string; p2: string; hints: Record<string, string | null> }): IdentityFinding {
  const ctx = resolveLocalMatchContext(input.p1, input.p2, input.hints);
  const context = Object.entries(ctx.fields).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(" · ");
  const a = getPredixDatasetEvidence(input.p1, context), b = getPredixDatasetEvidence(input.p2, context);
  return {
    player1_canonical: a?.canonicalPlayer ?? (a ? input.p1 : null),
    player2_canonical: b?.canonicalPlayer ?? (b ? input.p2 : null),
    player1_status: a ? "VERIFIED" : "UNVERIFIED",
    player2_status: b ? "VERIFIED" : "UNVERIFIED",
    tournament: ctx.fields.tournament ?? null,
    event_level: ctx.fields.event_level ?? null,
    round: ctx.fields.round ?? null,
    scheduled_date: ctx.fields.scheduled_date ?? null,
    surface: ctx.fields.surface ?? null,
    indoor: null,
    best_of: ctx.fields.best_of ? Number(ctx.fields.best_of) : null,
    surface_status: ctx.fields.surface ? "VERIFIED" : "UNVERIFIED",
    unresolved_reason: ctx.unresolvedReason,
    sources: ctx.sources.map((name) => ({ source_name: name, url: ctx.sourceUrl, retrieved_at: new Date().toISOString() })),
    conflicts: [],
  };
}

function mergeIdentity(a: IdentityFinding, b: IdentityFinding): IdentityFinding {
  const c = <T>(x: T | null | undefined, y: T | null | undefined) => y ?? x ?? null;
  return {
    player1_canonical: c(a.player1_canonical, b.player1_canonical),
    player2_canonical: c(a.player2_canonical, b.player2_canonical),
    player1_status: b.player1_status === "VERIFIED" ? "VERIFIED" : a.player1_status,
    player2_status: b.player2_status === "VERIFIED" ? "VERIFIED" : a.player2_status,
    tournament: c(a.tournament, b.tournament), event_level: c(a.event_level, b.event_level), round: c(a.round, b.round),
    scheduled_date: c(a.scheduled_date, b.scheduled_date), surface: c(a.surface, b.surface), indoor: c(a.indoor, b.indoor),
    best_of: c(a.best_of, b.best_of), surface_status: b.surface_status === "VERIFIED" ? "VERIFIED" : a.surface_status,
    unresolved_reason: b.unresolved_reason ?? a.unresolved_reason,
    sources: [...(a.sources ?? []), ...(b.sources ?? [])], conflicts: [...(a.conflicts ?? []), ...(b.conflicts ?? [])],
  };
}

function familyCode(code: string) {
  const m = String(code).match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(code).padStart(3, "0");
}

function pickedStats(map: Map<string, SourcedStat>, keys: string[]) {
  return keys.map((k) => map.get(k)).filter((x): x is SourcedStat => !!x);
}
function summarize(map: Map<string, SourcedStat>, keys: string[]) {
  const p = pickedStats(map, keys);
  return p.length ? p.map((s) => `${s.key}=${Number(s.value).toFixed(2)}`).join("; ") : null;
}
function summaryMeta(map: Map<string, SourcedStat>, keys: string[]) {
  const p = pickedStats(map, keys);
  if (!p.length) return null;
  const samples = p.map((x) => x.sample).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  const sources = p.flatMap((x) => x.sources ?? []).filter((x, i, a) => a.findIndex((y) => y.source_name === x.source_name && y.url === x.url) === i);
  return { sample: samples.length ? Math.min(...samples) : null, sources };
}

// Every key below is intentionally tied to the master metric definition. Do not
// put a convenient statistic into an unrelated family merely to increase coverage.
const SUMMARY_KEYS: Record<string, string[]> = {
  "001": ["surface_elo","current_surface_elo","peak_surface_elo","observed_peak_surface_elo","surface_win_pct","surface_matches","surface_elo_trend","surface_elo_change_last10","peak_vs_current_elo_gap","surface_elo_below_peak","surface_win_pct_52w","surface_matches_52w"],
  "002": ["service_points_won_pct","first_serve_in_pct","first_serve_points_won_pct","second_serve_points_won_pct","ace_rate_pct","double_fault_rate_pct","break_points_saved_pct","hold_pct","service_games_held"],
  "003": ["return_points_won_pct","first_serve_return_points_won_pct","second_serve_return_points_won_pct","break_point_conversion_pct","break_pct","return_games_played","break_points_created_per_return_game"],
  "004": ["service_points_won_pct","return_points_won_pct","total_points_won_pct","hold_pct","break_pct","matchup_expected_hold_pct","matchup_expected_break_pct","expected_hold_break_differential","dominance_ratio","combined_point_efficiency"],
  "005": ["last5_win_pct","last10_win_pct","last5_set_win_pct","last10_set_win_pct","current_surface_recent_win_pct","win_pct_60d","win_pct_90d","recent_form_trend","recent_straight_set_control_pct","recent_performance_acceleration","avg_sets_conceded_in_recent_wins","set_margin_mean","overall_recent20_win_pct"],
  "006": ["recent_opponent_avg_elo","best_recent_win_opponent_elo","bad_loss_rate_pct","comparable_strength_win_pct","performance_vs_comparable_strength_pct"],
  "007": ["direct_common_opponents","common_opponent_matches","common_opponent_wins","common_opponent_losses","common_opponent_win_pct","surface_matched_common_opponents","tournament_level_matched_common_opponents","common_opponent_recency_weighted_win_pct","common_opponent_strength_weighted_win_pct","common_opponent_weighted_set_margin","common_opponent_second_degree_strength_pct"],
  "008": ["set1_win_pct","set2_win_pct","set3_deciding_set_win_pct","historical_deciding_set_win_pct","win_after_losing_set1_pct","win_after_winning_set1_pct","second_set_after_losing_set1_win_pct","deciding_matches_played","set_win_pct","sets_played","sets_won"],
  "009": ["win_after_losing_set1_pct","win_after_winning_set1_pct","tiebreak_win_pct","tiebreaks_played","historical_deciding_set_win_pct","deciding_matches_played","break_points_saved_pct","break_point_conversion_pct","close_match_win_pct"],
  "010": ["historical_straight_set_win_pct","straight_set_win_pct","straight_set_wins","matches_won","straight_set_rate_comparable_pct"],
  "011": ["performance_variance","floor_ceiling_elo_range","deciding_match_reliance_pct","close_match_win_pct","upset_resistance_pct","recent_elo_delta_mean","recent_elo_delta_variance","recent_elo_best_delta","recent_elo_worst_delta"],
  "012": ["matches_last_7_days","matches_last_14_days","matches_last_28_days","sets_last_14_days","three_setters_last_14_days","rest_days","qualifying_matches_last_14_days","days_since_last_match","recent_inter_match_gap_days","tournament_switches_last10","country_changes_last10","observed_travel_km_last10","avg_observed_travel_km_per_move","long_haul_moves_3000km_plus_last10","observed_timezone_shift_hours_last10","max_observed_timezone_shift_hours_last10"],
  "013": ["longest_observed_layoff_days","observed_layoffs_30d_plus","observed_layoffs_60d_plus","observed_layoffs_90d_plus","return_after_layoff_win_pct"],
  // 014 Ranking Context intentionally has no local fallback. The repository's
  // ranking-performance module explicitly forbids treating Elo as ATP/WTA rank.
  "020": ["same_level_matches","same_level_win_pct"],
  "021": ["match_surface_hard","match_surface_clay","match_surface_grass","match_surface_carpet","match_indoor","verified_court_speed_index","verified_court_speed_band","match_temperature_c","match_humidity_pct","match_wind_kph","match_altitude_m","match_roof_closed"],
  "023": ["serve_vs_opponent_return_edge","return_vs_opponent_serve_edge","serve_aggression_proxy","serve_reliance_proxy","return_pressure_proxy","balanced_efficiency_proxy","close_match_resilience_proxy","style_serve_vs_return_edge","style_return_vs_serve_edge","style_balance_edge","style_resilience_edge"],
  "028": ["matches_last_14_days","matches_last_28_days","days_since_last_match","recent_inter_match_gap_days","tournament_switches_last10","country_changes_last10","observed_travel_km_last10","avg_observed_travel_km_per_move","long_haul_moves_3000km_plus_last10","observed_timezone_shift_hours_last10","max_observed_timezone_shift_hours_last10","same_round_matches","same_round_win_pct"],
  "030": ["same_tournament_matches","same_tournament_win_pct"],
  "035": ["observed_vs_expected_wl_gap_pct"],
  "055": ["elo_change_last5","elo_change_last10","elo_change_last20","elo_change_per_match_last20","surface_elo_change_last10","recent_performance_acceleration","recent_form_trend"],
  "068": ["current_streak_signed","longest_win_streak_observed"],
  "080": ["recent_opponent_avg_elo","best_recent_win_opponent_elo","bad_loss_rate_pct","comparable_strength_win_pct","performance_vs_comparable_strength_pct","common_opponent_strength_weighted_win_pct","common_opponent_recency_weighted_win_pct"],
};

function summaryFor(map: Map<string, SourcedStat>, code: string) {
  const keys = SUMMARY_KEYS[familyCode(code)];
  if (!keys) return null;
  const value = summarize(map, keys);
  if (!value) return null;
  const meta = summaryMeta(map, keys);
  return { value, sample: meta?.sample ?? null, sources: meta?.sources ?? [] };
}

function metricLooksH2H(m: { name: string; body: string | null }) {
  return /\bh2h\b|head\s*[- ]?to\s*[- ]?head|direct meetings?|prior meetings?/i.test(`${m.name} ${m.body ?? ""}`);
}
function h2hSummary(map: Map<string, SourcedStat>) {
  const keys = ["h2h_matches","h2h_wins","h2h_win_pct","h2h_surface_matches","h2h_surface_wins","h2h_surface_win_pct","h2h_recent3_win_pct"];
  const value = summarize(map, keys), meta = summaryMeta(map, keys);
  return value ? { value, sample: meta?.sample ?? null, sources: meta?.sources ?? [] } : null;
}

function allStats(p: string, o: string, c: string) {
  const d = getPredixDatasetEvidence(p, c);
  return [
    ...(d?.stats ?? []), ...getRecentReconstruction(p,c), ...getDerivedHistoricalStats(p,c), ...getStrengthTrajectoryStats(p,c),
    ...getRankingPerformanceStats(p,c), ...getH2HStats(p,o,c), ...getHistoricalServeReturnStats(p,c), ...getHistoricalScoreProfileStats(p,c),
    ...getMatchupEfficiencyStats(p,o,c), ...getEnhancedCommonOpponentStats(p,o,c), ...getAvailabilityHistoryStats(p,c),
    ...getTournamentContextStats(p,c), ...getTravelBurdenStats(p,c), ...getCourtContextStats(p,c), ...getWeatherContextStats(p,c),
  ];
}

function localMetricRows(p1: string, p2: string, context: string, requested: Array<{ code: string; name: string; body: string | null }>): MetricFinding[] {
  const amap = new Map(allStats(p1,p2,context).map((s) => [s.key,s]));
  const bmap = new Map(allStats(p2,p1,context).map((s) => [s.key,s]));
  const common = getCommonOpponentEvidence(p1,p2,context);
  return requested.map((m) => {
    let xs = metricLooksH2H(m) ? h2hSummary(amap) : summaryFor(amap,m.code);
    let ys = metricLooksH2H(m) ? h2hSummary(bmap) : summaryFor(bmap,m.code);
    if (familyCode(m.code) === "007" && common) {
      const ax=summaryFor(amap,m.code), bx=summaryFor(bmap,m.code), src=[common.source];
      xs={value:[`direct_common_opponents=${common.commonCount}`,`record=${common.p1Wins}-${common.p1Losses}`,`win_pct=${common.p1WinPct?.toFixed(1)??"—"}%`,ax?.value??null].filter(Boolean).join("; "),sample:Math.max(common.commonCount,ax?.sample??0),sources:[...src,...(ax?.sources??[])]};
      ys={value:[`direct_common_opponents=${common.commonCount}`,`record=${common.p2Wins}-${common.p2Losses}`,`win_pct=${common.p2WinPct?.toFixed(1)??"—"}%`,bx?.value??null].filter(Boolean).join("; "),sample:Math.max(common.commonCount,bx?.sample??0),sources:[...src,...(bx?.sources??[])]};
    }
    const sources=[...(xs?.sources??[]),...(ys?.sources??[])].filter((s,i,a)=>a.findIndex((z)=>z.source_name===s.source_name&&z.url===s.url)===i);
    const historicalDataHub=sources.some((s)=>s.source_name.includes("DataHub ATP"));
    const f=familyCode(m.code);
    const evidenceFamily=xs||ys ? (metricLooksH2H(m)?"PUBLIC_HISTORICAL_H2H":f==="007"?"PUBLIC_COMMON_OPPONENT_NETWORK":f==="020"?"PUBLIC_TOUR_LEVEL_HISTORY":f==="021"?"VERIFIED_SURFACE_ENVIRONMENT":f==="023"?"PUBLIC_MATCHUP_COMPATIBILITY":f==="028"?"PUBLIC_SCHEDULING_CONTEXT":f==="030"?"PUBLIC_TOURNAMENT_HISTORY":historicalDataHub?`HISTORICAL_DATAHUB_FAMILY_${f}`:`PUBLIC_HISTORICAL_DATA_FAMILY_${f}`) : null;
    const partialReason = f === "007" && (xs || ys)
      ? "PARTIAL: public match history supports direct shared-opponent records, recency weighting, same-surface filtering, set-margin comparison, opponent-strength weighting and second-degree chains when inputs exist. Exact game-by-game scoreline comparison and tournament-level matching remain source-dependent and are not inferred when absent."
      : f === "008" && (xs || ys)
        ? "PARTIAL: explicit set scores support Set-1/Set-2 win rates, deciding-set rate, records after winning/losing Set 1, and second-set response after losing Set 1. First-break frequency, immediate break-back rate, and set-by-set hold/return improvement require game/point sequence data and are not inferred from set scores."
        : null;
    return {
      metric_code:m.code,p1_value:xs?.value??null,p2_value:ys?.value??null,
      // These are broad master families. A subset of historical submetrics is
      // useful evidence, but it is not the entire family.
      p1_treatment:xs?"PARTIAL":"UNAVAILABLE",p2_treatment:ys?"PARTIAL":"UNAVAILABLE",
      differential:null,evidence_family:evidenceFamily,reliability:xs||ys?(historicalDataHub?70:85):null,
      sample:String(Math.max(xs?.sample??0,ys?.sample??0))||null,
      unavailable_reason:!xs&&!ys?"Synced public historical data does not support this metric family":partialReason,sources,
    } as MetricFinding;
  });
}

function mergeMetrics(live: MetricFinding[], local: MetricFinding[]): MetricFinding[] {
  const by=new Map(live.map((m)=>[String(m.metric_code),m]));
  return local.map((l)=>{
    const m=by.get(String(l.metric_code)); if(!m)return l;
    const p1=m.p1_treatment!=="UNAVAILABLE"&&m.p1_treatment!=="EXCLUDED"&&m.p1_value!==null;
    const p2=m.p2_treatment!=="UNAVAILABLE"&&m.p2_treatment!=="EXCLUDED"&&m.p2_value!==null;
    const p1Treatment=p1?m.p1_treatment:(l.p1_value!==null?l.p1_treatment:m.p1_treatment);
    const p2Treatment=p2?m.p2_treatment:(l.p2_value!==null?l.p2_treatment:m.p2_treatment);
    const partial=p1Treatment==="PARTIAL"||p2Treatment==="PARTIAL";
    return {...m,p1_value:p1?m.p1_value:l.p1_value,p1_treatment:p1Treatment,p2_value:p2?m.p2_value:l.p2_value,p2_treatment:p2Treatment,evidence_family:m.evidence_family??l.evidence_family,reliability:m.reliability??l.reliability,sample:m.sample??l.sample,sources:[...(m.sources??[]),...(l.sources??[])].filter((s,i,a)=>a.findIndex((z)=>z.source_name===s.source_name&&z.url===s.url)===i),unavailable_reason:partial?(m.unavailable_reason??l.unavailable_reason):((p1||p2||l.p1_value!==null||l.p2_value!==null)?null:(m.unavailable_reason??l.unavailable_reason))};
  });
}

export const hybridResearcher: Researcher = {
  async identity(input) {
    const local=localIdentity(input); try{return mergeIdentity(local,await aiResearcher.identity(input));}catch(e){if(!isProviderFailure(e))throw e;return local;}
  },
  async dossier({player,opponent,context}) {
    const local=predixDatasetDossier(player,context); try{return[local,await aiResearcher.dossier?.({player,opponent,context})??""].filter(Boolean).join("\n");}catch(e){if(!isProviderFailure(e))throw e;return local;}
  },
  async extractStats({player,opponent,dossier,context}) {
    const local=[...statsFromPredixDatasetDossier(dossier,player),...getRecentReconstruction(player,context),...getDerivedHistoricalStats(player,context),...getStrengthTrajectoryStats(player,context),...getRankingPerformanceStats(player,context),...getH2HStats(player,opponent,context),...getHistoricalServeReturnStats(player,context),...getHistoricalScoreProfileStats(player,context),...getMatchupEfficiencyStats(player,opponent,context),...getEnhancedCommonOpponentStats(player,opponent,context),...getAvailabilityHistoryStats(player,context),...getTournamentContextStats(player,context),...getTravelBurdenStats(player,context),...getCourtContextStats(player,context),...getWeatherContextStats(player,context)];
    try{const live=await aiResearcher.extractStats?.({player,dossier,context})??[],seen=new Set(live.map((s)=>`${s.key}|${s.surface??""}|${s.window??""}`));return[...live,...local.filter((s)=>!seen.has(`${s.key}|${s.surface??""}|${s.window??""}`))];}catch(e){if(!isProviderFailure(e))throw e;return local;}
  },
  async metrics(input) {
    const local=localMetricRows(input.p1,input.p2,input.context,input.metrics); try{return mergeMetrics(await aiResearcher.metrics(input),local);}catch(e){if(!isProviderFailure(e))throw e;return local;}
  },
  rules:(i)=>aiResearcher.rules(i),underdog:(i)=>aiResearcher.underdog(i),conclusion:(i)=>aiResearcher.conclusion(i),stress:(i)=>aiResearcher.stress(i),
};
