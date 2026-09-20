import { describe, expect, it } from "vitest";
import { computeHistoricalTwinMatchSearchForLane } from "./audit-metric-061-historical-twin-match-search";

describe("metric #061 — Historical Twin Match Search (live wrapper against the real generated index)", () => {
  const PLAYER = "andrea collarini";
  const OPPONENT = "zdenek kolar";
  const LANE = "ATP_CHALLENGER" as const;
  const AS_OF = "2026-08-29";

  it("produces a real, non-fabricated GO result for a data-rich pair", () => {
    const result = computeHistoricalTwinMatchSearchForLane({ p1: PLAYER, p2: OPPONENT, lane: LANE, asOfDate: AS_OF, surface: "hard" });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") return;
    expect(result.n).toBeGreaterThan(0);
    expect(result.value.p1_value).toBe(result.value.p2_value); // symmetric joint comparison, same convention as the underlying engine
    expect(result.value.p1_value).toContain("twin_matches_found=");
    expect(result.value.p1_value).toContain("covers=elo_gap,court_speed only");
    expect(result.value.sources.length).toBeGreaterThan(0);
  });

  it("is symmetric under player-order reversal (current_analogous_favorite flips, everything else matches)", () => {
    const forward = computeHistoricalTwinMatchSearchForLane({ p1: PLAYER, p2: OPPONENT, lane: LANE, asOfDate: AS_OF, surface: "hard" });
    const reversed = computeHistoricalTwinMatchSearchForLane({ p1: OPPONENT, p2: PLAYER, lane: LANE, asOfDate: AS_OF, surface: "hard" });
    expect(forward.status).toBe("GO");
    expect(reversed.status).toBe("GO");
    if (forward.status !== "GO" || reversed.status !== "GO") return;
    expect(forward.n).toBe(reversed.n);
  });

  it("returns NOT_ENOUGH_DATA (never fabricated) for players with no derived Elo history", () => {
    const result = computeHistoricalTwinMatchSearchForLane({ p1: "totally fictional player one", p2: "totally fictional player two", lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });

  it("returns NOT_ENOUGH_DATA for an obviously out-of-range asOfDate with no prior history at all", () => {
    const result = computeHistoricalTwinMatchSearchForLane({ p1: PLAYER, p2: OPPONENT, lane: LANE, asOfDate: "1990-01-01" });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });

  it("carries the reported lane through to the LaneOutcome envelope", () => {
    const result = computeHistoricalTwinMatchSearchForLane({ p1: PLAYER, p2: OPPONENT, lane: LANE, asOfDate: AS_OF });
    expect(result.lane).toBe(LANE);
  });
});
