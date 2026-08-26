import runtimeIndex from "@/generated/tennis-runtime-index";
import { normalizeEvidenceIdentity } from "./evidence-player-alias";
import type { EvidenceTourFamily } from "./evidence-match-identity";

export type RepositoryResultsObservation = {
  source_id: string;
  source_name: string;
  source_url: null;
  player_name: string;
  opponent_name: string | null;
  tournament: string | null;
  event_date: string | null;
  surface: string | null;
  observation_type: "MATCH_RESULT_OR_SCHEDULE";
  observation_key: "match_record";
  text_value: string;
  sample_label: string | null;
  raw_payload: Record<string, unknown>;
  provenance: Record<string, unknown>;
};

function sourceId(family: EvidenceTourFamily) {
  switch (family) {
    case "ATP_MAIN": return "atp";
    case "WTA_MAIN": return "wta";
    case "ATP_CHALLENGER": return "atp_challenger";
    case "WTA_CHALLENGER": return "wta_challenger";
  }
}

export function repositoryResultsRows(player: string, family: EvidenceTourFamily, asOfDate: string): RepositoryResultsObservation[] {
  const key = normalizeEvidenceIdentity(player);
  if (!key) return [];
  const rows = (runtimeIndex as any)?.matchHistory?.[family]?.[key];
  if (!Array.isArray(rows)) return [];

  const out: RepositoryResultsObservation[] = [];
  for (const entry of rows as unknown[][]) {
    const [dateRaw, tournamentRaw, surfaceRaw, opponentRaw, wonRaw, roundRaw, sourceRaw] = entry;
    const date = String(dateRaw ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > asOfDate) continue;
    const opponent = String(opponentRaw ?? "").trim();
    if (!opponent) continue;
    const won = wonRaw === 1 ? true : wonRaw === 0 ? false : null;
    const winner = won === true ? player : won === false ? opponent : null;
    const tournament = String(tournamentRaw ?? "").trim() || null;
    const surface = String(surfaceRaw ?? "").trim() || null;
    const round = String(roundRaw ?? "").trim() || null;
    const source = String(sourceRaw ?? "").trim() || `Repository ${family} history`;
    const payload = { winner, round, tour_family: family, repository_history: true };
    out.push({
      source_id: sourceId(family),
      source_name: source,
      source_url: null,
      player_name: player,
      opponent_name: opponent,
      tournament,
      event_date: date,
      surface,
      observation_type: "MATCH_RESULT_OR_SCHEDULE",
      observation_key: "match_record",
      text_value: JSON.stringify(payload),
      sample_label: round,
      raw_payload: payload,
      provenance: { repository_history: true, tour_family: family },
    });
  }
  return out;
}
