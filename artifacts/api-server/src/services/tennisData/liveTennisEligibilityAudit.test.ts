import assert from "node:assert/strict";
import test from "node:test";
import { matchEligibilityAudit } from "./liveTennisEligibilityAudit.js";
import type { HistoricalFixture } from "./types.js";

const base: HistoricalFixture = {
  id: "m1",
  provider: "Live Tennis API",
  date: "2026-09-19",
  time: "10:00",
  tour: "ATP",
  tournamentName: "Test",
  tournamentLevel: "ATP250",
  round: "R1",
  surface: "Hard",
  matchFormat: "BestOf3",
  player1Id: "p1",
  player1Name: "One Player",
  player2Id: "p2",
  player2Name: "Two Player",
  winnerId: "p1",
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

test("reports non-exclusive missing-field reasons and all-required count", () => {
  const identityAudit = {
    entries: [
      { providerPlayerId: "p1", providerPlayerName: "One Player", canonicalPlayerId: "c1", resolutionStatus: "resolved" as const, method: "exact-normalized-identity" as const, candidates: ["c1"], provenance: "test" },
      { providerPlayerId: "p2", providerPlayerName: "Two Player", canonicalPlayerId: null, resolutionStatus: "ambiguous" as const, method: "unresolved" as const, candidates: ["c2", "c3"], provenance: "test" },
    ],
    counts: {
      resolved: 1,
      ambiguous: 1,
      unresolved: 0,
      byMethod: {
        "existing-canonical-provider-mapping": 0,
        "exact-normalized-identity": 1,
        "metadata-disambiguation": 0,
        unresolved: 1,
      },
    },
  };
  const result = matchEligibilityAudit([
    base,
    { ...base, id: "m2", winnerId: null, tournamentLevel: null, surface: null, round: null, matchFormat: null, setGameMargins: [] },
  ], identityAudit);
  assert.equal(result.totalMatches, 2);
  assert.equal(result.missingWinner, 1);
  assert.equal(result.unresolvedOrAmbiguousPlayerIdentity, 2);
  assert.equal(result.missingTournamentLevel, 1);
  assert.equal(result.missingSurface, 1);
  assert.equal(result.missingRound, 1);
  assert.equal(result.missingFormat, 1);
  assert.equal(result.missingFinalSetGames, 1);
  assert.equal(result.allRequiredFieldsPresent, 0);
  assert.equal(result.reasonCountsAreNonExclusive, true);
});