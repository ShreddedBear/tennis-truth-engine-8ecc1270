import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildEvidenceGap, EVIDENCE_REQUIREMENTS } from "./evidence-gap";
import { familyOf, STAT_CATALOG } from "./reconstruction/stat-catalog";

const PROTECTED = new Set(["078", "079", "081"]);

const MASTER_MARKERS: Record<string, string[]> = {
  "078": [
    "78. Sponsorship / Off-Court Pressure",
    "Home-Market Commercial Appearances",
  ],
  "079": [
    "79. Additional Differentiating Metrics",
    "Chair-Side Coaching Usage Rate",
    "Post-Coaching-Visit Performance",
    "Shot-Clock Violation Rate by Set",
    "Medical-Timeout-to-Win Correlation",
    "First-Point-of-Match Win Rate",
    "First-Game Win Rate",
    "Serve-Pattern Predictability Score",
    "Wildcard/Entry-Status Effect",
    "Coach-Opponent History",
    "Shot-Selection Variance Under Lead vs Deficit",
  ],
  "081": [
    "81. Further Differentiating Metrics",
    "Locker-Room/Backstage Conflict History",
    "Rain-Delay Resumption Performance",
    "Overnight-Suspension Resumption Performance",
    "Late-Opponent-Substitution Adjustment",
    "Consecutive-Day-Play Penalty",
    "Training-Base Relocation",
    "Prior Withdrawal Pattern at This Event",
    "Support-Staff Turnover (Stringer/Physio)",
    "Travel-Friction Reports",
    "Home-Climate Differential",
  ],
};

describe("sequential certification guardrails for 078/079/081", () => {
  it("pins the authoritative master definitions", () => {
    const master = readFileSync("public/seed/metrics.txt", "utf8").replace(/\s+/g, " ");
    for (const [code, markers] of Object.entries(MASTER_MARKERS)) {
      for (const marker of markers) {
        expect(master, `${code} missing master marker: ${marker}`).toContain(marker.replace(/\s+/g, " "));
      }
    }
  });

  it("pins exact evidence requirements and recovery classes", () => {
    expect(EVIDENCE_REQUIREMENTS["078"]).toMatchObject({
      recovery: "PUBLIC_CONTEXT",
    });
    expect(EVIDENCE_REQUIREMENTS["078"].requiredData).toMatch(/home-market commercial appearances|sponsor obligations|media obligations/i);

    expect(EVIDENCE_REQUIREMENTS["079"]).toMatchObject({
      recovery: "SOURCE_REQUIRED",
    });
    expect(EVIDENCE_REQUIREMENTS["079"].requiredData).toMatch(/coaching visits|shot-clock violations by set|medical breaks|first point\/game|return position|serve patterns/i);
    expect(EVIDENCE_REQUIREMENTS["079"].requiredData).toMatch(/schedule\/entry\/walkover\/altitude\/surface-switch/i);

    expect(EVIDENCE_REQUIREMENTS["081"]).toMatchObject({
      recovery: "PUBLIC_CONTEXT",
    });
    expect(EVIDENCE_REQUIREMENTS["081"].requiredData).toMatch(/rain\/overnight resumptions|opponent substitutions|prior withdrawals|electronic-line-calling exposure/i);
    expect(EVIDENCE_REQUIREMENTS["081"].requiredData).toMatch(/backstage conflict|training-base relocation|support-staff turnover|travel friction/i);
  });

  it("does not cross-wire generic atomic or historical summary stats into these metrics", () => {
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

  it("keeps neighboring context families separated", () => {
    expect(EVIDENCE_REQUIREMENTS["078"].requiredData).not.toMatch(/court assignment|order of play|weather|surface elo|serve|return/i);
    expect(EVIDENCE_REQUIREMENTS["079"].requiredData).not.toMatch(/sponsorship|commercial appearance|surface elo|market odds/i);
    expect(EVIDENCE_REQUIREMENTS["081"].requiredData).not.toMatch(/sponsorship|serve profile|return profile|market odds/i);
    expect(EVIDENCE_REQUIREMENTS["076"].requiredData).toContain("official order of play");
    expect(EVIDENCE_REQUIREMENTS["080"].requiredData).toContain("shared-opponent results");
  });

  it("requires exact sourced evidence rather than speculation or proxies", () => {
    const researcher = readFileSync("src/lib/audit-research.server.ts", "utf8");
    expect(researcher).toContain("Never invent, estimate or \"reasonably assume\" a number, date or fact");
    expect(researcher).toContain("Never substitute a proxy, correlated statistic, broader aggregate, or neighboring metric");
    expect(researcher).toContain("A proxy alone is UNAVAILABLE for that metric, not PARTIAL");
    expect(researcher).toContain("RECONSTRUCTED is allowed only when every required component of the exact formula/definition is sourced");
  });

  it("keeps 079 unavailable when exact event/game/point observations do not exist", () => {
    const rows = buildEvidenceGap([{
      metric_code: "079",
      metric_name: "Additional Differentiating Metrics",
      p1_treatment: "UNAVAILABLE",
      p1_value: null,
      p1_unavailable_reason: "No sourced coaching-visit, shot-clock, medical-break, first-point/game, return-position or serve-pattern log",
      p2_treatment: "PARTIAL",
      p2_value: "official entry status and walkover history only",
    }]);
    expect(rows.find(r => r.side === "P1")).toMatchObject({ side: "P1", classification: "SOURCE_REQUIRED", treatment: "UNAVAILABLE" });
    expect(rows.find(r => r.side === "P2")).toMatchObject({ side: "P2", classification: "SUPPORTED", treatment: "PARTIAL" });
  });

  it("does not promote generic off-court chatter into 078 or 081", () => {
    const rows = buildEvidenceGap([
      {
        metric_code: "078",
        metric_name: "Sponsorship / Off-Court Pressure",
        p1_treatment: "UNAVAILABLE",
        p1_value: "fans say player looked busy",
        p2_treatment: "DIRECT",
        p2_value: "named sponsor event during tournament week with timestamp",
      },
      {
        metric_code: "081",
        metric_name: "Further Differentiating Metrics",
        p1_treatment: "UNAVAILABLE",
        p1_value: "rumor of travel problems",
        p2_treatment: "PARTIAL",
        p2_value: "official prior-year round plus documented missed connection",
      },
    ]);
    expect(rows.filter(r => r.side === "P1").every(r => r.classification === "MAPPING_OR_PROVENANCE")).toBe(true);
    expect(rows.find(r => r.code === "078" && r.side === "P2")?.classification).toBe("SUPPORTED");
    expect(rows.find(r => r.code === "081" && r.side === "P2")?.classification).toBe("SUPPORTED");
  });

  it("keeps P1/P2 orientation side-specific", () => {
    const rows = buildEvidenceGap([{
      metric_code: "081",
      metric_name: "Further Differentiating Metrics",
      p1_treatment: "PARTIAL",
      p1_value: "documented rain-delay resumption record",
      p2_treatment: "UNAVAILABLE",
      p2_value: null,
      p2_unavailable_reason: "No supportable event-history or niche public context for Player 2",
    }]);
    expect(rows.find(r => r.side === "P1")).toMatchObject({ side: "P1", treatment: "PARTIAL", classification: "SUPPORTED" });
    expect(rows.find(r => r.side === "P2")).toMatchObject({ side: "P2", treatment: "UNAVAILABLE", classification: "PUBLIC_CONTEXT" });
  });

  it("keeps provenance/treatment persistence side-specific", () => {
    const repo = readFileSync("src/lib/audit-repo.server.ts", "utf8");
    expect(repo).toContain('select("metric_code, metric_name, p1_treatment, p2_treatment")');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P1", treatment: metric.p1_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P2", treatment: metric.p2_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('onConflict:"metric_code,player_side,audit_run_id"');
  });
});