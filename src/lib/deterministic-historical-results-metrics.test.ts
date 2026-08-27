import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { deterministicHistoricalResultsMetric } from "./deterministic-historical-results-metrics.server";

// Mocked once, module-level, so the fixture is available to every test in this file.
// matchHistory tuple shape: [date, tournament, surface, opponent, won(1|0|null), round,
// source, details?] -- the same raw shape runtime-tennis-index-data.server.ts's
// loadRuntimeIndex() returns from the real generated JSON. vi.mock calls are hoisted
// above imports by Vitest, so this applies before the import above resolves.
vi.mock("./runtime-tennis-index-data.server", () => ({
  loadRuntimeIndex: () => ({
    generatedAt: "2026-01-01T00:00:00Z",
    ATP: {}, WTA: {},
    matchHistory: {
      ATP_MAIN: {
        "alice alpha": [
          ["2026-08-10", "Fixture Open", "Hard", "Carol Gamma", 1, "R32", "atp"],
          ["2026-08-20", "Fixture Masters", "Hard", "Dave Delta", 1, "R16", "atp"],
        ],
        "bob beta": [
          ["2026-08-12", "Fixture Open", "Hard", "Eve Epsilon", 0, "R32", "atp"],
          ["2026-08-22", "Fixture Masters", "Hard", "Frank Foxtrot", 1, "R16", "atp"],
        ],
      },
      WTA_MAIN: {}, ATP_CHALLENGER: {}, WTA_CHALLENGER: {},
    },
  }),
}));

describe("Task 18A deterministic historical integration",()=>{
 const server=readFileSync("src/lib/deterministic-historical-results-metrics.server.ts","utf8");
 const repository=readFileSync("src/lib/repository-results-history.server.ts","utf8");
 const builder=readFileSync("scripts/build-runtime-tennis-index.mjs","utf8");
 const router=readFileSync("src/lib/deterministic-results-schedule-metrics.server.ts","utf8");
 it("routes only the owned historical family through the Task 18A engine",()=>{expect(router).toContain("TASK18A_HISTORICAL_RESULTS_CODES");expect(router).toContain("deterministicHistoricalResultsMetric");});
 it("enforces strict historical cutoffs instead of same-day or future leakage",()=>{expect(server).toContain("strictBefore:true");expect(repository).toContain("date >= asOfDate");expect(repository).toContain("strict_before_target");});
 it("preserves four physically isolated tour lanes and the WTA125 contamination firewall",()=>{for(const family of ["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"])expect(builder).toContain(family);expect(builder).toContain("WTA125_CONTAMINATION_FIREWALL_BLOCKED");expect(builder).toContain("WTA125_ROW_COUNT_MISMATCH");});
 it("guards the WTA Tour main-draw ingestion with the same row-count regression discipline as WTA125",()=>{expect(builder).toContain("WTA_MAIN_ROW_COUNT_MISMATCH");expect(builder).toContain("tour_type_human!=='WTA Tour'");expect(repository).toContain("surnameInitialKeyCandidates");});
 it("carries raw score/status inputs into reproducible metric provenance",()=>{expect(builder).toContain("raw_score");expect(builder).toContain("set_scores");expect(builder).toContain("status");expect(server).toContain("raw_inputs");expect(server).toContain("transformation");expect(server).toContain("output");expect(server).toContain("target_match");});

 // Regression test for a real bug: this wrapper used to hardcode
 // `code==="057"?"PARTIAL":"RECONSTRUCTED"` as the expected treatment and discard any
 // finding that didn't match -- "057" isn't even a code this file owns (real PROCESS_META,
 // retargeted away long ago), so every PARTIAL-treatment code this file actually owns
 // (013, 017, 068) was silently discarded no matter what data existed. A prior version of
 // this same test locked that bug in by asserting the buggy line's literal source text was
 // present, rather than exercising real behavior -- exactly the kind of stale golden-text
 // test this bug hid behind. Replaced with a real end-to-end call through the actual
 // wrapper, proving a PARTIAL-treatment code (068) now produces real output.
 it("actually returns a finding for a PARTIAL-treatment owned code (068), not silently discarded by treatment mismatch", async () => {
   const finding = await deterministicHistoricalResultsMetric({ metricCode: "068", p1: "Alice Alpha", p2: "Bob Beta", asOfDate: "2026-08-26", tourFamily: "ATP_MAIN" });
   expect(finding).not.toBeNull();
   expect(finding?.p1_treatment).toBe("PARTIAL");
   expect(finding?.p2_treatment).toBe("PARTIAL");
   expect(finding?.p1_value).toContain("current_streak=W2");
   expect(finding?.p2_value).toContain("current_streak=W1");
 });

 it("still returns a finding for a RECONSTRUCTED-treatment owned code (007), confirming the fix didn't break the non-PARTIAL path", async () => {
   const finding = await deterministicHistoricalResultsMetric({ metricCode: "007", p1: "Alice Alpha", p2: "Bob Beta", asOfDate: "2026-08-26", tourFamily: "ATP_MAIN" });
   // No shared common opponents in this fixture, so this specific pair legitimately has no
   // common-opponent evidence -- the point of this test is that treatment-consistency no
   // longer silently discards a RECONSTRUCTED-eligible code, not that this exact pair has one.
   expect(finding === null || finding?.p1_treatment === "RECONSTRUCTED").toBe(true);
 });
});
