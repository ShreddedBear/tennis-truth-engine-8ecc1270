import { computeHistoricalScoreProfileStatsFromRows, type Row as DataHubRow } from "./datahub-atp-score-profile.server";
import { repositoryResultsRows, type RepositoryResultsObservation } from "./repository-results-history.server";
import { classifyEvidenceTourFamily } from "./evidence-match-identity";
import type { SourcedStat } from "./reconstruction/engine";

// Metrics 010/011 gate on a narrow, deliberately-strict field set (STRICT_FIELDS in
// completion-sweep-research.server.ts: straight_set_match_win_pct, performance_variance,
// close_match_dependency_pct, deciding_tiebreak_win_reliance_pct, etc.) that only
// datahub-atp-score-profile.server.ts's computeHistoricalScoreProfileStatsFromRows
// actually computes -- and that file is ATP-only (DataHub's own dataset). A generic
// substitute (e.g. predixsport's straight_set_win_pct) is correctly rejected by that
// guard, since its denominator/definition genuinely differs -- see
// postfix-wiring-007-011.test.ts's "010 rejects conditional straight-set rate".
//
// Rather than duplicate those formulas against a second data shape (real risk of a subtly
// different result the strict-field guard couldn't tell apart from the real thing), this
// converts repository-results-history.server.ts rows (which already cover WTA_MAIN and
// ATP_CHALLENGER with real per-set scores, per docs/audit-task-new-batch1-step0.md) into
// the EXACT synthetic CSV-row shape computeHistoricalScoreProfileStatsFromRows already
// consumes, and calls that same, already-tested function unchanged. ATP_MAIN and
// WTA_CHALLENGER genuinely lack per-set scores at the source and correctly get nothing
// from this path, same as 027/029/045.
function synthesizeDataHubRow(o: RepositoryResultsObservation): DataHubRow | null {
  const detail = (o.raw_payload as { history_detail?: { set_scores?: Array<[number, number]> } }).history_detail;
  const setScores = detail?.set_scores;
  if (!setScores || !setScores.length) return null;
  const winner = (o.raw_payload as { winner?: string | null }).winner ?? null;
  if (winner !== o.player_name && winner !== o.opponent_name) return null;
  const playerWon = winner === o.player_name;
  // set_scores is already player-oriented ([this player's games, opponent's games] per
  // set). DataHub's match_score_tiebreaks convention lists the WINNER's games first, so
  // flip each pair when the queried player lost.
  const winnerOrientedSets = setScores.map(([a, b]) => (playerWon ? [a, b] : [b, a]) as [number, number]);
  if (winnerOrientedSets.some(([a, b]) => !Number.isFinite(a) || !Number.isFinite(b))) return null;
  const winnerSetsWon = winnerOrientedSets.filter(([a, b]) => a > b).length;
  const loserSetsWon = winnerOrientedSets.filter(([a, b]) => a < b).length;
  const year = (o.event_date ?? "").slice(0, 4);
  if (!/^\d{4}$/.test(year)) return null;
  return {
    tourney_year_id: `${year}-repo`,
    winner_name: winner!,
    loser_name: playerWon ? (o.opponent_name ?? "") : o.player_name,
    match_score_tiebreaks: winnerOrientedSets.map(([a, b]) => `${a}-${b}`).join(" "),
    winner_sets_won: String(winnerSetsWon),
    loser_sets_won: String(loserSetsWon),
  };
}

const FAMILIES_WITH_SET_SCORES = ["WTA_MAIN", "ATP_CHALLENGER"] as const;

function mean(a: number[]): number | null { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; }
// Sample standard deviation (n-1 divisor), matching predixsport-derived.server.ts's own
// sd() exactly -- these two producers feed the same metric 011 fields, so the two tour
// paths must use the same statistical convention to be comparable.
function sd(a: number[]): number | null { const m = mean(a); return m === null || a.length < 2 ? null : Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); }

// predixsport-derived.server.ts computes performance_variance/performance_floor_ceiling_
// set_margin_range from each match's set-margin (sets won minus sets lost) over the most
// recent 20 matches, but that producer is ATP-only (falls back to runtime-tennis-index.server.ts
// for other tours, which only has aggregated buckets -- no per-match set margins to compute
// this from). Repository rows already carry set_scores for WTA_MAIN/ATP_CHALLENGER, so the
// same two fields can be computed here with the identical formula and window.
function repositorySetMarginStats(player: string, family: string, asOfDate: string): SourcedStat[] {
  const rows = repositoryResultsRows(player, family as Parameters<typeof repositoryResultsRows>[1], asOfDate, { strictBefore: true })
    .filter((o) => o.event_date)
    .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));
  const recent = rows.slice(-20);
  const margins = recent.map((o) => {
    const detail = (o.raw_payload as { history_detail?: { set_scores?: Array<[number, number]> } }).history_detail;
    const setScores = detail?.set_scores;
    if (!setScores || !setScores.length) return null;
    const won = setScores.filter(([a, b]) => a > b).length, lost = setScores.filter(([a, b]) => a < b).length;
    return won - lost;
  }).filter((x): x is number => x !== null);
  if (!margins.length) return [];
  const out: SourcedStat[] = [];
  const variance = sd(margins);
  if (variance !== null) out.push({ key: "performance_variance", player, value: variance, surface: null, window: "PRE_MATCH_HISTORY", tour_level: null, sample: margins.length, origin: "RECONSTRUCTED", sources: [{ source_name: `Repository ${family} history (set-margin variance)`, url: "", retrieved_at: new Date().toISOString() }] });
  out.push({ key: "performance_floor_ceiling_set_margin_range", player, value: Math.max(...margins) - Math.min(...margins), surface: null, window: "PRE_MATCH_HISTORY", tour_level: null, sample: margins.length, origin: "RECONSTRUCTED", sources: [{ source_name: `Repository ${family} history (set-margin variance)`, url: "", retrieved_at: new Date().toISOString() }] });
  return out;
}

export function getRepositoryScoreProfileStats(player: string, context: string): SourcedStat[] {
  const family = classifyEvidenceTourFamily(context);
  if (!family || !(FAMILIES_WITH_SET_SCORES as readonly string[]).includes(family)) return [];
  const cutoffMatch = context.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i);
  const asOfDate = cutoffMatch?.[1];
  if (!asOfDate) return [];
  const rawRows = repositoryResultsRows(player, family, asOfDate, { strictBefore: true });
  const synthRows = rawRows.map(synthesizeDataHubRow).filter((r): r is DataHubRow => r !== null);
  const profileStats = synthRows.length ? computeHistoricalScoreProfileStatsFromRows(synthRows, player, `date ${asOfDate}`)
    .map((s) => ({ ...s, sources: [{ source_name: `Repository ${family} history (set-score profile)`, url: "", retrieved_at: new Date().toISOString() }] })) : [];
  return [...profileStats, ...repositorySetMarginStats(player, family, asOfDate)];
}
