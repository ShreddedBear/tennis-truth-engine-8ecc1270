import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MetricFinding } from "./audit-pipeline";
import { validateMetric } from "./validated-completion-research.server";
import { familyOf, STAT_CATALOG } from "./reconstruction/stat-catalog";

const protectedCodes=new Set(["026","029","031","032","033"]);
const expected={p1:"Player One",p2:"Player Two"};
const sources=[{source_name:"Exact Source",url:"https://example.test/exact",retrieved_at:"2026-08-22T00:00:00Z"}];
const defs={
  "026":{code:"026",name:"Early-Warning / Slow-Start Metrics",body:"opening-game point/game sequence and early serve/return statistics"},
  "029":{code:"029",name:"Psychological/Behavioral Proxies",body:"score-state event sequences, pressure errors and closing/recovery histories"},
  "031":{code:"031",name:"Extended Opponent-Network Metrics",body:"shared-opponent network, rankings/Elo, scores, games/sets and opponent strength"},
  "032":{code:"032",name:"Point-to-Game Conversion Efficiency",body:"service/return points, games, breaks and deuce/score-state data"},
  "033":{code:"033",name:"Break Quality Differential",body:"break-point sequence plus return pressure and opponent-error detail"},
} as const;
function finding(code:keyof typeof defs,p1:string,p2:string,treatment:MetricFinding["p1_treatment"]="PARTIAL"):MetricFinding{return{metric_code:code,p1_value:p1,p2_value:p2,p1_treatment:treatment,p2_treatment:treatment,differential:null,evidence_family:code,reliability:.9,sample:"legacy shared sample",unavailable_reason:null,sources};}
function tagged(player:string,body:string,formula?:string){return`PLAYER=${player}; SOURCE=Exact Source; SAMPLE=12 matches; ${formula?`FORMULA=${formula}; `:""}${body}`;}

describe("post-fix wiring verification 026/029/031/032/033",()=>{
  it("rejects P1/P2 reversal rather than trusting response row position",()=>{
    const out=validateMetric(defs["031"],finding("031",tagged(expected.p2,"Common-opponent hold differential: +3.2 pp"),tagged(expected.p1,"Common-opponent hold differential: -3.2 pp")),expected);
    expect(out.p1_treatment).toBe("UNAVAILABLE");expect(out.p2_treatment).toBe("UNAVAILABLE");
    expect(out.unavailable_reason?.toLowerCase()).toContain("side reversal");
  });

  it("requires each protected side to cite a source that exists in persisted provenance",()=>{
    const out=validateMetric(defs["026"],finding("026","PLAYER=Player One; SOURCE=Wrong Source; SAMPLE=12 matches; Opening service-game hold: 9/12",tagged(expected.p2,"Opening service-game hold: 8/12")),expected);
    expect(out.p1_treatment).toBe("UNAVAILABLE");expect(out.p2_treatment).toBe("PARTIAL");
    expect(out.missing_inputs).toContain("side-specific SOURCE matching persisted source list");
  });

  it("persists side-tagged samples instead of treating one shared sample as both players",()=>{
    const out=validateMetric(defs["029"],finding("029",tagged(expected.p1,"Response after losing a close set: 5/12"),tagged(expected.p2,"Response after losing a close set: 7/12")),expected);
    expect(out.sample).toBe("P1:12 matches | P2:12 matches");
    expect(out.evidence_family).toBe("EXACT_029");
  });

  it("requires an explicit formula for RECONSTRUCTED protected evidence",()=>{
    const body="Sustainable Break Score; sustained return pressure; opponent donations from double faults and unforced errors";
    const noFormula=validateMetric(defs["033"],finding("033",tagged(expected.p1,body),tagged(expected.p2,body),"RECONSTRUCTED"),expected);
    expect(noFormula.p1_treatment).toBe("UNAVAILABLE");expect(noFormula.p2_treatment).toBe("UNAVAILABLE");
    const withFormula=validateMetric(defs["033"],finding("033",tagged(expected.p1,body,"supported return-pressure inputs versus sourced opponent donations"),tagged(expected.p2,body,"supported return-pressure inputs versus sourced opponent donations"),"RECONSTRUCTED"),expected);
    expect(withFormula.p1_treatment).toBe("RECONSTRUCTED");expect(withFormula.p2_treatment).toBe("RECONSTRUCTED");
  });

  it("does not allow generic pass-2 atomic-stat family routing into the five protected groups",()=>{
    for(const stat of STAT_CATALOG)expect(protectedCodes.has(String(familyOf(stat.key))),`${stat.key} routes to protected ${familyOf(stat.key)}`).toBe(false);
    for(const key of ["hold_pct","break_pct","break_point_conversion_pct","service_points_won_pct","return_points_won_pct","tiebreak_win_pct","common_opponent_win_pct"])expect(protectedCodes.has(String(familyOf(key)))).toBe(false);
  });

  it("has no local-history fallback mapping for these protected metric codes",()=>{
    const text=readFileSync("src/lib/completion-sweep-research.server.ts","utf8");
    const block=text.slice(text.indexOf("const HISTORICAL_KEYS"),text.indexOf("const PARTIAL_FAMILIES"));
    for(const code of protectedCodes)expect(block).not.toContain(`\"${code}\"`);
  });

  it("does not route style evidence or generic proxies into these metrics on pass 2",()=>{
    expect(familyOf("serve_aggression_proxy")).toBe("023");
    expect(familyOf("return_pressure_proxy")).toBe("023");
    expect(familyOf("style_serve_vs_return_edge")).toBe("023");
    expect(familyOf("common_opponent_win_pct")).toBe("080");
  });

  it("adds strict player/source/sample instructions only for the five protected metrics",()=>{
    const text=readFileSync("src/lib/validated-completion-research.server.ts","utf8");
    expect(text).toContain('new Set(["026","029","031","032","033"])');
    expect(text).toContain("P1 must use PLAYER=${p1}; P2 must use PLAYER=${p2}");
    expect(text).toContain("RECONSTRUCTED additionally requires FORMULA=");
  });
});
