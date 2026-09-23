import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveResultType, isVoidResult, gradePaperTrade, hasMatchStarted } from "./settlementLogic.js";

describe("deriveResultType", () => {
  it("normal when no flags set", () => {
    assert.strictEqual(deriveResultType({ cancelled: false, walkover: false, retired: false }), "normal");
  });
  it("cancelled takes priority over walkover and retired", () => {
    assert.strictEqual(deriveResultType({ cancelled: true, walkover: true, retired: true }), "cancelled");
  });
  it("walkover takes priority over retired", () => {
    assert.strictEqual(deriveResultType({ cancelled: false, walkover: true, retired: true }), "walkover");
  });
  it("retired when only retired is set", () => {
    assert.strictEqual(deriveResultType({ cancelled: false, walkover: false, retired: true }), "retired");
  });
});

describe("isVoidResult", () => {
  it("cancelled and walkover are void", () => {
    assert.strictEqual(isVoidResult("cancelled"), true);
    assert.strictEqual(isVoidResult("walkover"), true);
  });
  it("retired is NOT void — a retired-match win still counts (matches Research V1's established convention)", () => {
    assert.strictEqual(isVoidResult("retired"), false);
  });
  it("normal is not void", () => {
    assert.strictEqual(isVoidResult("normal"), false);
  });
});

describe("gradePaperTrade — THE central rule: grades builderPickedPlayerId, nothing else", () => {
  it("correct when actualWinnerId equals builderPickedPlayerId", () => {
    const result = gradePaperTrade({ builderPickedPlayerId: "p1", actualWinnerId: "p1", resultType: "normal" });
    assert.deepStrictEqual(result, { includedInAccuracy: true, gradedCorrect: true });
  });

  it("incorrect when actualWinnerId differs from builderPickedPlayerId", () => {
    const result = gradePaperTrade({ builderPickedPlayerId: "p1", actualWinnerId: "p2", resultType: "normal" });
    assert.deepStrictEqual(result, { includedInAccuracy: true, gradedCorrect: false });
  });

  // THE explicit wrong-side trap the user asked for: construct a synthetic scenario where
  // actual_winner_id equals the EVALUATED/SELECTED player but DIFFERS from
  // builder_picked_player_id, and confirm the trade grades INCORRECT. This proves the old
  // human-selection semantics (builder_decision_log/parlay_leg_outcomes' "did the caller's pick
  // win") cannot accidentally leak into this autonomous accuracy calculation, which must never
  // reference selectedPlayerId at all.
  it("WRONG-SIDE TRAP: actualWinnerId equals selectedPlayerId but differs from builderPickedPlayerId -> graded INCORRECT", () => {
    const selectedPlayerId = "playerA"; // the nominal "evaluated" player for this row/side
    const builderPickedPlayerId = "playerB"; // the Builder's own independent pick, THE prediction
    const actualWinnerId = "playerA"; // the match's real winner happens to equal selectedPlayerId

    // If grading ever accidentally compared against selectedPlayerId (the old validate-a-pick
    // semantics) instead of builderPickedPlayerId, this would incorrectly grade "correct" --
    // grading must not even receive selectedPlayerId as an input.
    const result = gradePaperTrade({ builderPickedPlayerId, actualWinnerId, resultType: "normal" });
    assert.strictEqual(result.gradedCorrect, false,
      "grading must compare against builderPickedPlayerId only -- actualWinnerId matching selectedPlayerId must NOT count as correct");
    assert.strictEqual(result.includedInAccuracy, true);
    // GradingInput's type has no selectedPlayerId field at all -- it is structurally impossible
    // to pass one in, which is the real, compile-time-enforced guarantee this test documents.
  });

  it("not yet gradeable: actualWinnerId is null (match not settled)", () => {
    const result = gradePaperTrade({ builderPickedPlayerId: "p1", actualWinnerId: null, resultType: "normal" });
    assert.deepStrictEqual(result, { includedInAccuracy: false, gradedCorrect: null });
  });

  it("cancelled match excluded from accuracy, not counted as wrong", () => {
    const result = gradePaperTrade({ builderPickedPlayerId: "p1", actualWinnerId: "p2", resultType: "cancelled" });
    assert.deepStrictEqual(result, { includedInAccuracy: false, gradedCorrect: null });
  });

  it("walkover excluded from accuracy, not counted as wrong", () => {
    const result = gradePaperTrade({ builderPickedPlayerId: "p1", actualWinnerId: "p2", resultType: "walkover" });
    assert.deepStrictEqual(result, { includedInAccuracy: false, gradedCorrect: null });
  });

  it("retired match IS graded (not void) — a retired-match win still counts", () => {
    const result = gradePaperTrade({ builderPickedPlayerId: "p1", actualWinnerId: "p1", resultType: "retired" });
    assert.deepStrictEqual(result, { includedInAccuracy: true, gradedCorrect: true });
  });
});

describe("hasMatchStarted", () => {
  const scheduled = new Date("2026-09-23T12:00:00Z");
  it("false before scheduled start", () => {
    assert.strictEqual(hasMatchStarted(scheduled, new Date(scheduled.getTime() - 1)), false);
  });
  it("true exactly at scheduled start", () => {
    assert.strictEqual(hasMatchStarted(scheduled, new Date(scheduled.getTime())), true);
  });
  it("true after scheduled start", () => {
    assert.strictEqual(hasMatchStarted(scheduled, new Date(scheduled.getTime() + 1)), true);
  });
});
