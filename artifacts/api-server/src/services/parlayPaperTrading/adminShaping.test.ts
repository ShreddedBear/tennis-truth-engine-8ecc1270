import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shapePairSummary, shapePairDetail, withCrossSideIntegrity } from "./adminShaping.js";
import type { ParlayPaperTradeRow, ParlayPaperTradePairRow, ParlayPaperTradeFactorRow, ParlayPaperTradeSnapshotRow } from "@workspace/db";

function makeTrade(overrides: Partial<ParlayPaperTradeRow> = {}): ParlayPaperTradeRow {
  const now = new Date("2026-09-24T10:00:00Z");
  return {
    id: 1,
    paperTradeId: "trade-1",
    pairId: "pair-1",
    externalFixtureId: "lta-12345",
    fixtureProvider: "live-tennis-api",
    player1Id: "p1", player1Name: "Player One",
    player2Id: "p2", player2Name: "Player Two",
    tournamentName: "Test Open", tournamentLevel: null, round: null,
    surface: "Hard", matchFormat: null,
    scheduledStartAt: new Date("2026-09-24T14:00:00Z"),
    evaluatedSide: "PLAYER_1",
    selectedPlayerId: "p1", opposingPlayerId: "p2",
    status: "FROZEN", noDecisionReason: null,
    discoveredAt: now, decisionCutoffAt: new Date("2026-09-24T13:30:00Z"),
    decisionAt: now, frozenAt: now, matchStartedAt: null, outcomeAttachedAt: null, gradedAt: null,
    builderVersion: "1.0.0", builderConfigFingerprint: "fp-abc", builderLineageStatus: "VALID_HISTORICAL_LINEAGE",
    builderLineageReason: "reason", calibrationModelId: 3, lineageKey: "fp-abc:3:VALID_HISTORICAL_LINEAGE",
    decision: "KEEP", selectedPlayerScore: 70, selectedPlayerRiskScore: 20,
    builderPickedPlayerId: "p1", builderCalibratedProbability: 65,
    rawValidationScore: 68, dataCoverage: 90,
    sourceCommit: "abc123", snapshotFingerprint: "snap-fp",
    actualWinnerId: null, resultType: null, includedInAccuracy: null, gradedCorrect: null,
    createdAt: now,
    ...overrides,
  } as ParlayPaperTradeRow;
}

describe("shapePairSummary", () => {
  it("presents both sibling side records together in one row", () => {
    const p1 = makeTrade({ evaluatedSide: "PLAYER_1", selectedPlayerId: "p1", decision: "KEEP" });
    const p2 = makeTrade({ evaluatedSide: "PLAYER_2", selectedPlayerId: "p2", decision: "REMOVE" });
    const summary = shapePairSummary(p1, p2);
    assert.strictEqual(summary.sides.player1.decision, "KEEP");
    assert.strictEqual(summary.sides.player2.decision, "REMOVE");
    assert.strictEqual(summary.sides.player1.selectedPlayerId, "p1");
    assert.strictEqual(summary.sides.player2.selectedPlayerId, "p2");
  });

  it("order-independent: works whether trade1 is PLAYER_1 or PLAYER_2", () => {
    const p1 = makeTrade({ evaluatedSide: "PLAYER_1" });
    const p2 = makeTrade({ evaluatedSide: "PLAYER_2" });
    const summaryA = shapePairSummary(p1, p2);
    const summaryB = shapePairSummary(p2, p1);
    assert.deepStrictEqual(summaryA, summaryB);
  });

  it("throws on mismatched pair ids (caller bug, not silently tolerated)", () => {
    const p1 = makeTrade({ pairId: "pair-1", evaluatedSide: "PLAYER_1" });
    const p2 = makeTrade({ pairId: "pair-2", evaluatedSide: "PLAYER_2" });
    assert.throws(() => shapePairSummary(p1, p2));
  });

  it("throws when both rows are the same side (not a valid pair)", () => {
    const p1 = makeTrade({ evaluatedSide: "PLAYER_1" });
    const p1again = makeTrade({ evaluatedSide: "PLAYER_1" });
    assert.throws(() => shapePairSummary(p1, p1again));
  });

  // THE central UI/data requirement: autonomous Builder pick must be a structurally distinct
  // field from either side's `decision` (KEEP/BORDERLINE/REMOVE), never presentable as if KEEP
  // meant "the Builder picked this player."
  it("autonomous builderPickedPlayerId is a top-level field, structurally separate from each side's decision", () => {
    const p1 = makeTrade({ evaluatedSide: "PLAYER_1", decision: "REMOVE", builderPickedPlayerId: "p1" });
    const p2 = makeTrade({ evaluatedSide: "PLAYER_2", decision: "KEEP", builderPickedPlayerId: "p1" });
    const summary = shapePairSummary(p1, p2);
    // The Builder's actual prediction is p1 (agreed by both sides) -- even though PLAYER_1's own
    // *validation* decision was REMOVE and PLAYER_2's was KEEP. These must never be conflated.
    assert.strictEqual(summary.builderPickedPlayerId, "p1");
    assert.strictEqual(summary.builderPickedPlayerName, "Player One");
    assert.strictEqual(summary.sides.player1.decision, "REMOVE");
    assert.strictEqual(summary.sides.player2.decision, "KEEP");
    assert.notStrictEqual(summary.builderPickedPlayerId, summary.sides.player1.decision);
  });

  it("resolves builderPickedPlayerName correctly for player2 as the pick", () => {
    const p1 = makeTrade({ evaluatedSide: "PLAYER_1", builderPickedPlayerId: "p2" });
    const p2 = makeTrade({ evaluatedSide: "PLAYER_2", builderPickedPlayerId: "p2" });
    const summary = shapePairSummary(p1, p2);
    assert.strictEqual(summary.builderPickedPlayerName, "Player Two");
  });

  // Regression: builderCalibratedProbability is stored per-side as "P(this row's own
  // selectedPlayerId wins)", NOT "P(builderPickedPlayerId wins)" -- only builderPickedPlayerId
  // itself is guaranteed identical on both sibling rows. Reading p1's raw value unconditionally
  // (the old behavior) silently returns "P(player1 wins)" even when the pick is player2 -- e.g.
  // the real fixture 35781 case: P1 eval stored 39 (P(Basiletti wins)), P2 eval stored 63
  // (P(Ristic wins)), pick = Ristic. The correct canonical number is 63, never 39.
  it("canonical probability reads the SIDE WHOSE OWN selectedPlayerId equals the pick, not always PLAYER_1's stored value", () => {
    const p1 = makeTrade({
      evaluatedSide: "PLAYER_1", selectedPlayerId: "p1",
      builderPickedPlayerId: "p2", builderCalibratedProbability: 39,
    });
    const p2 = makeTrade({
      evaluatedSide: "PLAYER_2", selectedPlayerId: "p2",
      builderPickedPlayerId: "p2", builderCalibratedProbability: 63,
    });
    const summary = shapePairSummary(p1, p2);
    assert.strictEqual(summary.builderPickedPlayerId, "p2");
    assert.strictEqual(summary.builderCalibratedProbability, 63);
    assert.notStrictEqual(summary.builderCalibratedProbability, 39);
  });

  it("canonical probability reads PLAYER_1's own value when the pick IS player1 (the already-correct case stays correct)", () => {
    const p1 = makeTrade({
      evaluatedSide: "PLAYER_1", selectedPlayerId: "p1",
      builderPickedPlayerId: "p1", builderCalibratedProbability: 74,
    });
    const p2 = makeTrade({
      evaluatedSide: "PLAYER_2", selectedPlayerId: "p2",
      builderPickedPlayerId: "p1", builderCalibratedProbability: 26,
    });
    const summary = shapePairSummary(p1, p2);
    assert.strictEqual(summary.builderCalibratedProbability, 74);
  });

  it("canonical probability is null when there is no pick (e.g. NO_DECISION), never a stale number", () => {
    const p1 = makeTrade({ evaluatedSide: "PLAYER_1", builderPickedPlayerId: null, builderCalibratedProbability: 0 });
    const p2 = makeTrade({ evaluatedSide: "PLAYER_2", builderPickedPlayerId: null, builderCalibratedProbability: 0 });
    const summary = shapePairSummary(p1, p2);
    assert.strictEqual(summary.builderCalibratedProbability, null);
  });

  it("null builderPickedPlayerId (e.g. NO_DECISION) yields null name, not a crash", () => {
    const p1 = makeTrade({ evaluatedSide: "PLAYER_1", builderPickedPlayerId: null, status: "NO_DECISION" });
    const p2 = makeTrade({ evaluatedSide: "PLAYER_2", builderPickedPlayerId: null, status: "NO_DECISION" });
    const summary = shapePairSummary(p1, p2);
    assert.strictEqual(summary.builderPickedPlayerId, null);
    assert.strictEqual(summary.builderPickedPlayerName, null);
  });
});

describe("withCrossSideIntegrity", () => {
  it("makes cross-side disagreement visible on the summary", () => {
    const p1 = makeTrade({ evaluatedSide: "PLAYER_1" });
    const p2 = makeTrade({ evaluatedSide: "PLAYER_2" });
    const summary = shapePairSummary(p1, p2);
    const withIntegrity = withCrossSideIntegrity(summary, {
      crossSideAgreement: false,
      crossSideDisagreementReason: "MODEL_DISAGREEMENT",
    } as ParlayPaperTradePairRow);
    assert.strictEqual(withIntegrity.crossSideAgreement, false);
    assert.strictEqual(withIntegrity.crossSideDisagreementReason, "MODEL_DISAGREEMENT");
  });
});

describe("shapePairDetail", () => {
  const factors1: ParlayPaperTradeFactorRow[] = [{
    id: 1, paperTradeId: "trade-1", factorKey: "surfaceElo", factorLabel: "Surface Elo",
    score: 60, weight: 0.153, status: "available", supportsSelected: true, detail: "detail",
    createdAt: new Date(),
  } as ParlayPaperTradeFactorRow];
  const factors2: ParlayPaperTradeFactorRow[] = [{
    id: 2, paperTradeId: "trade-2", factorKey: "surfaceElo", factorLabel: "Surface Elo",
    score: 40, weight: 0.153, status: "available", supportsSelected: false, detail: "detail",
    createdAt: new Date(),
  } as ParlayPaperTradeFactorRow];

  it("includes both directional evaluations with their own factor arrays", () => {
    const p1 = makeTrade({ evaluatedSide: "PLAYER_1" });
    const p2 = makeTrade({ evaluatedSide: "PLAYER_2" });
    const detail = shapePairDetail(p1, p2, null, null, factors1, factors2);
    assert.strictEqual(detail.directionalEvaluations.player1.factors.length, 1);
    assert.strictEqual(detail.directionalEvaluations.player2.factors.length, 1);
    assert.strictEqual(detail.directionalEvaluations.player1.factors[0]!.score, 60);
    assert.strictEqual(detail.directionalEvaluations.player2.factors[0]!.score, 40);
  });

  it("autonomousPrediction is a separate section from directionalEvaluations' decisions", () => {
    const p1 = makeTrade({ evaluatedSide: "PLAYER_1", decision: "BORDERLINE", builderPickedPlayerId: "p2" });
    const p2 = makeTrade({ evaluatedSide: "PLAYER_2", decision: "KEEP", builderPickedPlayerId: "p2" });
    const detail = shapePairDetail(p1, p2, null, null, [], []);
    assert.strictEqual(detail.autonomousPrediction.builderPickedPlayerId, "p2");
    assert.strictEqual(detail.autonomousPrediction.builderPickedPlayerName, "Player Two");
    assert.strictEqual(detail.directionalEvaluations.player1.decision, "BORDERLINE");
    assert.strictEqual(detail.directionalEvaluations.player2.decision, "KEEP");
    // Neither side's `decision` string ever equals the prediction's player-id shape --
    // structurally distinct fields, not just conventionally different values.
    assert.ok(!("builderPickedPlayerId" in detail.directionalEvaluations.player1));
  });

  // Same regression as shapePairSummary's canonical-probability test, but for the detail shape --
  // the real fixture 35781 numbers (P1=39, P2=63, pick=Ristic/p2).
  it("autonomousPrediction.builderCalibratedProbability reads the picked side's own value, not always PLAYER_1's", () => {
    const p1 = makeTrade({
      evaluatedSide: "PLAYER_1", selectedPlayerId: "p1",
      builderPickedPlayerId: "p2", builderCalibratedProbability: 39,
    });
    const p2 = makeTrade({
      evaluatedSide: "PLAYER_2", selectedPlayerId: "p2",
      builderPickedPlayerId: "p2", builderCalibratedProbability: 63,
    });
    const detail = shapePairDetail(p1, p2, null, null, [], []);
    assert.strictEqual(detail.autonomousPrediction.builderCalibratedProbability, 63);
  });

  it("surfaces lineage, integrity, and outcome sections completely", () => {
    const p1 = makeTrade({
      evaluatedSide: "PLAYER_1", actualWinnerId: "p1", resultType: "normal",
      includedInAccuracy: true, gradedCorrect: true,
    });
    const p2 = makeTrade({
      evaluatedSide: "PLAYER_2", actualWinnerId: "p1", resultType: "normal",
      includedInAccuracy: true, gradedCorrect: true,
    });
    const pairRow = {
      crossSideAgreement: true, crossSideDisagreementReason: null,
      crossSideCheckedAt: new Date("2026-09-24T13:00:00Z"),
    } as ParlayPaperTradePairRow;
    const snapshotRow = {
      effectiveCeiling: new Date("2026-09-24T13:30:00Z"),
      createdAt: new Date("2026-09-24T12:59:00Z"),
    } as ParlayPaperTradeSnapshotRow;

    const detail = shapePairDetail(p1, p2, pairRow, snapshotRow, [], []);
    assert.strictEqual(detail.lineage.builderVersion, "1.0.0");
    assert.strictEqual(detail.lineage.calibrationModelId, 3);
    assert.strictEqual(detail.integrity.crossSideAgreement, true);
    assert.strictEqual(detail.integrity.evidenceCutoff, "2026-09-24T13:30:00.000Z");
    assert.strictEqual(detail.outcome.actualWinnerId, "p1");
    assert.strictEqual(detail.outcome.gradedCorrect, true);
  });

  it("handles missing pairRow/snapshotRow gracefully (e.g. an ineligible fixture with no evidence acquired)", () => {
    const p1 = makeTrade({ evaluatedSide: "PLAYER_1", status: "INELIGIBLE", builderPickedPlayerId: null });
    const p2 = makeTrade({ evaluatedSide: "PLAYER_2", status: "INELIGIBLE", builderPickedPlayerId: null });
    const detail = shapePairDetail(p1, p2, null, null, [], []);
    assert.strictEqual(detail.integrity.crossSideAgreement, null);
    assert.strictEqual(detail.integrity.evidenceCutoff, null);
  });
});
