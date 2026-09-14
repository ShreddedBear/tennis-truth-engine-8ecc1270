import { describe, expect, it } from "vitest";
import { computeEntropyFromSetScores, computeEntropyLeadDurability, ENTROPY_ELIGIBLE_LANES } from "./audit-metric-052-entropy-lead-durability";

describe("metric #052 — Entropy & Lead Durability (pure core)", () => {
  it("reports zero entropy when every set score is identical (fully concentrated)", () => {
    const result = computeEntropyFromSetScores([[[6, 4]], [[6, 4]], [[6, 4]]]);
    expect(result.sets_n).toBe(3);
    expect(result.set_score_entropy_bits).toBe(0);
    expect(result.distinct_set_scores).toBe(1);
  });

  it("reports positive entropy that increases with more distinct, evenly-spread scorelines", () => {
    const concentrated = computeEntropyFromSetScores([[[6, 4]], [[6, 4]], [[6, 4]], [[6, 3]]]);
    const spread = computeEntropyFromSetScores([[[6, 4]], [[7, 6]], [[6, 0]], [[7, 5]]]);
    expect(spread.set_score_entropy_bits).toBeGreaterThan(concentrated.set_score_entropy_bits);
  });

  it("game-score entropy groups by total games in the set, independent of which side won them", () => {
    // [6,4] and [4,6] both have 10 total games -- same game-score label, different set-score label.
    const result = computeEntropyFromSetScores([[[6, 4]], [[4, 6]]]);
    expect(result.set_score_entropy_bits).toBeGreaterThan(0); // two distinct set-score labels
    expect(result.game_score_entropy_bits).toBe(0); // one distinct game-count label ("10")
  });

  it("ignores empty/missing set_scores entries rather than fabricating a set", () => {
    const result = computeEntropyFromSetScores([[], [[6, 4]]]);
    expect(result.sets_n).toBe(1);
  });
});

describe("metric #052 — Entropy & Lead Durability (live wrapper against the real generated index)", () => {
  const PLAYER = "zdenek kolar";
  const LANE = "ATP_CHALLENGER" as const;
  const AS_OF = "2026-08-29";

  it("produces a real, non-fabricated GO result for a data-rich player/lane", () => {
    const result = computeEntropyLeadDurability({ player: PLAYER, lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") return;
    expect(result.value.sets_n).toBeGreaterThan(0);
    expect(result.value.set_score_entropy_bits).toBeGreaterThan(0);
  });

  it("only WTA_MAIN and ATP_CHALLENGER are eligible lanes", () => {
    expect(ENTROPY_ELIGIBLE_LANES.has("WTA_MAIN")).toBe(true);
    expect(ENTROPY_ELIGIBLE_LANES.has("ATP_CHALLENGER")).toBe(true);
    expect(ENTROPY_ELIGIBLE_LANES.has("ATP_MAIN")).toBe(false);
    expect(ENTROPY_ELIGIBLE_LANES.has("WTA_CHALLENGER")).toBe(false);
  });

  it("rejects ATP_MAIN/WTA_CHALLENGER outright", () => {
    const atp = computeEntropyLeadDurability({ player: "Anyone", lane: "ATP_MAIN", asOfDate: AS_OF });
    expect(atp.status).toBe("NOT_ENOUGH_DATA");
  });

  it("returns NOT_ENOUGH_DATA for a nonexistent player", () => {
    const result = computeEntropyLeadDurability({ player: "totally fictional player one", lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });

  it("leakage safety: a later asOfDate never reports fewer sets_n than an earlier asOfDate", () => {
    const early = computeEntropyLeadDurability({ player: PLAYER, lane: LANE, asOfDate: "2022-01-01" });
    const late = computeEntropyLeadDurability({ player: PLAYER, lane: LANE, asOfDate: AS_OF });
    const earlyN = early.status === "GO" ? early.n : 0;
    const lateN = late.status === "GO" ? late.n : 0;
    expect(lateN).toBeGreaterThanOrEqual(earlyN);
  });
});
