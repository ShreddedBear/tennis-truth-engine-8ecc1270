import { describe, expect, it } from "vitest";
import type { MetricFinding } from "./audit-pipeline";
import { validateProtectedMetricWiring } from "./protected-metric-wiring.server";

const sources=[{source_name:"Named public tennis source",url:"https://example.test",retrieved_at:"2026-08-22T00:00:00Z"}];
function finding(code:string,value:string,treatment:MetricFinding["p1_treatment"]="RECONSTRUCTED"):MetricFinding{return{metric_code:code,p1_value:value,p2_value:value,p1_treatment:treatment,p2_treatment:treatment,differential:null,evidence_family:`PROTECTED_${code}`,reliability:.9,sample:"10",unavailable_reason:null,sources};}

describe("post-fix protected wiring 041/043/044/045/046",()=>{
  it("041 rejects convenient recent-form/ranking proxies and accepts only exact improvement components",()=>{
    const bad=validateProtectedMetricWiring(finding("041","ranking improved; recent win pct improved","DIRECT"));
    expect(bad.p1_treatment).toBe("UNAVAILABLE");
    expect(bad.p1_value).toBeNull();
    const partial=validateProtectedMetricWiring(finding("041","opponent-quality-adjusted record trend improving; hold-rate trend improving; despite losses","RECONSTRUCTED"));
    expect(partial.p1_treatment).toBe("PARTIAL");
    expect(partial.missing_inputs).toEqual(expect.arrayContaining(["return-points-won trend","Dominance Ratio trend","break-points-created trend"]));
  });

  it("043 requires a documented favorite failure condition and today's opponent compatibility without making master examples mandatory",()=>{
    const bad=validateProtectedMetricWiring(finding("043","hold pct=78; break pct=24; ranking=18","DIRECT"));
    expect(bad.p1_treatment).toBe("UNAVAILABLE");
    const partial=validateProtectedMetricWiring(finding("043","current favorite; losses as favorite; low first serve failure","RECONSTRUCTED"));
    expect(partial.p1_treatment).toBe("PARTIAL");
    expect(partial.missing_inputs).toEqual(expect.arrayContaining(["today's opponent compatibility"]));
    const complete=validateProtectedMetricWiring(finding("043","current favorite; losses as favorite; failure-mode profile: low first serve; today's opponent can reproduce that failure condition","RECONSTRUCTED"));
    expect(complete.p1_treatment).toBe("RECONSTRUCTED");
    expect(complete.missing_inputs).toBeUndefined();
  });

  it("044 requires underdog upset history and every master similarity dimension",()=>{
    const partial=validateProtectedMetricWiring(finding("044","surface Elo=1810; ranking=44","DIRECT"));
    expect(partial.p1_treatment).toBe("PARTIAL");
    expect(partial.missing_inputs).toEqual(expect.arrayContaining(["underdog-role history","verified upset outcomes","favorite serve-style similarity","favorite return-quality similarity","handedness similarity","rally-style similarity","price similarity","tournament-level similarity","today's favorite orientation"]));
    const complete="current underdog; verified upset wins; today's favorite; Elo similarity; serve style similarity; return quality similarity; court surface similarity; ranking similarity; handedness similarity; rally style similarity; price similarity; tournament level similarity";
    const good=validateProtectedMetricWiring(finding("044",complete,"RECONSTRUCTED"));
    expect(good.p1_treatment).toBe("RECONSTRUCTED");
    expect(good.missing_inputs).toBeUndefined();
  });

  it("045 cannot be replaced by generic pressure/tiebreak statistics",()=>{
    const bad=validateProtectedMetricWiring(finding("045","tiebreak win pct=62; break points saved=70","DIRECT"));
    expect(bad.p1_treatment).toBe("UNAVAILABLE");
    const partial=validateProtectedMetricWiring(finding("045","current favorite; opponent holds first three service games; missed early break chances; favorite broken first","RECONSTRUCTED"));
    expect(partial.p1_treatment).toBe("PARTIAL");
    expect(partial.missing_inputs).toEqual(expect.arrayContaining(["first set reaches 4-4","first-set tiebreak","opponent forces deciding set"]));
  });

  it("046 rejects raw Elo/conditional win-rate substitution and requires thresholds for reconstruction",()=>{
    const bad=validateProtectedMetricWiring(finding("046","surface Elo=1810; deciding-set win pct=61","DIRECT"));
    expect(bad.p1_treatment).toBe("UNAVAILABLE");
    const states="Elo after winning Set 1 1830; Elo after losing Set 1 1740; Elo in deciding sets 1795; Elo in tiebreak-heavy matches 1810; Elo against big servers 1770; Elo against strong returners 1805";
    const partial=validateProtectedMetricWiring(finding("046",states,"RECONSTRUCTED"));
    expect(partial.p1_treatment).toBe("PARTIAL");
    expect(partial.missing_inputs).toEqual(expect.arrayContaining(["big-server threshold","strong-returner threshold"]));
    const complete=validateProtectedMetricWiring(finding("046",`${states}; big-server threshold defined; strong-returner threshold defined`,"RECONSTRUCTED"));
    expect(complete.p1_treatment).toBe("RECONSTRUCTED");
  });

  it("requires named provenance and preserves non-target certified metrics unchanged",()=>{
    const noSource={...finding("041","opponent-quality-adjusted record trend; hold-rate trend; return-points-won trend; Dominance Ratio trend; break-points-created trend; including losses","DIRECT"),sources:[]};
    expect(validateProtectedMetricWiring(noSource).p1_treatment).toBe("UNAVAILABLE");
    const prior=finding("040","ranking fell","DIRECT");
    expect(validateProtectedMetricWiring(prior)).toEqual(prior);
  });
});
