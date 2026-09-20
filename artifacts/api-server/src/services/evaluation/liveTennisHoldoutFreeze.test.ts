import assert from "node:assert/strict";
import test from "node:test";
import type { HistoricalFixture } from "../tennisData/types";
import type { HoldoutAdmission } from "./liveTennisHoldoutAdmission";
import {
  buildHoldoutFreezeMetadata,
  fingerprintFreezeMembers,
  holdoutFreezeId,
} from "./liveTennisHoldoutFreeze";

const fixture = (id: string): HistoricalFixture => ({
  id,
  provider: "Live Tennis API",
  date: "2026-06-03",
  time: "12:00",
  tournamentId: "tournament",
  tour: "atp",
  tournamentName: "Example",
  tournamentLevel: "ATP250",
  round: "R32",
  surface: "Grass",
  matchFormat: "BestOf3",
  player1Id: "p1",
  player1Name: "A",
  player2Id: "p2",
  player2Name: "B",
  winnerId: "p1",
  score: "6-4 6-3",
  retired: false,
  walkover: false,
  cancelled: false,
  setGameMargins: [],
  indoor: false,
  player1Rank: null,
  player2Rank: null,
  raw: {},
  sourcePlayer1Id: "p1",
  sourcePlayer2Id: "p2",
  requiresCanonicalResolution: true,
  importProvenance: { providerMatchId: id },
});

const admission = (fixtureId: string): HoldoutAdmission => ({
  fixtureId,
  eligible: true,
  exclusions: [],
  canonicalPlayer1Id: "canonical-a",
  canonicalPlayer2Id: "canonical-b",
  canonicalTournamentId: "canonical-event",
  competitionLevel: "ATP250",
  independentOutcome: null,
});

test("freeze ID and metadata are deterministic", () => {
  const metadata = buildHoldoutFreezeMetadata({
    windowFrom: "2026-06-03",
    windowTo: "2026-06-17",
    candidateFingerprint: "candidate",
    eligibleFingerprint: "eligible",
    candidateCount: 2,
    eligibleCount: 1,
  });
  assert.equal(metadata.id, holdoutFreezeId("eligible"));
  assert.equal(metadata.provenance.authority, "deterministic-holdout-admission");
});

test("freeze member fingerprint is independent of member order", () => {
  const first = [{ fixture: fixture("a"), admission: admission("a") }];
  const second = [{ fixture: fixture("a"), admission: admission("a") }];
  assert.equal(fingerprintFreezeMembers(first), fingerprintFreezeMembers(second));
  assert.notEqual(
    fingerprintFreezeMembers([...first, { fixture: fixture("b"), admission: admission("b") }]),
    fingerprintFreezeMembers(first),
  );
});
