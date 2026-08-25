import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ATP/WTA/ATP Challenger ingestion wiring", () => {
  it("uses the documented original official tour source identities", () => {
    const orchestrator = readFileSync("src/lib/ingestion/orchestrator.server.ts", "utf8");
    const runner = readFileSync("scripts/run-historical-ingestion.ts", "utf8");
    const adapter = readFileSync("src/lib/ingestion/tour-results-schedule.server.ts", "utf8");

    expect(orchestrator).toContain('source === "atp" || source === "wta" || source === "atp_challenger"');
    expect(orchestrator).toContain("ingestTourResultsAndSchedules(source,");
    expect(orchestrator).toContain("OfficialTourSnapshot");
    expect(runner).toContain('"atp", "wta", "atp_challenger"');
    expect(adapter).toContain("https://www.atptour.com/en/scores/current");
    expect(adapter).toContain("https://www.wtatennis.com/tournaments");
    expect(adapter).toContain('atp:"ATP Tour Official"');
    expect(adapter).toContain('wta:"WTA Official"');
    expect(adapter).toContain('atp_challenger:"ATP Challenger Tour Official"');
    expect(adapter).not.toContain("JeffSackmann");
    expect(adapter).not.toContain("PROTENNISLIVE_API_KEY");
    expect(adapter).not.toContain("api.protennislive.com");
  });

  it("uses official ATP archive pages with a hard Challenger transport split", () => {
    const adapter = readFileSync("src/lib/ingestion/tour-results-schedule.server.ts", "utf8");
    expect(adapter).toContain("https://www.atptour.com/en/scores/results-archive?year=");
    expect(adapter).toContain("tournamentType=ch");
    expect(adapter).toContain('competition_level:level');
    expect(adapter).toContain('source === "atp_challenger" ? "ATP_CHALLENGER" : "ATP_MAIN"');
  });

  it("validates ATP Official browser snapshots server-side before persistence", () => {
    const adapter = readFileSync("src/lib/ingestion/tour-results-schedule.server.ts", "utf8");
    expect(adapter).toContain("snapshot.source!==source");
    expect(adapter).toContain('parsed.hostname!=="www.atptour.com"');
    expect(adapter).toContain('source==="atp_challenger" && type!=="ch"');
    expect(adapter).toContain('source==="atp" && type==="ch"');
    expect(adapter).toContain("Cloudflare challenge");
  });

  it("keeps WTA 125 and ITF events out of WTA Main", () => {
    const adapter = readFileSync("src/lib/ingestion/tour-results-schedule.server.ts", "utf8");
    expect(adapter).toContain('/\\b125\\b|wta\\s*125|challenger|itf/i');
    expect(adapter).toContain("isWtaMainLevel(level)");
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
