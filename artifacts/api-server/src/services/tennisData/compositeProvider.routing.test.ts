import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CompositeTennisProvider } from "./compositeProvider.js";
import { ProviderUnavailableError, type MatchRecord, type TennisDataProvider } from "./types.js";

function record(id: string): MatchRecord {
  return {
    id,
    date: "2026-01-01",
    tournamentName: null,
    tournamentLevel: null,
    round: null,
    matchFormat: null,
    surface: "Hard",
    indoor: null,
    opponentId: `opponent-${id}`,
    opponentName: "Opponent",
    opponentRank: null,
    result: "W",
    score: "6-3 6-4",
    retired: false,
    walkover: false,
    stats: null,
    opponentStats: null,
    setGameMargins: [],
  };
}

function provider(
  name: string,
  history: (playerId: string) => Promise<MatchRecord[]>,
): TennisDataProvider {
  return {
    name,
    async searchPlayers() { return []; },
    async getPlayer() { return null; },
    getPlayerMatches: history,
    async getUpcomingFixtures() { return []; },
    async getUpcomingFixturesRange() { return []; },
    async getHeadToHead() { throw new ProviderUnavailableError(`${name} unsupported`); },
    async getCompletedMatchesByDateRange() { return []; },
    async getLiveScores() { return new Map(); },
    getStatus() {
      return { provider: name, connected: false, lastSuccessfulCallAt: null, lastError: null };
    },
  };
}

class RoutingTestProvider extends CompositeTennisProvider {
  constructor(
    primary: TennisDataProvider,
    fallback: TennisDataProvider,
    private readonly dbRows: MatchRecord[],
    live?: ConstructorParameters<typeof CompositeTennisProvider>[2],
    bsd?: ConstructorParameters<typeof CompositeTennisProvider>[3],
  ) {
    super(primary, fallback, live, bsd);
  }

  protected override async resolveAliasIds(playerId: string): Promise<string[]> {
    return [playerId];
  }

  protected override async fetchDbHistory(): Promise<MatchRecord[]> {
    return this.dbRows;
  }
}

describe("CompositeTennisProvider history routing", () => {
  it("uses Live, API-Tennis, BSD, Rapid, then DB in that order", async () => {
    const calls: string[] = [];
    const live = {
      name: "Live Tennis API",
      async getPlayerMatches() {
        calls.push("live");
        return [record("live")];
      },
      async searchPlayers() { return []; },
      getStatus() {
        return { provider: "Live Tennis API", connected: true, lastSuccessfulCallAt: null, lastError: null };
      },
    } as unknown as ConstructorParameters<typeof CompositeTennisProvider>[2];
    const api = provider("API-Tennis", async () => {
      calls.push("api");
      return [];
    });
    const rapid = provider("MatchStat/RapidAPI", async () => {
      calls.push("rapid");
      return [record("rapid")];
    });
    const composite = new RoutingTestProvider(
      rapid,
      api,
      [record("db")],
      live,
      async () => {
        calls.push("bsd");
        return { records: [record("bsd")] };
      },
    );
    composite.seedPlayerName("live-tennis-player-7", "Test Player");

    const rows = await composite.getPlayerMatches("live-tennis-player-7");
    assert.deepEqual(calls, ["live", "api", "bsd", "rapid"]);
    assert.deepEqual(rows.map((row) => row.id), ["live", "bsd", "rapid", "db"]);
    assert.equal(composite.getHistoryRoutingDiagnostics("live-tennis-player-7")?.selectedTier, 1);
    assert.equal(composite.getHistoryRoutingDiagnostics("live-tennis-player-7")?.dbUsed, true);
  });

  it("continues after provider failures and empty responses until DB", async () => {
    const api = provider("API-Tennis", async () => {
      throw new ProviderUnavailableError("API down");
    });
    const rapid = provider("MatchStat/RapidAPI", async () => {
      throw new ProviderUnavailableError("Rapid down");
    });
    const composite = new RoutingTestProvider(
      rapid,
      api,
      [record("db")],
      undefined,
      async () => ({ records: [] }),
    );
    composite.seedPlayerName("api-player-7", "Test Player");

    const rows = await composite.getPlayerMatches("api-player-7");
    const diagnostics = composite.getHistoryRoutingDiagnostics("api-player-7");
    assert.deepEqual(rows.map((row) => row.id), ["db"]);
    assert.equal(diagnostics?.selectedProvider, "historical_matches");
    assert.deepEqual(
      diagnostics?.attemptedProviders.map((attempt) => [attempt.provider, attempt.status]),
      [
        ["API-Tennis", "failed"],
        ["BSD Tennis", "empty"],
        ["MatchStat/RapidAPI", "failed"],
        ["historical_matches", "records"],
      ],
    );
  });

  it("reaches DB when RapidAPI and API-Tennis keys/capabilities are absent", async () => {
    const unavailable = (name: string) => provider(name, async () => {
      throw new ProviderUnavailableError(`${name} key not configured`);
    });
    const composite = new RoutingTestProvider(
      unavailable("MatchStat/RapidAPI"),
      unavailable("API-Tennis"),
      [record("db-only")],
    );

    const rows = await composite.getPlayerMatches("plain-player-7");
    assert.deepEqual(rows.map((row) => row.id), ["db-only"]);
    assert.equal(composite.getHistoryRoutingDiagnostics("plain-player-7")?.dbUsed, true);
  });
});