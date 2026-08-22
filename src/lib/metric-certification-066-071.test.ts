import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildEvidenceGap, EVIDENCE_REQUIREMENTS } from "./evidence-gap";
import { familyOf, STAT_CATALOG } from "./reconstruction/stat-catalog";

const PROTECTED = new Set(["066", "067", "069", "070", "071"]);

const MASTER_MARKERS: Record<string, string[]> = {
  "066": ["66. Equipment / Technical", "Racket/String Change", "Shoe Change"],
  "067": ["67. On-Court Behavior / Discipline", "Code Violations", "Challenge Success", "Bathroom Break"],
  "069": ["69. Stakes / Career Context", "Retirement/Farewell", "Anti-Doping"],
  "070": ["70. Support Team / Prep", "Mental Coach", "Late Entry", "Walkover Context"],
  "071": ["71. Session / Environment", "Roof Status", "Session Start Time"],
};

describe("sequential certification guardrails for 066/067/069/070/071", () => {
  it("pins the authoritative master definitions", () => {
    const master = readFileSync("public/seed/metrics.txt", "utf8");
    for (const [code, markers] of Object.entries(MASTER_MARKERS)) {
      for (const marker of markers) expect(master, `${code} missing master marker: ${marker}`).toContain(marker);
    }
  });

  it("pins exact permitted evidence families and recovery classes", () => {
    expect(EVIDENCE_REQUIREMENTS["066"]).toMatchObject({ recovery: "PUBLIC_CONTEXT", requiredData: "verified racket/string/shoe changes and conditions" });
    expect(EVIDENCE_REQUIREMENTS["067"]).toMatchObject({ recovery: "SOURCE_REQUIRED", requiredData: "code violations, challenge data, breaks and time-violation histories" });
    expect(EVIDENCE_REQUIREMENTS["069"]).toMatchObject({ recovery: "PUBLIC_CONTEXT", requiredData: "verified retirement/farewell and anti-doping disruption reporting" });
    expect(EVIDENCE_REQUIREMENTS["070"]).toMatchObject({ recovery: "PUBLIC_CONTEXT", requiredData: "verified mental-coach, late-entry and walkover context" });
    expect(EVIDENCE_REQUIREMENTS["071"]).toMatchObject({ recovery: "PUBLIC_CONTEXT", requiredData: "official roof/session/start-time context" });
  });

  it("prevents generic historical/atomic statistics from cross-wiring into contextual metrics", () => {
    for (const stat of STAT_CATALOG) {
      expect(PROTECTED.has(String(familyOf(stat.key))), `${stat.key} cross-wired into ${familyOf(stat.key)}`).toBe(false);
    }
    const hybrid = readFileSync("src/lib/hybrid-audit-research.server.ts", "utf8");
    const completion = readFileSync("src/lib/completion-sweep-research.server.ts", "utf8");
    for (const code of PROTECTED) {
      expect(hybrid, `${code} must not use generic SUMMARY_KEYS`).not.toMatch(new RegExp(`\\"${code}\\"\\s*:`));
      expect(completion, `${code} must not use generic HISTORICAL_KEYS`).not.toMatch(new RegExp(`\\"${code}\\"\\s*:`));
    }
  });

  it("requires sourced exact evidence and forbids proxy/speculation promotion", () => {
    const researcher = readFileSync("src/lib/audit-research.server.ts", "utf8");
    expect(researcher).toContain("Never invent, estimate or \"reasonably assume\" a number, date or fact");
    expect(researcher).toContain("Never substitute a proxy, correlated statistic, broader aggregate, or neighboring metric");
    expect(researcher).toContain("A proxy alone is UNAVAILABLE for that metric, not PARTIAL");
    expect(researcher).toContain("RECONSTRUCTED is allowed only when every required component of the exact formula/definition is sourced");
  });

  it("keeps P1/P2 orientation side-specific instead of using row order as identity", () => {
    const rows = buildEvidenceGap([{
      metric_code: "066", metric_name: "Equipment / Technical",
      p1_treatment: "DIRECT", p1_value: "verified racket change",
      p2_treatment: "UNAVAILABLE", p2_value: null,
      p2_unavailable_reason: "No verified equipment report for Player 2",
    }]);
    expect(rows.find(r => r.side === "P1")).toMatchObject({ side: "P1", treatment: "DIRECT", classification: "SUPPORTED" });
    expect(rows.find(r => r.side === "P2")).toMatchObject({ side: "P2", treatment: "UNAVAILABLE", classification: "PUBLIC_CONTEXT", reason: "No verified equipment report for Player 2" });
  });

  it("does not turn a persisted value into evidence when treatment is unusable", () => {
    const rows = buildEvidenceGap([{
      metric_code: "069", metric_name: "Stakes / Career Context",
      p1_treatment: "UNAVAILABLE", p1_value: "social chatter says farewell",
      p2_treatment: "PARTIAL", p2_value: "verified retirement announcement",
    }]);
    expect(rows.find(r => r.side === "P1")?.classification).toBe("MAPPING_OR_PROVENANCE");
    expect(rows.find(r => r.side === "P2")?.classification).toBe("SUPPORTED");
  });

  it("keeps provenance and treatment persistence side-specific", () => {
    const repo = readFileSync("src/lib/audit-repo.server.ts", "utf8");
    expect(repo).toContain('select("metric_code, metric_name, p1_treatment, p2_treatment")');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P1", treatment: metric.p1_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P2", treatment: metric.p2_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('onConflict:"metric_code,player_side,audit_run_id"');
  });

  it("keeps session/environment distinct from weather, surface and generic scheduling context", () => {
    expect(EVIDENCE_REQUIREMENTS["071"].requiredData).toBe("official roof/session/start-time context");
    expect(EVIDENCE_REQUIREMENTS["021"].requiredData).toContain("weather");
    expect(EVIDENCE_REQUIREMENTS["028"].requiredData).toContain("travel");
    expect(EVIDENCE_REQUIREMENTS["071"].requiredData).not.toMatch(/weather|temperature|humidity|wind|travel|fatigue/i);
  });
});
