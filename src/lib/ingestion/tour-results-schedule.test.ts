import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ATP/WTA/ATP Challenger ingestion wiring", () => {
  it("wires all three tour sources into the tracked ingestion orchestrator", () => {
    const orchestrator = readFileSync("src/lib/ingestion/orchestrator.server.ts", "utf8");
    const runner = readFileSync("scripts/run-historical-ingestion.ts", "utf8");
    const adapter = readFileSync("src/lib/ingestion/tour-results-schedule.server.ts", "utf8");

    expect(orchestrator).toContain('source === "atp" || source === "wta" || source === "atp_challenger"');
    expect(orchestrator).toContain("ingestTourResultsAndSchedules(source)");
    expect(runner).toContain('"atp", "wta", "atp_challenger"');
    expect(adapter).toContain("JeffSackmann/tennis_atp");
    expect(adapter).toContain("atp_matches_{year}.csv");
    expect(adapter).toContain("atp_matches_qual_chall_{year}.csv");
    expect(adapter).toContain("https://www.wtatennis.com/tournaments");
    expect(adapter).toMatch(/observation_key:\s*["']match_record["']/);
    expect(adapter).toContain('source==="atp_challenger"&&level!=="C"');
    expect(adapter).toContain('source==="atp"&&level==="C"');
  });

  it("does not fabricate match observations without both players", () => {
    const adapter = readFileSync("src/lib/ingestion/tour-results-schedule.server.ts", "utf8");
    expect(adapter).toContain("const p1=r.winner_name,p2=r.loser_name");
    expect(adapter).toContain("if(!p1||!p2)return null");
    expect(adapter).toContain("if(!p1||!p2)continue");
  });
});
