import { describe, expect, it } from "vitest";
import type { MetricFinding } from "./audit-pipeline";
import { mergeMetricFindingSides } from "./warehouse-first-researcher.server";

const unavailable: Omit<MetricFinding, "p1_value" | "p2_value" | "p1_treatment" | "p2_treatment"> = {
  metric_code: "001",
  differential: null,
  evidence_family: null,
  reliability: null,
  sample: null,
  unavailable_reason: null,
  sources: [],
};

describe("mergeMetricFindingSides", () => {
  it("merges independently sourced P1 and P2 values without copying orientation", () => {
    const p1Only: MetricFinding = {
      ...unavailable,
      p1_value: "PLAYER=Alpha",
      p2_value: null,
      p1_treatment: "PARTIAL" as const,
      p2_treatment: "UNAVAILABLE" as const,
    };
    const p2Only: MetricFinding = {
      ...unavailable,
      p1_value: null,
      p2_value: "PLAYER=Beta",
      p1_treatment: "UNAVAILABLE" as const,
      p2_treatment: "RECONSTRUCTED" as const,
    };
    expect(mergeMetricFindingSides(p1Only, p2Only)).toMatchObject({
      p1_value: "PLAYER=Alpha",
      p2_value: "PLAYER=Beta",
      p1_treatment: "PARTIAL",
      p2_treatment: "RECONSTRUCTED",
    });
  });

  it("does not overwrite a usable cached side with an unavailable computed side", () => {
    const cached: MetricFinding = {
      ...unavailable,
      p1_value: "PLAYER=Alpha",
      p2_value: null,
      p1_treatment: "DIRECT" as const,
      p2_treatment: "UNAVAILABLE" as const,
    };
    const computed: MetricFinding = {
      ...unavailable,
      p1_value: null,
      p2_value: null,
      p1_treatment: "UNAVAILABLE" as const,
      p2_treatment: "UNAVAILABLE" as const,
    };
    expect(mergeMetricFindingSides(cached, computed)?.p1_value).toBe("PLAYER=Alpha");
  });
});