import assert from "node:assert/strict";
import test from "node:test";

import { LiveTennisFixturesProvider } from "./liveTennisFixturesProvider";

test("searchPlayers returns ranked source-ID-backed singles and caches the query", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({
      data: [
        { id: 1305, name: "Daisuke Sumizawa", country: "jpn", ranking: 1582, tour: "atp" },
        { id: 7305, name: "Daisuke Sumizawa", country: "jpn", ranking: null, tour: "atp" },
        { id: 30198, name: "Daisuke Sumizawa / Isaac Becroft", ranking: null, tour: "ITF" },
        { name: "No Source Id", ranking: 100, tour: "atp" },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const provider = new LiveTennisFixturesProvider("test-key");
    const expected = [{
      id: "live-tennis-player-1305",
      name: "Daisuke Sumizawa",
      countryCode: "JPN",
      currentRank: 1582,
      tour: "atp",
    }];
    assert.deepEqual(await provider.searchPlayers("sumizawa"), expected);
    assert.deepEqual(await provider.searchPlayers("sumizawa"), expected);
    assert.equal(calls, 1, "identical player search should be cached");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getPlayerMatches maps completed Live Tennis history for the requested player", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: [{
      id: 179907,
      status: "completed",
      scheduled_time: "2026-08-30T23:15:00Z",
      tournament: "US Open",
      tour: "atp",
      round: "ATP US Open - 1/64-finals",
      surface: "hard",
      players: {
        p1: { id: 208, name: "Mariano Navone", ranking: 49 },
        p2: { id: 1218, name: "Novak Djokovic", ranking: 5 },
      },
      score: {
        games: [[7, 5, 4, 6, 6], [6, 7, 6, 2, 1]],
      },
      winner: 1,
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const provider = new LiveTennisFixturesProvider("test-key");
    const records = await provider.getPlayerMatches("live-tennis-player-1218");
    assert.equal(records.length, 1);
    assert.deepEqual(records[0], {
      id: "live-tennis-history-179907",
      date: "2026-08-30",
      tournamentName: "US Open",
      tournamentLevel: "GrandSlam",
      round: "ATP US Open - 1/64-finals",
      matchFormat: null,
      surface: "Hard",
      indoor: false,
      opponentId: "live-tennis-player-208",
      opponentName: "Mariano Navone",
      opponentRank: 49,
      result: "L",
      score: "7-6 5-7 4-6 6-2 6-1",
      retired: false,
      walkover: false,
      stats: null,
      opponentStats: null,
      setGameMargins: [
        { playerGames: 6, opponentGames: 7 },
        { playerGames: 7, opponentGames: 5 },
        { playerGames: 6, opponentGames: 4 },
        { playerGames: 2, opponentGames: 6 },
        { playerGames: 1, opponentGames: 6 },
      ],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});