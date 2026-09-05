import { describe, expect, it } from "vitest";
import { localMetricRows } from "./hybrid-audit-research.server";

// Live-DB finding (Erhard/Shepp, run ffb59d1d-...): metric 008 fell all the way through to
// the live AI provider, which answered with a bare unlabeled count ("11"/"2") read off the
// wrong PredixSport field -- never the labelled percentage COMPARISON_SPECS requires
// (set3_deciding_set_win_pct, alias deciding_set_win_pct). The root cause: the local
// deterministic researcher's own predixsport-dataset.server.ts ALREADY computes
// deciding_set_win_pct (decidingWins / deciding.length -- the identical denominator metric
// 008's own definition uses) from the same public CSV, but selectedStats() never routed it
// into code 008's evidence pool -- so the local (correctly-labelled, PARTIAL) answer never
// had a chance to exist, and the live provider was asked to guess instead.
//
// Metric 010 (straight-set win %) was investigated the same way and deliberately NOT wired
// to this same source: predixsport-dataset.server.ts's own "straight_set_win_pct" divides
// by WINS only (straight-set share of a player's wins), not by all matches the way metric
// 010's own definition requires (see metric-010-straight-set.test.ts's "uses all matches,
// not only wins, as the straight-set win-rate denominator") -- wiring it in would have
// silently substituted a differently-scoped percentage under an identical-looking name,
// exactly the "similar-sounding substitute" COMPARISON_SPECS's alias rule forbids.
//
// This proves the 008 wiring fix using the real, committed PredixSport CSV (no fabricated
// fixture data): Novak Djokovic has hundreds of real 3-set matches in it.
const CONTEXT = "date 2026-09-01 · surface hard";

describe("hybrid-audit-research: local Set Profile wiring for metric 008", () => {
  it("008 (Deciding-set win %) now surfaces the real deciding_set_win_pct field from local CSV data", () => {
    const [row] = localMetricRows("Novak Djokovic", "Some Unknown Player", CONTEXT, [
      { code: "008", name: "Set Profile", body: null },
    ]);
    // Substring-only "toContain" would also match the pre-existing, unrelated
    // "historical_deciding_set_win_pct" field -- assert the EXACT bare key so this test can
    // only pass because of the newly-added predixsport-dataset "deciding_set_win_pct" wiring.
    expect(row.p1_value).toMatch(/(?:^|[;\s])deciding_set_win_pct=/);
    expect(row.p1_treatment).toBe("PARTIAL");
  });

  it("a player absent from every connected source still yields UNAVAILABLE/null, never a fabricated field", () => {
    const [row] = localMetricRows("Totally Unknown Player One", "Totally Unknown Player Two", CONTEXT, [
      { code: "008", name: "Set Profile", body: null },
    ]);
    expect(row.p1_value).toBeNull();
    expect(row.p2_value).toBeNull();
    expect(row.p1_treatment).toBe("UNAVAILABLE");
    expect(row.p2_treatment).toBe("UNAVAILABLE");
  });

  it("does not wire predixsport-dataset's wins-only straight_set_win_pct into metric 010", () => {
    const [row] = localMetricRows("Novak Djokovic", "Some Unknown Player", CONTEXT, [
      { code: "010", name: "Straight-Set / 2-0 Metrics", body: null },
    ]);
    if (row.p1_value) expect(row.p1_value).not.toContain("straight_set_win_pct=");
  });
});
