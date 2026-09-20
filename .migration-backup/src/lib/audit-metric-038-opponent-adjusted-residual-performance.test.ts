import { describe, expect, it } from "vitest";
import {
  replayResidualPerformance,
  computeResidualPerformanceFromReplay,
  computeOpponentAdjustedResidualPerformance,
  RESIDUAL_PERFORMANCE_ELIGIBLE_LANES,
} from "./audit-metric-038-opponent-adjusted-residual-performance";
import type { HistoryLane } from "./task18c-rank-form-workload";

// HistoryLane entries: [date, tournament, surface, opponent, won(0/1), round, source, detail]
function lane(entries: Record<string, unknown[][]>): HistoryLane {
  return entries as unknown as HistoryLane;
}

/**
 * Builds an interleaved win/loss record (roughly 50% win rate, so Elo stays close to 1500
 * throughout rather than drifting far in either direction) against distinct one-off
 * opponents, with a chosen dominant score for wins and a chosen score for losses -- lets the
 * games-won% differ sharply between two players while their Elo stays comparable, which a
 * pure win-streak-vs-loss-streak fixture cannot do (win/loss record alone drives Elo, not
 * game margin).
 */
function interleavedRecord(opponentPrefix: string, wins: number, losses: number, winScore: [number, number][], lossScore: [number, number][], startDate = "2023-01-01"): unknown[][] {
  const rows: unknown[][] = [];
  let d = new Date(startDate);
  const total = wins + losses;
  let w = 0, l = 0;
  for (let i = 0; i < total; i++) {
    const date = d.toISOString().slice(0, 10);
    const takeWin = w / Math.max(1, wins) <= l / Math.max(1, losses);
    if (takeWin && w < wins) { rows.push([date, "t", "hard", `${opponentPrefix}${i}`, 1, "", "src", { set_scores: winScore }]); w++; }
    else { rows.push([date, "t", "hard", `${opponentPrefix}${i}`, 0, "", "src", { set_scores: lossScore }]); l++; }
    d.setDate(d.getDate() + 1);
  }
  return rows;
}

// Star player: 13 dominant wins (6-1 6-1) + 13 competitive losses (4-6 4-6) = 26 matches, ~50% win rate.
// own games: wins 13*12=156 of 13*14=182; losses 13*8=104 of 13*20=260 => (156+104)/(182+260) = 260/442 = 58.8%
function starPlayerRows(startDate = "2023-01-01") {
  return interleavedRecord("opp", 13, 13, [[6, 1], [6, 1]], [[4, 6], [4, 6]], startDate);
}
// Cohort player: 7 modest wins (6-4 6-4) + 7 lopsided losses (1-6 1-6) = 14 matches, ~50% win rate.
// own games: wins 7*12=84 of 7*20=140; losses 7*2=14 of 7*14=98 => (84+14)/(140+98) = 98/238 = 41.2%
function cohortPlayerRows(prefix: string, startDate = "2023-02-01") {
  return interleavedRecord(`${prefix}opp`, 7, 7, [[6, 4], [6, 4]], [[1, 6], [1, 6]], startDate);
}
function eightCohortPlayers(startDate = "2023-02-01"): Record<string, unknown[][]> {
  const out: Record<string, unknown[][]> = {};
  for (let c = 0; c < 8; c++) out[`cohort${c}`] = cohortPlayerRows(`c${c}`, startDate);
  return out;
}

describe("metric #038 — Opponent-Adjusted Residual Performance", () => {
  it("reports a positive residual for a player who wins games at a higher rate than their Elo-band cohort, both near a 50% win rate", () => {
    const entries: Record<string, unknown[][]> = { "star player": starPlayerRows(), ...eightCohortPlayers() };
    const replay = replayResidualPerformance(lane(entries), "2024-01-01");
    const result = computeResidualPerformanceFromReplay("star player", replay);
    expect(result).not.toBeNull();
    expect(result!.own_games_won_pct).toBeCloseTo(58.8, 0);
    expect(result!.cohort_games_won_pct).toBeCloseTo(41.2, 0);
    expect(result!.games_won_residual_pct).toBeGreaterThan(10);
    expect(result!.own_matches).toBe(26);
    expect(result!.cohort_players).toBe(8);
    expect(result!.cohort_matches).toBe(8 * 14);
  });

  it("returns null (NOT_ENOUGH_DATA) when the player has too few own set_scores-bearing matches", () => {
    const entries: Record<string, unknown[][]> = {
      "sparse player": interleavedRecord("opp", 2, 3, [[6, 1], [6, 1]], [[4, 6], [4, 6]]), // 5 matches, below MIN_OWN_MATCHES=20
      ...eightCohortPlayers(),
    };
    const replay = replayResidualPerformance(lane(entries), "2024-01-01");
    expect(computeResidualPerformanceFromReplay("sparse player", replay)).toBeNull();
  });

  it("returns null (NOT_ENOUGH_DATA) when the Elo-band cohort is too small", () => {
    const entries: Record<string, unknown[][]> = {
      "lonely star": starPlayerRows(),
      // only 2 cohort players -- below MIN_COHORT_PLAYERS=8
      cohort0: cohortPlayerRows("c0"),
      cohort1: cohortPlayerRows("c1"),
    };
    const replay = replayResidualPerformance(lane(entries), "2024-01-01");
    expect(computeResidualPerformanceFromReplay("lonely star", replay)).toBeNull();
  });

  it("only WTA_MAIN and ATP_CHALLENGER are eligible lanes", () => {
    expect(RESIDUAL_PERFORMANCE_ELIGIBLE_LANES.has("WTA_MAIN")).toBe(true);
    expect(RESIDUAL_PERFORMANCE_ELIGIBLE_LANES.has("ATP_CHALLENGER")).toBe(true);
    expect(RESIDUAL_PERFORMANCE_ELIGIBLE_LANES.has("ATP_MAIN")).toBe(false);
    expect(RESIDUAL_PERFORMANCE_ELIGIBLE_LANES.has("WTA_CHALLENGER")).toBe(false);
  });

  it("live wrapper rejects ineligible lanes outright", () => {
    const atp = computeOpponentAdjustedResidualPerformance({ player: "Anyone", lane: "ATP_MAIN", asOfDate: "2024-01-01" });
    expect(atp.status).toBe("NOT_ENOUGH_DATA");
    const wtaChallenger = computeOpponentAdjustedResidualPerformance({ player: "Anyone", lane: "WTA_CHALLENGER", asOfDate: "2024-01-01" });
    expect(wtaChallenger.status).toBe("NOT_ENOUGH_DATA");
  });
});
