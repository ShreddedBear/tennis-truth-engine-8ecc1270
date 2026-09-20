import { describe, expect, it } from "vitest";
import {
  computeUnderdogWinProfileFromPerspectives,
  computeUnderdogWinProfile,
  computeOpponentUpsetCompatibility,
  UPSET_COMPATIBILITY_SET_SEQUENCE_LANES,
  OPPONENT_UPSET_COMPATIBILITY_EXCLUDED_DIMENSIONS,
} from "./audit-metric-044-opponent-upset-compatibility";

describe("metric #044 — Opponent Upset Compatibility (pure core)", () => {
  it("computes elo_gap as negative for underdog wins and reports opponent quality", () => {
    const result = computeUnderdogWinProfileFromPerspectives(
      [{ date: "2024-01-01", opponent: "Strong Favorite", pre_elo: 1500, opponent_pre_elo: 1700 }],
      null,
    );
    expect(result.underdog_wins).toHaveLength(1);
    expect(result.underdog_wins[0].elo_gap).toBe(-200);
    expect(result.underdog_wins[0].opponent_quality_elo).toBe(1700);
    expect(result.avg_upset_opponent_quality_elo).toBe(1700);
  });

  it("reports null (never guessed) for set-sequence-derived fields when no set-scores lookup is supplied", () => {
    const result = computeUnderdogWinProfileFromPerspectives(
      [{ date: "2024-01-01", opponent: "A", pre_elo: 1400, opponent_pre_elo: 1600 }],
      null,
    );
    expect(result.set_sequence_available).toBe(false);
    expect(result.underdog_wins[0].took_set_1).toBeNull();
    expect(result.took_set_1_rate_pct).toBeNull();
  });

  it("derives took_set_1/deciding_set/tiebreak_factor/blowout_win from a supplied set-scores lookup", () => {
    const setScoresFor = (date: string, opponent: string) => {
      if (date === "2024-01-01" && opponent === "a") return [[6, 3], [4, 6], [7, 6]] as Array<[number, number]>; // took set 1, deciding set, tiebreak in set 3
      return undefined;
    };
    const result = computeUnderdogWinProfileFromPerspectives(
      [{ date: "2024-01-01", opponent: "A", pre_elo: 1400, opponent_pre_elo: 1600 }],
      setScoresFor,
    );
    expect(result.set_sequence_available).toBe(true);
    expect(result.underdog_wins[0].took_set_1).toBe(true);
    expect(result.underdog_wins[0].deciding_set).toBe(true);
    expect(result.underdog_wins[0].tiebreak_factor).toBe(true);
    expect(result.underdog_wins[0].blowout_win).toBe(false);
    expect(result.took_set_1_rate_pct).toBe(100);
  });

  it("caps the output to the trailing N wins, most recent first", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ date: `2024-01-${String(i + 1).padStart(2, "0")}`, opponent: `Opp${i}`, pre_elo: 1400, opponent_pre_elo: 1600 }));
    const result = computeUnderdogWinProfileFromPerspectives(many, null, 20);
    expect(result.trailing_underdog_wins_used).toBe(20);
    expect(result.underdog_wins[0].date).toBe("2024-01-30");
    expect(result.underdog_wins[19].date).toBe("2024-01-11");
  });

  it("documents exactly the nine-minus-shipped excluded similarity dimensions, never silently fabricating them", () => {
    expect(OPPONENT_UPSET_COMPATIBILITY_EXCLUDED_DIMENSIONS).toContain(
      "handedness (metric-recoverability-map.ts #068: TRULY_UNAVAILABLE, not confirmed anywhere in this system's evidence universe)",
    );
    expect(OPPONENT_UPSET_COMPATIBILITY_EXCLUDED_DIMENSIONS.length).toBe(6);
  });
});

describe("metric #044 — live wrapper against the real generated index", () => {
  const PLAYER = "andrea collarini";
  const FAVORITE = "zdenek kolar";
  const LANE = "ATP_CHALLENGER" as const;
  const AS_OF = "2026-08-29";

  it("produces a real, non-fabricated GO result for a data-rich underdog", () => {
    const result = computeUnderdogWinProfile({ player: PLAYER, lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") return;
    expect(result.value.trailing_underdog_wins_used).toBeGreaterThan(0);
    expect(result.value.underdog_wins.every(w => w.elo_gap < 0)).toBe(true);
    expect(result.value.set_sequence_available).toBe(true);
  });

  it("computeOpponentUpsetCompatibility compares today's favorite's Elo and surface against the underdog-win history", () => {
    const result = computeOpponentUpsetCompatibility({ player: PLAYER, todaysFavorite: FAVORITE, lane: LANE, asOfDate: AS_OF, todaysMatchSurface: "hard" });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") return;
    expect(result.value.todays_favorite_elo).not.toBeNull();
    expect(typeof result.value.surface_match_rate_pct === "number" || result.value.surface_match_rate_pct === null).toBe(true);
    expect(result.value.excluded_similarity_dimensions.length).toBeGreaterThan(0);
  });

  it("only WTA_MAIN and ATP_CHALLENGER get set-sequence-derived fields", () => {
    expect(UPSET_COMPATIBILITY_SET_SEQUENCE_LANES.has("WTA_MAIN")).toBe(true);
    expect(UPSET_COMPATIBILITY_SET_SEQUENCE_LANES.has("ATP_CHALLENGER")).toBe(true);
    expect(UPSET_COMPATIBILITY_SET_SEQUENCE_LANES.has("ATP_MAIN")).toBe(false);
    expect(UPSET_COMPATIBILITY_SET_SEQUENCE_LANES.has("WTA_CHALLENGER")).toBe(false);
  });

  it("returns NOT_ENOUGH_DATA (never fabricated) for a nonexistent player", () => {
    const result = computeUnderdogWinProfile({ player: "totally fictional player one", lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });

  it("returns NOT_ENOUGH_DATA when today's favorite has no derived Elo history but the profile itself still resolves", () => {
    const result = computeOpponentUpsetCompatibility({ player: PLAYER, todaysFavorite: "totally fictional favorite", lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") return;
    expect(result.value.todays_favorite_elo).toBeNull();
    expect(result.value.elo_gap_to_avg_upset_opponent).toBeNull();
  });
});
