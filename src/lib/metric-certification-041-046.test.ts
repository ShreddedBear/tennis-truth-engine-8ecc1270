import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildEvidenceGap, EVIDENCE_REQUIREMENTS } from "./evidence-gap";
import { familyOf, STAT_CATALOG } from "./reconstruction/stat-catalog";

const PROTECTED = new Set(["041", "043", "044", "045", "046"]);

const MASTER_MARKERS: Record<string, string[]> = {
  "041": [
    "41. Hidden Improvement Detector",
    "Opponent-Quality-Adjusted Record Trend",
    "Underlying-Metric Improvement Despite Losses",
    "hold rate, return points won, Dominance Ratio, and",
    "break points created are improving even while the win-loss record lags",
  ],
  "043": [
    "43. Favorite Failure-Mode Score",
    "Favorite Failure-Mode Profile",
    "Opponent Failure-Mode Compatibility",
    "conditions under which the favored player historically tends to lose",
    "today's opponent is specifically capable of creating the conditions",
  ],
  "044": [
    "44. Opponent Upset Compatibility",
    "Upset Compatibility Score",
    "Elo, serve",
    "return quality, court surface, ranking, handedness, rally style, price, and tournament level",
  ],
  "045": [
    "45. Favorite Fragility Under Resistance",
    "Performance When Opponent Holds First 3 Service Games",
    "Performance After Failing Early Break Chances",
    "Performance After Losing First Break",
    "Performance When Set Reaches 4-4",
    "Performance When Set Reaches a Tiebreak",
    "Performance When Opponent Forces Set 3",
  ],
  "046": [
    "46. Match-State Elo",
    "Elo After Winning Set 1",
    "Elo After Losing Set 1",
    "Elo in Deciding Sets",
    "Elo in Tiebreak-Heavy Matches",
    "Elo Against Big Servers",
    "Elo Against Strong Returners",
  ],
};

describe("sequential certification guardrails for 041/043/044/045/046", () => {
  it("pins every authoritative master component before reconstruction is allowed", () => {
    const master = readFileSync("public/seed/metrics.txt", "utf8");
    for (const [code, markers] of Object.entries(MASTER_MARKERS)) {
      for (const marker of markers) {
        expect(master, `${code} missing master marker: ${marker}`).toContain(marker);
      }
    }
  });

  it("requires the exact raw-input families and truthful recovery class", () => {
    expect(EVIDENCE_REQUIREMENTS["041"]).toMatchObject({
      recovery: "SOURCE_REQUIRED",
      requiredData: "chronological opponent-quality-adjusted win/loss record trend plus chronological hold rate, return points won, Dominance Ratio, and break-points-created trends, including losses, in comparable evidence windows",
    });
    expect(EVIDENCE_REQUIREMENTS["043"]).toMatchObject({
      recovery: "SOURCE_REQUIRED",
      requiredData: "favorite-role historical losses with pre-match favorite designation, the exact failure conditions observed in those losses (including serve/return and set-state conditions), and today's opponent's sourced ability to reproduce those same conditions",
    });
    expect(EVIDENCE_REQUIREMENTS["044"]).toMatchObject({
      recovery: "SOURCE_REQUIRED",
      requiredData: "historical matches where the player was the underdog, verified upset outcomes, and similarity features for today's favorite across Elo, serve style, return quality, surface, ranking, handedness, rally style, price, and tournament level",
    });
    expect(EVIDENCE_REQUIREMENTS["045"]).toMatchObject({
      recovery: "SPECIALIZED_DATA",
      requiredData: "favorite-role chronological game/score-state histories covering opponent holding the first three service games, missed early break chances, favorite being broken first, first set reaching 4-4, first-set tiebreaks, and the opponent forcing a deciding set",
    });
    expect(EVIDENCE_REQUIREMENTS["046"]).toMatchObject({
      recovery: "RECONSTRUCTABLE",
      requiredData: "chronological results and Elo-style update inputs conditioned separately on winning set 1, losing set 1, deciding-set play, tiebreak-heavy matches, big-server opponents, and strong-returner opponents, with reproducible archetype thresholds",
    });
  });

  it("does not let generic atomic pass-2 statistics cross-wire into these composite metrics", () => {
    for (const stat of STAT_CATALOG) {
      expect(PROTECTED.has(String(familyOf(stat.key))), `${stat.key} cross-wired into protected metric ${familyOf(stat.key)}`).toBe(false);
    }
    for (const key of [
      "win_pct",
      "hold_pct",
      "return_points_won_pct",
      "dominance_ratio",
      "break_points_created_per_return_game",
      "ranking",
      "surface_elo",
      "tiebreak_win_pct",
      "deciding_set_win_pct",
      "set_win_pct",
      "straight_set_win_pct",
    ]) {
      expect(PROTECTED.has(String(familyOf(key))), `${key} must remain an input and never substitute for 041/043/044/045/046`).toBe(false);
    }
  });

  it("keeps generic local fallback maps from silently populating protected metrics", () => {
    const hybrid = readFileSync("src/lib/hybrid-audit-research.server.ts", "utf8");
    const completion = readFileSync("src/lib/completion-sweep-research.server.ts", "utf8");
    for (const code of PROTECTED) {
      expect(hybrid, `${code} must not have a generic SUMMARY_KEYS fallback`).not.toMatch(new RegExp(`\\"${code}\\"\\s*:`));
      expect(completion, `${code} must not have a generic HISTORICAL_KEYS fallback`).not.toMatch(new RegExp(`\\"${code}\\"\\s*:`));
    }
  });

  it("enforces PARTIAL vs RECONSTRUCTED truthfulness globally", () => {
    const researcher = readFileSync("src/lib/audit-research.server.ts", "utf8");
    expect(researcher).toContain("PARTIAL means that some, but not all, of the exact definition's required inputs or observations are directly supported");
    expect(researcher).toContain("A proxy alone is UNAVAILABLE for that metric, not PARTIAL");
    expect(researcher).toContain("RECONSTRUCTED is allowed only when every required component of the exact formula/definition is sourced");
    expect(researcher).toContain("If any required component is missing, use PARTIAL only when the supported components themselves are exact required inputs; otherwise use UNAVAILABLE");
    expect(researcher).toContain("Do not substitute a convenient statistic for the statistic the definition actually requires");
  });

  it("pins favorite/underdog and player/opponent orientation", () => {
    expect(EVIDENCE_REQUIREMENTS["043"].requiredData).toContain("favorite-role historical losses");
    expect(EVIDENCE_REQUIREMENTS["043"].requiredData).toContain("today's opponent's sourced ability");
    expect(EVIDENCE_REQUIREMENTS["044"].requiredData).toContain("player was the underdog");
    expect(EVIDENCE_REQUIREMENTS["044"].requiredData).toContain("today's favorite");
    expect(EVIDENCE_REQUIREMENTS["045"].requiredData).toContain("favorite-role chronological game/score-state histories");

    const rows = buildEvidenceGap([{
      metric_code: "043",
      metric_name: "Favorite Failure-Mode Score",
      p1_treatment: "PARTIAL",
      p1_value: "favorite failure profile only",
      p2_treatment: "UNAVAILABLE",
      p2_value: null,
      p2_unavailable_reason: "favorite/opponent role evidence missing",
    }]);
    expect(rows.find(row => row.side === "P1")).toMatchObject({ side: "P1", treatment: "PARTIAL", classification: "SUPPORTED" });
    expect(rows.find(row => row.side === "P2")).toMatchObject({ side: "P2", treatment: "UNAVAILABLE", classification: "SOURCE_REQUIRED", reason: "favorite/opponent role evidence missing" });
  });

  it("protects Match-State Elo semantics from raw Elo and conditional win-rate substitution", () => {
    const master = readFileSync("public/seed/metrics.txt", "utf8");
    expect(master).toContain("Elo-style rating conditioned specifically on having won the first set");
    expect(master).toContain("Elo-style rating conditioned specifically on having lost the first set");
    expect(master).toContain("Elo-style rating conditioned specifically on deciding-set play");
    expect(master).toContain("Elo-style rating conditioned specifically on matches with multiple");
    expect(master).toContain("Elo-style rating conditioned specifically on facing big-serving opponents");
    expect(master).toContain("Elo-style rating conditioned specifically on facing strong-returning opponents");
  });

  it("keeps provenance/sample/treatment persistence side-specific", () => {
    const repo = readFileSync("src/lib/audit-repo.server.ts", "utf8");
    expect(repo).toContain('select("metric_code, metric_name, p1_treatment, p2_treatment")');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P1", treatment: metric.p1_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P2", treatment: metric.p2_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('onConflict:"metric_code,player_side,audit_run_id"');
  });

  it("does not treat a persisted value as supported when treatment/provenance is unusable", () => {
    const rows = buildEvidenceGap([{
      metric_code: "046",
      metric_name: "Match-State Elo",
      p1_treatment: "UNAVAILABLE",
      p1_value: "raw_surface_elo=1810",
      p2_treatment: "PARTIAL",
      p2_value: "deciding-state component only",
    }]);
    expect(rows.find(row => row.side === "P1")?.classification).toBe("MAPPING_OR_PROVENANCE");
    expect(rows.find(row => row.side === "P2")?.classification).toBe("SUPPORTED");
  });
});

// CI verification marker: this comment intentionally changes no test behavior.
