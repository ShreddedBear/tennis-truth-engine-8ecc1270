import { describe, expect, it } from "vitest";
import { restoreRequestedOrientation } from "./warehouse-first-researcher.server";

describe("warehouse research orientation", () => {
  it("maps every side-indexed value and failure reason back to the original match orientation", () => {
    const restored = restoreRequestedOrientation({
      metric_code: "002",
      p1_value: null,
      p2_value: "68%",
      p1_treatment: "UNAVAILABLE",
      p2_treatment: "DIRECT",
      p1_unavailable_reason: "oriented P1 missing",
      p2_unavailable_reason: null,
      differential: null,
      evidence_family: "PBP_SCORE_STATE",
      reliability: .9,
      sample: "oriented sample",
      unavailable_reason: null,
      sources: [],
    }, true);

    expect(restored.p1_value).toBe("68%");
    expect(restored.p2_value).toBeNull();
    expect(restored.p1_treatment).toBe("DIRECT");
    expect(restored.p2_treatment).toBe("UNAVAILABLE");
    expect(restored.p1_unavailable_reason).toBeNull();
    expect(restored.p2_unavailable_reason).toBe("oriented P1 missing");
  });
});