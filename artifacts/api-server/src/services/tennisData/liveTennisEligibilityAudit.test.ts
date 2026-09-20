import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMatchEligibility, matchEligibilityAudit } from "./liveTennisEligibilityAudit.js";
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

const resolvedIdentity = {
  entries: [
    { providerPlayerId: "p1", providerPlayerName: "One Player", canonicalPlayerId: "c1", resolutionStatus: "resolved" as const, method: "exact-normalized-identity" as const, candidates: ["c1"], provenance: "test" },
    { providerPlayerId: "p2", providerPlayerName: "Two Player", canonicalPlayerId: "c2", resolutionStatus: "resolved" as const, method: "exact-normalized-identity" as const, candidates: ["c2"], provenance: "test" },
  ],
  counts: { resolved: 2, ambiguous: 0, unresolved: 0, byMethod: {
    "existing-canonical-provider-mapping": 0, "exact-normalized-identity": 2, "metadata-disambiguation": 0, unresolved: 0,
  } },
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
  assert.equal(result.gateStatusCounts.MATCH_INELIGIBLE_IDENTITY, 2);
  assert.equal(result.truthEngineEvidenceIndependent, true);
});

test("uses deterministic precedence and returns overlapping reasons", () => {
  const result = evaluateMatchEligibility(
    { ...base, winnerId: null, surface: null },
    resolvedIdentity,
  );
  assert.equal(result.status, "MATCH_INELIGIBLE_OUTCOME");
  assert.deepEqual(result.reasons.map((reason) => reason.code), [
    "missing_winner", "missing_surface", "missing_cutoff", "feature_source_unproven",
  ]);
});

test("rejects unresolved identities and canonical player collisions", () => {
  const unresolved = evaluateMatchEligibility(base, {
    ...resolvedIdentity,
    entries: resolvedIdentity.entries.map((entry) => entry.providerPlayerId === "p2" ? { ...entry, canonicalPlayerId: null, resolutionStatus: "unresolved" as const } : entry),
  });
  assert.equal(unresolved.status, "MATCH_INELIGIBLE_IDENTITY");
  assert.ok(unresolved.reasons.some((reason) => reason.code === "identity_unresolved_or_ambiguous"));
  const collision = evaluateMatchEligibility(base, {
    ...resolvedIdentity,
    entries: resolvedIdentity.entries.map((entry) => ({ ...entry, canonicalPlayerId: "same" })),
  });
  assert.equal(collision.status, "MATCH_INELIGIBLE_IDENTITY");
  assert.ok(collision.reasons.some((reason) => reason.code === "identity_player_collision"));
});

test("rejects metadata, temporal, and unapproved feature evidence", () => {
  const result = evaluateMatchEligibility(
    { ...base, tournamentLevel: null, round: null, setGameMargins: [] },
    resolvedIdentity,
    {
      cutoffAt: "2026-09-19T10:01:00.000Z",
      futureObservationCount: 1,
      requiredFeatureSources: [{ name: "ranking", available: true, pointInTimeSafe: false }],
    },
  );
  assert.equal(result.status, "MATCH_INELIGIBLE_METADATA");
  assert.ok(result.reasons.some((reason) => reason.code === "cutoff_after_match_start"));
  assert.ok(result.reasons.some((reason) => reason.code === "future_observations_present"));
  assert.ok(result.reasons.some((reason) => reason.code === "feature_source_not_point_in_time_safe"));
});

test("accepts only a fully evidenced match and keeps Truth Engine separate", () => {
  const result = evaluateMatchEligibility(base, resolvedIdentity, {
    cutoffAt: "2026-09-19T10:00:00.000Z",
    requiredFeatureSources: [
      { name: "historical-match-records", available: true, pointInTimeSafe: true },
      { name: "historical-ranking", available: true, pointInTimeSafe: true },
    ],
  });
  assert.equal(result.status, "MATCH_ELIGIBLE_FOR_BACKTEST");
  assert.equal(result.eligibleForPrediction, true);
  assert.equal(result.truthEngineEvidenceComplete, null);
});

test("uses the feature-source status when temporal evidence is valid", () => {
  const result = evaluateMatchEligibility(base, resolvedIdentity, {
    cutoffAt: "2026-09-19T10:00:00.000Z",
    requiredFeatureSources: [{ name: "historical-ranking", available: false, pointInTimeSafe: false }],
  });
  assert.equal(result.status, "MATCH_INELIGIBLE_FEATURE_SOURCE");
  assert.ok(result.reasons.some((reason) => reason.code === "feature_source_unavailable"));
});

test("rejects cancelled outcomes even when metadata is complete", () => {
  const result = evaluateMatchEligibility({ ...base, cancelled: true }, resolvedIdentity, {
    cutoffAt: "2026-09-19T10:00:00.000Z",
    requiredFeatureSources: [{ name: "history", available: true, pointInTimeSafe: true }],
  });
  assert.equal(result.status, "MATCH_INELIGIBLE_OUTCOME");
  assert.ok(result.reasons.some((reason) => reason.code === "cancelled_match"));
});

test("retirement and walkover acceptance is explicit policy", () => {
  assert.equal(evaluateMatchEligibility({ ...base, retired: true }, resolvedIdentity, {
    cutoffAt: "2026-09-19T10:00:00.000Z",
    requiredFeatureSources: [{ name: "history", available: true, pointInTimeSafe: true }],
    acceptRetired: true,
  }).status, "MATCH_ELIGIBLE_FOR_BACKTEST");
  assert.equal(evaluateMatchEligibility({ ...base, walkover: true }, resolvedIdentity, {
    cutoffAt: "2026-09-19T10:00:00.000Z",
    requiredFeatureSources: [{ name: "history", available: true, pointInTimeSafe: true }],
    acceptWalkover: false,
  }).status, "MATCH_INELIGIBLE_OUTCOME");
});