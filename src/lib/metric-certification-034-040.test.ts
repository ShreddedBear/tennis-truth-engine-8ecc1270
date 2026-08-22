import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildEvidenceGap, EVIDENCE_REQUIREMENTS } from "./evidence-gap";
import { familyOf, STAT_CATALOG } from "./reconstruction/stat-catalog";
import { validateMetric } from "./validated-completion-research.server";

const PROTECTED = new Set(["034", "036", "038", "039", "040"]);
const src = [{ source_name: "Verified source", url: "https://example.test", retrieved_at: "2026-08-22T00:00:00Z" }];

const MASTER_MARKERS: Record<string, string[]> = {
  "034": [
    "34. Scoreline Deception Index",
    "Scoreline vs Point Dominance",
    "Scoreline vs Expected Games",
    "Scoreline vs Break Opportunities",
    "Scoreline vs Dominance Ratio",
    "Clutch-Performance Dependency",
  ],
  "036": [
    "36. Loss Autopsy Metrics",
    "Loss Favorite Status",
    "Loss Opponent Quality",
    "Loss Surface",
    "Loss Point Differential",
    "Loss Break Differential",
    "Loss Serve Deterioration",
    "Loss Return Deterioration",
    "Lost After Leading",
    "Lost Set 1",
    "Loss in Deciding Set",
    "Loss in Tiebreak",
    "Loss Physical Problem",
    "Loss Match Length",
    "Competitive vs Blowout Loss",
    "Bad-Loss Severity Index",
  ],
  "038": [
    "38. Opponent-Adjusted Residual Performance",
    "Hold Residual vs Opponent Norm",
    "Break Residual vs Opponent Norm",
    "Total-Points Residual vs Opponent Norm",
    "Games Residual vs Opponent Norm",
    "Sets Residual vs Opponent Norm",
    "Dominance-Ratio Residual vs Opponent Norm",
    "Serve-Points Residual vs Opponent Norm",
    "Return-Points Residual vs Opponent Norm",
  ],
  "039": [
    "39. Performance Surprise Rating",
    "Match-Level Performance Surprise",
    "Rolling Performance Surprise (Last 10)",
    "pre-match",
    "expected performance, calculated per match",
  ],
  "040": [
    "40. Hidden Decline Detector",
    "Serve Velocity Trend",
    "Ace Rate Trend",
    "First-Serve Points Won Trend",
    "Second-Serve Points Won Trend",
    "Return Points Won Trend",
    "Break Opportunities Trend",
    "Hold Vulnerability Trend",
    "Double-Fault Trend",
    "Match Duration Trend",
    "Three-Set Dependency Trend",
  ],
};

describe("sequential certification guardrails for 034/036/038/039/040", () => {
  it("pins every authoritative master component", () => {
    const master = readFileSync("public/seed/metrics.txt", "utf8");
    for (const [code, markers] of Object.entries(MASTER_MARKERS)) {
      for (const marker of markers) expect(master, `${code} missing master marker: ${marker}`).toContain(marker);
    }
  });

  it("requires the exact raw-input families without evidence inflation", () => {
    expect(EVIDENCE_REQUIREMENTS["034"]).toMatchObject({ recovery: "SPECIALIZED_DATA", requiredData: "final scoreline, total points won, expected-games model inputs/output, break opportunities, master Dominance Ratio inputs/output, and point-by-point score-state evidence for clutch dependency" });
    expect(EVIDENCE_REQUIREMENTS["036"]).toMatchObject({ recovery: "SPECIALIZED_DATA", requiredData: "chronological recent losses with pre-match favorite status, opponent quality, surface, point and break differentials, within-match serve/return deterioration, lead state, set-1/deciding-set/tiebreak state, verified physical context, match duration and competitiveness inputs for bad-loss severity" });
    expect(EVIDENCE_REQUIREMENTS["038"]).toMatchObject({ recovery: "SOURCE_REQUIRED", requiredData: "match-level hold, break, total-points, games, sets, Dominance Ratio, serve-points and return-points performance plus correctly oriented opponent-specific comparison cohorts/norms" });
    expect(EVIDENCE_REQUIREMENTS["039"]).toMatchObject({ recovery: "RECONSTRUCTABLE", requiredData: "chronological match-level actual underlying performance plus a reproducible pre-match expected-performance value frozen before each match; last-10 rolling surprise uses only those match-level residuals" });
    expect(EVIDENCE_REQUIREMENTS["040"]).toMatchObject({ recovery: "SPECIALIZED_DATA", requiredData: "chronological serve velocity, ace rate, first/second-serve points won, return points won, break opportunities, service-game danger-score/hold-vulnerability, double-fault rate, match duration and three-set dependency histories" });
  });

  it("prevents generic atomic pass-2 statistics from cross-wiring into composite families", () => {
    for (const stat of STAT_CATALOG) expect(PROTECTED.has(String(familyOf(stat.key))), `${stat.key} cross-wired into protected metric ${familyOf(stat.key)}`).toBe(false);
    for (const key of ["total_points_won_pct","dominance_ratio","break_points_opportunities","hold_pct","break_pct","ace_rate_pct","double_fault_rate_pct","first_serve_points_won_pct","second_serve_points_won_pct","return_points_won_pct","avg_match_minutes","deciding_set_win_pct"]) {
      expect(PROTECTED.has(String(familyOf(key))), `${key} must remain an input, never a substitute for 034/036/038/039/040`).toBe(false);
    }
  });

  it("keeps protected metrics out of local historical and summary fallback maps", () => {
    const sweep = readFileSync("src/lib/completion-sweep-research.server.ts", "utf8");
    const hybrid = readFileSync("src/lib/hybrid-audit-research.server.ts", "utf8");
    for (const code of PROTECTED) {
      expect(sweep).not.toContain(`  "${code}":[`);
      expect(hybrid).not.toContain(`"${code}":[`);
    }
  });

  it("keeps P1 and P2 evidence/value orientation independent", () => {
    const rows = buildEvidenceGap([{ metric_code: "038", metric_name: "Opponent-Adjusted Residual Performance", p1_treatment: "DIRECT", p1_value: "P1 residual bundle", p2_treatment: "UNAVAILABLE", p2_value: null, p2_unavailable_reason: "Opponent norm cohort missing" }]);
    expect(rows.find(row => row.side === "P1")).toMatchObject({ side: "P1", treatment: "DIRECT", classification: "SUPPORTED" });
    expect(rows.find(row => row.side === "P2")).toMatchObject({ side: "P2", treatment: "UNAVAILABLE", classification: "SOURCE_REQUIRED", reason: "Opponent norm cohort missing" });
  });

  it("downgrades incomplete composite RECONSTRUCTED evidence instead of inflating it", () => {
    const finding = validateMetric({ code:"034", name:"Scoreline Deception Index", body:null }, {
      metric_code:"034", p1_value:"total points won=52%; dominance ratio=1.08", p2_value:"total points won=48%; dominance ratio=0.93",
      p1_treatment:"RECONSTRUCTED", p2_treatment:"RECONSTRUCTED", differential:null, evidence_family:"TEST", reliability:.9, sample:"1", unavailable_reason:null, sources:src,
    });
    expect(finding.p1_treatment).toBe("PARTIAL");
    expect(finding.p2_treatment).toBe("PARTIAL");
    expect(finding.missing_inputs).toEqual(expect.arrayContaining(["scoreline vs expected games","scoreline vs break opportunities","clutch-performance dependency"]));
  });

  it("rejects proxy-only PARTIAL evidence for protected composites", () => {
    const finding = validateMetric({ code:"040", name:"Hidden Decline Detector", body:null }, {
      metric_code:"040", p1_value:"ranking trend down 12 places", p2_value:"recent win pct=40", p1_treatment:"PARTIAL", p2_treatment:"PARTIAL", differential:null, evidence_family:"FORM", reliability:.8, sample:"10", unavailable_reason:null, sources:src,
    });
    expect(finding.p1_treatment).toBe("UNAVAILABLE");
    expect(finding.p2_treatment).toBe("UNAVAILABLE");
    expect(finding.p1_value).toBeNull();
    expect(finding.p2_value).toBeNull();
  });

  it("requires opponent-norm residual components for 038 rather than raw own-player aggregates", () => {
    const finding = validateMetric({ code:"038", name:"Opponent-Adjusted Residual Performance", body:null }, {
      metric_code:"038", p1_value:"hold_pct=84; break_pct=22", p2_value:"hold_pct=79; break_pct=25", p1_treatment:"RECONSTRUCTED", p2_treatment:"RECONSTRUCTED", differential:null, evidence_family:"SERVE_RETURN", reliability:.9, sample:"20", unavailable_reason:null, sources:src,
    });
    expect(finding.p1_treatment).toBe("UNAVAILABLE");
    expect(finding.p2_treatment).toBe("UNAVAILABLE");
  });

  it("requires pre-match expectation and rolling last-10 semantics for full 039 reconstruction", () => {
    const finding = validateMetric({ code:"039", name:"Performance Surprise Rating", body:null }, {
      metric_code:"039", p1_value:"actual performance 61; expected performance 55; performance surprise +6", p2_value:"actual performance 49; expected performance 52; performance surprise -3", p1_treatment:"RECONSTRUCTED", p2_treatment:"RECONSTRUCTED", differential:null, evidence_family:"SURPRISE", reliability:.9, sample:"1", unavailable_reason:null, sources:src,
    });
    expect(finding.p1_treatment).toBe("PARTIAL");
    expect(finding.p2_treatment).toBe("PARTIAL");
    expect(finding.missing_inputs).toContain("rolling last-10 surprise");
  });

  it("does not count a persisted value as supported when provenance/treatment is unusable", () => {
    const rows = buildEvidenceGap([{ metric_code: "039", metric_name: "Performance Surprise Rating", p1_treatment: "UNAVAILABLE", p1_value: "12.4", p2_treatment: "RECONSTRUCTED", p2_value: "-3.1" }]);
    expect(rows.find(row => row.side === "P1")?.classification).toBe("MAPPING_OR_PROVENANCE");
    expect(rows.find(row => row.side === "P2")?.classification).toBe("SUPPORTED");
  });

  it("forbids proxy-only PARTIAL and incomplete RECONSTRUCTED treatment at the research layer", () => {
    const researcher = readFileSync("src/lib/audit-research.server.ts", "utf8");
    expect(researcher).toContain("PARTIAL means that some, but not all, of the exact definition's required inputs or observations are directly supported");
    expect(researcher).toContain("A proxy alone is UNAVAILABLE for that metric, not PARTIAL");
    expect(researcher).toContain("RECONSTRUCTED is allowed only when every required component of the exact formula/definition is sourced");
    expect(researcher).toContain("Do not substitute a convenient statistic for the statistic the definition actually requires");
  });

  it("protects formula semantics for residual and surprise metrics", () => {
    const master = readFileSync("public/seed/metrics.txt", "utf8");
    expect(master).toContain("compares to how other\n  players typically hold against that same opponent");
    expect(master).toContain("difference between a player's actual performance and their pre-match\n  expected performance, calculated per match");
    expect(master).toContain("trend of match-level performance surprise across the last ten\n  matches");
  });

  it("protects persistence of side-specific treatment coverage", () => {
    const repo = readFileSync("src/lib/audit-repo.server.ts", "utf8");
    expect(repo).toContain('select("metric_code, metric_name, p1_treatment, p2_treatment")');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P1", treatment: metric.p1_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P2", treatment: metric.p2_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('onConflict:"metric_code,player_side,audit_run_id"');
  });
});