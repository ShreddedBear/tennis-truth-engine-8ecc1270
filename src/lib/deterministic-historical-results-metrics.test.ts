import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Task 18A deterministic historical integration",()=>{
 const server=readFileSync("src/lib/deterministic-historical-results-metrics.server.ts","utf8");
 const repository=readFileSync("src/lib/repository-results-history.server.ts","utf8");
 const builder=readFileSync("scripts/build-runtime-tennis-index.mjs","utf8");
 const router=readFileSync("src/lib/deterministic-results-schedule-metrics.server.ts","utf8");
 it("routes only the owned historical family through the Task 18A engine",()=>{expect(router).toContain("TASK18A_HISTORICAL_RESULTS_CODES");expect(router).toContain("deterministicHistoricalResultsMetric");});
 it("enforces strict historical cutoffs instead of same-day or future leakage",()=>{expect(server).toContain("strictBefore:true");expect(repository).toContain("date >= asOfDate");expect(repository).toContain("strict_before_target");});
 it("preserves four physically isolated tour lanes and the WTA125 contamination firewall",()=>{for(const family of ["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"])expect(builder).toContain(family);expect(builder).toContain("WTA125_CONTAMINATION_FIREWALL_BLOCKED");expect(builder).toContain("WTA125_ROW_COUNT_MISMATCH");});
 it("carries raw score/status inputs into reproducible metric provenance",()=>{expect(builder).toContain("raw_score");expect(builder).toContain("set_scores");expect(builder).toContain("status");expect(server).toContain("raw_inputs");expect(server).toContain("transformation");expect(server).toContain("output");expect(server).toContain("target_match");});
 it("keeps 057 partial and all other owned findings reconstructed",()=>{expect(server).toContain('code==="057"?"PARTIAL":"RECONSTRUCTED"');});
});
