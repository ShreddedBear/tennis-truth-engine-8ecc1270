import { describe, expect, it } from "vitest";
import { buildSackmannWtaMainPbpContext } from "./sackmann-wta-main-pbp.server";

// Fixtures are real rows from the production index (data/metrics/pbp/wta_main/approved-index.jsonl),
// not synthetic data -- same testing convention as evidence-coverage-approved-pbp-bridge.test.ts for
// the WTA Challenger lane. Serena Williams vs Marion Bartoli, Stanford, 2011-07-31 is her earliest
// verified non-Slam match (LEVEL_1_RESULT_VERIFIED_PBP, ppaulojr archive cross-verified against the
// local Tennis-Data.co.uk sync); her next verified match is Toronto 2011-08-10 vs Julia Goerges.
const METRICS = [
  { code: "002", name: "Serve Profile" },
  { code: "003", name: "Return Profile" },
];

describe("sackmann-wta-main-pbp.server — historical WTA Main PBP evidence bridge", () => {
  it("finds the approved historical match and reconstructs point-by-point evidence for it", async () => {
    const result = await buildSackmannWtaMainPbpContext({
      metrics: METRICS, p1: "Serena Williams", p2: "Julia Goerges", asOfDate: "2011-08-10",
    });
    expect(result.status.matches_used).toBeGreaterThan(0);
    const entry = result.packet["002"] as any;
    expect(entry).toBeDefined();
    expect(entry.observed_families).toEqual(["POINT_BY_POINT"]);
    expect(entry.tour_guard).toBe("STRICT_WTA_MAIN_ONLY");
    const rows = entry.observations as any[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => String(row.event_date) < "2011-08-10")).toBe(true);
  });

  it("never admits a match's own PBP as evidence for predicting that same match (asOfDate === match date is excluded)", async () => {
    // Same anti-leakage boundary as evidence-coverage-approved-pbp-bridge.test.ts's Phase 14
    // regression: an asOfDate equal to the match's own date must not see that match, since a
    // predictor auditing that exact match cannot have already observed its own outcome.
    const result = await buildSackmannWtaMainPbpContext({
      metrics: METRICS, p1: "Serena Williams", p2: "Marion Bartoli", asOfDate: "2011-07-31",
    });
    const entry = result.packet["002"] as any;
    const selfRows = ((entry?.observations ?? []) as any[]).filter(
      (row) => (row.player === "Serena Williams" && row.opponent === "Marion Bartoli") || (row.player === "Marion Bartoli" && row.opponent === "Serena Williams"),
    );
    expect(selfRows, "the audited match's own PBP must never be admitted as its own evidence").toHaveLength(0);
  });

  it("tags each observation's provenance with the real source and trust tier (never collapses LEVEL_1 and LEVEL_2 into one undifferentiated label)", async () => {
    const result = await buildSackmannWtaMainPbpContext({
      metrics: METRICS, p1: "Serena Williams", p2: "Julia Goerges", asOfDate: "2011-08-10",
    });
    const rows = (result.packet["002"] as any)?.observations as any[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.provenance.tour).toBe("WTA_MAIN");
      expect(["LEVEL_1_RESULT_VERIFIED_PBP", "LEVEL_2_SINGLE_SOURCE_STRUCTURALLY_VALIDATED"]).toContain(row.provenance.trust_level);
      expect(row.provenance.approval_source).toMatch(/SACKMANN_ARCHIVE_PPAULOJR|SACKMANN_SLAM_ARCHIVE/);
      expect(row.provenance.one_match_one_pbp).toBe(true);
    }
  });

  it("returns no eligible observations for a pair with no approved historical PBP", async () => {
    const result = await buildSackmannWtaMainPbpContext({
      metrics: METRICS, p1: "Definitely Not A Real Player", p2: "Also Not Real", asOfDate: "2020-01-01",
    });
    expect(result.status.matches_used).toBe(0);
    expect(result.packet["002"]).toBeUndefined();
  });
});
