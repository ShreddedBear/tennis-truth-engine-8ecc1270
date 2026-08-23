import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enforceMetricWiring078081 } from "./metric-wiring-078-081.server";

const players = { p1: "Player One", p2: "Player Two" };
const source = (name: string, url = "https://example.com/source") => ({ source_name: name, url, retrieved_at: "2026-08-22T00:00:00Z" });

function base(code: string) {
  return {
    metric_code: code,
    p1_value: null,
    p2_value: null,
    p1_treatment: "UNAVAILABLE" as const,
    p2_treatment: "UNAVAILABLE" as const,
    differential: null,
    evidence_family: null,
    reliability: null,
    sample: null,
    unavailable_reason: null,
    sources: [],
  };
}

describe("post-fix exact runtime wiring for 078/079/081", () => {
  it("is actually wired into the production repository dependency through warehouse-first fallback", () => {
    const repo = readFileSync("src/lib/audit-repo.server.ts", "utf8");
    const warehouse = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");
    expect(repo).toContain('import { warehouseFirstResearcher } from "./warehouse-first-researcher.server"');
    expect(repo).toContain("research: warehouseFirstResearcher");
    expect(warehouse).toContain('import { finalMetricWiringResearcher } from "./metric-wiring-078-081.server"');
    expect(warehouse).toContain("...finalMetricWiringResearcher");
    expect(warehouse).toContain("await finalMetricWiringResearcher.metrics");
  });

  it("accepts exact 078 public evidence only with correct player/source/sample orientation", () => {
    const finding = enforceMetricWiring078081({
      ...base("078"),
      p1_value: "PLAYER=Player One; SOURCE=Tournament Media; SAMPLE=tournament week; Home-Market Commercial Appearances: sponsor obligation during tournament week reducing preparation time",
      p1_treatment: "DIRECT",
      sources: [source("Tournament Media")],
    }, players);
    expect(finding.p1_treatment).toBe("DIRECT");
    expect(finding.p1_value).toContain("Home-Market Commercial Appearances");
    expect(finding.sources).toHaveLength(1);
  });

  it("rejects every 078 reconstruction path", () => {
    const finding = enforceMetricWiring078081({
      ...base("078"),
      p1_value: "PLAYER=Player One; SOURCE=Tournament Media; SAMPLE=5 matches; Home-Market Commercial Appearances; INPUTS=sponsor appearances|matches; FORMULA=sponsor appearances / matches",
      p1_treatment: "RECONSTRUCTED",
      sources: [source("Tournament Media")],
    }, players);
    expect(finding.p1_treatment).toBe("UNAVAILABLE");
    expect(finding.p1_value).toBeNull();
  });

  it("rejects P1/P2 reversal and unmatched provenance", () => {
    const finding = enforceMetricWiring078081({
      ...base("081"),
      p1_value: "PLAYER=Player Two; SOURCE=Official Event; SAMPLE=4 resumptions; Rain-Delay Resumption Performance=3-1",
      p1_treatment: "DIRECT",
      p2_value: "PLAYER=Player Two; SOURCE=Different Source; SAMPLE=2 events; Consecutive-Day-Play Penalty=-4%",
      p2_treatment: "PARTIAL",
      sources: [source("Official Event")],
    }, players);
    expect(finding.p1_treatment).toBe("UNAVAILABLE");
    expect(finding.p1_value).toBeNull();
    expect(finding.p2_treatment).toBe("UNAVAILABLE");
    expect(finding.p2_value).toBeNull();
  });

  it("keeps 079 PARTIAL when only exact sourced subcomponents exist", () => {
    const finding = enforceMetricWiring078081({
      ...base("079"),
      p1_value: "PLAYER=Player One; SOURCE=Official Match Log; SAMPLE=12 matches; First-Game Win Rate=58.3%; Post-Walkover-Round Performance=2-1",
      p1_treatment: "PARTIAL",
      sources: [source("Official Match Log")],
    }, players);
    expect(finding.p1_treatment).toBe("PARTIAL");
    expect(finding.p1_value).toContain("First-Game Win Rate");
  });

  it("requires enumerated exact inputs and a formula using each input for RECONSTRUCTED 079/081 values", () => {
    const good = enforceMetricWiring078081({
      ...base("081"),
      p1_value: "PLAYER=Player One; SOURCE=Official Results; SAMPLE=20 matches; Weekday vs Weekend Performance Split; INPUTS=weekday wins|weekday matches|weekend wins|weekend matches; FORMULA=weekday wins / weekday matches versus weekend wins / weekend matches",
      p1_treatment: "RECONSTRUCTED",
      sources: [source("Official Results")],
    }, players);
    expect(good.p1_treatment).toBe("RECONSTRUCTED");

    const missingInputs = enforceMetricWiring078081({
      ...base("081"),
      p1_value: "PLAYER=Player One; SOURCE=Official Results; SAMPLE=20 matches; Weekday vs Weekend Performance Split; FORMULA=weekday wins / weekday matches versus weekend wins / weekend matches",
      p1_treatment: "RECONSTRUCTED",
      sources: [source("Official Results")],
    }, players);
    expect(missingInputs.p1_treatment).toBe("UNAVAILABLE");

    const unrelated = enforceMetricWiring078081({
      ...base("081"),
      p1_value: "PLAYER=Player One; SOURCE=Official Results; SAMPLE=20 matches; Weekday vs Weekend Performance Split; INPUTS=age|height; FORMULA=age + height",
      p1_treatment: "RECONSTRUCTED",
      sources: [source("Official Results")],
    }, players);
    expect(unrelated.p1_treatment).toBe("UNAVAILABLE");

    const omittedInput = enforceMetricWiring078081({
      ...base("079"),
      p1_value: "PLAYER=Player One; SOURCE=Official Match Log; SAMPLE=30 matches; First-Game Win Rate; INPUTS=first games won|matches; FORMULA=first games won / observations",
      p1_treatment: "RECONSTRUCTED",
      sources: [source("Official Match Log")],
    }, players);
    expect(omittedInput.p1_treatment).toBe("UNAVAILABLE");
  });

  it("does not allow neighboring metric evidence to satisfy the final metrics", () => {
    for (const code of ["078", "079", "081"]) {
      const finding = enforceMetricWiring078081({
        ...base(code),
        p1_value: "PLAYER=Player One; SOURCE=Official Stats; SAMPLE=10 matches; Surface Elo=1820; Hold %=84; Market Odds=1.50",
        p1_treatment: "DIRECT",
        sources: [source("Official Stats")],
      }, players);
      expect(finding.p1_treatment).toBe("UNAVAILABLE");
      expect(finding.p1_value).toBeNull();
    }
  });

  it("preserves side-specific persistence wiring for values and treatments", () => {
    const repo = readFileSync("src/lib/audit-repo.server.ts", "utf8");
    expect(repo).toContain('select("metric_code, metric_name, p1_treatment, p2_treatment")');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P1", treatment: metric.p1_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('{ metric_code: code, metric_name: metric.metric_name ?? code, player_side: "P2", treatment: metric.p2_treatment ?? "UNAVAILABLE"');
    expect(repo).toContain('onConflict:"metric_code,player_side,audit_run_id"');
  });
});
