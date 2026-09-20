import { describe, expect, it } from "vitest";
import { computeFavoriteFragilityFromPerspectives, computeFavoriteFragility, FAVORITE_FRAGILITY_ELIGIBLE_LANES } from "./audit-metric-045-favorite-fragility";

describe("metric #045 — Favorite Fragility Under Resistance (pure core)", () => {
  it("computes first-set-tiebreak win rate only over matches whose first set was a tiebreak", () => {
    const result = computeFavoriteFragilityFromPerspectives([
      { won: true, setScores: [[7, 6], [6, 4]] }, // TB set 1, won
      { won: false, setScores: [[7, 6], [4, 6], [3, 6]] }, // TB set 1, lost
      { won: true, setScores: [[6, 4], [6, 3]] }, // no TB set 1
    ]);
    expect(result.first_set_tiebreak.n).toBe(2);
    expect(result.first_set_tiebreak.win_rate).toBe(50);
  });

  it("computes forced-deciding-set win rate only over 3-set matches", () => {
    const result = computeFavoriteFragilityFromPerspectives([
      { won: true, setScores: [[6, 4], [4, 6], [6, 3]] }, // deciding set, won
      { won: false, setScores: [[6, 4], [4, 6], [3, 6]] }, // deciding set, lost
      { won: true, setScores: [[6, 4], [6, 3]] }, // no deciding set
    ]);
    expect(result.forced_deciding_set.n).toBe(2);
    expect(result.forced_deciding_set.win_rate).toBe(50);
  });

  it("excludes matches with no usable set_scores from both buckets rather than guessing", () => {
    const result = computeFavoriteFragilityFromPerspectives([
      { won: true, setScores: undefined },
      { won: false, setScores: [] },
    ]);
    expect(result.eligible_matches_n).toBe(0);
    expect(result.first_set_tiebreak.n).toBe(0);
    expect(result.first_set_tiebreak.win_rate).toBeNull();
  });
});

describe("metric #045 — Favorite Fragility Under Resistance (live wrapper against the real generated index)", () => {
  const PLAYER = "zdenek kolar";
  const LANE = "ATP_CHALLENGER" as const;
  const AS_OF = "2026-08-29";

  it("produces a real, non-fabricated GO result for a data-rich player/lane", () => {
    const result = computeFavoriteFragility({ player: PLAYER, lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") return;
    expect(result.value.eligible_matches_n).toBeGreaterThan(0);
  });

  it("only WTA_MAIN and ATP_CHALLENGER are eligible lanes", () => {
    expect(FAVORITE_FRAGILITY_ELIGIBLE_LANES.has("WTA_MAIN")).toBe(true);
    expect(FAVORITE_FRAGILITY_ELIGIBLE_LANES.has("ATP_CHALLENGER")).toBe(true);
    expect(FAVORITE_FRAGILITY_ELIGIBLE_LANES.has("ATP_MAIN")).toBe(false);
    expect(FAVORITE_FRAGILITY_ELIGIBLE_LANES.has("WTA_CHALLENGER")).toBe(false);
  });

  it("rejects ATP_MAIN/WTA_CHALLENGER outright", () => {
    const atp = computeFavoriteFragility({ player: "Anyone", lane: "ATP_MAIN", asOfDate: AS_OF });
    expect(atp.status).toBe("NOT_ENOUGH_DATA");
  });

  it("returns NOT_ENOUGH_DATA for a nonexistent player", () => {
    const result = computeFavoriteFragility({ player: "totally fictional player one", lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });
});
