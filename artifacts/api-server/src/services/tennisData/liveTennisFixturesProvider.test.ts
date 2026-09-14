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