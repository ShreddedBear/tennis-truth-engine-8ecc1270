import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveFinalStatus } from "./persistPaperTrade.js";
import { deriveCrossSideAgreement } from "./crossSideAgreement.js";

describe("deriveFinalStatus", () => {
  it("FROZEN when both sides agree and neither is DATA_UNAVAILABLE", () => {
    const crossSide = deriveCrossSideAgreement(
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 70 },
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 30 },
    );
    const result = deriveFinalStatus({ decision: "KEEP" }, { decision: "REMOVE" }, crossSide);
    assert.deepStrictEqual(result, { status: "FROZEN", noDecisionReason: null });
  });

  it("NO_DECISION/BUILDER_DATA_UNAVAILABLE when BOTH sides are DATA_UNAVAILABLE, even if picks happen to agree", () => {
    const crossSide = deriveCrossSideAgreement(
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 0 },
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 0 },
    );
    const result = deriveFinalStatus({ decision: "DATA_UNAVAILABLE" }, { decision: "DATA_UNAVAILABLE" }, crossSide);
    assert.deepStrictEqual(result, { status: "NO_DECISION", noDecisionReason: "BUILDER_DATA_UNAVAILABLE" });
  });

  it("DATA_ERROR when cross-side disagreement is a genuine MODEL_DISAGREEMENT", () => {
    const crossSide = deriveCrossSideAgreement(
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 65 },
      { builderPickedPlayerId: "p2", builderCalibratedProbability: 40 },
    );
    const result = deriveFinalStatus({ decision: "KEEP" }, { decision: "KEEP" }, crossSide);
    assert.deepStrictEqual(result, { status: "DATA_ERROR", noDecisionReason: "MODEL_DISAGREEMENT" });
  });

  it("DATA_ERROR when cross-side disagreement is a TIE_BOUNDARY artifact — still fails closed, never silently resolved", () => {
    const crossSide = deriveCrossSideAgreement(
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 50 },
      { builderPickedPlayerId: "p2", builderCalibratedProbability: 49 },
    );
    const result = deriveFinalStatus({ decision: "BORDERLINE" }, { decision: "BORDERLINE" }, crossSide);
    assert.deepStrictEqual(result, { status: "DATA_ERROR", noDecisionReason: "TIE_BOUNDARY" });
  });

  it("only ONE side DATA_UNAVAILABLE still forces NO_DECISION, even if picks happen to coincide", () => {
    // The DATA_UNAVAILABLE side's builderPickedPlayerId is a hardcoded fallback (its own
    // selectedPlayerId, probability forced to 0), not a genuine pick -- any apparent
    // "agreement" with the other side is coincidental, not a real confirmation, so this must
    // NOT be treated as FROZEN just because deriveCrossSideAgreement happens to see equal ids.
    const crossSide = deriveCrossSideAgreement(
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 0 },
      { builderPickedPlayerId: "p1", builderCalibratedProbability: 65 },
    );
    const result = deriveFinalStatus({ decision: "DATA_UNAVAILABLE" }, { decision: "KEEP" }, crossSide);
    assert.deepStrictEqual(result, { status: "NO_DECISION", noDecisionReason: "BUILDER_DATA_UNAVAILABLE" });
  });
});
