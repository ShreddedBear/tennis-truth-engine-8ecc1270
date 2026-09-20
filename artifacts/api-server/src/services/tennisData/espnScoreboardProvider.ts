import { ProviderUnavailableError, type Fixture, type LiveScore, type MatchFormat } from "./types.js";
import { inferSurfaceAndLevel } from "./surfaceMap.js";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/tennis";
const ESPN_TIMEOUT_MS = 10_000;

type EspnState = "pre" | "in" | "post";

interface EspnCompetitor {
  id?: string;
  order?: number;
  athlete?: { displayName?: string; fullName?: string };
  linescores?: Array<{ value?: number }>;
}

interface EspnCompetition {
  id?: string;
  date?: string;
  startDate?: string;
  timeValid?: boolean;
  status?: { type?: { state?: EspnState; description?: string; detail?: string } };
  format?: { regulation?: { periods?: number } };
  competitors?: EspnCompetitor[];
  round?: { displayName?: string };
}

interface EspnEvent {
  name?: string;
  groupings?: Array<{
    grouping?: { slug?: string };
    competitions?: EspnCompetition[];
  }>;
}

interface EspnScoreboard {
  events?: EspnEvent[];
}

function compactDate(date: string): string {
  return date.replaceAll("-", "");
}

function fixtureId(league: "atp" | "wta", competitionId: string): string {
  return `espn-${league}-${competitionId}`;
}

function orderedCompetitors(competition: EspnCompetition): [EspnCompetitor, EspnCompetitor] | null {
  const competitors = [...(competition.competitors ?? [])]
    .filter((entry) => entry.id && (entry.athlete?.displayName || entry.athlete?.fullName))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  return competitors.length === 2 ? [competitors[0], competitors[1]] : null;
}

function matchFormat(competition: EspnCompetition): MatchFormat | null {
  const periods = competition.format?.regulation?.periods;
  if (periods === 5) return "BestOf5";
  if (periods === 3) return "BestOf3";
  return null;
}

async function fetchLeagueScoreboard(
  league: "atp" | "wta",
  dateStart: string,
  dateStop: string,
): Promise<EspnScoreboard> {
  const dates = `${compactDate(dateStart)}-${compactDate(dateStop)}`;
  const response = await fetch(`${ESPN_BASE}/${league}/scoreboard?dates=${dates}`, {
    headers: { Accept: "application/json", "User-Agent": "TennisMatrixAI/1.0" },
    signal: AbortSignal.timeout(ESPN_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`ESPN ${league.toUpperCase()} scoreboard HTTP ${response.status}`);
  }
  return response.json() as Promise<EspnScoreboard>;
}

async function fetchScoreboards(
  dateStart: string,
  dateStop: string,
): Promise<Array<{ league: "atp" | "wta"; data: EspnScoreboard }>> {
  const attempts = await Promise.allSettled([
    fetchLeagueScoreboard("atp", dateStart, dateStop),
    fetchLeagueScoreboard("wta", dateStart, dateStop),
  ]);
  const scoreboards: Array<{ league: "atp" | "wta"; data: EspnScoreboard }> = [];
  if (attempts[0].status === "fulfilled") scoreboards.push({ league: "atp", data: attempts[0].value });
  if (attempts[1].status === "fulfilled") scoreboards.push({ league: "wta", data: attempts[1].value });
  if (scoreboards.length === 0) {
    const reasons = attempts
      .map((result) => result.status === "rejected" ? String(result.reason) : null)
      .filter(Boolean)
      .join("; ");
    throw new ProviderUnavailableError(`ESPN tennis scoreboard unavailable: ${reasons}`);
  }
  return scoreboards;
}

function competitions(data: EspnScoreboard): Array<{ tournamentName: string | null; competition: EspnCompetition }> {
  const rows: Array<{ tournamentName: string | null; competition: EspnCompetition }> = [];
  for (const event of data.events ?? []) {
    for (const grouping of event.groupings ?? []) {
      if (!grouping.grouping?.slug?.includes("singles")) continue;
      for (const competition of grouping.competitions ?? []) {
        rows.push({ tournamentName: event.name ?? null, competition });
      }
    }
  }
  return rows;
}

export async function fetchEspnFixturesRange(dateStart: string, dateStop: string): Promise<Fixture[]> {
  const scoreboards = await fetchScoreboards(dateStart, dateStop);
  const fixtures: Fixture[] = [];

  for (const { league, data } of scoreboards) {
    for (const { tournamentName, competition } of competitions(data)) {
      const id = competition.id;
      const scheduledStart = competition.startDate ?? competition.date ?? null;
      const date = scheduledStart?.slice(0, 10);
      const state = competition.status?.type?.state;
      const players = orderedCompetitors(competition);
      if (!id || !date || date < dateStart || date > dateStop || !players) continue;
      if (state !== "pre" && state !== "in") continue;

      const [player1, player2] = players;
      const inferred = tournamentName ? inferSurfaceAndLevel(tournamentName) : { surface: null, level: null };
      fixtures.push({
        id: fixtureId(league, id),
        date,
        scheduledStart,
        timeConfirmed: competition.timeValid === true && scheduledStart !== null,
        isLive: state === "in",
        tournamentName,
        tournamentLevel: inferred.level,
        round: competition.round?.displayName ?? null,
        surface: inferred.surface,
        indoor: inferred.surface === "IndoorHard" ? true : null,
        matchFormat: matchFormat(competition),
        player1Id: `espn-player-${player1.id}`,
        player1Name: player1.athlete?.displayName ?? player1.athlete?.fullName ?? "",
        player2Id: `espn-player-${player2.id}`,
        player2Name: player2.athlete?.displayName ?? player2.athlete?.fullName ?? "",
      });
    }
  }

  return fixtures;
}

export async function fetchEspnLiveScores(fixtureIds: string[], nowMs = Date.now()): Promise<Map<string, LiveScore>> {
  const requested = new Set(fixtureIds.filter((id) => id.startsWith("espn-")));
  const scores = new Map<string, LiveScore>();
  if (requested.size === 0) return scores;

  const start = new Date(nowMs - 86_400_000).toISOString().slice(0, 10);
  const stop = new Date(nowMs + 86_400_000).toISOString().slice(0, 10);
  const scoreboards = await fetchScoreboards(start, stop);

  for (const { league, data } of scoreboards) {
    for (const { competition } of competitions(data)) {
      if (!competition.id) continue;
      const id = fixtureId(league, competition.id);
      if (!requested.has(id)) continue;
      const players = orderedCompetitors(competition);
      if (!players) continue;
      const [player1, player2] = players;
      const setCount = Math.max(player1.linescores?.length ?? 0, player2.linescores?.length ?? 0);
      const sets = Array.from({ length: setCount }, (_, index) => ({
        player1Games: player1.linescores?.[index]?.value ?? 0,
        player2Games: player2.linescores?.[index]?.value ?? 0,
      }));
      scores.set(id, {
        sets,
        statusText: competition.status?.type?.detail ?? competition.status?.type?.description ?? null,
      });
    }
  }

  return scores;
}