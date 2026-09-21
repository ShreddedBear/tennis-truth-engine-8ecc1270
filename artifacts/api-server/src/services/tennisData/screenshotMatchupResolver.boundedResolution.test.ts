// Tests for the bounded per-matchup worker pool added to resolveScreenshotMatchup():
//   - a single slow/hanging matchup must not block or discard OTHER matchups
//   - matchup resolution must run through a bounded concurrency limit, not
//     unbounded Promise.all() fan-out
//
// MATCHUP_RESOLUTION_TIMEOUT_MS and MATCHUP_RESOLUTION_CONCURRENCY are read from
// env vars at module load, so they're overridden here (small values, for fast/
// deterministic tests) BEFORE the module is imported. This must stay a dynamic
// import -- a static `import` would be hoisted above the env assignment.
//
// Run with: pnpm --filter @workspace/api-server exec tsx --test src/services/tennisData/screenshotMatchupResolver.boundedResolution.test.ts
// 600ms (rather than something tighter) because each matchup's resolution attempts several
// local historical-DB reads before falling back to the live provider -- in this test process
// there is no reachable DB, so each of those reads spends real wall-clock time on a failed
// TCP connect before gracefully degrading. Production's per-matchup default is 20s against a
// real, reachable DB; this is just a small-but-real value so the tests run fast and deterministically.
process.env.SCREENSHOT_MATCHUP_TIMEOUT_MS = "600";
process.env.SCREENSHOT_MATCHUP_CONCURRENCY = "2";

import test from "node:test";
import assert from "node:assert/strict";
import type { PlayerSummary, TennisDataProvider } from "./types";

const {
  resolveScreenshotMatchup,
  MATCHUP_RESOLUTION_TIMEOUT_MS,
  MATCHUP_RESOLUTION_CONCURRENCY,
} = await import("./screenshotMatchupResolver.js");

function makeProvider(overrides: Partial<TennisDataProvider> = {}): TennisDataProvider {
  return {
    name: "fake",
    getStatus: () => ({ provider: "fake", connected: true, lastSuccessfulCallAt: null, lastError: null }),
    searchPlayers: async (): Promise<PlayerSummary[]> => [],
    getPlayer: async () => null,
    getPlayerMatches: async () => [],
    getUpcomingFixtures: async () => [],
    getUpcomingFixturesRange: async () => [],
    getHeadToHead: async (player1Id: string, player2Id: string) => ({ player1Id, player2Id, meetings: [] }),
    getCompletedMatchesByDateRange: async () => [],
    getLiveScores: async () => new Map(),
    ...overrides,
  };
}

test("env overrides actually took effect for this test run", () => {
  assert.equal(MATCHUP_RESOLUTION_TIMEOUT_MS, 600);
  assert.equal(MATCHUP_RESOLUTION_CONCURRENCY, 2);
});

test("a matchup that never resolves degrades to lookup-timeout without blocking or discarding faster matchups", async () => {
  const provider = makeProvider({
    searchPlayers: async (query: string) => {
      if (query.toLowerCase().includes("hangs")) {
        return new Promise<PlayerSummary[]>(() => {}); // never resolves
      }
      return [{ id: `id-${query}`, name: query, countryCode: null, currentRank: null, tour: "ATP" }];
    },
  });

  const t0 = Date.now();
  const result = await resolveScreenshotMatchup(provider, {
    matchups: [
      { player1Name: "FastPlayerOne", player2Name: null, eventName: null },
      { player1Name: "HangsForever", player2Name: null, eventName: null },
      { player1Name: "FastPlayerTwo", player2Name: null, eventName: null },
    ],
  });
  const elapsedMs = Date.now() - t0;

  // The whole call must finish close to the per-matchup deadline, not hang indefinitely --
  // and must not need to wait out a second matchup's turn in the worker pool serially.
  assert.ok(elapsedMs < MATCHUP_RESOLUTION_TIMEOUT_MS * 4, `expected < ${MATCHUP_RESOLUTION_TIMEOUT_MS * 4}ms, got ${elapsedMs}ms`);

  // Fast matchups resolved normally and were NOT discarded because a sibling matchup hung.
  // (player2Name is null on every entry here, so `resolved` -- which requires BOTH
  // players -- stays false by design; the player1 identity is what this test checks.)
  assert.equal(result.matchups?.[0].player1.player?.id, "id-FastPlayerOne");
  assert.equal(result.matchups?.[0].player1.status, undefined);
  assert.equal(result.matchups?.[2].player1.player?.id, "id-FastPlayerTwo");
  assert.equal(result.matchups?.[2].player1.status, undefined);

  // The hung matchup degraded to lookup-timeout, preserving its OCR-recognized name.
  const hung = result.matchups?.[1];
  assert.equal(hung?.player1.recognizedName, "HangsForever");
  assert.equal(hung?.player1.player, null);
  assert.equal(hung?.player1.status, "lookup-timeout");
  assert.equal(hung?.resolved, false);
  assert.ok(hung?.warnings.some((w) => w.includes("OCR succeeded")));
});

test("matchup resolution runs through a bounded worker pool, not unbounded fan-out", async () => {
  let concurrent = 0;
  let maxConcurrent = 0;
  const totalMatchups = MATCHUP_RESOLUTION_CONCURRENCY * 4;

  const provider = makeProvider({
    searchPlayers: async (query: string) => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      // Small delay so overlapping calls actually overlap instead of resolving
      // synchronously before the next worker starts.
      await new Promise((resolve) => setTimeout(resolve, 15));
      concurrent -= 1;
      return [{ id: `id-${query}`, name: query, countryCode: null, currentRank: null, tour: "ATP" }];
    },
  });

  const matchups = Array.from({ length: totalMatchups }, (_, i) => ({
    player1Name: `BoundedPlayer${i}`,
    player2Name: null,
    eventName: null,
  }));

  const result = await resolveScreenshotMatchup(provider, { matchups });

  assert.equal(result.matchups?.length, totalMatchups);
  // player2Name is null on every entry, so `resolved` (which requires both players)
  // stays false by design -- what matters here is that every player1 identity resolved.
  assert.ok(result.matchups?.every((m) => m.player1.player !== null));
  // The worker pool caps how many matchups resolve at once -- never all of them at
  // once, and never more than the configured concurrency limit.
  assert.ok(maxConcurrent <= MATCHUP_RESOLUTION_CONCURRENCY, `expected <= ${MATCHUP_RESOLUTION_CONCURRENCY}, got ${maxConcurrent}`);
  assert.ok(maxConcurrent > 0);
});
