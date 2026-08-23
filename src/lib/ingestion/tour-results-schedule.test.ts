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
    expect(adapter).toContain("https://www.atptour.com/en/scores/current");
    expect(adapter).toContain("https://www.wtatennis.com/tournaments");
    expect(adapter).toContain('observation_key: "match_record"');
    expect(adapter).toContain('observation_key: "event_schedule"');
  });

  it("does not fabricate match observations without both players", () => {
    const adapter = readFileSync("src/lib/ingestion/tour-results-schedule.server.ts", "utf8");
    expect(adapter).toContain("const looksLikeMatch = Boolean(player1 && player2)");
    expect(adapter).toContain("if (!looksLikeMatch && !looksLikeSchedule) return []");
  });
});
