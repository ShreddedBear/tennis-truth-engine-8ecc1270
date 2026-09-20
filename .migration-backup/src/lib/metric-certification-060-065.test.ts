import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MetricFinding } from "./audit-pipeline";
import { EVIDENCE_REQUIREMENTS } from "./evidence-gap";
import { validateProtectedMetricWiring } from "./protected-metric-wiring.server";

const publicSources = [
  { source_name: "ATP Official", url: "https://www.atptour.com/", retrieved_at: "2026-08-22T00:00:00Z" },
  { source_name: "Unrelated Weather Feed", url: "https://example.com/weather", retrieved_at: "2026-08-22T00:00:00Z" },
];
const localSources = [
  { source_name: "Charted Match Dataset", url: null, retrieved_at: "2026-08-22T00:00:00Z" },
  { source_name: "Unrelated Historical Dataset", url: null, retrieved_at: "2026-08-22T00:00:00Z" },
];

function tagged(player:string, source:string, component:string, sample="n=12", formula?:string) {
  return `PLAYER=${player}; SOURCE=${source}; SAMPLE=${sample}; ${formula ? `FORMULA=${formula}; ` : ""}${component}`;
}
function finding(
  code:string,
  p1:string|null,
  p2:string|null,
  treatment:MetricFinding["p1_treatment"]="DIRECT",
  sources:MetricFinding["sources"]=publicSources,
):MetricFinding {
  return {
    metric_code:code,
    p1_value:p1,
    p2_value:p2,
    p1_treatment:treatment,
    p2_treatment:treatment,
    differential:null,
    evidence_family:`BEFORE_${code}`,
    reliability:0.9,
    sample:"row-level sample must be replaced",
    unavailable_reason:null,
    sources,
  };
}

describe("post-fix wiring verification 060/062/063/064/065", () => {
  it("pins the authoritative master definitions and recovery classes", () => {
    const master=readFileSync("public/seed/metrics.txt","utf8").replace(/\s+/g," ");
    const markers=[
      "60. Interaction / Matchup Residuals","Serve–Return Interaction Residual","Late-Line Acceleration",
      "62. Motivation / Stakes","Points-Defending Pressure","Seeding/Bye Implications","Prize-Money/Status Milestones",
      "63. Team / Support Context","Coaching Changes","Coaching-Box Presence","Equipment Changes",
      "64. Draw Context","Qualifying/Lucky-Loser Fatigue","Draw Path Difficulty Beyond This Match",
      "65. Physical/Medical (Limited Availability)","Off-Season/Pre-Season Training Reports","Illness Reports",
    ];
    for(const marker of markers) expect(master, marker).toContain(marker.replace(/\s+/g," "));
    expect(EVIDENCE_REQUIREMENTS["060"]).toMatchObject({ recovery:"SOURCE_REQUIRED" });
    for(const code of ["062","063","064","065"] as const) expect(EVIDENCE_REQUIREMENTS[code].recovery).toBe("PUBLIC_CONTEXT");
  });

  it("confirms local historical and local-summary fallback maps do not feed these five metrics", () => {
    const completion=readFileSync("src/lib/completion-sweep-research.server.ts","utf8");
    const hybrid=readFileSync("src/lib/hybrid-audit-research.server.ts","utf8");
    const historicalMap=completion.match(/const HISTORICAL_KEYS:[\s\S]*?;\nconst CONSERVATIVE_PARTIAL_FAMILIES/)?.[0] ?? "";
    const summaryMap=hybrid.match(/const SUMMARY_KEYS:[\s\S]*?;\nfunction summaryFor/)?.[0] ?? "";
    for(const code of ["060","062","063","064","065"]) {
      expect(historicalMap, `${code} must not have generic historical fallback`).not.toContain(`"${code}":`);
      expect(summaryMap, `${code} must not have generic local-summary fallback`).not.toContain(`"${code}":`);
    }
  });

  it.each([
    ["060","hold_pct=81%"],
    ["062","current ranking=18"],
    ["063","racket specs: 98 sq in; string tension 52 lb"],
    ["064","matches_last_28_days=9; rest_hours=30; travel_km=1000"],
    ["065","injury history: ankle retirement; recent withdrawal; medical timeout rate=8%"],
  ] as const)("rejects cross-wired proxy evidence for %s", (code, proxy) => {
    const out=validateProtectedMetricWiring(
      finding(code, tagged("Player One","ATP Official",proxy), tagged("Player Two","ATP Official",proxy)),
      { p1:"Player One", p2:"Player Two" },
    );
    expect(out.p1_value).toBeNull();
    expect(out.p2_value).toBeNull();
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });

  it("enforces P1/P2 identity rather than row order", () => {
    const out=validateProtectedMetricWiring(
      finding(
        "064",
        tagged("Player Two","ATP Official","Qualifying/Lucky-Loser Fatigue: played two qualifying matches"),
        tagged("Player One","ATP Official","Draw Path Difficulty Beyond This Match: official draw lists seeded next-round opponent"),
        "PARTIAL",
      ),
      { p1:"Player One", p2:"Player Two" },
    );
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
    expect(out.unavailable_reason).toMatch(/side reversal/i);
  });

  it("keeps one correctly oriented exact side independent from an unsupported opposite side", () => {
    const out=validateProtectedMetricWiring(
      finding(
        "062",
        tagged("Player One","ATP Official","Points-Defending Pressure: 180 points"),
        tagged("Player One","ATP Official","Points-Defending Pressure: 45 points"),
        "PARTIAL",
      ),
      { p1:"Player One", p2:"Player Two" },
    );
    expect(out.p1_value).toContain("Points-Defending Pressure");
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_value).toBeNull();
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });

  it("requires side-tagged provenance and removes unrelated persisted sources", () => {
    const out=validateProtectedMetricWiring(
      finding(
        "063",
        tagged("Player One","ATP Official","Coaching Changes: new coach announced"),
        tagged("Player Two","ATP Official","Coaching-Box Presence: regular coach courtside"),
        "PARTIAL",
      ),
      { p1:"Player One", p2:"Player Two" },
    );
    expect(out.sources).toEqual([publicSources[0]]);
    expect(out.sample).toBe("P1:n=12 | P2:n=12");
    expect(out.evidence_family).toBe("EXACT_063");
  });

  it("rejects public-context evidence whose tagged source has no public URL", () => {
    const out=validateProtectedMetricWiring(
      finding(
        "065",
        tagged("Player One","Imported Note","Illness Reports: documented flu"),
        tagged("Player Two","Imported Note","Illness Reports: documented stomach bug"),
        "PARTIAL",
        [{ source_name:"Imported Note", url:null, retrieved_at:"2026-08-22T00:00:00Z" }],
      ),
      { p1:"Player One", p2:"Player Two" },
    );
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
    expect(out.sources).toEqual([]);
  });

  it("requires FORMULA for reconstructed 060/062/064 evidence", () => {
    for(const [code,component,sources] of [
      ["060","Serve–Return Interaction Residual: +2.4 pp",localSources],
      ["062","Points-Defending Pressure: 180 points",publicSources],
      ["064","Qualifying/Lucky-Loser Fatigue: 2 extra matches",publicSources],
    ] as const) {
      const sourceName=sources[0].source_name;
      const out=validateProtectedMetricWiring(
        finding(code,tagged("Player One",sourceName,component),tagged("Player Two",sourceName,component),"RECONSTRUCTED",sources),
        { p1:"Player One", p2:"Player Two" },
      );
      expect(out.p1_treatment,code).toBe("UNAVAILABLE");
      expect(out.p2_treatment,code).toBe("UNAVAILABLE");
      expect(out.missing_inputs).toContain("FORMULA for reconstructed evidence");
    }
  });

  it("rejects reconstructed formulas that introduce cross-family inputs", () => {
    const out=validateProtectedMetricWiring(
      finding(
        "062",
        tagged("Player One","ATP Official","Points-Defending Pressure: 180 points","n=1", "defended_points + recent form + Elo"),
        tagged("Player Two","ATP Official","Points-Defending Pressure: 45 points","n=1", "defended_points + weather"),
        "RECONSTRUCTED",
      ),
      { p1:"Player One", p2:"Player Two" },
    );
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
    expect(out.missing_inputs).toContain("FORMULA uses an input outside the authoritative metric definition");
  });

  it("does not permit factual public-context metrics 063 or 065 to masquerade as reconstructed", () => {
    for(const [code,component] of [
      ["063","Coaching Changes: new coach announced"],
      ["065","Illness Reports: documented flu"],
    ] as const) {
      const out=validateProtectedMetricWiring(
        finding(code,tagged("Player One","ATP Official",component,"n=1","inferred from results"),tagged("Player Two","ATP Official",component,"n=1","inferred from results"),"RECONSTRUCTED"),
        { p1:"Player One", p2:"Player Two" },
      );
      expect(out.p1_treatment,code).toBe("UNAVAILABLE");
      expect(out.p2_treatment,code).toBe("UNAVAILABLE");
      expect(out.missing_inputs).toContain("DIRECT public reporting required; this metric is not reconstructable");
    }
  });

  it("caps a supported strict subset of broad metric 060 at PARTIAL", () => {
    const out=validateProtectedMetricWiring(
      finding(
        "060",
        tagged("Player One","Charted Match Dataset","Serve–Return Interaction Residual: +2.4 pp"),
        tagged("Player Two","Charted Match Dataset","Neutral-Point Win Rate: 52.1%"),
        "DIRECT",
        localSources,
      ),
      { p1:"Player One", p2:"Player Two" },
    );
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("PARTIAL");
  });

  it("allows exact 065 illness reporting through the target guard without requiring generic Availability wording", () => {
    const out=validateProtectedMetricWiring(
      finding(
        "065",
        tagged("Player One","ATP Official","Illness Reports: documented flu"),
        tagged("Player Two","ATP Official","Illness Reports: documented stomach bug"),
        "PARTIAL",
      ),
      { p1:"Player One", p2:"Player Two" },
    );
    expect(out.p1_value).toContain("Illness Reports");
    expect(out.p2_value).toContain("Illness Reports");
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("PARTIAL");
  });

  it("bypasses the generic validated semantic guard only for these five target metrics", () => {
    const source=readFileSync("src/lib/protected-metric-wiring.server.ts","utf8");
    expect(source).toContain("const target = input.metrics.filter((metric) => POST_FIX_CODES.has(familyCode(metric.code)))");
    expect(source).toContain("if (other.length) rows.push(...await validatedCompletionResearcher.metrics({ ...input, metrics: other }))");
    expect(source).toContain("rows.push(...await completionSweepResearcher.metrics({ ...input, metrics: guardedTarget }))");
  });

  it("does not weaken previously certified 041 behavior or force new five-metric tags onto it", () => {
    const out=validateProtectedMetricWiring(finding("041","hold-rate trend improving","hold-rate trend declining","DIRECT",localSources));
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("PARTIAL");
    expect(out.p1_value).toContain("hold-rate trend");
  });

  it("keeps persisted treatment orientation side-specific in the repository", () => {
    const repo=readFileSync("src/lib/audit-repo.server.ts","utf8");
    expect(repo).toContain('select("metric_code, metric_name, p1_treatment, p2_treatment")');
    expect(repo).toContain('player_side: "P1"');
    expect(repo).toContain('player_side: "P2"');
    expect(repo).toContain('onConflict:"metric_code,player_side,audit_run_id"');
  });
});
