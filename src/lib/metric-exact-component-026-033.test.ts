import { describe, expect, it } from "vitest";
import type { MetricFinding } from "./audit-pipeline";
import { validateMetric } from "./validated-completion-research.server";

const source = [{ source_name: "Test public source", url: "https://example.test", retrieved_at: "2026-08-22T00:00:00Z" }];

function finding(code: string, p1: string | null, p2: string | null, treatment: MetricFinding["p1_treatment"] = "DIRECT"): MetricFinding {
  return {
    metric_code: code,
    p1_value: p1,
    p2_value: p2,
    p1_treatment: treatment,
    p2_treatment: treatment,
    differential: null,
    evidence_family: code,
    reliability: 0.9,
    sample: "test",
    unavailable_reason: null,
    sources: source,
  };
}

const defs = {
  "026": { code: "026", name: "Early-Warning / Slow-Start Metrics", body: "opening-game and early serve/return sequence metrics" },
  "029": { code: "029", name: "Psychological/Behavioral Proxies", body: "pressure-event recovery histories" },
  "031": { code: "031", name: "Extended Opponent-Network Metrics", body: "shared-opponent network and opponent-strength metrics" },
  "032": { code: "032", name: "Point-to-Game Conversion Efficiency", body: "point, game, break and score-state conversion metrics" },
  "033": { code: "033", name: "Break Quality Differential", body: "sustainable break score from return pressure versus opponent donations" },
} as const;

describe("exact-component runtime guards for 026/029/031/032/033", () => {
  it.each([
    ["026", "hold_pct=81%"],
    ["029", "tiebreak_win_pct=62%"],
    ["031", "common_opponent_win_pct=70%"],
    ["032", "service_points_won_pct=67%"],
    ["033", "break_point_conversion_pct=48%"],
  ] as const)("rejects convenient proxy evidence for metric %s", (code, proxy) => {
    const out = validateMetric(defs[code], finding(code, proxy, proxy));
    expect(out.p1_value).toBeNull();
    expect(out.p2_value).toBeNull();
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
    expect(out.unavailable_reason).toContain("No proxy substitution permitted");
  });

  it("keeps P1/P2 treatment independent when only one side has an exact 026 component", () => {
    const out = validateMetric(
      defs["026"],
      finding("026", "Opening service-game hold: 8/10 (80%)", "hold_pct=80%", "PARTIAL"),
    );
    expect(out.p1_value).toContain("Opening service-game hold");
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_value).toBeNull();
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });

  it("does not promote a single exact component to DIRECT or RECONSTRUCTED for composite protected metrics", () => {
    for (const code of ["026", "029", "031", "032", "033"] as const) {
      const oneExact = {
        "026": "Opening service-game hold: 8/10",
        "029": "Response after losing a close set: 4/7",
        "031": "Common-opponent hold differential: +3.2 pp",
        "032": "Deuce-game win %: 58%",
        "033": "Sustained return pressure documented",
      }[code];
      for (const treatment of ["DIRECT", "RECONSTRUCTED"] as const) {
        const out = validateMetric(defs[code], finding(code, oneExact, oneExact, treatment));
        expect(out.p1_treatment).toBe("PARTIAL");
        expect(out.p2_treatment).toBe("PARTIAL");
      }
    }
  });

  it("requires both return pressure and opponent-donation detail for usable 033 partial evidence", () => {
    const out = validateMetric(
      defs["033"],
      finding(
        "033",
        "Sustainable Break Score: partial observation; sustained return pressure plus opponent donations from double faults and unforced errors",
        "break_point_conversion_pct=45%",
        "PARTIAL",
      ),
    );
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });
});