import assert from "node:assert/strict";
import test from "node:test";
import {
  compareHistoricalFixtures,
  LiveTennisHistoricalProvider,
  normalizeLiveTennisHistoricalMatch,
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

test("implements the runtime provider endpoints without guessing missing values", async () => {
  const calls: string[] = [];
  const fixtureRow = row({
    id: 77,
    status: "upcoming",
    outcome: null,
    event_status: null,
    scheduled_time: "2026-09-21T12:00:00Z",
    players: {
      p1: { id: 101, name: "Alpha Player", ranking: 10, tour: "atp", is_doubles_team: false },
      p2: { id: 202, name: "Beta Player", ranking: 20, tour: "atp", is_doubles_team: false },
    },
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
      return { ok: true, status: 200, json: async () => ({ data: [fixtureRow] }) };
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
  assert.equal((await p.getUpcomingFixtures("2026-09-21"))[0].id, "77");
  assert.equal((await p.getLiveScores(["77"])).get("77")?.sets.length, 1);
  assert.equal((await p.getHeadToHead("101", "202")).meetings[0].winnerId, "101");
  assert.equal((await p.getPlayerMatches("101"))[0].opponentId, "202");
  assert.ok(calls.every((url) => !url.includes("api-tennis") && !url.includes("rapidapi")));
});
