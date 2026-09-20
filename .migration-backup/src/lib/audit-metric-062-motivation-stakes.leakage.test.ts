import { describe, expect, it } from "vitest";
import { computeMotivationStakesProfile } from "./audit-metric-062-motivation-stakes";
import type { HistoryLane } from "./task18c-rank-form-workload";

function lane(entries: Record<string, unknown[][]>): HistoryLane {
  return entries as unknown as HistoryLane;
}
function row(date: string, opp: string, won: 0 | 1, detail: Record<string, unknown>) {
  return [date, "t", "hard", opp, won, "R32", "src", detail];
}

describe("metric #062 leakage safety", () => {
  it("never uses a match dated on or after asOfDate to compute the seeding/points profile", () => {
    const rows: unknown[][] = [];
    for (let i = 0; i < 15; i++) rows.push(row(`2023-01-${String(i + 1).padStart(2, "0")}`, `Opp${i}`, 1, { draw_size: 32, self_seed: null, self_rank_points: 300 }));
    // A future match dated exactly on asOfDate, seeded #1 with huge points -- must not leak in.
    const asOfDate = "2024-06-01";
    rows.push(row(asOfDate, "Future Opp", 1, { draw_size: 32, self_seed: 1, self_rank_points: 5000 }));
    const l = lane({ "player a": rows });
    const result = computeMotivationStakesProfile("player a", l, asOfDate);
    expect(result).not.toBeNull();
    expect(result!.evaluable_matches).toBe(15); // not 16
    expect(result!.seeded_matches).toBe(0); // the future seed=1 row must not count
    expect(result!.avg_rank_points_at_stake).toBeCloseTo(300, 0); // not pulled up by the future 5000
  });
});
