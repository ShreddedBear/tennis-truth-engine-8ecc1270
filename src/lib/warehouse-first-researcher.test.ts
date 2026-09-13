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

  // Regression for the bug production data surfaced: the stored-evidence cache row
  // always sets unavailable_reason: null (see warehouse-first-researcher.server.ts's
  // `cached` construction) and is always passed as `primary`. Before this fix,
  // `{...fallback, ...primary}` let that null silently erase a real, already-stated
  // reason from `fallback` -- turning every genuine PRODUCER_FAILURE /
  // GENUINELY_UNAVAILABLE / INSUFFICIENT_SAMPLE explanation any tier actually produced
  // into an indistinguishable-from-nothing PRODUCER_FAILED_WITHOUT_REASON miss.
  it("preserves a real stated reason from fallback when primary has none (never lets a null reason erase a real one)", () => {
    const cachedLikePrimary: MetricFinding = {
      ...unavailable,
      p1_value: null,
      p2_value: null,
      p1_treatment: "UNAVAILABLE" as const,
      p2_treatment: "UNAVAILABLE" as const,
      unavailable_reason: null,
    };
    const reasonedFallback: MetricFinding = {
      ...unavailable,
      p1_value: null,
      p2_value: null,
      p1_treatment: "UNAVAILABLE" as const,
      p2_treatment: "UNAVAILABLE" as const,
      unavailable_reason: "This player has no qualifying historical events for this metric's own definition.",
    };
    const merged = mergeMetricFindingSides(cachedLikePrimary, reasonedFallback);
    expect(merged?.unavailable_reason).toBe("This player has no qualifying historical events for this metric's own definition.");
  });

  it("prefers primary's own reason when it has one, over fallback's", () => {
    const primary: MetricFinding = { ...unavailable, p1_value: null, p2_value: null, p1_treatment: "UNAVAILABLE" as const, p2_treatment: "UNAVAILABLE" as const, unavailable_reason: "primary reason" };
    const fallback: MetricFinding = { ...unavailable, p1_value: null, p2_value: null, p1_treatment: "UNAVAILABLE" as const, p2_treatment: "UNAVAILABLE" as const, unavailable_reason: "fallback reason" };
    expect(mergeMetricFindingSides(primary, fallback)?.unavailable_reason).toBe("primary reason");
  });
});