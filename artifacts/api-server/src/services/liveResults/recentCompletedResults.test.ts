import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { HistoricalFixture } from "../tennisData/types.js";
import {
  ingestRecentCompletedFixtures,
  fetchRecentCompletedFixturesInChunks,
  chunkRecentCompletedResultsDateRange,
  LIVE_TENNIS_PROVIDER_ALIAS_NAMESPACE,
  recentCompletedResultsDateRange,
  recentCompletedResultsJobStatus,
  type RecentCompletedResultsDependencies,
  type VerifiedLiveResult,
} from "./recentCompletedResults.js";

function fixture(overrides: Partial<HistoricalFixture> = {}): HistoricalFixture {
  return {
    id: "live-match-42",
    provider: "Live Tennis API",
    date: "2026-07-06",
    time: "14:10",
    tour: "ATP",
    tournamentName: "Wimbledon",
    tournamentLevel: "GrandSlam",
    round: "R1",
    surface: "Grass",
    matchFormat: "BestOf5",
    player1Id: "provider-p1",
    player1Name: "Player One",
    player2Id: "provider-p2",
    player2Name: "Player Two",
    winnerId: "provider-p1",
    score: "6-4 6-3",
    retired: false,
    walkover: false,
    cancelled: false,
    setGameMargins: [],
    indoor: false,
    player1Rank: 10,
    player2Rank: 20,
    raw: {},
    ...overrides,
  };
}

function dependencies(options?: {
  methods?: Record<string, string>;
  ids?: Record<string, string | null>;
}) {
  const persisted: VerifiedLiveResult[] = [];
  const deps: RecentCompletedResultsDependencies = {
    resolveCanonicalPlayer: async ({ externalPlayerId }) => ({
      canonicalPlayerId: options?.ids?.[externalPlayerId] ?? `canonical-${externalPlayerId}`,
      resolutionMethod: options?.methods?.[externalPlayerId] ?? "provider-alias",
    }),
    persist: async (result) => {
      persisted.push(result);
      return "inserted";
    },
  };
  return { deps, persisted };
}

describe("ingestRecentCompletedFixtures", () => {
  it("uses the exact provider namespace configured for verified Live Tennis API aliases", async () => {
    assert.equal(LIVE_TENNIS_PROVIDER_ALIAS_NAMESPACE, "Live Tennis API");
    const { deps, persisted } = dependencies();
    const summary = await ingestRecentCompletedFixtures([
      fixture({ provider: "API-Tennis" }),
    ], deps);
    assert.equal(summary.inserted, 0);
    assert.equal(summary.skippedByReason.provider_namespace_not_backed_by_verified_aliases, 1);
    assert.equal(persisted.length, 0);
  });

  it("persists a terminal winner only after exact provider aliases and a confirmed schedule", async () => {
    const { deps, persisted } = dependencies();
    const summary = await ingestRecentCompletedFixtures([fixture()], deps);

    assert.equal(summary.inserted, 1);
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].canonicalPlayer1Id, "canonical-provider-p1");
    assert.equal(persisted[0].canonicalPlayer2Id, "canonical-provider-p2");
    assert.equal(persisted[0].canonicalWinnerId, "canonical-provider-p1");
    assert.equal(persisted[0].provider, "Live Tennis API");
    assert.equal(persisted[0].externalId, "live-match-42");
    // Live Tennis API has already parsed scheduled_time as UTC; Wimbledon local time must not
    // shift that normalized instant back by the venue's UTC offset.
    assert.equal(persisted[0].scheduledStartAt.toISOString(), "2026-07-06T14:10:00.000Z");
    assert.equal(persisted[0].terminalResultType, "finished");
  });

  it("skips a provider-terminal result whose confirmed scheduled start is still in the future", async () => {
    const { deps, persisted } = dependencies();
    const summary = await ingestRecentCompletedFixtures([
      fixture({ date: "2026-09-27", time: "08:40" }),
    ], deps, [], new Date("2026-09-27T05:28:00.000Z"));

    assert.equal(summary.inserted, 0);
    assert.equal(summary.skippedByReason.official_result_before_scheduled_start, 1);
    assert.equal(persisted.length, 0);
  });

  it("does not accept name-only, fuzzy, missing, or ambiguous canonical identities", async () => {
    const { deps, persisted } = dependencies({
      methods: { "provider-p2": "ambiguous" },
      ids: { "provider-p2": null },
    });
    const summary = await ingestRecentCompletedFixtures([fixture()], deps);
    assert.equal(summary.inserted, 0);
    assert.equal(summary.skippedByReason.canonical_provider_alias_missing_or_ambiguous, 1);
    assert.equal(persisted.length, 0);
  });

  it("requires the resolver’s exact provider-alias method even when name matching finds a canonical player", async () => {
    const { deps, persisted } = dependencies({
      methods: {
        "provider-p1": "exact-normalized-name",
        "provider-p2": "provider-alias",
      },
    });
    const summary = await ingestRecentCompletedFixtures([fixture()], deps);
    assert.equal(summary.inserted, 0);
    assert.equal(summary.skippedByReason.canonical_provider_alias_missing_or_ambiguous, 1);
    assert.equal(persisted.length, 0);
  });

  it("rejects missing, cancelled, or non-participant official winners", async () => {
    const { deps, persisted } = dependencies();
    const summary = await ingestRecentCompletedFixtures([
      fixture({ winnerId: null }),
      fixture({ id: "cancelled", cancelled: true, winnerId: null }),
      fixture({ id: "foreign-winner", winnerId: "unknown-player" }),
    ], deps);

    assert.equal(summary.inserted, 0);
    assert.equal(summary.skippedByReason.missing_official_winner, 1);
    assert.equal(summary.skippedByReason.cancelled_without_gradeable_result, 1);
    assert.equal(summary.skippedByReason.official_winner_not_a_fixture_participant, 1);
    assert.equal(persisted.length, 0);
  });

  it("rejects missing provider time but does not require a venue lookup for normalized UTC time", async () => {
    const { deps, persisted } = dependencies();
    const summary = await ingestRecentCompletedFixtures([
      fixture({ time: null }),
      fixture({ id: "unknown-venue", tournamentName: "Unknown Tennis Event" }),
    ], deps);

    assert.equal(summary.skippedByReason.scheduled_start_unconfirmed, 1);
    assert.equal(summary.inserted, 1);
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].scheduledStartAt.toISOString(), "2026-07-06T14:10:00.000Z");
  });

  it("rejects identical canonical players and preserves official walkover result type", async () => {
    const samePlayer = dependencies({ ids: { "provider-p2": "canonical-provider-p1" } });
    const samePlayerSummary = await ingestRecentCompletedFixtures([fixture()], samePlayer.deps);
    assert.equal(samePlayerSummary.skippedByReason.canonical_players_not_distinct, 1);

    const walkover = dependencies();
    const walkoverSummary = await ingestRecentCompletedFixtures([
      fixture({ id: "walkover", walkover: true }),
    ], walkover.deps);
    assert.equal(walkoverSummary.inserted, 1);
    assert.equal(walkover.persisted[0].terminalResultType, "walkover");
  });

  it("deduplicates provider fixture identifiers in one result fetch", async () => {
    const { deps, persisted } = dependencies();
    const summary = await ingestRecentCompletedFixtures([fixture(), fixture()], deps);
    assert.equal(summary.inserted, 1);
    assert.equal(summary.skippedByReason.missing_or_duplicate_provider_fixture_identity, 1);
    assert.equal(persisted.length, 1);
  });

  it("counts exact-key upsert dispositions without changing prediction or feature inputs", async () => {
    const result = fixture();
    const dispositions = ["updated", "unchanged", "identity_conflict"] as const;
    let call = 0;
    const deps: RecentCompletedResultsDependencies = {
      resolveCanonicalPlayer: async ({ externalPlayerId }) => ({
        canonicalPlayerId: `canonical-${externalPlayerId}`,
        resolutionMethod: "provider-alias",
      }),
      persist: async () => dispositions[call++],
    };
    const summary = await ingestRecentCompletedFixtures([result, {
      ...result,
      id: "same-day-43",
    }, {
      ...result,
      id: "same-day-44",
    }], deps);

    assert.equal(summary.updated, 1);
    assert.equal(summary.unchanged, 1);
    assert.equal(summary.skippedByReason.provider_fixture_identity_changed, 1);
  });
});

describe("recentCompletedResultsDateRange", () => {
  it("covers the current UTC day and prior six days for outage recovery", () => {
    assert.deepEqual(
      recentCompletedResultsDateRange(new Date("2026-09-27T05:14:00.000Z")),
      { dateStart: "2026-09-21", dateStop: "2026-09-27" },
    );
  });
});

describe("chunkRecentCompletedResultsDateRange / fetchRecentCompletedFixturesInChunks", () => {
  it("uses inclusive windows no longer than two days", () => {
    assert.deepEqual(
      chunkRecentCompletedResultsDateRange("2026-09-21", "2026-09-27"),
      [
        { dateStart: "2026-09-21", dateStop: "2026-09-22" },
        { dateStart: "2026-09-23", dateStop: "2026-09-24" },
        { dateStart: "2026-09-25", dateStop: "2026-09-26" },
        { dateStart: "2026-09-27", dateStop: "2026-09-27" },
      ],
    );
  });

  it("keeps successful chunks, reports each failed range, and leaves deduplication to the combined ingestion pass", async () => {
    const calls: Array<[string, string]> = [];
    const fetched = await fetchRecentCompletedFixturesInChunks({
      getCompletedMatchesByDateRange: async (dateStart, dateStop) => {
        calls.push([dateStart, dateStop]);
        if (dateStart === "2026-09-23") throw new Error("provider timeout");
        return [fixture()];
      },
    }, "2026-09-21", "2026-09-27");
    assert.equal(calls.length, 4);
    assert.equal(fetched.chunksFetched, 3);
    assert.equal(fetched.fixtures.length, 3);
    assert.deepEqual(fetched.providerErrors, ["2026-09-23..2026-09-24: provider timeout"]);

    const { deps, persisted } = dependencies();
    const summary = await ingestRecentCompletedFixtures(fetched.fixtures, deps, fetched.providerErrors);
    assert.equal(summary.inserted, 1);
    assert.equal(summary.skippedByReason.missing_or_duplicate_provider_fixture_identity, 2);
    assert.deepEqual(summary.providerErrors, fetched.providerErrors);
    assert.equal(recentCompletedResultsJobStatus(summary), "degraded");
    assert.equal(persisted.length, 1);
  });

  it("marks a fully fetched cycle as successful rather than degraded", () => {
    assert.equal(recentCompletedResultsJobStatus({ providerErrors: [] }), "success");
  });

  it("surfaces every failed window if no chunk could be fetched", async () => {
    const calls: Array<[string, string]> = [];
    await assert.rejects(
      () => fetchRecentCompletedFixturesInChunks({
        getCompletedMatchesByDateRange: async (dateStart, dateStop) => {
          calls.push([dateStart, dateStop]);
          throw new Error("provider unavailable");
        },
      }, "2026-09-21", "2026-09-27"),
      /2026-09-21\.\.2026-09-22: provider unavailable.*2026-09-27\.\.2026-09-27: provider unavailable/,
    );
    assert.equal(calls.length, 4);
  });
});