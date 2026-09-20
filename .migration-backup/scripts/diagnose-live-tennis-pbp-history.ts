// READ-ONLY diagnostic for Live Tennis API historical point-by-point coverage.
// Tests three completed matches per calendar year without printing credentials
// or raw point payloads.

const BASE = "https://api.livetennisapi.com/api/public/v1";
const START_YEAR = 2026;
const END_YEAR = 2010;
const SAMPLE_SIZE = 3;
const TIMEOUT_MS = 15_000;
const REQUEST_DELAY_MS = 125;

type JsonObject = Record<string, any>;

type SafeResponse = {
  status: number | null;
  body: JsonObject | null;
  durationMs: number | null;
  error: string | null;
};

type Candidate = {
  id: string | number;
  date: string | null;
  tour: string | null;
  tournament: string | null;
  players: string[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function playerNames(row: JsonObject): string[] {
  if (Array.isArray(row.players)) {
    return row.players
      .map((player: unknown) => {
        if (typeof player === "string") return player;
        if (player && typeof player === "object") {
          const item = player as JsonObject;
          return text(item.name) ?? text(item.full_name);
        }
        return null;
      })
      .filter((name: string | null): name is string => Boolean(name))
      .slice(0, 2);
  }
  if (row.players && typeof row.players === "object") {
    return [row.players.p1, row.players.p2]
      .map((player: unknown) => {
        if (typeof player === "string") return player;
        if (player && typeof player === "object") {
          const item = player as JsonObject;
          return text(item.name) ?? text(item.full_name);
        }
        return null;
      })
      .filter((name: string | null): name is string => Boolean(name));
  }
  return [text(row.winner?.name), text(row.loser?.name)].filter(
    (name: string | null): name is string => Boolean(name),
  );
}

function candidateFromRow(row: JsonObject, archive: boolean): Candidate | null {
  if (row.id === undefined || row.id === null) return null;
  return {
    id: row.id,
    date: text(archive ? row.event_date : row.scheduled_time),
    tour: text(row.tour),
    tournament:
      text(typeof row.tournament === "object" ? row.tournament?.name : row.tournament) ??
      null,
    players: playerNames(row),
  };
}

async function request(path: string, apiKey: string): Promise<SafeResponse> {
  const started = Date.now();
  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: {
        "X-API-Key": apiKey,
        "User-Agent": "tennis-truth-engine-history-diagnostic/1.0",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let body: JsonObject | null = null;
    try {
      const parsed = await response.json();
      body = parsed && typeof parsed === "object" ? (parsed as JsonObject) : null;
    } catch {
      // A non-JSON response is reported by shape, never printed.
    }
    return {
      status: response.status,
      body,
      durationMs: Date.now() - started,
      error: null,
    };
  } catch (error) {
    return {
      status: null,
      body: null,
      durationMs: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await sleep(REQUEST_DELAY_MS);
  }
}

function safeRestriction(body: JsonObject | null) {
  return {
    error: text(body?.error),
    capability: text(body?.capability),
    detail: text(body?.detail),
    upgradeTier: text(body?.upgrade_tier),
  };
}

async function listCandidates(
  year: number,
  apiKey: string,
): Promise<{ candidates: Candidate[]; response: SafeResponse; archive: boolean }> {
  const archive = year <= 2022;
  const endpoint = archive ? "/history/archive/matches" : "/history/matches";
  const response = await request(
    `${endpoint}?from=${year}-01-01&to=${year}-12-31&limit=${SAMPLE_SIZE}`,
    apiKey,
  );
  const rows = Array.isArray(response.body?.data) ? response.body.data : [];
  const candidates = rows
    .map((row: unknown) =>
      row && typeof row === "object" ? candidateFromRow(row as JsonObject, archive) : null,
    )
    .filter((row: Candidate | null): row is Candidate => Boolean(row))
    .slice(0, SAMPLE_SIZE);
  return { candidates, response, archive };
}

async function probeCandidate(
  year: number,
  candidate: Candidate,
  archive: boolean,
  apiKey: string,
) {
  const endpoint = archive
    ? `/history/archive/matches/${encodeURIComponent(String(candidate.id))}/tape`
    : `/history/matches/${encodeURIComponent(String(candidate.id))}`;
  const response = await request(endpoint, apiKey);
  const body = response.body;
  const tape = archive
    ? Array.isArray(body?.points)
      ? body.points
      : Array.isArray(body?.tape)
        ? body.tape
        : Array.isArray(body?.data?.points)
          ? body.data.points
          : null
    : Array.isArray(body?.tape)
      ? body.tape
      : null;
  const pointCount =
    typeof body?.meta?.points === "number"
      ? body.meta.points
      : Array.isArray(tape)
        ? tape.length
        : null;
  const hasPbp = response.status === 200 && pointCount !== null && pointCount > 0;
  const restriction = safeRestriction(body);
  const classification = hasPbp
    ? "PBP_VERIFIED"
    : response.status === 403 && restriction.error === "upgrade_required"
      ? "PLAN_RESTRICTED"
      : response.status === 404 || response.status === 410
        ? "PBP_NOT_FOUND"
        : response.status === 429
          ? "RATE_LIMITED"
          : response.status === 200
            ? "EMPTY_OR_UNUSABLE"
            : "REQUEST_FAILED";

  return {
    year,
    matchId: candidate.id,
    date: candidate.date,
    tour: candidate.tour,
    tournament: candidate.tournament,
    players: candidate.players,
    matchExists: true,
    endpoint,
    httpStatus: response.status,
    durationMs: response.durationMs,
    classification,
    pbpVerified: hasPbp,
    pointRows: pointCount,
    coverage: text(body?.meta?.coverage) ?? text(body?.coverage),
    pointSource: text(body?.meta?.point_source) ?? text(body?.basis),
    topLevelKeys: body ? Object.keys(body).slice(0, 15) : [],
    restriction:
      classification === "PLAN_RESTRICTED"
        ? restriction
        : null,
    error: response.error,
  };
}

async function main() {
  const apiKey = process.env.Live_Tennis_Api;
  console.log(`[live-tennis-pbp-history] Live_Tennis_Api present: ${Boolean(apiKey)}`);
  console.log(
    `[live-tennis-pbp-history] read-only test: ${SAMPLE_SIZE} completed matches/year, ${START_YEAR} through ${END_YEAR}`,
  );
  if (!apiKey) {
    throw new Error("Live_Tennis_Api is not configured.");
  }

  const summaries: Array<JsonObject> = [];
  for (let year = START_YEAR; year >= END_YEAR; year -= 1) {
    const listed = await listCandidates(year, apiKey);
    console.log(
      `[year ${year}] listing=${listed.archive ? "archive" : "current-history"} http=${listed.response.status ?? "NETWORK_ERROR"} candidates=${listed.candidates.length}/${SAMPLE_SIZE}`,
    );
    if (listed.candidates.length < SAMPLE_SIZE) {
      console.log(
        `[year ${year}] candidate_shortfall=${SAMPLE_SIZE - listed.candidates.length} restriction=${JSON.stringify(safeRestriction(listed.response.body))} error=${JSON.stringify(listed.response.error)}`,
      );
    }

    const results = [];
    for (const candidate of listed.candidates) {
      const result = await probeCandidate(year, candidate, listed.archive, apiKey);
      results.push(result);
      console.log(`[match] ${JSON.stringify(result)}`);
    }

    const verified = results.filter((result) => result.pbpVerified).length;
    const restricted = results.filter(
      (result) => result.classification === "PLAN_RESTRICTED",
    ).length;
    const unavailable = results.filter(
      (result) =>
        result.classification === "PBP_NOT_FOUND" ||
        result.classification === "EMPTY_OR_UNUSABLE",
    ).length;
    const failures = results.length - verified - restricted - unavailable;
    const summary = {
      year,
      candidates: listed.candidates.length,
      tested: results.length,
      pbpVerified: verified,
      planRestricted: restricted,
      unavailable,
      failures,
    };
    summaries.push(summary);
    console.log(`[year-summary] ${JSON.stringify(summary)}`);
  }

  const verifiedYears = summaries
    .filter((summary) => summary.pbpVerified > 0)
    .map((summary) => summary.year);
  const restrictedYears = summaries
    .filter((summary) => summary.planRestricted > 0)
    .map((summary) => summary.year);
  console.log("\n=== LIVE TENNIS PBP HISTORY SUMMARY ===");
  for (const summary of summaries) console.log(JSON.stringify(summary));
  console.log(
    JSON.stringify({
      testedYearRange: `${START_YEAR}-${END_YEAR}`,
      requestedSamplesPerYear: SAMPLE_SIZE,
      verifiedYears,
      earliestVerifiedYear: verifiedYears.length ? Math.min(...verifiedYears) : null,
      planRestrictedYears: restrictedYears,
      providerDocumentedBoundaries: {
        currentHistoryWithTape: "2023-present",
        reconstructedArchiveTape: "2013-2022 (requires ULTRA or any History plan)",
        resultsOnlyNoTape: "1968-2012",
      },
    }),
  );
}

main().catch((error) => {
  console.error(
    `[live-tennis-pbp-history] fatal: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});