import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const calc=readFileSync("src/lib/deterministic-rules-context-metric.server.ts","utf8");
const ingestion=readFileSync("src/lib/ingestion/rules-context.server.ts","utf8");
const researcher=readFileSync("src/lib/warehouse-first-researcher.server.ts","utf8");

describe("metric 075 rules context wiring",()=>{
  it("uses only RULES_CONTEXT for metric 075",()=>{
    expect(calc).toContain('code!=="075"');
    expect(calc).toContain('metricAllowsObservation(code,r)');
    expect(calc).toContain('evidence_family:"RULES_CONTEXT"');
  });
  it("keeps deterministic rules output partial",()=>{
    expect(calc).toContain('p1_treatment:"PARTIAL"');
    expect(calc).toContain('p2_treatment:"PARTIAL"');
  });
  it("hard-asserts the ingestion family and runs before unresolved live fallback",()=>{
    expect(ingestion).toContain('assertObservationFamily(row,"RULES_CONTEXT")');
    const rulesIndex=researcher.indexOf("deterministicRulesContextMetric({");
    const liveIndex=researcher.indexOf("finalMetricWiringResearcher.metrics({...input,context,metrics:remainingLiveMissing})");
    expect(rulesIndex).toBeGreaterThan(-1);
    expect(liveIndex).toBeGreaterThan(rulesIndex);
  });
});
