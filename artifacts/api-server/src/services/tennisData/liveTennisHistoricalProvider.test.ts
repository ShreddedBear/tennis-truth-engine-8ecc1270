import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  compareHistoricalFixtures,
  LiveTennisHistoricalProvider,
  normalizeLiveTennisHistoricalMatch,
  normalizeLiveFixtureRow,
  normalizePeLiveFixtureRow,
  resolvePredictionEngineMatchFormat,
  classifySpecialEvent,
  type LiveTennisHistoricalProviderOptions,
} from "./liveTennisHistoricalProvider.js";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 20,
    draw: "singles",
    event_status: "Finished",
    format: "BO3",
    indoor: false,
    outcome: "completed",
    players: {
      p1: { id: 101, name: "Alpha Player", ranking: 10, tour: "atp", is_doubles_team: false },
      p2: { id: 202, name: "Beta Player", ranking: 20, tour: "atp", is_doubles_team: false },
    },
    round: "Quarter-finals",
    round_code: "QF",
    scheduled_time: "2026-09-19T23:40:00Z",
    score: { games: [[6, 6], [2, 3]], sets: [2, 0] },
    status: "completed",
    surface: "hard",
    tour: "atp",
    tournament: { name: "Example Open", category: "atp_500" },
    tournament_id: "500",
    winner: 1,
    ...overrides,
  };
}

/**
 * The REAL /fixtures endpoint's row shape (confirmed by direct live-API inspection during the
 * discovery-normalizer investigation): flat player1_id/player1_name/player2_id/player2_name and
 * a start_time field -- structurally different from row()'s nested players.p1/p2 + scheduled_time
 * shape, which is specific to /history/matches and /matches. Using row() here (as the previous
 * version of this test did) was itself the bug: it validated against the wrong schema and gave
 * false confidence while the real endpoint silently returned zero normalized fixtures in production.
 */
function fixtureRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 35875,
    match_id: 194778,
    gender: "men",
    is_qualifying: false,
    player1_id: 101,
    player1_name: "Alpha Player",
    player2_id: 202,
    player2_name: "Beta Player",
    reason: null,
    round: "St. Tropez - Quarter-finals",
    round_code: "QF",
    start_time: "2026-09-21T12:00:00Z",
    status: "scheduled",
    surface: "hard",
    tour: "atp",
    tournament: "St. Tropez",
    updated_at: "2026-09-21T00:00:00Z",
    ...overrides,
  };
}

function mockFetch(pages: unknown[], seenUrls: string[]) {
  let index = 0;
  return async (url: string) => {
    seenUrls.push(url);
    const body = pages[Math.min(index++, pages.length - 1)];
    return { ok: true, status: 200, json: async () => body };
  };
}

function provider(pages: unknown[], seenUrls: string[], options: Partial<LiveTennisHistoricalProviderOptions> = {}) {
  return new LiveTennisHistoricalProvider({
    apiKey: "test-key",
    fetchImpl: mockFetch(pages, seenUrls),
    ...options,
  });
}

test("normalizes a completed singles match with identity, tournament, score, surface, format, and round provenance", () => {
  const fixture = normalizeLiveTennisHistoricalMatch(row());
  assert.ok(fixture);
  assert.equal(fixture.id, "20");
  assert.equal(fixture.player1Id, "101");
  assert.equal(fixture.player2Id, "202");
  assert.equal(fixture.winnerId, "101");
  assert.equal(fixture.tournamentLevel, "ATP500");
  assert.equal(fixture.surface, "Hard");
  assert.equal(fixture.matchFormat, "BestOf3");
  assert.equal(fixture.round, "QF");
  assert.deepEqual(fixture.setGameMargins, [
    { player1Games: 6, player2Games: 2 },
    { player1Games: 6, player2Games: 3 },
  ]);
  assert.equal(fixture.score, "6-2 6-3");
  assert.equal(fixture.raw && typeof fixture.raw === "object" && "fieldProvenance" in fixture.raw, true);
  assert.equal((fixture.raw as { fieldProvenance: { category: string } }).fieldProvenance.category, "match.tournament.category");
});

test("uses explicit catalogue category, preserves unknown category, and never infers level from tour", () => {
  const mapped = normalizeLiveTennisHistoricalMatch(
    row({ tournament: "Catalogue Open", tournament_id: "42", tour: "wta", format: "BO5", surface: "clay", indoor: null }),
    { tournamentCatalogue: new Map([["42", { category: "wta_1000" }]]) },
  );
  assert.ok(mapped);
  assert.equal(mapped.tournamentLevel, "WTA1000");
  assert.equal(mapped.surface, "Clay");
  assert.equal(mapped.matchFormat, "BestOf5");
  const unknown = normalizeLiveTennisHistoricalMatch(row({ tournament: "No Category", tournament_id: "43", tour: "atp" }));
  assert.ok(unknown);
  assert.equal(unknown.tournamentLevel, null);
});

test("paginates tournament catalogue, keeps first duplicate ID, and preserves explicit null category", async () => {
  const urls: string[] = [];
  const p = provider(
    [
      { data: [{ id: 2360, name: "Tiburon", category: "challenger", surface: "hard", tour: "challenger", indoor: false }, { id: 9, name: "Unknown", category: null }], meta: { has_more: true, count: 2, limit: 200, offset: 0 } },
      { data: [{ id: 2360, name: "Different Duplicate", category: "atp_250" }, { id: 10, name: "Second", category: "itf" }], meta: { has_more: false, count: 2, limit: 200, offset: 2 } },
    ],
    urls,
  );
  const catalogue = await p.getTournamentCatalogue();
  assert.equal(catalogue.get("2360")?.name, "Tiburon");
  assert.equal(catalogue.get("2360")?.category, "challenger");
  assert.equal(catalogue.get("9")?.category, null);
  assert.equal(catalogue.size, 3);
  assert.equal(new URL(urls[0]).pathname, "/api/public/v1/tournaments");
  assert.equal(new URL(urls[0]).searchParams.get("limit"), "200");
  assert.equal(new URL(urls[1]).searchParams.get("offset"), "2");
});

test("surfaces tournament catalogue request failures", async () => {
  const p = new LiveTennisHistoricalProvider({
    apiKey: "test-key",
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
  });
  await assert.rejects(() => p.getTournamentCatalogue(), /catalogue request failed \(500\)/);
});

test("read-only audit fetches catalogue automatically and reports request counts", async () => {
  const urls: string[] = [];
  const audit = await provider([
    { data: [{ id: 2360, name: "Tiburon", category: "challenger" }], meta: { has_more: false, count: 1, limit: 200, offset: 0 } },
    { data: [row({ tournament: "Tiburon", tournament_id: "2360" })], meta: { has_more: false, count: 1, limit: 200, offset: 0 } },
  ], urls).getReadOnlyAudit("2026-09-19", "2026-09-19");
  assert.equal(audit.catalogueRequests, 1);
  assert.equal(audit.historyRequests, 1);
  assert.equal(audit.totalRequests, 2);
  assert.equal(audit.fixtures[0].tournamentLevel, "Challenger");
  assert.equal(new URL(urls[0]).pathname, "/api/public/v1/tournaments");
  assert.equal(new URL(urls[1]).pathname, "/api/public/v1/history/matches");
});

test("rejects non-singles, nonterminal, malformed, and doubles-team rows", () => {
  assert.equal(normalizeLiveTennisHistoricalMatch(row({ draw: "doubles" })), null);
  assert.equal(normalizeLiveTennisHistoricalMatch(row({ status: "live", outcome: "live" })), null);
  assert.equal(normalizeLiveTennisHistoricalMatch(row({ players: { p1: { id: 1, name: "A", is_doubles_team: true }, p2: { id: 2, name: "B" } } })), null);
  assert.equal(normalizeLiveTennisHistoricalMatch(row({ scheduled_time: null })), null);
});

test("preserves explicit unknowns rather than defaulting surface or format", () => {
  const fixture = normalizeLiveTennisHistoricalMatch(row({ surface: "carpet", format: "unknown", indoor: null }));
  assert.ok(fixture);
  assert.equal(fixture.surface, null);
  assert.equal(fixture.matchFormat, null);
  assert.equal(fixture.indoor, null);
});

test("retrieves inclusive date range with capped pagination, de-duplicates IDs, and orders deterministically", async () => {
  const urls: string[] = [];
  const pages = [
    { data: [row({ id: 2, scheduled_time: "2026-09-19T10:00:00Z" }), row({ id: 1, scheduled_time: "2026-09-19T09:00:00Z" })], meta: { has_more: true, count: 2, limit: 200, offset: 0 } },
    { data: [row({ id: 2, scheduled_time: "2026-09-19T10:00:00Z" }), row({ id: 3, scheduled_time: "2026-09-19T09:00:00Z" })], meta: { has_more: false, count: 2, limit: 200, offset: 2 } },
  ];
  const fixtures = await provider(pages, urls).getCompletedMatchesByDateRange("2026-09-19", "2026-09-20");
  assert.deepEqual(fixtures.map((fixture) => fixture.id), ["1", "3", "2"]);
  const first = new URL(urls[0]);
  assert.equal(first.searchParams.get("from"), "2026-09-19");
  assert.equal(first.searchParams.get("to"), "2026-09-20");
  assert.equal(first.searchParams.get("draw"), "singles");
  assert.equal(first.searchParams.get("limit"), "200");
  assert.equal(first.searchParams.get("offset"), "0");
  assert.equal(new URL(urls[1]).searchParams.get("offset"), "2");
  assert.equal(new Set(fixtures.map((fixture) => fixture.id)).size, fixtures.length);
  assert.deepEqual(JSON.parse(JSON.stringify(fixtures)), JSON.parse(JSON.stringify(await provider(pages, []).getCompletedMatchesByDateRange("2026-09-19", "2026-09-20"))));
});

test("canonical comparator orders equal-time numeric provider IDs numerically", () => {
  const low = normalizeLiveTennisHistoricalMatch(row({ id: 2, scheduled_time: "2026-09-19T10:00:00Z" }));
  const high = normalizeLiveTennisHistoricalMatch(row({ id: 10, scheduled_time: "2026-09-19T10:00:00Z" }));
  assert.ok(low && high);
  assert.ok(compareHistoricalFixtures(low, high) < 0);
  assert.deepEqual([high, low].sort(compareHistoricalFixtures).map((fixture) => fixture.id), ["2", "10"]);
});

test("rejects invalid date ranges and surfaces provider errors", async () => {
  const urls: string[] = [];
  const p = provider([], urls);
  await assert.rejects(() => p.getCompletedMatchesByDateRange("2026-09-20", "2026-09-19"), /inclusive YYYY-MM-DD/);
  const failing = new LiveTennisHistoricalProvider({
    apiKey: "test-key",
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ error: "upgrade_required" }) }),
  });
  await assert.rejects(() => failing.getCompletedMatchesByDateRange("2026-09-19", "2026-09-19"), /403/);
  assert.equal(failing.getStatus().connected, false);
});

test("stops deterministically when pagination exceeds the configured page guard", async () => {
  const urls: string[] = [];
  const guarded = provider(
    [{ data: [row()], meta: { has_more: true, count: 1, limit: 200, offset: 0 } }],
    urls,
    { maxPages: 1 },
  );
  await assert.rejects(() => guarded.getCompletedMatchesByDateRange("2026-09-19", "2026-09-19"), /maxPages=1/);
  assert.equal(urls.length, 1);
});

test("allows explicitly configured audits to exceed 100 pages without truncation", async () => {
  const urls: string[] = [];
  const pages = Array.from({ length: 101 }, (_, index) => ({
    data: [row({ id: index + 1, scheduled_time: `2026-09-${String((index % 9) + 10).padStart(2, "0")}T00:00:00Z` })],
    meta: { has_more: index < 100, count: 1, limit: 200, offset: index },
  }));
  const fixtures = await provider(pages, urls, { maxPages: 250 }).getCompletedMatchesByDateRange("2026-09-10", "2026-09-19");
  assert.equal(fixtures.length, 101);
  assert.equal(urls.length, 101);
});

test("uses scheduled timestamp as the historical source cutoff and does not use updated_at", () => {
  const fixture = normalizeLiveTennisHistoricalMatch(row({
    scheduled_time: "2026-09-19T23:40:00Z",
    updated_at: "2026-09-20T06:41:14.616141Z",
  }));
  assert.ok(fixture);
  assert.equal(fixture.date, "2026-09-19");
  assert.equal(fixture.time, "23:40");
  assert.equal((fixture.raw as { fieldProvenance: { scheduledTime: string } }).fieldProvenance.scheduledTime, "match.scheduled_time");
});

describe("normalizeLiveFixtureRow (the real /fixtures endpoint's flat row shape)", () => {
  test("A: a valid real-shaped fixture normalizes", () => {
    const fixture = normalizeLiveFixtureRow(fixtureRow());
    assert.ok(fixture);
  });

  test("B: player 1 ID/name are correct", () => {
    const fixture = normalizeLiveFixtureRow(fixtureRow({ player1_id: 555, player1_name: "T. Droguet" }));
    assert.ok(fixture);
    assert.equal(fixture!.player1Id, "555");
    assert.equal(fixture!.player1Name, "T. Droguet");
  });

  test("C: player 2 ID/name are correct", () => {
    const fixture = normalizeLiveFixtureRow(fixtureRow({ player2_id: 140, player2_name: "B. Gojo" }));
    assert.ok(fixture);
    assert.equal(fixture!.player2Id, "140");
    assert.equal(fixture!.player2Name, "B. Gojo");
  });

  test("D: start_time becomes the scheduled timestamp", () => {
    const fixture = normalizeLiveFixtureRow(fixtureRow({ start_time: "2026-09-23T15:30:00Z" }));
    assert.ok(fixture);
    assert.equal(fixture!.scheduledStart, "2026-09-23T15:30:00.000Z");
    assert.equal(fixture!.timeConfirmed, true);
  });

  test("E: event_date is preserved where the normalized model exposes it (fixture.date)", () => {
    const fixture = normalizeLiveFixtureRow(fixtureRow({ event_date: "2026-09-23", start_time: "2026-09-23T15:30:00Z" }));
    assert.ok(fixture);
    assert.equal(fixture!.date, "2026-09-23");
  });

  test("F: missing player 1 fails safely (returns null, never a fabricated player)", () => {
    assert.equal(normalizeLiveFixtureRow(fixtureRow({ player1_name: null })), null);
    assert.equal(normalizeLiveFixtureRow(fixtureRow({ player1_id: null, player1_name: undefined })), null);
  });

  test("G: missing player 2 fails safely", () => {
    assert.equal(normalizeLiveFixtureRow(fixtureRow({ player2_name: null })), null);
  });

  test("H: missing start_time fails safely", () => {
    assert.equal(normalizeLiveFixtureRow(fixtureRow({ start_time: null })), null);
    assert.equal(normalizeLiveFixtureRow(fixtureRow({ start_time: undefined })), null);
  });

  test("I: malformed timestamps fail safely", () => {
    assert.equal(normalizeLiveFixtureRow(fixtureRow({ start_time: "not-a-real-timestamp" })), null);
  });

  test("J: a history-match row shape (nested players.p1/p2, scheduled_time) does NOT accidentally normalize as a fixture", () => {
    // row() is the /history/matches-shaped helper -- it has no player1_id/player1_name/start_time
    // fields at all, only nested players.p1/p2 and scheduled_time. This is the exact confusion
    // that caused the original bug (reused in the wrong direction); this proves it cannot recur.
    assert.equal(normalizeLiveFixtureRow(row()), null);
  });

  test("never fabricates a fixture ID when the provider omits one", () => {
    assert.equal(normalizeLiveFixtureRow(fixtureRow({ id: null })), null);
    assert.equal(normalizeLiveFixtureRow(fixtureRow({ id: undefined })), null);
  });

  test("resolves tournamentLevel from the tour field when no explicit tournament category object exists (Challenger)", () => {
    const fixture = normalizeLiveFixtureRow(fixtureRow({ tour: "challenger" }));
    assert.ok(fixture);
    assert.equal(fixture!.tournamentLevel, "Challenger");
  });

  test("prefers round_code over round, and maps surface", () => {
    const fixture = normalizeLiveFixtureRow(fixtureRow({ round: "1/8-finals", round_code: "R16", surface: "clay" }));
    assert.ok(fixture);
    assert.equal(fixture!.round, "R16");
    assert.equal(fixture!.surface, "Clay");
  });

  test("preserves the real tournament name (a plain string on /fixtures rows, not an object)", () => {
    const fixture = normalizeLiveFixtureRow(fixtureRow({ tournament: "St. Tropez" }));
    assert.ok(fixture);
    assert.equal(fixture!.tournamentName, "St. Tropez");
  });
});

describe("Builder/Prediction-Engine fixture-discovery isolation", () => {
  function fixturesProvider(rows: unknown[]) {
    const fetchImpl = async (url: string) => {
      const path = new URL(url).pathname;
      if (path === "/api/public/v1/fixtures") return { ok: true, status: 200, json: async () => ({ data: rows }) };
      throw new Error(`unexpected test endpoint ${path}`);
    };
    return new LiveTennisHistoricalProvider({ apiKey: "test-key", fetchImpl });
  }

  test("Prediction Engine's getUpcomingFixturesRange returns [] for the real flat shape -- contract unchanged", async () => {
    const p = fixturesProvider([fixtureRow(), fixtureRow({ id: 2, player1_id: 5, player2_id: 6 })]);
    const fixtures = await p.getUpcomingFixturesRange("2026-09-21", "2026-09-21");
    assert.deepEqual(fixtures, []);
  });

  test("Builder's getUpcomingFixturesRangeForBuilder correctly parses the identical real flat shape", async () => {
    const p = fixturesProvider([fixtureRow({ start_time: "2026-09-21T12:00:00Z" })]);
    const fixtures = await p.getUpcomingFixturesRangeForBuilder("2026-09-21", "2026-09-21");
    assert.equal(fixtures.length, 1);
    assert.equal(fixtures[0]!.player1Name, "Alpha Player");
  });

  test("both methods hit the identical /fixtures request (same endpoint, same params) -- only normalization differs", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(new URL(url).pathname + new URL(url).search);
      return { ok: true, status: 200, json: async () => ({ data: [fixtureRow()] }) };
    };
    const p = new LiveTennisHistoricalProvider({ apiKey: "test-key", fetchImpl });
    await p.getUpcomingFixturesRange("2026-09-21", "2026-09-21");
    await p.getUpcomingFixturesRangeForBuilder("2026-09-21", "2026-09-21");
    assert.equal(calls[0], calls[1]);
  });

  test("Builder's path never fabricates matchFormat, even though matchFormat gates Prediction Engine's lock step", async () => {
    const p = fixturesProvider([fixtureRow()]);
    const fixtures = await p.getUpcomingFixturesRangeForBuilder("2026-09-21", "2026-09-21");
    assert.equal(fixtures[0]!.matchFormat, null);
  });

  test("Prediction Engine's path still parses the OLD history-shaped mock exactly as before (bit-for-bit unchanged)", async () => {
    const p = fixturesProvider([row({ id: 99, scheduled_time: "2026-09-21T12:00:00Z" })]);
    const fixtures = await p.getUpcomingFixturesRange("2026-09-21", "2026-09-21");
    assert.equal(fixtures.length, 1);
    assert.equal(fixtures[0]!.id, "99");
    assert.equal(fixtures[0]!.player1Name, "Alpha Player");
  });
});

describe("Builder fixture pagination (/fixtures can report has_more beyond one page)", () => {
  function fixturesPageProvider(pages: unknown[], seenUrls: string[] = [], options: Partial<LiveTennisHistoricalProviderOptions> = {}) {
    let index = 0;
    const fetchImpl = async (url: string) => {
      const path = new URL(url).pathname;
      if (path !== "/api/public/v1/fixtures") throw new Error(`unexpected test endpoint ${path}`);
      seenUrls.push(url);
      const body = pages[Math.min(index++, pages.length - 1)];
      return { ok: true, status: 200, json: async () => body };
    };
    return new LiveTennisHistoricalProvider({ apiKey: "test-key", fetchImpl, ...options });
  }

  test("getUpcomingFixturesRangeForBuilder follows has_more across multiple pages and returns every fixture", async () => {
    const urls: string[] = [];
    const pages = [
      { data: [fixtureRow({ id: 1, player1_id: 11, player2_id: 12 })], meta: { has_more: true, count: 1, limit: 200, offset: 0 } },
      { data: [fixtureRow({ id: 2, player1_id: 21, player2_id: 22 })], meta: { has_more: true, count: 1, limit: 200, offset: 1 } },
      { data: [fixtureRow({ id: 3, player1_id: 31, player2_id: 32 })], meta: { has_more: false, count: 1, limit: 200, offset: 2 } },
    ];
    const p = fixturesPageProvider(pages, urls);
    const fixtures = await p.getUpcomingFixturesRangeForBuilder("2026-09-21", "2026-09-21");
    assert.deepEqual(fixtures.map((f) => f.id), ["1", "2", "3"]);
    assert.equal(urls.length, 3);
    assert.equal(new URL(urls[0]).searchParams.get("offset"), "0");
    assert.equal(new URL(urls[1]).searchParams.get("offset"), "1");
    assert.equal(new URL(urls[2]).searchParams.get("offset"), "2");
    assert.equal(new URL(urls[0]).searchParams.get("limit"), "200");
  });

  test("a single-page response (has_more: false) still makes exactly one request, unchanged from before the fix", async () => {
    const urls: string[] = [];
    const p = fixturesPageProvider(
      [{ data: [fixtureRow()], meta: { has_more: false, count: 1, limit: 200, offset: 0 } }],
      urls,
    );
    const fixtures = await p.getUpcomingFixturesRangeForBuilder("2026-09-21", "2026-09-21");
    assert.equal(fixtures.length, 1);
    assert.equal(urls.length, 1);
  });

  test("stops deterministically when Builder fixture pagination exceeds the configured page guard", async () => {
    const urls: string[] = [];
    const p = fixturesPageProvider(
      [{ data: [fixtureRow()], meta: { has_more: true, count: 1, limit: 200, offset: 0 } }],
      urls,
      { maxPages: 1 },
    );
    await assert.rejects(() => p.getUpcomingFixturesRangeForBuilder("2026-09-21", "2026-09-21"), /Builder fixture pagination exceeded maxPages=1/);
    assert.equal(urls.length, 1);
  });

  test("stops deterministically when a page reports has_more but returns zero rows (no progress)", async () => {
    const urls: string[] = [];
    const p = fixturesPageProvider(
      [{ data: [], meta: { has_more: true, count: 0, limit: 200, offset: 0 } }],
      urls,
    );
    await assert.rejects(() => p.getUpcomingFixturesRangeForBuilder("2026-09-21", "2026-09-21"), /Builder fixture pagination made no progress/);
  });

  test("Prediction Engine's getUpcomingFixturesRange makes exactly ONE /fixtures request even when has_more is true -- pagination fix is Builder-only", async () => {
    const urls: string[] = [];
    const p = fixturesPageProvider(
      [{ data: [fixtureRow()], meta: { has_more: true, count: 1, limit: 200, offset: 0 } }],
      urls,
    );
    const fixtures = await p.getUpcomingFixturesRange("2026-09-21", "2026-09-21");
    assert.deepEqual(fixtures, []);
    assert.equal(urls.length, 1);
  });
});

describe("resolvePredictionEngineMatchFormat (real ATP/WTA/Grand-Slam rules only, never a per-match guess)", () => {
  test("recognized Bo3: ATP non-Slam tour", () => {
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "atp", gender: "men", isQualifying: false, tournamentName: "Buenos Aires 3" }),
      "BestOf3",
    );
  });

  test("recognized Bo5: men's Grand Slam main draw", () => {
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "atp", gender: "men", isQualifying: false, tournamentName: "Wimbledon" }),
      "BestOf5",
    );
  });

  test("Grand Slam qualifying (men's) is Bo3, not Bo5", () => {
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "atp", gender: "men", isQualifying: true, tournamentName: "US Open" }),
      "BestOf3",
    );
  });

  test("women's fixture: WTA non-Slam is Bo3", () => {
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "wta", gender: "women", isQualifying: false, tournamentName: "W50 Plovdiv" }),
      "BestOf3",
    );
  });

  test("women's Grand Slam (main draw or qualifying) is always Bo3 -- gender alone decides once Slam identity is confirmed", () => {
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "wta", gender: "women", isQualifying: false, tournamentName: "Roland Garros" }),
      "BestOf3",
    );
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "wta", gender: "women", isQualifying: true, tournamentName: "Roland Garros" }),
      "BestOf3",
    );
  });

  test("Challenger fixture is Bo3", () => {
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "challenger", gender: "men", isQualifying: false, tournamentName: "Challenger Metz" }),
      "BestOf3",
    );
  });

  test("ITF fixture is Bo3 (tour token variants like itf_women/itf_men)", () => {
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "itf_women", gender: "women", isQualifying: false, tournamentName: "W50 Plovdiv" }),
      "BestOf3",
    );
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "itf_men", gender: "men", isQualifying: false, tournamentName: "M25 Antalya" }),
      "BestOf3",
    );
  });

  test("unknown/unrecognized tour returns null -- never defaults to Bo3", () => {
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "exhibition", gender: "men", isQualifying: false, tournamentName: "Some Exo Event" }),
      null,
    );
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: null, gender: "men", isQualifying: false, tournamentName: "Unnamed Event" }),
      null,
    );
  });

  // Superseded by the matchFormat-hardening task's classifySpecialEvent tests below: Davis Cup is
  // now explicitly classified (BestOf3, a real, sourced, current-era rule), not left as an
  // unrecognized team event. A still-genuinely-unrecognized team/exhibition event (no explicit
  // rule, no recognized tour) must still return null -- proven here with a name/tour that matches
  // neither a known Grand Slam nor any explicit special-event rule.
  test("a genuinely unrecognized team/special event returns null -- name is not a known Grand Slam or explicit special event, and tour is not a recognized singles tour", () => {
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "exhibition_team", gender: "men", isQualifying: false, tournamentName: "Regional Invitational Team Event" }),
      null,
    );
  });

  test("juniors are explicitly excluded, not assumed Bo3", () => {
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "juniors", gender: "men", isQualifying: false, tournamentName: "Junior Open" }),
      null,
    );
  });

  test("men's Grand Slam with unknown qualifying status fails closed (never guesses main draw vs qualifying)", () => {
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "atp", gender: "men", isQualifying: null, tournamentName: "Australian Open" }),
      null,
    );
  });

  test("Grand Slam with unresolved gender fails closed -- gender is never inferred", () => {
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "atp", gender: null, isQualifying: false, tournamentName: "French Open" }),
      null,
    );
  });

  test("Grand Slam name matching requires an exact known name, not a fuzzy/partial match -- an unrecognized tour with a Slam-adjacent name must not resolve via the Slam branch", () => {
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "exhibition", gender: "men", isQualifying: false, tournamentName: "Australian Open Exhibition Series" }),
      null,
    );
  });
});

describe("classifySpecialEvent (explicit, named, auditable team/special-event detection -- runs before generic tour classification)", () => {
  test("Billie Jean King Cup -- real observed provider name, tour=wta -- resolves BestOf3 via the explicit rule, not the generic WTA branch", () => {
    const result = classifySpecialEvent({ tournamentName: "WTA Billie Jean King Cup - World Group", gender: "women" });
    assert.ok(result);
    assert.equal(result!.format, "BestOf3");
    assert.match(result!.reason, /Billie Jean King Cup/);
  });

  test("Davis Cup -- all 6 real observed provider name variants resolve BestOf3", () => {
    const realObservedNames = [
      "ATP Davis Cup - World Group",
      "ATP Davis Cup - World Group I",
      "ATP Davis Cup - World Group II",
      "Davis Cup - World Group Teams",
      "Davis Cup - World Group I Teams",
      "Davis Cup - World Group II Teams",
    ];
    for (const tournamentName of realObservedNames) {
      const result = classifySpecialEvent({ tournamentName, gender: "men" });
      assert.ok(result, `expected a classification for "${tournamentName}"`);
      assert.equal(result!.format, "BestOf3", `expected BestOf3 for "${tournamentName}"`);
    }
  });

  test("United Cup -- standard best-of-3 singles rubbers", () => {
    const result = classifySpecialEvent({ tournamentName: "United Cup", gender: "men" });
    assert.ok(result);
    assert.equal(result!.format, "BestOf3");
  });

  test("Laver Cup -- non-standard scoring, fails closed rather than guessing Bo3", () => {
    const result = classifySpecialEvent({ tournamentName: "Laver Cup", gender: "men" });
    assert.ok(result);
    assert.equal(result!.format, null);
  });

  test("Olympics -- format has varied by round/Games historically, fails closed", () => {
    const result = classifySpecialEvent({ tournamentName: "Olympic Games Tennis", gender: "men" });
    assert.ok(result);
    assert.equal(result!.format, null);
  });

  test("Hopman Cup and ATP Cup -- discontinued competitions, fail closed even if an archival row somehow reaches this path", () => {
    assert.equal(classifySpecialEvent({ tournamentName: "Hopman Cup", gender: "men" })!.format, null);
    assert.equal(classifySpecialEvent({ tournamentName: "ATP Cup", gender: "men" })!.format, null);
  });

  test("gender inconsistency fails closed: Davis Cup tagged women, Billie Jean King Cup tagged men", () => {
    assert.equal(classifySpecialEvent({ tournamentName: "ATP Davis Cup - World Group", gender: "women" })!.format, null);
    assert.equal(classifySpecialEvent({ tournamentName: "WTA Billie Jean King Cup - World Group", gender: "men" })!.format, null);
  });

  test("a genuinely unrecognized team/exhibition event is not classified here at all -- falls through to the caller's generic logic (null)", () => {
    assert.equal(classifySpecialEvent({ tournamentName: "Some Regional Exhibition Team Event", gender: "men" }), null);
  });

  test("a regular individual tournament with 'Cup' in its own name is NOT misclassified as a team event", () => {
    // Real historical example: "Kremlin Cup" was an individual ATP/WTA tour event, not a team
    // competition -- proves the matcher requires the full multi-word special-event name, not a
    // bare 'cup' substring.
    assert.equal(classifySpecialEvent({ tournamentName: "Kremlin Cup", gender: "men" }), null);
  });

  test("end-to-end via resolvePredictionEngineMatchFormat: special-event detection runs before the generic tour branch", () => {
    // Same shape as the real production fixture that exposed this gap: tour=wta looks like a
    // normal WTA event, but the name must route through the explicit Davis-Cup-family rule, not
    // the generic isRecognizedNonSlamTour("wta") branch.
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "wta", gender: "women", isQualifying: false, tournamentName: "WTA Billie Jean King Cup - World Group" }),
      "BestOf3",
    );
    // Laver Cup with tour=atp must NOT fall through to the generic ATP branch's BestOf3.
    assert.equal(
      resolvePredictionEngineMatchFormat({ tour: "atp", gender: "men", isQualifying: false, tournamentName: "Laver Cup" }),
      null,
    );
  });
});

describe("resolvePredictionEngineMatchFormat -- full STEP 4 matrix (every category the hardening task requires)", () => {
  const CASES: Array<{ label: string; input: Parameters<typeof resolvePredictionEngineMatchFormat>[0]; expected: "BestOf3" | "BestOf5" | null }> = [
    { label: "Billie Jean King Cup", input: { tour: "wta", gender: "women", isQualifying: false, tournamentName: "WTA Billie Jean King Cup - World Group" }, expected: "BestOf3" },
    { label: "Davis Cup", input: { tour: "atp", gender: "men", isQualifying: false, tournamentName: "ATP Davis Cup - World Group I" }, expected: "BestOf3" },
    { label: "United Cup", input: { tour: "atp", gender: "men", isQualifying: false, tournamentName: "United Cup" }, expected: "BestOf3" },
    { label: "Laver Cup", input: { tour: "atp", gender: "men", isQualifying: false, tournamentName: "Laver Cup" }, expected: null },
    { label: "Olympics", input: { tour: "atp", gender: "men", isQualifying: false, tournamentName: "Olympic Games Tennis" }, expected: null },
    { label: "Grand Slam men's main draw", input: { tour: "atp", gender: "men", isQualifying: false, tournamentName: "Wimbledon" }, expected: "BestOf5" },
    { label: "Grand Slam men's qualifying", input: { tour: "atp", gender: "men", isQualifying: true, tournamentName: "US Open" }, expected: "BestOf3" },
    { label: "Grand Slam women's singles", input: { tour: "wta", gender: "women", isQualifying: false, tournamentName: "Roland Garros" }, expected: "BestOf3" },
    { label: "regular ATP", input: { tour: "atp", gender: "men", isQualifying: false, tournamentName: "Buenos Aires 3" }, expected: "BestOf3" },
    { label: "regular WTA", input: { tour: "wta", gender: "women", isQualifying: false, tournamentName: "W50 Plovdiv" }, expected: "BestOf3" },
    { label: "ATP Challenger", input: { tour: "challenger", gender: "men", isQualifying: false, tournamentName: "Challenger Metz" }, expected: "BestOf3" },
    { label: "ITF men", input: { tour: "itf_men", gender: "men", isQualifying: false, tournamentName: "M25 Antalya" }, expected: "BestOf3" },
    { label: "ITF women", input: { tour: "itf_women", gender: "women", isQualifying: false, tournamentName: "W50 Nanao" }, expected: "BestOf3" },
    { label: "juniors", input: { tour: "juniors", gender: "men", isQualifying: false, tournamentName: "Junior Open" }, expected: null },
    { label: "unknown exhibition", input: { tour: "exhibition", gender: "men", isQualifying: false, tournamentName: "Some Exo Event" }, expected: null },
    { label: "unknown team event", input: { tour: "team", gender: "men", isQualifying: false, tournamentName: "Some Regional Team Event" }, expected: null },
  ];

  for (const { label, input, expected } of CASES) {
    test(`${label} -> ${expected ?? "null"}`, () => {
      assert.equal(resolvePredictionEngineMatchFormat(input), expected);
    });
  }
});

describe("normalizePeLiveFixtureRow (Prediction-Engine-only: real flat /fixtures shape + real matchFormat resolution)", () => {
  test("a valid real-shaped fixture normalizes with a resolved matchFormat", () => {
    const fixture = normalizePeLiveFixtureRow(fixtureRow({ tour: "atp" }));
    assert.ok(fixture);
    assert.equal(fixture!.matchFormat, "BestOf3");
  });

  test("player 1 ID/name map correctly", () => {
    const fixture = normalizePeLiveFixtureRow(fixtureRow({ player1_id: 555, player1_name: "T. Droguet" }));
    assert.ok(fixture);
    assert.equal(fixture!.player1Id, "555");
    assert.equal(fixture!.player1Name, "T. Droguet");
  });

  test("player 2 ID/name map correctly", () => {
    const fixture = normalizePeLiveFixtureRow(fixtureRow({ player2_id: 140, player2_name: "B. Gojo" }));
    assert.ok(fixture);
    assert.equal(fixture!.player2Id, "140");
    assert.equal(fixture!.player2Name, "B. Gojo");
  });

  test("start_time maps to scheduledStart", () => {
    const fixture = normalizePeLiveFixtureRow(fixtureRow({ start_time: "2026-09-23T15:30:00Z" }));
    assert.ok(fixture);
    assert.equal(fixture!.scheduledStart, "2026-09-23T15:30:00.000Z");
    assert.equal(fixture!.timeConfirmed, true);
  });

  test("event_date is preserved where the normalized model exposes it (fixture.date)", () => {
    const fixture = normalizePeLiveFixtureRow(fixtureRow({ event_date: "2026-09-23", start_time: "2026-09-23T15:30:00Z" }));
    assert.ok(fixture);
    assert.equal(fixture!.date, "2026-09-23");
  });

  test("surface maps correctly", () => {
    const fixture = normalizePeLiveFixtureRow(fixtureRow({ surface: "clay" }));
    assert.ok(fixture);
    assert.equal(fixture!.surface, "Clay");
  });

  test("tournament/tour/round are preserved", () => {
    const fixture = normalizePeLiveFixtureRow(fixtureRow({ tournament: "St. Tropez", tour: "atp", round: "1/8-finals", round_code: "R16" }));
    assert.ok(fixture);
    assert.equal(fixture!.tournamentName, "St. Tropez");
    assert.equal(fixture!.round, "R16");
  });

  test("malformed/missing players fail safely (returns null, never a fabricated player)", () => {
    assert.equal(normalizePeLiveFixtureRow(fixtureRow({ player1_name: null })), null);
    assert.equal(normalizePeLiveFixtureRow(fixtureRow({ player2_id: null, player2_name: undefined })), null);
  });

  test("malformed start_time fails safely", () => {
    assert.equal(normalizePeLiveFixtureRow(fixtureRow({ start_time: "not-a-real-timestamp" })), null);
    assert.equal(normalizePeLiveFixtureRow(fixtureRow({ start_time: null })), null);
  });

  test("a history-match row shape (nested players.p1/p2, scheduled_time) does NOT accidentally normalize as a live fixture", () => {
    assert.equal(normalizePeLiveFixtureRow(row()), null);
  });

  test("never fabricates matchFormat for a fixture the resolver cannot prove (unrecognized tour)", () => {
    const fixture = normalizePeLiveFixtureRow(fixtureRow({ tour: "exhibition" }));
    assert.ok(fixture);
    assert.equal(fixture!.matchFormat, null);
  });
});

describe("Prediction Engine fixture pagination (getUpcomingFixturesRangeForPredictionEngine) -- mirrors Builder's own pagination fix", () => {
  function fixturesPageProvider(pages: unknown[], seenUrls: string[] = [], options: Partial<LiveTennisHistoricalProviderOptions> = {}) {
    let index = 0;
    const fetchImpl = async (url: string) => {
      const path = new URL(url).pathname;
      if (path !== "/api/public/v1/fixtures") throw new Error(`unexpected test endpoint ${path}`);
      seenUrls.push(url);
      const body = pages[Math.min(index++, pages.length - 1)];
      return { ok: true, status: 200, json: async () => body };
    };
    return new LiveTennisHistoricalProvider({ apiKey: "test-key", fetchImpl, ...options });
  }

  test("follows has_more across multiple pages and returns every fixture", async () => {
    const urls: string[] = [];
    const pages = [
      { data: [fixtureRow({ id: 1, player1_id: 11, player2_id: 12 })], meta: { has_more: true, count: 1, limit: 200, offset: 0 } },
      { data: [fixtureRow({ id: 2, player1_id: 21, player2_id: 22 })], meta: { has_more: true, count: 1, limit: 200, offset: 1 } },
      { data: [fixtureRow({ id: 3, player1_id: 31, player2_id: 32 })], meta: { has_more: false, count: 1, limit: 200, offset: 2 } },
    ];
    const p = fixturesPageProvider(pages, urls);
    const fixtures = await p.getUpcomingFixturesRangeForPredictionEngine("2026-09-21", "2026-09-21");
    assert.deepEqual(fixtures.map((f) => f.id), ["1", "2", "3"]);
    assert.equal(urls.length, 3);
  });

  test("stops deterministically when pagination exceeds the configured page guard", async () => {
    const urls: string[] = [];
    const p = fixturesPageProvider(
      [{ data: [fixtureRow()], meta: { has_more: true, count: 1, limit: 200, offset: 0 } }],
      urls,
      { maxPages: 1 },
    );
    await assert.rejects(
      () => p.getUpcomingFixturesRangeForPredictionEngine("2026-09-21", "2026-09-21"),
      /Prediction Engine fixture pagination exceeded maxPages=1/,
    );
  });

  test("stops deterministically when a page reports has_more but returns zero rows (no progress)", async () => {
    const urls: string[] = [];
    const p = fixturesPageProvider([{ data: [], meta: { has_more: true, count: 0, limit: 200, offset: 0 } }], urls);
    await assert.rejects(
      () => p.getUpcomingFixturesRangeForPredictionEngine("2026-09-21", "2026-09-21"),
      /Prediction Engine fixture pagination made no progress/,
    );
  });

  test("Builder's own pagination method is completely unaffected -- still normalizes with matchFormat always null", async () => {
    const urls: string[] = [];
    const p = fixturesPageProvider(
      [{ data: [fixtureRow({ tour: "atp" })], meta: { has_more: false, count: 1, limit: 200, offset: 0 } }],
      urls,
    );
    const fixtures = await p.getUpcomingFixturesRangeForBuilder("2026-09-21", "2026-09-21");
    assert.equal(fixtures[0]!.matchFormat, null);
  });

  test("Prediction Engine's new adapter and Builder's adapter hit the identical /fixtures request -- only normalization differs", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(new URL(url).pathname + new URL(url).search);
      return { ok: true, status: 200, json: async () => ({ data: [fixtureRow()] }) };
    };
    const p = new LiveTennisHistoricalProvider({ apiKey: "test-key", fetchImpl });
    await p.getUpcomingFixturesRangeForPredictionEngine("2026-09-21", "2026-09-21");
    await p.getUpcomingFixturesRangeForBuilder("2026-09-21", "2026-09-21");
    assert.equal(calls[0], calls[1]);
  });
});

test("implements the runtime provider endpoints without guessing missing values", async () => {
  const calls: string[] = [];
  const fixturesEndpointRow = fixtureRow({
    id: 77,
    status: "scheduled",
    player1_id: 101,
    player1_name: "Alpha Player",
    player2_id: 202,
    player2_name: "Beta Player",
    start_time: "2026-09-21T12:00:00Z",
  });
  const fetchImpl = async (url: string) => {
    calls.push(url);
    const path = new URL(url).pathname;
    if (path === "/api/public/v1/players") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 101, name: "Alpha Player", country: "USA", ranking: 10, tour: "atp" },
            { id: 303, name: "Partner / Alpha Player", tour: "atp", is_doubles_team: true },
          ],
        }),
      };
    }
    if (path === "/api/public/v1/players/101" || path === "/api/public/v1/players/202") {
      const second = path.endsWith("/202");
      return { ok: true, status: 200, json: async () => ({ id: second ? 202 : 101, name: second ? "Beta Player" : "Alpha Player", country: "USA", ranking: second ? 20 : 10, tour: "atp" }) };
    }
    if (path === "/api/public/v1/fixtures") {
      return { ok: true, status: 200, json: async () => ({ data: [fixturesEndpointRow] }) };
    }
    if (path === "/api/public/v1/matches/77/score") {
      return { ok: true, status: 200, json: async () => ({ score: { games: [[6], [4]] }, status: "live" }) };
    }
    if (path === "/api/public/v1/h2h") {
      return { ok: true, status: 200, json: async () => ({ meetings: [{ date: "2026-01-01", tournament: "Example", surface: "hard", score: "6-4 6-4", winner: 1 }] }) };
    }
    if (path === "/api/public/v1/matches") {
      return { ok: true, status: 200, json: async () => ({ data: [row({ id: 88 })] }) };
    }
    throw new Error(`unexpected test endpoint ${path}`);
  };
  const p = new LiveTennisHistoricalProvider({ apiKey: "test-key", fetchImpl });
  assert.deepEqual((await p.searchPlayers("Alpha")).map((player) => player.id), ["101"]);
  assert.equal((await p.getPlayer("101"))?.name, "Alpha Player");
  // Prediction Engine's contract: getUpcomingFixtures (the TennisDataProvider interface method)
  // still cannot parse the real flat /fixtures shape -- unchanged from before the discovery
  // investigation, deliberately, since Prediction Engine's live paper trading depends on this
  // exact method never changing behavior underneath it.
  assert.deepEqual(await p.getUpcomingFixtures("2026-09-21"), []);
  // Builder's own entry point DOES correctly parse the identical real response.
  assert.equal((await p.getUpcomingFixturesForBuilder("2026-09-21"))[0]?.id, "77");
  assert.equal((await p.getLiveScores(["77"])).get("77")?.sets.length, 1);
  assert.equal((await p.getHeadToHead("101", "202")).meetings[0].winnerId, "101");
  assert.equal((await p.getPlayerMatches("101"))[0].opponentId, "202");
  assert.ok(calls.every((url) => !url.includes("api-tennis") && !url.includes("rapidapi")));
});

test("paginates player history, de-duplicates provider IDs, and preserves usable records", async () => {
  const urls: string[] = [];
  const p = provider([
    {
      data: [row({ id: 91 }), row({ id: 92 })],
      meta: { has_more: true, count: 2, limit: 200, offset: 0 },
    },
    {
      data: [row({ id: 92 }), row({ id: 93 })],
      meta: { has_more: false, count: 2, limit: 200, offset: 2 },
    },
  ], urls);

  const records = await p.getPlayerMatches("101");
  assert.deepEqual(records.map((record) => record.id), ["91", "92", "93"]);
  assert.equal(new URL(urls[0]).searchParams.get("offset"), "0");
  assert.equal(new URL(urls[1]).searchParams.get("offset"), "2");
});
