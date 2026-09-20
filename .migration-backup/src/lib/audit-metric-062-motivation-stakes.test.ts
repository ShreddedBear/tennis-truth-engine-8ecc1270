import { describe, expect, it } from "vitest";
import { computeMotivationStakesProfile, computeMotivationStakes, MOTIVATION_STAKES_ELIGIBLE_LANES } from "./audit-metric-062-motivation-stakes";
import type { HistoryLane } from "./task18c-rank-form-workload";

function lane(entries: Record<string, unknown[][]>): HistoryLane {
  return entries as unknown as HistoryLane;
}

function row(date: string, opp: string, won: 0 | 1, detail: Record<string, unknown>) {
  return [date, "t", "hard", opp, won, "R32", "src", detail];
}

describe("metric #062 — Motivation/Stakes", () => {
  it("computes a real seeding/points profile from a player's own past ATP_CHALLENGER matches", () => {
    const rows: unknown[][] = [];
    // 10 seeded matches (seed 4, 800 points) + 10 unseeded matches (no seed, 300 points), all with known draw_size.
    for (let i = 0; i < 10; i++) rows.push(row(`2023-01-${String(i + 1).padStart(2, "0")}`, `Opp${i}`, 1, { draw_size: 32, self_seed: 4, self_rank_points: 800 }));
    for (let i = 0; i < 10; i++) rows.push(row(`2023-02-${String(i + 1).padStart(2, "0")}`, `Opp${10 + i}`, 0, { draw_size: 32, self_seed: null, self_rank_points: 300 }));
    const l = lane({ "player a": rows });
    const result = computeMotivationStakesProfile("player a", l, "2024-01-01");
    expect(result).not.toBeNull();
    expect(result!.evaluable_matches).toBe(20);
    expect(result!.seeded_matches).toBe(10);
    expect(result!.seeded_rate_pct).toBe(50);
    expect(result!.avg_seed_when_seeded).toBe(4);
    expect(result!.avg_rank_points_at_stake).toBeCloseTo(550, 0); // (800*10 + 300*10) / 20
  });

  it("excludes rows with no draw_size from the evaluable denominator (unknown, not unseeded)", () => {
    const rows: unknown[][] = [];
    for (let i = 0; i < 15; i++) rows.push(row(`2023-01-${String(i + 1).padStart(2, "0")}`, `Opp${i}`, 1, { draw_size: 32, self_seed: 1, self_rank_points: 900 }));
    // 5 rows with no draw metadata at all -- must not count as "unseeded" evidence.
    for (let i = 0; i < 5; i++) rows.push(row(`2023-03-${String(i + 1).padStart(2, "0")}`, `Opp${15 + i}`, 0, {}));
    const l = lane({ "player a": rows });
    const result = computeMotivationStakesProfile("player a", l, "2024-01-01");
    expect(result).not.toBeNull();
    expect(result!.evaluable_matches).toBe(15);
    expect(result!.seeded_rate_pct).toBe(100);
  });

  it("returns null (NOT_ENOUGH_DATA) below the minimum evaluable-match threshold", () => {
    const rows: unknown[][] = [];
    for (let i = 0; i < 5; i++) rows.push(row(`2023-01-${String(i + 1).padStart(2, "0")}`, `Opp${i}`, 1, { draw_size: 32, self_seed: 1, self_rank_points: 900 }));
    const l = lane({ "player a": rows });
    expect(computeMotivationStakesProfile("player a", l, "2024-01-01")).toBeNull();
  });

  it("only ATP_CHALLENGER is an eligible lane", () => {
    expect(MOTIVATION_STAKES_ELIGIBLE_LANES.has("ATP_CHALLENGER")).toBe(true);
    expect(MOTIVATION_STAKES_ELIGIBLE_LANES.has("ATP_MAIN")).toBe(false);
    expect(MOTIVATION_STAKES_ELIGIBLE_LANES.has("WTA_MAIN")).toBe(false);
    expect(MOTIVATION_STAKES_ELIGIBLE_LANES.has("WTA_CHALLENGER")).toBe(false);
  });

  it("live wrapper rejects ineligible lanes outright", () => {
    const atpMain = computeMotivationStakes({ player: "Anyone", lane: "ATP_MAIN", asOfDate: "2024-01-01" });
    expect(atpMain.status).toBe("NOT_ENOUGH_DATA");
    const wtaMain = computeMotivationStakes({ player: "Anyone", lane: "WTA_MAIN", asOfDate: "2024-01-01" });
    expect(wtaMain.status).toBe("NOT_ENOUGH_DATA");
  });
});
