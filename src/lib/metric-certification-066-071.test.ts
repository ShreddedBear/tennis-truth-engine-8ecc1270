import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildEvidenceGap, EVIDENCE_REQUIREMENTS } from "./evidence-gap";
import { validateProtectedMetricWiring } from "./protected-metric-wiring.server";
import { familyOf, STAT_CATALOG } from "./reconstruction/stat-catalog";

const PROTECTED = new Set(["066", "067", "069", "070", "071"]);

const MASTER_MARKERS: Record<string, string[]> = {
  "066": ["66. Equipment / Technical", "Racket/String Setup Changes", "Shoe/Traction Changes", "String-Tension Weather Adjustment"],
  "067": ["67. On-Court Behavior / Discipline", "Code-Violation History", "Challenge/Hawk-Eye Success Rate", "Bathroom/Medical-Break Patterns", "On-Court Time-Violation Rate"],
  "069": ["69. Stakes / Career Context", "Retirement-Tour/Farewell-Run Effects", "Anti-Doping Testing Disruption"],
  "070": ["70. Support Team / Prep", "Sports-Psychologist Presence", "Short-Notice Draw Entry", "Walkover-Into-Round Effect"],
  "071": ["71. Session / Environment", "Roof-Open vs Roof-Closed Split", "Fixed Start-Time vs \"Not-Before\" Uncertainty"],
};

const source = (source_name = "Official Tour", url = "https://example.test/source") => ({ source_name, url, retrieved_at: "2026-08-22T00:00:00Z" });
const baseFinding = (metric_code: string, p1_value: string | null, p2_value: string | null, treatment: "DIRECT" | "RECONSTRUCTED" | "PARTIAL" = "DIRECT") => ({
  metric_code,
  p1_value,
  p2_value,
  p1_treatment: p1_value ? treatment : "UNAVAILABLE" as const,
  p2_treatment: p2_value ? treatment : "UNAVAILABLE" as const,
  differential: null,
  evidence_family: "raw",
  reliability: 90,
  sample: "raw sample",
  unavailable_reason: null,
  sources: [source()],
});

describe("post-fix wiring verification for 066/067/069/070/071", () => {
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

  it("prevents imported/local atomic statistics and pass-2 reconstruction from feeding these groups", () => {
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

  it("keeps known neighboring groups separate rather than using them as substitutes", () => {
    expect(EVIDENCE_REQUIREMENTS["063"].requiredData).toContain("equipment-change");
    expect(EVIDENCE_REQUIREMENTS["066"].requiredData).not.toMatch(/coach|coaching-box/i);
    expect(EVIDENCE_REQUIREMENTS["021"].requiredData).toContain("weather");
    expect(EVIDENCE_REQUIREMENTS["071"].requiredData).not.toMatch(/temperature|humidity|wind|travel|fatigue/i);
    expect(EVIDENCE_REQUIREMENTS["064"].requiredData).toContain("entry route");
    expect(EVIDENCE_REQUIREMENTS["070"].requiredData).not.toMatch(/next-round path|draw path difficulty/i);
    expect(EVIDENCE_REQUIREMENTS["065"].requiredData).toContain("illness");
    expect(EVIDENCE_REQUIREMENTS["067"].requiredData).not.toMatch(/illness|return-to-play/i);
  });

  it("requires exact side identity, side-specific source tag and side-specific sample metadata", () => {
    const row = validateProtectedMetricWiring(baseFinding(
      "066",
      "PLAYER=Player One; SOURCE=Official Tour; SAMPLE=1 documented change; Racket/String Setup Changes: verified racket model change",
      "PLAYER=Player Two; SOURCE=Official Tour; SAMPLE=1 documented change; Shoe/Traction Changes: verified shoe model change",
      "DIRECT",
    ), { p1: "Player One", p2: "Player Two" });
    expect(row.p1_treatment).toBe("PARTIAL");
    expect(row.p2_treatment).toBe("PARTIAL");
    expect(row.sample).toBe("P1:1 documented change | P2:1 documented change");
    expect(row.evidence_family).toBe("EXACT_066");
    expect(row.sources).toHaveLength(1);
  });

  it("rejects P1/P2 reversal instead of trusting row order", () => {
    const row = validateProtectedMetricWiring(baseFinding(
      "071",
      "PLAYER=Player Two; SOURCE=Official Tour; SAMPLE=12 roof-tagged matches; Roof-Open vs Roof-Closed Split: 8 vs 4",
      "PLAYER=Player One; SOURCE=Official Tour; SAMPLE=2 scheduled sessions; Fixed Start-Time vs Not-Before Uncertainty: documented",
      "DIRECT",
    ), { p1: "Player One", p2: "Player Two" });
    expect(row.p1_treatment).toBe("UNAVAILABLE");
    expect(row.p2_treatment).toBe("UNAVAILABLE");
    expect(row.p1_value).toBeNull();
    expect(row.p2_value).toBeNull();
  });

  it("rejects unrelated provenance even when a plausible value is present", () => {
    const finding = baseFinding(
      "069",
      "PLAYER=Player One; SOURCE=Unlisted Source; SAMPLE=1 report; Retirement-Tour/Farewell-Run Effects: publicly announced farewell run",
      null,
      "DIRECT",
    );
    finding.sources = [source("Official Tour")];
    const row = validateProtectedMetricWiring(finding, { p1: "Player One", p2: "Player Two" });
    expect(row.p1_treatment).toBe("UNAVAILABLE");
    expect(row.p1_value).toBeNull();
    expect(row.sources).toHaveLength(0);
  });

  it("caps broad metrics at PARTIAL when only exact subsets are supported", () => {
    const row = validateProtectedMetricWiring(baseFinding(
      "067",
      "PLAYER=Player One; SOURCE=Official Tour; SAMPLE=20 matches; Code-Violation History: 3 violations",
      null,
      "DIRECT",
    ), { p1: "Player One", p2: "Player Two" });
    expect(row.p1_treatment).toBe("PARTIAL");
    expect(row.missing_inputs).toEqual(expect.arrayContaining(["challenge/Hawk-Eye success rate", "bathroom/medical-break patterns", "on-court time-violation rate"]));
  });

  it("allows 067 reconstruction only from definition-permitted inputs and rejects neighboring formulas", () => {
    const allowed = validateProtectedMetricWiring(baseFinding(
      "067",
      "PLAYER=Player One; SOURCE=Official Tour; SAMPLE=20 matches; FORMULA=code violations / observed matches; Code-Violation History: 3/20",
      null,
      "RECONSTRUCTED",
    ), { p1: "Player One", p2: "Player Two" });
    expect(allowed.p1_treatment).toBe("PARTIAL");

    const rejected = validateProtectedMetricWiring(baseFinding(
      "067",
      "PLAYER=Player One; SOURCE=Official Tour; SAMPLE=20 matches; FORMULA=hold pct + recent form; Code-Violation History: proxy score",
      null,
      "RECONSTRUCTED",
    ), { p1: "Player One", p2: "Player Two" });
    expect(rejected.p1_treatment).toBe("UNAVAILABLE");
    expect(rejected.p1_value).toBeNull();
  });

  it("does not permit reconstruction labels for factual 069 or 070 public context", () => {
    const stakes = validateProtectedMetricWiring(baseFinding(
      "069",
      "PLAYER=Player One; SOURCE=Official Tour; SAMPLE=2 reports; FORMULA=report count; Retirement-Tour/Farewell-Run Effects: reported; Anti-Doping Testing Disruption: reported",
      null,
      "RECONSTRUCTED",
    ), { p1: "Player One", p2: "Player Two" });
    expect(stakes.p1_treatment).toBe("UNAVAILABLE");

    const prep = validateProtectedMetricWiring(baseFinding(
      "070",
      "PLAYER=Player One; SOURCE=Official Tour; SAMPLE=3 reports; FORMULA=context score; Sports-Psychologist Presence: yes; Short-Notice Draw Entry: yes; Walkover-Into-Round Effect: yes",
      null,
      "RECONSTRUCTED",
    ), { p1: "Player One", p2: "Player Two" });
    expect(prep.p1_treatment).toBe("UNAVAILABLE");
  });

  it("requires all 071 master components before DIRECT can remain fully DIRECT", () => {
    const full = validateProtectedMetricWiring(baseFinding(
      "071",
      "PLAYER=Player One; SOURCE=Official Tour; SAMPLE=12 roof/session observations; Roof-Open vs Roof-Closed Split: 7-5; Fixed Start-Time vs Not-Before Uncertainty: documented schedule split",
      null,
      "DIRECT",
    ), { p1: "Player One", p2: "Player Two" });
    expect(full.p1_treatment).toBe("DIRECT");

    const partial = validateProtectedMetricWiring(baseFinding(
      "071",
      "PLAYER=Player One; SOURCE=Official Tour; SAMPLE=12 roof-tagged matches; Roof-Open vs Roof-Closed Split: 7-5",
      null,
      "DIRECT",
    ), { p1: "Player One", p2: "Player Two" });
    expect(partial.p1_treatment).toBe("PARTIAL");
  });

  it("does not turn persisted values into usable evidence when treatment is unusable", () => {
    const rows = buildEvidenceGap([{
      metric_code: "069", metric_name: "Stakes / Career Context",
      p1_treatment: "UNAVAILABLE", p1_value: "social chatter says farewell",
      p2_treatment: "PARTIAL", p2_value: "verified retirement announcement",
    }]);
    expect(rows.find(r => r.side === "P1")?.classification).toBe("MAPPING_OR_PROVENANCE");
    expect(rows.find(r => r.side === "P2")?.classification).toBe("SUPPORTED");
  });

  it("preserves previously certified post-fix protections while adding these five", () => {
    const wiring = readFileSync("src/lib/protected-metric-wiring.server.ts", "utf8");
    for (const code of ["060", "062", "063", "064", "065", "066", "067", "069", "070", "071"]) {
      expect(wiring).toMatch(new RegExp(`POST_FIX_CODES[\\s\\S]*\\"${code}\\"`));
    }
    expect(wiring).toContain('"063": [');
    expect(wiring).toContain('"065": [');
    expect(wiring).toContain('"060": [');
  });

  it("keeps treatment/provenance persistence side-specific at coverage output", () => {
    const repo = readFileSync("src/lib/audit-repo.server.ts", "utf8");
    expect(repo).toContain('select("metric_code, metric_name, p1_treatment, p2_treatment")');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P1", treatment: metric.p1_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P2", treatment: metric.p2_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('onConflict:"metric_code,player_side,audit_run_id"');
  });
});