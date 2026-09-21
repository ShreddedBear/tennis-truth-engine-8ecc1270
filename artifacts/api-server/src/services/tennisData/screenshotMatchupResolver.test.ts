// Unit tests for the screenshot-import surface fallback and name-resolution helpers.
// Run with: pnpm --filter @workspace/api-server run test:tennisData
import test from "node:test";
import assert from "node:assert/strict";
import { db, historicalMatchesTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import {
  resolveScreenshotMatchup,
  isInitialEquivalentGroup,
  buildDegradedMatchupEntry,
  MATCHUP_RESOLUTION_TIMEOUT_MS,
  MATCHUP_RESOLUTION_CONCURRENCY,
} from "./screenshotMatchupResolver";
import type { PlayerSummary, TennisDataProvider } from "./types";

// ── isInitialEquivalentGroup unit tests ────────────────────────────────────
// These are pure-function tests with no DB or provider dependency.
// They directly verify the collapse predicate covers its four safety rules.

test("isInitialEquivalentGroup: collapses abbreviated + full name sharing same surname", () => {
  // "G. Kravchenko" and "Georgii Kravchenko" are the same player
  const g   = ["g", "kravchenko"];
  const full = ["georgii", "kravchenko"];
  assert.equal(isInitialEquivalentGroup([g, full]), true);
  // Order-independent
  assert.equal(isInitialEquivalentGroup([full, g]), true);
});

test("isInitialEquivalentGroup: does NOT collapse when multiple distinct full first names share same initial", () => {
  // "G. Kravchenko" could be Georgii OR Goncalo — genuine ambiguity
  const initial  = ["g",       "kravchenko"];
  const georgii  = ["georgii", "kravchenko"];
  const goncalo  = ["goncalo", "kravchenko"];
  assert.equal(isInitialEquivalentGroup([initial, georgii, goncalo]), false);
});

test("isInitialEquivalentGroup: does NOT collapse two full names with the same surname", () => {
  // "Gonzalo Castro" and "Geraldo Castro" — no initial, genuinely different players
  assert.equal(
    isInitialEquivalentGroup([["gonzalo", "castro"], ["geraldo", "castro"]]),
    false,
  );
});

test("isInitialEquivalentGroup: does NOT collapse when surname parts differ (multi-word surname)", () => {
  // "G. Castro" (surname part "castro") vs "Goncalo Da Rosa Castro" (surname part "da rosa castro")
  const gCastro   = ["g",       "castro"];
  const fullCastro = ["goncalo", "da", "rosa", "castro"];
  assert.equal(isInitialEquivalentGroup([gCastro, fullCastro]), false);
});

test("isInitialEquivalentGroup: does NOT collapse fuzzy near-names (no single-char initial present)", () => {
  // "Geor Kravchenko" vs "Georgii Kravchenko" — looks similar but neither is an initial
  assert.equal(
    isInitialEquivalentGroup([["geor", "kravchenko"], ["georgii", "kravchenko"]]),
    false,
  );
});

test("isInitialEquivalentGroup: does NOT collapse when initial does not match full first name", () => {
  // "K. Kravchenko" cannot be an initial of "Georgii Kravchenko" — wrong letter
  assert.equal(
    isInitialEquivalentGroup([["k", "kravchenko"], ["georgii", "kravchenko"]]),
    false,
  );
});

test("isInitialEquivalentGroup: handles three candidates with one abbreviation correctly", () => {
  // "G. Kravchenko" (id=10071) and "G. Kravchenko" (id=28099) plus "Georgii Kravchenko" — all same player
  const g1   = ["g", "kravchenko"];
  const g2   = ["g", "kravchenko"];
  const full = ["georgii", "kravchenko"];
  assert.equal(isInitialEquivalentGroup([g1, g2, full]), true);
});

// ── buildDegradedMatchupEntry unit tests ───────────────────────────────────
// Pure-function tests -- no DB or provider dependency. These exercise the
// per-matchup degradation path directly: when one matchup's identity
// resolution times out or errors, this is the entry that stands in for it.
// The core "never throw away recognized names" requirement lives here.

test("buildDegradedMatchupEntry preserves recognized names and marks players as lookup-timeout, not not-found", () => {
  const entry = buildDegradedMatchupEntry(
    { player1Name: "Federico Arnaboldi", player2Name: "Florian Broska", eventName: "ATP Challenger Genoa" },
    "lookup-timeout",
    "Player identity lookup for this matchup exceeded 20000ms, but OCR succeeded.",
  );

  assert.equal(entry.player1.recognizedName, "Federico Arnaboldi");
  assert.equal(entry.player1.player, null);
  assert.equal(entry.player1.status, "lookup-timeout");
  assert.equal(entry.player2.recognizedName, "Florian Broska");
  assert.equal(entry.player2.player, null);
  assert.equal(entry.player2.status, "lookup-timeout");
  assert.equal(entry.event.recognizedName, "ATP Challenger Genoa");
  assert.equal(entry.resolved, false);
  assert.deepEqual(entry.warnings, [
    "Player identity lookup for this matchup exceeded 20000ms, but OCR succeeded.",
  ]);
});

test("buildDegradedMatchupEntry still infers surface/level locally for the degraded entry", () => {
  const entry = buildDegradedMatchupEntry(
    { player1Name: "Coco Gauff", player2Name: "Iga Swiatek", eventName: "US Open" },
    "lookup-timeout",
    "timed out",
  );
  assert.equal(entry.event.surface, "Hard");
});

test("buildDegradedMatchupEntry marks an unreadable name as unreadable rather than lookup-timeout", () => {
  const entry = buildDegradedMatchupEntry(
    { player1Name: null, player2Name: "Iga Swiatek", eventName: null },
    "lookup-timeout",
    "timed out",
  );
  assert.equal(entry.player1.status, "unreadable");
  assert.equal(entry.player2.status, "lookup-timeout");
});

test("buildDegradedMatchupEntry supports a distinct 'error' status for non-timeout resolver failures", () => {
  const entry = buildDegradedMatchupEntry(
    { player1Name: "Novak Djokovic", player2Name: "Carlos Alcaraz", eventName: null },
    "error",
    "Player identity lookup failed for this matchup (ECONNRESET).",
  );
  assert.equal(entry.player1.status, "error");
  assert.equal(entry.player2.status, "error");
});

// ── Bounded resolution configuration sanity checks ─────────────────────────
// No DB/provider dependency -- just verifying the exported constants that
// drive the bounded worker pool are sane defaults (a config regression here
// would silently reintroduce unbounded fan-out or a too-short per-matchup
// deadline for large batches).

test("matchup resolution concurrency and per-matchup timeout are positive, finite bounds", () => {
  assert.ok(Number.isFinite(MATCHUP_RESOLUTION_TIMEOUT_MS) && MATCHUP_RESOLUTION_TIMEOUT_MS > 0);
  assert.ok(Number.isFinite(MATCHUP_RESOLUTION_CONCURRENCY) && MATCHUP_RESOLUTION_CONCURRENCY > 0);
  // Concurrency must be bounded, not unlimited -- a 100+ matchup document must not
  // fire every matchup's player lookups at once.
  assert.ok(MATCHUP_RESOLUTION_CONCURRENCY < 50);
});

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

function makeHistoricalMatch(opts: {
  externalId: string;
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
}) {
  const scheduledStartAt = new Date("2026-09-20T10:00:00Z");
  return {
    externalId: opts.externalId,
    provider: "local-first-resolver-test",
    tour: "ATP",
    tournamentName: "Local First Resolver Test",
    tournamentLevel: null,
    surface: "Hard" as const,
    round: null,
    matchFormat: "BestOf3" as const,
    player1Id: opts.player1Id,
    player1Name: opts.player1Name,
    player2Id: opts.player2Id,
    player2Name: opts.player2Name,
    winnerId: opts.player1Id,
    score: "6-3 6-4",
    retired: false,
    walkover: false,
    cancelled: false,
    gameMarginsPlayer1: [{ player1Games: 6, player2Games: 3 }],
    rawSource: {},
    scheduledStartAt,
    cutoffMinutes: 30,
    cutoffAt: new Date(scheduledStartAt.getTime() - 30 * 60_000),
  };
}

interface ProviderCallCounts {
  searchPlayers: number;
  getPlayer: number;
  getUpcomingFixtures: number;
  getUpcomingFixturesRange: number;
}

function makeCountingProvider(
  searchResult?: (query: string) => PlayerSummary[],
): { provider: TennisDataProvider; calls: ProviderCallCounts } {
  const calls: ProviderCallCounts = {
    searchPlayers: 0,
    getPlayer: 0,
    getUpcomingFixtures: 0,
    getUpcomingFixturesRange: 0,
  };
  return {
    calls,
    provider: makeProvider({
      searchPlayers: async (query) => {
        calls.searchPlayers += 1;
        return searchResult?.(query) ?? [];
      },
      getPlayer: async () => {
        calls.getPlayer += 1;
        return null;
      },
      getUpcomingFixtures: async () => {
        calls.getUpcomingFixtures += 1;
        return [];
      },
      getUpcomingFixturesRange: async () => {
        calls.getUpcomingFixturesRange += 1;
        return [];
      },
    }),
  };
}

test("local-first identity resolver uses local exact/surname evidence before provider fallback", async (t) => {
  const runId = `local-first-${Date.now()}`;
  const cappedSurname = `Zzzcap${runId}`;
  const uniqueSurname = `Zzzunique${runId}`;
  const ambiguousSurname = `Zzzambiguous${runId}`;
  const rows = [
    makeHistoricalMatch({
      externalId: `${runId}-darwin`,
      player1Id: "canonical-sackmann-atp-210464",
      player1Name: "Darwin Blanch",
      player2Id: `${runId}-darwin-opp`,
      player2Name: `Opponent Darwin ${runId}`,
    }),
    makeHistoricalMatch({
      externalId: `${runId}-full`,
      player1Id: `${runId}-full-id`,
      player1Name: `Exact Fullname ${runId}`,
      player2Id: `${runId}-full-opp`,
      player2Name: `Opponent Fullname ${runId}`,
    }),
    makeHistoricalMatch({
      externalId: `${runId}-unique`,
      player1Id: `${runId}-unique-id`,
      player1Name: `U. ${uniqueSurname}`,
      player2Id: `${runId}-unique-opp`,
      player2Name: `Opponent Unique ${runId}`,
    }),
    makeHistoricalMatch({
      externalId: `${runId}-ambiguous-a`,
      player1Id: `${runId}-ambiguous-alice`,
      player1Name: `Alice ${ambiguousSurname}`,
      player2Id: `${runId}-ambiguous-a-opp`,
      player2Name: `Opponent Ambiguous A ${runId}`,
    }),
    makeHistoricalMatch({
      externalId: `${runId}-ambiguous-b`,
      player1Id: `${runId}-ambiguous-amy`,
      player1Name: `Amy ${ambiguousSurname}`,
      player2Id: `${runId}-ambiguous-b-opp`,
      player2Name: `Opponent Ambiguous B ${runId}`,
    }),
    ...Array.from({ length: 30 }, (_, index) =>
      makeHistoricalMatch({
        externalId: `${runId}-cap-distractor-${index}`,
        player1Id: `${runId}-cap-distractor-${index}`,
        player1Name: `Distractor${index} ${cappedSurname}`,
        player2Id: `${runId}-cap-distractor-opp-${index}`,
        player2Name: `Opponent Cap ${index} ${runId}`,
      }),
    ),
    // Stored in player2 so the initial 25-result pool is filled by player1 distractors first.
    makeHistoricalMatch({
      externalId: `${runId}-cap-target`,
      player1Id: `${runId}-cap-target-opp`,
      player1Name: `Opponent Cap Target ${runId}`,
      player2Id: `${runId}-cap-target`,
      player2Name: `C. ${cappedSurname}`,
    }),
  ];

  const inserted = await db
    .insert(historicalMatchesTable)
    .values(rows)
    .returning({ id: historicalMatchesTable.id });
  t.after(async () => {
    await db
      .delete(historicalMatchesTable)
      .where(inArray(historicalMatchesTable.id, inserted.map((row) => row.id)));
  });

  await t.test("Darwin Blanch resolves locally with zero provider calls", async () => {
    const { provider, calls } = makeCountingProvider();
    const result = await resolveScreenshotMatchup(provider, {
      matchups: [{ player1Name: "Darwin Blanch", player2Name: null, eventName: null }],
    });
    assert.equal(result.player1.player?.id, "canonical-sackmann-atp-210464");
    assert.deepEqual(calls, {
      searchPlayers: 0,
      getPlayer: 0,
      getUpcomingFixtures: 0,
      getUpcomingFixturesRange: 0,
    });
  });

  await t.test("full-name exact local match retains the zero-network fast path", async () => {
    const { provider, calls } = makeCountingProvider();
    const result = await resolveScreenshotMatchup(provider, {
      matchups: [{ player1Name: `Exact Fullname ${runId}`, player2Name: null, eventName: null }],
    });
    assert.equal(result.player1.player?.id, `${runId}-full-id`);
    assert.equal(Object.values(calls).reduce((sum, count) => sum + count, 0), 0);
  });

  await t.test("unique abbreviated surname resolves locally without identity-provider calls", async () => {
    const { provider, calls } = makeCountingProvider();
    const result = await resolveScreenshotMatchup(provider, {
      matchups: [{ player1Name: `Uma ${uniqueSurname}`, player2Name: null, eventName: null }],
    });
    assert.equal(result.player1.player?.id, `${runId}-unique-id`);
    assert.equal(calls.searchPlayers, 0);
    assert.equal(calls.getPlayer, 0);
  });

  await t.test("candidate beyond the initial 25-result cap resolves through local surname retry", async () => {
    const { provider, calls } = makeCountingProvider();
    const result = await resolveScreenshotMatchup(provider, {
      matchups: [{ player1Name: `Casey ${cappedSurname}`, player2Name: null, eventName: null }],
    });
    assert.equal(result.player1.player?.id, `${runId}-cap-target`);
    assert.equal(calls.searchPlayers, 0);
    assert.equal(calls.getPlayer, 0);
  });

  await t.test("ambiguous local surname candidates are not silently selected", async () => {
    const { provider, calls } = makeCountingProvider();
    const result = await resolveScreenshotMatchup(provider, {
      matchups: [{ player1Name: `A. ${ambiguousSurname}`, player2Name: null, eventName: null }],
    });
    assert.equal(result.player1.player, null);
    assert.equal(result.player1.status, "ambiguous");
    assert.ok(result.warnings.some((warning) => warning.includes("multiple matching players")));
    assert.equal(calls.searchPlayers, 0);
    assert.equal(calls.getPlayer, 0);
  });

  await t.test("only a genuinely unresolved name reaches the provider fallback", async () => {
    const providerOnlyName = `Networkonlyperson${Date.now()}`;
    const providerPlayer: PlayerSummary = {
      id: `${runId}-provider-id`,
      name: providerOnlyName,
      countryCode: "US",
      currentRank: 123,
      tour: "ATP",
    };
    const { provider, calls } = makeCountingProvider((query) =>
      query.toLowerCase().includes(providerOnlyName.toLowerCase())
        ? [providerPlayer]
        : [],
    );
    const result = await resolveScreenshotMatchup(provider, {
      matchups: [{ player1Name: providerPlayer.name, player2Name: null, eventName: null }],
    });
    assert.equal(result.player1.player?.id, providerPlayer.id);
    assert.equal(calls.searchPlayers, 1);
    assert.equal(calls.getPlayer, 0);
  });

  await t.test("one stalled provider lookup does not discard exact local matches from the document", async () => {
    const { provider } = makeCountingProvider();
    provider.searchPlayers = async () => new Promise<PlayerSummary[]>(() => {});

    const result = await resolveScreenshotMatchup(provider, {
      matchups: [
        { player1Name: "Darwin Blanch", player2Name: null, eventName: null },
        { player1Name: `Neverresolves${runId}`, player2Name: null, eventName: null },
      ],
    });

    assert.equal(result.matchups?.[0].player1.player?.id, "canonical-sackmann-atp-210464");
    assert.equal(result.matchups?.[0].player1.status, undefined);
    assert.equal(result.matchups?.[1].player1.player, null);
    assert.equal(result.matchups?.[1].player1.status, "lookup-timeout");
    assert.ok(
      result.matchups?.[1].warnings.some((warning) =>
        warning.includes("identity lookup timed out"),
      ),
    );
  });

  await t.test("unique local OCR spelling recovery resolves Sobolieva and Bruncik without provider identity calls", async () => {
    const { provider, calls } = makeCountingProvider();
    const result = await resolveScreenshotMatchup(provider, {
      matchups: [
        { player1Name: "Anastasiia Sobolieva", player2Name: null, eventName: null },
        { player1Name: "Petr Bruncik", player2Name: null, eventName: null },
      ],
    });

    assert.equal(result.matchups?.[0].player1.player?.id, "canonical-sackmann-wta-222506");
    assert.equal(result.matchups?.[0].player1.status, undefined);
    assert.equal(result.matchups?.[1].player1.player?.id, "canonical-sackmann-atp-210557");
    assert.equal(result.matchups?.[1].player1.status, undefined);
    assert.equal(calls.searchPlayers, 0);
    assert.equal(calls.getPlayer, 0);
  });

  await t.test("doubles teams are read but reported unsupported without singles identity lookup", async () => {
    const { provider, calls } = makeCountingProvider();
    const result = await resolveScreenshotMatchup(provider, {
      matchups: [{
        player1Name: "Derepasko / Lomakin",
        player2Name: "Matsuda / Sharma",
        eventName: "ATP Challenger Phan Thiet 4",
      }],
    });

    assert.equal(result.player1.recognizedName, "Derepasko / Lomakin");
    assert.equal(result.player1.status, "unsupported-doubles");
    assert.equal(result.player2.recognizedName, "Matsuda / Sharma");
    assert.equal(result.player2.status, "unsupported-doubles");
    assert.equal(calls.searchPlayers, 0);
    assert.equal(calls.getPlayer, 0);
    assert.ok(result.warnings.some((warning) => warning.includes("supports singles only")));
  });
});

test("resolveScreenshotMatchup falls back to a real name search for a Challenger event the name table never covers", async () => {
  const provider = makeProvider({
    findTournamentSurfaceByName: async (name: string) => {
      assert.equal(name, "ATP Challenger Pozoblanco");
      return { surface: "Clay", level: "Challenger" };
    },
  });

  const result = await resolveScreenshotMatchup(provider, {
    matchups: [{ player1Name: null, player2Name: null, eventName: "ATP Challenger Pozoblanco" }],
  });

  assert.equal(result.event.surface, "Clay");
  assert.equal(result.event.level, "Challenger");
  assert.ok(!result.warnings.some((w) => w.includes("couldn't determine its surface")));
});

test("resolveScreenshotMatchup still warns when the name-search fallback also finds nothing", async () => {
  const provider = makeProvider({
    findTournamentSurfaceByName: async () => null,
  });

  const result = await resolveScreenshotMatchup(provider, {
    matchups: [{ player1Name: null, player2Name: null, eventName: "Some Untraceable Regional Event" }],
  });

  assert.equal(result.event.surface, null);
  assert.ok(result.warnings.some((w) => w.includes("couldn't determine its surface")));
});

test("resolveScreenshotMatchup never calls the name-search fallback when a provider doesn't implement it", async () => {
  const provider = makeProvider(); // no findTournamentSurfaceByName at all

  const result = await resolveScreenshotMatchup(provider, {
    matchups: [{ player1Name: null, player2Name: null, eventName: "ATP Challenger Pozoblanco" }],
  });

  assert.equal(result.event.surface, null);
  assert.ok(result.warnings.some((w) => w.includes("couldn't determine its surface")));
});

test("resolveScreenshotMatchup prefers the precise named table over the name-search fallback for a major", async () => {
  const provider = makeProvider({
    findTournamentSurfaceByName: async () => {
      throw new Error("should never be called -- Wimbledon already resolves via the named table");
    },
  });

  const result = await resolveScreenshotMatchup(provider, {
    matchups: [{ player1Name: null, player2Name: null, eventName: "Wimbledon" }],
  });

  assert.equal(result.event.surface, "Grass");
  assert.equal(result.event.level, "GrandSlam");
  assert.equal(result.event.canonicalName, "Wimbledon");
  assert.equal(result.event.bestOf, null);
  assert.equal(result.event.provenance.surface.method, "local-registry");
});

test("metadata-only OCR resolves WTA São Paulo with independent provenance and no provider call", async () => {
  let calls = 0;
  const provider = makeProvider({
    findTournamentSurfaceByName: async () => {
      calls++;
      return null;
    },
  });
  const result = await resolveScreenshotMatchup(provider, {
    matchups: [{ player1Name: null, player2Name: null, eventName: "WTA São Paulo Quarterfinal" }],
  });
  assert.equal(result.event.canonicalName, "São Paulo Open");
  assert.equal(result.event.tour, "WTA");
  assert.equal(result.event.surface, "Hard");
  assert.equal(result.event.level, "WTA250");
  assert.equal(result.event.bestOf, "BestOf3");
  assert.equal(result.event.round, "QF");
  assert.equal(result.event.provenance.bestOf.status, "derived");
  assert.equal(calls, 0);
});

test("shared 1000 events resolve the correct WTA category locally without provider calls", async () => {
  for (const eventName of ["WTA Indian Wells", "WTA Miami Open", "WTA Cincinnnati"]) {
    let calls = 0;
    const result = await resolveScreenshotMatchup(makeProvider({
      findTournamentSurfaceByName: async () => {
        calls++;
        return null;
      },
    }), { matchups: [{ player1Name: null, player2Name: null, eventName }] });
    assert.equal(result.event.tour, "WTA");
    assert.equal(result.event.level, "WTA1000");
    assert.equal(result.event.surface, "Hard");
    assert.equal(result.event.bestOf, "BestOf3");
    assert.ok(result.event.canonicalName);
    assert.equal(calls, 0);
  }
});

test("unknown OCR events stay fully unknown instead of defaulting to hard, 250, or BO3", async () => {
  const result = await resolveScreenshotMatchup(makeProvider({ findTournamentSurfaceByName: async () => null }), {
    matchups: [{ player1Name: null, player2Name: null, eventName: "Regional Cup Zeta" }],
  });
  assert.equal(result.event.canonicalName, null);
  assert.equal(result.event.surface, null);
  assert.equal(result.event.level, null);
  assert.equal(result.event.bestOf, null);
  assert.equal(result.event.provenance.tournament.status, "unresolved");
});

test("resolveScreenshotMatchup returns matchups array with multiple entries when input has multiple", async () => {
  // Use clearly fictional names ("Testington", "Fakeovsky") that cannot appear in the real
  // historical_matches DB rows — avoids the mock-id vs DB-id duplicate that trips isConfidentMatch.
  const provider = makeProvider({
    searchPlayers: async (query: string) => {
      if (query.toLowerCase().includes("testington"))
        return [{ id: "test-1", name: "John Testington", countryCode: "TST", currentRank: 99, tour: "ATP" }];
      if (query.toLowerCase().includes("fakeovsky"))
        return [{ id: "fake-1", name: "Ivan Fakeovsky", countryCode: "FAK", currentRank: 98, tour: "ATP" }];
      if (query.toLowerCase().includes("mockerson"))
        return [{ id: "mock-1", name: "Dave Mockerson", countryCode: "MCK", currentRank: 97, tour: "ATP" }];
      if (query.toLowerCase().includes("stubsworth"))
        return [{ id: "stub-1", name: "Carl Stubsworth", countryCode: "STB", currentRank: 96, tour: "ATP" }];
      return [];
    },
  });

  const result = await resolveScreenshotMatchup(provider, {
    matchups: [
      { player1Name: "Testington", player2Name: "Fakeovsky", eventName: null },
      { player1Name: "Mockerson", player2Name: "Stubsworth", eventName: null },
    ],
  });

  assert.ok(result.matchups, "matchups array present");
  assert.equal(result.matchups!.length, 2);
  assert.equal(result.matchups![0].player1.player?.id, "test-1");
  assert.equal(result.matchups![0].player2.player?.id, "fake-1");
  assert.equal(result.matchups![1].player1.player?.id, "mock-1");
  assert.equal(result.matchups![1].player2.player?.id, "stub-1");
  assert.ok(result.matchups![0].resolved);
  assert.ok(result.matchups![1].resolved);
});

test("resolveScreenshotMatchup never auto-selects a player when multiple confident candidates exist", async () => {
  // Use two non-abbreviated full names that both match the OCR input "G. Castro" via
  // initial expansion ("gonzalo" ↔ "g", "geraldo" ↔ "g") — but they are genuinely
  // different players, so the initial-equivalent collapse must NOT fire (different first
  // names that aren't mutual initials of each other) and the result must be ambiguous.
  // Abbreviated names like "G. Castro" are filtered out of live-provider results by
  // searchKnownPlayers (prevents duplicate abbreviated/full collisions), so the test
  // must use full-name candidates to exercise the multi-confident ambiguity path.
  const provider = makeProvider({
    searchPlayers: async (query: string) => {
      if (query.toLowerCase().includes("castro")) {
        return [
          { id: "p-castro-a", name: "Gonzalo Castro", countryCode: "PT", currentRank: 100, tour: "ATP" },
          { id: "p-castro-b", name: "Geraldo Castro", countryCode: "BR", currentRank: 120, tour: "ATP" },
        ];
      }
      if (query.toLowerCase().includes("testington")) {
        return [{ id: "test-1", name: "John Testington", countryCode: "TST", currentRank: 99, tour: "ATP" }];
      }
      return [];
    },
  });

  const result = await resolveScreenshotMatchup(provider, {
    matchups: [{ player1Name: "G. Castro", player2Name: "Testington", eventName: null }],
  });

  assert.equal(result.player1.player, null);
  assert.equal(result.player2.player?.id, "test-1");
  assert.equal(result.matchups?.[0].resolved, false);
  assert.ok(result.warnings.some((w) => w.includes("multiple matching players were found")));
});
