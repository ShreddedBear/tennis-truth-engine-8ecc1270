import { describe, expect, it } from "vitest";
import { deterministicBatch3EarlyWarningMetric } from "./deterministic-batch3-early-warning.server";

// Integration-style tests against the real pipeline wiring. Unlike batch1/batch2 (pure
// replays over the in-memory static index), 026's cross-match aggregation makes a real
// live BSD API call per candidate match -- without BSD_TENNIS_API_KEY set (the case in
// this test environment, same as every other bsd-*-pbp.server.ts file, which also has no
// dedicated network-behavior test), the fetch returns null for every candidate, so the
// real-data path below exercises the "honest fall-through when nothing is fetchable"
// behavior rather than a full GO result -- the aggregation math itself is already fully
// covered by audit-metric-026-early-warning-slow-start.test.ts's injected-fetcher tests.
const P1 = "novak djokovic";
const P2 = "carlos alcaraz";
const AS_OF = "2026-08-29";

describe("deterministicBatch3EarlyWarningMetric (live pipeline wiring for 026)", () => {
  it("returns null for a code it does not own", async () => {
    const result = await deterministicBatch3EarlyWarningMetric({ metricCode: "020", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: "ATP_MAIN" });
    expect(result).toBeNull();
  });

  it("returns null when tourFamily is not resolved", async () => {
    const result = await deterministicBatch3EarlyWarningMetric({ metricCode: "026", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: null });
    expect(result).toBeNull();
  });

  it("falls through to null (never throws) for WTA_CHALLENGER -- structurally no per-game PBP chronology", async () => {
    const result = await deterministicBatch3EarlyWarningMetric({ metricCode: "026", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: "WTA_CHALLENGER" });
    expect(result).toBeNull();
  });

  it("falls through to null without a live BSD API token rather than fabricating a finding", async () => {
    const result = await deterministicBatch3EarlyWarningMetric({ metricCode: "026", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: "ATP_MAIN" });
    expect(result).toBeNull();
  });

  it("returns null for a nonexistent player pair (honest fall-through)", async () => {
    const result = await deterministicBatch3EarlyWarningMetric({ metricCode: "026", p1: "totally fictional one", p2: "totally fictional two", asOfDate: AS_OF, tourFamily: "ATP_MAIN" });
    expect(result).toBeNull();
  });
});
