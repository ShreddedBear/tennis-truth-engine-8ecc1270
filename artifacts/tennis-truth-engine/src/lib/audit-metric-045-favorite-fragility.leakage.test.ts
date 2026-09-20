import { describe, expect, it } from "vitest";
import { computeFavoriteFragility } from "./audit-metric-045-favorite-fragility";
import { loadRuntimeIndex } from "./runtime-tennis-index-data.server";

describe("metric #045 leakage safety (via loadRuntimeIndex's ATP_CHALLENGER lane)", () => {
  const PLAYER = "zdenek kolar";
  const LANE = "ATP_CHALLENGER" as const;

  it("a later asOfDate never reports fewer eligible matches than an earlier asOfDate for the same player", () => {
    const early = computeFavoriteFragility({ player: PLAYER, lane: LANE, asOfDate: "2022-01-01" });
    const late = computeFavoriteFragility({ player: PLAYER, lane: LANE, asOfDate: "2026-08-29" });
    const earlyN = early.status === "GO" ? early.n : 0;
    const lateN = late.status === "GO" ? late.n : 0;
    expect(lateN).toBeGreaterThanOrEqual(earlyN);
  });

  it("real generated index sanity check: this lane actually has entries for the fixture player", () => {
    const historyLane = loadRuntimeIndex().matchHistory.ATP_CHALLENGER as unknown as Record<string, unknown[]>;
    expect(Array.isArray(historyLane[PLAYER])).toBe(true);
    expect((historyLane[PLAYER] as unknown[]).length).toBeGreaterThan(0);
  });
});
