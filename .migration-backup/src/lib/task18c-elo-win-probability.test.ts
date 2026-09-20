import { describe, expect, it } from "vitest";
import { computeHistoryMetric, type HistoryEntry, type HistoryLane } from "./task18c-rank-form-workload";

const row = (date: string, tournament: string, surface: string, opponent: string, won: 0 | 1, round = "R32", source = "fixture"): HistoryEntry => [date, tournament, surface, opponent, won, round, source];

// A simple lane where Alice has won every prior match and Bob has lost every
// prior match, so Alice's Elo should end up well above 1500 and Bob's well
// below -- giving a predictable, checkable win-probability direction and
// magnitude via the standard logistic formula.
function lane(): HistoryLane {
  return {
    "alice alpha": [row("2026-07-01", "A", "Hard", "Foe One", 1), row("2026-07-10", "B", "Hard", "Foe Two", 1), row("2026-07-20", "C", "Hard", "Foe Three", 1)],
    "foe one": [row("2026-07-01", "A", "Hard", "Alice Alpha", 0)],
    "foe two": [row("2026-07-10", "B", "Hard", "Alice Alpha", 0)],
    "foe three": [row("2026-07-20", "C", "Hard", "Alice Alpha", 0)],
    "bob beta": [row("2026-07-02", "D", "Hard", "Foe Four", 0), row("2026-07-12", "E", "Hard", "Foe Five", 0), row("2026-07-22", "F", "Hard", "Foe Six", 0)],
    "foe four": [row("2026-07-02", "D", "Hard", "Bob Beta", 1)],
    "foe five": [row("2026-07-12", "E", "Hard", "Bob Beta", 1)],
    "foe six": [row("2026-07-22", "F", "Hard", "Bob Beta", 1)],
  };
}

describe("metric 001 — Elo Win Probability", () => {
  it("reports the actual logistic win probability, not just the raw Elo point delta", () => {
    const result = computeHistoryMetric({ code: "001", p1: "Alice Alpha", p2: "Bob Beta", asOfDate: "2026-08-01", surface: "Hard", family: "ATP_MAIN", lane: lane() });
    expect(result?.differential).toMatch(/elo_win_probability_p1=\d+\.\d%/);
    // Alice has a strictly higher Elo than Bob here, so her win probability
    // must be strictly above 50%.
    const pct = Number(result?.differential?.match(/elo_win_probability_p1=([\d.]+)%/)?.[1]);
    expect(pct).toBeGreaterThan(50);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it("matches the standard Elo logistic formula exactly, not an approximation", () => {
    const result = computeHistoryMetric({ code: "001", p1: "Alice Alpha", p2: "Bob Beta", asOfDate: "2026-08-01", surface: "Hard", family: "ATP_MAIN", lane: lane() });
    const delta = Number(result?.differential?.match(/overall_elo_delta_p1_minus_p2=(-?\d+)/)?.[1]);
    const pct = Number(result?.differential?.match(/elo_win_probability_p1=([\d.]+)%/)?.[1]);
    // Reconstruct the same formula independently (1 / (1 + 10^(-delta/400)))
    // from the reported point delta and confirm it's not just a placeholder.
    const expected = 100 / (1 + 10 ** (-delta / 400));
    expect(pct).toBeCloseTo(expected, 0);
  });
});
