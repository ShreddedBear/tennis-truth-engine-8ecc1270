import assert from "node:assert/strict";
import test from "node:test";
import type { HistoricalFixture } from "../tennisData/types";
import {
  auditHoldoutAdmission,
  fingerprintCandidatePopulation,
  type IndependentOutcomeEvidence,
  type VerifiedPlayerAlias,
  type VerifiedTournamentMapping,
} from "./liveTennisHoldoutAdmission";

function fixture(overrides: Partial<HistoricalFixture> = {}): HistoricalFixture {
  return {
    id: "live-tennis-history-1",
    provider: "Live Tennis API",
    date: "2026-06-03",
    time: "12:00",
    tournamentId: "t1",
    tour: "atp",
    tournamentName: "Example",
    tournamentLevel: null,
    round: "R32",
    surface: "Grass",
    matchFormat: "BestOf3",
    player1Id: "live-tennis-player-1",
    player1Name: "Same Name",
    player2Id: "live-tennis-player-2",
    player2Name: "Other Player",
    winnerId: "live-tennis-player-1",
    score: "6-4 6-3",
    retired: false,
    walkover: false,
    cancelled: false,
    setGameMargins: [
      { player1Games: 6, player2Games: 4 },
      { player1Games: 6, player2Games: 3 },
    ],
    indoor: false,
    player1Rank: null,
    player2Rank: null,
    raw: {},
    sourcePlayer1Id: "1",
    sourcePlayer2Id: "2",
    requiresCanonicalResolution: true,
    importProvenance: { providerMatchId: "1" },
    ...overrides,
  };
}

const aliases: VerifiedPlayerAlias[] = [
  {
    provider: "Live Tennis API",
    externalPlayerId: "1",
    canonicalPlayerId: "canonical-a",
    verificationStatus: "verified",
    resolutionMethod: "provider-profile-exact-multifield",
    provenance: { authority: "reviewed-provider-crosswalk", evidenceId: "profile-1" },
  },
  {
    provider: "Live Tennis API",
    externalPlayerId: "2",
    canonicalPlayerId: "canonical-b",
    verificationStatus: "verified",
    resolutionMethod: "provider-profile-exact-multifield",
    provenance: { authority: "reviewed-provider-crosswalk", evidenceId: "profile-2" },
  },
];

const tournaments: VerifiedTournamentMapping[] = [{
  provider: "Live Tennis API",
  externalTournamentId: "t1",
  canonicalTournamentId: "canonical-event",
  competitionLevel: "ATP250",
  verificationStatus: "verified",
  resolutionMethod: "exact-player-pair-round-score-winner",
  evidenceSource: "Approved Sackmann Warehouse",
  provenance: { authority: "reviewed-tournament-crosswalk", evidenceId: "event-1" },
}];

const outcome: IndependentOutcomeEvidence = {
  source: "Approved Sackmann Warehouse",
  externalMatchId: "independent-1",
  player1CanonicalId: "canonical-b",
  player2CanonicalId: "canonical-a",
  canonicalTournamentId: "canonical-event",
  date: "2026-06-03",
  round: "R32",
  score: "4-6 3-6",
  winnerCanonicalId: "canonical-a",
  completed: true,
  verificationStatus: "verified",
  linkageMethod: "exact-signature-no-match-date",
  dateSemantics: "event-start-date-not-match-date",
  provenance: { authority: "independent-result-source", evidenceId: "independent.csv:1" },
};

test("admits only an exact, independently verified cross-source match", () => {
  const [result] = auditHoldoutAdmission([fixture()], aliases, tournaments, [outcome]);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.exclusions, []);
  assert.equal(result.independentOutcome?.externalMatchId, "independent-1");
});

test("rejects tournament rows without the approved deterministic method and source", () => {
  const spoofed = [{
    ...tournaments[0],
    resolutionMethod: "manual-name-match",
    evidenceSource: "Unknown",
  }] as unknown as VerifiedTournamentMapping[];
  const [result] = auditHoldoutAdmission([fixture()], aliases, spoofed, [outcome]);
  assert.equal(result.eligible, false);
  assert.ok(result.exclusions.includes("tournament-identity-unresolved"));
});

test("normalizes explicit provider round labels without fuzzy matching", () => {
  const [result] = auditHoldoutAdmission(
    [fixture({ round: "WTA Example - 1/16-finals" })],
    aliases,
    tournaments,
    [{ ...outcome, round: "R32" }],
  );
  assert.equal(result.eligible, true);
});

test("does not collapse duplicate names without distinct provider aliases", () => {
  const duplicateName = fixture({
    sourcePlayer1Id: "missing-1",
    player1Name: "Same Name",
    sourcePlayer2Id: "missing-2",
    player2Name: "Same Name",
  });
  const [result] = auditHoldoutAdmission([duplicateName], aliases, tournaments, [outcome]);
  assert.equal(result.eligible, false);
  assert.ok(result.exclusions.includes("player1-identity-unresolved"));
  assert.ok(result.exclusions.includes("player2-identity-unresolved"));
});

test("rejects unverified aliases and missing provider mappings", () => {
  const unverified = aliases.map((alias) => ({ ...alias, verificationStatus: "pending" }));
  const [result] = auditHoldoutAdmission([fixture()], unverified, tournaments, [outcome]);
  assert.equal(result.canonicalPlayer1Id, null);
  assert.equal(result.canonicalPlayer2Id, null);
});

test("runtime checks reject spoofed identity methods and outcome sources", () => {
  const spoofedAlias = {
    ...aliases[0],
    resolutionMethod: "normalized-name",
  } as unknown as VerifiedPlayerAlias;
  const spoofedOutcome = {
    ...outcome,
    source: "Live Tennis API mirror",
  } as unknown as IndependentOutcomeEvidence;
  const [result] = auditHoldoutAdmission(
    [fixture()],
    [spoofedAlias, aliases[1]],
    tournaments,
    [spoofedOutcome],
  );
  assert.equal(result.canonicalPlayer1Id, null);
  assert.ok(result.exclusions.includes("outcome-unresolved"));
});

test("rejects duplicate player and tournament mappings instead of overwriting", () => {
  const duplicateAliases = [
    ...aliases,
    { ...aliases[0], canonicalPlayerId: "canonical-other" },
  ];
  const duplicateTournaments = [
    ...tournaments,
    { ...tournaments[0], canonicalTournamentId: "canonical-other-event" },
  ];
  const [result] = auditHoldoutAdmission(
    [fixture()],
    duplicateAliases,
    duplicateTournaments,
    [outcome],
  );
  assert.equal(result.canonicalPlayer1Id, null);
  assert.equal(result.canonicalTournamentId, null);
});

test("admits exact signature evidence without claiming the event-start date is a match date", () => {
  const [result] = auditHoldoutAdmission(
    [fixture({ date: "2026-06-17" })],
    aliases,
    tournaments,
    [outcome],
  );
  assert.equal(result.eligible, true);
});

test("admits persisted exact-signature rows with sorted players and player1-perspective score", () => {
  const persistedInvariantOutcome: IndependentOutcomeEvidence = {
    ...outcome,
    player1CanonicalId: "canonical-a",
    player2CanonicalId: "canonical-b",
    score: "6-4 6-3",
  };
  const [result] = auditHoldoutAdmission(
    [fixture({ date: "2026-06-17" })],
    aliases,
    tournaments,
    [persistedInvariantOutcome],
  );
  assert.equal(result.eligible, true);
  assert.equal(result.independentOutcome?.player1CanonicalId, "canonical-a");
  assert.equal(result.independentOutcome?.score, "6-4 6-3");
});

test("rejects spoofed date semantics for exact-signature evidence", () => {
  const [result] = auditHoldoutAdmission(
    [fixture()],
    aliases,
    tournaments,
    [{ ...outcome, dateSemantics: "match-date" }],
  );
  assert.ok(result.exclusions.includes("outcome-unresolved"));
});

test("requires an authoritative tournament mapping for ATP and WTA events", () => {
  const [result] = auditHoldoutAdmission([fixture()], aliases, [], [outcome]);
  assert.equal(result.competitionLevel, null);
  assert.ok(result.exclusions.includes("tournament-identity-unresolved"));
  assert.ok(result.exclusions.includes("competition-level-unresolved"));
});

test("accepts explicit Challenger and ITF tour categories but still requires tournament identity", () => {
  const results = auditHoldoutAdmission([
    fixture({ id: "challenger", tour: "challenger" }),
    fixture({ id: "itf", tour: "itf" }),
  ], aliases, [], []);
  assert.equal(results[0].competitionLevel, "Challenger");
  assert.equal(results[1].competitionLevel, "ITF");
  assert.ok(results.every((result) => result.exclusions.includes("tournament-identity-unresolved")));
});

test("rejects ambiguous and conflicting independent outcomes", () => {
  const ambiguous = auditHoldoutAdmission(
    [fixture()],
    aliases,
    tournaments,
    [outcome, { ...outcome, externalMatchId: "independent-2" }],
  )[0];
  assert.ok(ambiguous.exclusions.includes("outcome-ambiguous"));

  const conflicting = auditHoldoutAdmission(
    [fixture()],
    aliases,
    tournaments,
    [{ ...outcome, winnerCanonicalId: "canonical-b" }],
  )[0];
  assert.ok(conflicting.exclusions.includes("outcome-conflict"));

  const conflictingScore = auditHoldoutAdmission(
    [fixture()],
    aliases,
    tournaments,
    [outcome, { ...outcome, externalMatchId: "independent-3", score: "0-6 0-6" }],
  )[0];
  assert.ok(conflictingScore.exclusions.includes("outcome-conflict"));
});

test("requires a valid score and handles retirement or walkover without guessing", () => {
  for (const candidate of [
    fixture({ score: null }),
    fixture({ score: "not-a-score" }),
    fixture({ score: "0-0 6-3" }),
    fixture({ score: "6-5 6-3" }),
    fixture({ score: "6-0" }),
    fixture({ score: "6-0 0-6" }),
    fixture({ score: "6-0 6-0 0-6" }),
    fixture({ score: "6-0 6-0", winnerId: "live-tennis-player-2" }),
    fixture({ matchFormat: "BestOf5", score: "6-0 6-0" }),
    fixture({ matchFormat: "BestOf5", score: "6-0 6-0 0-6 0-6" }),
    fixture({ matchFormat: "BestOf5", score: "6-0 6-0 6-0 0-6" }),
    fixture({ retired: true }),
    fixture({ walkover: true }),
    fixture({ cancelled: true }),
  ]) {
    const [result] = auditHoldoutAdmission([candidate], aliases, tournaments, [outcome]);
    assert.equal(result.eligible, false);
    assert.ok(
      result.exclusions.includes("score-unresolved") ||
      result.exclusions.includes("termination-ungradeable"),
    );
  }
});

test("candidate fingerprints are key-order independent and population-order sensitive", () => {
  const first = fixture({ importProvenance: { b: 2, a: 1 } });
  const same = fixture({ importProvenance: { a: 1, b: 2 } });
  const second = fixture({ id: "live-tennis-history-2" });
  assert.equal(fingerprintCandidatePopulation([first]), fingerprintCandidatePopulation([same]));
  assert.notEqual(
    fingerprintCandidatePopulation([first, second]),
    fingerprintCandidatePopulation([second, first]),
  );
});
