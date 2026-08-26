import runtimeIndex from "@/generated/tennis-runtime-index";
import { evidencePairMatches, normalizeEvidenceIdentity } from "./evidence-player-alias";
import { normalizeEvidenceTournament, type EvidenceTourFamily } from "./evidence-match-identity";

export type RepositoryResultsObservation = {
  source_id: string; source_name: string; source_url: null; player_name: string; opponent_name: string | null; tournament: string | null; event_date: string | null; surface: string | null; observation_type: "MATCH_RESULT_OR_SCHEDULE"; observation_key: "match_record"; text_value: string; sample_label: string | null; raw_payload: Record<string, unknown>; provenance: Record<string, unknown>;
};
type HistoryDetails={sets_for?:number|null;sets_against?:number|null;set_scores?:Array<[number,number]>;best_of?:number|null;opponent_rank?:number|null;opponent_elo?:number|null;status?:string|null;raw_score?:string|null};
type HistoryEntry = [unknown, unknown, unknown, unknown, unknown, unknown, unknown, HistoryDetails?];
const FAMILIES: EvidenceTourFamily[] = ["ATP_MAIN", "WTA_MAIN", "ATP_CHALLENGER", "WTA_CHALLENGER"];
function sourceId(family: EvidenceTourFamily) {switch (family) {case "ATP_MAIN": return "atp";case "WTA_MAIN": return "wta";case "ATP_CHALLENGER": return "atp_challenger";case "WTA_CHALLENGER": return "wta_challenger";}}
function historyRows(player: string, family: EvidenceTourFamily): HistoryEntry[] {const key = normalizeEvidenceIdentity(player);if (!key) return [];const rows = (runtimeIndex as any)?.matchHistory?.[family]?.[key];return Array.isArray(rows) ? rows as HistoryEntry[] : [];}
export function repositoryHistoryAvailable(player:string,family:EvidenceTourFamily){return historyRows(player,family).length>0;}

export function inferRepositoryMatchContext(args: { p1: string; p2: string; asOfDate: string; tournament?: string | null }) {
  const expectedTournament = normalizeEvidenceTournament(args.tournament);
  const found = new Map<string, { family: EvidenceTourFamily; date: string; tournament: string | null; surface: string | null; round: string | null }>();
  for (const family of FAMILIES) for (const entry of historyRows(args.p1, family)) {
    const [dateRaw, tournamentRaw, surfaceRaw, opponentRaw, , roundRaw] = entry;const date = String(dateRaw ?? "").slice(0, 10);const opponent = String(opponentRaw ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date !== args.asOfDate || !evidencePairMatches(args.p1, opponent, args.p1, args.p2)) continue;
    const tournament = String(tournamentRaw ?? "").trim() || null;const normalizedTournament = normalizeEvidenceTournament(tournament);if (expectedTournament && normalizedTournament && expectedTournament !== normalizedTournament) continue;
    const round = String(roundRaw ?? "").trim() || null;const surface = String(surfaceRaw ?? "").trim() || null;found.set(`${family}|${normalizedTournament}|${date}|${round ?? ""}`, { family, date, tournament, surface, round });
  }
  if (found.size !== 1) return null;const row = [...found.values()][0];const level = row.family.replaceAll("_", " ");return [`Tournament: ${row.tournament ?? args.tournament ?? "unknown"}`, `Level: ${level}`, `Tour: ${level}`, row.surface ? `Surface: ${row.surface}` : null, `Date: ${row.date}`, row.round ? `Round: ${row.round}` : null].filter(Boolean).join(" | ");
}

export function repositoryResultsRows(player: string, family: EvidenceTourFamily, asOfDate: string, options:{strictBefore?:boolean}={}): RepositoryResultsObservation[] {
  const rows = historyRows(player, family);if (!rows.length) return [];const out: RepositoryResultsObservation[] = [];
  for (const entry of rows) {
    const [dateRaw, tournamentRaw, surfaceRaw, opponentRaw, wonRaw, roundRaw, sourceRaw, detailRaw] = entry;const date = String(dateRaw ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (options.strictBefore ? date >= asOfDate : date > asOfDate)) continue;
    const opponent = String(opponentRaw ?? "").trim();if (!opponent) continue;const won = wonRaw === 1 ? true : wonRaw === 0 ? false : null;const winner = won === true ? player : won === false ? opponent : null;
    const tournament = String(tournamentRaw ?? "").trim() || null;const surface = String(surfaceRaw ?? "").trim() || null;const round = String(roundRaw ?? "").trim() || null;const source = String(sourceRaw ?? "").trim() || `Repository ${family} history`;const history_detail=(detailRaw&&typeof detailRaw==="object"?detailRaw:{}) as HistoryDetails;
    const payload = { winner, round, tour_family: family, repository_history: true, history_detail };
    out.push({source_id: sourceId(family),source_name: source,source_url: null,player_name: player,opponent_name: opponent,tournament,event_date: date,surface,observation_type: "MATCH_RESULT_OR_SCHEDULE",observation_key: "match_record",text_value: JSON.stringify(payload),sample_label: round,raw_payload: payload,provenance: { repository_history: true, tour_family: family, strict_before_target: Boolean(options.strictBefore), raw_score_preserved: history_detail.raw_score != null }});
  }
  return out;
}
