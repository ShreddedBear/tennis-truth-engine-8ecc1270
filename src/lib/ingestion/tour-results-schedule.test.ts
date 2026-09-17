import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizedFromObject } from "./tour-results-schedule.server";

const TARGET = { id: "t1", source_id: "wta" as const, target_key: "wta:2026", pullback_start: null, pullback_end: null, config: null };

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

  it("parses the WTA Official tournamentGroup shape and excludes 125/ITF", () => {
    const adapter = readFileSync("src/lib/ingestion/tour-results-schedule.server.ts", "utf8");
    expect(adapter).toContain("obj.tournamentGroup");
    expect(adapter).toContain('first(group,["level","levelName","levelLabel"])');
    expect(adapter).toContain("125\\s*k?");
    expect(adapter).toContain("isWtaMainLevel(level)");
    expect(adapter).toContain('extraction:"official_wta_public_api"');
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

// Temporal/evaluation-integrity regression: player1/player2 slot assignment for a scraped
// match_record observation must never be a function of who actually won. Before the fix,
// deepFirst's alias list for player1/player2 included "winnerName"/"loserName", so a page
// object shaped like a completed-results feed (which legitimately has those fields and
// nothing else player-shaped) silently assigned player1 = the known winner.
describe("tour-results-schedule.server.ts: player1/player2 assignment is outcome-independent", () => {
  const matchRecordOf = (rows: ReturnType<typeof normalizedFromObject>) => rows.find((r) => r.observation_key === "match_record");

  it("never fabricates a match_record from outcome-only fields (winnerName/loserName alone)", () => {
    // No legitimate player-identity field (player1/playerA/homePlayer/etc.) is present --
    // only the known result. This must produce no match_record, never one that quietly
    // assigns player1 = the winner.
    const rows = normalizedFromObject("wta", "https://x", TARGET, {
      level: "WTA 250", tournament: "Example Open", date: "2026-01-01",
      winnerName: "Iga Swiatek", loserName: "Aryna Sabalenka",
    });
    expect(matchRecordOf(rows)).toBeUndefined();
  });

  it("player1/player2 track the source's own neutral slot (playerA/playerB), not who won", () => {
    const base = { level: "WTA 250", tournament: "Example Open", date: "2026-01-01" };
    const aWins = normalizedFromObject("wta", "https://x", TARGET, { ...base, playerA: "Iga Swiatek", playerB: "Aryna Sabalenka", winner: "Iga Swiatek" });
    const bWins = normalizedFromObject("wta", "https://x", TARGET, { ...base, playerA: "Iga Swiatek", playerB: "Aryna Sabalenka", winner: "Aryna Sabalenka" });
    expect(matchRecordOf(aWins)?.player_name).toBe("Iga Swiatek");
    expect(matchRecordOf(aWins)?.opponent_name).toBe("Aryna Sabalenka");
    // Same source slots (playerA/playerB), only the winner differs -- player1/player2 must
    // not move.
    expect(matchRecordOf(bWins)?.player_name).toBe("Iga Swiatek");
    expect(matchRecordOf(bWins)?.opponent_name).toBe("Aryna Sabalenka");
  });

  it("swapping which side is home/away swaps player1/player2 identically regardless of winner", () => {
    const base = { level: "WTA 250", tournament: "Example Open", date: "2026-01-01" };
    const homeWins = normalizedFromObject("wta", "https://x", TARGET, { ...base, homePlayer: "Iga Swiatek", awayPlayer: "Aryna Sabalenka", winnerName: "Iga Swiatek" });
    const awayWins = normalizedFromObject("wta", "https://x", TARGET, { ...base, homePlayer: "Iga Swiatek", awayPlayer: "Aryna Sabalenka", winnerName: "Aryna Sabalenka" });
    // player1 is always the home slot, whether or not the home player is the one who won.
    expect(matchRecordOf(homeWins)?.player_name).toBe("Iga Swiatek");
    expect(matchRecordOf(awayWins)?.player_name).toBe("Iga Swiatek");
  });

  it("the separate winner field is still captured for evidence -- only player1/player2 assignment is outcome-blind", () => {
    const rows = normalizedFromObject("wta", "https://x", TARGET, {
      level: "WTA 250", tournament: "Example Open", date: "2026-01-01",
      playerA: "Iga Swiatek", playerB: "Aryna Sabalenka", winner: "Aryna Sabalenka",
    });
    const record = matchRecordOf(rows)!;
    expect(JSON.parse(record.text_value!).winner).toBe("Aryna Sabalenka");
    expect(record.player_name).toBe("Iga Swiatek");
  });
});
