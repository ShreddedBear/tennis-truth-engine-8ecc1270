/**
 * Regression tests for double-sided paper-trading evaluation — directional invariants.
 *
 * The Parlay Builder's decision (KEEP/BORDERLINE/REMOVE) is scoped to whichever player is
 * `selectedPlayerId`; there is no "player1/player2" concept in the scoring API. An autonomous
 * paper-trading system that evaluates a fixture without a human-selected side must therefore
 * run the Builder TWICE (once per player as "selected") and record the physically-independent
 * `builderPickedPlayerId` as the actual prediction, not the decision label. These tests pin
 * down exactly which properties hold and which don't, using the pure __TEST_computeScoring
 * harness (no DB, no network) — the same harness the existing Bug A–D regression tests use.
 *
 * Verified empirically (not assumed) before this file was written, via a one-off read-only
 * script against __TEST_computeScoring with realistic asymmetric stats:
 *   - validationScore(A) + validationScore(B) = 100, ±1 (integer rounding of an exactly
 *     antisymmetric diffScore formula: diffScore(x,y,s) = 100 − diffScore(y,x,s)).
 *   - every directional factor (supportsSelected sometimes true/false) reverses under swap.
 *   - dataQuality does NOT reverse (score(A)+score(B) far from 100) — it is intentionally
 *     non-directional (measures combined coverage, supportsSelected always null).
 *   - riskScore is NOT required to sum to ~100 — it has asymmetric terms (the selected
 *     player's own retirement rate, own days-rest, thin-data penalties computed per role).
 *   - consequently `decision` can differ completely between the two directions (e.g. KEEP
 *     for one side, REMOVE for the other) even though validationScore is complementary —
 *     this is the concrete reason a paper-trade record must store the evaluated side, not
 *     merely a decision label.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  __TEST_computeScoring,
  type PlayerStats,
} from "./builderScoringService.js";

function makeStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  const total = overrides.total ?? 20;
  const surfaceTotal = overrides.surfaceTotal ?? 0;
  const recentN = Math.min(total, 10);
  return {
    total,
    winRate: 0.55,
    winRateConfidence: Math.min(1, total / 10),
    surfaceTotal,
    surfaceWinRate: 0.5,
    surfaceWinRateConfidence: Math.min(1, surfaceTotal / 5),
    recentWinRate: 0.6,
    recentWinRateConfidence: Math.min(1, recentN / 5),
    avgOppRank: 100,
    surfaceAvgOppRank: 100,
    retirementRate: 0.0,
    lastMatchDate: null,
    currentRank: null,
    tournamentWinRate: 0.5,
    tournamentTotal: 0,
    quarterWinRates: [],
    ...overrides,
  };
}

describe("builderScoringService — double-sided directional invariants", () => {
  // Deliberately asymmetric player pair so every reversal is numerically visible,
  // not masked by a coin-flip case.
  const playerA = makeStats({
    total: 30, winRate: 0.70, surfaceTotal: 12, surfaceWinRate: 0.75,
    recentWinRate: 0.8, avgOppRank: 60, retirementRate: 0.03,
    lastMatchDate: new Date(Date.now() - 3 * 86_400_000), currentRank: 8,
    tournamentWinRate: 0.65, tournamentTotal: 4, quarterWinRates: [0.7, 0.75, 0.68, 0.72],
  });
  const playerB = makeStats({
    total: 28, winRate: 0.45, surfaceTotal: 10, surfaceWinRate: 0.40,
    recentWinRate: 0.3, avgOppRank: 140, retirementRate: 0.07,
    lastMatchDate: new Date(Date.now() - 1 * 86_400_000), currentRank: 45,
    tournamentWinRate: 0.35, tournamentTotal: 3, quarterWinRates: [0.4, 0.35, 0.5, 0.45],
  });
  // Objective H2H history: A won 2 of 3. Same array passed unchanged in both directions —
  // only selResolvedId changes, exactly as a real double-sided evaluation would share one
  // frozen h2hMatches array between both scoring passes.
  const h2hMatches = [{ winner_id: "A" }, { winner_id: "A" }, { winner_id: "B" }];
  const oddsA = 1.60;
  const oddsB = 1 / (1 - 1 / oddsA); // B's own market price, not A's reused/inverted

  const testA = __TEST_computeScoring(playerA, playerB, {
    selectedPlayerName: "Player A", opponentName: "Player B",
    selResolvedId: "A", surface: "Hard", marketOdds: oddsA, h2hMatches,
  });
  const testB = __TEST_computeScoring(playerB, playerA, {
    selectedPlayerName: "Player B", opponentName: "Player A",
    selResolvedId: "B", surface: "Hard", marketOdds: oddsB, h2hMatches,
  });

  it("validationScore is complementary under swap, within integer rounding", () => {
    const sum = testA.validationScore + testB.validationScore;
    assert.ok(Math.abs(sum - 100) <= 1, `validationScore(A)+validationScore(B)=${sum}, expected 100±1`);
  });

  it("every directional factor reverses under swap (score sums to 100±1)", () => {
    const factorsA = Object.fromEntries(testA.factors.map(f => [f.key, f]));
    const factorsB = Object.fromEntries(testB.factors.map(f => [f.key, f]));
    for (const key of Object.keys(factorsA)) {
      if (key === "dataQuality") continue; // asserted separately below — intentionally non-directional
      const a = factorsA[key], b = factorsB[key];
      assert.ok(b, `factor ${key} missing from direction B`);
      const sum = a.score + b.score;
      assert.ok(Math.abs(sum - 100) <= 1,
        `factor ${key}: score(A)=${a.score} score(B)=${b.score} sum=${sum}, expected 100±1`);
    }
  });

  it("dataQuality is intentionally NOT directional — identical coverage both ways, never reverses", () => {
    const dqA = testA.factors.find(f => f.key === "dataQuality")!;
    const dqB = testB.factors.find(f => f.key === "dataQuality")!;
    assert.strictEqual(dqA.score, dqB.score, "dataQuality score must be identical regardless of evaluated side");
    assert.strictEqual(dqA.supportsSelected, null);
    assert.strictEqual(dqB.supportsSelected, null);
  });

  it("riskScore is NOT required to be complementary — asymmetric by design", () => {
    // With this deliberately lopsided pair, risk should differ substantially (not ~100-x).
    const sum = testA.riskScore + testB.riskScore;
    assert.notStrictEqual(testA.riskScore, testB.riskScore);
    // Documents the asymmetry rather than asserting a specific magnitude (which would be
    // a change-detector on unrelated risk-formula tuning); the meaningful invariant is that
    // it is NOT forced toward ~100 the way validationScore is.
    assert.ok(sum < 199, "sanity: riskScore is 0-100 per side, not a runaway value");
  });

  it("decision can differ completely between directions even though validationScore is complementary", () => {
    // This is the concrete, executable proof that a paper-trade record cannot store just
    // "KEEP" — evaluating the exact same fixture from the other side is not guaranteed (and
    // in this realistic asymmetric case, does not) produce a mirrored decision.
    function toDecisionLike(validationScore: number, riskScore: number, grade: string, coverage: number): "KEEP" | "BORDERLINE" | "REMOVE" {
      if (grade === "F" || validationScore <= 33 || riskScore >= 70) return "REMOVE";
      if (coverage < 40) return "BORDERLINE";
      if (validationScore >= 62 && riskScore <= 44) return "KEEP";
      return "BORDERLINE";
    }
    const decisionA = toDecisionLike(testA.validationScore, testA.riskScore, testA.reliabilityGrade, testA.dataCoverage);
    const decisionB = toDecisionLike(testB.validationScore, testB.riskScore, testB.reliabilityGrade, testB.dataCoverage);
    // Not asserting a fixed pair of values (that would be a change-detector on scoring
    // tuning) — asserting the STRUCTURAL claim: decision is not forced to flip in lockstep,
    // i.e. it is legitimately possible for both directions to disagree in a way that is not
    // simply KEEP<->REMOVE mirroring off validationScore's complementary sum.
    assert.ok(
      decisionA !== decisionB || (testA.riskScore === testB.riskScore),
      "when riskScore differs between directions, decision is not guaranteed to mirror validationScore's complementary symmetry",
    );
  });
});
