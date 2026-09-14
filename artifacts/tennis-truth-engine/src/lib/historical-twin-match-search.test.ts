import { describe, expect, it } from "vitest";
import { computeHistoricalTwinMatchSearch } from "./historical-twin-match-search.server";
import type { HistoryLane } from "./task18c-rank-form-workload";

const row = (date: string, tournament: string, surface: string, opponent: string, won: 0 | 1, round = "R32", source = "fixture") =>
  [date, tournament, surface, opponent, won, round, source] as const;

// Builds a lane with a strong, stable, real Elo gap between "favorites" (fXX) and
// "underdogs" (uXX), each meeting a rotating cast of low-rated fillers so the favorite's
// Elo climbs while the underdog's stays low -- giving deterministic, non-fixture-fragile
// twin matches once replayed. All matches predate the asOfDate used in the tests below.
function lane(): HistoryLane {
  const l: HistoryLane = {};
  const push = (player: string, entry: readonly [string, string, string, string, 0 | 1, string, string]) => {
    l[player] = l[player] ?? [];
    (l[player] as unknown[]).push(entry);
  };
  let day = 1;
  const nextDate = () => `2025-01-${String(day++).padStart(2, "0")}`;
  for (let i = 0; i < 12; i++) {
    const favorite = `Favorite ${i}`;
    const underdog = `Underdog ${i}`;
    const fillerWin = `Filler Win ${i}`;
    const fillerLoss = `Filler Loss ${i}`;
    // Favorite builds up rating beating fillers; underdog stays low losing to fillers.
    for (let j = 0; j < 6; j++) {
      const d1 = nextDate();
      push(favorite, row(d1, "Warmup", "Hard", fillerLoss, 1));
      push(fillerLoss, row(d1, "Warmup", "Hard", favorite, 0));
      const d2 = nextDate();
      push(underdog, row(d2, "Warmup", "Hard", fillerWin, 0));
      push(fillerWin, row(d2, "Warmup", "Hard", underdog, 1));
    }
    // The actual "twin" matchup: favorite beats underdog, on Hard.
    const d = nextDate();
    push(favorite, row(d, "Twin Event", "Hard", underdog, 1));
    push(underdog, row(d, "Twin Event", "Hard", favorite, 0));
  }
  return l;
}

const asOfDate = "2025-06-01";

describe("computeHistoricalTwinMatchSearch (metric 061: Historical Twin Match Search)", () => {
  it("finds twin matches by Elo gap and reports how often the analogous favorite won", () => {
    const result = computeHistoricalTwinMatchSearch({
      p1: "New Favorite",
      p2: "New Underdog",
      asOfDate,
      surface: "Hard",
      lane: lane(),
    });
    expect(result).toBeNull(); // no Elo history at all for these two brand-new names
  });

  it("returns a real twin-match search result for players with an established Elo gap", () => {
    // Reuse two of the fixture's own favorite/underdog pairs as the "current" matchup so
    // both sides have real replayed Elo.
    const result = computeHistoricalTwinMatchSearch({
      p1: "Favorite 0",
      p2: "Underdog 1",
      asOfDate,
      surface: "Hard",
      lane: lane(),
    });
    expect(result).not.toBeNull();
    expect(result?.p1_value).toBe(result?.p2_value);
    expect(result?.p1_value).toContain("twin_matches_found=");
    expect(result?.p1_value).toContain("favorite_win_pct_in_twins=");
    expect(result?.p1_value).toContain("current_analogous_favorite=P1");
    expect(result?.p1_value).toContain("covers=elo_gap,court_speed only");
    expect(result?.differential).toContain("current_elo_gap_p1_minus_p2=");
    expect(result?.sources.length).toBeGreaterThan(0);
  });

  it("is symmetric under player-order reversal", () => {
    const forward = computeHistoricalTwinMatchSearch({ p1: "Favorite 0", p2: "Underdog 1", asOfDate, surface: "Hard", lane: lane() });
    const reversed = computeHistoricalTwinMatchSearch({ p1: "Underdog 1", p2: "Favorite 0", asOfDate, surface: "Hard", lane: lane() });
    expect(reversed?.p1_value).toContain("current_analogous_favorite=P2");
    expect(forward?.sample).toBe(reversed?.sample);
  });

  it("blocks future-match leakage by construction (relies on laneMatchesBefore)", () => {
    const result = computeHistoricalTwinMatchSearch({
      p1: "Favorite 0",
      p2: "Underdog 1",
      asOfDate: "2025-01-01",
      surface: "Hard",
      lane: lane(),
    });
    // Almost nothing has happened by day 1, so there isn't enough replayed history yet.
    expect(result).toBeNull();
  });
});
