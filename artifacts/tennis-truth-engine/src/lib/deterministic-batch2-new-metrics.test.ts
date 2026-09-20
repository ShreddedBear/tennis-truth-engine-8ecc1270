import { describe, expect, it } from "vitest";
import { deterministicBatch2NewMetric } from "./deterministic-batch2-new-metrics.server";

// Integration-style tests against the real generated static history index --
// same pattern and fixture pair as deterministic-batch1-standalone-metrics.test.ts.
const P1 = "zdenek kolar";
const P2 = "andrea collarini";
const LANE = "ATP_CHALLENGER" as const;
const AS_OF = "2026-08-29";

describe("deterministicBatch2NewMetric (live pipeline wiring for 020/036/045/052)", () => {
  it("returns null for a code it does not own", async () => {
    const result = await deterministicBatch2NewMetric({ metricCode: "005", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
  });

  it("returns null when tourFamily is not resolved", async () => {
    const result = await deterministicBatch2NewMetric({ metricCode: "020", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: null });
    expect(result).toBeNull();
  });

  it("020 Level/Tour Transition: produces a real finding on every tour lane pair with data", async () => {
    const result = await deterministicBatch2NewMetric({ metricCode: "020", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).not.toBeNull();
    expect(result!.p1_treatment).toBe("RECONSTRUCTED");
    expect(result!.p1_value).toMatch(/matches_used=/);
    expect(result!.evidence_family).toBe("STANDALONE_LEVEL_TOUR_TRANSITION");
  });

  it("036 Loss Autopsy: produces a real finding for a data-rich pair", async () => {
    const result = await deterministicBatch2NewMetric({ metricCode: "036", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).not.toBeNull();
    expect(result!.p1_value).toMatch(/bad_loss_severity_index=/);
  });

  it("045 Favorite Fragility: produces a real finding on an eligible lane", async () => {
    const result = await deterministicBatch2NewMetric({ metricCode: "045", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).not.toBeNull();
    expect(result!.p1_value).toMatch(/eligible_matches_n=/);
  });

  it("045: falls through to null on ATP_MAIN (no set_scores)", async () => {
    const result = await deterministicBatch2NewMetric({ metricCode: "045", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: "ATP_MAIN" });
    expect(result).toBeNull();
  });

  it("052 Entropy & Lead Durability: produces a real finding on an eligible lane", async () => {
    const result = await deterministicBatch2NewMetric({ metricCode: "052", p1: P1, p2: P2, asOfDate: AS_OF, tourFamily: LANE });
    expect(result).not.toBeNull();
    expect(result!.p1_value).toMatch(/set_score_entropy_bits=/);
  });

  it("returns null for a nonexistent player pair (honest fall-through)", async () => {
    const result = await deterministicBatch2NewMetric({ metricCode: "020", p1: "totally fictional one", p2: "totally fictional two", asOfDate: AS_OF, tourFamily: LANE });
    expect(result).toBeNull();
  });
});
