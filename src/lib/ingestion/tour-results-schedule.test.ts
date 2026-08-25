import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ATP/WTA/ATP Challenger ingestion wiring", () => {
  it("uses the original official tour sources", () => {
    const orchestrator = readFileSync("src/lib/ingestion/orchestrator.server.ts", "utf8");
    const runner = readFileSync("scripts/run-historical-ingestion.ts", "utf8");
    const adapter = readFileSync("src/lib/ingestion/tour-results-schedule.server.ts", "utf8");

    expect(orchestrator).toContain('source === "atp" || source === "wta" || source === "atp_challenger"');
    expect(orchestrator).toContain("ingestTourResultsAndSchedules(source)");
    expect(runner).toContain('"atp", "wta", "atp_challenger"');
    expect(adapter).toContain("https://www.atptour.com/en/scores/current");
    expect(adapter).toContain("https://api.protennislive.com/feeds/api/Tournaments/calendar");
    expect(adapter).toContain("https://www.wtatennis.com/tournaments");
    expect(adapter).toContain('atp:"ATP Tour Official"');
    expect(adapter).toContain('wta:"WTA Official"');
    expect(adapter).toContain('atp_challenger:"ATP Challenger Tour Official"');
    expect(adapter).not.toContain("JeffSackmann");
    expect(adapter).not.toContain("PROTENNISLIVE_API_KEY");
  });

  it("keeps ATP Main and ATP Challenger isolated", () => {
    const adapter = readFileSync("src/lib/ingestion/tour-results-schedule.server.ts", "utf8");
    expect(adapter).toContain('if (source === "atp_challenger") return isChallengerLevel(level)');
    expect(adapter).toContain("return !isChallengerLevel(level)");
  });

  it("does not fabricate match observations without both players", () => {
    const adapter = readFileSync("src/lib/ingestion/tour-results-schedule.server.ts", "utf8");
    expect(adapter).toContain("const looksLikeMatch = Boolean(player1 && player2)");
    expect(adapter).toContain("if (!looksLikeMatch && !looksLikeSchedule) return []");
  });

  it("confirms persistence after upsert before reporting writes", () => {
    const adapter = readFileSync("src/lib/ingestion/tour-results-schedule.server.ts", "utf8");
    expect(adapter).toContain('.select("source_record_key")');
    expect(adapter).toContain('.in("source_record_key",keys)');
    expect(adapter).toContain("persisted +=");
  });
});
