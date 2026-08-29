// Live Supabase wrapper for metrics #036/#037 (Loss/Win Autopsy) and #039
// (Performance Surprise Rating). Pulls the audit DB's own
// parsed_summary_fields-scored, completed-match population and turns it
// into the pure ScoredOutcome/SurpriseInput shapes those modules already
// take -- see their headers for why this population is bounded to the
// audit DB and never extended to the four-tour historical index.
//
// Follows the same supabaseAdmin/ownerId/LOCAL_WORKSPACE_ID convention as
// audit-repo.server.ts, and the same summary_versions(match_id, is_active)
// -> parsed_summary_fields(summary_version_id) join it already uses for
// getParsedFields (not matches.active_summary_version_id, which
// calibration-matrix-autofill.ts uses for a different, single-match UI path).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LOCAL_WORKSPACE_ID } from "./constants";
import { isPredictionBeforeResult, isCloseMatch, type ScoredOutcome } from "./audit-metric-036-037-loss-win-autopsy";
import type { SurpriseInput } from "./audit-metric-039-performance-surprise";

const OWNER = LOCAL_WORKSPACE_ID;

function lastNameMatches(candidateName: string | null, fullName: string): boolean {
  if (!candidateName) return false;
  const lastName = fullName.trim().split(/\s+/).slice(-1)[0]?.toLowerCase();
  if (!lastName) return false;
  return candidateName.toLowerCase().includes(lastName);
}

interface ScoredMatchRow {
  final_score: string | null;
  best_of: number | null;
  actual_winner: string | null;
  player1_name: string;
  player2_name: string;
  result_recorded_at: string | null;
  matrixWp: number;
  matrixPredictedWinner: string;
  matrixWpCreatedAt: string;
}

/**
 * Loads every completed, TennisMatrixAi-scored match in the audit DB --
 * actual_winner populated AND a numeric matrix_wp/matrix_predicted_winner
 * recorded against its active summary version -- with the leakage guard
 * already applied (a matrix_wp field recorded on/after the match's own
 * result_recorded_at is dropped, never trusted as a genuine pre-match call).
 */
export async function loadAuditDbScoredMatches(): Promise<ScoredMatchRow[]> {
  const db = supabaseAdmin;
  const { data: matches, error: matchesError } = await db
    .from("matches")
    .select("id, final_score, best_of, actual_winner, player1_name, player2_name, result_recorded_at")
    .eq("user_id", OWNER)
    .not("actual_winner", "is", null);
  if (matchesError || !matches?.length) return [];

  const { data: versions, error: versionsError } = await db
    .from("summary_versions")
    .select("id, match_id")
    .eq("user_id", OWNER)
    .eq("is_active", true)
    .in("match_id", matches.map((m) => m.id));
  if (versionsError || !versions?.length) return [];
  const versionIdToMatchId = new Map(versions.map((v) => [v.id, v.match_id]));

  const { data: fields, error: fieldsError } = await db
    .from("parsed_summary_fields")
    .select("summary_version_id, field_key, normalized_value, created_at")
    .in("summary_version_id", versions.map((v) => v.id))
    .in("field_key", ["matrix_wp", "matrix_predicted_winner"]);
  if (fieldsError || !fields?.length) return [];

  const byMatch = new Map<string, { wp?: string; wpCreatedAt?: string; predictedWinner?: string }>();
  for (const f of fields) {
    const matchId = versionIdToMatchId.get(f.summary_version_id);
    if (!matchId) continue;
    const entry = byMatch.get(matchId) ?? {};
    if (f.field_key === "matrix_wp") { entry.wp = f.normalized_value ?? undefined; entry.wpCreatedAt = f.created_at; }
    if (f.field_key === "matrix_predicted_winner") entry.predictedWinner = f.normalized_value ?? undefined;
    byMatch.set(matchId, entry);
  }

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const out: ScoredMatchRow[] = [];
  for (const [matchId, entry] of byMatch) {
    const match = matchById.get(matchId);
    if (!match || !entry.wp || !entry.predictedWinner || !entry.wpCreatedAt) continue;
    const wp = Number(entry.wp);
    if (!Number.isFinite(wp)) continue; // never fabricate a probability from a malformed value
    if (!isPredictionBeforeResult(entry.wpCreatedAt, match.result_recorded_at)) continue; // leakage guard
    out.push({
      final_score: match.final_score, best_of: match.best_of, actual_winner: match.actual_winner,
      player1_name: match.player1_name, player2_name: match.player2_name, result_recorded_at: match.result_recorded_at,
      matrixWp: wp, matrixPredictedWinner: entry.predictedWinner, matrixWpCreatedAt: entry.wpCreatedAt,
    });
  }
  return out;
}

/** Converts a scored match row into #036/#037's ScoredOutcome, from the perspective of the player TennisMatrixAi favored. */
export function toScoredOutcome(row: ScoredMatchRow): ScoredOutcome {
  const playerWon = lastNameMatches(row.actual_winner, row.matrixPredictedWinner);
  return {
    playerWinProbabilityPct: row.matrixWp,
    playerWon,
    wasClose: isCloseMatch(row.final_score, row.best_of),
  };
}

/** Converts a scored match row into #039's SurpriseInput, from the same TennisMatrixAi-favored-player perspective. */
export function toSurpriseInput(row: ScoredMatchRow): SurpriseInput {
  return {
    playerWinProbabilityPct: row.matrixWp,
    playerWon: lastNameMatches(row.actual_winner, row.matrixPredictedWinner),
  };
}
