import { describe, expect, it } from "vitest";
import { computeLevelTourTransitionFromMatches, computeLevelTourTransition } from "./audit-metric-020-level-tour-transition";

describe("metric #020 — Level/Tour Transition (pure core)", () => {
  it("bins matches into the correct Elo-differential band and computes per-band win rate", () => {
    const result = computeLevelTourTransitionFromMatches([
      { date: "2024-01-01", tournament: "t1", won: true, pre_elo: 1700, opponent_pre_elo: 1500 }, // gap +200 -> FAVORITE_STRONG
      { date: "2024-01-08", tournament: "t1", won: false, pre_elo: 1700, opponent_pre_elo: 1500 }, // gap +200 -> FAVORITE_STRONG
      { date: "2024-01-15", tournament: "t2", won: true, pre_elo: 1500, opponent_pre_elo: 1650 }, // gap -150 -> UNDERDOG_STRONG
    ]);
    const strong = result.elo_differential_bands.find(b => b.band === "FAVORITE_STRONG_100_PLUS")!;
    expect(strong.n).toBe(2);
    expect(strong.win_rate).toBe(50);
    const underdogStrong = result.elo_differential_bands.find(b => b.band === "UNDERDOG_STRONG_100_PLUS")!;
    expect(underdogStrong.n).toBe(1);
    expect(underdogStrong.win_rate).toBe(100);
  });

  it("classifies tournament runs and computes post-strong/weak-tournament win rates, rolling across the whole chronological history", () => {
    // Runs, in order: A (2W/0L=100%, STRONG) -> B (1W/2L=33%, so B follows a
    // STRONG run) -> C (3W/0L=100%, and C follows B, whose own 33% rate
    // makes it WEAK) -> D (1L, and D follows C, whose 100% rate is STRONG).
    const result = computeLevelTourTransitionFromMatches([
      { date: "2024-01-01", tournament: "A", won: true, pre_elo: 1500, opponent_pre_elo: 1500 },
      { date: "2024-01-02", tournament: "A", won: true, pre_elo: 1500, opponent_pre_elo: 1500 },
      { date: "2024-02-01", tournament: "B", won: true, pre_elo: 1500, opponent_pre_elo: 1500 },
      { date: "2024-02-02", tournament: "B", won: false, pre_elo: 1500, opponent_pre_elo: 1500 },
      { date: "2024-02-03", tournament: "B", won: false, pre_elo: 1500, opponent_pre_elo: 1500 },
      { date: "2024-03-01", tournament: "C", won: true, pre_elo: 1500, opponent_pre_elo: 1500 },
      { date: "2024-03-02", tournament: "C", won: true, pre_elo: 1500, opponent_pre_elo: 1500 },
      { date: "2024-03-03", tournament: "C", won: true, pre_elo: 1500, opponent_pre_elo: 1500 },
      { date: "2024-04-01", tournament: "D", won: false, pre_elo: 1500, opponent_pre_elo: 1500 },
    ]);
    // Following a STRONG prior tournament: B's 3 matches (1W) + D's 1 match (0W) = 4 matches, 1 win.
    expect(result.following_strong_tournament.n).toBe(4);
    expect(result.following_strong_tournament.win_rate).toBe(25);
    // Following a WEAK prior tournament: C's 3 matches (3W).
    expect(result.following_weak_tournament.n).toBe(3);
    expect(result.following_weak_tournament.win_rate).toBe(100);
  });

  it("merges consecutive matches at the same tournament into one run rather than double-counting", () => {
    const result = computeLevelTourTransitionFromMatches([
      { date: "2024-01-01", tournament: "A", won: true, pre_elo: 1500, opponent_pre_elo: 1500 },
      { date: "2024-01-02", tournament: "A", won: true, pre_elo: 1500, opponent_pre_elo: 1500 },
      { date: "2024-01-03", tournament: "A", won: true, pre_elo: 1500, opponent_pre_elo: 1500 },
      { date: "2024-02-01", tournament: "B", won: true, pre_elo: 1500, opponent_pre_elo: 1500 },
    ]);
    // Only one transition (A -> B), not three.
    expect(result.following_strong_tournament.n + result.following_weak_tournament.n).toBe(1);
  });

  it("skips a transition into/from an unlabeled tournament rather than guessing", () => {
    const result = computeLevelTourTransitionFromMatches([
      { date: "2024-01-01", tournament: "", won: true, pre_elo: 1500, opponent_pre_elo: 1500 },
      { date: "2024-02-01", tournament: "B", won: true, pre_elo: 1500, opponent_pre_elo: 1500 },
    ]);
    expect(result.following_strong_tournament.n + result.following_weak_tournament.n).toBe(0);
  });
});

describe("metric #020 — Level/Tour Transition (live wrapper against the real generated index)", () => {
  const PLAYER = "zdenek kolar";
  const LANE = "ATP_CHALLENGER" as const;
  const AS_OF = "2026-08-29";

  it("produces a real, non-fabricated GO result available on every tour lane (no set_scores dependency)", () => {
    for (const lane of ["ATP_MAIN", "WTA_MAIN", "ATP_CHALLENGER", "WTA_CHALLENGER"] as const) {
      const result = computeLevelTourTransition({ player: "novak djokovic", lane, asOfDate: AS_OF });
      // Not every lane will have this exact player, but the lane restriction
      // itself must never reject outright the way #027/#045/#046/#052 do.
      expect(["GO", "NOT_ENOUGH_DATA"]).toContain(result.status);
    }
    const result = computeLevelTourTransition({ player: PLAYER, lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") return;
    expect(result.value.matches_used).toBeGreaterThan(0);
    const total = result.value.elo_differential_bands.reduce((s, b) => s + b.n, 0);
    expect(total).toBe(result.value.matches_used);
  });

  it("returns NOT_ENOUGH_DATA for a nonexistent player", () => {
    const result = computeLevelTourTransition({ player: "totally fictional player one", lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });

  it("leakage safety: a later asOfDate never reports fewer matches_used than an earlier asOfDate", () => {
    const early = computeLevelTourTransition({ player: PLAYER, lane: LANE, asOfDate: "2022-01-01" });
    const late = computeLevelTourTransition({ player: PLAYER, lane: LANE, asOfDate: AS_OF });
    const earlyN = early.status === "GO" ? early.n : 0;
    const lateN = late.status === "GO" ? late.n : 0;
    expect(lateN).toBeGreaterThanOrEqual(earlyN);
  });
});
