import assert from "node:assert/strict";
import test from "node:test";
import { auditLiveTennisIdentity } from "./liveTennisIdentityAudit.js";
import type { PlayerIdentityIndex } from "./playerIdentity.js";
import type { HistoricalFixture } from "./types.js";

function fixture(player1Id: string, player1Name: string, player2Id = "p2", player2Name = "Second Player"): HistoricalFixture {
  return {
    id: `${player1Id}-${player2Id}`,
    provider: "Live Tennis API",
    date: "2026-09-19",
    time: "12:00",
    tour: "ATP",
    tournamentName: "Test",
    tournamentLevel: null,
    round: "R1",
    surface: "Hard",
    matchFormat: "BestOf3",
    player1Id,
    player1Name,
    player2Id,
    player2Name,
    winnerId: player1Id,
    score: "6-2 6-2",
    retired: false,
    walkover: false,
    cancelled: false,
    setGameMargins: [{ player1Games: 6, player2Games: 2 }],
    indoor: false,
    player1Rank: null,
    player2Rank: null,
    raw: {},
  };
}

function index(overrides: Partial<PlayerIdentityIndex> = {}): PlayerIdentityIndex {
  return {
    canonicalIdByName: new Map(),
    canonicalIdById: new Map(),
    aliasIdsByCanonicalId: new Map(),
    ...overrides,
  };
}

test("resolves an existing canonical provider mapping before name matching", () => {
  const result = auditLiveTennisIdentity(
    [fixture("live-1", "Different Display Name")],
    index({ canonicalIdById: new Map([["live-1", "canonical-1"]]) }),
  );
  assert.equal(result.counts.resolved, 1);
  assert.equal(result.entries[0].canonicalPlayerId, "canonical-1");
  assert.equal(result.entries[0].method, "existing-canonical-provider-mapping");
});

test("resolves exact normalized identity and keeps ambiguous collisions unresolved", () => {
  const result = auditLiveTennisIdentity(
    [fixture("live-exact", "José Exact", "live-ambiguous", "Alex Smith")],
    index({
      canonicalIdByName: new Map([
        ["jose exact", "canonical-exact"],
        ["alex smith", "canonical-a"],
        ["smith alex", "canonical-b"],
      ]),
    }),
  );
  assert.equal(result.entries.find((entry) => entry.providerPlayerId === "live-exact")?.method, "exact-normalized-identity");
  assert.equal(result.entries.find((entry) => entry.providerPlayerId === "live-exact")?.canonicalPlayerId, "canonical-exact");
  assert.equal(result.entries.find((entry) => entry.providerPlayerId === "live-ambiguous")?.resolutionStatus, "ambiguous");
  assert.deepEqual(result.entries.find((entry) => entry.providerPlayerId === "live-ambiguous")?.candidates, ["canonical-a", "canonical-b"]);
});

test("leaves an unresolved provider identity explicit and supports deterministic metadata disambiguation", () => {
  const unresolved = auditLiveTennisIdentity([fixture("missing", "No Known Player")], index());
  assert.equal(unresolved.counts.unresolved, 2);
  assert.equal(unresolved.entries.find((entry) => entry.providerPlayerId === "missing")?.resolutionStatus, "unresolved");
  const disambiguated = auditLiveTennisIdentity(
    [fixture("ambiguous", "Shared Name")],
    index({ canonicalIdByName: new Map([["shared name", "canonical-a"], ["name shared", "canonical-b"]]) }),
    { metadataResolver: () => "canonical-a" },
  );
  assert.equal(disambiguated.entries[0].canonicalPlayerId, "canonical-a");
  assert.equal(disambiguated.entries[0].method, "metadata-disambiguation");
});
