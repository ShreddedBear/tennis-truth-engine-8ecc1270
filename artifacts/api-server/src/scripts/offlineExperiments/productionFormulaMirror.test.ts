/**
 * Pinning test for productionFormulaMirror.ts.
 *
 * Every expected value below was computed BY HAND by reading the real formulas in
 * builderScoringService.ts (pinned commit db28f8371f2ec4bbfc2b2b3d0e341011cfd8f788) and
 * evaluating them on paper — not guessed, and not derived by running the mirror itself (that
 * would make this test tautological). If builderScoringService.ts's mirrored functions ever
 * change, this test is the mechanism that should catch the drift the next time someone
 * remembers to update the mirror and re-derive these numbers by hand again.
 *
 * All input/output pairs here are synthetic, hand-picked values — not real database rows.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  closenessRiskFloor,
  toReliabilityGrade,
  toParlayGrade,
  toDecision,
  computeRemovalProbability,
  distanceToKeepLine,
  distanceToRemoveLine,
  computeClosenessComponents,
  computeValidationScoreAndCoverage,
  reweightMarketConsensus,
} from "./productionFormulaMirror.js";

test("closenessRiskFloor: below/at 50 -> 0", () => {
  assert.equal(closenessRiskFloor(0), 0);
  assert.equal(closenessRiskFloor(50), 0);
});

test("closenessRiskFloor: linear ramp 50->80 maps to 0->40", () => {
  // cs=65: ((65-50)/30)*40 = 20
  assert.equal(closenessRiskFloor(65), 20);
  assert.equal(closenessRiskFloor(80), 40);
});

test("closenessRiskFloor: shallower ramp 80->100 maps to 40->55", () => {
  // cs=90: 40 + ((90-80)/20)*15 = 40 + 7.5 = 47.5 -> rounds to 48
  assert.equal(closenessRiskFloor(90), 48);
  assert.equal(closenessRiskFloor(100), 55);
});

test("toReliabilityGrade: high score + high coverage -> A", () => {
  assert.equal(toReliabilityGrade(85, 90), "A");
});

test("toReliabilityGrade: coverage caps the grade below what the score alone would earn", () => {
  // scoreGrade for 85 is A, but coverage=40 caps at D (35<=40<50)
  assert.equal(toReliabilityGrade(85, 40), "D");
});

test("toReliabilityGrade: score caps the grade below what coverage alone would allow", () => {
  // coverage=90 allows A, but validationScore=40 only earns D (38<=40<50)
  assert.equal(toReliabilityGrade(40, 90), "D");
});

test("toParlayGrade: adj>=58 and grade<=B -> Elite", () => {
  // adj = 80 - 20*0.35 = 73
  assert.equal(toParlayGrade(80, 20, "A"), "Elite");
});

test("toParlayGrade: adj in [22,34) -> Weak", () => {
  // adj = 50 - 50*0.35 = 32.5
  assert.equal(toParlayGrade(50, 50, "C"), "Weak");
});

test("toParlayGrade: very low adj -> Reject", () => {
  // adj = 20 - 80*0.35 = -8
  assert.equal(toParlayGrade(20, 80, "F"), "Reject");
});

test("toDecision: val>=62 and risk<=44 -> KEEP", () => {
  assert.equal(toDecision(70, 30, "B", 80, []), "KEEP");
});

test("toDecision: val<=33 -> REMOVE regardless of risk", () => {
  assert.equal(toDecision(20, 10, "C", 80, []), "REMOVE");
});

test("toDecision: risk>=70 -> REMOVE regardless of validationScore", () => {
  assert.equal(toDecision(90, 70, "A", 80, []), "REMOVE");
});

test("toDecision: middling values with no critical flags -> BORDERLINE", () => {
  assert.equal(toDecision(50, 50, "C", 80, []), "BORDERLINE");
});

test("toDecision: critical flag forces BORDERLINE even if KEEP thresholds are met", () => {
  assert.equal(toDecision(70, 30, "B", 80, ["injury concern reported"]), "BORDERLINE");
});

test("computeRemovalProbability matches (100-val)*0.55 + risk*0.45", () => {
  assert.equal(computeRemovalProbability(70, 30), 30); // 16.5+13.5=30
  assert.equal(computeRemovalProbability(50, 50), 50); // 27.5+22.5=50
});

test("distanceToKeepLine: binding constraint is the smaller of the two margins", () => {
  // valMargin = 70-62=8, riskMargin = 44-30=14 -> min=8
  assert.equal(distanceToKeepLine(70, 30), 8);
});

test("distanceToRemoveLine: closer-to-crossing margin (max of the two) wins", () => {
  // valMargin=33-70=-37, riskMargin=30-70=-40 -> max=-37
  assert.equal(distanceToRemoveLine(70, 30), -37);
});

test("computeClosenessComponents: all four signals present, hand-computed average", () => {
  const result = computeClosenessComponents({
    selWinRate: 0.6,
    oppWinRate: 0.5,
    selWinRateConfidence: 1,
    oppWinRateConfidence: 1,
    surface: "Hard",
    selSurfaceTotal: 10,
    oppSurfaceTotal: 10,
    selSurfaceWinRate: 0.6,
    oppSurfaceWinRate: 0.55,
    marketOdds: 2.0,
    selRank: 10,
    oppRank: 20,
  });
  // winRateGap=0.1 -> raw=(1-0.1/0.4)*100=75, conf=1 -> 75
  assert.equal(result.winRateGapSignal, 75);
  // surfaceGap=0.05 -> (1-0.05/0.4)*100=87.5 -> rounds to 88
  assert.equal(result.surfaceGapSignal, 88);
  // marketOdds=2.0 -> impliedProb=0.5 -> (1-0)*100=100
  assert.equal(result.marketGapSignal, 100);
  // rankGap = |10-20|/20 = 0.5 -> (1-0.5)*100=50
  assert.equal(result.rankingGapSignal, 50);
  // average of 75,88,100,50 = 313/4 = 78.25 -> rounds to 78
  assert.equal(result.closenessScore, 78);
});

test("computeValidationScoreAndCoverage: weighted average over available factors only, coverage from unavailable weight", () => {
  const factors = [
    { score: 80, weight: 0.5, status: "available" as const },
    { score: 40, weight: 0.3, status: "available" as const },
    { score: 50, weight: 0.2, status: "unavailable" as const },
  ];
  const { validationScore, dataCoverage } = computeValidationScoreAndCoverage(factors);
  // availF weight sum = 0.8; validationScore = round(80*0.5/0.8 + 40*0.3/0.8) = round(50+15) = 65
  assert.equal(validationScore, 65);
  // unavailW = 0.2 -> dataCoverage = round((1-0.2)*100) = 80
  assert.equal(dataCoverage, 80);
});

test("reweightMarketConsensus: redistributes the delta proportionally across the other factors, sum stays 1.0", () => {
  const factors = [
    { key: "marketConsensus", weight: 0.1 },
    { key: "a", weight: 0.3 },
    { key: "b", weight: 0.6 },
  ];
  const result = reweightMarketConsensus(factors, 0.2);
  const mc = result.find((f) => f.key === "marketConsensus")!;
  const a = result.find((f) => f.key === "a")!;
  const b = result.find((f) => f.key === "b")!;
  assert.equal(mc.weight, 0.2);
  // scale = (1-0.2)/(1-0.1) = 0.8/0.9 = 0.888889
  assert.ok(Math.abs(a.weight - 0.3 * (0.8 / 0.9)) < 1e-9, `a.weight=${a.weight}`);
  assert.ok(Math.abs(b.weight - 0.6 * (0.8 / 0.9)) < 1e-9, `b.weight=${b.weight}`);
  const total = mc.weight + a.weight + b.weight;
  assert.ok(Math.abs(total - 1) < 1e-9, `weights must still sum to 1.0, got ${total}`);
});

test("reweightMarketConsensus: throws when no marketConsensus factor is present", () => {
  assert.throws(() => reweightMarketConsensus([{ key: "a", weight: 1 }], 0.2), /marketConsensus/);
});

test("computeClosenessComponents: missing data gates a signal out entirely (not zeroed)", () => {
  const result = computeClosenessComponents({
    selWinRate: 0.5,
    oppWinRate: 0.5,
    selWinRateConfidence: 0, // gates out winRate signal
    oppWinRateConfidence: 0,
    surface: null, // gates out surface signal
    selSurfaceTotal: 0,
    oppSurfaceTotal: 0,
    selSurfaceWinRate: 0.5,
    oppSurfaceWinRate: 0.5,
    marketOdds: null, // gates out market signal
    selRank: null, // gates out ranking signal
    oppRank: null,
  });
  assert.equal(result.winRateGapSignal, null);
  assert.equal(result.surfaceGapSignal, null);
  assert.equal(result.marketGapSignal, null);
  assert.equal(result.rankingGapSignal, null);
  // no signals present -> neutral default of 50, per the mirrored production logic
  assert.equal(result.closenessScore, 50);
});
