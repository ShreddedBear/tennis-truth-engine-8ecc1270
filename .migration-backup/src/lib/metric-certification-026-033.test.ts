import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EVIDENCE_REQUIREMENTS } from "./evidence-gap";
import { familyOf, STAT_CATALOG } from "./reconstruction/stat-catalog";

const PROTECTED = new Set(["026", "029", "031", "032", "033"]);

const MASTER_MARKERS: Record<string, string[]> = {
  "026": [
    "26. Early-Warning / Slow-Start Metrics",
    "Opening Service-Game Hold %",
    "Opening Return-Game Break %",
    "First Four Games Win Differential",
    "First Six Games Point Differential",
    "Early Break-Conceded Frequency",
    "Time-to-First-Break",
    "First-Set Recovery After Early Break",
    "Early-Error Rate",
    "Early First-Serve Efficiency",
    "Early Return Pressure",
    "Warm-Up Dependency Index",
  ],
  "029": [
    "29. Psychological/Behavioral Proxies",
    "Response After Losing a Close Set",
    "Response After Blowing Set Points",
    "Response After Failing to Serve Out a Set",
    "Response After Losing a Tiebreak",
    "Performance Immediately After Saving Match Points",
    "Performance Immediately After Wasting Match Points",
    "Consecutive-Error Recovery",
    "Break-Point Resilience After Previous BP Loss",
    "Pressure Error Differential",
    "Front-Runner vs Comeback Profile",
    "Scoreboard-Pressure Sensitivity",
  ],
  "031": [
    "31. Extended Opponent-Network Metrics",
    "Common-Opponent Adjusted Point Differential",
    "Common-Opponent Hold Differential",
    "Common-Opponent Break Differential",
    "Common-Opponent Straight-Set Differential",
    "Common-Opponent Set-1 Differential",
    "Common-Opponent Performance Within Last 30/60/90 Days",
    "Second-Degree Opponent Network",
    "Network Elo Strength",
    "Transitive Performance Score",
    "Loss-Quality Score",
    "Win-Quality Score",
    "Upset-Quality Score",
    "Bad-Loss Severity",
    "Opponent-Strength Weighted Game Differential",
  ],
  "032": [
    "32. Point-to-Game Conversion Efficiency",
    "Points-Won % → Games-Won % Conversion",
    "Return-Points-Won → Break Conversion Efficiency",
    "Service-Points-Won → Hold Conversion Efficiency",
    "Expected vs Actual Games Won",
    "Expected vs Actual Sets Won",
    "Deuce-Game Win %",
    "Games Won From 0–30/15–30",
    "Games Lost From 30–0/40–15",
    "Break Opportunities Needed per Successful Break",
    "Hold Efficiency Relative to Underlying Serve Points",
  ],
  "033": [
    "33. Break Quality Differential",
    "Sustainable Break Score",
    "sustained return pressure versus",
    "double faults and unforced errors",
  ],
};

describe("sequential certification guardrails for 026/029/031/032/033", () => {
  it("pins the authoritative master definitions so convenient substitute metrics cannot replace them", () => {
    const master = readFileSync("public/seed/metrics.txt", "utf8");
    for (const [code, markers] of Object.entries(MASTER_MARKERS)) {
      for (const marker of markers) expect(master, `${code} missing master marker: ${marker}`).toContain(marker);
    }
  });

  it("keeps recovery requirements aligned to the exact data families", () => {
    expect(EVIDENCE_REQUIREMENTS["026"]).toMatchObject({
      recovery: "SPECIALIZED_DATA",
      requiredData: "opening-game point/game sequence and early serve/return statistics",
    });
    expect(EVIDENCE_REQUIREMENTS["029"]).toMatchObject({
      recovery: "SPECIALIZED_DATA",
      requiredData: "score-state event sequences, pressure errors and closing/recovery histories",
    });
    expect(EVIDENCE_REQUIREMENTS["031"]).toMatchObject({
      recovery: "RECONSTRUCTABLE",
      requiredData: "shared-opponent network, rankings/Elo, scores, games/sets and opponent strength",
    });
    expect(EVIDENCE_REQUIREMENTS["032"]).toMatchObject({
      recovery: "SOURCE_REQUIRED",
      requiredData: "service/return points, games, breaks and deuce/score-state data",
    });
    expect(EVIDENCE_REQUIREMENTS["033"]).toMatchObject({
      recovery: "SPECIALIZED_DATA",
      requiredData: "break-point sequence plus return pressure and opponent-error detail",
    });
  });

  it("does not let generic pass-2 atomic-stat family routing populate any protected metric", () => {
    for (const stat of STAT_CATALOG) {
      expect(PROTECTED.has(String(familyOf(stat.key))), `${stat.key} cross-wired into protected metric ${familyOf(stat.key)}`).toBe(false);
    }

    // Explicit neighboring statistics that are tempting but semantically insufficient.
    for (const key of [
      "hold_pct",
      "break_pct",
      "break_point_conversion_pct",
      "return_points_won_pct",
      "service_points_won_pct",
      "tiebreak_win_pct",
      "set_win_pct",
      "straight_set_win_pct",
      "common_opponent_win_pct",
    ]) {
      expect(PROTECTED.has(String(familyOf(key))), `${key} must not stand in for 026/029/031/032/033`).toBe(false);
    }
  });

  it("forbids proxy-only PARTIAL evidence and requires full components for RECONSTRUCTED", () => {
    const researcher = readFileSync("src/lib/audit-research.server.ts", "utf8");
    expect(researcher).not.toContain("PARTIAL (only a proxy/partial figure)");
    expect(researcher).toContain("PARTIAL means that some, but not all, of the exact definition's required inputs or observations are directly supported");
    expect(researcher).toContain("A proxy alone is UNAVAILABLE for that metric, not PARTIAL");
    expect(researcher).toContain("RECONSTRUCTED is allowed only when every required component of the exact formula/definition is sourced");
    expect(researcher).toContain("Do not substitute a convenient statistic for the statistic the definition actually requires");
  });

  it("keeps player/opponent-sensitive definitions explicit rather than collapsing them to own-player aggregates", () => {
    const master = readFileSync("public/seed/metrics.txt", "utf8");
    expect(master).toContain("point differential against shared opponents, adjusted for\n  opponent strength");
    expect(master).toContain("performance data drawn from opponents of the players' common opponents");
    expect(master).toContain("sustained return pressure versus\n  opponent donations like double faults and unforced errors");
  });
});
