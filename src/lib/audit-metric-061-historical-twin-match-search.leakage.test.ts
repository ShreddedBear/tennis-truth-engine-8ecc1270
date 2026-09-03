import { describe, expect, it } from "vitest";
import { computeHistoricalTwinMatchSearchForLane } from "./audit-metric-061-historical-twin-match-search";

// This wrapper does not implement its own chronological replay -- it delegates entirely to
// historical-twin-match-search.server.ts's computeHistoricalTwinMatchSearch, which is
// already covered by a synthetic-fixture leakage test (historical-twin-match-search.test.ts:
// "blocks future-match leakage by construction (relies on laneMatchesBefore)"). This file
// instead verifies the one thing this wrapper itself adds -- resolving asOfDate through to
// the real lane data via loadRuntimeIndex -- never lets a later asOfDate silently drop
// history that was already visible at an earlier one, using the real generated index.
describe("metric #061 leakage safety (live wrapper against the real generated index)", () => {
  const PLAYER = "andrea collarini";
  const OPPONENT = "zdenek kolar";
  const LANE = "ATP_CHALLENGER" as const;

  function candidatePool(sample: string): number {
    return Number(sample.match(/candidate_pool=(\d+)/)?.[1] ?? 0);
  }

  it("a later asOfDate never shrinks the candidate pool relative to an earlier one -- monotonic history growth", () => {
    const early = computeHistoricalTwinMatchSearchForLane({ p1: PLAYER, p2: OPPONENT, lane: LANE, asOfDate: "2025-01-01" });
    const late = computeHistoricalTwinMatchSearchForLane({ p1: PLAYER, p2: OPPONENT, lane: LANE, asOfDate: "2026-08-29" });
    expect(late.status).toBe("GO");
    if (early.status === "GO" && late.status === "GO") {
      expect(candidatePool(late.value.sample)).toBeGreaterThanOrEqual(candidatePool(early.value.sample));
    }
  });

  it("excludes all history entirely when asOfDate is years before any recorded history", () => {
    const wayBefore = computeHistoricalTwinMatchSearchForLane({ p1: PLAYER, p2: OPPONENT, lane: LANE, asOfDate: "1990-01-01" });
    expect(wayBefore.status).toBe("NOT_ENOUGH_DATA");
  });

  it("the same date produces an identical result across repeated calls (deterministic, no hidden clock/state leakage)", () => {
    const a = computeHistoricalTwinMatchSearchForLane({ p1: PLAYER, p2: OPPONENT, lane: LANE, asOfDate: "2026-08-29" });
    const b = computeHistoricalTwinMatchSearchForLane({ p1: PLAYER, p2: OPPONENT, lane: LANE, asOfDate: "2026-08-29" });
    expect(a).toEqual(b);
  });
});
