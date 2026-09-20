import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MetricFinding } from "./audit-pipeline";
import { EVIDENCE_REQUIREMENTS } from "./evidence-gap";
import { familyOf, STAT_CATALOG } from "./reconstruction/stat-catalog";
import { RECONSTRUCTION_SPECS } from "./reconstruction/specs";
import { validateMetric } from "./validated-completion-research.server";

const PROTECTED = ["051", "052", "053", "054", "059"] as const;
const names: Record<string,string> = {
  "051":"Opponent-Specific Set/Match Probabilities",
  "052":"Entropy & Lead Durability",
  "053":"Pressure & Clean-Game Metrics",
  "054":"Additional Shot-Level Efficiency",
  "059":"Loss Path Probability",
};
const components: Record<string,string[]> = {
  "051":["Opponent-Specific Break Expectancy","Opponent-Specific Hold Expectancy","Set Win Expectancy","Expected Set-1 Winner","Expected Deciding-Set Winner","2-0 Conditional Probability","2-1 Conditional Probability","Break-First to 2-0 Conversion","Set-1 Win to 2-0 Conversion","Set-1 Loss to Match-Loss Probability"],
  "052":["Set-Score Entropy","Game-Score Entropy","Lead Durability Index","Deficit Survivability Index","Double-Break Creation Rate","Double-Break Surrender Rate","Rebreak-Window Probability","Break Clustering"],
  "053":["Pressure Accumulation Score","Serve Escape Dependency","Clean-Hold Rate","Clean-Break Rate","Love/15 Hold Rate","Return-Game Abandonment Rate"],
  "054":["First-Strike Efficiency","Neutral-Rally Efficiency","Defense-to-Offense Conversion","Attack Conversion Rate","Depth-Pressure Differential","Baseline Territory Differential","Directional Vulnerability","Backhand-Under-Pressure Performance","Forehand-Under-Pressure Performance","Running-Forehand Effectiveness","Running-Backhand Effectiveness","Second-Serve Return Aggression","First-Ball-After-Return Effectiveness","Net-Approach Deterrence"],
  "059":["Loss Path Opponent Serves Through","Loss Path Return Exposed","Loss Path Slow Start/Set-1 Loss","Loss Path Physical Decline","Loss Path Tiebreak Variance","Loss Path Three-Set Collapse","Loss Path Other"],
};
const source={source_name:"Verified Test Source",url:"https://example.test",retrieved_at:"2026-08-22T00:00:00Z"};
function finding(code:string,p1:string|null,p2:string|null,treatment:MetricFinding["p1_treatment"]="DIRECT"):MetricFinding{return{metric_code:code,p1_value:p1,p2_value:p2,p1_treatment:treatment,p2_treatment:treatment,differential:null,evidence_family:null,reliability:90,sample:"legacy-shared-sample",unavailable_reason:null,sources:[source]};}
function tagged(player:string,body:string,formula?:string){return `PLAYER=${player}; SOURCE=${source.source_name}; SAMPLE=25 matches; ${formula?`FORMULA=${formula}; `:""}${body}`;}
function def(code:string){return{code,name:names[code],body:"authoritative definition"};}

describe("post-fix wiring verification 051/052/053/054/059",()=>{
  it("pins recovery classes and required input families",()=>{
    expect(EVIDENCE_REQUIREMENTS["051"]).toMatchObject({recovery:"META_DERIVED",requiredData:"opponent-specific serve/return expectations plus set/match model"});
    expect(EVIDENCE_REQUIREMENTS["052"]).toMatchObject({recovery:"SOURCE_REQUIRED",requiredData:"set/game probability distribution plus break/rebreak/lead histories"});
    expect(EVIDENCE_REQUIREMENTS["053"]).toMatchObject({recovery:"SPECIALIZED_DATA",requiredData:"game score sequences including 30-all, deuce and break points"});
    expect(EVIDENCE_REQUIREMENTS["054"]).toMatchObject({recovery:"SPECIALIZED_DATA",requiredData:"charted rally/shot direction, position and attack/defense outcomes"});
    expect(EVIDENCE_REQUIREMENTS["059"]).toMatchObject({recovery:"META_DERIVED",requiredData:"completed independent model inputs and pathway model"});
  });

  it("rejects generic proxies for every protected metric even with plausible provenance tags",()=>{
    for(const code of PROTECTED){
      const proxy=tagged("Player One","hold_pct=82; break_pct=24; surface_elo=1840; set_win_pct=61");
      const out=validateMetric(def(code),finding(code,proxy,proxy),{p1:"Player One",p2:"Player Two"});
      expect(out.p1_treatment,code).toBe("UNAVAILABLE");
      expect(out.p1_value,code).toBeNull();
    }
  });

  it("caps one exact component at PARTIAL rather than full DIRECT",()=>{
    for(const code of PROTECTED){
      const one=tagged("Player One",`${components[code][0]}=supported`);
      const two=tagged("Player Two",`${components[code][0]}=supported`);
      const out=validateMetric(def(code),finding(code,one,two),{p1:"Player One",p2:"Player Two"});
      expect(out.p1_treatment,code).toBe("PARTIAL");
      expect(out.p2_treatment,code).toBe("PARTIAL");
    }
  });

  it("preserves DIRECT only when every exact component and side provenance is present",()=>{
    for(const code of PROTECTED){
      const body=components[code].map(x=>`${x}=supported`).join("; ");
      const out=validateMetric(def(code),finding(code,tagged("Player One",body),tagged("Player Two",body)),{p1:"Player One",p2:"Player Two"});
      expect(out.p1_treatment,code).toBe("DIRECT");
      expect(out.p2_treatment,code).toBe("DIRECT");
      expect(out.evidence_family,code).toBe(`EXACT_${code}`);
      expect(out.sample,code).toContain("P1:25 matches");
      expect(out.sample,code).toContain("P2:25 matches");
    }
  });

  it("rejects reversed P1/P2 identity tags",()=>{
    const body=components["051"].map(x=>`${x}=supported`).join("; ");
    const out=validateMetric(def("051"),finding("051",tagged("Player Two",body),tagged("Player One",body)),{p1:"Player One",p2:"Player Two"});
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });

  it("rejects wrong source or missing sample provenance",()=>{
    const body=components["053"].map(x=>`${x}=supported`).join("; ");
    const badSource=`PLAYER=Player One; SOURCE=Unrelated Source; SAMPLE=20 games; ${body}`;
    const noSample=`PLAYER=Player Two; SOURCE=${source.source_name}; ${body}`;
    const out=validateMetric(def("053"),finding("053",badSource,noSample),{p1:"Player One",p2:"Player Two"});
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });

  it("requires a stated formula for RECONSTRUCTED and still caps incomplete reconstruction at PARTIAL",()=>{
    const all=components["052"].map(x=>`${x}=supported`).join("; ");
    const noFormula=validateMetric(def("052"),finding("052",tagged("Player One",all),tagged("Player Two",all),"RECONSTRUCTED"),{p1:"Player One",p2:"Player Two"});
    expect(noFormula.p1_treatment).toBe("UNAVAILABLE");
    const one=components["052"][0];
    const withFormula=validateMetric(def("052"),finding("052",tagged("Player One",`${one}=supported`,"entropy from sourced score distribution"),tagged("Player Two",`${one}=supported`,"entropy from sourced score distribution"),"RECONSTRUCTED"),{p1:"Player One",p2:"Player Two"});
    expect(withFormula.p1_treatment).toBe("PARTIAL");
    expect(withFormula.p2_treatment).toBe("PARTIAL");
  });

  it("keeps generic local/pass-2 fallback maps from feeding these five",()=>{
    const hybrid=readFileSync("src/lib/hybrid-audit-research.server.ts","utf8");
    const completion=readFileSync("src/lib/completion-sweep-research.server.ts","utf8");
    for(const code of PROTECTED){
      expect(hybrid,`${code} SUMMARY_KEYS fallback`).not.toMatch(new RegExp(`\\"${code}\\"\\s*:`));
      expect(completion,`${code} HISTORICAL_KEYS fallback`).not.toMatch(new RegExp(`HISTORICAL_KEYS[^;]*\\"${code}\\"\\s*:`));
    }
  });

  it("keeps atomic statistics and deterministic reconstruction outputs out of protected families",()=>{
    for(const stat of STAT_CATALOG)expect(PROTECTED).not.toContain(String(familyOf(stat.key)));
    const forbidden=["opponent_specific_break_expectancy","opponent_specific_hold_expectancy","set_win_expectancy","expected_set1_winner","expected_deciding_set_winner","conditional_2_0_probability","conditional_2_1_probability","loss_path_probability","loss_path_opponent_serves_through","loss_path_return_exposed","loss_path_slow_start","loss_path_physical_decline","loss_path_tiebreak_variance","loss_path_three_set_collapse"];
    for(const output of forbidden)expect(RECONSTRUCTION_SPECS.some(x=>x.output===output),output).toBe(false);
  });

  it("does not weaken previously certified exact guards or loss-autopsy aliases",()=>{
    const validator=readFileSync("src/lib/validated-completion-research.server.ts","utf8");
    for(const legacy of ["026","029","031","032","033"])expect(validator).toMatch(new RegExp(`PROTECTED_EXACT_METRICS[^\\n]*\\"${legacy}\\"`));
    expect(validator).toContain('{name:"loss serve deterioration",terms:["loss serve deterioration","serve deterioration","serve decline"]}');
    expect(validator).toContain('{name:"loss return deterioration",terms:["loss return deterioration","return deterioration","return decline"]}');
  });
});
