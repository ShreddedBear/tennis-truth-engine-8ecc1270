import assert from "node:assert/strict";
import test from "node:test";

import { LiveTennisFixturesProvider } from "./liveTennisFixturesProvider";

test("getUpcomingFixturesRange maps the current flat schema across bounded pages", async () => {
  const originalFetch = globalThis.fetch;
  const offsets: number[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const offset = Number(url.searchParams.get("offset"));
    offsets.push(offset);
    const data = offset === 0
      ? [
          {
            id: 100,
            match_id: 900,
            player1_id: 1,
            player1_name: "Player One",
            player2_id: 2,
            player2_name: "Player Two",
            start_time: "2026-09-16T14:00:00Z",
            event_date: "2026-09-16",
            status: "scheduled",
            tournament: "ATP Test 250",
            tour: "ATP 250",
            round: "Round 1",
            surface: "hard",
          },
          {
            id: 101,
            player1_id: 3,
            player1_name: "Player Three",
            player2_id: 4,
            player2_name: "Player Four",
            start_time: "2026-09-16T01:00:00Z",
            status: "live",
            tournament: "WTA Test",
            tour: "WTA 250",
            surface: "clay",
          },
          {
            id: 102,
            player1_id: 5,
            player1_name: "Cancelled One",
            player2_id: 6,
            player2_name: "Cancelled Two",
            start_time: "2026-09-16T16:00:00Z",
            status: "cancelled",
          },
          {
            id: 103,
            player1_id: 7,
            player1_name: "Missing Opponent",
            start_time: "2026-09-16T17:00:00Z",
            status: "scheduled",
          },
        ]
      : [
          {
            id: 100,
            player1_id: 1,
            player1_name: "Player One",
            player2_id: 2,
            player2_name: "Player Two",
            start_time: "2026-09-16T14:00:00Z",
            status: "scheduled",
          },
          {
            id: 104,
            player1_id: 8,
            player1_name: "Future One",
            player2_id: 9,
            player2_name: "Future Two",
            start_time: "2026-09-17T10:00:00Z",
            status: "scheduled",
            surface: "indoor hard",
          },
        ];
    return new Response(JSON.stringify({
      data,
      meta: { has_more: offset === 0, limit: 200, offset, total: 6 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const provider = new LiveTennisFixturesProvider("test-key");
    const fixtures = await provider.getUpcomingFixturesRange("2026-09-16", "2026-09-16");
    assert.deepEqual(offsets, [0, 200]);
    assert.equal(fixtures.length, 2);
    assert.deepEqual(fixtures[0], {
      id: "live-tennis-100",
      date: "2026-09-16",
      scheduledStart: "2026-09-16T14:00:00.000Z",
      timeConfirmed: true,
      isLive: false,
      tournamentName: "ATP Test 250",
      tournamentLevel: "ATP250",
      round: "Round 1",
      surface: "Hard",
      indoor: false,
      matchFormat: null,
      player1Id: "live-tennis-player-1",
      player1Name: "Player One",
      player2Id: "live-tennis-player-2",
      player2Name: "Player Two",
    });
    assert.equal(fixtures[1]?.isLive, true);
    assert.deepEqual(provider.getFixtureFetchDiagnostics(), {
      provider: "Live Tennis API",
      rawRows: 6,
      acceptedRows: 3,
      rejectedRows: 2,
      duplicateRows: 1,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getUpcomingFixturesRange retains the legacy nested schema and honors cache bypass", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({
      data: [{
        id: 200,
        status: "scheduled",
        scheduled_time: "2026-09-18T12:30:00Z",
        tournament: "Legacy Open",
        tour: "challenger",
        surface: "clay",
        players: {
          p1: { id: 20, name: "Legacy One" },
          p2: { id: 21, name: "Legacy Two" },
        },
      }],
      meta: { has_more: false, total: 1 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const provider = new LiveTennisFixturesProvider("test-key");
    assert.equal((await provider.getUpcomingFixturesRange("2026-09-18", "2026-09-18")).length, 1);
    assert.equal((await provider.getUpcomingFixturesRange("2026-09-18", "2026-09-18")).length, 1);
    assert.equal(calls, 1);
    assert.equal((await provider.getUpcomingFixturesRange(
      "2026-09-18",
      "2026-09-18",
      { bypassCache: true },
    )).length, 1);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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