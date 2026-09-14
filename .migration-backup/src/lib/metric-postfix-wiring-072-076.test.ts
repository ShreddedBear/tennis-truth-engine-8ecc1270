import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CERTIFIED_METRIC_POLICIES, certifyMetricFinding } from "./metric-certification";
import { familyOf, STAT_CATALOG } from "./reconstruction/stat-catalog";
import type { MetricFinding, Treatment } from "./audit-pipeline";

const CODES = ["072", "073", "074", "075", "076"] as const;
const source = [{ source_name: "Official/source-backed test fixture", url: "https://example.test/source", retrieved_at: "2026-08-22T00:00:00Z" }];

function finding(code:string,p1:string|null,p2:string|null,p1t:Treatment="DIRECT",p2t:Treatment="DIRECT",withSource=true):MetricFinding {
  return {
    metric_code: code,
    p1_value: p1,
    p2_value: p2,
    p1_treatment: p1t,
    p2_treatment: p2t,
    differential: null,
    evidence_family: `EXACT_${code}`,
    reliability: 90,
    sample: "source-specific context/sample",
    unavailable_reason: null,
    sources: withSource ? source : [],
  };
}

describe("post-fix wiring verification for metrics 072/073/074/075/076", () => {
  it("installs an exact input firewall for each of the five metrics without changing older certified policies", () => {
    for (const code of CODES) {
      expect(CERTIFIED_METRIC_POLICIES[code], `${code} missing exact certification policy`).toBeDefined();
      expect(CERTIFIED_METRIC_POLICIES[code].requireCompleteForFullTreatment).toBe(true);
      expect(CERTIFIED_METRIC_POLICIES[code].allowReconstructed).toBe(false);
      expect(CERTIFIED_METRIC_POLICIES[code].permittedRawInputs.length).toBeGreaterThanOrEqual(3);
    }
    expect(CERTIFIED_METRIC_POLICIES["012"].name).toBe("Fatigue/Workload");
    expect(CERTIFIED_METRIC_POLICIES["019"].name).toBe("Market Calibration");
    expect(CERTIFIED_METRIC_POLICIES["022"].name).toBe("Serve/Return Shot-Level Efficiency");
    expect(CERTIFIED_METRIC_POLICIES["024"].name).toBe("Hidden Performance Quality");
    expect(CERTIFIED_METRIC_POLICIES["025"].name).toBe("Match Deterioration Metrics");
  });

  it("rejects cross-wired neighboring evidence instead of increasing evidence coverage", () => {
    const cases:[string,string][] = [
      ["072", "surface Elo=1840; ranking=22; generic style score=0.8"],
      ["073", "sportsbook odds line movement; fan chatter says confident"],
      ["074", "generic injury history only; serve speed=125 mph; hold %=82"],
      ["075", "roof closed; surface=hard; court assignment=stadium"],
      ["076", "rest hours=20; travel=1800 km; weather wind=18 kph"],
    ];
    for (const [code,value] of cases) {
      const out=certifyMetricFinding(finding(code,value,value));
      expect(out.p1_treatment, `${code} P1 cross-wire survived`).toBe("UNAVAILABLE");
      expect(out.p2_treatment, `${code} P2 cross-wire survived`).toBe("UNAVAILABLE");
      expect(out.p1_value).toBeNull();
      expect(out.p2_value).toBeNull();
    }
  });

  it("keeps partially supported broad definitions PARTIAL rather than full DIRECT", () => {
    const cases:[string,string][] = [
      ["072", "verified one-handed backhand type"],
      ["073", "player public statement in a pre-match press conference"],
      ["074", "charted serve toss consistency from toss placement observations"],
      ["075", "official deciding-set tiebreak format uses a 10-point breaker"],
      ["076", "official order of play lists player first on court"],
    ];
    for (const [code,value] of cases) {
      const out=certifyMetricFinding(finding(code,value,value));
      expect(out.p1_treatment, `${code} incomplete P1 was overpromoted`).toBe("PARTIAL");
      expect(out.p2_treatment, `${code} incomplete P2 was overpromoted`).toBe("PARTIAL");
      expect(out.p1_value).toBe(value);
      expect(out.p2_value).toBe(value);
    }
  });

  it("does not permit invented deterministic reconstruction formulas for these contextual/specialized metrics", () => {
    const full076 = "official order of play: first on court; stadium court assignment; documented practice-court access before the match";
    const out=certifyMetricFinding(finding("076",full076,full076,"RECONSTRUCTED","RECONSTRUCTED"));
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("PARTIAL");
    expect(out.unavailable_reason).toContain("no approved deterministic reconstruction formula");
  });

  it("requires named-source provenance for usable evidence", () => {
    const value="player public statement in a pre-match interview";
    const out=certifyMetricFinding(finding("073",value,value,"DIRECT","DIRECT",false));
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
    expect(out.unavailable_reason).toContain("named-source provenance");
  });

  it("preserves P1/P2 orientation and does not let one supported side validate the other", () => {
    const out=certifyMetricFinding(finding(
      "072",
      "verified one-handed backhand type",
      "surface Elo=1900; ranking=10",
      "DIRECT",
      "DIRECT",
    ));
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p1_value).toContain("one-handed backhand");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
    expect(out.p2_value).toBeNull();
  });

  it("keeps generic deterministic/stat-catalog reconstruction paths out of all five metric families", () => {
    for (const stat of STAT_CATALOG) {
      expect(CODES.includes(String(familyOf(stat.key)) as typeof CODES[number]), `${stat.key} cross-wired to ${familyOf(stat.key)}`).toBe(false);
    }
    const specs=readFileSync("src/lib/reconstruction/specs.ts","utf8");
    for (const code of CODES) expect(specs).not.toMatch(new RegExp(`metric[_ -]?code[^\\n]*${code}`,"i"));
  });

  it("keeps local/imported and completion-sweep fallbacks from assigning unrelated fields to 072-076", () => {
    const hybrid=readFileSync("src/lib/hybrid-audit-research.server.ts","utf8");
    const sweep=readFileSync("src/lib/completion-sweep-research.server.ts","utf8");
    for (const code of CODES) {
      expect(hybrid).not.toMatch(new RegExp(`\\"${code}\\"\\s*:`));
      expect(sweep).not.toMatch(new RegExp(`HISTORICAL_KEYS[^;]*\\"${code}\\"\\s*:`,"s"));
    }
    expect(sweep).toContain("certifyMetricFinding(enforceFiveMetricWiring");
  });

  it("keeps the five definitions semantically isolated from neighboring certified groups", () => {
    const p72=CERTIFIED_METRIC_POLICIES["072"].permittedRawInputs.join(" ");
    const p73=CERTIFIED_METRIC_POLICIES["073"].permittedRawInputs.join(" ");
    const p74=CERTIFIED_METRIC_POLICIES["074"].permittedRawInputs.join(" ");
    const p75=CERTIFIED_METRIC_POLICIES["075"].permittedRawInputs.join(" ");
    const p76=CERTIFIED_METRIC_POLICIES["076"].permittedRawInputs.join(" ");
    expect(p72).not.toMatch(/weather|market odds|fatigue/i);
    expect(p73).not.toMatch(/serve profile|surface elo|weather/i);
    expect(p74).not.toMatch(/ranking|market|generic injury history/i);
    expect(p75).not.toMatch(/roof|court assignment|weather|travel/i);
    expect(p76).not.toMatch(/best-of|deciding-set tiebreak|weather|travel|rest hours/i);
  });
});
