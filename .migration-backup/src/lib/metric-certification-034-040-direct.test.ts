import { describe, expect, it } from "vitest";
import { validateMetric } from "./validated-completion-research.server";

const sources=[{source_name:"Named source",url:"https://example.test",retrieved_at:"2026-08-22T00:00:00Z"}];

describe("protected composite DIRECT treatment",()=>{
  it("does not let a named source plus one neighboring statistic make the broad metric DIRECT or PARTIAL",()=>{
    const finding=validateMetric({code:"034",name:"Scoreline Deception Index",body:null},{
      metric_code:"034",p1_value:"total points won=52%",p2_value:"total points won=48%",
      p1_treatment:"DIRECT",p2_treatment:"DIRECT",differential:null,evidence_family:"POINTS",reliability:.9,sample:"1",unavailable_reason:null,sources,
    });
    expect(finding.p1_treatment).toBe("UNAVAILABLE");
    expect(finding.p2_treatment).toBe("UNAVAILABLE");
    expect(finding.p1_value).toBeNull();
    expect(finding.p2_value).toBeNull();
    expect(finding.missing_inputs).toEqual(expect.arrayContaining(["scoreline vs point dominance","scoreline vs expected games","scoreline vs break opportunities","scoreline vs dominance ratio","clutch-performance dependency"]));
  });

  it("rejects proxy-only DIRECT evidence even when a named source is attached",()=>{
    const finding=validateMetric({code:"040",name:"Hidden Decline Detector",body:null},{
      metric_code:"040",p1_value:"ranking fell 12 places",p2_value:"recent win pct=40",
      p1_treatment:"DIRECT",p2_treatment:"DIRECT",differential:null,evidence_family:"FORM",reliability:.8,sample:"10",unavailable_reason:null,sources,
    });
    expect(finding.p1_treatment).toBe("UNAVAILABLE");
    expect(finding.p2_treatment).toBe("UNAVAILABLE");
    expect(finding.p1_value).toBeNull();
    expect(finding.p2_value).toBeNull();
  });
});