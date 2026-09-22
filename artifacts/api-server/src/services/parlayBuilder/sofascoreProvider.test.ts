/**
 * Unit tests for sofascoreProvider.ts — the Parlay Builder's second-tier fallback
 * after the primary Live Tennis API composite provider fails.
 *
 * Sofascore's unofficial API has no injectable client (unlike LiveTennisHistoricalProvider),
 * so these tests stub the global fetch for the duration of each test and restore it
 * afterward, rather than hitting the real network.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";

import { fetchFromSofascore, isConfidentSofascoreMatch } from "./sofascoreProvider.js";

const realFetch = globalThis.fetch;

function stubFetch(impl: (url: string) => Promise<{ ok: boolean; status: number; json?: () => Promise<unknown>; text?: () => Promise<string> }>): void {
  globalThis.fetch = ((url: string) => impl(url)) as typeof fetch;
}

after(() => {
  globalThis.fetch = realFetch;
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function errorResponse(status: number, body: unknown) {
  return { ok: false, status, json: async () => body, text: async () => JSON.stringify(body) };
}

const SEARCH_URL_FRAGMENT = "/search/all";
const EVENTS_URL_FRAGMENT = "/events/last/";

describe("fetchFromSofascore", () => {
  it("returns a resolved player and match history on a successful response", async () => {
    stubFetch(async (url) => {
      if (url.includes(SEARCH_URL_FRAGMENT)) {
        return jsonResponse(200, {
          results: [
            {
              type: "player",
              entity: { id: 42, name: "Carlos Alcaraz", sport: { id: 5, name: "Tennis", slug: "tennis" }, nationality: { alpha2: "ES" } },
            },
          ],
        });
      }
      if (url.includes(EVENTS_URL_FRAGMENT)) {
        return jsonResponse(200, {
          events: [
            {
              id: 99,
              tournament: { name: "Test Open", category: { name: "ATP 250" } },
              homeTeam: { id: 42, name: "Carlos Alcaraz" },
              awayTeam: { id: 43, name: "Test Opponent" },
              homeScore: { current: 2 },
              awayScore: { current: 0 },
              winnerCode: 1,
              startTimestamp: 1735689600,
              status: { type: "finished" },
              groundType: "HARD",
            },
          ],
          hasNextPage: false,
        });
      }
      throw new Error(`unexpected url in test: ${url}`);
    });

    const result = await fetchFromSofascore("Carlos Alcaraz");

    assert.equal(result.error, null);
    assert.equal(result.player?.id, "sofascore-42");
    assert.equal(result.player?.name, "Carlos Alcaraz");
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].result, "W");
    assert.equal(result.records[0].surface, "Hard");
  });

  it("returns a distinct, non-fabricated 'blocked' error on HTTP 403 -- never invents a player or records", async () => {
    stubFetch(async () => errorResponse(403, { error: { code: 403, reason: "Forbidden" } }));

    const result = await fetchFromSofascore("Novak Djokovic");

    assert.equal(result.player, null);
    assert.deepEqual(result.records, []);
    assert.ok(result.error?.includes("403"));
    assert.ok(result.error?.toLowerCase().includes("blocked"));
  });

  it("returns a distinct rate-limited error on HTTP 429 -- never invents a player or records", async () => {
    stubFetch(async () => errorResponse(429, { error: "rate limited" }));

    const result = await fetchFromSofascore("Iga Swiatek");

    assert.equal(result.player, null);
    assert.deepEqual(result.records, []);
    assert.ok(result.error?.includes("429"));
    assert.ok(result.error?.toLowerCase().includes("rate-limited"));
  });

  it("distinguishes a generic non-OK status from 403/429", async () => {
    stubFetch(async () => errorResponse(500, { error: "internal error" }));

    const result = await fetchFromSofascore("Someone Unknown");

    assert.equal(result.player, null);
    assert.ok(result.error?.includes("500"));
    assert.ok(!result.error?.toLowerCase().includes("blocked"));
    assert.ok(!result.error?.toLowerCase().includes("rate-limited"));
  });

  it("reports a timeout distinctly when the request aborts -- never invents a player or records", async () => {
    stubFetch(async () => {
      throw new Error("The operation was aborted");
    });

    const result = await fetchFromSofascore("Someone Slow");

    assert.equal(result.player, null);
    assert.deepEqual(result.records, []);
    assert.ok(result.error?.toLowerCase().includes("timed out"));
  });

  it("degrades gracefully on a malformed/empty search response instead of throwing", async () => {
    stubFetch(async (url) => {
      if (url.includes(SEARCH_URL_FRAGMENT)) {
        // "results" key entirely absent, unlike the documented shape.
        return jsonResponse(200, {});
      }
      throw new Error(`unexpected url in test: ${url}`);
    });

    const result = await fetchFromSofascore("Nobody Findable");

    assert.equal(result.player, null);
    assert.deepEqual(result.records, []);
    assert.equal(result.error, null);
  });

  it("player found but events page fails (403): returns the player with zero records and a distinct blocked error, never fabricated records", async () => {
    stubFetch(async (url) => {
      if (url.includes(SEARCH_URL_FRAGMENT)) {
        return jsonResponse(200, {
          results: [{ type: "player", entity: { id: 7, name: "Maiko Uchijima", sport: { id: 5, name: "Tennis", slug: "tennis" } } }],
        });
      }
      if (url.includes(EVENTS_URL_FRAGMENT)) {
        return errorResponse(403, { error: { code: 403, reason: "Forbidden" } });
      }
      throw new Error(`unexpected url in test: ${url}`);
    });

    const result = await fetchFromSofascore("Maiko Uchijima");

    assert.equal(result.player?.id, "sofascore-7");
    assert.deepEqual(result.records, []);
    assert.ok(result.error?.includes("403"));
    assert.ok(result.error?.toLowerCase().includes("blocked"));
  });

  it("skips a non-tennis or non-player search result rather than guessing", async () => {
    stubFetch(async (url) => {
      if (url.includes(SEARCH_URL_FRAGMENT)) {
        return jsonResponse(200, {
          results: [
            { type: "team", entity: { id: 1, name: "Some Football Club", sport: { id: 1, name: "Football", slug: "football" } } },
            { type: "player", entity: { id: 2, name: "Some Footballer", sport: { id: 1, name: "Football", slug: "football" } } },
          ],
        });
      }
      throw new Error(`unexpected url in test: ${url}`);
    });

    const result = await fetchFromSofascore("Some Footballer");

    assert.equal(result.player, null);
    assert.deepEqual(result.records, []);
  });
});

describe("isConfidentSofascoreMatch", () => {
  it("matches on exact surname + first initial", () => {
    assert.equal(isConfidentSofascoreMatch("Novak Djokovic", "N. Djokovic"), true);
  });

  it("rejects an unrelated name", () => {
    assert.equal(isConfidentSofascoreMatch("Rafael Nadal", "Novak Djokovic"), false);
  });
});
