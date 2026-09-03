import { describe, expect, it } from "vitest";
import { replayResidualPerformance, computeResidualPerformanceFromReplay } from "./audit-metric-038-opponent-adjusted-residual-performance";
import type { HistoryLane } from "./task18c-rank-form-workload";

function lane(entries: Record<string, unknown[][]>): HistoryLane {
  return entries as unknown as HistoryLane;
}

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
function cohortPlayerRows(prefix: string, startDate = "2023-02-01") {
  return interleavedRecord(`${prefix}opp`, 7, 7, [[6, 4], [6, 4]], [[1, 6], [1, 6]], startDate);
}
function eightCohortPlayers(startDate = "2023-02-01"): Record<string, unknown[][]> {
  const out: Record<string, unknown[][]> = {};
  for (let c = 0; c < 8; c++) out[`cohort${c}`] = cohortPlayerRows(`c${c}`, startDate);
  return out;
}

describe("metric #038 leakage safety", () => {
  it("never uses the target player's own matches on or after asOfDate to compute the own rate", () => {
    // Baseline: 13 dominant wins (6-1 6-1) + 13 competitive losses (4-6 4-6), all strictly before 2024-01-01.
    // own games: (13*12 + 13*8) / (13*14 + 13*20) = 260/442 = 58.8%
    const baseline = interleavedRecord("opp", 13, 13, [[6, 1], [6, 1]], [[4, 6], [4, 6]], "2023-01-01");
    const entries: Record<string, unknown[][]> = {
      "player x": [...baseline, ["2024-06-01", "t", "hard", "future opp", 1, "", "src", { set_scores: [[6, 0], [6, 0]] }]],
      ...eightCohortPlayers(),
    };
    const asOfDate = "2024-06-01"; // same day as the future win -- strictly-before semantics must exclude it
    const replay = replayResidualPerformance(lane(entries), asOfDate);
    const result = computeResidualPerformanceFromReplay("player x", replay);
    expect(result).not.toBeNull();
    // If the future 6-0 6-0 win leaked in, own_games_won_pct would be pulled up above the baseline 58.8%.
    expect(result!.own_games_won_pct).toBeCloseTo(58.8, 0);
    expect(result!.own_matches).toBe(26);
  });

  it("never uses a cohort player's matches on or after asOfDate to compute the cohort norm", () => {
    const cohortEntries = eightCohortPlayers();
    // Give one cohort player a future blowout win on asOfDate that must not leak into the pooled cohort rate.
    cohortEntries.cohort0 = [...cohortEntries.cohort0, ["2024-06-01", "t", "hard", "future opp", 1, "", "src", { set_scores: [[6, 0], [6, 0]] }]];
    const entries: Record<string, unknown[][]> = { "player y": interleavedRecord("opp", 13, 13, [[6, 1], [6, 1]], [[4, 6], [4, 6]]), ...cohortEntries };
    const asOfDate = "2024-06-01";
    const replay = replayResidualPerformance(lane(entries), asOfDate);
    const result = computeResidualPerformanceFromReplay("player y", replay);
    expect(result).not.toBeNull();
    // Cohort rate should reflect only the pre-asOfDate matches (41.2%, see the non-leakage test), not the leaked-in blowout.
    expect(result!.cohort_games_won_pct).toBeCloseTo(41.2, 0);
    expect(result!.cohort_matches).toBe(8 * 14);
  });
});
