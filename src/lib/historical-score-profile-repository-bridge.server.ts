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

export function getRepositoryScoreProfileStats(player: string, context: string): SourcedStat[] {
  const family = classifyEvidenceTourFamily(context);
  if (!family || !(FAMILIES_WITH_SET_SCORES as readonly string[]).includes(family)) return [];
  const cutoffMatch = context.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i);
  const asOfDate = cutoffMatch?.[1];
  if (!asOfDate) return [];
  const rows = repositoryResultsRows(player, family, asOfDate, { strictBefore: true })
    .map(synthesizeDataHubRow)
    .filter((r): r is DataHubRow => r !== null);
  if (!rows.length) return [];
  const stats = computeHistoricalScoreProfileStatsFromRows(rows, player, `date ${asOfDate}`);
  return stats.map((s) => ({ ...s, sources: [{ source_name: `Repository ${family} history (set-score profile)`, url: "", retrieved_at: new Date().toISOString() }] }));
}
