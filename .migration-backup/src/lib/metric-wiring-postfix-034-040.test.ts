import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateMetric } from "./validated-completion-research.server";
import { familyOf, STAT_CATALOG } from "./reconstruction/stat-catalog";

const sources=[{source_name:"Exact field source",url:"https://example.test/source",retrieved_at:"2026-08-22T00:00:00Z"}];
const PROTECTED=new Set(["034","036","037","038","039","040"]);
function finding(code:string,p1:string|null,p2:string|null,treatment:"DIRECT"|"RECONSTRUCTED"|"PARTIAL"="RECONSTRUCTED"){
  return {metric_code:code,p1_value:p1,p2_value:p2,p1_treatment:treatment,p2_treatment:treatment,differential:null,evidence_family:`POSTFIX_${code}`,reliability:.9,sample:"10",unavailable_reason:null,sources};
}

describe("post-fix metric wiring 034/036/038/039/040",()=>{
  it("does not route generic atomic or imported pass-2 stats directly into the five composite metric groups",()=>{
    for(const stat of STAT_CATALOG) expect(PROTECTED.has(String(familyOf(stat.key))),`${stat.key} -> ${familyOf(stat.key)}`).toBe(false);
    const catalog=readFileSync("src/lib/reconstruction/stat-catalog.ts","utf8");
    for(const code of PROTECTED) expect(catalog).not.toContain(`family:\"${code}\"`);
  });

  it("keeps all five out of historical/summary fallback maps and META target maps",()=>{
    const completion=readFileSync("src/lib/completion-sweep-research.server.ts","utf8");
    const hybrid=readFileSync("src/lib/hybrid-audit-research.server.ts","utf8");
    for(const code of PROTECTED){ expect(completion).not.toContain(`  \"${code}\":[`); expect(hybrid).not.toContain(`\"${code}\":[`); }
    const meta=readFileSync("src/lib/meta-derived-evidence.server.ts","utf8");
    expect(meta).toContain('const META_CODES = ["048", "049", "056", "057"]');
    expect(meta).toContain('const STRESS_META_CODES = ["050", "058"]');
  });

  it("routes 037/039 through the owned audit-DB adapter and never into generic live fallback",()=>{
    const warehouse=readFileSync("src/lib/warehouse-first-researcher.server.ts","utf8");
    expect(warehouse).toContain('import { auditDbCompositeMetric, isAuditDbCompositeMetric }');
    expect(warehouse).toContain("const auditDb = await auditDbCompositeMetric");
    expect(warehouse).toContain("return !isAuditDbCompositeMetric(code) && !fullyUsableFinding");
    const completion=readFileSync("src/lib/completion-sweep-research.server.ts","utf8");
    expect(completion).not.toContain('"037":[');
  });

  it("034 rejects raw neighboring inputs unless the required scoreline comparisons are actually formed",()=>{
    const result=validateMetric({code:"034",name:"Scoreline Deception Index",body:null},finding("034","scoreline=6-4 6-4; total points won=52%; expected games=12.4; break opportunities=7; dominance ratio=1.08; score state available","scoreline=4-6 4-6; total points won=48%; expected games=10.6; break opportunities=4; dominance ratio=.93; score state available"));
    expect(result.p1_treatment).toBe("UNAVAILABLE"); expect(result.p2_treatment).toBe("UNAVAILABLE"); expect(result.p1_value).toBeNull();
    expect(result.missing_inputs).toEqual(expect.arrayContaining(["scoreline vs point dominance","scoreline vs expected games","scoreline vs break opportunities","scoreline vs dominance ratio","clutch-performance dependency"]));
  });

  it("034 accepts only explicit comparison components and keeps P1/P2 orientation independent",()=>{
    const full="scoreline vs point dominance=+2.1; scoreline vs expected games=+1.4; scoreline vs break opportunities=+0.8; scoreline vs dominance ratio=+0.05; clutch performance dependency=low";
    const result=validateMetric({code:"034",name:"Scoreline Deception Index",body:null},finding("034",full,"total points won=49%"));
    expect(result.p1_treatment).toBe("RECONSTRUCTED"); expect(result.p1_value).toBe(full); expect(result.p2_treatment).toBe("UNAVAILABLE"); expect(result.p2_value).toBeNull();
  });

  it("036 stays PARTIAL when only a subset of the fifteen loss-autopsy components is supported",()=>{
    const partial="loss favorite status=favored; loss opponent quality=Elo 1880; loss surface=hard; loss point differential=-3; loss break differential=-1; loss match length=108 min";
    const result=validateMetric({code:"036",name:"Loss Autopsy Metrics",body:null},finding("036",partial,partial,"DIRECT"));
    expect(result.p1_treatment).toBe("PARTIAL"); expect(result.p2_treatment).toBe("PARTIAL");
    expect(result.missing_inputs).toEqual(expect.arrayContaining(["loss serve deterioration","loss return deterioration","lost after leading","loss physical problem","bad-loss severity index"]));
  });

  it("037 requires real scored-win inputs rather than generic recent form",()=>{
    const generic="straight set win pct=64; recent win pct=70; opponent rank mean=38";
    const rejected=validateMetric({code:"037",name:"Win Autopsy Metrics",body:null},finding("037",generic,generic));
    expect(rejected.p1_treatment).toBe("UNAVAILABLE"); expect(rejected.p2_treatment).toBe("UNAVAILABLE");
    const exact="recent scored wins=50; pre match win probability range=45-80 pct; final score margin close wins=14/50; win autopsy category distribution=DOMINANT:12,ROUTINE:20,ESCAPE:8,UPSET_WIN:10";
    const accepted=validateMetric({code:"037",name:"Win Autopsy Metrics",body:null},finding("037",exact,exact));
    expect(accepted.p1_treatment).toBe("RECONSTRUCTED"); expect(accepted.p2_treatment).toBe("RECONSTRUCTED");
  });

  it("038 requires the same-opponent norm in every residual rather than accepting generic residual labels",()=>{
    const generic="hold residual=+4; break residual=+2; total points residual=+3; games residual=+1; sets residual=0; dominance ratio residual=+.08; serve points residual=+2; return points residual=+1";
    const result=validateMetric({code:"038",name:"Opponent-Adjusted Residual Performance",body:null},finding("038",generic,generic));
    expect(result.p1_treatment).toBe("UNAVAILABLE"); expect(result.p2_treatment).toBe("UNAVAILABLE"); expect(result.p1_value).toBeNull();
  });

  it("038 recognizes correctly oriented opponent-norm residuals only when all eight components are present",()=>{
    const full="hold residual vs opponent norm=+4; break residual vs opponent norm=+2; total points residual vs opponent norm=+3; games residual vs opponent norm=+1; sets residual vs opponent norm=0; dominance ratio residual vs opponent norm=+.08; serve points residual vs opponent norm=+2; return points residual vs opponent norm=+1";
    const result=validateMetric({code:"038",name:"Opponent-Adjusted Residual Performance",body:null},finding("038",full,full));
    expect(result.p1_treatment).toBe("RECONSTRUCTED"); expect(result.p2_treatment).toBe("RECONSTRUCTED");
  });

  it("039 does not accept a generic or hindsight expected-performance value as the required pre-match expectation",()=>{
    const hindsight="actual performance=61; expected performance=55; performance surprise=+6; rolling performance surprise=+2.4";
    const result=validateMetric({code:"039",name:"Performance Surprise Rating",body:null},finding("039",hindsight,hindsight));
    expect(result.p1_treatment).toBe("PARTIAL"); expect(result.p2_treatment).toBe("PARTIAL"); expect(result.missing_inputs).toContain("pre-match expected performance");
  });

  it("039 permits reconstruction when the expectation is explicitly frozen before each match and rolling last-10 surprise is present",()=>{
    const full="actual performance=61; pre match expected performance=55; performance surprise=+6; rolling performance surprise last 10=+2.4";
    const result=validateMetric({code:"039",name:"Performance Surprise Rating",body:null},finding("039",full,full));
    expect(result.p1_treatment).toBe("RECONSTRUCTED"); expect(result.p2_treatment).toBe("RECONSTRUCTED");
  });

  it("040 rejects ranking/form proxies and requires exact decline-trend components",()=>{
    const result=validateMetric({code:"040",name:"Hidden Decline Detector",body:null},finding("040","ranking trend=-12; recent win pct=40","ranking trend=-4; recent win pct=50","PARTIAL"));
    expect(result.p1_treatment).toBe("UNAVAILABLE"); expect(result.p2_treatment).toBe("UNAVAILABLE");
  });

  it("requires sourced exact components and stated calculations for reconstructed evidence",()=>{
    const researcher=readFileSync("src/lib/audit-research.server.ts","utf8");
    expect(researcher).toContain("RECONSTRUCTED is allowed only when every required component of the exact formula/definition is sourced and the calculation is stated");
    expect(researcher).toContain("Do not substitute a convenient statistic for the statistic the definition actually requires");
  });

  it("the five protected metric definitions remain exact and unchanged",()=>{
    const master=readFileSync("public/seed/metrics.txt","utf8");
    for(const marker of ["34. Scoreline Deception Index","36. Loss Autopsy Metrics","37. Win Autopsy Metrics","38. Opponent-Adjusted Residual Performance","39. Performance Surprise Rating","40. Hidden Decline Detector"]) expect(master).toContain(marker);
  });
});