// ============================================================================
// CANONICAL ATOMIC STATISTIC CATALOG
//
// The 81 audit "metrics" are evidence FAMILIES. Reconstruction happens at the
// level of atomic statistics, each of which is either sourced directly or
// derived by an approved formula. This catalog is the only vocabulary the
// reconstruction engine accepts: an extracted statistic whose key is not
// listed here is discarded rather than guessed at.
// ============================================================================

export type Unit = "PERCENT" | "COUNT" | "RATIO" | "RATING" | "MINUTES" | "YEARS";

export interface StatDef {
  key: string;
  label: string;
  unit: Unit;
  family: string;
  min: number;
  max: number;
}

const P = (key: string, label: string, family: string): StatDef => ({ key, label, unit: "PERCENT", family, min: 0, max: 100 });
const C = (key: string, label: string, family: string, max = 100000): StatDef => ({ key, label, unit: "COUNT", family, min: 0, max });

export const STAT_CATALOG: StatDef[] = [
  // --- 001 Surface Strength ---
  { key: "surface_elo", label: "Surface Elo", unit: "RATING", family: "001", min: 500, max: 3000 },
  { key: "peak_surface_elo", label: "Peak surface Elo", unit: "RATING", family: "001", min: 500, max: 3000 },
  { key: "opponent_surface_elo", label: "Opponent surface Elo", unit: "RATING", family: "001", min: 500, max: 3000 },
  P("elo_win_probability", "Elo win probability", "001"),
  { key: "peak_vs_current_elo_gap", label: "Peak vs current Elo gap", unit: "RATING", family: "001", min: -2000, max: 2000 },
  C("surface_matches", "Surface sample depth (matches)", "001", 2000),
  C("surface_wins", "Surface wins", "001", 2000),
  C("surface_losses", "Surface losses", "001", 2000),
  P("surface_win_pct", "Surface win %", "001"),

  // --- 002 Serve Profile ---
  C("service_points", "Service points played", "002", 50000),
  C("first_serves_in", "First serves in", "002", 50000),
  C("first_serve_points_won", "First-serve points won", "002", 50000),
  C("second_serve_points", "Second-serve points played", "002", 50000),
  C("second_serve_points_won", "Second-serve points won", "002", 50000),
  C("aces", "Aces", "002", 10000),
  C("double_faults", "Double faults", "002", 10000),
  C("service_games", "Service games played", "002", 20000),
  C("service_games_won", "Service games won", "002", 20000),
  C("break_points_faced", "Break points faced", "002", 20000),
  C("break_points_saved", "Break points saved", "002", 20000),
  P("first_serve_in_pct", "First-serve in %", "002"),
  P("first_serve_points_won_pct", "First-serve points won %", "002"),
  P("second_serve_points_won_pct", "Second-serve points won %", "002"),
  P("service_points_won_pct", "Service points won %", "002"),
  P("hold_pct", "Hold %", "002"),
  P("ace_rate_pct", "Ace rate %", "002"),
  P("double_fault_rate_pct", "Double-fault rate %", "002"),
  P("break_points_saved_pct", "Break points saved %", "002"),
  { key: "ace_to_df_ratio", label: "Ace : double-fault ratio", unit: "RATIO", family: "002", min: 0, max: 100 },

  // --- 003 Return Profile ---
  C("return_points", "Return points played", "003", 50000),
  C("return_points_won", "Return points won", "003", 50000),
  C("return_games", "Return games played", "003", 20000),
  C("return_games_won", "Return games won (breaks)", "003", 20000),
  C("break_points_opportunities", "Break-point opportunities", "003", 20000),
  C("break_points_converted", "Break points converted", "003", 20000),
  P("return_points_won_pct", "Return points won %", "003"),
  P("first_serve_return_points_won_pct", "First-serve return points won %", "003"),
  P("second_serve_return_points_won_pct", "Second-serve return points won %", "003"),
  P("break_pct", "Break %", "003"),
  P("break_point_conversion_pct", "Break-point conversion %", "003"),
  { key: "break_points_created_per_return_game", label: "Break points created per return game", unit: "RATIO", family: "003", min: 0, max: 6 },

  // --- 004 Required derived metrics ---
  P("total_points_won_pct", "Total points won %", "004"),
  { key: "dominance_ratio", label: "Dominance ratio", unit: "RATIO", family: "004", min: 0, max: 10 },
  { key: "serve_return_spread", label: "Serve minus return points won", unit: "PERCENT", family: "004", min: -100, max: 100 },

  // --- 008 Set Profile / 010 straight sets ---
  C("sets_played", "Sets played", "008", 5000),
  C("sets_won", "Sets won", "008", 5000),
  P("set_win_pct", "Set win %", "008"),
  C("matches_won", "Matches won", "010", 2000),
  C("straight_set_wins", "Straight-set wins", "010", 2000),
  P("straight_set_win_pct", "Straight-set win % (of wins)", "010"),

  // --- 009 Comeback / pressure ---
  C("deciding_sets_played", "Deciding sets played", "009", 2000),
  C("deciding_sets_won", "Deciding sets won", "009", 2000),
  P("deciding_set_win_pct", "Deciding-set win %", "009"),
  C("tiebreaks_played", "Tiebreaks played", "009", 2000),
  C("tiebreaks_won", "Tiebreaks won", "009", 2000),
  P("tiebreak_win_pct", "Tiebreak win %", "009"),

  // --- 012 Fatigue / workload ---
  C("matches_last_28_days", "Matches in last 28 days", "012", 60),
  { key: "minutes_last_28_days", label: "Court minutes in last 28 days", unit: "MINUTES", family: "012", min: 0, max: 20000 },
  { key: "avg_match_minutes", label: "Average match minutes", unit: "MINUTES", family: "012", min: 20, max: 400 },
  C("days_since_last_match", "Days since last match", "012", 5000),
  C("recent_inter_match_gap_days", "Recent inter-match gap (days)", "012", 5000),

  // --- 013 Availability / layoff context ---
  C("longest_observed_layoff_days", "Longest observed layoff (days)", "013", 5000),
  C("observed_layoffs_30d_plus", "Observed layoffs 30+ days", "013", 500),
  C("observed_layoffs_60d_plus", "Observed layoffs 60+ days", "013", 500),
  C("observed_layoffs_90d_plus", "Observed layoffs 90+ days", "013", 500),
  P("return_after_layoff_win_pct", "Win % in first matches after 45+ day layoff", "013"),

  // --- 014 Ranking context ---
  C("wins", "Wins (window)", "014", 2000),
  C("losses", "Losses (window)", "014", 2000),
  C("matches_played", "Matches played (window)", "014", 4000),
  P("win_pct", "Win %", "014"),
  { key: "ranking", label: "Ranking", unit: "COUNT", family: "014", min: 1, max: 3000 },
  { key: "peak_ranking", label: "Peak ranking", unit: "COUNT", family: "014", min: 1, max: 3000 },
  { key: "ranking_gap_to_peak", label: "Ranking gap to peak", unit: "COUNT", family: "014", min: -3000, max: 3000 },

  // --- 080 Common opponents ---
  C("common_opponent_wins", "Wins vs common opponents", "080", 500),
  C("common_opponent_losses", "Losses vs common opponents", "080", 500),
  P("common_opponent_win_pct", "Common-opponent win %", "080"),
];

export const STAT_BY_KEY = new Map(STAT_CATALOG.map((s) => [s.key, s]));
export function familyOf(key: string): string | null { return STAT_BY_KEY.get(key)?.family ?? null; }
