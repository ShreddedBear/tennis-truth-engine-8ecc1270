import { describe, expect, it, vi } from "vitest";
import type { SourcedStat } from "./reconstruction/engine";

// Live production finding: getRecentReconstruction (feeding metrics 005/006/012/068)
// only ever read data/public/predixsport/atp/atp_elo_matches.csv, so every WTA player got
// NOTHING from this producer at all -- not just the streak field, the entire recent-form
// bundle (last5/10 win %, recent_form_trend, current_streak_signed, etc.) -- because it
// never fell back anywhere for a player it couldn't resolve. This guards the fix: a
// player absent from the ATP CSV must fall back to runtime-tennis-index.server.ts, which
// already covers both tours.
const FALLBACK_STAT: SourcedStat = { key: "current_streak_signed", player: "Fictional Wta Player", value: 3, surface: null, window: "PRE_MATCH_HISTORY", tour_level: null, sample: 6, origin: "RECONSTRUCTED", sources: [] };

vi.mock("./runtime-tennis-index.server", () => ({
  getRuntimeHistoricalStats: vi.fn((player: string) => (player === "Fictional Wta Player" ? [FALLBACK_STAT] : [])),
}));

describe("getRecentReconstruction WTA fallback to runtime-tennis-index", () => {
  it("falls back to getRuntimeHistoricalStats for a player the ATP-only CSV cannot resolve", async () => {
    const { getRecentReconstruction } = await import("./predixsport-recent.server");
    const stats = getRecentReconstruction("Fictional Wta Player", "date 2026-01-01");
    expect(stats).toEqual([FALLBACK_STAT]);
  });

  it("returns nothing (not the fallback) for a genuinely unknown player in both sources", async () => {
    const { getRecentReconstruction } = await import("./predixsport-recent.server");
    expect(getRecentReconstruction("Totally Nobody", "date 2026-01-01")).toEqual([]);
  });
});
