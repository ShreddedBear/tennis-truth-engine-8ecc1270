import { describe, expect, it } from "vitest";
import { certifyMetricFinding, CERTIFIED_METRIC_POLICIES } from "./metric-certification";
import type { MetricFinding } from "./audit-pipeline";

const src=[{source_name:"Named source",url:"https://example.test",retrieved_at:"2026-08-22T00:00:00Z"}];
function row(code:string,value:string):MetricFinding{return{metric_code:code,p1_value:value,p2_value:value,p1_treatment:"DIRECT",p2_treatment:"DIRECT",differential:null,evidence_family:`EXACT_${code}`,reliability:90,sample:"context",unavailable_reason:null,sources:src};}

describe("mixed-field firewall for 072-076",()=>{
  it("rejects a correct component when an unrelated field is mixed into the same metric value",()=>{
    const cases:[string,string][]=[
      ["072","verified one-handed backhand type; surface Elo=1850"],
      ["073","player public statement from press conference; sportsbook odds line movement"],
      ["074","charted serve toss consistency from toss placement; ranking=15"],
      ["075","official deciding-set tiebreak format uses a 10-point breaker; roof closed"],
      ["076","official order of play lists first on court; rest hours=18"],
    ];
    for(const [code,value] of cases){const out=certifyMetricFinding(row(code,value));expect(CERTIFIED_METRIC_POLICIES[code].rejectForbiddenFields).toBe(true);expect(out.p1_treatment,code).toBe("UNAVAILABLE");expect(out.p2_treatment,code).toBe("UNAVAILABLE");expect(out.p1_value).toBeNull();expect(out.p2_value).toBeNull();expect(out.unavailable_reason).toContain("Cross-wired/forbidden fields");}
  });
});
