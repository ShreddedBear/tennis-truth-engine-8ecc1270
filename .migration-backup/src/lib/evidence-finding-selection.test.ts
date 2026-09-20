import { describe, expect, it } from "vitest";
import { mergeMetricFindingSides } from "./warehouse-first-researcher.server";

describe("warehouse evidence finding selection", () => {
  it("keeps pair-complete primary evidence intact", () => {
    const live = {
      metric_code: "001", p1_value: "A", p2_value: "B",
      p1_treatment: "DIRECT" as const, p2_treatment: "DIRECT" as const,
      differential: null, evidence_family: "RESULTS_SCHEDULE", reliability: 90,
      sample: null, unavailable_reason: null, sources: [],
    };
    const fallback = { ...live, p1_value: "fallback A", p2_value: "fallback B" };
    expect(mergeMetricFindingSides(live, fallback)).toMatchObject({ p1_value: "A", p2_value: "B" });
  });
});
