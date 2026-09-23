import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveCrossSideAgreement } from "./crossSideAgreement.js";

describe("deriveCrossSideAgreement", () => {
  it("agrees when both sides physically pick the same player", () => {
    const result = deriveCrossSideAgreement(
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 70 },
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 30 },
    );
    assert.deepStrictEqual(result, { agreement: true, reason: null });
  });

  it("TIE_BOUNDARY when player1-evaluation probability is exactly 50 and picks differ", () => {
    const result = deriveCrossSideAgreement(
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 50 },
      { builderPickedPlayerId: "p2", builderCalibratedProbability: 49 },
    );
    assert.strictEqual(result.agreement, false);
    if (!result.agreement) assert.strictEqual(result.reason, "TIE_BOUNDARY");
  });

  it("TIE_BOUNDARY when player2-evaluation probability is exactly 50 and picks differ", () => {
    const result = deriveCrossSideAgreement(
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 51 },
      { builderPickedPlayerId: "p2", builderCalibratedProbability: 50 },
    );
    assert.strictEqual(result.agreement, false);
    if (!result.agreement) assert.strictEqual(result.reason, "TIE_BOUNDARY");
  });

  it("MODEL_DISAGREEMENT when picks differ and neither side is at the tie boundary", () => {
    const result = deriveCrossSideAgreement(
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 65 },
      { builderPickedPlayerId: "p2", builderCalibratedProbability: 40 },
    );
    assert.strictEqual(result.agreement, false);
    if (!result.agreement) assert.strictEqual(result.reason, "MODEL_DISAGREEMENT");
  });

  it("never silently resolves a disagreement — result always exposes both raw picks via detail", () => {
    const result = deriveCrossSideAgreement(
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 65 },
      { builderPickedPlayerId: "p2", builderCalibratedProbability: 40 },
    );
    assert.strictEqual(result.agreement, false);
    if (!result.agreement) {
      assert.ok(result.detail.includes("p1"));
      assert.ok(result.detail.includes("p2"));
    }
  });

  it("agreement holds even when both sides are exactly at 50 and pick the same player", () => {
    // Degenerate but structurally valid: both calibrated to 50, both tie-break to their own
    // "selected" role -- if that happens to be the SAME physical player (shouldn't normally,
    // but the function must not crash or misclassify agreement as disagreement).
    const result = deriveCrossSideAgreement(
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 50 },
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 50 },
    );
    assert.deepStrictEqual(result, { agreement: true, reason: null });
  });
});
