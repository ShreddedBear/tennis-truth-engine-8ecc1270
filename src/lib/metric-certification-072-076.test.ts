import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildEvidenceGap, EVIDENCE_REQUIREMENTS } from "./evidence-gap";
import { familyOf, STAT_CATALOG } from "./reconstruction/stat-catalog";

const PROTECTED = new Set(["072", "073", "074", "075", "076"]);

const MASTER_MARKERS: Record<string, string[]> = {
  "072": [
    "72. Matchup Nuance",
    "One-Handed vs Two-Handed Backhand Matchup Effectiveness",
    "Reach/Wingspan Differential",
    "Junior/ITF-Era Head-to-Head",
  ],
  "073": [
    "73. Sentiment / Integrity",
    "Player Public-Statement Sentiment",
    "Social-Media Engagement Anomalies",
    "Betting-Exchange Matched-Volume Spikes",
  ],
  "074": [
    "74. Biomechanics / Physical Detail",
    "Serve Toss Consistency",
    "Racket Specs Matchup",
    "Movement Asymmetry History",
    "Grip-Size/Style Changes",
  ],
  "075": [
    "75. Match Format / Rules Context",
    "Deciding-Set Tiebreak Format",
    "Best-of-3 vs Best-of-5 Adjustment",
    "Challenge/Review Count Remaining",
  ],
  "076": [
    "76. Scheduling Micro-Context",
    "Match Order on the Day's Schedule",
    "Outer-Court vs Stadium-Court Assignment",
    "Practice-Court Access Before the Match",
  ],
};

describe("sequential certification guardrails for 072/073/074/075/076", () => {
  it("pins the authoritative master definitions", () => {
    const master = readFileSync("public/seed/metrics.txt", "utf8").replace(/\s+/g, " ");
    for (const [code, markers] of Object.entries(MASTER_MARKERS)) {
      for (const marker of markers) expect(master, `${code} missing master marker: ${marker}`).toContain(marker.replace(/\s+/g, " "));
    }
  });

  it("pins permitted evidence requirements and recovery classes", () => {
    expect(EVIDENCE_REQUIREMENTS["072"]).toMatchObject({
      recovery: "PUBLIC_CONTEXT",
      requiredData: "backhand type, height/reach and junior/ITF meeting history",
    });
    expect(EVIDENCE_REQUIREMENTS["073"]).toMatchObject({
      recovery: "PUBLIC_CONTEXT",
      requiredData: "public statements, social activity and exchange-volume integrity data",
    });
    expect(EVIDENCE_REQUIREMENTS["074"]).toMatchObject({
      recovery: "SPECIALIZED_DATA",
      requiredData: "charted biomechanics, movement asymmetry and verified equipment specs",
    });
    expect(EVIDENCE_REQUIREMENTS["075"]).toMatchObject({
      recovery: "PUBLIC_CONTEXT",
      requiredData: "official event rules, best-of format and deciding-set rules",
    });
    expect(EVIDENCE_REQUIREMENTS["076"]).toMatchObject({
      recovery: "PUBLIC_CONTEXT",
      requiredData: "official order of play, court assignment and documented practice access",
    });
  });

  it("does not cross-wire generic historical atomic stats into these five metrics", () => {
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

  it("requires exact sourced evidence instead of speculation, proxies or convenient neighbors", () => {
    const researcher = readFileSync("src/lib/audit-research.server.ts", "utf8");
    expect(researcher).toContain("Never invent, estimate or \"reasonably assume\" a number, date or fact");
    expect(researcher).toContain("Never substitute a proxy, correlated statistic, broader aggregate, or neighboring metric");
    expect(researcher).toContain("A proxy alone is UNAVAILABLE for that metric, not PARTIAL");
    expect(researcher).toContain("RECONSTRUCTED is allowed only when every required component of the exact formula/definition is sourced");
  });

  it("keeps specialized biomechanics unavailable without underlying observations", () => {
    const rows = buildEvidenceGap([{
      metric_code: "074",
      metric_name: "Biomechanics / Physical Detail",
      p1_treatment: "UNAVAILABLE",
      p1_value: null,
      p1_unavailable_reason: "No charted serve-toss or movement-asymmetry observations",
      p2_treatment: "PARTIAL",
      p2_value: "Verified racket specification only",
    }]);
    expect(rows.find(r => r.side === "P1")).toMatchObject({
      side: "P1",
      classification: "SPECIALIZED_DATA",
      treatment: "UNAVAILABLE",
    });
    expect(rows.find(r => r.side === "P2")).toMatchObject({
      side: "P2",
      classification: "SUPPORTED",
      treatment: "PARTIAL",
    });
  });

  it("does not promote social chatter or generic context into direct sentiment/integrity evidence", () => {
    const rows = buildEvidenceGap([{
      metric_code: "073",
      metric_name: "Sentiment / Integrity",
      p1_treatment: "UNAVAILABLE",
      p1_value: "fans think the player may withdraw",
      p2_treatment: "DIRECT",
      p2_value: "named exchange reports matched-volume spike",
    }]);
    expect(rows.find(r => r.side === "P1")?.classification).toBe("MAPPING_OR_PROVENANCE");
    expect(rows.find(r => r.side === "P2")?.classification).toBe("SUPPORTED");
  });

  it("keeps P1/P2 orientation side-specific", () => {
    const rows = buildEvidenceGap([{
      metric_code: "072",
      metric_name: "Matchup Nuance",
      p1_treatment: "DIRECT",
      p1_value: "one-handed backhand; verified junior meeting record",
      p2_treatment: "UNAVAILABLE",
      p2_value: null,
      p2_unavailable_reason: "No supportable reach/wingspan observation for Player 2",
    }]);
    expect(rows.find(r => r.side === "P1")).toMatchObject({ side: "P1", treatment: "DIRECT", classification: "SUPPORTED" });
    expect(rows.find(r => r.side === "P2")).toMatchObject({ side: "P2", treatment: "UNAVAILABLE", classification: "PUBLIC_CONTEXT" });
  });

  it("keeps format/rules separate from scheduling and session/environment context", () => {
    expect(EVIDENCE_REQUIREMENTS["075"].requiredData).not.toMatch(/order of play|court assignment|practice|roof|start-time/i);
    expect(EVIDENCE_REQUIREMENTS["076"].requiredData).not.toMatch(/best-of|deciding-set|tiebreak format|weather|fatigue/i);
    expect(EVIDENCE_REQUIREMENTS["071"].requiredData).toContain("roof");
    expect(EVIDENCE_REQUIREMENTS["028"].requiredData).toContain("travel");
  });

  it("keeps provenance/treatment persistence side-specific", () => {
    const repo = readFileSync("src/lib/audit-repo.server.ts", "utf8");
    expect(repo).toContain('select("metric_code, metric_name, p1_treatment, p2_treatment")');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P1", treatment: metric.p1_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P2", treatment: metric.p2_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('onConflict:"metric_code,player_side,audit_run_id"');
  });
});