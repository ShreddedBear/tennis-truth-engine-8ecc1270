import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertObservationFamily } from "../metric-source-family-policy";

const db = supabaseAdmin as any;
const WTA_TOURNAMENT_API = "https://api.wtatennis.com/tennis/tournaments";
const SOURCE_NAME = "WTA Official";

type Target = {
  id: string;
  target_key: string;
  pullback_start: string | null;
  pullback_end: string | null;
};

type Observation = {
  source_id: "wta";
  source_name: string;
  source_url: string;
  source_record_key: string;
  player_name: string;
  opponent_name: string;
  tournament: string | null;
  event_date: string | null;
  surface: string | null;
  observation_type: "MATCH_RESULT_OR_SCHEDULE";
  observation_key: "match_record";
  text_value: string;
  numeric_value: null;
  sample_label: string | null;
  window_start: string | null;
  window_end: string | null;
  raw_payload: unknown;
  provenance: Record<string, unknown>;
};

type TournamentEdition = {
  groupId: number;
  year: number;
  title: string;
  level: string;
  surface: string | null;
};

function yearsFor(target: Target) {
  const now = new Date().getUTCFullYear();
  const start = Number((target.pullback_start ?? `${now}-01-01`).slice(0, 4));
  const end = Number((target.pullback_end ?? `${now}-12-31`).slice(0, 4));
  const lo = Number.isFinite(start) ? Math.min(start, end) : now;
  const hi = Number.isFinite(end) ? Math.max(start, end) : now;
  const years: number[] = [];
  for (let year = lo; year <= hi; year++) years.push(year);
  return years;
}

function isWtaMainLevel(level: string | null | undefined) {
  if (!level) return false;
  const normalized = level.replace(/[_-]+/g, " ").trim();
  if (/(^|\D)125\s*k?\b|wta\s*125|challenger|itf/i.test(normalized)) return false;
  return /grand\s*slam|tour\s*finals|wta\s*finals|1000|500|250|premier|international|wta/i.test(normalized);
}

async function requestJson(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      accept: "application/json,text/plain,*/*",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function dateOnly(value: unknown) {
  const text = asText(value);
  if (!text) return null;
  const match = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

async function discoverEditions(target: Target) {
  const allowedYears = new Set(yearsFor(target));
  const editions = new Map<string, TournamentEdition>();
  const pageSize = 100;
  let expectedPages = 1;
  let pagesRead = 0;
  let objectsSeen = 0;

  for (let page = 0; page < expectedPages && page < 250; page++) {
    const url = `${WTA_TOURNAMENT_API}?page=${page}&pageSize=${pageSize}`;
    const payload = asObject(await requestJson(url));
    if (!payload) throw new Error(`WTA tournament index was not an object: ${url}`);
    const content = Array.isArray(payload.content) ? payload.content : [];
    pagesRead++;
    objectsSeen += content.length;

    for (const value of content) {
      const row = asObject(value);
      if (!row) continue;
      const group = asObject(row.tournamentGroup);
      const level = asText(group?.level ?? row.level);
      const year = Number(asText(row.year));
      const groupId = Number(asText(group?.id));
      if (!Number.isFinite(year) || !allowedYears.has(year) || !Number.isFinite(groupId) || groupId <= 0 || !isWtaMainLevel(level)) continue;
      const title = asText(row.title) || asText(group?.name) || `WTA ${groupId}`;
      editions.set(`${groupId}:${year}`, { groupId, year, title, level: level!, surface: asText(row.surface) });
    }

    const pageInfo = asObject(payload.pageInfo);
    const entries = Number(asText(pageInfo?.numEntries ?? pageInfo?.totalEntries));
    const reportedSize = Number(asText(pageInfo?.pageSize));
    if (Number.isFinite(entries) && entries > 0) expectedPages = Math.min(250, Math.ceil(entries / (Number.isFinite(reportedSize) && reportedSize > 0 ? reportedSize : pageSize)));
    if (!content.length) break;
  }

  return { editions: [...editions.values()], pagesRead, objectsSeen };
}

function playerName(match: Record<string, unknown>, side: "A" | "B") {
  const first = asText(match[`PlayerNameFirst${side}`]);
  const last = asText(match[`PlayerNameLast${side}`]);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || null;
}

function setsWon(match: Record<string, unknown>, side: "A" | "B") {
  let won = 0;
  const other = side === "A" ? "B" : "A";
  for (let set = 1; set <= 5; set++) {
    const own = Number(asText(match[`ScoreSet${set}${side}`]));
    const opp = Number(asText(match[`ScoreSet${set}${other}`]));
    if (Number.isFinite(own) && Number.isFinite(opp) && own > opp) won++;
  }
  return won;
}

function normalizeMatches(target: Target, edition: TournamentEdition, url: string, payload: unknown) {
  const root = asObject(payload);
  if (!root) throw new Error(`WTA match endpoint was not an object: ${url}`);
  const tournament = asObject(root.tournament);
  const returnedGroup = asObject(tournament?.tournamentGroup);
  const returnedGroupId = Number(asText(returnedGroup?.id));
  const returnedYear = Number(asText(tournament?.year));
  const level = asText(returnedGroup?.level ?? tournament?.level);

  if (returnedGroupId !== edition.groupId || returnedYear !== edition.year) throw new Error(`WTA match endpoint identity mismatch for ${edition.groupId}/${edition.year}`);
  if (!isWtaMainLevel(level)) throw new Error(`WTA Main firewall rejected level ${level ?? "missing"} for ${edition.groupId}/${edition.year}`);

  const tournamentName = asText(tournament?.title) || edition.title;
  const surface = asText(tournament?.surface) || edition.surface;
  const matches = Array.isArray(root.matches) ? root.matches : [];
  const rows: Observation[] = [];

  for (const value of matches) {
    const match = asObject(value);
    if (!match) continue;
    if (asText(match.DrawMatchType) !== "S") continue;
    const playerA = playerName(match, "A");
    const playerB = playerName(match, "B");
    if (!playerA || !playerB) continue;
    const matchId = asText(match.MatchID);
    if (!matchId) continue;
    const eventYear = Number(asText(match.EventYear));
    const eventId = Number(asText(match.EventID));
    if (eventYear !== edition.year || eventId !== edition.groupId) continue;

    const aSets = setsWon(match, "A");
    const bSets = setsWon(match, "B");
    const winnerName = aSets > bSets ? playerA : bSets > aSets ? playerB : null;
    const eventDate = dateOnly(match.MatchTimeStamp);
    const score = asText(match.ScoreString);
    const result = asText(match.ResultString);
    const round = asText(match.RoundID) || asText(match.DrawLevelType);
    const payloadText = JSON.stringify({
      player1: playerA,
      player2: playerB,
      player1_id: asText(match.PlayerIDA),
      player2_id: asText(match.PlayerIDB),
      round,
      status: asText(match.MatchState),
      score,
      result,
      winner: winnerName,
      competition_level: level,
      tournament_group_id: edition.groupId,
      event_year: edition.year,
    });
    const common = {
      source_id: "wta" as const,
      source_name: SOURCE_NAME,
      source_url: url,
      tournament: tournamentName,
      event_date: eventDate,
      surface,
      observation_type: "MATCH_RESULT_OR_SCHEDULE" as const,
      observation_key: "match_record" as const,
      text_value: payloadText,
      numeric_value: null,
      sample_label: round,
      window_start: target.pullback_start,
      window_end: target.pullback_end,
      raw_payload: match,
      provenance: {
        target_key: target.target_key,
        tour: "wta",
        competition_level: level,
        tournament_group_id: edition.groupId,
        event_year: edition.year,
        extraction: "official_wta_tournament_match_api",
      },
    };
    rows.push({ ...common, source_record_key: `${target.target_key}:${edition.year}:${edition.groupId}:${matchId}:A`, player_name: playerA, opponent_name: playerB });
    rows.push({ ...common, source_record_key: `${target.target_key}:${edition.year}:${edition.groupId}:${matchId}:B`, player_name: playerB, opponent_name: playerA });
  }

  return { rows, matchesSeen: matches.length };
}

async function persistRows(rows: Observation[]) {
  for (const row of rows) assertObservationFamily(row, "RESULTS_SCHEDULE");
  let persisted = 0;
  for (let offset = 0; offset < rows.length; offset += 500) {
    const chunk = rows.slice(offset, offset + 500);
    const { error } = await db.from("source_observations").upsert(chunk, { onConflict: "source_id,source_record_key", ignoreDuplicates: true });
    if (error) throw error;
    for (let confirmOffset = 0; confirmOffset < chunk.length; confirmOffset += 50) {
      const keys = chunk.slice(confirmOffset, confirmOffset + 50).map((row) => row.source_record_key);
      const { data, error: confirmError } = await db.from("source_observations").select("source_record_key").eq("source_id", "wta").in("source_record_key", keys);
      if (confirmError) throw confirmError;
      persisted += new Set((data ?? []).map((row: any) => row.source_record_key)).size;
    }
  }
  return persisted;
}

export async function ingestWtaOfficialMatchResults() {
  const { data: targets, error } = await db.from("ingestion_targets").select("id,target_key,pullback_start,pullback_end").eq("source_id", "wta").eq("enabled", true);
  if (error) throw error;

  let pagesRead = 0;
  let structuredObjectsSeen = 0;
  let matchObjectsSeen = 0;
  let observationsWritten = 0;
  let tournamentEditions = 0;

  for (const target of (targets ?? []) as Target[]) {
    const discovered = await discoverEditions(target);
    pagesRead += discovered.pagesRead;
    structuredObjectsSeen += discovered.objectsSeen;
    tournamentEditions += discovered.editions.length;

    for (let offset = 0; offset < discovered.editions.length; offset += 6) {
      const batch = discovered.editions.slice(offset, offset + 6);
      const results = await Promise.all(batch.map(async (edition) => {
        const url = `${WTA_TOURNAMENT_API}/${edition.groupId}/${edition.year}/matches`;
        const normalized = normalizeMatches(target, edition, url, await requestJson(url));
        return { normalized, url };
      }));
      for (const { normalized } of results) {
        matchObjectsSeen += normalized.matchesSeen;
        observationsWritten += await persistRows(normalized.rows);
      }
    }
  }

  return {
    source: "wta",
    source_name: SOURCE_NAME,
    targets: targets?.length ?? 0,
    tournament_index_pages_read: pagesRead,
    tournament_objects_seen: structuredObjectsSeen,
    tournament_editions_fetched: tournamentEditions,
    match_objects_seen: matchObjectsSeen,
    observations_written: observationsWritten,
  };
}
