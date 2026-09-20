import { describe, expect, it } from "vitest";
import type { MetricFinding } from "./audit-pipeline";
import { applyProviderFailurePrecedence, mergeMetricFindingSides } from "./warehouse-first-researcher.server";

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

// Live production finding: finalMetricWiringResearcher.metrics() (the live-AI tier) never
// returns a row with a null unavailable_reason -- its own fallback always carries "No
// sourced result survived the final metric wiring guard." Since that tier is always
// `primary` in mergeMetricFindingSides(live, deterministic), a concrete, specific provider
// failure (e.g. a real HTTP 402 from the BSD PBP API, captured on the `deterministic` side)
// was always silently replaced by that generic text -- the exact precedence bug this guards.
describe("applyProviderFailurePrecedence", () => {
  const genericLiveFallback: MetricFinding = {
    ...unavailable,
    p1_value: null, p2_value: null,
    p1_treatment: "UNAVAILABLE" as const, p2_treatment: "UNAVAILABLE" as const,
    unavailable_reason: "No sourced result survived the final metric wiring guard.",
  };

  it("reproduces the exact case: a PBP 402 failure survives even though the live tier's own generic fallback would otherwise win", () => {
    // This is exactly what mergeMetricFindingSides(live, deterministic) then
    // mergeMetricFindingSides(cached, computed) would produce today: live's guaranteed
    // non-null generic reason wins the coalesce, so `merged` carries the generic text --
    // the bug is that nothing downstream ever got a chance to prefer the specific one.
    const merged = mergeMetricFindingSides(genericLiveFallback, undefined);
    expect(merged?.unavailable_reason).toBe("No sourced result survived the final metric wiring guard.");

    const providerFailureReason = "BSD/Bzzoiro ATP Challenger PBP: BSD/Bzzoiro API returned HTTP 402 (payment/credits required) -- a provider billing failure, not evidence this match's point-by-point data is absent. (3 candidate match(es) affected).";
    const finalResult = applyProviderFailurePrecedence(merged!, providerFailureReason);
    expect(finalResult.unavailable_reason).toBe(providerFailureReason);
    expect(finalResult.unavailable_reason).toContain("402");
    expect(finalResult.unavailable_reason).not.toContain("wiring guard");
  });

  it("inverse: with no recorded provider failure, the generic fallback passes through completely unchanged", () => {
    const merged = mergeMetricFindingSides(genericLiveFallback, undefined)!;
    const finalResult = applyProviderFailurePrecedence(merged, undefined);
    expect(finalResult).toBe(merged); // same object -- not even a copy, confirming zero behavior change
    expect(finalResult.unavailable_reason).toBe("No sourced result survived the final metric wiring guard.");
  });

  it("never overrides a genuinely usable (fully resolved) finding, even if a provider failure was recorded earlier for this code", () => {
    const realResult: MetricFinding = {
      ...unavailable,
      p1_value: "service_point_win_pct=63.2", p2_value: "service_point_win_pct=58.1",
      p1_treatment: "RECONSTRUCTED" as const, p2_treatment: "RECONSTRUCTED" as const,
    };
    const finalResult = applyProviderFailurePrecedence(realResult, "BSD/Bzzoiro API returned HTTP 402 ...");
    expect(finalResult).toBe(realResult);
    expect(finalResult.p1_value).toBe("service_point_win_pct=63.2");
    expect(finalResult.unavailable_reason).toBe(null);
  });

  it("never fabricates a value: a one-sided result stays one-sided even with a provider-failure reason applied", () => {
    const oneSided: MetricFinding = {
      ...unavailable,
      p1_value: "x=1", p2_value: null,
      p1_treatment: "PARTIAL" as const, p2_treatment: "UNAVAILABLE" as const,
    };
    const finalResult = applyProviderFailurePrecedence(oneSided, "BSD/Bzzoiro API returned HTTP 402 ...");
    expect(finalResult.p1_value).toBe("x=1");
    expect(finalResult.p2_value).toBeNull();
    expect(finalResult.unavailable_reason).toContain("402");
  });
});