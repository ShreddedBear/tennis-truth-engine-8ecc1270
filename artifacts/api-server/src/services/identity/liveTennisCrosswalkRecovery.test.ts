import assert from "node:assert/strict";
import test from "node:test";
import {
  recoverLiveTennisAlias,
  rejectCanonicalCollisions,
  type LiveTennisAuthoritativeProfile,
  type SackmannIdentityObservation,
} from "./liveTennisCrosswalkRecovery";

const profile: LiveTennisAuthoritativeProfile = {
  id: "489",
  name: "Anna Kalinskaya",
  birthday: "1998-12-02",
  country: "rus",
  hand: "R",
};

const observation: SackmannIdentityObservation = {
  tour: "WTA",
  playerId: "214939",
  playerName: "Anna Kalinskaya",
  country: "RUS",
  age: 27.092,
  tournamentDate: "20260104",
  sourceFile: "2026_wta.csv",
  tournamentId: "2026-800",
};

test("recovers an exact profile-to-Sackmann-to-canonical chain", () => {
  const result = recoverLiveTennisAlias(
    profile,
    [observation],
    new Map([["WTA:214939", "canonical-sackmann-wta-214939"]]),
  );
  assert.equal(result.status, "deterministic");
  if (result.status !== "deterministic") return;
  assert.equal(result.alias.canonicalPlayerId, "canonical-sackmann-wta-214939");
  assert.equal(result.alias.resolutionMethod, "provider-profile-exact-multifield");
});

test("does not resolve from name without authoritative profile fields", () => {
  const result = recoverLiveTennisAlias(
    { ...profile, birthday: null },
    [observation],
    new Map([["WTA:214939", "canonical-sackmann-wta-214939"]]),
  );
  assert.equal(result.status, "unresolved");
});

test("keeps multiple exact source identities ambiguous", () => {
  const result = recoverLiveTennisAlias(
    profile,
    [observation, { ...observation, playerId: "other" }],
    new Map([
      ["WTA:214939", "canonical-a"],
      ["WTA:other", "canonical-b"],
    ]),
  );
  assert.equal(result.status, "ambiguous");
});

test("rejects two Live Tennis IDs that collapse to one canonical player", () => {
  const first = recoverLiveTennisAlias(
    profile,
    [observation],
    new Map([["WTA:214939", "canonical-a"]]),
  );
  assert.equal(first.status, "deterministic");
  if (first.status !== "deterministic") return;
  const result = rejectCanonicalCollisions([
    first.alias,
    { ...first.alias, externalPlayerId: "duplicate-live-id" },
  ]);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected.length, 2);
});

test("rejects a new Live Tennis ID that collides with a persisted provider alias", () => {
  const recovered = recoverLiveTennisAlias(
    profile,
    [observation],
    new Map([["WTA:214939", "canonical-a"]]),
  );
  assert.equal(recovered.status, "deterministic");
  if (recovered.status !== "deterministic") return;
  const result = rejectCanonicalCollisions(
    [{ ...recovered.alias, externalPlayerId: "new-live-id" }],
    [{ externalPlayerId: "persisted-live-id", canonicalPlayerId: "canonical-a" }],
  );
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected.length, 1);
});
